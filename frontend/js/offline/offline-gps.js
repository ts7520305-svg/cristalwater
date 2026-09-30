// Legacy page adapter. Each immutable point has its own key, so acknowledgements
// cannot overwrite points captured while an upload is in flight or in another tab.
(function () {
  'use strict';
  const PREFIX = 'cwGpsPoint:v2:', LEGACY = 'cristalwater_offline_gps';
  let flushing = null, watchId = null, generation = 0, controller = null, sendingSession = null, watchingSession = null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Presentation is separate from durable points and the original Error.message.
  const errorCopies = new WeakMap(), presentations = new Map();
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
    unreadable: ["Registo GPS ilegível. Os dados foram preservados; peça apoio ao escritório.", "Unreadable GPS record. The data was preserved; ask the office for help.", "Enregistrement GPS illisible. Les données ont été conservées ; demandez de l’aide au bureau.", "Registro GPS ilegible. Los datos se han conservado; pida ayuda a la oficina.", "Unlesbarer GPS-Eintrag. Die Daten bleiben erhalten; bitten Sie das Büro um Hilfe."],
    invalidRecord: ["Registo GPS inválido; os dados foram preservados. Peça apoio ao escritório.", "Invalid GPS record; the data was preserved. Ask the office for help.", "Enregistrement GPS invalide ; les données ont été conservées. Demandez de l’aide au bureau.", "Registro GPS no válido; los datos se han conservado. Pida ayuda a la oficina.", "Ungültiger GPS-Eintrag; die Daten bleiben erhalten. Bitten Sie das Büro um Hilfe."],
    signIn: ["Entre com a conta do técnico para guardar o GPS.", "Sign in with the technician account to save GPS.", "Connectez-vous avec le compte du technicien pour enregistrer le GPS.", "Entre con la cuenta del técnico para guardar el GPS.", "Melden Sie sich mit dem Technikerkonto an, um GPS zu speichern."],
    invalid: ["Leitura GPS inválida.", "Invalid GPS reading.", "Relevé GPS invalide.", "Lectura GPS no válida.", "Ungültige GPS-Messung."],
    notSaved: ["Não foi possível confirmar a gravação local do GPS.", "Could not confirm that GPS was saved locally.", "Impossible de confirmer l’enregistrement local du GPS.", "No se ha podido confirmar que el GPS se guardó localmente.", "Das lokale Speichern von GPS konnte nicht bestätigt werden."],
    unconfirmed: ["GPS por confirmar. O ponto foi conservado para repetir o mesmo envio.", "GPS awaiting confirmation. The point was kept to repeat the same send.", "GPS en attente de confirmation. Le point a été conservé pour répéter le même envoi.", "GPS pendiente de confirmación. Se ha conservado el punto para repetir el mismo envío.", "GPS-Bestätigung ausstehend. Der Punkt bleibt für denselben erneuten Versand erhalten."],
    sessionUnavailable: ["Sessão GPS indisponível. Volte a entrar.", "GPS session unavailable. Sign in again.", "Session GPS indisponible. Reconnectez-vous.", "Sesión GPS no disponible. Vuelva a entrar.", "GPS-Sitzung nicht verfügbar. Melden Sie sich erneut an."],
    accountChanged: ["A conta mudou. Os pontos GPS foram preservados.", "The account changed. GPS points were preserved.", "Le compte a changé. Les points GPS ont été conservés.", "La cuenta ha cambiado. Los puntos GPS se han conservado.", "Das Konto hat sich geändert. Die GPS-Punkte bleiben erhalten."],
    expired: ["Sessão expirada. Volte a entrar com a mesma conta para confirmar os pontos guardados.", "Session expired. Sign in with the same account to confirm the saved points.", "Session expirée. Reconnectez-vous avec le même compte pour confirmer les points enregistrés.", "Sesión caducada. Entre con la misma cuenta para confirmar los puntos guardados.", "Sitzung abgelaufen. Melden Sie sich mit demselben Konto an, um die gespeicherten Punkte zu bestätigen."],
    noLocks: ["Este navegador não permite coordenar os envios GPS. Os pontos foram preservados.", "This browser cannot coordinate GPS sends. The points were preserved.", "Ce navigateur ne permet pas de coordonner les envois GPS. Les points ont été conservés.", "Este navegador no permite coordinar los envíos GPS. Los puntos se han conservado.", "Dieser Browser kann GPS-Sendungen nicht koordinieren. Die Punkte bleiben erhalten."],
    recordChanged: ["Registo GPS alterado durante o envio. Os dados foram preservados.", "GPS record changed during sending. The data was preserved.", "Enregistrement GPS modifié pendant l’envoi. Les données ont été conservées.", "Registro GPS modificado durante el envío. Los datos se han conservado.", "GPS-Eintrag während des Versands geändert. Die Daten bleiben erhalten."],
    ackNotSaved: ["A confirmação GPS não ficou guardada neste dispositivo.", "The GPS confirmation was not saved on this device.", "La confirmation GPS n’a pas été enregistrée sur cet appareil.", "La confirmación GPS no se ha guardado en este dispositivo.", "Die GPS-Bestätigung wurde auf diesem Gerät nicht gespeichert."],
    history: ["Existem pontos GPS antigos sem conta confirmada. Foram preservados; peça apoio ao escritório.", "Older GPS points without a confirmed account were preserved; ask the office for help.", "Les anciens points GPS sans compte confirmé ont été conservés ; demandez de l’aide au bureau.", "Se han conservado los puntos GPS antiguos sin cuenta confirmada; pida ayuda a la oficina.", "Ältere GPS-Punkte ohne bestätigtes Konto bleiben erhalten; bitten Sie das Büro um Hilfe."],
    pendingCount: ["{count} ponto(s) GPS por enviar.", "{count} GPS point(s) awaiting sending.", "{count} point(s) GPS en attente d’envoi.", "{count} punto(s) GPS pendiente(s) de envío.", "{count} GPS-Punkt(e) zum Senden ausstehend."],
    oldConfirmed: ["Leituras antigas reconhecidas sem atualizar a posição atual.", "Older readings acknowledged without updating the current position.", "Anciens relevés reconnus sans modifier la position actuelle.", "Lecturas antiguas reconocidas sin actualizar la posición actual.", "Ältere Messungen bestätigt, ohne die aktuelle Position zu ändern."],
    confirmed: ["Envios GPS confirmados.", "GPS sends confirmed.", "Envois GPS confirmés.", "Envíos GPS confirmados.", "GPS-Sendungen bestätigt."],
    savedError: ["Não foi possível guardar o GPS: {error}", "Could not save GPS: {error}", "Impossible d’enregistrer le GPS : {error}", "No se ha podido guardar el GPS: {error}", "GPS konnte nicht gespeichert werden: {error}"],
    offline: ["GPS guardado neste dispositivo; aguarda rede.", "GPS saved on this device; awaiting a connection.", "GPS enregistré sur cet appareil ; en attente de connexion.", "GPS guardado en este dispositivo; esperando conexión.", "GPS auf diesem Gerät gespeichert; Verbindung ausstehend."],
    pendingError: ["GPS pendente: {error}", "GPS pending: {error}", "GPS en attente : {error}", "GPS pendiente: {error}", "GPS ausstehend: {error}"],
    permission: ["GPS indisponível ou sem permissão.", "GPS unavailable or permission denied.", "GPS indisponible ou autorisation refusée.", "GPS no disponible o permiso denegado.", "GPS nicht verfügbar oder Berechtigung verweigert."],
    sessionChanged: ["A sessão GPS mudou. Os pontos pendentes foram preservados.", "The GPS session changed. Pending points were preserved.", "La session GPS a changé. Les points en attente ont été conservés.", "La sesión GPS ha cambiado. Los puntos pendientes se han conservado.", "Die GPS-Sitzung hat sich geändert. Ausstehende Punkte bleiben erhalten."],
  };
  function spec(key, params = {}) { return Object.freeze({ key, params: Object.freeze({ ...params }) }); }
  function errorSpec(error, fallback = '') { return errorCopies.get(error) || spec('literal', { text: String(error?.message || fallback) }); }
  function format(value) {
    if (value.key === 'literal') return value.params.text;
    const index = languages.indexOf((document.documentElement?.lang || 'pt').toLowerCase().split('-')[0]);
    return (copy[value.key]?.[index < 0 ? 0 : index] || '').replace(/\{(\w+)\}/g, (_, key) => typeof value.params[key] === 'object' ? format(value.params[key]) : String(value.params[key] ?? ''));
  }
  function bind(node, value) { if (!node) return; node.setAttribute?.('data-cw-no-i18n', ''); const rendered = format(value); presentations.set(node, { value, rendered }); if (node.textContent !== rendered) node.textContent = rendered; }
  function paint() {
    for (const [node, entry] of presentations) {
      if (!node.isConnected || node.textContent !== entry.rendered) { presentations.delete(node); continue; }
      const rendered = format(entry.value); if (node.textContent !== rendered) node.textContent = rendered; entry.rendered = rendered;
    }
  }
  function problem(key, message) { const error = Error(message); errorCopies.set(error, spec(key)); return error; }
  window.CWGpsErrors = Object.freeze({ copy: error => errorCopies.get(error), set: (node, error, fallback) => bind(node, errorSpec(error, fallback)), clear: node => presentations.delete(node) });
  window.addEventListener('cw-language-change', paint);
  let lastLanguage = document.documentElement?.lang || 'pt';
  if (document.documentElement && typeof MutationObserver === 'function') new MutationObserver(() => { const language = document.documentElement.lang; if (language !== lastLanguage) { lastLanguage = language; paint(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
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
    bind(node, typeof message === 'string' ? spec(message) : message);
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
      let point; try { point = JSON.parse(raw); } catch (_) { throw problem('unreadable', 'Registo GPS ilegível. Os dados foram preservados; peça apoio ao escritório.'); }
      if (!valid(point, captured, key)) throw problem('invalidRecord', 'Registo GPS inválido; os dados foram preservados. Peça apoio ao escritório.');
      rows.push({ key, raw, point });
    }
    return rows.sort((a, b) => Date.parse(a.point.recordedAt) - Date.parse(b.point.recordedAt));
  }
  function save(position, captured = session()) {
    if (!captured || !same(captured)) throw problem('signIn', 'Entre com a conta do técnico para guardar o GPS.');
    entries(captured);
    const point = { id: crypto.randomUUID(), owner: captured.owner, technicianId: captured.technicianId, latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy ?? null, recordedAt: new Date(position.recordedAt ?? Date.now()).toISOString() };
    const key = PREFIX + captured.owner + ':' + point.id, raw = JSON.stringify(point);
    if (!valid(point, captured, key)) throw problem('invalid', 'Leitura GPS inválida.');
    localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw problem('notSaved', 'Não foi possível confirmar a gravação local do GPS.');
    return point;
  }
  function status(captured = session()) { const legacy = localStorage.getItem(LEGACY); return { pending: entries(captured).length, unattributed: !!legacy && legacy !== '[]' }; }
  const payload = point => ({ pointId: point.id, technicianId: point.technicianId, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, recordedAt: new Date(point.recordedAt).toISOString() });
  function verify(response, data, point) {
    const ack = data?.acknowledgement;
    if (response.status !== 200 || data.ok !== true || data.success !== true || !ack || ack.scope !== 'GPS_READING' || ack.owner !== point.owner || Object.entries(payload(point)).some(([key, value]) => ack[key] !== value) || !['RECORDED', 'OLDER_LOCATION', 'STALE_LOCATION'].includes(ack.outcome) || (ack.outcome === 'RECORDED' ? data.ignored === true : data.ignored !== true || data.code !== ack.outcome)) throw problem('unconfirmed', 'GPS por confirmar. O ponto foi conservado para repetir o mesmo envio.');
    return ack;
  }
  async function flush(captured = session()) {
    if (!same(captured)) throw problem('sessionUnavailable', 'Sessão GPS indisponível. Volte a entrar.');
    if (flushing) { if (!same(sendingSession)) throw problem('accountChanged', 'A conta mudou. Os pontos GPS foram preservados.'); return flushing; }
    if (!navigator.onLine) return { ...status(captured), offline: true, sent: 0, ignored: 0 };
    if (window.CristalAuth?.isSessionExpired?.()) throw problem('expired', 'Sessão expirada. Volte a entrar com a mesma conta para confirmar os pontos guardados.');
    if (!navigator.locks?.request) throw problem('noLocks', 'Este navegador não permite coordenar os envios GPS. Os pontos foram preservados.');
    sendingSession = captured;
    flushing = navigator.locks.request('cw-gps:' + captured.owner, { ifAvailable: true }, async lock => {
      if (!lock) return { ...status(captured), busy: true, sent: 0, ignored: 0 };
      let sent = 0, ignored = 0, lastAcknowledgement = null;
      for (const { key, raw, point } of entries(captured).slice(0, 100)) {
        if (!same(captured)) throw problem('accountChanged', 'A conta mudou. Os pontos GPS foram preservados.');
        if (localStorage.getItem(key) !== raw) { if (localStorage.getItem(key) === null) continue; throw problem('recordChanged', 'Registo GPS alterado durante o envio. Os dados foram preservados.'); }
        controller = new AbortController(); const timer = setTimeout(() => controller?.abort(), 20000);
        try {
          const response = await fetch('/api/gps/update', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + captured.token }, body: JSON.stringify(payload(point)), signal: controller.signal });
          const data = await response.json();
          if (!same(captured)) throw problem('accountChanged', 'A conta mudou. Os pontos GPS foram preservados.');
          lastAcknowledgement = verify(response, data, point);
          if (localStorage.getItem(key) !== raw) { if (localStorage.getItem(key) !== null) throw problem('recordChanged', 'Registo GPS alterado durante o envio. Os dados foram preservados.'); }
          else { localStorage.removeItem(key); if (localStorage.getItem(key) !== null) throw problem('ackNotSaved', 'A confirmação GPS não ficou guardada neste dispositivo.'); }
          if (lastAcknowledgement.outcome === 'RECORDED') sent++; else ignored++;
        } finally { clearTimeout(timer); controller = null; }
      }
      const pending = entries(captured).length;
      const legacy = localStorage.getItem(LEGACY);
      if (legacy && legacy !== '[]') notice('history');
      else notice(pending ? spec('pendingCount', { count: pending }) : spec(ignored ? 'oldConfirmed' : 'confirmed'));
      return { pending, unattributed: !!legacy && legacy !== '[]', sent, ignored, lastAcknowledgement };
    });
    try { return await flushing; } finally { flushing = null; sendingSession = null; }
  }
  async function send(latitude, longitude, options = {}, captured = session()) {
    try { save({ latitude, longitude, ...options }, captured); } catch (error) { if (same(captured)) notice(spec('savedError', { error: errorSpec(error) })); throw error; }
    if (!navigator.onLine) { notice('offline'); return { ...status(captured), offline: true, sent: 0, ignored: 0 }; }
    try { return await flush(captured); } catch (error) { if (same(captured)) notice(spec('pendingError', { error: errorSpec(error) })); throw error; }
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
    }, () => { if (same(captured) && ownGeneration === generation) { notice('permission'); options.onError?.(problem('permission', 'GPS indisponível ou sem permissão.')); } }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
  }
  window.getOfflineGps = () => entries().map(row => row.point);
  window.saveOfflineGps = save;
  // No bulk clear: confirmation removes only the exact acknowledged point.
  window.syncOfflineGps = flush;
  window.sendGpsPosition = send;
  window.startGpsTracking = start;
  window.CWGps = { session, same, save, send, flush, start, stop, status };
  function checkSession() { if (watchingSession && !same(watchingSession)) stop(); if (sendingSession && !same(sendingSession)) { controller?.abort(); notice('sessionChanged'); } }
  window.addEventListener('pagehide', () => { stop(); controller?.abort(); });
  window.addEventListener('storage', checkSession); window.addEventListener('focus', checkSession); setInterval(checkSession, 500);
})();
