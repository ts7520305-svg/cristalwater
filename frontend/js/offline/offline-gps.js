// Legacy page adapter. Each immutable point has its own key, so acknowledgements
// cannot overwrite points captured while an upload is in flight or in another tab.
(function () {
  'use strict';
  const PREFIX = 'cwGpsPoint:v2:', LEGACY = 'cristalwater_offline_gps';
  let flushing = null, watchId = null, generation = 0, controller = null, sendingSession = null, watchingSession = null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function session() {
    try {
      const token = window.CristalAuth?.getToken?.() || '';
      if (!token || (localStorage.getItem('token') && localStorage.getItem('token') !== token)) return null;
      const claim = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!['TECHNICIAN', 'TEAM_LEADER'].includes(claim.role)) return null;
      const technicianId = Number(claim.technicianId || claim.id);
      if (!Number.isSafeInteger(technicianId) || technicianId <= 0) return null;
      const owner = claim.principalType === 'USER' ? `USER:${claim.userId || claim.id}:TECH:${technicianId}` : `TECH:${technicianId}`;
      return { token, technicianId, owner };
    } catch (_) { return null; }
  }
  function same(captured) { const current = session(); return !!captured && current?.token === captured.token && current?.owner === captured.owner; }
  function notice(message) {
    let node = document.getElementById('cwLegacyGpsStatus');
    if (!node) { node = document.createElement('div'); node.id = 'cwLegacyGpsStatus'; node.setAttribute('role', 'status'); node.style.cssText = 'padding:12px;background:#fff4ce;color:#624400'; document.body.prepend(node); }
    node.textContent = message;
  }
  function valid(point, captured, key) {
    return point && uuid.test(point.id) && point.owner === captured.owner && point.technicianId === captured.technicianId && key === PREFIX + captured.owner + ':' + point.id && Object.keys(point).every(k => ['id', 'owner', 'technicianId', 'latitude', 'longitude', 'accuracy', 'recordedAt'].includes(k)) && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 && !(Math.abs(point.latitude) < 0.0001 && Math.abs(point.longitude) < 0.0001) && (point.accuracy === null || (Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 10000)) && typeof point.recordedAt === 'string' && Number.isFinite(Date.parse(point.recordedAt));
  }
  function entries(captured = session()) {
    if (!captured) return [];
    const prefix = PREFIX + captured.owner + ':';
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      let point; try { point = JSON.parse(raw); } catch (_) { throw Error('Registo GPS ilegível. Os dados foram preservados; peça apoio ao escritório.'); }
      if (!valid(point, captured, key)) throw Error('Registo GPS inválido; os dados foram preservados. Peça apoio ao escritório.');
      rows.push({ key, raw, point });
    }
    return rows.sort((a, b) => Date.parse(a.point.recordedAt) - Date.parse(b.point.recordedAt));
  }
  function save(position, captured = session()) {
    if (!captured || !same(captured)) throw Error('Entre com a conta do técnico para guardar o GPS.');
    entries(captured);
    const point = { id: crypto.randomUUID(), owner: captured.owner, technicianId: captured.technicianId, latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy ?? null, recordedAt: new Date(position.recordedAt ?? Date.now()).toISOString() };
    const key = PREFIX + captured.owner + ':' + point.id, raw = JSON.stringify(point);
    if (!valid(point, captured, key)) throw Error('Leitura GPS inválida.');
    localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw Error('Não foi possível confirmar a gravação local do GPS.');
    return point;
  }
  function status(captured = session()) { const legacy = localStorage.getItem(LEGACY); return { pending: entries(captured).length, unattributed: !!legacy && legacy !== '[]' }; }
  const payload = point => ({ pointId: point.id, technicianId: point.technicianId, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, recordedAt: new Date(point.recordedAt).toISOString() });
  function verify(response, data, point) {
    const ack = data?.acknowledgement;
    if (response.status !== 200 || data.ok !== true || data.success !== true || !ack || ack.scope !== 'GPS_READING' || ack.owner !== point.owner || Object.entries(payload(point)).some(([key, value]) => ack[key] !== value) || !['RECORDED', 'OLDER_LOCATION', 'STALE_LOCATION'].includes(ack.outcome) || (ack.outcome === 'RECORDED' ? data.ignored === true : data.ignored !== true || data.code !== ack.outcome)) throw Error('GPS por confirmar. O ponto foi conservado para repetir o mesmo envio.');
    return ack;
  }
  async function flush(captured = session()) {
    if (!same(captured)) throw Error('Sessão GPS indisponível. Volte a entrar.');
    if (flushing) { if (!same(sendingSession)) throw Error('A conta mudou. Os pontos GPS foram preservados.'); return flushing; }
    if (!navigator.onLine) return { ...status(captured), offline: true, sent: 0, ignored: 0 };
    if (window.CristalAuth?.isSessionExpired?.()) throw Error('Sessão expirada. Volte a entrar com a mesma conta para confirmar os pontos guardados.');
    if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar os envios GPS. Os pontos foram preservados.');
    sendingSession = captured;
    flushing = navigator.locks.request('cw-gps:' + captured.owner, { ifAvailable: true }, async lock => {
      if (!lock) return { ...status(captured), busy: true, sent: 0, ignored: 0 };
      let sent = 0, ignored = 0, lastAcknowledgement = null;
      for (const { key, raw, point } of entries(captured).slice(0, 100)) {
        if (!same(captured)) throw Error('A conta mudou. Os pontos GPS foram preservados.');
        if (localStorage.getItem(key) !== raw) { if (localStorage.getItem(key) === null) continue; throw Error('Registo GPS alterado durante o envio. Os dados foram preservados.'); }
        controller = new AbortController(); const timer = setTimeout(() => controller?.abort(), 20000);
        try {
          const response = await fetch('/api/gps/update', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + captured.token }, body: JSON.stringify(payload(point)), signal: controller.signal });
          const data = await response.json();
          if (!same(captured)) throw Error('A conta mudou. Os pontos GPS foram preservados.');
          lastAcknowledgement = verify(response, data, point);
          if (localStorage.getItem(key) !== raw) { if (localStorage.getItem(key) !== null) throw Error('Registo GPS alterado durante o envio. Os dados foram preservados.'); }
          else { localStorage.removeItem(key); if (localStorage.getItem(key) !== null) throw Error('A confirmação GPS não ficou guardada neste dispositivo.'); }
          if (lastAcknowledgement.outcome === 'RECORDED') sent++; else ignored++;
        } finally { clearTimeout(timer); controller = null; }
      }
      const pending = entries(captured).length;
      const legacy = localStorage.getItem(LEGACY);
      if (legacy && legacy !== '[]') notice('Existem pontos GPS antigos sem conta confirmada. Foram preservados; peça apoio ao escritório.');
      else notice(pending ? `${pending} ponto(s) GPS por enviar.` : ignored ? 'Leituras antigas reconhecidas sem atualizar a posição atual.' : 'Envios GPS confirmados.');
      return { pending, unattributed: !!legacy && legacy !== '[]', sent, ignored, lastAcknowledgement };
    });
    try { return await flushing; } finally { flushing = null; sendingSession = null; }
  }
  async function send(latitude, longitude, options = {}, captured = session()) {
    try { save({ latitude, longitude, ...options }, captured); } catch (error) { if (same(captured)) notice('Não foi possível guardar o GPS: ' + error.message); throw error; }
    if (!navigator.onLine) { notice('GPS guardado neste dispositivo; aguarda rede.'); return { ...status(captured), offline: true, sent: 0, ignored: 0 }; }
    try { return await flush(captured); } catch (error) { if (same(captured)) notice('GPS pendente: ' + error.message); throw error; }
  }
  function stop() { generation++; if (watchId !== null) navigator.geolocation?.clearWatch(watchId); watchId = null; watchingSession = null; }
  function start(options = {}) {
    stop();
    const captured = session();
    if (!captured || !navigator.geolocation) return;
    const ownGeneration = generation; let lastCapture = 0; watchingSession = captured;
    watchId = navigator.geolocation.watchPosition(position => {
      if (ownGeneration !== generation) return;
      if (!same(captured)) { stop(); return; }
      if (Date.now() - lastCapture < 10000) return; lastCapture = Date.now();
      send(position.coords.latitude, position.coords.longitude, { accuracy: position.coords.accuracy, recordedAt: position.timestamp }, captured).then(result => { if (same(captured) && ownGeneration === generation) options.onResult?.(result); }).catch(error => { if (same(captured) && ownGeneration === generation) options.onError?.(error); });
    }, () => { if (same(captured) && ownGeneration === generation) { notice('GPS indisponível ou sem permissão.'); options.onError?.(Error('GPS indisponível ou sem permissão.')); } }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
  }
  window.getOfflineGps = () => entries().map(row => row.point);
  window.saveOfflineGps = save;
  // No bulk clear: confirmation removes only the exact acknowledged point.
  window.syncOfflineGps = flush;
  window.sendGpsPosition = send;
  window.startGpsTracking = start;
  window.CWGps = { session, same, save, send, flush, start, stop, status };
  function checkSession() { if (watchingSession && !same(watchingSession)) stop(); if (sendingSession && !same(sendingSession)) { controller?.abort(); notice('A sessão GPS mudou. Os pontos pendentes foram preservados.'); } }
  window.addEventListener('pagehide', () => { stop(); controller?.abort(); });
  window.addEventListener('storage', checkSession); window.addEventListener('focus', checkSession); setInterval(checkSession, 500);
})();
