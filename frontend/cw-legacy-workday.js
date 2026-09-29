(function () {
  'use strict';
  const C = window.CWLegacyTechnicianCopy;
  const store = window.CWFieldWriteStore, captured = store.session();
  const status = document.getElementById('dayStatus'), start = document.getElementById('startDayBtn'), end = document.getElementById('endDayBtn');
  const key = 'cwWorkdayPending:v1:' + (captured?.owner || 'unavailable');
  const refreshButton = document.createElement('button'), retryButton = document.createElement('button');
  refreshButton.id = 'dayRefreshBtn'; refreshButton.type = 'button'; C.set(refreshButton, 'dayRefresh');
  retryButton.id = 'dayRecoveryBtn'; retryButton.type = 'button'; C.set(retryButton, 'dayRetry');
  for (const button of [refreshButton, retryButton]) { button.style.cssText = 'min-height:44px;white-space:normal;margin:4px'; status.after(button); }
  status.setAttribute('role', 'status'); status.setAttribute('data-cw-state-managed', 'manual');
  let state = null, pending = null, pendingRaw = null, busy = false, fresh = false, error = '';
  const active = () => store.same(captured);
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && timestamp(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  function requireActive() { if (!active()) throw C.error('daySession'); }
  function readPending() {
    requireActive(); const raw = localStorage.getItem(key); let value = null;
    if (raw) {
      try { value = JSON.parse(raw); } catch (_) { throw C.error('dayUnreadable'); }
      const allowed = ['v','owner','operation','userId','date','dayStart','workDayId','createdAt'];
      if (!value || Object.keys(value).length !== allowed.length || Object.keys(value).some(field => !allowed.includes(field)) || value.v !== 1 || value.owner !== captured.owner || !['start','end'].includes(value.operation) || !positive(value.userId) || !date(value.date) || !timestamp(value.dayStart) || !timestamp(value.createdAt) || (value.operation === 'start' ? value.workDayId !== null : !positive(value.workDayId))) throw C.error('dayInvalid');
    }
    pendingRaw = raw; pending = value; return value;
  }
  function paint() {
    const valid = active(), row = state?.workDay;
    start.disabled = !valid || busy || !!error || !!pending || !fresh || !navigator.onLine || !!row;
    end.disabled = !valid || busy || !!error || !!pending || !fresh || !navigator.onLine || row?.status !== 'ACTIVE';
    refreshButton.disabled = !valid || busy; retryButton.disabled = !valid || busy || !navigator.onLine; retryButton.hidden = !pending;
    if (!valid) { C.set(status, 'daySessionPreserved'); return; }
    // Presentation descriptors let the copy helper update text in place without
    // re-running an operation, touching pending bytes or changing button guards.
    const last = state ? C.spec('dayLast', { date: state.scope.date, state: C.spec(!row ? 'dayNotStarted' : row.status === 'ACTIVE' ? 'dayWorking' : 'dayEnded') }) : '';
    C.set(status, error ? C.spec('dayError', { error, previous: last ? C.spec('dayPrevious', { last }) : '' })
      : pending ? C.spec('dayPending', { operation: C.spec(pending.operation === 'start' ? 'dayStart' : 'dayEnd'), date: pending.date })
      : busy ? C.spec('dayBusy')
      : state ? C.spec(fresh ? 'dayConfirmed' : 'dayStale', { last })
      : C.spec('dayUnknown'));
  }
  function validate(data, expected) {
    const scope = data?.scope, row = data?.workDay;
    if (data?.ok !== true || !scope || scope.owner !== captured.owner || !positive(scope.userId) || !date(scope.date) || !timestamp(scope.dayStart) || !Object.hasOwn(data, 'workDay') || (expected && (scope.userId !== expected.userId || scope.date !== expected.date || scope.dayStart !== expected.dayStart))) throw C.error('dayIncomplete');
    if (row !== null && (!positive(row?.id) || row.userId !== scope.userId || Date.parse(row.date) !== Date.parse(scope.dayStart) || !['ACTIVE','CLOSED'].includes(row.status) || !timestamp(row.startAt) || (row.status === 'CLOSED' ? !timestamp(row.endAt) : row.endAt !== null) || (expected?.workDayId && row.id !== expected.workDayId))) throw C.error('dayMismatch');
    return data;
  }
  async function request(path, options = {}, expected) {
    requireActive();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000), check = setInterval(() => { if (!active()) controller.abort(); }, 250);
    try {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + captured.token }, cache: 'no-store', signal: controller.signal });
      const data = await response.json(); requireActive();
      if (![200,201].includes(response.status)) throw data.error || data.message ? Error(data.error || data.message) : C.error('dayNoConfirmation');
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
    if (localStorage.getItem(key) !== pendingRaw || JSON.stringify(pending) !== JSON.stringify(attempt)) throw C.error('dayChangedPreserve');
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) throw C.error('dayClearFailed');
    pending = null; pendingRaw = null;
  }
  async function send(attempt) {
    requireActive();
    if (!navigator.onLine) throw C.error('dayOfflineSaved');
    const result = await request('/api/workday/' + attempt.operation, { method: 'POST', body: JSON.stringify({ userId: attempt.userId, date: attempt.date, ...(attempt.workDayId ? { workDayId: attempt.workDayId } : {}) }) }, attempt);
    if (!outcome(attempt, result)) throw C.error('dayNotConfirmed');
    state = result; fresh = true; clearConfirmed(attempt);
    await lookup();
  }
  async function run(operation) {
    if (busy || !active()) { paint(); return; }
    busy = true; error = ''; paint();
    try {
      if (!navigator.locks?.request) throw C.error('dayNoLocks');
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!lock) throw C.error('dayLocked');
        requireActive(); readPending(); await operation();
      });
    } catch (failure) { if (active()) { error = failure.copy || failure.message; fresh = false; } }
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
      if (pending) throw C.error('dayAlreadyPending');
      if (!navigator.onLine) throw C.error('dayConnect');
      const data = await lookup(), row = data.workDay;
      if ((operation === 'start' && row) || (operation === 'end' && row?.status !== 'ACTIVE')) return;
      const attempt = { v:1, owner:captured.owner, operation, userId:data.scope.userId, date:data.scope.date, dayStart:data.scope.dayStart, workDayId:operation === 'end' ? row.id : null, createdAt:new Date().toISOString() };
      requireActive(); if (localStorage.getItem(key) !== pendingRaw) throw C.error('dayChanged');
      const raw = JSON.stringify(attempt); localStorage.setItem(key, raw);
      if (localStorage.getItem(key) !== raw) throw C.error('dayNotSaved');
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
  window.addEventListener('storage', event => { if (!active()) { paint(); return; } if (event.key === key && !busy) { try { readPending(); error = ''; } catch (failure) { error = failure.copy || failure.message; } fresh = false; paint(); } });
  window.addEventListener('offline', () => { fresh = false; paint(); });
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
  setInterval(() => { if (!active()) paint(); }, 1000);
  window.CWLegacyWorkday = { refresh, start: () => change('start'), end: () => change('end'), recover };
  paint();
})();
