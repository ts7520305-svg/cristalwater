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

  function isTechnicianFieldPage() {
    const path = String(location.pathname || '').replace(/\/+$/, '');
    return path === '/technician-field-mode' || path === '/technician-field-mode.html';
  }

  function installTechnicianWaterUx() {
    if (!isTechnicianFieldPage()) return;
    if (window.__CW_FIELD_WATER_UX__) return;
    window.__CW_FIELD_WATER_UX__ = true;

    const FLOW = { DRIP: 'A pingar', HALF: 'Meia aberta', FULL: 'Totalmente aberta' };
    const $ = (selector, root = document) => root.querySelector(selector);
    const read = (key, fallback) => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
    };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
    const user = () => { try { return window.CristalAuth?.parseUser?.() || {}; } catch (_) { return {}; } };
    const techId = () => String(user().technicianId || user().id || new URLSearchParams(location.search).get('technicianId') || localStorage.getItem('cwTechnicianId') || 'sem-tecnico');
    const key = () => `cwWaterReminders:${techId()}`;
    const rows = () => { const value = read(key(), []); return Array.isArray(value) ? value : []; };
    const save = (value) => { write(key(), value || []); window.dispatchEvent(new Event('cw:water-state-updated')); };
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
      if (response.status === 202 || data.offline || data.status === 'PENDING_SYNC') throw new Error('Pendente de sincronização com o servidor');
      if (!data.reminder?.id) throw new Error('O servidor não confirmou o registo da água');
      return data;
    };

    async function refreshServerWater() {
      if (!navigator.onLine) return;
      const response = await fetch('/api/technician/water-reminders');
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.reminders)) return;
      const list = rows();
      for (const remote of data.reminders) {
        let item = list.find(x => x.serverId === remote.id || x.localId === remote.metadata?.localId);
        if (remote.transferredAway) { if (item) list.splice(list.indexOf(item),1); continue; }
        if (item?.syncError) continue;
        if (!item) { item = {localId:remote.metadata?.localId || `server-${remote.id}`}; list.push(item); }
        Object.assign(item, remote.metadata || {}, {serverId:remote.id, technicianId:remote.assignedToTechnicianId, poolId:remote.poolId, clientId:remote.clientId, dueAt:remote.dueDate, createdAt:remote.createdAt, status:remote.isCompleted?'CLOSED':remote.metadata?.alarmedAt?'OVERDUE':'OPEN', syncError:''});
      }
      save(list);
    }
    let syncingWater = false;
    async function syncPendingWaterState() {
      if (!navigator.onLine || syncingWater) return;
      syncingWater = true;
      try {
      for (const pending of rows()) {
        if (!pending?.localId || !pending.syncError) continue;
        let item = byId(pending.localId);
        if (!item) continue;
        try {
          if (!item.serverId) {
            const data = await api('/api/technician/water-reminders', { method: 'POST', body: JSON.stringify({ ...item, status: 'OPEN' }) });
            // Re-read before saving: a user may have closed it during the request.
            const next = rows(); item = next.find((entry) => entry.localId === pending.localId);
            if (!item) continue;
            item.serverId = data.reminder.id;
            item.syncedAt = new Date().toISOString();
            save(next);
          }
          if (item.status === 'CLOSED') {
            await api(`/api/technician/water-reminders/${encodeURIComponent(item.serverId)}/close`, { method: 'POST', body: JSON.stringify(item) });
          } else if (item.status === 'OVERDUE') {
            await api(`/api/technician/water-reminders/${encodeURIComponent(item.serverId)}/alarm`, { method: 'POST', body: JSON.stringify(item) });
          }
          const next = rows(); const current = next.find((entry) => entry.localId === pending.localId);
          if (current && current.status === item.status) {
            current.syncError = '';
            if (current.status === 'CLOSED') current.closeSyncedAt = new Date().toISOString();
            save(next);
          }
        } catch (_) {}
      }
      } finally { syncingWater = false; }
      await refreshServerWater().catch(() => {});
    }

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
      try { await api(`/api/technician/water-reminders/${encodeURIComponent(item.serverId || localId)}/close`, { method: 'POST', body: JSON.stringify(item) }); item.syncError = ''; item.closeSyncedAt = new Date().toISOString(); save(list); }
      catch (error) { item.syncError = error.message || 'Fecho pendente de sincronização'; save(list); }
      setTimeout(() => location.reload(), 120);
    }

    document.addEventListener('click', (event) => {
      const openButton = event.target.closest('#openWaterBtn');
      if (openButton) { event.preventDefault(); event.stopImmediatePropagation(); openWater().catch((error) => toast(error.message)); return; }
      const closeButton = event.target.closest('[data-water-close]');
      if (closeButton) { event.preventDefault(); event.stopImmediatePropagation(); closeWater(closeButton.dataset.waterClose).catch((error) => toast(error.message)); }
    }, true);

    const observer = new MutationObserver(() => {
      // Decoration changes child nodes. Do not observe our own writes.
      observer.disconnect();
      try { decorate(); }
      finally { observer.observe(document.body, { childList: true, subtree: true }); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => { decorate(); syncPendingWaterState().catch(() => {}); }, 30000);
    window.addEventListener('online', () => syncPendingWaterState().catch(() => {}));
    decorate();
    syncPendingWaterState().catch(() => {});
  }

  function installTechnicianCheckinUx() {
    if (!isTechnicianFieldPage()) return;
    if (window.__CW_FIELD_CHECKIN_UX__) return;
    window.__CW_FIELD_CHECKIN_UX__ = true;

    const $ = (selector, root = document) => root.querySelector(selector);
    let bypassNextStart = false;
    let reviewed = null;

    function selectedVisitId() {
      try {
        const raw = localStorage.getItem('cw:tech-field:ui-state:v1');
        const state = raw ? JSON.parse(raw) : {};
        return String(state?.selectedVisitId || '');
      } catch (_) {
        return '';
      }
    }

    function buildNoticeSummary() {
      const list = $('#accessList');
      const items = [...(list?.querySelectorAll('.access-item') || [])];
      const blockText = node => {
        const copy = node.cloneNode(true);
        copy.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
        return String(copy.textContent || '').trim();
      };
      const access = items.length
        ? items.map(item => [...item.children].map(blockText).filter(Boolean).join('\n')).filter(Boolean).join('\n\n')
        : String(list?.textContent || '').trim();
      return access || 'Sem avisos adicionais registados para esta piscina.';
    }

    function snapshot() {
      let user;
      try { user = window.CristalAuth?.parseUser?.() || JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || 'null'); } catch {}
      return {
        visitId: selectedVisitId(),
        target: $('#startBtn')?.dataset.cwCheckinTarget || selectedVisitId(),
        required: $('#startBtn')?.dataset.cwCheckinRequired,
        session: JSON.stringify([window.CristalAuth?.getToken?.() || localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token'), user?.role, user?.id, user?.technicianId]),
        pool: String($('#nextTitle')?.textContent || 'Piscina').trim(),
        client: String($('#nextMeta')?.textContent || '').trim(),
        notices: buildNoticeSummary(),
      };
    }

    function closeCheckin() {
      reviewed = null;
      const overlay = $('#cwFieldCheckinOverlay');
      if (!overlay) return;
      overlay.hidden = true; overlay.style.display = 'none';
      for (const id of ['cwFieldCheckinPool', 'cwFieldCheckinClient', 'cwFieldCheckinNotices']) $('#' + id, overlay).textContent = '';
    }

    function invalidateChangedCheckin() {
      if (!reviewed || JSON.stringify(reviewed) === JSON.stringify(snapshot())) return false;
      closeCheckin();
      window.CwUi?.info?.('A piscina, as instruções ou a sessão mudaram. Reveja os dados e volte a iniciar a visita.');
      return true;
    }

    function ensureDialog() {
      let overlay = $('#cwFieldCheckinOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'cwFieldCheckinOverlay';
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Check-in da visita');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(6,20,16,.72);padding:16px;display:none;align-items:center;justify-content:center;';
      overlay.innerHTML = `
        <div style="width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--cw-surface,#fff);color:var(--cw-text,#102620);border-radius:18px;border:1px solid var(--cw-border,#cbd8d2);padding:18px;box-shadow:0 22px 60px rgba(0,0,0,.28)">
          <span class="chip">Check-in obrigatório</span>
          <h2 id="cwFieldCheckinPool" data-cw-no-i18n style="font-size:28px;line-height:1.1;margin:12px 0 6px">Piscina</h2>
          <div id="cwFieldCheckinClient" data-cw-no-i18n class="muted"></div>
          <div style="margin-top:16px;padding:14px;border-radius:14px;border:1px solid var(--cw-border,#cbd8d2);background:var(--cw-surface-2,#f5f9f7)">
            <strong>Antes de começar</strong>
            <div id="cwFieldCheckinNotices" data-cw-no-i18n class="muted" style="margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:16px">
            <button id="cwFieldCheckinConfirm" type="button" class="big ok" style="min-height:72px">Li e vou iniciar a visita</button>
            <button id="cwFieldCheckinCancel" type="button" class="big ghost" style="min-height:58px">Voltar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      $('#cwFieldCheckinCancel', overlay).addEventListener('click', closeCheckin);
      $('#cwFieldCheckinConfirm', overlay).addEventListener('click', () => {
        if (!reviewed || invalidateChangedCheckin()) return;
        const start = $('#startBtn');
        if (!reviewed.visitId || !start || start.disabled) { closeCheckin(); return; }
        try { sessionStorage.setItem(`cw:field:checkin:${reviewed.visitId}`, new Date().toISOString()); } catch (_) {}
        closeCheckin();
        bypassNextStart = true;
        try { start.click(); } finally { bypassNextStart = false; }
      });
      return overlay;
    }

    function showCheckin() {
      const overlay = ensureDialog();
      reviewed = snapshot();
      $('#cwFieldCheckinPool', overlay).textContent = reviewed.pool || 'Piscina';
      $('#cwFieldCheckinClient', overlay).textContent = reviewed.client.split(' - ')[0] || 'Cliente';
      $('#cwFieldCheckinNotices', overlay).textContent = reviewed.notices;
      overlay.hidden = false;
      overlay.style.display = 'flex';
      $('#cwFieldCheckinConfirm', overlay)?.focus();
    }

    const noticeObserver = new MutationObserver(invalidateChangedCheckin);
    for (const selector of ['#nextTitle', '#nextMeta', '#accessList']) {
      const node = $(selector); if (node) noticeObserver.observe(node, { childList: true, characterData: true, subtree: true });
    }
    if ($('#startBtn')) noticeObserver.observe($('#startBtn'), { attributes: true, attributeFilter: ['data-cw-checkin-target', 'data-cw-checkin-required'] });
    for (const event of ['storage', 'focus']) window.addEventListener(event, invalidateChangedCheckin);

    document.addEventListener('click', (event) => {
      const start = event.target.closest('#startBtn');
      if (!start) return;
      if (bypassNextStart) {
        bypassNextStart = false;
        return;
      }
      const label = String(start.textContent || '').toLowerCase();
      const required = start.dataset.cwCheckinRequired;
      if (required != null ? required !== 'true' : !label.includes('iniciar visita')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showCheckin();
    }, true);
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
  installTechnicianCheckinUx();
})();
