(function () {
  'use strict';
  const store = window.CWFieldWriteStore, captured = store.session();
  const status = document.getElementById('dayStatus'), start = document.getElementById('startDayBtn'), end = document.getElementById('endDayBtn');
  const key = 'cwWorkdayPending:v1:' + (captured?.owner || 'unavailable');
  const refreshButton = document.createElement('button'), retryButton = document.createElement('button');
  refreshButton.id = 'dayRefreshBtn'; refreshButton.type = 'button'; refreshButton.textContent = 'Consultar jornada';
  retryButton.id = 'dayRecoveryBtn'; retryButton.type = 'button'; retryButton.textContent = 'Confirmar pedido guardado';
  for (const button of [refreshButton, retryButton]) { button.style.cssText = 'min-height:44px;white-space:normal;margin:4px'; status.after(button); }
  status.setAttribute('role', 'status'); status.setAttribute('data-cw-state-managed', 'manual');
  let state = null, pending = null, pendingRaw = null, busy = false, fresh = false, error = '';
  const active = () => store.same(captured);
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && timestamp(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  function requireActive() { if (!active()) throw Error('A sessão mudou. Reabra a página com a conta atual.'); }
  function readPending() {
    requireActive(); const raw = localStorage.getItem(key); let value = null;
    if (raw) {
      try { value = JSON.parse(raw); } catch (_) { throw Error('Pedido de jornada ilegível. Os dados foram preservados; peça apoio ao escritório.'); }
      const allowed = ['v','owner','operation','userId','date','dayStart','workDayId','createdAt'];
      if (!value || Object.keys(value).length !== allowed.length || Object.keys(value).some(field => !allowed.includes(field)) || value.v !== 1 || value.owner !== captured.owner || !['start','end'].includes(value.operation) || !positive(value.userId) || !date(value.date) || !timestamp(value.dayStart) || !timestamp(value.createdAt) || (value.operation === 'start' ? value.workDayId !== null : !positive(value.workDayId))) throw Error('Pedido de jornada inválido ou de outra conta. Os dados foram preservados; peça revisão.');
    }
    pendingRaw = raw; pending = value; return value;
  }
  function paint() {
    const valid = active(), row = state?.workDay;
    start.disabled = !valid || busy || !!error || !!pending || !fresh || !navigator.onLine || !!row;
    end.disabled = !valid || busy || !!error || !!pending || !fresh || !navigator.onLine || row?.status !== 'ACTIVE';
    refreshButton.disabled = !valid || busy; retryButton.disabled = !valid || busy || !navigator.onLine; retryButton.hidden = !pending;
    if (!valid) { status.textContent = 'A sessão mudou. Os pedidos de jornada foram preservados para a conta original.'; return; }
    const last = state ? `${state.scope.date}: ${!row ? 'não iniciada' : row.status === 'ACTIVE' ? 'em trabalho' : 'terminada'}` : '';
    status.textContent = error ? 'Estado da jornada por confirmar. ' + error + (last ? ' Último estado consultado: ' + last + '.' : '')
      : pending ? `${pending.operation === 'start' ? 'Início' : 'Fim'} de ${pending.date} guardado, por confirmar. Use o pedido original.`
      : busy ? 'A consultar/confirmar a jornada…'
      : state ? (fresh ? 'Estado confirmado no servidor — ' : 'Sem confirmação atual — última consulta: ') + last + '.'
      : 'Jornada por consultar.';
  }
  function validate(data, expected) {
    const scope = data?.scope, row = data?.workDay;
    if (data?.ok !== true || !scope || scope.owner !== captured.owner || !positive(scope.userId) || !date(scope.date) || !timestamp(scope.dayStart) || !Object.hasOwn(data, 'workDay') || (expected && (scope.userId !== expected.userId || scope.date !== expected.date || scope.dayStart !== expected.dayStart))) throw Error('Resposta incompleta ou de outra jornada. O pedido original foi preservado.');
    if (row !== null && (!positive(row?.id) || row.userId !== scope.userId || Date.parse(row.date) !== Date.parse(scope.dayStart) || !['ACTIVE','CLOSED'].includes(row.status) || !timestamp(row.startAt) || (row.status === 'CLOSED' ? !timestamp(row.endAt) : row.endAt !== null) || (expected?.workDayId && row.id !== expected.workDayId))) throw Error('O estado recebido não corresponde à jornada guardada.');
    return data;
  }
  async function request(path, options = {}, expected) {
    requireActive();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000), check = setInterval(() => { if (!active()) controller.abort(); }, 250);
    try {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + captured.token }, cache: 'no-store', signal: controller.signal });
      const data = await response.json(); requireActive();
      if (![200,201].includes(response.status)) throw Error(data.error || data.message || 'Sem confirmação do servidor.');
      return validate(data, expected);
    } finally { clearTimeout(timer); clearInterval(check); }
  }
  async function lookup(expected) {
    const data = await request('/api/workday/status' + (expected ? '?date=' + expected.date : ''), {}, expected);
    state = data; fresh = navigator.onLine; return data;
  }
  function outcome(attempt, data) {
    return !!data.workDay && (attempt.operation === 'start' || (data.workDay.id === attempt.workDayId && data.workDay.status === 'CLOSED'));
  }
  function clearConfirmed(attempt) {
    requireActive();
    if (localStorage.getItem(key) !== pendingRaw || JSON.stringify(pending) !== JSON.stringify(attempt)) throw Error('O pedido mudou noutra janela. Preserve os dados e consulte novamente.');
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) throw Error('A confirmação local não ficou guardada. Consulte a jornada novamente.');
    pending = null; pendingRaw = null;
  }
  async function send(attempt) {
    requireActive();
    if (!navigator.onLine) throw Error('Sem ligação. O pedido original continua guardado.');
    const result = await request('/api/workday/' + attempt.operation, { method: 'POST', body: JSON.stringify({ userId: attempt.userId, date: attempt.date, ...(attempt.workDayId ? { workDayId: attempt.workDayId } : {}) }) }, attempt);
    if (!outcome(attempt, result)) throw Error('A operação ainda não está confirmada. Preserve o pedido original.');
    state = result; fresh = true; clearConfirmed(attempt);
    await lookup();
  }
  async function run(operation) {
    if (busy || !active()) { paint(); return; }
    busy = true; error = ''; paint();
    try {
      if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar a jornada entre janelas.');
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!lock) throw Error('A jornada está a ser confirmada noutra janela. Consulte novamente.');
        requireActive(); readPending(); await operation();
      });
    } catch (failure) { if (active()) { error = failure.message; fresh = false; } }
    finally { busy = false; paint(); }
  }
  async function refresh() {
    return run(async () => {
      if (pending) { const attempt = pending, data = await lookup(attempt); if (!outcome(attempt, data)) return; clearConfirmed(attempt); }
      await lookup();
    });
  }
  async function change(operation) {
    return run(async () => {
      if (pending) throw Error('Já existe um pedido guardado. Confirme-o antes de iniciar outra operação.');
      if (!navigator.onLine) throw Error('Ligue à rede para consultar e alterar a jornada.');
      const data = await lookup(), row = data.workDay;
      if ((operation === 'start' && row) || (operation === 'end' && row?.status !== 'ACTIVE')) return;
      const attempt = { v:1, owner:captured.owner, operation, userId:data.scope.userId, date:data.scope.date, dayStart:data.scope.dayStart, workDayId:operation === 'end' ? row.id : null, createdAt:new Date().toISOString() };
      requireActive(); if (localStorage.getItem(key) !== pendingRaw) throw Error('O pedido mudou noutra janela. Consulte a jornada novamente.');
      const raw = JSON.stringify(attempt); localStorage.setItem(key, raw);
      if (localStorage.getItem(key) !== raw) throw Error('O pedido não ficou guardado neste dispositivo. Não foi enviado.');
      pending = attempt; pendingRaw = raw; paint(); await send(attempt);
    });
  }
  async function recover() {
    return run(async () => {
      if (!pending) { await lookup(); return; }
      const attempt = pending, data = await lookup(attempt);
      if (outcome(attempt, data)) { clearConfirmed(attempt); await lookup(); }
      else await send(attempt);
    });
  }
  refreshButton.onclick = refresh; retryButton.onclick = recover;
  window.addEventListener('storage', event => { if (!active()) { paint(); return; } if (event.key === key && !busy) { try { readPending(); error = ''; } catch (failure) { error = failure.message; } fresh = false; paint(); } });
  window.addEventListener('offline', () => { fresh = false; paint(); });
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
  setInterval(() => { if (!active()) paint(); }, 1000);
  window.CWLegacyWorkday = { refresh, start: () => change('start'), end: () => change('end'), recover };
  paint();
})();
