(function () {
  'use strict';
  const store = window.CWFieldWriteStore, captured = store.session();
  const trigger = document.getElementById('optimizeRouteBtn');
  if (!trigger) return;
  const copy = window.CWLegacyTechnicianCopy;
  let revision = 0, controller = null, busy = false, closed = false;
  const panel = document.createElement('section'); panel.id = 'fieldRoutePreview'; panel.className = 'card'; panel.hidden = true;
  panel.innerHTML = '<h2>' + copy.span('previewTitle') + '</h2><p>' + copy.span('previewIntro') + '</p><label>' + copy.span('previewDay') + ' <input id="routePreviewDate" type="date"></label><p id="routePreviewStatus" role="status" data-cw-state-managed="manual"></p><ol id="routePreviewList"></ol><button id="routePreviewRefresh" type="button" ' + copy.mark('previewRefresh') + '></button><button id="routePreviewClose" type="button" ' + copy.mark('previewClose') + '></button>';
  copy.apply(panel);
  document.getElementById('list').before(panel);
  const date = panel.querySelector('#routePreviewDate'), status = panel.querySelector('#routePreviewStatus'), list = panel.querySelector('#routePreviewList'), refresh = panel.querySelector('#routePreviewRefresh');
  const now = new Date(); date.value = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  date.style.cssText = 'display:block;max-width:100%;min-height:44px;color:inherit;background:inherit;padding:8px';
  for (const button of panel.querySelectorAll('button')) button.style.cssText = 'min-height:44px;white-space:normal;margin:8px 0';
  const active = () => !closed && store.same(captured);
  const validCoordinate = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
  const coordinates = row => validCoordinate(row.pool?.latitude, 90) && validCoordinate(row.pool?.longitude, 180);
  const current = (ticket, day) => active() && ticket === revision && date.value === day;
  function invalidate(message = copy.spec('literal', { text: '' })) {
    ++revision; controller?.abort(); controller = null; busy = false; list.replaceChildren(); copy.set(status, message);
    trigger.disabled = !active(); refresh.disabled = !active(); date.disabled = !active();
  }
  function position() {
    if (!navigator.geolocation?.getCurrentPosition) return Promise.reject(copy.error('previewNoLocation'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(copy.error('previewPositionFailed')), 12000);
      const fail = error => { clearTimeout(timer); reject(copy.error(error?.code === 1 ? 'previewPermission' : 'previewPositionFailed')); };
      navigator.geolocation.getCurrentPosition(value => {
        clearTimeout(timer);
        if (!validCoordinate(value.coords?.latitude, 90) || !validCoordinate(value.coords?.longitude, 180) || !Number.isFinite(value.timestamp) || Math.abs(Date.now() - value.timestamp) > 60000) return reject(copy.error('previewPositionInvalid'));
        resolve(value);
      }, fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
  }
  async function open() {
    if (busy) return;
    panel.hidden = false; panel.scrollIntoView({ block: 'start' });
    invalidate();
    if (!active()) { copy.set(status, 'daySession'); return; }
    const day = date.value, ticket = revision;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { copy.set(status, 'previewChooseDay'); return; }
    if (!navigator.onLine) { copy.set(status, 'previewConnect'); return; }
    busy = true; trigger.disabled = true; refresh.disabled = true; copy.set(status, 'previewLocating');
    let timer, check;
    try {
      const location = await position(); if (!current(ticket, day)) return;
      controller = new AbortController(); const requestController = controller;
      timer = setTimeout(() => requestController.abort(), 20000);
      check = setInterval(() => { if (!current(ticket, day)) requestController.abort(); }, 250);
      copy.set(status, 'previewLoading');
      const query = new URLSearchParams({ date: day, lat: String(location.coords.latitude), lng: String(location.coords.longitude) });
      const response = await fetch('/api/route/optimize?' + query, { headers: { Authorization: 'Bearer ' + captured.token }, cache: 'no-store', signal: requestController.signal });
      const rows = await response.json(); if (!current(ticket, day)) return;
      if (response.status !== 200) throw rows.error ? Error(rows.error) : copy.error('previewFailed');
      const ids = new Set();
      if (response.headers.get('X-CW-Route-Date') !== day || response.headers.get('X-CW-Route-Mode') !== 'proximity-preview' || response.headers.get('X-CW-Route-Technician') !== String(captured.technicianId) || !Array.isArray(rows) || rows.some(row => { if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || row.technicianId !== captured.technicianId || row.status !== 'PLANNED' || row.startAt || row.endAt) return true; ids.add(row.id); return false; })) throw copy.error('previewMismatch');
      const fragment = document.createDocumentFragment(); let unresolved = 0;
      for (const row of rows) {
        const item = document.createElement('li'); item.style.cssText = 'margin:16px 0;overflow-wrap:anywhere';
        const name = document.createElement('strong'); if (row.pool?.name) name.textContent = row.pool.name; else copy.set(name, 'previewVisit', { id: row.id }); item.append(name);
        const info = document.createElement('p'); copy.set(info, 'joined', { parts: [copy.spec('previewVisit', { id: row.id }), row.client?.name ? ' · ' + row.client.name : ''] }); item.append(info);
        if (coordinates(row)) {
          const link = document.createElement('a'); copy.set(link, 'previewNavigate'); link.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(row.pool.latitude + ',' + row.pool.longitude); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.cssText = 'display:inline-block;min-height:44px;padding:10px 0'; item.append(link);
        } else { ++unresolved; const note = document.createElement('p'); copy.set(note, 'previewNoCoordinates'); item.append(note); }
        fragment.append(item);
      }
      list.replaceChildren(fragment);
      copy.set(status, rows.length ? (rows.length === 1 ? 'previewSummaryOne' : 'previewSummary') : 'previewEmpty', { count: rows.length, day, at: copy.spec('timeOnly', { iso: new Date().toISOString() }), unresolved: unresolved ? copy.spec(unresolved === 1 ? 'previewUnresolvedOne' : 'previewUnresolved', { count: unresolved }) : '.' });
    } catch (error) { if (current(ticket, day)) copy.set(status, error.name === 'AbortError' ? 'previewInterrupted' : error.copy || copy.spec('literal', { text: error.message })); }
    finally { clearTimeout(timer); clearInterval(check); if (ticket === revision) { busy = false; controller = null; trigger.disabled = !active(); refresh.disabled = !active(); } }
  }
  date.addEventListener('change', () => invalidate('previewDayChanged'));
  refresh.addEventListener('click', open);
  panel.querySelector('#routePreviewClose').addEventListener('click', () => { invalidate(); panel.hidden = true; trigger.focus(); });
  window.addEventListener('offline', () => invalidate('previewOffline'));
  window.addEventListener('storage', () => { if (!active()) invalidate('daySession'); });
  window.addEventListener('pagehide', () => { closed = true; invalidate(); });
  window.addEventListener('pageshow', () => { closed = false; if (!active()) invalidate('daySession'); else { trigger.disabled = false; refresh.disabled = false; date.disabled = false; } });
  setInterval(() => { if (!active()) invalidate('daySession'); }, 1000);
  window.CWFieldRoutePreview = { open };
})();
