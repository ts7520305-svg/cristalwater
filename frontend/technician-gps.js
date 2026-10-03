// Page copy uses captured presentation values, never another GPS read or send.
const gpsText = (() => {
  const languages = ['pt', 'en', 'fr', 'es', 'de'], locales = ['pt-PT', 'en-GB', 'fr-FR', 'es-ES', 'de-DE'];
  const copy = {
  documentTitle: ['Cristal Water - GPS Técnico', 'Cristal Water - Technician GPS', 'Cristal Water - GPS Technicien', 'Cristal Water - GPS Técnico', 'Cristal Water - Techniker-GPS'],
  operation: ['Operação técnica', 'Technical operations', 'Opérations techniques', 'Operación técnica', 'Technischer Einsatz'],
  heading: ['GPS de Campo', 'Field GPS', 'GPS de terrain', 'GPS de campo', 'GPS im Außendienst'],
  intro: ['Leitura ao sol e estado de sincronização em tempo real.', 'Readable in sunlight with live synchronization status.', 'Lisible au soleil avec état de synchronisation en temps réel.', 'Lectura al sol y estado de sincronización en tiempo real.', 'Im Sonnenlicht lesbar, mit aktuellem Synchronisierungsstatus.'],
  start: ['Iniciar tracking', 'Start tracking', 'Démarrer le suivi', 'Iniciar seguimiento', 'Ortung starten'],
  send: ['Enviar ponto agora', 'Send point now', 'Envoyer un point maintenant', 'Enviar punto ahora', 'Punkt jetzt senden'],
  retry: ['Confirmar pontos guardados', 'Confirm saved points', 'Confirmer les points enregistrés', 'Confirmar puntos guardados', 'Gespeicherte Punkte bestätigen'],
  summary: ['Estado rápido', 'Quick status', 'État rapide', 'Estado rápido', 'Statusübersicht'],
  synchronization: ['Sincronização', 'Synchronization', 'Synchronisation', 'Sincronización', 'Synchronisierung'],
  accuracy: ['Precisão', 'Accuracy', 'Précision', 'Precisión', 'Genauigkeit'],
  last: ['Último envio', 'Last send', 'Dernier envoi', 'Último envío', 'Letzter Versand'],
  waiting: ['Em espera', 'Waiting', 'En attente', 'En espera', 'Wartend'],
  pending: ['Por confirmar', 'Awaiting confirmation', 'À confirmer', 'Por confirmar', 'Bestätigung ausstehend'],
  reviewing: ['A rever', 'Needs review', 'À vérifier', 'Por revisar', 'Prüfung erforderlich'],
  synchronized: ['Sincronizado', 'Synchronized', 'Synchronisé', 'Sincronizado', 'Synchronisiert'],
  updating: ['A atualizar', 'Updating', 'À actualiser', 'Por actualizar', 'Aktualisierung erforderlich'],
  empty: ['Sem pendências', 'Nothing pending', 'Aucun envoi en attente', 'Sin pendientes', 'Keine ausstehenden Punkte'],
  changed: ['Sessão alterada', 'Session changed', 'Session modifiée', 'Sesión cambiada', 'Sitzung geändert'],
  ready: ['Pronto para iniciar GPS.', 'Ready to start GPS.', 'Prêt à démarrer le GPS.', 'Listo para iniciar GPS.', 'Bereit zum Starten von GPS.'],
  acquiring: ['A obter ponto atual.', 'Getting the current point.', 'Acquisition du point actuel.', 'Obteniendo el punto actual.', 'Aktueller Punkt wird ermittelt.'],
  tracking: ['A obter leituras GPS. Os pontos são guardados antes do envio.', 'Getting GPS readings. Points are saved before sending.', 'Acquisition des relevés GPS. Les points sont enregistrés avant l’envoi.', 'Obteniendo lecturas GPS. Los puntos se guardan antes del envío.', 'GPS-Messungen werden erfasst. Punkte werden vor dem Versand gespeichert.'],
  confirming: ['A confirmar pontos guardados…', 'Confirming saved points…', 'Confirmation des points enregistrés…', 'Confirmando puntos guardados…', 'Gespeicherte Punkte werden bestätigt…'],
  pendingCount: ['{count} ponto(s) GPS guardado(s) neste dispositivo por confirmar.', '{count} GPS point(s) saved on this device awaiting confirmation.', '{count} point(s) GPS enregistré(s) sur cet appareil à confirmer.', '{count} punto(s) GPS guardado(s) en este dispositivo por confirmar.', '{count} GPS-Punkt(e) auf diesem Gerät warten auf Bestätigung.'],
  history: ['Existem pontos GPS antigos sem conta confirmada. Foram preservados; peça apoio ao escritório.', 'Older GPS points without a confirmed account were preserved; ask the office for help.', 'Les anciens points GPS sans compte confirmé ont été conservés ; demandez de l’aide au bureau.', 'Se han conservado los puntos GPS antiguos sin cuenta confirmada; pida ayuda a la oficina.', 'Ältere GPS-Punkte ohne bestätigtes Konto bleiben erhalten; bitten Sie das Büro um Hilfe.'],
  confirmed: ['Localização confirmada.', 'Location confirmed.', 'Position confirmée.', 'Ubicación confirmada.', 'Standort bestätigt.'],
  old: ['Leituras antigas reconhecidas sem atualizar a posição atual. Obtenha uma leitura atual.', 'Older readings acknowledged without updating the current position. Get a current reading.', 'Anciens relevés reconnus sans modifier la position actuelle. Obtenez un relevé actuel.', 'Lecturas antiguas reconocidas sin actualizar la posición actual. Obtenga una lectura actual.', 'Ältere Messungen bestätigt, ohne die aktuelle Position zu ändern. Erfassen Sie eine aktuelle Messung.'],
  nothing: ['Não há envios GPS pendentes nesta conta.', 'There are no pending GPS sends for this account.', 'Aucun envoi GPS en attente pour ce compte.', 'No hay envíos GPS pendientes en esta cuenta.', 'Für dieses Konto sind keine GPS-Sendungen ausstehend.'],
  session: ['A sessão mudou. Reabra o GPS com a sua conta; os pontos guardados foram preservados.', 'The session changed. Reopen GPS with your account; saved points were preserved.', 'La session a changé. Rouvrez le GPS avec votre compte ; les points enregistrés ont été conservés.', 'La sesión ha cambiado. Vuelva a abrir el GPS con su cuenta; los puntos guardados se han conservado.', 'Die Sitzung hat sich geändert. Öffnen Sie GPS erneut mit Ihrem Konto; gespeicherte Punkte bleiben erhalten.'],
  unsupported: ['GPS não suportado neste dispositivo.', 'GPS is not supported on this device.', 'GPS non pris en charge sur cet appareil.', 'GPS no compatible con este dispositivo.', 'GPS wird auf diesem Gerät nicht unterstützt.'],
  permission: ['GPS indisponível ou sem permissão.', 'GPS unavailable or permission denied.', 'GPS indisponible ou autorisation refusée.', 'GPS no disponible o permiso denegado.', 'GPS nicht verfügbar oder Berechtigung verweigert.'],
  fallback: ['GPS por confirmar. Os pontos guardados foram preservados.', 'GPS awaiting confirmation. Saved points were preserved.', 'GPS à confirmer. Les points enregistrés ont été conservés.', 'GPS por confirmar. Los puntos guardados se han conservado.', 'GPS-Bestätigung ausstehend. Gespeicherte Punkte bleiben erhalten.']
  };
  const presentations = new Map(), errors = new WeakMap();
  const spec = (key, params = {}) => Object.freeze({ key, params: Object.freeze({ ...params }) });
  function format(value) {
    const selected = languages.indexOf((document.documentElement?.lang || 'pt').toLowerCase().split('-')[0]), index = selected < 0 ? 0 : selected;
    if (value.key === 'time') return new Date(value.params.recordedAt).toLocaleTimeString(locales[index]);
    return (copy[value.key]?.[index] || '').replace(/\{(\w+)\}/g, (_, key) => String(value.params[key] ?? ''));
  }
  function bind(node, value) {
    if (!node) return;
    node.setAttribute?.('data-cw-no-i18n', '');
    const rendered = format(value); presentations.set(node, { value, rendered });
    if (node.textContent !== rendered) node.textContent = rendered;
  }
  function paint() {
    for (const [node, entry] of presentations) {
      if (node.isConnected === false || node.textContent !== entry.rendered) { presentations.delete(node); continue; }
      const rendered = format(entry.value); if (node.textContent !== rendered) node.textContent = rendered; entry.rendered = rendered;
    }
  }
  for (const node of document.querySelectorAll?.('[data-cw-gps-text]') || []) bind(node, spec(node.dataset.cwGpsText));
  window.addEventListener('cw-language-change', paint);
  let lastLanguage = document.documentElement?.lang || 'pt';
  if (document.documentElement && typeof MutationObserver === 'function') new MutationObserver(() => {
    const language = document.documentElement.lang;
    if (language !== lastLanguage) { lastLanguage = language; paint(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return Object.freeze({ spec, format, bind, clear: node => presentations.delete(node), errorCopy: error => errors.get(error),
    problem: (key, message) => { const error = Error(message); errors.set(error, spec(key)); return error; } });
})();
const gpsClient = window.CWGps;
const gpsPageSession = gpsClient.session();
const statusBox = document.getElementById('gpsStatus'), startBtn = document.getElementById('startBtn'), sendNowBtn = document.getElementById('sendNowBtn');
const syncKpi = document.getElementById('syncKpi'), accuracyKpi = document.getElementById('accuracyKpi'), lastKpi = document.getElementById('lastKpi');
let watching = false, acquiring = false, confirming = false, invalidated = false, lifecycle = 0;
function currentGpsSession() { return !invalidated && gpsClient.same(gpsPageSession); }
function setStatus(message, tone = '') { if (statusBox) { gpsText.clear(statusBox); window.CWGpsErrors?.clear(statusBox); statusBox.textContent = message; statusBox.dataset.tone = tone; } }
function setKpi(sync, accuracy = '—', last = '—') { gpsText.clear(syncKpi); gpsText.clear(lastKpi); if (syncKpi) syncKpi.textContent = sync; if (accuracyKpi) accuracyKpi.textContent = accuracy; if (lastKpi) lastKpi.textContent = last; }
function setStatusCopy(key, params = {}, tone = '') { const value = gpsText.spec(key, params); setStatus(gpsText.format(value), tone); gpsText.bind(statusBox, value); }
function setKpiCopy(key, accuracy = '—', recordedAt = null) { const value = gpsText.spec(key), time = recordedAt === null ? null : gpsText.spec('time', { recordedAt }); setKpi(gpsText.format(value), accuracy, time ? gpsText.format(time) : '—'); gpsText.bind(syncKpi, value); if (time) gpsText.bind(lastKpi, time); }
function controls() { if (startBtn) startBtn.disabled = watching || !currentGpsSession(); if (sendNowBtn) sendNowBtn.disabled = acquiring || !currentGpsSession(); const retry = document.getElementById('gpsRetryBtn'); if (retry) retry.disabled = confirming || !currentGpsSession(); }
function reportGps(result) {
  if (!currentGpsSession()) return;
  if (result.unattributed) { setKpiCopy('reviewing'); setStatusCopy('history'); }
  else if (result.pending || result.offline || result.busy) { setKpiCopy('pending'); setStatusCopy('pendingCount', { count: result.pending }); }
  else if (result.lastAcknowledgement?.outcome === 'RECORDED') { const point = result.lastAcknowledgement; setKpiCopy('synchronized', point.accuracy === null ? '—' : `${Math.round(point.accuracy)} m`, point.recordedAt); setStatusCopy('confirmed'); }
  else if (result.ignored) { setKpiCopy('updating'); setStatusCopy('old'); }
  else { setKpiCopy('empty'); setStatusCopy('nothing'); }
}
function gpsError(error) { if (currentGpsSession()) { setKpiCopy('pending'); const own = gpsText.errorCopy(error); if (own) setStatusCopy(own.key, own.params, 'error'); else if (!error.message) setStatusCopy('fallback', {}, 'error'); else { setStatus(error.message, 'error'); window.CWGpsErrors?.set(statusBox, error); } } }
async function sendPoint(position, captured = gpsPageSession, expectedLifecycle = lifecycle) {
  if (!currentGpsSession() || !gpsClient.same(captured)) return;
  const result = await gpsClient.send(position.coords.latitude, position.coords.longitude, { accuracy: position.coords.accuracy ?? null, recordedAt: new Date(position.timestamp).toISOString() }, captured);
  if (currentGpsSession() && expectedLifecycle === lifecycle) reportGps(result); return result;
}
function startTracking() {
  if (watching || !currentGpsSession() || !window.CristalAuth?.requireAuth('TECHNICIAN')) return;
  if (!navigator.geolocation) { gpsError(gpsText.problem('unsupported', 'GPS não suportado neste dispositivo.')); return; }
  watching = true; controls(); setStatusCopy('tracking');
  gpsClient.start({ onResult: reportGps, onError: gpsError });
}
function sendNow() {
  if (acquiring || !currentGpsSession() || !window.CristalAuth?.requireAuth('TECHNICIAN')) return;
  if (!navigator.geolocation) { gpsError(gpsText.problem('unsupported', 'GPS não suportado neste dispositivo.')); return; }
  acquiring = true; controls(); setStatusCopy('acquiring'); const captured = gpsPageSession, ownLifecycle = lifecycle;
  navigator.geolocation.getCurrentPosition(position => { if (!currentGpsSession() || ownLifecycle !== lifecycle) return; sendPoint(position, captured, ownLifecycle).catch(error => { if (ownLifecycle === lifecycle) gpsError(error); }).finally(() => { if (ownLifecycle === lifecycle) { acquiring = false; controls(); } }); }, () => { if (ownLifecycle !== lifecycle) return; acquiring = false; controls(); gpsError(gpsText.problem('permission', 'GPS indisponível ou sem permissão.')); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
}
async function confirmGps() {
  if (confirming || !currentGpsSession()) return;
  confirming = true; controls(); setStatusCopy('confirming');
  const ownLifecycle = lifecycle;
  try { const result = await gpsClient.flush(gpsPageSession); if (ownLifecycle === lifecycle) reportGps(result); } catch (error) { if (ownLifecycle === lifecycle) gpsError(error); } finally { if (ownLifecycle === lifecycle) { confirming = false; controls(); } }
}
function checkGpsSession() {
  if (currentGpsSession() || invalidated) return;
  invalidated = true; gpsClient.stop(); setKpiCopy('changed'); setStatusCopy('session'); controls();
}
startBtn?.addEventListener('click', startTracking); sendNowBtn?.addEventListener('click', sendNow); document.getElementById('gpsRetryBtn')?.addEventListener('click', confirmGps);
window.addEventListener('cw:session-change', checkGpsSession);
window.addEventListener('storage', checkGpsSession); window.addEventListener('focus', checkGpsSession); setInterval(checkGpsSession, 500);
window.addEventListener('pagehide', () => { lifecycle++; watching = acquiring = confirming = false; gpsClient.stop(); });
window.addEventListener('pageshow', () => { checkGpsSession(); controls(); });
if (window.CristalAuth?.requireAuth('TECHNICIAN')) { if (currentGpsSession()) { try { const state = gpsClient.status(gpsPageSession); if (state.pending || state.unattributed) reportGps(state); else { setStatusCopy('ready'); setKpiCopy('waiting'); } } catch (error) { gpsError(error); } } else checkGpsSession(); controls(); }
