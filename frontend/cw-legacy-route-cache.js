(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  const key = (session, day) => 'cwLegacyRoute:v2:' + session.owner + ':' + day;
  const validId = value => Number.isSafeInteger(value) && value > 0;
  function requireSession(session, day) { if (!store.same(session) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('A sessão ou o dia mudou. Reabra a página para consultar a rota atual.'); }
  function validate(value, session, day) {
    const ids = new Set();
    if (!value || value.v !== 2 || value.owner !== session.owner || value.technicianId !== session.technicianId || value.day !== day || !Number.isFinite(Date.parse(value.serverConfirmedAt)) || !Array.isArray(value.visits) || value.visits.some(visit => { if (!visit || !validId(visit.id) || ids.has(visit.id) || visit.technicianId !== session.technicianId || typeof visit.status !== 'string') return true; ids.add(visit.id); return false; }) || (value.activeVisitId !== null && !ids.has(value.activeVisitId)) || !Array.isArray(value.pendingSyncVisitIds) || value.pendingSyncVisitIds.some(id => !ids.has(id))) throw Error('A rota guardada não corresponde à conta ou ao dia, ou está ilegível. Os dados foram preservados; volte a consultar com rede.');
    return value;
  }
  function read(session, day) {
    requireSession(session, day);
    const raw = localStorage.getItem(key(session, day));
    if (!raw) {
      const global = localStorage.getItem('offline_visits');
      if ((global && global.trim() !== '[]') || localStorage.getItem('cristalwater_route_state:' + session.technicianId + ':' + day)) throw Error('Existe uma rota antiga sem identidade comprovada. Foi preservada e não será apresentada nesta conta. Consulte a rota com rede.');
      return null;
    }
    let value; try { value = JSON.parse(raw); } catch (_) { throw Error('A rota guardada está ilegível. Os dados foram preservados; peça apoio ao escritório.'); }
    return validate(value, session, day);
  }
  function save(value, session) {
    requireSession(session, value.day); validate(value, session, value.day);
    const target = key(session, value.day), previous = localStorage.getItem(target);
    // Never replace corrupt or differently owned data merely because fresh data arrived.
    if (previous) read(session, value.day);
    const raw = JSON.stringify(value); localStorage.setItem(target, raw);
    if (localStorage.getItem(target) !== raw) throw Error('Não foi possível confirmar a rota offline neste dispositivo.');
    return value;
  }
  window.CWLegacyRouteCache = { key, read, save, validate };
})();
