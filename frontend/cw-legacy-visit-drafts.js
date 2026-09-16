(function () {
  'use strict';
  const store = window.CWFieldWriteStore, captured = store.session(), entries = new Map();
  let requestRevision = 0;
  const fields = ['notes','ph','chlorine','alkalinity','salt','products'];
  const labels = { notes: 'Observações', ph: 'pH', chlorine: 'Cloro', alkalinity: 'Alcalinidade', salt: 'Sal', products: 'Produtos' };
  const values = value => Object.fromEntries(fields.map(field => [field, value?.[field] == null ? '' : String(value[field])]));
  const key = id => 'cwLegacyVisitDraft:v1:' + captured.owner + ':' + id;
  const active = () => store.same(captured);
  function requireActive() { if (!active()) throw Error('A sessão mudou. Reabra a visita com a conta original.'); }
  function read(id) {
    requireActive(); const raw = localStorage.getItem(key(id)); if (!raw) return { raw, value: null };
    let value; try { value = JSON.parse(raw); } catch (_) { throw Error('Rascunho ilegível. Os dados foram preservados; peça apoio ao escritório.'); }
    const validFields = object => object && Object.keys(object).length === fields.length && fields.every(field => typeof object[field] === 'string' && object[field].length <= 20000);
    if (!value || value.v !== 1 || value.owner !== captured.owner || value.visitId !== id || !validFields(value.fields) || !validFields(value.baseline) || !Number.isFinite(Date.parse(value.savedAt)) || Object.keys(value).some(field => !['v','owner','visitId','fields','baseline','savedAt'].includes(field))) throw Error('O rascunho não corresponde à visita/conta ou está ilegível. Preserve os dados e peça revisão.');
    return { raw, value };
  }
  function paint(entry, fill = false) {
    if (!entry.element?.isConnected) return;
    const blocked = !active() || entry.checking || entry.conflict || !!entry.request || entry.completed;
    for (const field of fields) { const input = entry.element.querySelector('#' + field + '-' + entry.id); input.readOnly = blocked; if (fill) input.value = entry.fields[field]; }
    const complete = entry.element.querySelector('[data-action="complete"]');
    if (complete) complete.disabled = entry.routeBlocked || blocked || entry.pending > 0 || !!entry.error || entry.conflicts.size > 0;
    entry.status.textContent = !active() ? 'A sessão mudou. O rascunho foi preservado.' : entry.error || (entry.conflict ? 'O rascunho mudou noutra janela. Copie o texto desta janela antes de recarregar para rever o rascunho guardado.' : entry.request ? (entry.request.response ? 'Conclusão confirmada. Rascunho conservado para consulta.' : 'Existe uma conclusão guardada por confirmar. Use a recuperação do pedido original.') : entry.completed ? 'Visita concluída. Use a correção da visita para alterar o registo.' : entry.conflicts.size ? 'Os dados da visita mudaram. Reveja cada diferença antes de concluir.' : entry.checking ? 'A verificar os pedidos guardados…' : entry.pending ? 'A guardar rascunho neste dispositivo…' : entry.observed ? 'Rascunho guardado neste dispositivo; ainda não submetido.' : 'Os campos serão guardados neste dispositivo enquanto preenche.');
    entry.retry.hidden = !entry.error || blocked || entry.conflicts.size > 0;
    entry.review.replaceChildren();
    for (const [field, server] of entry.conflicts) {
      const row = document.createElement('div'); row.style.cssText = 'margin:12px 0;padding:10px;border:1px solid #a1b5c8;border-radius:8px;overflow-wrap:anywhere';
      const label = document.createElement('strong'); label.textContent = labels[field]; row.append(label);
      for (const [name, value] of [['Atual na visita',server],['Rascunho',entry.fields[field]]]) { const item = document.createElement('p'); item.textContent = name + ': ' + (value || '(vazio)'); row.append(item); }
      for (const [name, useServer] of [['Usar atual',true],['Manter rascunho',false]]) { const button = document.createElement('button'); button.type = 'button'; button.textContent = name; button.disabled = blocked; button.style.cssText = 'min-height:44px;margin:4px 0;white-space:normal'; button.addEventListener('click', () => { if (!active()) return; if (useServer) entry.fields[field] = server; entry.baseline[field] = server; entry.conflicts.delete(field); paint(entry,true); schedule(entry); }); row.append(button); }
      entry.review.append(row);
    }
  }
  async function requests() { return store.records('VISIT_COMPLETION', captured, true); }
  async function refreshRequests() {
    const revision = ++requestRevision;
    if (!active()) { for (const entry of entries.values()) paint(entry); return; }
    try { const rows = await requests(); if (!active() || revision !== requestRevision) return; for (const entry of entries.values()) { entry.request = rows.find(row => row.resourceId === entry.id) || null; entry.checking = false; paint(entry); } }
    catch (error) { if (active() && revision === requestRevision) for (const entry of entries.values()) { entry.checking = false; entry.error = error.message; paint(entry); } }
  }
  function schedule(entry) {
    if (!active() || entry.conflict || entry.request || entry.completed) return;
    const draft = { v:1,owner:captured.owner,visitId:entry.id,fields:{...entry.fields},baseline:{...entry.baseline},savedAt:new Date().toISOString() };
    const generation = ++entry.revision; ++entry.pending; entry.error = ''; paint(entry);
    entry.chain = entry.chain.catch(() => {}).then(async () => {
      requireActive(); if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar o rascunho entre janelas. Preserve os campos.');
      await navigator.locks.request(key(entry.id), async () => {
        requireActive(); if (entry.conflict) throw Error('O rascunho mudou noutra janela. Copie os campos antes de recarregar.');
        const row = (await requests()).find(row => row.resourceId === entry.id);
        if (row) { entry.request = row; throw Error('Já existe uma conclusão guardada. O rascunho atual foi conservado; confirme o pedido original.'); }
        const current = read(entry.id);
        if (current.raw !== entry.observed) { entry.conflict = true; throw Error('O rascunho mudou noutra janela. Copie o texto desta janela antes de recarregar.'); }
        if (fields.some(field => draft.fields[field].length > 20000)) throw Error('O campo excede o espaço permitido para o rascunho. Copie o texto e reduza-o antes de guardar.');
        requireActive(); const raw = JSON.stringify(draft); localStorage.setItem(key(entry.id),raw);
        if (localStorage.getItem(key(entry.id)) !== raw) throw Error('Não foi possível confirmar a gravação do rascunho.');
        entry.observed = raw;
        if (generation === entry.revision) entry.error = '';
      });
    }).catch(error => { if (active()) entry.error = 'Os campos não ficaram guardados. ' + error.message; }).finally(() => { --entry.pending; if (generation === entry.revision || !entry.pending) paint(entry); });
  }
  function bind(element, visit) {
    if (!active()) return;
    let entry = entries.get(visit.id); const server = values(visit);
    if (!entry) {
      entry = { id:visit.id,fields:{...server},baseline:{...server},observed:null,revision:0,pending:0,chain:Promise.resolve(),conflicts:new Map(),checking:true,conflict:false,error:'',request:null };
      try { const saved = read(visit.id); entry.observed = saved.raw; if (saved.value) { entry.fields = saved.value.fields; entry.baseline = saved.value.baseline; } }
      catch (error) { entry.conflict = true; entry.error = error.message; }
      entries.set(visit.id,entry);
    }
    entry.element = element; entry.completed = !!visit.endAt || ['DONE','COMPLETED','CONCLUDED'].includes(visit.status); entry.routeBlocked = !!element.querySelector('[data-action="complete"]')?.disabled;
    if (!entry.conflict && !entry.completed && !entry.request) for (const field of fields) {
      if (entry.fields[field] === entry.baseline[field]) { entry.fields[field] = server[field]; entry.baseline[field] = server[field]; entry.conflicts.delete(field); }
      else if (server[field] !== entry.baseline[field] && server[field] !== entry.fields[field]) entry.conflicts.set(field,server[field]);
      else { entry.baseline[field] = server[field]; entry.conflicts.delete(field); }
    }
    const panel = document.createElement('div'); panel.className = 'legacy-visit-draft'; panel.style.cssText = 'padding:10px 0;overflow-wrap:anywhere';
    entry.status = document.createElement('p'); entry.status.id = 'legacyDraftStatus-' + visit.id; entry.status.setAttribute('role','status'); entry.status.setAttribute('data-cw-state-managed','manual');
    entry.review = document.createElement('div'); entry.review.id = 'legacyDraftReview-' + visit.id;
    entry.retry = document.createElement('button'); entry.retry.type = 'button'; entry.retry.textContent = 'Guardar rascunho novamente'; entry.retry.id = 'legacyDraftRetry-' + visit.id; entry.retry.addEventListener('click',()=>schedule(entry));
    panel.append(entry.status,entry.review,entry.retry); element.querySelector('.visit-actions').before(panel);
    for (const field of fields) element.querySelector('#' + field + '-' + visit.id).addEventListener('input',event=>{if(!active()||entry.conflict||entry.request||entry.completed)return;entry.fields[field]=event.target.value;schedule(entry);});
    paint(entry,true); refreshRequests();
  }
  async function beforeComplete(id) {
    requireActive(); const entry = entries.get(id); if (!entry) throw Error('Reabra o formulário antes de concluir.');
    await entry.chain; requireActive(); await refreshRequests();
    if (entry.conflict || entry.error || entry.conflicts.size || entry.request || entry.completed) throw Error(entry.error || entry.status.textContent);
    schedule(entry); await entry.chain; requireActive(); if (entry.error || entry.conflict || entry.request) throw Error(entry.error || entry.status.textContent);
    return { ...entry.fields };
  }
  window.addEventListener('storage',event=>{for(const entry of entries.values()){if(active()&&event.key===key(entry.id)&&event.newValue!==entry.observed){entry.conflict=true;paint(entry);}else if(!active())paint(entry);}});
  window.addEventListener('cw:field-write-change',refreshRequests);
  window.addEventListener('beforeunload',event=>{if(active()&&Array.from(entries.values()).some(entry=>entry.pending>0||entry.error||entry.conflict)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pageshow',refreshRequests);
  setInterval(()=>{if(!active())for(const entry of entries.values())paint(entry);},1000);
  window.CWLegacyVisitDrafts = { bind, beforeComplete, refresh:refreshRequests };
})();
