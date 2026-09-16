(function () {
  'use strict';
  const store = window.CWFieldWriteStore, captured = store.session();
  const input = document.getElementById('internalAlert'), button = document.getElementById('sendAlertBtn');
  if (!input || !button) return;
  input.closest('.card').style.marginBottom = 'calc(96px + env(safe-area-inset-bottom, 0px))';
  const key = captured ? 'cwFieldInternalAlertDraft:' + captured.owner : null;
  const blank = () => ({ v: 1, message: '', visitId: null, priority: 'NORMAL', requestId: null });
  let observed, state = null, busy = false, revision = 0, closed = false, conflict = false, visits = [];
  const controls = document.createElement('div');
  controls.innerHTML = '<p>Mensagem para a administração. Escolha uma visita apenas se o alerta lhe disser respeito.</p><label>Visita<select id="internalAlertVisit"><option value="">Sem visita associada</option></select></label><label>Prioridade<select id="internalAlertPriority"><option value="NORMAL">Normal</option><option value="HIGH">Urgente</option></select></label>';
  for (const label of controls.querySelectorAll('label')) label.style.cssText = 'display:block;margin:12px 0;font-weight:700';
  for (const select of controls.querySelectorAll('select')) select.style.cssText = 'display:block;max-width:100%;width:100%;min-height:44px;padding:8px;color:inherit;background:inherit';
  input.before(controls); input.maxLength = 5000;
  const visitSelect = controls.querySelector('#internalAlertVisit'), priority = controls.querySelector('#internalAlertPriority');
  const status = document.createElement('p'); status.id = 'internalAlertStatus'; status.setAttribute('role','status'); status.setAttribute('data-cw-state-managed','manual'); button.before(status);
  function active() { return !closed && store.same(captured); }
  function requireActive() { if (!active()) throw Error('A sessão mudou. Reabra a página com a conta original; o alerta foi preservado.'); }
  function lock(value) { input.readOnly = value; visitSelect.disabled = value; priority.disabled = value; button.disabled = busy || conflict || !active(); }
  function read() {
    requireActive();
    const raw = localStorage.getItem(key); let value;
    try { value = raw ? JSON.parse(raw) : blank(); } catch (_) { throw Error('Rascunho do alerta ilegível. Preserve os dados e peça apoio ao escritório.'); }
    if (!value || value.v !== 1 || Object.keys(value).some(field => !['v','message','visitId','priority','requestId'].includes(field)) || typeof value.message !== 'string' || value.message.length > 5000 || (value.visitId !== null && (!Number.isSafeInteger(value.visitId) || value.visitId <= 0)) || !['NORMAL','HIGH'].includes(value.priority) || (value.requestId !== null && (typeof value.requestId !== 'string' || !/^[0-9a-f-]{36}$/.test(value.requestId)))) throw Error('Rascunho do alerta ilegível. Preserve os dados e peça apoio ao escritório.');
    if (observed === undefined) observed = raw;
    return value;
  }
  function write(value) {
    requireActive(); read();
    if (localStorage.getItem(key) !== observed) { conflict = true; throw Error('O rascunho mudou noutra janela. Copie o texto desta janela e reabra para rever o alerta guardado.'); }
    const raw = JSON.stringify(value); localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw Error('Não foi possível confirmar o rascunho neste dispositivo.');
    observed = raw;
  }
  function payload(value) { return { message: value.message, visitId: value.visitId, priority: value.priority }; }
  function samePayload(a, b) { return a.message === b.message && a.visitId === b.visitId && a.priority === b.priority; }
  function choices(selected) {
    visitSelect.replaceChildren(new Option('Sem visita associada', ''));
    for (const visit of visits) visitSelect.add(new Option('Visita ' + visit.id + ' · ' + (visit.pool?.name || visit.poolName || 'Piscina'), String(visit.id)));
    if (selected && !Array.from(visitSelect.options).some(option => option.value === String(selected))) visitSelect.add(new Option('Visita ' + selected + ' · confirmar contexto com o escritório', String(selected)));
    visitSelect.value = selected ? String(selected) : '';
  }
  function show(value) { input.value = value.message; choices(value.visitId); priority.value = value.priority; }
  async function refresh() {
    if (busy) return;
    const generation = ++revision;
    if (!active()) { input.value = ''; visitSelect.replaceChildren(); priority.value = 'NORMAL'; lock(true); status.textContent = 'A sessão mudou. Reabra a página para recuperar os alertas da conta atual.'; return; }
    try {
      const draft = read(), rows = await store.records('TECHNICIAN_ALERT', captured, true);
      if (!active() || generation !== revision || busy) return;
      if (conflict) { lock(true); return; }
      state = rows.find(row => !row.response) || (draft.requestId ? rows.find(row => row.requestId === draft.requestId) : null);
      if (draft.requestId && !state) throw Error('O pedido do rascunho não foi encontrado. Preserve o texto e peça apoio ao escritório.');
      if (state && draft.message && !samePayload(draft, state.payload)) throw Error('O rascunho difere do alerta guardado. Ambos foram preservados; peça revisão antes de enviar.');
      show(state ? state.payload : draft); lock(!!state);
      button.textContent = state?.response ? 'Limpar rascunho confirmado' : state ? 'Confirmar alerta guardado' : 'Enviar alerta à administração';
      const confirmed = state?.response || rows.filter(row => row.response).at(-1)?.response;
      status.textContent = state && !state.response ? 'Alerta guardado neste dispositivo, por confirmar. ' + (state.failure?.message || 'Use Confirmar alerta guardado.') : confirmed ? 'Alerta #' + confirmed.alert.id + ' registado para a administração. A leitura ainda não está confirmada.' : 'O texto fica guardado neste dispositivo até enviar.';
    } catch (error) { if (active() && generation === revision) { conflict = true; lock(true); status.textContent = error.message; } }
  }
  function saveDraft() {
    if (busy || state || conflict) return;
    ++revision;
    try { write({ ...blank(), message: input.value, visitId: visitSelect.value ? Number(visitSelect.value) : null, priority: priority.value }); status.textContent = 'Rascunho guardado neste dispositivo; ainda não enviado.'; }
    catch (error) { status.textContent = 'O texto não ficou guardado. ' + error.message; lock(conflict); }
  }
  function clearConfirmed() { write(blank()); state = null; show(blank()); }
  async function send() {
    if (busy || conflict) return;
    busy = true; lock(true);
    let message = '';
    try {
      requireActive();
      if (state?.response) { clearConfirmed(); return; }
      const value = state ? { ...blank(), ...state.payload, requestId: state.requestId } : { ...blank(), message: input.value, visitId: visitSelect.value ? Number(visitSelect.value) : null, priority: priority.value };
      if (!value.message.trim()) throw Error('Escreva o alerta antes de enviar.');
      write(value);
      state = await store.prepare('TECHNICIAN_ALERT', captured.technicianId, payload(value), { label: 'Alerta para a administração' }, captured);
      write({ ...value, requestId: state.requestId });
      await store.send(state.requestId, captured);
      state = await store.get(state.requestId, captured);
      clearConfirmed();
    } catch (error) { message = error.message; }
    finally { busy = false; if (!message || state || !active()) await refresh(); else lock(false); if (message && active()) status.textContent = (state?.response ? 'Alerta já confirmado; o rascunho foi preservado. ' : state ? 'Alerta guardado, por confirmar. ' : 'O alerta não foi enviado. ') + message; }
  }
  for (const field of [input, visitSelect, priority]) field.addEventListener(field === input ? 'input' : 'change', saveDraft);
  window.addEventListener('storage', event => {
    if (event.key === key && event.newValue !== observed && !busy) { conflict = true; status.textContent = 'O rascunho mudou noutra janela. Copie o texto desta janela e reabra para rever o alerta guardado.'; lock(true); }
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
