(function () {
  'use strict';
  function start(mode) {
    const routeMode = mode === 'route', list = document.getElementById('mapList'), status = document.getElementById('mapStatus'), notice = document.getElementById('mapNotice'), canvas = document.getElementById('map');
    const load = document.getElementById('mapLoad'), nearby = document.getElementById('mapNearby'), date = document.getElementById('mapDate'), tech = document.getElementById('mapTechnician');
    const keys = ['cristalwater_jwt','token','cristalwater_user','user'];
    const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
    let identity = '', credential = '', invalid = false, sequence = 0, request, map, layers;
    try { identity = fingerprint(); credential = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || ''; } catch (_) {}
    function state(kind, text) { status.dataset.state = kind; status.textContent = text; }
    function clear() { list.replaceChildren(); if (layers) layers.clearLayers(); }
    function busy(value) { list.setAttribute('aria-busy', String(value)); load.disabled = value || invalid; if (nearby) nearby.disabled = value || invalid; }
    function active() {
      let same = false; try { same = !!credential && identity === fingerprint(); } catch (_) {}
      if (same && !invalid) return true;
      invalid = true; sequence++; request?.abort(); clear(); busy(false);
      if (map) { try { map.remove(); } catch (_) {} map = null; layers = null; }
      canvas.hidden = true; notice.textContent = '';
      if (tech) { tech.replaceChildren(); tech.disabled = true; } if (date) date.disabled = true;
      state('session', 'A sessão mudou. Reabra a página com a conta pretendida.'); return false;
    }
    function fallback() {
      try { map?.remove(); } catch (_) {}
      map = null; layers = null; canvas.hidden = true;
      notice.textContent = 'Mapa indisponível. Consulte a lista e abra a navegação de cada piscina.';
      notice.dataset.state = 'unavailable';
    }
    try {
      if (!window.L) fallback();
      else {
        map = L.map(canvas).setView([37.1, -8.6], 10); layers = L.layerGroup().addTo(map);
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' });
        tiles.on('tileerror', fallback); tiles.addTo(map);
        notice.textContent = 'Os pontos com coordenadas confirmadas aparecem também no mapa.'; notice.dataset.state = 'ready';
      }
    } catch (_) { fallback(); }
    window.addEventListener('cw:navigation-ready', () => map?.invalidateSize());
    window.addEventListener('resize', () => map?.invalidateSize());
    const validId = value => Number.isSafeInteger(value) && value > 0;
    function point(pool) {
      const coord = (value, max) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max;
      return coord(pool?.latitude, 90) && coord(pool?.longitude, 180) ? [pool.latitude, pool.longitude] : null;
    }
    function distance(a, b) {
      const radians = n => n * Math.PI / 180;
      const h = Math.sin(radians(b[0]-a[0])/2)**2 + Math.cos(radians(a[0]))*Math.cos(radians(b[0]))*Math.sin(radians(b[1]-a[1])/2)**2;
      return 6371 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
    }
    function position() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(Error('Este dispositivo não disponibiliza localização.'));
        const timer = setTimeout(() => reject(Error('Não foi possível obter a localização. Autorize o GPS e tente novamente.')), 10000);
        navigator.geolocation.getCurrentPosition(pos => {
          clearTimeout(timer);
          const result = point({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          if (!result || !Number.isFinite(pos.timestamp) || Math.abs(Date.now()-pos.timestamp) > 60000) return reject(Error('A localização recebida não é atual ou válida. Tente novamente.'));
          resolve(result);
        }, () => { clearTimeout(timer); reject(Error('Não foi possível obter a localização. Autorize o GPS e tente novamente.')); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 });
      });
    }
    async function json(url, signal) {
      const response = await fetch(url, { headers: { Authorization: 'Bearer '+credential }, cache: 'no-store', signal });
      if (response.status !== 200) throw Error('Não foi possível confirmar os dados. Use Atualizar para tentar novamente.');
      return { response, data: await response.json() };
    }
    function render(rows) {
      const points = [];
      for (const [index, row] of rows.entries()) {
        const article = document.createElement('article'), title = document.createElement('h2'), details = document.createElement('p'), links = document.createElement('div');
        article.dataset.recordId = row.id; title.textContent = (routeMode ? (index+1)+'. ' : '') + row.name;
        details.textContent = row.point ? (row.distance == null ? 'Coordenadas: ' + row.point.join(', ') : row.distance.toFixed(2)+' km em linha reta') : 'Sem coordenadas válidas. Confirme a localização na ficha da piscina.';
        article.append(title, details);
        if (row.point) {
          const coordinates = row.point.join(',');
          for (const [label, url] of [['Google Maps','https://www.google.com/maps?q='+coordinates], ['Waze','https://waze.com/ul?ll='+coordinates+'&navigate=yes']]) {
            const link = document.createElement('a'); link.textContent = label; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.addEventListener('click', event => { if (!active()) event.preventDefault(); }); links.append(link);
          }
          points.push(row.point); article.append(links);
          if (map && layers) {
            try { const popup = document.createElement('span'); popup.textContent = title.textContent; L.marker(row.point).bindPopup(popup).addTo(layers); }
            catch (_) { fallback(); }
          }
        }
        list.append(article);
      }
      if (map && layers && points.length) {
        try {
          // Missing coordinates interrupt the preview line: never suggest a
          // complete route by silently connecting across an unresolved visit.
          if (routeMode && points.length === rows.length && points.length > 1) L.polyline(points, { color: '#147ca8' }).addTo(layers);
          map.fitBounds(points, { padding: [24,24], maxZoom: 15 });
        } catch (_) { fallback(); }
      }
    }
    function changed() {
      sequence++; request?.abort(); clear(); busy(false);
      if (active()) state('idle', 'A seleção mudou. Atualize para consultar os dados correspondentes.');
    }
    async function query(proximity = false) {
      if (!active()) return;
      const current = ++sequence; request?.abort(); request = new AbortController();
      const chosenDate = date?.value, chosenTech = tech?.value;
      clear(); busy(true); state('loading', proximity || routeMode ? 'A obter localização atual…' : 'A carregar piscinas…');
      const currentQuery = () => active() && current === sequence;
      try {
        if (routeMode && (!date.checkValidity() || !chosenDate || !/^[1-9]\d*$/.test(chosenTech || ''))) throw Error('Escolha uma data válida e um técnico.');
        const origin = proximity || routeMode ? await position() : null;
        if (!currentQuery()) return;
        const url = routeMode ? '/api/route/optimize?'+new URLSearchParams({ lat: origin[0], lng: origin[1], date: chosenDate, technicianId: chosenTech }) : '/api/pools';
        state('loading', 'A confirmar os dados…');
        const { response, data } = await json(url, request.signal); if (!currentQuery()) return;
        let rows;
        if (routeMode) {
          if (response.headers.get('X-CW-Route-Date') !== chosenDate || response.headers.get('X-CW-Route-Technician') !== chosenTech || response.headers.get('X-CW-Route-Mode') !== 'proximity-preview' || !Array.isArray(data) || !data.every(v => v && validId(v.id) && v.technicianId === Number(chosenTech) && v.status === 'PLANNED' && !v.startAt && !v.endAt && (v.pool === null || (v.pool && validId(v.pool.id) && (v.pool.name === null || typeof v.pool.name === 'string'))))) throw Error('A resposta não confirma a seleção. Atualize para tentar novamente.');
          rows = data.map(v => ({ id: v.id, name: v.pool ? v.pool.name || 'Piscina #'+v.pool.id : 'Visita sem piscina associada', point: point(v.pool) }));
        } else {
          if (data?.ok !== true || !Array.isArray(data.pools) || !data.pools.every(p => p && validId(p.id) && (p.name === null || typeof p.name === 'string'))) throw Error('A resposta de piscinas está incompleta. Atualize para tentar novamente.');
          rows = data.pools.map(p => ({ id: p.id, name: p.name || 'Piscina #'+p.id, point: point(p) }));
          if (origin) { rows.forEach(row => { row.distance = row.point ? distance(origin, row.point) : null; }); rows.sort((a,b) => (a.distance ?? Infinity)-(b.distance ?? Infinity) || a.id-b.id); }
        }
        if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error('A resposta contém registos repetidos. Atualize para tentar novamente.');
        render(rows);
        const missing = rows.filter(row => !row.point).length;
        state(rows.length ? 'ready' : 'empty', rows.length ? rows.length+' '+(routeMode ? 'visitas planeadas' : 'piscinas')+' · '+missing+' sem coordenadas válidas.' : routeMode ? 'Sem visitas regulares planeadas para este técnico e dia.' : 'Sem piscinas ativas.');
      } catch (error) { if (currentQuery()) { clear(); state('error', error instanceof SyntaxError ? 'Resposta inválida. Atualize para tentar novamente.' : error.message || 'Consulta não confirmada. Tente novamente.'); } }
      finally { if (currentQuery()) busy(false); }
    }
    load.addEventListener('click', () => query(false)); nearby?.addEventListener('click', () => query(true));
    window.addEventListener('storage', active); window.addEventListener('focus', active); setInterval(active,500);
    if (routeMode) {
      const now = new Date(); date.value = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      date.addEventListener('input', changed); tech.addEventListener('change', changed);
      const retry = document.getElementById('mapTechniciansReload');
      async function technicians() {
        if (!active()) return; changed(); retry.disabled = true; tech.disabled = true; tech.replaceChildren();
        try {
          const { data } = await json('/api/technicians'); if (!active()) return;
          if (!Array.isArray(data) || !data.every(t => t && validId(t.id) && typeof t.name === 'string') || new Set(data.map(t=>t.id)).size !== data.length) throw Error('invalid');
          const blank = new Option('Escolha o técnico', ''); tech.add(blank);
          for (const t of data) tech.add(new Option(t.name+' · #'+t.id+(t.active === false ? ' (inativo)' : ''), String(t.id)));
          state(data.length ? 'idle' : 'empty', data.length ? 'Escolha o técnico e atualize para obter uma sugestão por proximidade.' : 'Sem técnicos disponíveis.');
        } catch (_) { if (active()) state('error','Não foi possível carregar os técnicos. Use Atualizar técnicos.'); }
        finally { if (active()) { retry.disabled = false; tech.disabled = false; } }
      }
      retry.addEventListener('click', technicians); void technicians();
    } else void query();
  }
  window.CWAdminMap = { start };
})();
