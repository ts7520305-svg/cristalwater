(function () {
  if (window.__CW_V2_SHELL__) return;
  window.__CW_V2_SHELL__ = true;

  const searchInput = document.querySelector('[data-cw-search-input]');
  const searchResults = document.querySelector('[data-cw-search-results]');
  const indicator = document.querySelector('[data-offline-indicator]');

  function loadStateAdapter() {
    if (window.CWV2StateAdapter?.start) {
      window.CWV2StateAdapter.start();
      return;
    }
    if (document.querySelector('script[data-cw-v2-state-adapter="1"]')) return;
    const script = document.createElement('script');
    script.src = '/ui/state-adapter-v2.js';
    script.defer = true;
    script.dataset.cwV2StateAdapter = '1';
    document.body.appendChild(script);
  }

  function installTechnicianWaterUx() {
    const path = String(location.pathname || '').replace(/\/+$/, '');
    if (path !== '/technician-field-mode' && path !== '/technician-field-mode.html') return;
    if (window.__CW_FIELD_WATER_UX__) return;
    window.__CW_FIELD_WATER_UX__ = true;

    const FLOW = { DRIP: 'A pingar', HALF: 'Meia aberta', FULL: 'Totalmente aberta' };
    const $ = (selector, root = document) => root.querySelector(selector);
    const read = (key, fallback) => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
    };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
    const user = () => { try { return window.CristalAuth?.parseUser?.() || {}; } catch (_) { return {}; } };
    const techId = () => String(new URLSearchParams(location.search).get('technicianId') || localStorage.getItem('cwTechnicianId') || user().technicianId || user().id || 'sem-tecnico');
    const key = () => `cwWaterReminders:${techId()}`;
    const rows = () => { const value = read(key(), []); return Array.isArray(value) ? value : []; };
    const save = (value) => write(key(), (value || []).slice(-100));
    const byId = (id) => rows().find((item) => String(item.localId || '') === String(id || '')) || null;
    const elapsed = (value) => {
      const date = new Date(value || 0);
      if (Number.isNaN(date.getTime())) return 'tempo por confirmar';
      const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
      if (mins < 60) return `${mins} min`;
      const hours = Math.floor(mins / 60);
      return hours < 24 ? `${hours}h ${String(mins % 60).padStart(2, '0')}m` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
    };
    const toast = (message) => {
      const node = $('#toast');
      if (!node) return;
      node.textContent = message;
      node.classList.add('show');
      setTimeout(() => node.classList.remove('show'), 2400);
    };
    const api = async (url, options = {}) => {
      const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || data.message || 'Erro no servidor');
      return data;
    };

    function enhance() {
      const card = $('.water-card');
      const grid = card?.querySelector('.water-grid');
      const note = $('#waterNote');
      if (!card || !grid || !note) return;
      [$('#waterMinutes'), $('#waterCloseTime')].filter(Boolean).forEach((node) => {
        node.hidden = true;
        node.tabIndex = -1;
        node.setAttribute('aria-hidden', 'true');
        node.value = '';
      });
      if (!$('#waterFlowState')) {
        const select = document.createElement('select');
        select.id = 'waterFlowState';
        select.setAttribute('aria-label', 'Estado da torneira ou caudal');
        select.innerHTML = '<option value="DRIP">A pingar</option><option value="HALF">Meia aberta</option><option value="FULL" selected>Totalmente aberta</option>';
        grid.insertBefore(select, note);
      }
      note.placeholder = 'Nota opcional. Ex: encher até meio do skimmer';
      let helper = card.querySelector('[data-water-state-helper]');
      if (!helper) {
        helper = document.createElement('div');
        helper.dataset.waterStateHelper = '1';
        helper.className = 'muted';
        helper.style.marginTop = '10px';
        const legacy = card.querySelector(':scope > .muted');
        if (legacy) legacy.replaceWith(helper); else card.insertBefore(helper, grid);
      }
      helper.textContent = 'Indica como ficou a água. O aviso mantém-se ativo até confirmares que a torneira está fechada; o tempo é contado automaticamente.';
    }

    function decorate() {
      enhance();
      document.querySelectorAll('#waterReminderList [data-water-id]').forEach((node) => {
        const reminder = byId(node.dataset.waterId);
        if (!reminder) return;
        const main = node.querySelector('.doc-number');
        if (main) main.textContent = `Água aberta há ${elapsed(reminder.createdAt)}`;
        let detail = node.querySelector('[data-water-flow-detail]');
        if (!detail) {
          detail = document.createElement('div');
          detail.dataset.waterFlowDetail = '1';
          detail.className = 'muted';
          node.querySelector('.water-line')?.insertAdjacentElement('afterend', detail);
        }
        if (detail) detail.textContent = `Caudal: ${FLOW[reminder.flowState] || 'Por confirmar'}${reminder.userNote ? ` · ${reminder.userNote}` : ''}`;
      });
      document.querySelectorAll('#interruptList [data-exception-category="WATER_OPEN"]').forEach((node) => {
        const localId = String(node.dataset.exceptionId || '').replace(/^water-open:/, '');
        const reminder = byId(localId);
        const detail = node.querySelector('strong')?.nextElementSibling;
        if (reminder && detail) detail.textContent = `${reminder.poolName || 'Piscina'} | ${reminder.clientName || 'Cliente'} | Água aberta há ${elapsed(reminder.createdAt)} | Caudal: ${FLOW[reminder.flowState] || 'Por confirmar'}`;
      });
    }

    async function openWater() {
      const state = read('cw:tech-field:ui-state:v1', {});
      const visitId = String(state.selectedVisitId || '');
      if (!visitId) return toast('Seleciona uma piscina antes de marcar água aberta.');
      const flowState = String($('#waterFlowState')?.value || 'FULL');
      const userNote = String($('#waterNote')?.value || '').trim();
      const createdAt = new Date();
      const safetyMinutes = Math.max(15, Math.min(1440, Number(localStorage.getItem('cwWaterSafetyMinutes')) || 120));
      const reminder = {
        localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        status: 'OPEN', alerted: false, visitId,
        poolName: String(state.selectedVisitTitle || $('#nextTitle')?.textContent || 'Piscina').trim(),
        clientName: String($('#nextMeta')?.textContent || 'Cliente').split(' - ')[0].trim(),
        technicianId: techId() === 'sem-tecnico' ? null : techId(), technicianName: String(user().name || ''),
        flowState, userNote, note: `[Caudal: ${flowState}]${userNote ? ` ${userNote}` : ''}`,
        createdAt: createdAt.toISOString(), dueAt: new Date(createdAt.getTime() + safetyMinutes * 60000).toISOString(),
        reminderMode: 'SYSTEM_SAFETY', safetyMinutes,
      };
      const list = rows(); list.push(reminder); save(list); decorate();
      toast('Água aberta registada. O aviso fica ativo até confirmares o fecho.');
      try {
        const data = await api('/api/technician/water-reminders', { method: 'POST', body: JSON.stringify(reminder) });
        const next = rows(); const item = next.find((entry) => entry.localId === reminder.localId);
        if (item) { item.serverId = data.reminder?.id || data.id || null; item.notificationId = data.notification?.id || null; item.syncError = ''; save(next); }
      } catch (error) {
        const next = rows(); const item = next.find((entry) => entry.localId === reminder.localId);
        if (item) { item.syncError = error.message || 'Sem ligação ao servidor'; save(next); }
      }
      if ($('#waterNote')) $('#waterNote').value = '';
      setTimeout(() => location.reload(), 120);
    }

    async function closeWater(localId) {
      const reminder = byId(localId);
      if (!reminder || !window.confirm('Confirma que a torneira está totalmente fechada?')) return;
      const list = rows(); const item = list.find((entry) => entry.localId === localId);
      if (!item) return;
      item.status = 'CLOSED'; item.closedAt = new Date().toISOString(); item.closeConfirmed = true; item.closeConfirmedBy = user().name || 'Técnico';
      item.closeDurationMinutes = Math.max(0, Math.round((Date.now() - new Date(item.createdAt || Date.now()).getTime()) / 60000)); save(list);
      toast('Água fechada confirmada.');
      try { await api(`/api/technician/water-reminders/${encodeURIComponent(item.serverId || localId)}/close`, { method: 'POST', body: JSON.stringify(item) }); item.syncError = ''; save(list); }
      catch (error) { item.syncError = error.message || 'Fecho pendente de sincronização'; save(list); }
      setTimeout(() => location.reload(), 120);
    }

    document.addEventListener('click', (event) => {
      const openButton = event.target.closest('#openWaterBtn');
      if (openButton) { event.preventDefault(); event.stopImmediatePropagation(); openWater().catch((error) => toast(error.message)); return; }
      const closeButton = event.target.closest('[data-water-close]');
      if (closeButton) { event.preventDefault(); event.stopImmediatePropagation(); closeWater(closeButton.dataset.waterClose).catch((error) => toast(error.message)); }
    }, true);

    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(decorate, 30000);
    decorate();
  }

  function getDrawer() {
    return document.querySelector('[data-cw-drawer], .cw-v2-drawer');
  }

  function closeDrawer() {
    const drawer = getDrawer();
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function openDrawer() {
    const drawer = getDrawer();
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function updateConnectionState() {
    if (!indicator) return;
    if (navigator.onLine) {
      indicator.textContent = 'Online';
      indicator.classList.remove('warning');
      indicator.classList.add('success');
      return;
    }
    indicator.textContent = 'Offline';
    indicator.classList.remove('success');
    indicator.classList.add('warning');
  }

  function closeSearch() {
    if (searchResults) searchResults.style.display = 'none';
  }

  function renderSearch(query) {
    if (!searchInput || !searchResults) return;
    const list = Array.from(document.querySelectorAll('[data-shell-search]'));
    const term = String(query || '').trim().toLowerCase();
    if (!term) { closeSearch(); return; }
    const matches = list.map((node) => ({ label: node.getAttribute('data-shell-search') || '', href: node.getAttribute('href') || node.getAttribute('data-shell-href') || '#' }))
      .filter((item) => item.label.toLowerCase().includes(term)).slice(0, 8);
    if (!matches.length) { searchResults.innerHTML = '<a href="#" onclick="return false">Sem resultados</a>'; searchResults.style.display = 'block'; return; }
    searchResults.innerHTML = matches.map((item) => `<a href="${item.href}">${item.label}</a>`).join('');
    searchResults.style.display = 'block';
  }

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', (event) => renderSearch(event.target.value));
    searchInput.addEventListener('focus', (event) => renderSearch(event.target.value));
    document.addEventListener('click', (event) => { if (!searchResults.contains(event.target) && event.target !== searchInput) closeSearch(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSearch(); });
  }

  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-cw-open-drawer]');
    if (openTrigger) { event.preventDefault(); openDrawer(); return; }
    const closeTrigger = event.target.closest('[data-cw-close-drawer], [data-cw-drawer-backdrop], .cw-v2-drawer-backdrop');
    if (closeTrigger) { event.preventDefault(); closeDrawer(); return; }
    const drawer = getDrawer();
    if (!drawer || !drawer.contains(event.target)) return;
    if (event.target.closest('a[href]')) closeDrawer();
  });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });
  window.addEventListener('online', updateConnectionState);
  window.addEventListener('offline', updateConnectionState);
  updateConnectionState();
  loadStateAdapter();
  installTechnicianWaterUx();
})();
