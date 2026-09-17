(function () {
  'use strict';
  function start(mode) {
    const routeMode = mode === 'route', zonesMode = mode === 'zones', multiMode = mode === 'multi', list = document.getElementById('mapList'), status = document.getElementById('mapStatus'), notice = document.getElementById('mapNotice'), canvas = document.getElementById('map');
    const load = document.getElementById('mapLoad'), nearby = document.getElementById('mapNearby'), date = document.getElementById('mapDate'), tech = document.getElementById('mapTechnician');
    const showZones = document.getElementById('mapZonesShow'), hideZones = document.getElementById('mapZonesHide'), zoneSummary = document.getElementById('mapZonesSummary');
    const zoneNames = ['Sudoeste', 'Sudeste', 'Noroeste', 'Nordeste'];
    const keys = ['cristalwater_jwt','token','cristalwater_user','user'];
    const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
    let identity = '', credential = '', invalid = false, sequence = 0, request, map, layers, confirmedRows = [], zonesVisible = false, multiRows = [];
    try { identity = fingerprint(); credential = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || ''; } catch (_) {}
    function state(kind, text) { status.dataset.state = kind; status.textContent = text; }
    function clear() {
      confirmedRows = []; zonesVisible = false; list.replaceChildren(); if (layers) layers.clearLayers();
      if (zoneSummary) { zoneSummary.replaceChildren(); zoneSummary.hidden = true; }
      showZones?.setAttribute('aria-expanded', 'false');
      if (multiMode) { multiRows = []; tech.replaceChildren(); tech.disabled = true; }
    }
    function busy(value) {
      list.setAttribute('aria-busy', String(value)); load.disabled = value || invalid; if (nearby) nearby.disabled = value || invalid;
      if (showZones) showZones.disabled = value || invalid || !confirmedRows.some(row => row.point);
      if (hideZones) hideZones.disabled = value || invalid || !zonesVisible;
    }
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
    function initializeMap() { try {
      if (!window.L) fallback();
      else {
        canvas.hidden = false;
        map = L.map(canvas).setView([37.1, -8.6], 10); layers = L.layerGroup().addTo(map);
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' });
        tiles.on('tileerror', fallback); tiles.addTo(map);
        notice.textContent = 'Os pontos com coordenadas confirmadas aparecem também no mapa.'; notice.dataset.state = 'ready';
      }
    } catch (_) { fallback(); } }
    initializeMap();
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
      const controller = new AbortController(); let timedOut = false;
      const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      const timer = setTimeout(() => { timedOut = true; abort(); }, 20000);
      try {
        const response = await fetch(url, { headers: { Authorization: 'Bearer '+credential }, cache: 'no-store', signal: controller.signal });
        if (response.status !== 200) throw Error('Não foi possível confirmar os dados. Use Atualizar para tentar novamente.');
        return { response, data: await response.json() };
      } catch (error) { if (timedOut) throw Error('A consulta demorou demasiado. Use Atualizar para tentar novamente.'); throw error; }
      finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }
    function renderZones(rows) {
      if (!zonesMode || !zoneSummary) return null;
      zoneSummary.replaceChildren(); zoneSummary.hidden = !zonesVisible;
      showZones.setAttribute('aria-expanded', String(zonesVisible));
      if (!zonesVisible) return null;
      const located = rows.filter(row => row.point);
      if (!located.length) return null;
      const bounds = located.reduce((b, row) => ({
        south: Math.min(b.south, row.point[0]), north: Math.max(b.north, row.point[0]),
        west: Math.min(b.west, row.point[1]), east: Math.max(b.east, row.point[1])
      }), { south: 90, north: -90, west: 180, east: -180 });
      const midLat = (bounds.south+bounds.north)/2, midLng = (bounds.west+bounds.east)/2;
      // Midline points belong to the south/west half exactly once.
      const zoneFor = point => (point[0] > midLat ? 2 : 0) + (point[1] > midLng ? 1 : 0);
      const counts = [0,0,0,0]; located.forEach(row => counts[zoneFor(row.point)]++);
      const heading = document.createElement('h2'), description = document.createElement('p'), summary = document.createElement('ul');
      heading.textContent = 'Pré-visualização de áreas';
      description.textContent = 'Divisão em quatro partes pelos pontos médios das coordenadas. '+located.length+' piscinas localizadas; '+(rows.length-located.length)+' sem coordenadas válidas ficam fora da divisão. Não cria zonas nem atribui técnicos. Não considera estradas, tempo de trabalho ou disponibilidade.';
      for (const [index, name] of zoneNames.entries()) {
        const item = document.createElement('li'); item.dataset.zone = index; item.dataset.count = counts[index]; item.textContent = name+': '+counts[index]+' piscinas'; summary.append(item);
        const south = index < 2 ? bounds.south : midLat, north = index < 2 ? midLat : bounds.north;
        const west = index % 2 === 0 ? bounds.west : midLng, east = index % 2 === 0 ? midLng : bounds.east;
        if (map && layers && south < north && west < east) {
          try { const popup = document.createElement('span'); popup.textContent = item.textContent; L.rectangle([[south,west],[north,east]], { color: '#147ca8', weight: 2, fillOpacity: 0.08 }).bindPopup(popup).addTo(layers); }
          catch (_) { fallback(); }
        }
      }
      zoneSummary.append(heading, description, summary);
      return zoneFor;
    }
    function render(rows) {
      confirmedRows = rows;
      list.replaceChildren(); if (layers) layers.clearLayers();
      const zoneFor = renderZones(rows);
      const points = [];
      for (const [index, row] of rows.entries()) {
        const article = document.createElement('article'), title = document.createElement('h2'), details = document.createElement('p'), links = document.createElement('div');
        article.dataset.recordId = row.id; title.textContent = (routeMode ? (index+1)+'. ' : '') + row.name;
        if (multiMode) {
          article.dataset.technicianId = row.technicianId ?? 'unassigned';
          title.textContent = row.name+' · '+row.visitLabel+' #'+row.visitId;
          const assignment = document.createElement('p'); assignment.textContent = row.technicianLabel+' · '+row.statusLabel; article.append(assignment);
        }
        details.textContent = row.point ? (row.distance == null ? 'Coordenadas: ' + row.point.join(', ') : row.distance.toFixed(2)+' km em linha reta') : 'Sem coordenadas válidas. Confirme a localização na ficha da piscina.';
        if (zoneFor && row.point) { article.dataset.zone = zoneFor(row.point); details.textContent += ' · Área: '+zoneNames[zoneFor(row.point)]; }
        article.append(title, details);
        if (row.point) {
          const coordinates = row.point.join(',');
          for (const [label, url] of [['Google Maps','https://www.google.com/maps?q='+coordinates], ['Waze','https://waze.com/ul?ll='+coordinates+'&navigate=yes']]) {
            const link = document.createElement('a'); link.textContent = label; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.addEventListener('click', event => { if (!active()) event.preventDefault(); }); links.append(link);
          }
          points.push(row.point); article.append(links);
          if (map && layers) {
            try { const popup = document.createElement('span'); popup.textContent = title.textContent+(multiMode ? ' · '+row.technicianLabel+' · '+row.statusLabel : ''); L.marker(row.point).bindPopup(popup).addTo(layers); }
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
    function showTechnician() {
      if (!active()) return;
      const selected = tech.value;
      const rows = selected === 'all' ? multiRows : multiRows.filter(row => String(row.technicianId ?? 'unassigned') === selected);
      render(rows);
      state(rows.length ? 'ready' : 'empty', multiRows.length ? rows.length+' de '+multiRows.length+' visitas do dia · '+rows.filter(row => !row.point).length+' sem coordenadas válidas nesta seleção.' : 'Sem visitas operacionais para este dia.');
    }
    function multiVisitRows(data, chosenDate) {
      if (data?.ok !== true || data.date !== chosenDate || data.technicianId !== null || data.complete !== true || data.hasMore !== false || data.nextOffset !== null || data.offset !== 0 || !Array.isArray(data.visits) || data.total !== data.visits.length || data.returned !== data.visits.length) throw Error('A resposta não confirma a lista completa deste dia. Atualize para tentar novamente.');
      const names = new Map(), statusNames = { PLANNED: 'Planeada', IN_PROGRESS: 'Em curso', DONE: 'Concluída', COMPLETED: 'Concluída', INCOMPLETE: 'Incompleta' };
      return data.visits.map(v => {
        const technicianId = v?.technician?.id;
        if (!v || !validId(v.id) || !['REGULAR','EXTRA'].includes(v.visitType) || typeof v.status !== 'string' || !v.status || (technicianId !== null && !validId(technicianId)) || typeof v.technician?.name !== 'string' || !v.pool || (v.pool.id != null && !validId(v.pool.id)) || typeof v.pool.name !== 'string' || (v.visitType === 'EXTRA' && (v.extraVisitId !== v.id || v.technicianId !== technicianId))) throw Error('A resposta contém visitas sem identidade confirmada. Atualize para tentar novamente.');
        if (technicianId !== null && names.has(technicianId) && names.get(technicianId) !== v.technician.name) throw Error('A resposta contém técnicos contraditórios. Atualize para tentar novamente.');
        names.set(technicianId, v.technician.name);
        return { id: v.visitType+':'+v.id, visitId: v.id, visitLabel: v.visitType === 'EXTRA' ? 'Extra' : 'Regular', name: v.pool.id ? (v.pool.name && v.pool.name !== '-' ? v.pool.name : 'Piscina #'+v.pool.id) : 'Visita sem piscina associada', point: v.pool.id ? point(v.pool) : null, technicianId, technicianLabel: technicianId === null ? 'Sem técnico atribuído' : (v.technician.name || 'Técnico')+' · #'+technicianId, statusLabel: statusNames[v.status] || v.status };
      });
    }
    async function query(proximity = false) {
      if (!active()) return;
      const current = ++sequence; request?.abort(); request = new AbortController();
      const chosenDate = date?.value, chosenTech = tech?.value;
      clear(); busy(true); state('loading', proximity || routeMode ? 'A obter localização atual…' : multiMode ? 'A carregar visitas…' : 'A carregar piscinas…');
      const currentQuery = () => active() && current === sequence;
      try {
        if (routeMode && (!date.checkValidity() || !chosenDate || !/^[1-9]\d*$/.test(chosenTech || ''))) throw Error('Escolha uma data válida e um técnico.');
        if (multiMode && (!date.checkValidity() || !chosenDate)) throw Error('Escolha uma data válida.');
        const origin = proximity || routeMode ? await position() : null;
        if (!currentQuery()) return;
        const url = routeMode ? '/api/route/optimize?'+new URLSearchParams({ lat: origin[0], lng: origin[1], date: chosenDate, technicianId: chosenTech }) : multiMode ? '/api/technician/today?'+new URLSearchParams({ date: chosenDate }) : '/api/pools';
        state('loading', 'A confirmar os dados…');
        const { response, data } = await json(url, request.signal); if (!currentQuery()) return;
        let rows;
        if (routeMode) {
          if (response.headers.get('X-CW-Route-Date') !== chosenDate || response.headers.get('X-CW-Route-Technician') !== chosenTech || response.headers.get('X-CW-Route-Mode') !== 'proximity-preview' || !Array.isArray(data) || !data.every(v => v && validId(v.id) && v.technicianId === Number(chosenTech) && v.status === 'PLANNED' && !v.startAt && !v.endAt && (v.pool === null || (v.pool && validId(v.pool.id) && (v.pool.name === null || typeof v.pool.name === 'string'))))) throw Error('A resposta não confirma a seleção. Atualize para tentar novamente.');
          rows = data.map(v => ({ id: v.id, name: v.pool ? v.pool.name || 'Piscina #'+v.pool.id : 'Visita sem piscina associada', point: point(v.pool) }));
        } else if (multiMode) {
          rows = multiVisitRows(data, chosenDate);
        } else {
          if (data?.ok !== true || !Array.isArray(data.pools) || !data.pools.every(p => p && validId(p.id) && (p.name === null || typeof p.name === 'string'))) throw Error('A resposta de piscinas está incompleta. Atualize para tentar novamente.');
          rows = data.pools.map(p => ({ id: p.id, name: p.name || 'Piscina #'+p.id, point: point(p) }));
          if (origin) { rows.forEach(row => { row.distance = row.point ? distance(origin, row.point) : null; }); rows.sort((a,b) => (a.distance ?? Infinity)-(b.distance ?? Infinity) || a.id-b.id); }
        }
        if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error('A resposta contém registos repetidos. Atualize para tentar novamente.');
        if (multiMode) {
          multiRows = rows; tech.add(new Option('Todos os técnicos', 'all'));
          const technicians = new Map(rows.map(row => [row.technicianId ?? 'unassigned', row.technicianLabel]));
          for (const [id, name] of technicians) tech.add(new Option(name, String(id)));
          tech.disabled = false; showTechnician(); return;
        }
        render(rows);
        const missing = rows.filter(row => !row.point).length;
        state(rows.length ? 'ready' : 'empty', rows.length ? rows.length+' '+(routeMode ? 'visitas planeadas' : 'piscinas')+' · '+missing+' sem coordenadas válidas.' : routeMode ? 'Sem visitas regulares planeadas para este técnico e dia.' : 'Sem piscinas ativas.');
      } catch (error) { if (currentQuery()) { clear(); state('error', error instanceof SyntaxError ? 'Resposta inválida. Atualize para tentar novamente.' : error.message || 'Consulta não confirmada. Tente novamente.'); } }
      finally { if (currentQuery()) busy(false); }
    }
    load.addEventListener('click', () => query(false)); nearby?.addEventListener('click', () => query(true));
    showZones?.addEventListener('click', () => { if (!active() || !confirmedRows.some(row => row.point)) return; zonesVisible = true; render(confirmedRows); busy(false); });
    hideZones?.addEventListener('click', () => { if (!active()) return; zonesVisible = false; render(confirmedRows); busy(false); });
    window.addEventListener('storage', active); window.addEventListener('focus', active); setInterval(active,500);
    if (routeMode || multiMode) {
      const now = new Date(); date.value = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      date.addEventListener('input', changed);
    }
    if (multiMode) { tech.addEventListener('change', showTechnician); void query(); }
    else if (routeMode) {
      tech.addEventListener('change', changed);
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
    // Optional third-party assets must never block the page's own scripts or
    // its operational query. Only build the map when both assets are ready.
    if (!window.L) {
      let cssReady = false, jsReady = false;
      const ready = () => {
        if (!cssReady || !jsReady || !active()) return;
        initializeMap(); render(confirmedRows);
      };
      const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
      stylesheet.addEventListener('load', () => { cssReady = true; ready(); }); stylesheet.addEventListener('error', fallback);
      const library = document.createElement('script'); library.async = true; library.src = 'https://unpkg.com/leaflet/dist/leaflet.js';
      library.addEventListener('load', () => { jsReady = true; ready(); }); library.addEventListener('error', fallback);
      document.head.append(stylesheet, library);
    }
  }
  window.CWAdminMap = { start };
})();
