(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const visitKey = visit => (visit.visitType || 'REGULAR') + ':' + visit.id;
  function today() {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function scope(session = store.session()) {
    if (!store.same(session)) throw Error('A sessão mudou. Reabra o modo de campo com a conta atual.');
    const role = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
    if (!['TECHNICIAN', 'TEAM_LEADER'].includes(role)) throw Error('A conta não permite consultar esta ronda.');
    return { session, role, day: today() };
  }
  function same(context) {
    return !!context && store.same(context.session) && context.day === today();
  }
  function requireScope(context) {
    if (!same(context)) throw Error('A sessão ou o dia mudou. Atualize a ronda da conta atual.');
  }
  const key = context => 'cwFieldRoute:v3:' + context.session.owner + ':' + context.role + ':' + context.day;
  function validate(value, context) {
    const ids = new Set();
    const invalidVisit = visit => {
      if (!visit || !positive(visit.id) || !['REGULAR', 'EXTRA'].includes(visit.visitType) || ids.has(visitKey(visit)) || visit.technician?.id !== context.session.technicianId || (visit.technicianId != null && visit.technicianId !== context.session.technicianId) || typeof visit.status !== 'string' || visit.assistSource) return true;
      ids.add(visitKey(visit)); return false;
    };
    if (!value || value.v !== 3 || value.owner !== context.session.owner || value.role !== context.role || value.technicianId !== context.session.technicianId || value.day !== context.day || !Number.isFinite(Date.parse(value.serverConfirmedAt)) || !Array.isArray(value.visits) || value.visits.some(invalidVisit)) throw Error('A ronda guardada não corresponde à conta/dia ou está ilegível. Os dados foram preservados.');
    return value;
  }
  function fromResponse(data, context) {
    requireScope(context);
    if (data?.ok !== true || data.complete !== true || data.date !== context.day || data.technicianId !== context.session.technicianId || !Array.isArray(data.visits) || data.total !== data.visits.length) throw Error('A resposta não confirma a ronda completa desta conta e deste dia.');
    return validate({ v: 3, owner: context.session.owner, role: context.role, technicianId: context.session.technicianId, day: context.day, serverConfirmedAt: new Date().toISOString(), visits: data.visits }, context);
  }
  function read(context) {
    requireScope(context);
    const raw = localStorage.getItem(key(context));
    if (!raw) {
      if (localStorage.getItem(key(context).replace('cwFieldRoute:v3:', 'cwFieldRoute:v2:'))) throw Error('A ronda antiga pode estar incompleta. Foi preservada; consulte a ronda completa com rede antes de trabalhar offline.');
      if (localStorage.getItem('cwFieldRoute:' + context.session.technicianId)) throw Error('Existe uma ronda antiga sem conta/dia comprovados. Foi preservada; consulte a ronda atual com rede.');
      return null;
    }
    let value; try { value = JSON.parse(raw); } catch (_) { throw Error('A ronda guardada está ilegível. Os dados foram preservados; peça apoio ao escritório.'); }
    return validate(value, context);
  }
  function save(value, context) {
    requireScope(context); validate(value, context);
    const target = key(context);
    if (localStorage.getItem(target)) read(context);
    const raw = JSON.stringify(value); localStorage.setItem(target, raw);
    if (localStorage.getItem(target) !== raw) throw Error('Não foi possível confirmar a gravação da ronda neste dispositivo.');
    return value;
  }
  function update(value, visits, context) {
    requireScope(context); validate(value, context);
    // Assistance and tomorrow views do not become today's authoritative route.
    const rows = new Map(visits.filter(visit => !visit.assistSource).map(visit => [visitKey(visit), visit]));
    return save({ ...value, visits: value.visits.map(visit => rows.get(visitKey(visit)) || visit) }, context);
  }
  window.CWFieldRouteCache = { today, scope, same, key, validate, fromResponse, read, save, update };
})();
