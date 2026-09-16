const gpsClient = window.CWGps;
const gpsPageSession = gpsClient.session();
const statusBox = document.getElementById('gpsStatus'), startBtn = document.getElementById('startBtn'), sendNowBtn = document.getElementById('sendNowBtn');
const syncKpi = document.getElementById('syncKpi'), accuracyKpi = document.getElementById('accuracyKpi'), lastKpi = document.getElementById('lastKpi');
let watching = false, acquiring = false, confirming = false, invalidated = false, lifecycle = 0;
function currentGpsSession() { return !invalidated && gpsClient.same(gpsPageSession); }
function setStatus(message, tone = '') { if (statusBox) { statusBox.textContent = message; statusBox.dataset.tone = tone; } }
function setKpi(sync, accuracy = '—', last = '—') { if (syncKpi) syncKpi.textContent = sync; if (accuracyKpi) accuracyKpi.textContent = accuracy; if (lastKpi) lastKpi.textContent = last; }
function controls() { if (startBtn) startBtn.disabled = watching || !currentGpsSession(); if (sendNowBtn) sendNowBtn.disabled = acquiring || !currentGpsSession(); const retry = document.getElementById('gpsRetryBtn'); if (retry) retry.disabled = confirming || !currentGpsSession(); }
function reportGps(result) {
  if (!currentGpsSession()) return;
  if (result.unattributed) { setKpi('A rever'); setStatus('Existem pontos GPS antigos sem conta confirmada. Foram preservados; peça apoio ao escritório.'); }
  else if (result.pending || result.offline || result.busy) { setKpi('Por confirmar'); setStatus(`${result.pending} ponto(s) GPS guardado(s) neste dispositivo por confirmar.`); }
  else if (result.lastAcknowledgement?.outcome === 'RECORDED') { const point = result.lastAcknowledgement; setKpi('Sincronizado', point.accuracy === null ? '—' : `${Math.round(point.accuracy)} m`, new Date(point.recordedAt).toLocaleTimeString('pt-PT')); setStatus('Localização confirmada.'); }
  else if (result.ignored) { setKpi('A atualizar'); setStatus('Leituras antigas reconhecidas sem atualizar a posição atual. Obtenha uma leitura atual.'); }
  else { setKpi('Sem pendências'); setStatus('Não há envios GPS pendentes nesta conta.'); }
}
function gpsError(error) { if (currentGpsSession()) { setKpi('Por confirmar'); setStatus(error.message || 'GPS por confirmar. Os pontos guardados foram preservados.', 'error'); } }
async function sendPoint(position, captured = gpsPageSession, expectedLifecycle = lifecycle) {
  if (!currentGpsSession() || !gpsClient.same(captured)) return;
  const result = await gpsClient.send(position.coords.latitude, position.coords.longitude, { accuracy: position.coords.accuracy ?? null, recordedAt: new Date(position.timestamp).toISOString() }, captured);
  if (currentGpsSession() && expectedLifecycle === lifecycle) reportGps(result); return result;
}
function startTracking() {
  if (watching || !currentGpsSession() || !window.CristalAuth?.requireAuth('TECHNICIAN')) return;
  if (!navigator.geolocation) { gpsError(Error('GPS não suportado neste dispositivo.')); return; }
  watching = true; controls(); setStatus('A obter leituras GPS. Os pontos são guardados antes do envio.');
  gpsClient.start({ onResult: reportGps, onError: gpsError });
}
function sendNow() {
  if (acquiring || !currentGpsSession() || !window.CristalAuth?.requireAuth('TECHNICIAN')) return;
  if (!navigator.geolocation) { gpsError(Error('GPS não suportado neste dispositivo.')); return; }
  acquiring = true; controls(); setStatus('A obter ponto atual.'); const captured = gpsPageSession, ownLifecycle = lifecycle;
  navigator.geolocation.getCurrentPosition(position => { if (!currentGpsSession() || ownLifecycle !== lifecycle) return; sendPoint(position, captured, ownLifecycle).catch(error => { if (ownLifecycle === lifecycle) gpsError(error); }).finally(() => { if (ownLifecycle === lifecycle) { acquiring = false; controls(); } }); }, () => { if (ownLifecycle !== lifecycle) return; acquiring = false; controls(); gpsError(Error('GPS indisponível ou sem permissão.')); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
}
async function confirmGps() {
  if (confirming || !currentGpsSession()) return;
  confirming = true; controls(); setStatus('A confirmar pontos guardados…');
  const ownLifecycle = lifecycle;
  try { const result = await gpsClient.flush(gpsPageSession); if (ownLifecycle === lifecycle) reportGps(result); } catch (error) { if (ownLifecycle === lifecycle) gpsError(error); } finally { if (ownLifecycle === lifecycle) { confirming = false; controls(); } }
}
function checkGpsSession() {
  if (currentGpsSession() || invalidated) return;
  invalidated = true; gpsClient.stop(); setKpi('Sessão alterada'); setStatus('A sessão mudou. Reabra o GPS com a sua conta; os pontos guardados foram preservados.'); controls();
}
startBtn?.addEventListener('click', startTracking); sendNowBtn?.addEventListener('click', sendNow); document.getElementById('gpsRetryBtn')?.addEventListener('click', confirmGps);
window.addEventListener('storage', checkGpsSession); window.addEventListener('focus', checkGpsSession); setInterval(checkGpsSession, 500);
window.addEventListener('pagehide', () => { lifecycle++; watching = acquiring = confirming = false; gpsClient.stop(); });
window.addEventListener('pageshow', () => { checkGpsSession(); controls(); });
if (window.CristalAuth?.requireAuth('TECHNICIAN')) { if (currentGpsSession()) { try { const state = gpsClient.status(gpsPageSession); if (state.pending || state.unattributed) reportGps(state); else { setStatus('Pronto para iniciar GPS.'); setKpi('Em espera'); } } catch (error) { gpsError(error); } } else checkGpsSession(); controls(); }
