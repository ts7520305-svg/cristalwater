(function () {
  'use strict';
  const store = window.CWFieldWriteStore, captured = store.session();
  const input = document.getElementById('internalAlert'), button = document.getElementById('sendAlertBtn');
  if (!input || !button) return;
  const copy = window.CWLegacyTechnicianCopy;
  const failure = error => error.copy || copy.spec('literal', { text: error.message });
  input.closest('.card').style.marginBottom = 'calc(96px + env(safe-area-inset-bottom, 0px))';
  const key = captured ? 'cwFieldInternalAlertDraft:' + captured.owner : null;
  const blank = () => ({ v: 1, message: '', visitId: null, priority: 'NORMAL', requestId: null });
  let observed, state = null, busy = false, revision = 0, closed = false, conflict = false, visits = [];
  const controls = document.createElement('div');
  controls.innerHTML = '<p ' + copy.mark('alertIntro') + '></p><label>' + copy.span('alertVisit') + '<select id="internalAlertVisit"><option value="" ' + copy.mark('alertNoVisit') + '></option></select></label><label>' + copy.span('alertPriority') + '<select id="internalAlertPriority"><option value="NORMAL" ' + copy.mark('alertNormal') + '></option><option value="HIGH" ' + copy.mark('alertUrgent') + '></option></select></label>';
  for (const label of controls.querySelectorAll('label')) label.style.cssText = 'display:block;margin:12px 0;font-weight:700';
  for (const select of controls.querySelectorAll('select')) select.style.cssText = 'display:block;max-width:100%;width:100%;min-height:44px;padding:8px;color:inherit;background:inherit';
  input.before(controls); input.maxLength = 5000;
  copy.apply(controls); copy.set(button, 'alertSend');
  const visitSelect = controls.querySelector('#internalAlertVisit'), priority = controls.querySelector('#internalAlertPriority');
  const status = document.createElement('p'); status.id = 'internalAlertStatus'; status.setAttribute('role','status'); status.setAttribute('data-cw-state-managed','manual'); button.before(status);
  function active() { return !closed && store.same(captured); }
  function requireActive() { if (!active()) throw copy.error('alertSessionPreserved'); }
  function lock(value) { input.readOnly = value; visitSelect.disabled = value; priority.disabled = value; button.disabled = busy || conflict || !active(); }
  function read() {
    requireActive();
    const raw = localStorage.getItem(key); let value;
    try { value = raw ? JSON.parse(raw) : blank(); } catch (_) { throw copy.error('alertUnreadable'); }
    if (!value || value.v !== 1 || Object.keys(value).some(field => !['v','message','visitId','priority','requestId'].includes(field)) || typeof value.message !== 'string' || value.message.length > 5000 || (value.visitId !== null && (!Number.isSafeInteger(value.visitId) || value.visitId <= 0)) || !['NORMAL','HIGH'].includes(value.priority) || (value.requestId !== null && (typeof value.requestId !== 'string' || !/^[0-9a-f-]{36}$/.test(value.requestId)))) throw copy.error('alertUnreadable');
    if (observed === undefined) observed = raw;
    return value;
  }
  function write(value) {
    requireActive(); read();
    if (localStorage.getItem(key) !== observed) { conflict = true; throw copy.error('alertConflict'); }
    const raw = JSON.stringify(value); localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw copy.error('alertDraftUnconfirmed');
    observed = raw;
  }
  function payload(value) { return { message: value.message, visitId: value.visitId, priority: value.priority }; }
  function samePayload(a, b) { return a.message === b.message && a.visitId === b.visitId && a.priority === b.priority; }
  function option(value, key, params) { const node = new Option('', value); copy.set(node, key, params); return node; }
  function choices(selected) {
    visitSelect.replaceChildren(option('', 'alertNoVisit'));
    for (const visit of visits) visitSelect.add(option(String(visit.id), 'alertVisitOption', { id: visit.id, pool: visit.pool?.name || visit.poolName || copy.spec('alertPool') }));
    if (selected && !Array.from(visitSelect.options).some(option => option.value === String(selected))) visitSelect.add(option(String(selected), 'alertVisitUnknown', { id: selected }));
    visitSelect.value = selected ? String(selected) : '';
  }
  function show(value) { input.value = value.message; choices(value.visitId); priority.value = value.priority; }
  async function refresh() {
    if (busy) return;
    const generation = ++revision;
    if (!active()) { input.value = ''; visitSelect.replaceChildren(); priority.value = 'NORMAL'; lock(true); copy.set(status, 'alertSession'); return; }
    try {
      const draft = read(), rows = await store.records('TECHNICIAN_ALERT', captured, true);
      if (!active() || generation !== revision || busy) return;
      if (conflict) { lock(true); return; }
      state = rows.find(row => !row.response) || (draft.requestId ? rows.find(row => row.requestId === draft.requestId) : null);
      if (draft.requestId && !state) throw copy.error('alertMissingRequest');
      if (state && draft.message && !samePayload(draft, state.payload)) throw copy.error('alertMismatch');
      show(state ? state.payload : draft); lock(!!state);
      copy.set(button, state?.response ? 'alertClear' : state ? 'alertConfirm' : 'alertSend');
      const confirmed = state?.response || rows.filter(row => row.response).at(-1)?.response;
      copy.set(status, state && !state.response ? copy.spec('alertPending', { error: state.failure?.message || copy.spec('alertConfirmHint') }) : confirmed ? copy.spec('alertConfirmed', { id: confirmed.alert.id }) : copy.spec('alertLocalText'));
    } catch (error) { if (active() && generation === revision) { conflict = true; lock(true); copy.set(status, failure(error)); } }
  }
  function saveDraft() {
    if (busy || state || conflict) return;
    ++revision;
    try { write({ ...blank(), message: input.value, visitId: visitSelect.value ? Number(visitSelect.value) : null, priority: priority.value }); copy.set(status, 'alertDraftSaved'); }
    catch (error) { copy.set(status, 'alertDraftNotSaved', { error: failure(error) }); lock(conflict); }
  }
  function clearConfirmed() { write(blank()); state = null; show(blank()); }
  async function send() {
    if (busy || conflict) return;
    busy = true; lock(true);
    let message = '', description;
    try {
      requireActive();
      if (state?.response) { clearConfirmed(); return; }
      const value = state ? { ...blank(), ...state.payload, requestId: state.requestId } : { ...blank(), message: input.value, visitId: visitSelect.value ? Number(visitSelect.value) : null, priority: priority.value };
      if (!value.message.trim()) throw copy.error('alertEmpty');
      write(value);
      state = await store.prepare('TECHNICIAN_ALERT', captured.technicianId, payload(value), { label: 'Alerta para a administração' }, captured);
      write({ ...value, requestId: state.requestId });
      await store.send(state.requestId, captured);
      state = await store.get(state.requestId, captured);
      clearConfirmed();
    } catch (error) { message = error.message; description = failure(error); }
    finally { busy = false; if (!message || state || !active()) await refresh(); else lock(false); if (message && active()) copy.set(status, state?.response ? 'alertAlreadyConfirmed' : state ? 'alertSavedError' : 'alertNotSent', { error: description }); }
  }
  for (const field of [input, visitSelect, priority]) field.addEventListener(field === input ? 'input' : 'change', saveDraft);
  window.addEventListener('storage', event => {
    if (event.key === key && event.newValue !== observed && !busy) { conflict = true; copy.set(status, 'alertConflict'); lock(true); }
    if (!active()) refresh();
  });
  window.addEventListener('cw:field-write-change', refresh);
  window.addEventListener('pagehide', () => { closed = true; ++revision; });
  window.addEventListener('pageshow', () => { closed = false; refresh(); });
  setInterval(() => { if (!active()) refresh(); }, 1000);
  window.CWFieldInternalAlert = { send, setVisits(rows) { visits = rows; if (active()) choices(visitSelect.value ? Number(visitSelect.value) : null); }, refresh };
  lock(true); refresh();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
