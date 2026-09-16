(function () {
  'use strict';
  const store = window.CWFieldWriteStore, captured = store.session();
  const trigger = document.getElementById('optimizeRouteBtn');
  if (!trigger) return;
  let revision = 0, controller = null, busy = false, closed = false;
  const panel = document.createElement('section'); panel.id = 'fieldRoutePreview'; panel.className = 'card'; panel.hidden = true;
  panel.innerHTML = '<h2>Sugestão por proximidade</h2><p>Visitas planeadas ainda não iniciadas. Distâncias em linha reta, sem trânsito nem horários. A ordem planeada e a visita em curso mantêm-se.</p><label>Dia <input id="routePreviewDate" type="date"></label><p id="routePreviewStatus" role="status" data-cw-state-managed="manual"></p><ol id="routePreviewList"></ol><button id="routePreviewRefresh" type="button">Calcular com a posição atual</button><button id="routePreviewClose" type="button">Fechar sugestão</button>';
  document.getElementById('list').before(panel);
  const date = panel.querySelector('#routePreviewDate'), status = panel.querySelector('#routePreviewStatus'), list = panel.querySelector('#routePreviewList'), refresh = panel.querySelector('#routePreviewRefresh');
  const now = new Date(); date.value = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  date.style.cssText = 'display:block;max-width:100%;min-height:44px;color:inherit;background:inherit;padding:8px';
  for (const button of panel.querySelectorAll('button')) button.style.cssText = 'min-height:44px;white-space:normal;margin:8px 0';
  const active = () => !closed && store.same(captured);
  const validCoordinate = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
  const coordinates = row => validCoordinate(row.pool?.latitude, 90) && validCoordinate(row.pool?.longitude, 180);
  const current = (ticket, day) => active() && ticket === revision && date.value === day;
  function invalidate(message = '') {
    ++revision; controller?.abort(); controller = null; busy = false; list.replaceChildren(); status.textContent = message;
    trigger.disabled = !active(); refresh.disabled = !active(); date.disabled = !active();
  }
  function position() {
    if (!navigator.geolocation?.getCurrentPosition) return Promise.reject(Error('Localização indisponível neste dispositivo.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Não foi possível obter a posição atual. Tente novamente.')), 12000);
      const fail = error => { clearTimeout(timer); reject(Error(error?.code === 1 ? 'Permita o acesso à localização para calcular a sugestão.' : 'Não foi possível obter a posição atual. Tente novamente.')); };
      navigator.geolocation.getCurrentPosition(value => {
        clearTimeout(timer);
        if (!validCoordinate(value.coords?.latitude, 90) || !validCoordinate(value.coords?.longitude, 180) || !Number.isFinite(value.timestamp) || Math.abs(Date.now() - value.timestamp) > 60000) return reject(Error('A posição recebida é inválida ou antiga. Tente novamente.'));
        resolve(value);
      }, fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
  }
  async function open() {
    if (busy) return;
    panel.hidden = false; panel.scrollIntoView({ block: 'start' });
    invalidate();
    if (!active()) { status.textContent = 'A sessão mudou. Reabra a página com a conta atual.'; return; }
    const day = date.value, ticket = revision;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { status.textContent = 'Escolha o dia da rota.'; return; }
    if (!navigator.onLine) { status.textContent = 'Ligue à rede para consultar as visitas atuais antes de calcular.'; return; }
    busy = true; trigger.disabled = true; refresh.disabled = true; status.textContent = 'A obter a posição atual…';
    let timer, check;
    try {
      const location = await position(); if (!current(ticket, day)) return;
      controller = new AbortController(); const requestController = controller;
      timer = setTimeout(() => requestController.abort(), 20000);
      check = setInterval(() => { if (!current(ticket, day)) requestController.abort(); }, 250);
      status.textContent = 'A consultar as visitas do dia…';
      const query = new URLSearchParams({ date: day, lat: String(location.coords.latitude), lng: String(location.coords.longitude) });
      const response = await fetch('/api/route/optimize?' + query, { headers: { Authorization: 'Bearer ' + captured.token }, cache: 'no-store', signal: requestController.signal });
      const rows = await response.json(); if (!current(ticket, day)) return;
      if (response.status !== 200) throw Error(rows.error || 'Não foi possível consultar a rota. Tente novamente.');
      const ids = new Set();
      if (response.headers.get('X-CW-Route-Date') !== day || response.headers.get('X-CW-Route-Mode') !== 'proximity-preview' || response.headers.get('X-CW-Route-Technician') !== String(captured.technicianId) || !Array.isArray(rows) || rows.some(row => { if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || row.technicianId !== captured.technicianId || row.status !== 'PLANNED' || row.startAt || row.endAt) return true; ids.add(row.id); return false; })) throw Error('A resposta não corresponde ao dia e à conta pedidos. Volte a consultar.');
      const fragment = document.createDocumentFragment(); let unresolved = 0;
      for (const row of rows) {
        const item = document.createElement('li'); item.style.cssText = 'margin:16px 0;overflow-wrap:anywhere';
        const name = document.createElement('strong'); name.textContent = row.pool?.name || 'Visita ' + row.id; item.append(name);
        const info = document.createElement('p'); info.textContent = 'Visita ' + row.id + (row.client?.name ? ' · ' + row.client.name : ''); item.append(info);
        if (coordinates(row)) {
          const link = document.createElement('a'); link.textContent = 'Navegar até esta visita'; link.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(row.pool.latitude + ',' + row.pool.longitude); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.cssText = 'display:inline-block;min-height:44px;padding:10px 0'; item.append(link);
        } else { ++unresolved; const note = document.createElement('p'); note.textContent = 'Sem coordenadas válidas: confirme a morada com o escritório.'; item.append(note); }
        fragment.append(item);
      }
      list.replaceChildren(fragment);
      status.textContent = rows.length ? rows.length + ' visitas em ' + day + '. Consulta às ' + new Date().toLocaleTimeString('pt-PT') + (unresolved ? '. ' + unresolved + ' sem coordenadas, apresentadas no final.' : '.') : 'Sem visitas planeadas por iniciar para ' + day + '.';
    } catch (error) { if (current(ticket, day)) status.textContent = error.name === 'AbortError' ? 'Consulta interrompida. Tente novamente.' : error.message; }
    finally { clearTimeout(timer); clearInterval(check); if (ticket === revision) { busy = false; controller = null; trigger.disabled = !active(); refresh.disabled = !active(); } }
  }
  date.addEventListener('change', () => invalidate('Dia alterado. Calcule novamente com a posição atual.'));
  refresh.addEventListener('click', open);
  panel.querySelector('#routePreviewClose').addEventListener('click', () => { invalidate(); panel.hidden = true; trigger.focus(); });
  window.addEventListener('offline', () => invalidate('Sem ligação. Volte a consultar a rota quando recuperar a rede.'));
  window.addEventListener('storage', () => { if (!active()) invalidate('A sessão mudou. Reabra a página com a conta atual.'); });
  window.addEventListener('pagehide', () => { closed = true; invalidate(); });
  window.addEventListener('pageshow', () => { closed = false; if (!active()) invalidate('A sessão mudou. Reabra a página com a conta atual.'); else { trigger.disabled = false; refresh.disabled = false; date.disabled = false; } });
  setInterval(() => { if (!active()) invalidate('A sessão mudou. Reabra a página com a conta atual.'); }, 1000);
  window.CWFieldRoutePreview = { open };
})();
