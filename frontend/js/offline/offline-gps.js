// Legacy page adapter. Each immutable point has its own key, so acknowledgements
// cannot overwrite points captured while an upload is in flight or in another tab.
(function () {
  'use strict';
  const PREFIX = 'cwGpsPoint:v2:', LEGACY = 'cristalwater_offline_gps';
  let flushing = null, watchId = null;
  function session() {
    const token = window.CristalAuth?.getToken?.() || '';
    if (!token) return null;
    try {
      const claim = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!['TECHNICIAN', 'TEAM_LEADER'].includes(claim.role)) return null;
      const technicianId = Number(claim.technicianId || claim.id);
      if (!Number.isSafeInteger(technicianId) || technicianId <= 0) return null;
      const owner = claim.principalType === 'USER' ? `USER:${claim.userId || claim.id}:TECH:${technicianId}` : `TECH:${technicianId}`;
      return { token, technicianId, owner };
    } catch (_) { return null; }
  }
  function same(captured) { const current = session(); return current?.token === captured.token && current?.owner === captured.owner; }
  function notice(message) {
    let node = document.getElementById('cwLegacyGpsStatus');
    if (!node) { node = document.createElement('div'); node.id = 'cwLegacyGpsStatus'; node.setAttribute('role', 'status'); node.style.cssText = 'padding:12px;background:#fff4ce;color:#624400'; document.body.prepend(node); }
    node.textContent = message;
  }
  function entries(captured = session()) {
    if (!captured) return [];
    const prefix = PREFIX + captured.owner + ':';
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      let point; try { point = JSON.parse(raw); } catch (_) { throw Error('Registo GPS ilegível. Os dados foram preservados; peça apoio ao escritório.'); }
      if (!point || point.owner !== captured.owner || !point.id || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) throw Error('Registo GPS inválido; peça apoio ao escritório.');
      rows.push({ key, raw, point });
    }
    return rows.sort((a, b) => a.point.recordedAt.localeCompare(b.point.recordedAt));
  }
  function save(position, captured = session()) {
    if (!captured || !same(captured)) throw Error('Entre com a conta do técnico para guardar o GPS.');
    const point = { id: crypto.randomUUID(), owner: captured.owner, technicianId: captured.technicianId, latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy ?? null, recordedAt: position.recordedAt || new Date().toISOString() };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 || !Number.isFinite(Date.parse(point.recordedAt))) throw Error('Leitura GPS inválida.');
    localStorage.setItem(PREFIX + captured.owner + ':' + point.id, JSON.stringify(point));
    return point;
  }
  async function flush() {
    if (flushing) return flushing;
    const captured = session();
    if (!captured) throw Error('Sessão GPS indisponível. Volte a entrar.');
    if (!navigator.onLine) return { pending: entries(captured).length };
    flushing = (async () => {
      for (const { key, raw, point } of entries(captured).slice(0, 100)) {
        if (!same(captured)) throw Error('A conta mudou. Os pontos GPS foram preservados.');
        const response = await fetch('/api/gps/update', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + captured.token }, body: JSON.stringify({ technicianId: point.technicianId, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, recordedAt: point.recordedAt }) });
        const data = await response.json();
        if (!same(captured)) throw Error('A conta mudou. Os pontos GPS foram preservados.');
        if (!response.ok || data.ok === false || data.success === false) throw Error(data.message || 'GPS por confirmar. O envio será repetido.');
        if (localStorage.getItem(key) === raw) localStorage.removeItem(key);
      }
      const pending = entries(captured).length;
      const legacy = localStorage.getItem(LEGACY);
      if (legacy && legacy !== '[]') notice('Existem pontos GPS antigos sem conta confirmada. Foram preservados; peça apoio ao escritório.');
      else notice(pending ? `${pending} ponto(s) GPS por enviar.` : 'Envios GPS confirmados.');
      return { pending };
    })();
    try { return await flushing; } finally { flushing = null; }
  }
  async function send(latitude, longitude, options = {}) {
    try { save({ latitude, longitude, ...options }); } catch (error) { notice('Não foi possível guardar o GPS: ' + error.message); throw error; }
    if (!navigator.onLine) { notice('GPS guardado neste dispositivo; aguarda rede.'); return; }
    try { return await flush(); } catch (error) { notice('GPS pendente: ' + error.message); throw error; }
  }
  function stop() { if (watchId !== null) navigator.geolocation?.clearWatch(watchId); watchId = null; }
  function start() {
    stop();
    const captured = session();
    if (!captured || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(position => {
      if (session()?.owner !== captured.owner) { stop(); return; }
      send(position.coords.latitude, position.coords.longitude, { accuracy: position.coords.accuracy, recordedAt: new Date(position.timestamp).toISOString() }).catch(() => {});
    }, () => notice('GPS indisponível ou sem permissão.'), { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
  }
  window.getOfflineGps = () => entries().map(row => row.point);
  window.saveOfflineGps = save;
  window.clearOfflineGps = () => { for (const row of entries()) localStorage.removeItem(row.key); };
  window.syncOfflineGps = flush;
  window.sendGpsPosition = send;
  window.startGpsTracking = start;
  window.addEventListener('pagehide', stop);
  window.addEventListener('storage', () => { if (!session()) stop(); });
})();
