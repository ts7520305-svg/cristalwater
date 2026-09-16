// Compatibility entry point; all GPS sends use the durable account queue.
(function () {
  'use strict';
  function status(message) { const node = document.getElementById('gpsStatus'); if (node) node.textContent = message; }
  const ready = window.CWGps ? Promise.resolve() : new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/js/offline/offline-gps.js'; script.onload = resolve; script.onerror = () => reject(Error('Não foi possível carregar o GPS.')); document.head.append(script); });
  function result(value) { status(value.pending || value.offline || value.busy ? 'GPS guardado; por confirmar.' : value.unattributed ? 'Pontos antigos por rever.' : value.ignored ? 'Leitura antiga reconhecida; obtenha uma posição atual.' : 'Localização confirmada.'); }
  window.startTracking = async () => { try { await ready; if (!window.CWGps.session()) throw Error('Entre com a conta do técnico para iniciar o GPS.'); window.CWGps.start({ onResult: result, onError: error => status(error.message) }); } catch (error) { status(error.message); } };
  window.sendNow = async () => {
    await ready; const captured = window.CWGps.session();
    if (!captured || !navigator.geolocation) { status('GPS indisponível. Confirme a sessão e a permissão.'); return; }
    navigator.geolocation.getCurrentPosition(position => { if (!window.CWGps.same(captured)) return; window.CWGps.send(position.coords.latitude, position.coords.longitude, { accuracy: position.coords.accuracy, recordedAt: position.timestamp }, captured).then(value => { if (window.CWGps.same(captured)) result(value); }).catch(error => { if (window.CWGps.same(captured)) status(error.message); }); }, () => { if (window.CWGps.same(captured)) status('GPS indisponível ou sem permissão.'); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  };
  void window.startTracking();
})();
