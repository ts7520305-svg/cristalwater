(function () {
  if (window.__CW_V2_SHELL__) return;
  window.__CW_V2_SHELL__ = true;

  let searchInput, searchResults, drawerTrigger;
  const boundSearchInputs = new WeakSet();

  const emptySearchCopy = (() => {
    const languages = ['pt','en','fr','es','de'];
    const copy = ['Sem resultados','No results','Aucun résultat','Sin resultados','Keine Ergebnisse'];
    const leaves = new Map();
    const text = () => copy[Math.max(0,languages.indexOf(document.documentElement.lang))];
    function create() {
      const node = document.createElement('p'); node.setAttribute('role','status'); node.dataset.cwNoI18n = '';
      const rendered = text(); node.textContent = rendered; leaves.set(node,{textNode:node.firstChild,rendered}); return node;
    }
    function paint() {
      for (const [node,leaf] of leaves) {
        if (!node.isConnected || node.childNodes.length !== 1 || node.firstChild !== leaf.textNode || leaf.textNode.nodeValue !== leaf.rendered) { leaves.delete(node); continue; }
        const rendered = text(); if (rendered !== leaf.rendered) leaf.textNode.nodeValue = rendered; leaf.rendered = rendered;
      }
    }
    window.addEventListener('cw-language-change',paint);
    new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    return {create};
  })();

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

    const waterCopy = (() => {
      const languages = ['pt', 'en', 'fr', 'es', 'de'];
      const copy = {
  "drip": [
    "A pingar",
    "Dripping",
    "Goutte à goutte",
    "Goteando",
    "Tropfend"
  ],
  "half": [
    "Meia aberta",
    "Half open",
    "À moitié ouverte",
    "Medio abierta",
    "Halb geöffnet"
  ],
  "full": [
    "Totalmente aberta",
    "Fully open",
    "Complètement ouverte",
    "Totalmente abierta",
    "Vollständig geöffnet"
  ],
  "unknownTime": [
    "tempo por confirmar",
    "time unconfirmed",
    "durée à confirmer",
    "tiempo por confirmar",
    "Zeit unbestätigt"
  ],
  "minutes": [
    "{minutes} min",
    "{minutes} min",
    "{minutes} min",
    "{minutes} min",
    "{minutes} Min."
  ],
  "hours": [
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours} Std. {minutes} Min."
  ],
  "days": [
    "{days}d {hours}h",
    "{days}d {hours}h",
    "{days}j {hours}h",
    "{days}d {hours}h",
    "{days} T. {hours} Std."
  ],
  "flowLabel": [
    "Estado da torneira ou caudal",
    "Tap or flow state",
    "État du robinet ou débit",
    "Estado del grifo o caudal",
    "Zustand des Wasserhahns oder Durchfluss"
  ],
  "notePlaceholder": [
    "Nota opcional. Ex: encher até meio do skimmer",
    "Optional note. E.g. fill to the middle of the skimmer",
    "Note facultative. Ex. : remplir jusqu’au milieu du skimmer",
    "Nota opcional. Ej.: llenar hasta la mitad del skimmer",
    "Optionale Notiz. Z. B. bis zur Mitte des Skimmers auffüllen"
  ],
  "helper": [
    "Indica como ficou a água. O aviso mantém-se ativo até confirmares que a torneira está fechada; o tempo é contado automaticamente.",
    "Indicate how you left the water. The warning stays active until you confirm the tap is closed; elapsed time is counted automatically.",
    "Indiquez comment vous avez laissé l’eau. L’avertissement reste actif jusqu’à la confirmation de la fermeture du robinet ; la durée est calculée automatiquement.",
    "Indique cómo ha dejado el agua. El aviso permanece activo hasta que confirme que el grifo está cerrado; el tiempo se cuenta automáticamente.",
    "Geben Sie an, wie Sie das Wasser hinterlassen haben. Die Warnung bleibt aktiv, bis Sie bestätigen, dass der Wasserhahn geschlossen ist; die Zeit wird automatisch erfasst."
  ],
  "closedPending": [
    "Fecho físico confirmado; envio pendente",
    "Physical closure confirmed; upload pending",
    "Fermeture physique confirmée ; envoi en attente",
    "Cierre físico confirmado; envío pendiente",
    "Schließen vor Ort bestätigt; Übermittlung ausstehend"
  ],
  "openSince": [
    "Água aberta há {elapsed}",
    "Water has been running for {elapsed}",
    "L’eau coule depuis {elapsed}",
    "Agua abierta desde hace {elapsed}",
    "Wasser läuft seit {elapsed}"
  ],
  "flowDetail": [
    "Caudal: {flow}{note}",
    "Flow: {flow}{note}",
    "Débit : {flow}{note}",
    "Caudal: {flow}{note}",
    "Durchfluss: {flow}{note}"
  ],
  "unknownFlow": [
    "Por confirmar",
    "Unconfirmed",
    "À confirmer",
    "Por confirmar",
    "Unbestätigt"
  ],
  "pool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ],
  "client": [
    "Cliente",
    "Client",
    "Client",
    "Cliente",
    "Kunde"
  ],
  "interrupt": [
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}"
  ],
  "missing": [
    "Reabra a página para recuperar os lembretes.",
    "Reopen the page to recover reminders.",
    "Rouvrez la page pour récupérer les rappels.",
    "Vuelva a abrir la página para recuperar los recordatorios.",
    "Öffnen Sie die Seite erneut, um die Erinnerungen wiederherzustellen."
  ],
  "savedOpen": [
    "Água aberta guardada neste telemóvel. A confirmar no servidor.",
    "Running water recorded on this phone. Awaiting server confirmation.",
    "Ouverture de l’eau enregistrée sur ce téléphone. En attente de confirmation du serveur.",
    "Agua abierta registrada en este teléfono. Pendiente de confirmación del servidor.",
    "Laufendes Wasser auf diesem Telefon erfasst. Serverbestätigung ausstehend."
  ],
  "confirm": [
    "Confirma que a torneira está totalmente fechada?",
    "Do you confirm that the tap is fully closed?",
    "Confirmez-vous que le robinet est complètement fermé ?",
    "¿Confirma que el grifo está totalmente cerrado?",
    "Bestätigen Sie, dass der Wasserhahn vollständig geschlossen ist?"
  ],
  "savedClosed": [
    "Fecho guardado neste telemóvel. A confirmar no servidor.",
    "Closure saved on this phone. Awaiting server confirmation.",
    "Fermeture enregistrée sur ce téléphone. En attente de confirmation du serveur.",
    "Cierre guardado en este teléfono. Pendiente de confirmación del servidor.",
    "Schließen auf diesem Telefon gespeichert. Serverbestätigung ausstehend."
  ]
};
      const specs = new WeakSet(), errors = new WeakMap(), bindings = new Map();
      function value(key, params = {}) { const entry = Object.freeze({ key, params: Object.freeze({ ...params }) }); specs.add(entry); return entry; }
      function format(entry) {
        if (!specs.has(entry)) return reminders?.presentation?.format(entry) ?? String(entry ?? '');
        const language = (document.documentElement?.lang || 'pt').toLowerCase().split('-')[0];
        return copy[entry.key][Math.max(0, languages.indexOf(language))].replace(/\{(\w+)\}/g, (_, key) => format(entry.params[key]));
      }
      function clear(node) { const old = bindings.get(node); if (!old) return; bindings.delete(node); node.removeAttribute('data-cw-water-copy'); if (!old.protected && !node.hasAttribute('data-cw-water-list-copy')) node.removeAttribute('data-cw-no-i18n'); }
      function bind(node, entry, attribute = '') {
        if (!node) return;
        const previous = bindings.get(node), rendered = format(entry), protectedNode = previous ? previous.protected : node.hasAttribute('data-cw-no-i18n');
        node.setAttribute('data-cw-water-copy', ''); node.setAttribute('data-cw-no-i18n', '');
        if (attribute) { if (node.getAttribute(attribute) !== rendered) node.setAttribute(attribute, rendered); }
        else if (node.textContent !== rendered) node.textContent = rendered;
        bindings.set(node, { entry, attribute, rendered, protected: protectedNode, textNode: node.firstChild });
      }
      function prune() { for (const node of bindings.keys()) if (!node.isConnected) clear(node); }
      function paint() {
        for (const [node, item] of bindings) {
          const current = item.attribute ? node.getAttribute(item.attribute) : node.textContent;
          if (!node.isConnected || current !== item.rendered || (!item.attribute && node.firstChild !== item.textNode)) { clear(node); continue; }
          bind(node, item.entry, item.attribute);
        }
      }
      window.addEventListener('cw-language-change', paint);
      let lastLanguage = document.documentElement?.lang || 'pt';
      if (document.documentElement) new MutationObserver(() => { const language = document.documentElement.lang; if (language !== lastLanguage) { lastLanguage = language; paint(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      return { value, format, bind, prune, problem: key => { const error = Error(copy[key][0]); errors.set(error, value(key)); return error; }, error: error => errors.get(error) || reminders?.presentation?.error(error) || String(error?.message ?? '') };
    })();
    const FLOW = { DRIP: waterCopy.value('drip'), HALF: waterCopy.value('half'), FULL: waterCopy.value('full') };
    const $ = (selector, root = document) => root.querySelector(selector);
    const reminders = window.CWFieldReminders;
    const rows = () => reminders ? reminders.list('WATER_OPEN') : [];
    const byId = id => rows().find(item => item.localId === id);
    const elapsed = (value) => {
      const date = new Date(value || 0);
      if (Number.isNaN(date.getTime())) return waterCopy.value('unknownTime');
      const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
      if (mins < 60) return waterCopy.value('minutes', { minutes: mins });
      const hours = Math.floor(mins / 60);
      return hours < 24 ? waterCopy.value('hours', { hours, minutes: String(mins % 60).padStart(2, '0') }) : waterCopy.value('days', { days: Math.floor(hours / 24), hours: hours % 24 });
    };
    const toast = (message) => {
      const node = $('#toast');
      if (!node) return;
      waterCopy.bind(node, message);
      node.classList.add('show');
      setTimeout(() => node.classList.remove('show'), 2400);
    };
    async function syncPendingWaterState() { await reminders?.sync(); }

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
      waterCopy.bind($('#waterFlowState'), waterCopy.value('flowLabel'), 'aria-label');
      for (const option of $('#waterFlowState')?.options || []) if (FLOW[option.value]) waterCopy.bind(option, FLOW[option.value]);
      waterCopy.bind(note, waterCopy.value('notePlaceholder'), 'placeholder');
      let helper = card.querySelector('[data-water-state-helper]');
      if (!helper) {
        helper = document.createElement('div');
        helper.dataset.waterStateHelper = '1';
        helper.className = 'muted';
        helper.style.marginTop = '10px';
        const legacy = card.querySelector(':scope > .muted');
        if (legacy) legacy.replaceWith(helper); else card.insertBefore(helper, grid);
      }
      waterCopy.bind(helper, waterCopy.value('helper'));
    }

    function decorate() {
      waterCopy.prune();
      enhance();
      document.querySelectorAll('#waterReminderList [data-water-id]').forEach((node) => {
        const reminder = byId(node.dataset.waterId);
        if (!reminder) return;
        const main = node.querySelector('.doc-number');
        if (main) waterCopy.bind(main, reminder.status === 'CLOSED' ? waterCopy.value('closedPending') : waterCopy.value('openSince', { elapsed: elapsed(reminder.createdAt) }));
        let detail = node.querySelector('[data-water-flow-detail]');
        if (!detail) {
          detail = document.createElement('div');
          detail.dataset.waterFlowDetail = '1';
          detail.className = 'muted';
          node.querySelector('.water-line')?.insertAdjacentElement('afterend', detail);
        }
        if (detail) waterCopy.bind(detail, waterCopy.value('flowDetail', { flow: FLOW[reminder.flowState] || waterCopy.value('unknownFlow'), note: reminder.userNote ? ` · ${reminder.userNote}` : '' }));
      });
      document.querySelectorAll('#interruptList [data-exception-category="WATER_OPEN"]').forEach((node) => {
        const localId = String(node.dataset.exceptionId || '').replace(/^water-open:/, '');
        const reminder = rows().find(row => `${row.visitType}:${row.localId}` === localId || row.localId === localId);
        const detail = node.querySelector('strong')?.nextElementSibling;
        if (reminder && detail) waterCopy.bind(detail, waterCopy.value('interrupt', { pool: reminder.poolName || waterCopy.value('pool'), client: reminder.clientName || waterCopy.value('client'), open: waterCopy.value('openSince', { elapsed: elapsed(reminder.createdAt) }), flow: waterCopy.value('flowDetail', { flow: FLOW[reminder.flowState] || waterCopy.value('unknownFlow'), note: '' }) }));
      });
    }

    async function openWater() {
      if (!reminders) throw waterCopy.problem('missing');
      const flowState = String($('#waterFlowState')?.value || 'FULL');
      const note = String($('#waterNote')?.value || '').trim();
      const safetyMinutes = Math.max(15, Math.min(1440, Number(localStorage.getItem('cwWaterSafetyMinutes')) || 120));
      await reminders.create('WATER_OPEN', {flowState,note,dueAt:new Date(Date.now()+safetyMinutes*60000).toISOString()});
      toast(waterCopy.value('savedOpen'));
      if ($('#waterNote')) $('#waterNote').value = '';
      await reminders.sync();
    }

    async function closeWater(localId) {
      if (!byId(localId) || !window.confirm(waterCopy.format(waterCopy.value('confirm')))) return;
      await reminders.mark('WATER_OPEN',localId,'close');
      toast(waterCopy.value('savedClosed'));
      await reminders.sync();
    }
    window.CWWaterReminders = {open:openWater,close:closeWater};

    document.addEventListener('click', (event) => {
      const openButton = event.target.closest('#openWaterBtn');
      if (openButton) { event.preventDefault(); event.stopImmediatePropagation(); openWater().catch((error) => toast(waterCopy.error(error))); return; }
      const closeButton = event.target.closest('[data-water-close]');
      if (closeButton) { event.preventDefault(); event.stopImmediatePropagation(); closeWater(closeButton.dataset.waterClose).catch((error) => toast(waterCopy.error(error))); }
    }, true);

    const observer = new MutationObserver((records) => {
      // Text-only repaints (including language changes) must not reload reminders.
      // Core list/exception renders replace elements and still trigger decoration.
      const relevant = records.some(record => {
        const elements = [...record.addedNodes, ...record.removedNodes].filter(node => node.nodeType === 1);
        return elements.length && (record.target.closest?.('.water-card, #interruptList') || elements.some(node => node.matches('.water-card, #interruptList') || node.querySelector('.water-card, #interruptList')));
      });
      if (!relevant) return;
      // Decoration changes child nodes. Do not observe our own writes.
      observer.disconnect();
      try { decorate(); } catch (error) { toast(waterCopy.error(error)); }
      finally { observer.observe(document.body, { childList: true, subtree: true }); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => { try { decorate(); } catch (error) { toast(waterCopy.error(error)); } }, 30000);
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
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawerTrigger?.focus();
  }

  function openDrawer() {
    const drawer = getDrawer();
    if (!drawer) return;
    drawerTrigger = document.activeElement;
    closeSearch();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('[data-cw-close-drawer], button, a[href]')?.focus();
  }

  function updateConnectionState() {
    const indicator = document.querySelector('[data-offline-indicator]');
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
    const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const term = normalize(String(query || '').trim());
    if (!term) { closeSearch(); return; }
    const seen = new Set();
    const matches = list.map((node) => ({ label: node.getAttribute('data-shell-search') || '', aliases: window.CWNavigationSearch?.labels(node) || [], href: node.getAttribute('href') || node.getAttribute('data-shell-href') || '#' }))
      .filter((item) => {
        if (![item.label,...item.aliases].some(label => normalize(label).includes(term)) || seen.has(item.href) || !item.href.startsWith('/') || item.href.startsWith('//')) return false;
        seen.add(item.href); return true;
      }).slice(0, 8);
    searchResults.replaceChildren();
    for (const item of matches) {
      const link = document.createElement('a'); link.href = item.href; link.textContent = item.label;
      searchResults.appendChild(link);
    }
    if (!matches.length) {
      searchResults.appendChild(emptySearchCopy.create());
    }
    searchResults.style.display = 'block';
  }

  function bindNavigation() {
    searchInput = document.querySelector('[data-cw-search-input]');
    searchResults = document.querySelector('[data-cw-search-results]');
    updateConnectionState();
    if (!searchInput || !searchResults || boundSearchInputs.has(searchInput)) return;
    boundSearchInputs.add(searchInput);
    if (!searchInput.hasAttribute('aria-label')) searchInput.setAttribute('aria-label', searchInput.getAttribute('placeholder') || 'Pesquisar');
    searchInput.addEventListener('input', (event) => renderSearch(event.target.value));
    searchInput.addEventListener('focus', (event) => renderSearch(event.target.value));
    searchInput.addEventListener('keydown', event => {
      if (searchResults.style.display === 'none') return;
      const first = searchResults.querySelector('a');
      if (first && event.key === 'ArrowDown') { event.preventDefault(); first.focus(); }
      if (first && event.key === 'Enter') { event.preventDefault(); first.click(); }
    });
  }
  document.addEventListener('click', event => { if (searchResults && !searchResults.contains(event.target) && event.target !== searchInput) closeSearch(); });
  window.addEventListener('cw:navigation-ready', bindNavigation);
  document.addEventListener('DOMContentLoaded', bindNavigation);
  bindNavigation();

  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-cw-open-drawer]');
    if (openTrigger) { event.preventDefault(); openDrawer(); return; }
    const closeTrigger = event.target.closest('[data-cw-close-drawer], [data-cw-drawer-backdrop], .cw-v2-drawer-backdrop');
    if (closeTrigger) { event.preventDefault(); closeDrawer(); return; }
    const drawer = getDrawer();
    if (!drawer || !drawer.contains(event.target)) return;
    if (event.target.closest('a[href]')) closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (searchResults?.contains(document.activeElement)) searchInput?.focus();
      closeSearch(); closeDrawer();
    }
    const drawer = getDrawer();
    if (event.key !== 'Tab' || !drawer?.classList.contains('is-open')) return;
    const focusable = Array.from(drawer.querySelectorAll('a[href], button, summary, input, [tabindex="0"]')).filter(node => !node.disabled && node.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  window.addEventListener('online', updateConnectionState);
  window.addEventListener('offline', updateConnectionState);
  updateConnectionState();
  loadStateAdapter();
  installTechnicianWaterUx();
  installTechnicianCheckinUx();
})();
