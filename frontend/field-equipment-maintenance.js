(() => {
  'use strict';
  const root = document.getElementById('fieldEquipmentMaintenance'), store = window.CWFieldWriteStore;
  if (!root || !store) return;
  const scope = 'EQUIPMENT_MAINTENANCE', captured = store.session();
  const list = document.getElementById('fieldEquipmentList'), status = document.getElementById('fieldEquipmentStatus'), refresh = document.getElementById('fieldEquipmentRefresh');
  const queue = document.createElement('aside'); queue.id = 'cwEquipmentSyncStatus'; queue.className = 'card'; queue.hidden = true; root.before(queue);
  let selected = null, revision = 0, busy = false, syncing = false, closed = false, queueRevision = 0;
  const prefix = `cwEquipmentDraft:v1:${captured?.owner}:`, states = new Map();
  const explain = value => /Failed to fetch|NetworkError|Load failed|fetch.*failed|aborted|timed out/i.test(String(value)) ? 'Não foi possível confirmar a ligação. O pedido continua guardado.' : String(value);
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const validTime = value => value && Object.keys(value).length === 2 && instant(value.startAt) && (value.endAt === null || instant(value.endAt) && Date.parse(value.endAt) > Date.parse(value.startAt));
  const sameTime = (a, b) => !a && !b || !!a && !!b && a.startAt === b.startAt && a.endAt === b.endAt;
  const validMaterialDraft = value => value && ['NONE', 'DECLARED'].includes(value.mode) && Array.isArray(value.items) && value.items.length <= 20 && Object.keys(value).length === 2 && value.items.every(item => item && Object.keys(item).length === 3 && [['productName', 160], ['unit', 24], ['quantity', 30]].every(([key, max]) => typeof item[key] === 'string' && item[key].length <= max)) && (value.mode !== 'NONE' || !value.items.length);
  const hasDraft = draft => draft.notes.trim() || draft.workTime || draft.materials;
  function sameMaterials(a, b) { try { return !a && !b || !!a && !!b && JSON.stringify(store.equipmentMaterials(a)) === JSON.stringify(store.equipmentMaterials(b)); } catch (_) { return false; } }
  const acknowledgedDraft = (row, draft) => row.response.applied && row.payload.notes.trim() === draft.notes.trim() && sameTime(row.payload.workTime, draft.workTime) && sameMaterials(row.payload.materials, draft.materials);
  function materialsText(value) {
    if (!value) return 'Materiais próprios não registados.';
    if (value.mode === 'NONE') return 'Sem materiais, por declaração explícita.';
    return 'Materiais declarados: ' + (Array.isArray(value.items) ? value.items.map(item => `${item.productName || '(produto por indicar)'} · ${item.quantity || '?'} ${item.unit || '(unidade por indicar)'}`).join('; ') : 'registo por rever');
  }
  function materialsView(saved, parent) {
    const box = node('div', null, parent); box.className = 'field-equipment-material-view'; box.style.overflowWrap = 'anywhere';
    node('p', ({ MISSING: 'Materiais próprios não registados.', NONE: 'Sem materiais, por declaração explícita.', DECLARED: 'Materiais declarados; aguardam o fecho e os consumos da visita.', MATCHED: 'Quantidades compatíveis com o consumo líquido atual da visita.', REVIEW: 'Materiais por rever: a declaração, a origem ou o consumo da visita não permite confirmar a repartição.' })[saved?.state] || 'Materiais próprios não registados.', box);
    if (saved?.record?.mode === 'DECLARED') node('p', materialsText(saved.record), box);
    if (saved?.state === 'MATCHED') for (const line of saved.comparison?.lines || []) node('p', `${line.productName} · ${line.unit}: visita ${line.visitQuantity}; total declarado nas revisões ${line.declaredMaintenanceQuantity}; ainda sem parcela declarada ${line.unassignedQuantity}.`, box);
    if (saved?.record?.mode === 'DECLARED') node('small', 'Esta declaração não movimenta stock nem atribui custo em euros. Inclua estas quantidades no consumo total da visita uma única vez.', box);
  }
  function timeText(value) {
    const format = at => new Date(at).toLocaleString('pt-PT', { timeZoneName: 'short' });
    if (!value) return 'Tempo próprio não registado.';
    if (!value.endAt) return 'Início: ' + format(value.startAt) + '. Falta marcar o fim.';
    const seconds = Math.floor((Date.parse(value.endAt) - Date.parse(value.startAt)) / 1000);
    return `${format(value.startAt)} → ${format(value.endAt)} · ${Math.floor(seconds / 60)} min ${seconds % 60} s registados.`;
  }
  const key = visit => `${visit.visitType}:${visit.visitId}`;
  const sameVisit = (a, b) => a && b && key(a) === key(b) && a.poolId === b.poolId;
  const node = (tag, text, parent) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (parent) parent.append(n); return n; };
  function protect() {
    if (!captured || !store.same(captured)) { closed = true; ++revision; ++queueRevision; root.hidden = queue.hidden = true; list.replaceChildren(); queue.replaceChildren(); return false; }
    return !closed;
  }
  function valid(visit, rev) { return protect() && sameVisit(visit, selected) && rev === revision; }
  function assertSession() { if (!protect()) throw Error('A sessão mudou. Os dados da conta original foram preservados.'); }
  function label(visit) { return `${visit.visitType === 'EXTRA' ? 'Visita extra' : 'Visita'} ${visit.visitId}`; }
  function draftKey(visit, planId) { return prefix + key(visit) + ':' + planId; }
  function parseDraft(raw, storageKey) {
    let draft; try { draft = JSON.parse(raw); } catch (_) { throw Error('Rascunho de revisão ilegível. Preserve os dados e peça apoio ao escritório.'); }
    if (draft?.v !== 1 || draft.owner !== captured.owner || !['REGULAR','EXTRA'].includes(draft.visitType) || !positive(draft.visitId) || !positive(draft.poolId) || !positive(draft.planId) || !positive(draft.expectedVersion) || !positive(draft.revision) || typeof draft.notes !== 'string' || draft.notes.length > 3000 || typeof draft.title !== 'string' || draftKey(draft, draft.planId) !== storageKey) throw Error('O rascunho de revisão precisa de verificação. Os dados foram preservados.');
    if (Object.hasOwn(draft, 'workTime') && !validTime(draft.workTime)) throw Error('O tempo guardado precisa de verificação. Os dados foram preservados.');
    if (Object.hasOwn(draft, 'materials') && !validMaterialDraft(draft.materials)) throw Error('Os materiais guardados precisam de verificação. Os dados foram preservados.');
    return draft;
  }
  function draftState(visit, plan) {
    const storageKey = draftKey(visit, plan.id), raw = localStorage.getItem(storageKey), draft = raw ? parseDraft(raw, storageKey) : null;
    if (draft && draft.poolId !== visit.poolId) throw Error('A piscina deste rascunho mudou. Preserve as notas e peça apoio ao escritório.');
    const state = { storageKey, raw, draft, saving: Promise.resolve(), failed: false, visit, plan };
    states.set(storageKey, state); return state;
  }
  function saveDraft(state, notes, workTime, materials) {
    const value = { v: 1, owner: captured.owner, ...state.visit, planId: state.plan.id, expectedVersion: state.plan.version, title: state.plan.title, notes, ...(workTime ? { workTime } : {}), ...(materials ? { materials: structuredClone(materials) } : {}) };
    state.saving = state.saving.then(async () => {
      assertSession(); if (!navigator.locks?.request) throw Error('Este navegador não permite proteger as notas entre janelas.');
      await navigator.locks.request(state.storageKey, async () => {
        assertSession(); if (localStorage.getItem(state.storageKey) !== state.raw) throw Error('Outra janela alterou estas notas. Atualize para recuperar o rascunho guardado.');
        const next = JSON.stringify({ ...value, revision: (state.draft?.revision || 0) + 1 });
        localStorage.setItem(state.storageKey, next); if (localStorage.getItem(state.storageKey) !== next) throw Error('As notas não ficaram guardadas.');
        state.raw = next; state.draft = JSON.parse(next);
      });
    });
    state.saving.catch(() => { state.failed = true; }); return state.saving;
  }
  function matching(row, draft) { return row.resourceId === draft.planId && sameVisit(row.payload, draft); }
  async function cleanConfirmed(row) {
    if (row.response?.applied !== true) return;
    const storageKey = draftKey(row.payload, row.resourceId);
    if (!navigator.locks?.request) return;
    await navigator.locks.request(storageKey, async () => {
      assertSession(); const raw = localStorage.getItem(storageKey); if (!raw) return;
      const draft = parseDraft(raw, storageKey);
      if (matching(row, draft) && acknowledgedDraft(row, draft)) { localStorage.removeItem(storageKey); states.delete(storageKey); }
    });
  }
  async function discardDraft(storageKey, raw) {
    assertSession(); const draft = parseDraft(raw, storageKey);
    if ((await store.records(scope, captured)).some(row => matching(row, draft))) throw Error('Confirme primeiro o pedido guardado. As notas foram preservadas.');
    if (!navigator.locks?.request) throw Error('Este navegador não permite proteger as notas entre janelas.');
    await navigator.locks.request(storageKey, async () => {
      assertSession(); if (localStorage.getItem(storageKey) !== raw) throw Error('Outra janela alterou estas notas. Atualize antes de descartar.');
      localStorage.removeItem(storageKey); states.delete(storageKey);
    });
    if (sameVisit(draft, selected)) await load();
    await renderQueue();
  }
  async function pendingSummary() {
    assertSession(); const rows = await store.records(scope, captured, true), result = [];
    for (const row of rows) {
      if (!row.response) result.push({ kind: 'pending', text: `${label(row.payload)} — ${row.label}: revisão por confirmar no servidor${row.failure?.blocked ? '; precisa de apoio do escritório' : ''}.` });
      else if (row.response.applied === false && !row.reviewedAt) result.push({ kind: 'pending', text: `${label(row.payload)} — revisão não aplicada: ${row.response.message}` });
    }
    for (const storageKey of Object.keys(localStorage).filter(name => name.startsWith(prefix))) {
      const draft = parseDraft(localStorage.getItem(storageKey), storageKey);
      if (hasDraft(draft) && !rows.some(row => matching(row, draft) && (!row.response || acknowledgedDraft(row, draft)))) result.push({ kind: 'pending', text: `${label(draft)} — ${draft.title}: rascunho de revisão guardado, ainda não enviado.` });
    }
    assertSession(); return result;
  }
  async function renderQueue() {
    const rev = ++queueRevision; if (!protect()) return;
    try {
      const all = await store.records(scope, captured, true);
      const rows = all.filter(row => !row.response || (row.response.applied === false && !row.reviewedAt));
      const drafts = Object.keys(localStorage).filter(name => name.startsWith(prefix)).map(storageKey => { const raw = localStorage.getItem(storageKey); return { storageKey, raw, draft: parseDraft(raw, storageKey) }; }).filter(({draft}) => hasDraft(draft) && !all.some(row => matching(row, draft) && (!row.response || acknowledgedDraft(row, draft))));
      if (!protect() || rev !== queueRevision) return;
      queue.replaceChildren(); queue.hidden = !rows.length && !drafts.length; if (queue.hidden) return;
      node('h2', 'Revisões de equipamento por resolver', queue);
      for (const row of rows) {
        const article = node('div', null, queue); node('p', `${label(row.payload)} · ${row.label}`, article);
        node('p', row.response ? 'Revisão não aplicada. ' + row.response.message : explain(row.failure?.message || 'Pedido guardado; aguarda confirmação do servidor.'), article);
        const action = node('button', row.response ? 'Tomei conhecimento da recusa' : 'Repetir a mesma confirmação', article); action.type = 'button'; action.style.minHeight = '44px'; action.disabled = syncing || busy;
        action.onclick = async () => {
          action.disabled = true;
          try { if (row.response) await store.acknowledgeRejection(row.requestId, captured); else { await send(row); if (sameVisit(row.payload, selected)) await load(true); } }
          catch (error) { if (protect()) node('p', explain(error.message), article); }
          finally { if (protect()) { action.disabled = false; await renderQueue(); } }
        };
      }
      for (const {storageKey, raw, draft} of drafts) {
        const details = node('details', null, queue); node('summary', `${label(draft)} · ${draft.title}: rascunho guardado, ainda não enviado`, details); node('p', draft.notes, details);
        if (draft.workTime) node('p', timeText(draft.workTime), details);
        if (draft.materials) node('p', materialsText(draft.materials), details);
        const discard = node('button', draft.materials ? 'Descartar rascunho com materiais' : draft.workTime ? 'Descartar notas e tempo guardados' : 'Descartar notas guardadas', details); discard.type = 'button'; discard.style.minHeight = '44px';
        discard.onclick = async () => { discard.disabled = true; try { await discardDraft(storageKey, raw); } catch (error) { if (protect()) { node('p', error.message, details); discard.disabled = false; } } };
      }
    } catch (error) { if (protect() && rev === queueRevision) { queue.hidden = false; queue.replaceChildren(); node('p', error.message, queue); } }
  }
  function validateView(data, visit) {
    if (data?.ok !== true || data.visitId !== visit.visitId || data.visitType !== visit.visitType || data.poolId !== visit.poolId || typeof data.canComplete !== 'boolean' || !Array.isArray(data.plans)) throw Error('A consulta não corresponde a esta visita e piscina.');
    const ids = new Set();
    for (const p of data.plans) {
      if (!positive(p.id) || ids.has(p.id) || p.poolId !== visit.poolId || !positive(p.version) || !['FILTER','CHLORINATOR','PUMP','OTHER'].includes(p.component) || typeof p.title !== 'string' || typeof p.instructions !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.nextDue) || typeof p.active !== 'boolean' || typeof p.completedInVisit !== 'boolean' || typeof p.canComplete !== 'boolean') throw Error('A lista de revisões está incompleta. Atualize antes de registar.');
      ids.add(p.id);
    }
    return data;
  }
  const cacheKey = visit => `cwEquipmentCache:v1:${captured.owner}:${key(visit)}`;
  function cached(visit) {
    const raw = localStorage.getItem(cacheKey(visit)); if (!raw) return null;
    const saved = JSON.parse(raw); if (saved.owner !== captured.owner || !Number.isFinite(Date.parse(saved.at))) throw Error('Consulta guardada inválida.');
    validateView(saved.data, visit); return saved;
  }
  function render(data, visit, rev, rows, offline) {
    list.replaceChildren();
    const plans = data.plans.filter(p => p.active || p.completedInVisit).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
    if (!plans.length) { node('p', 'Sem revisões preventivas ativas para esta visita.', list); return; }
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    for (const plan of plans) {
      const card = node('article', null, list); card.className = 'field-equipment-plan';
      node('h3', plan.title, card); node('p', ({ FILTER: 'Filtro', CHLORINATOR: 'Clorador', PUMP: 'Bomba', OTHER: 'Outro' })[plan.component], card);
      node('strong', `${plan.nextDue < today ? 'Em atraso' : plan.nextDue === today ? 'Previsto para hoje' : 'Próxima revisão'} · ${plan.nextDue}`, card);
      node('p', plan.instructions, card); node('p', `Última execução: ${plan.lastCompletedAt ? new Date(plan.lastCompletedAt).toLocaleString('pt-PT') : 'Sem execução registada'}`, card);
      const related = rows.filter(row => row.resourceId === plan.id && sameVisit(row.payload, visit)), pending = related.find(row => !row.response);
      if (pending) { node('p', 'Resultado incerto. O pedido original foi preservado. Use a confirmação guardada acima, mesmo que o plano já tenha mudado.', card); continue; }
      if (related.some(row => row.response.applied === false && !row.reviewedAt)) node('p', 'Existe uma recusa por rever no aviso acima. As notas foram preservadas.', card);
      let state; try { state = draftState(visit, plan); } catch (error) { node('p', error.message, card); continue; }
      if (plan.completedInVisit) {
        node('p', 'Revisão já registada nesta visita.', card);
        const saved = plan.completion?.workTime;
        node('p', saved?.state === 'REVIEW' ? 'Tempo por rever: o intervalo ou a visita de origem mudou.' : timeText(saved?.record), card);
        if (saved?.state === 'REVIEW' && validTime({ startAt: saved.record?.startAt, endAt: saved.record?.endAt })) node('p', 'Registo original: ' + timeText(saved.record), card);
        materialsView(plan.completion?.materials, card);
      }
      if (offline || !data.canComplete || !plan.canComplete || plan.completedInVisit) {
        if (!plan.completedInVisit) node('p', offline ? 'Consulta guardada; confirme a ligação para registar trabalho.' : 'Esta visita não permite registar revisões neste momento.', card);
        if (state.draft?.notes) node('p', 'Notas guardadas: ' + state.draft.notes, card);
        if (state.draft?.workTime) node('p', 'Tempo guardado: ' + timeText(state.draft.workTime), card);
        if (state.draft?.materials) node('p', 'Rascunho: ' + materialsText(state.draft.materials), card);
        continue;
      }
      if (state.draft && state.draft.expectedVersion !== plan.version) node('p', 'O plano foi atualizado. Reveja as instruções atuais antes de confirmar as notas guardadas.', card);
      const notesLabel = node('label', 'Trabalho realizado / observações', card), notes = node('textarea', null, notesLabel); notes.rows = 2; notes.maxLength = 3000; notes.value = state.draft?.notes || '';
      let workTime = state.draft?.workTime || null;
      let materials = state.draft?.materials || null;
      const timeBox = node('fieldset', null, card); timeBox.className = 'field-equipment-time';
      node('legend', 'Tempo desta revisão (opcional)', timeBox);
      node('p', 'Marque o início e o fim enquanto realiza o trabalho. Confirme as horas do dispositivo antes de enviar.', timeBox);
      const timeStatus = node('p', null, timeBox); timeStatus.setAttribute('role', 'status');
      const start = node('button', 'Marcar início', timeBox), end = node('button', 'Marcar fim', timeBox), clear = node('button', 'Limpar tempo registado', timeBox);
      for (const button of [start, end, clear]) button.type = 'button';
      const materialBox = node('fieldset', null, card); materialBox.className = 'field-equipment-materials'; materialBox.style.minWidth = '0';
      node('legend', 'Materiais desta revisão (opcional)', materialBox);
      node('p', 'Declare apenas a parte usada nesta revisão. Use o nome e a unidade do consumo da visita, sem conversões. Estas quantidades já fazem parte do total da visita: não as some novamente. A declaração não retira stock nem atribui euros.', materialBox);
      const modeLabel = node('label', 'Registo de materiais', materialBox), materialMode = node('select', null, modeLabel);
      materialMode.style.cssText = 'display:block;width:100%;min-width:0';
      for (const [value, text] of [['', 'Não registar materiais agora'], ['NONE', 'Confirmar sem materiais'], ['DECLARED', 'Indicar materiais usados']]) { const option = node('option', text, materialMode); option.value = value; }
      materialMode.value = materials?.mode || '';
      const materialRows = node('div', null, materialBox), addMaterial = node('button', 'Adicionar material', materialBox), materialStatus = node('p', null, materialBox); addMaterial.type = 'button'; materialStatus.setAttribute('role', 'status');
      const checkLabel = node('label', null, card); checkLabel.className = 'field-equipment-check';
      const check = node('input', null, checkLabel); check.type = 'checkbox'; node('span', 'Confirmo que executei esta revisão do equipamento.', checkLabel);
      const action = node('button', 'Registar revisão realizada', card); action.type = 'button'; action.disabled = true;
      const ready = () => {
        let materialValid = true; try { if (materials) store.equipmentMaterials(materials); materialStatus.textContent = ''; } catch (error) { materialValid = false; materialStatus.textContent = error.message; }
        action.disabled = !check.checked || notes.value.trim().length < 3 || busy || state.failed || !!workTime && !workTime.endAt || !materialValid;
        start.disabled = busy || state.failed || !!workTime; end.disabled = busy || state.failed || !workTime || !!workTime.endAt; clear.disabled = busy || state.failed || !workTime;
        materialMode.disabled = busy || state.failed; addMaterial.disabled = busy || state.failed || (materials?.items.length || 0) >= 20; addMaterial.hidden = materials?.mode !== 'DECLARED';
        materialRows.querySelectorAll('input,button').forEach(input => { input.disabled = busy || state.failed; });
        timeStatus.textContent = timeText(workTime);
      };
      const saveMaterials = () => {
        check.checked = false; ready();
        saveDraft(state, notes.value, workTime, materials).then(() => { if (valid(visit, rev)) { status.textContent = 'Materiais guardados neste dispositivo; revisão ainda não enviada.'; renderQueue(); } }).catch(error => { if (valid(visit, rev)) { status.textContent = error.message; ready(); } });
      };
      function renderMaterials() {
        materialRows.replaceChildren();
        for (const [index, item] of (materials?.mode === 'DECLARED' ? materials.items : []).entries()) {
          const line = node('div', null, materialRows); line.className = 'field-equipment-material-line'; line.style.cssText = 'display:grid;gap:8px;min-width:0;margin:12px 0';
          for (const [field, text, limit] of [['productName', 'Produto', 160], ['quantity', 'Quantidade', 30], ['unit', 'Unidade', 24]]) {
            const label = node('label', `${text} ${index + 1}`, line), input = node('input', null, label); input.type = 'text'; input.maxLength = limit; input.value = item[field]; input.dataset.materialField = field; input.style.cssText = 'display:block;width:100%;min-width:0;box-sizing:border-box'; if (field === 'quantity') input.inputMode = 'decimal';
            input.oninput = () => { if (busy || !valid(visit, rev)) return; materials = { ...materials, items: materials.items.map((row, i) => i === index ? { ...row, [field]: field === 'quantity' ? input.value.replace(',', '.') : input.value } : row) }; saveMaterials(); };
          }
          const remove = node('button', 'Remover material ' + (index + 1), line); remove.type = 'button'; remove.onclick = () => { if (busy || !valid(visit, rev)) return; materials = { ...materials, items: materials.items.filter((_, i) => i !== index) }; renderMaterials(); saveMaterials(); };
        }
        ready();
      }
      materialMode.onchange = () => {
        if (busy || !valid(visit, rev)) return;
        if (materials?.items.some(item => Object.values(item).some(value => value.trim())) && materialMode.value !== 'DECLARED') { materialMode.value = materials.mode; status.textContent = 'Remova primeiro as linhas de materiais para mudar este registo. As quantidades foram preservadas.'; return; }
        materials = materialMode.value ? { mode: materialMode.value, items: materialMode.value === 'DECLARED' ? [{ productName: '', unit: '', quantity: '' }] : [] } : null;
        renderMaterials(); saveMaterials();
      };
      addMaterial.onclick = () => { if (busy || !valid(visit, rev) || materials?.mode !== 'DECLARED' || materials.items.length >= 20) return; materials = { ...materials, items: [...materials.items, { productName: '', unit: '', quantity: '' }] }; renderMaterials(); saveMaterials(); };
      renderMaterials();
      const saveTime = async next => {
        if (busy || !valid(visit, rev)) return;
        workTime = next; check.checked = false; ready();
        try { await saveDraft(state, notes.value, workTime, materials); if (valid(visit, rev)) { status.textContent = 'Tempo guardado neste dispositivo; revisão ainda não enviada.'; await renderQueue(); } }
        catch (error) { if (valid(visit, rev)) { status.textContent = error.message; ready(); } }
      };
      start.onclick = () => saveTime({ startAt: new Date().toISOString(), endAt: null });
      end.onclick = () => { const endAt = new Date().toISOString(); if (Date.parse(endAt) <= Date.parse(workTime.startAt)) { status.textContent = 'O relógio do dispositivo mudou. Reveja o início antes de marcar o fim.'; return; } return saveTime({ ...workTime, endAt }); };
      clear.onclick = () => saveTime(null);
      ready();
      notes.oninput = () => {
        ready(); saveDraft(state, notes.value, workTime, materials).then(() => { if (valid(visit, rev)) status.textContent = 'Notas guardadas neste dispositivo; revisão ainda não enviada.'; }).catch(error => { if (valid(visit, rev)) { status.textContent = error.message; ready(); } });
      };
      check.onchange = ready;
      action.onclick = async () => {
        if (busy || !check.checked || !valid(visit, rev)) return;
        const confirmedNotes = notes.value.trim(); let prepared = false;
        busy = true; ready(); refresh.disabled = true; notes.disabled = check.disabled = true;
        try {
          await saveDraft(state, confirmedNotes, workTime, materials); if (!valid(visit, rev)) return;
          const row = await store.prepare(scope, plan.id, { visitType: visit.visitType, visitId: visit.visitId, poolId: visit.poolId, expectedVersion: plan.version, notes: confirmedNotes, confirmed: true, ...(workTime ? { workTime } : {}), ...(materials ? { materials: store.equipmentMaterials(materials) } : {}) }, { label: plan.title }, captured);
          prepared = true;
          await send(row);
        } catch (error) { if (valid(visit, rev)) status.textContent = 'Resultado incerto. ' + explain(error.message); }
        finally { busy = false; if (valid(visit, rev)) { ready(); refresh.disabled = false; notes.disabled = check.disabled = false; } await renderQueue(); if (prepared && protect() && sameVisit(visit, selected)) await load(true); }
      };
    }
  }
  async function send(row, automatic = false) {
    const result = await store.send(row.requestId, captured, { automatic });
    const saved = await store.get(row.requestId, captured); await cleanConfirmed(saved);
    if (protect() && sameVisit(row.payload, selected)) status.textContent = result.applied ? 'Revisão registada no servidor.' : 'Revisão não aplicada. ' + result.message;
    return result;
  }
  async function load(preserve = false) {
    const visit = selected, rev = ++revision; if (!protect()) return;
    refresh.disabled = true; list.replaceChildren();
    if (!visit) { status.textContent = 'Escolha uma visita.'; refresh.disabled = false; return; }
    if (!preserve) status.textContent = `A consultar equipamentos da ${label(visit).toLowerCase()}…`;
    try {
      const response = await fetch(`/api/equipment-maintenance/visits/${visit.visitId}?visitType=${visit.visitType}`, { cache: 'no-store', headers: { Authorization: 'Bearer ' + captured.token }, signal: AbortSignal.timeout(12000) });
      const data = await response.json(); if (!valid(visit, rev)) return;
      if (response.status !== 200) throw Object.assign(Error(data.error || 'Consulta indisponível.'), { status: response.status });
      validateView(data, visit);
      const rows = await store.records(scope, captured, true); if (!valid(visit, rev)) return;
      for (const row of rows) await cleanConfirmed(row); if (!valid(visit, rev)) return;
      let cacheWarning = '';
      try { localStorage.setItem(cacheKey(visit), JSON.stringify({ owner: captured.owner, at: new Date().toISOString(), data })); } catch (_) { cacheWarning = ' Não foi possível guardar a consulta para uso sem rede.'; }
      render(data, visit, rev, rows, !navigator.onLine);
      if (!preserve) status.textContent = `Equipamentos da ${label(visit).toLowerCase()} atualizados.${cacheWarning}`;
    } catch (error) {
      if (!valid(visit, rev)) return;
      let saved; if (![401,403,404].includes(error.status)) try { saved = cached(visit); } catch (_) { /* A malformed cache never replaces an authoritative response. */ }
      if (saved) {
        status.textContent = `Consulta guardada da ${label(visit).toLowerCase()}, de ${new Date(saved.at).toLocaleString('pt-PT')}. Não foi possível atualizar. ${error.message}`;
        try { const rows = await store.records(scope, captured, true); if (valid(visit, rev)) render(saved.data, visit, rev, rows, true); } catch (failure) { if (valid(visit, rev)) status.textContent = failure.message; }
      } else status.textContent = `Não foi possível consultar os equipamentos da ${label(visit).toLowerCase()}. ${error.message}`;
    } finally { if (valid(visit, rev)) refresh.disabled = false; }
  }
  async function flush() {
    if (syncing || busy || !protect() || !navigator.onLine) return;
    syncing = true; let changed = false;
    try {
      for (const row of await store.records(scope, captured)) {
        if (row.failure?.blocked || row.failure?.retryAt > Date.now()) continue;
        try { await send(row, true); changed ||= sameVisit(row.payload, selected); } catch (_) { break; }
      }
    } finally { syncing = false; await renderQueue(); if (changed && protect() && !busy) await load(true); }
  }
  window.CWFieldEquipment = { pendingSummary, flush, render: renderQueue };
  window.addEventListener('cw:field-visit-selected', event => {
    const detail = event.detail || {}, next = positive(detail.visitId) && ['REGULAR','EXTRA'].includes(detail.visitType) ? { visitId: detail.visitId, visitType: detail.visitType, poolId: detail.poolId || null, state: detail.state || '' } : null;
    if (sameVisit(next, selected) && next.state === selected.state) return;
    selected = next; ++revision; list.replaceChildren(); load();
  });
  refresh.onclick = () => { if (!busy) load(); };
  window.addEventListener('storage', () => { if (protect()) renderQueue(); });
  window.addEventListener('focus', protect);
  window.addEventListener('cw:field-write-change', renderQueue);
  window.addEventListener('online', flush);
  let timer;
  function resume() { clearInterval(timer); timer = setInterval(() => { if (protect()) flush().catch(() => {}); }, 15000); renderQueue(); flush().catch(() => {}); }
  window.addEventListener('pageshow', resume); window.addEventListener('pagehide', () => clearInterval(timer));
  setInterval(protect, 500); resume();
})();
