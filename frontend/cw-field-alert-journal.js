(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  const legacyKeys = ['cw:tech-field:op-exception-state:v1', 'cw:tech-field:op-exception-history:v1', 'cw:tech-field:op-exception-command:v1'];
  const actions = ['OPEN', 'ASSUMED', 'CONFIRMED'];
  function scope(session = store.session()) {
    if (!store.same(session)) throw Error('A sessão mudou. Reabra os alertas com a conta atual.');
    const role = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
    if (!['TECHNICIAN', 'TEAM_LEADER'].includes(role)) throw Error('Esta conta não permite registar a leitura dos alertas.');
    return { session, role, day: window.CWFieldRouteCache.today() };
  }
  const same = context => !!context && store.same(context.session) && context.day === window.CWFieldRouteCache.today();
  const key = context => `cwFieldAlertJournal:v2:${context.session.owner}:${context.role}:${context.day}`;
  function requireScope(context) { if (!same(context)) throw Error('A conta ou o dia mudou. Os registos locais foram preservados.'); }
  function validate(value, context) {
    const ids = new Set();
    if (!value || value.v !== 2 || value.owner !== context.session.owner || value.role !== context.role || value.technicianId !== context.session.technicianId || value.day !== context.day || !Array.isArray(value.entries)) throw Error('O histórico local não corresponde à conta/dia. Foi preservado.');
    for (const entry of value.entries) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || !actions.includes(entry.action) || typeof entry.exceptionId !== 'string' || !/^[a-z][a-z-]+:[^\s]{1,240}$/.test(entry.exceptionId) || !Number.isFinite(Date.parse(entry.createdAt)) || typeof entry.title !== 'string' || typeof entry.detail !== 'string' || typeof entry.by !== 'string' || typeof entry.createdBy !== 'string' || !Number.isFinite(Date.parse(entry.sourceCreatedAt))) throw Error('O histórico local está ilegível. Foi preservado.');
      ids.add(entry.id);
    }
    return value;
  }
  function read(context) {
    requireScope(context);
    const raw = localStorage.getItem(key(context));
    if (!raw) return { v: 2, owner: context.session.owner, role: context.role, technicianId: context.session.technicianId, day: context.day, entries: [] };
    let value; try { value = JSON.parse(raw); } catch (_) { throw Error('O histórico local está ilegível. Foi preservado.'); }
    return validate(value, context);
  }
  function states(value) {
    const result = Object.create(null);
    for (const entry of value.entries) {
      const state = result[entry.exceptionId] ||= { status: 'OPEN', createdBy: entry.createdBy, createdAt: entry.sourceCreatedAt, receivedBy: entry.by, receivedAt: entry.createdAt };
      if (entry.action === 'ASSUMED' && state.status === 'OPEN') Object.assign(state, { status: 'ASSUMED', assumedBy: entry.by, assumedAt: entry.createdAt });
      if (entry.action === 'CONFIRMED') Object.assign(state, { status: 'CONFIRMED', confirmedBy: entry.by, confirmedAt: entry.createdAt });
    }
    return result;
  }
  function legacyWarning(context) {
    requireScope(context);
    return legacyKeys.some(name => localStorage.getItem(name)) ? 'Existem registos antigos sem conta comprovada. Foram preservados e não alteram os alertas atuais.' : '';
  }
  async function record(context, exceptions, action, by, relevant = () => true) {
    requireScope(context);
    if (!actions.includes(action)) throw Error('A leitura de um alerta não confirma a resolução da sua causa.');
    if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar a gravação do histórico.');
    return navigator.locks.request(key(context), () => {
      requireScope(context); if (!relevant()) throw Error('O alerta mudou. Consulte o estado atual antes de confirmar.');
      const value = read(context), before = JSON.stringify(value), stateById = states(value), now = new Date().toISOString();
      for (const exception of exceptions) {
        const state = stateById[exception.id];
        if (action === 'OPEN' && state || action === 'ASSUMED' && state && state.status !== 'OPEN' || action === 'CONFIRMED' && state?.status === 'CONFIRMED') continue;
        const append = event => value.entries.push({ id: crypto.randomUUID(), action: event, exceptionId: exception.id, createdAt: now, title: exception.title, detail: exception.detail || '', by: String(by || 'Técnico'), createdBy: String(exception.createdBy || 'Sistema'), sourceCreatedAt: Number.isFinite(Date.parse(exception.createdAt)) ? exception.createdAt : now });
        if (!state && action !== 'OPEN') append('OPEN');
        append(action);
      }
      validate(value, context); const raw = JSON.stringify(value);
      if (raw !== before) {
        localStorage.setItem(key(context), raw);
        if (localStorage.getItem(key(context)) !== raw) throw Error('Não foi possível confirmar a gravação do histórico neste dispositivo.');
        window.dispatchEvent(new Event('cw:alert-journal-updated'));
      }
      return value;
    });
  }
  window.CWFieldAlertJournal = { scope, same, key, validate, read, states, legacyWarning, record };
})();
