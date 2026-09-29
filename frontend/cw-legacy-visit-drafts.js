(function () {
  'use strict';
  const store = window.CWFieldWriteStore, captured = store.session(), entries = new Map();
  const copy = window.CWLegacyTechnicianCopy;
  let requestRevision = 0;
  const fields = ['notes','ph','chlorine','alkalinity','salt','products'];
  const labels = { notes: 'draftNotes', ph: copy.spec('literal', { text: 'pH' }), chlorine: 'chlorine', alkalinity: 'alkalinity', salt: 'salt', products: 'draftProductsLabel' };
  const values = value => Object.fromEntries(fields.map(field => [field, value?.[field] == null ? '' : String(value[field])]));
  const key = id => 'cwLegacyVisitDraft:v1:' + captured.owner + ':' + id;
  const active = () => store.same(captured);
  function requireActive() { if (!active()) throw copy.error('draftSessionReopen'); }
  function rememberError(entry, error, prefix) {
    const detail = error.copy || copy.spec('literal', { text: error.message });
    entry.errorCopy = prefix ? copy.spec(prefix, { error: detail }) : detail;
    entry.error = prefix ? copy.t(entry.errorCopy) : error.message;
    if (!entry.error) entry.errorCopy = null;
  }
  function clearError(entry) { entry.error = ''; entry.errorCopy = null; }
  function rejection(entry) { return entry.errorCopy ? copy.error(entry.errorCopy.key, entry.errorCopy.params) : Error(entry.error || entry.status.textContent); }
  function read(id) {
    requireActive(); const raw = localStorage.getItem(key(id)); if (!raw) return { raw, value: null };
    let value; try { value = JSON.parse(raw); } catch (_) { throw copy.error('draftUnreadable'); }
    const validFields = object => object && Object.keys(object).length === fields.length && fields.every(field => typeof object[field] === 'string' && object[field].length <= 20000);
    if (!value || value.v !== 1 || value.owner !== captured.owner || value.visitId !== id || !validFields(value.fields) || !validFields(value.baseline) || !Number.isFinite(Date.parse(value.savedAt)) || Object.keys(value).some(field => !['v','owner','visitId','fields','baseline','savedAt'].includes(field))) throw copy.error('draftInvalid');
    return { raw, value };
  }
  function paint(entry, fill = false) {
    if (!entry.element?.isConnected) return;
    const blocked = !active() || entry.checking || entry.conflict || !!entry.request || entry.completed;
    for (const field of fields) { const input = entry.element.querySelector('#' + field + '-' + entry.id); input.readOnly = blocked; if (fill) input.value = entry.fields[field]; }
    window.CWLegacyVisitProducts.paint(entry.id, blocked);
    const complete = entry.element.querySelector('[data-action="complete"]');
    if (complete) complete.disabled = entry.routeBlocked || blocked || entry.pending > 0 || !!entry.error || entry.conflicts.size > 0;
    copy.set(entry.status, !active() ? 'draftSessionPreserved' : entry.error ? entry.errorCopy : entry.conflict ? 'draftConflictReview' : entry.request ? (entry.request.response ? 'draftConfirmed' : 'draftCompletionPending') : entry.completed ? 'draftCompleted' : entry.conflicts.size ? 'draftDifferences' : entry.checking ? 'draftChecking' : entry.pending ? 'draftSaving' : entry.observed ? 'draftSaved' : 'draftInitial');
    entry.retry.hidden = !entry.error || blocked || entry.conflicts.size > 0;
    entry.review.replaceChildren();
    for (const [field, server] of entry.conflicts) {
      const row = document.createElement('div'); row.dataset.draftField = field; row.style.cssText = 'margin:12px 0;padding:10px;border:1px solid #a1b5c8;border-radius:8px;overflow-wrap:anywhere';
      const label = document.createElement('strong'); copy.set(label, labels[field]); row.append(label);
      for (const [name, value] of [['draftCurrent',server],['draftLocal',entry.fields[field]]]) { const item = document.createElement('p'); copy.set(item, name, { value: field === 'products' ? copy.spec('draftProductDescription', { raw: value }) : value || copy.spec('draftEmpty') }); row.append(item); }
      for (const [name, useServer] of [['draftUseCurrent',true],['draftKeep',false]]) { const button = document.createElement('button'); button.type = 'button'; copy.set(button, name); button.disabled = blocked; button.style.cssText = 'min-height:44px;margin:4px 0;white-space:normal'; button.addEventListener('click', () => { if (!active()) return; if (useServer) entry.fields[field] = server; entry.baseline[field] = server; entry.conflicts.delete(field); paint(entry,true); schedule(entry); }); row.append(button); }
      entry.review.append(row);
    }
  }
  async function requests() { return store.records('VISIT_COMPLETION', captured, true); }
  async function refreshRequests() {
    const revision = ++requestRevision;
    if (!active()) { for (const entry of entries.values()) paint(entry); return; }
    try { const rows = await requests(); if (!active() || revision !== requestRevision) return; for (const entry of entries.values()) { entry.request = rows.find(row => row.resourceId === entry.id) || null; entry.checking = false; paint(entry); } }
    catch (error) { if (active() && revision === requestRevision) for (const entry of entries.values()) { entry.checking = false; rememberError(entry, error); paint(entry); } }
  }
  function schedule(entry) {
    if (!active() || entry.conflict || entry.request || entry.completed) return;
    const draft = { v:1,owner:captured.owner,visitId:entry.id,fields:{...entry.fields},baseline:{...entry.baseline},savedAt:new Date().toISOString() };
    const generation = ++entry.revision; ++entry.pending; clearError(entry); paint(entry);
    entry.chain = entry.chain.catch(() => {}).then(async () => {
      requireActive(); if (!navigator.locks?.request) throw copy.error('draftNoLocks');
      await navigator.locks.request(key(entry.id), async () => {
        requireActive(); if (entry.conflict) throw copy.error('draftConflictFields');
        const row = (await requests()).find(row => row.resourceId === entry.id);
        if (row) { entry.request = row; throw copy.error('draftExistingCompletion'); }
        const current = read(entry.id);
        if (current.raw !== entry.observed) { entry.conflict = true; throw copy.error('draftConflictText'); }
        if (fields.some(field => draft.fields[field].length > 20000)) throw copy.error('draftTooLong');
        requireActive(); const raw = JSON.stringify(draft); localStorage.setItem(key(entry.id),raw);
        if (localStorage.getItem(key(entry.id)) !== raw) throw copy.error('draftUnconfirmed');
        entry.observed = raw;
        if (generation === entry.revision) clearError(entry);
      });
    }).catch(error => { if (active()) rememberError(entry, error, 'draftNotSaved'); }).finally(() => { --entry.pending; if (generation === entry.revision || !entry.pending) paint(entry); });
  }
  function bind(element, visit) {
    if (!active()) return;
    let entry = entries.get(visit.id); const server = values(visit);
    if (!entry) {
      entry = { id:visit.id,fields:{...server},baseline:{...server},observed:null,revision:0,pending:0,chain:Promise.resolve(),conflicts:new Map(),checking:true,conflict:false,error:'',request:null };
      try { const saved = read(visit.id); entry.observed = saved.raw; if (saved.value) { entry.fields = saved.value.fields; entry.baseline = saved.value.baseline; } }
      catch (error) { entry.conflict = true; rememberError(entry, error); }
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
    entry.retry = document.createElement('button'); entry.retry.type = 'button'; copy.set(entry.retry, 'draftRetry'); entry.retry.id = 'legacyDraftRetry-' + visit.id; entry.retry.addEventListener('click',()=>schedule(entry));
    panel.append(entry.status,entry.review,entry.retry); element.querySelector('.visit-actions').before(panel);
    for (const field of fields) element.querySelector('#' + field + '-' + visit.id).addEventListener('input',event=>{if(!active()||entry.conflict||entry.request||entry.completed)return;entry.fields[field]=event.target.value;schedule(entry);});
    window.CWLegacyVisitProducts.bind(element, visit);
    paint(entry,true); refreshRequests();
  }
  async function beforeComplete(id) {
    requireActive(); const entry = entries.get(id); if (!entry) throw copy.error('draftReopen');
    await entry.chain; requireActive(); await refreshRequests();
    if (entry.conflict || entry.error || entry.conflicts.size || entry.request || entry.completed) throw rejection(entry);
    schedule(entry); await entry.chain; requireActive(); if (entry.error || entry.conflict || entry.request) throw rejection(entry);
    return { ...entry.fields, ...window.CWLegacyVisitProducts.completion(entry.fields.products) };
  }
  window.addEventListener('storage',event=>{for(const entry of entries.values()){if(active()&&event.key===key(entry.id)&&event.newValue!==entry.observed){entry.conflict=true;paint(entry);}else if(!active())paint(entry);}});
  window.addEventListener('cw:field-write-change',refreshRequests);
  window.addEventListener('beforeunload',event=>{if(active()&&Array.from(entries.values()).some(entry=>entry.pending>0||entry.error||entry.conflict)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pageshow',refreshRequests);
  setInterval(()=>{if(!active())for(const entry of entries.values())paint(entry);},1000);
  window.CWLegacyVisitDrafts = { bind, beforeComplete, refresh:refreshRequests };
})();
