(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CWClientClosures = api;
}(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const labels = {
    pt: ['Férias e encerramentos', 'Avisos da Cristal Water para preparar as próximas visitas.', 'Atualizar', 'Escolha um cliente para consultar os avisos.', 'A carregar avisos…', 'Sem avisos de encerramento em curso ou futuros publicados.', 'Não foi possível confirmar os avisos. Tente novamente.', 'A sessão mudou. Reabra a página com a conta pretendida.', 'Próximo encerramento', 'Encerramento em curso', 'Datas em UTC', 'Contacto de emergência', 'Estes avisos não confirmam alterações à sua visita. Consulte a agenda ou contacte a equipa.', 'A lista está limitada aos primeiros 100 avisos. Contacte a equipa para confirmar os restantes.', 'Mensagem original da equipa'],
    en: ['Holidays and closures', 'Notices from Cristal Water to help you plan upcoming visits.', 'Refresh', 'Choose a customer to view notices.', 'Loading notices…', 'No current or upcoming closure notices have been published.', 'The notices could not be confirmed. Please try again.', 'The session changed. Reopen the page with the intended account.', 'Upcoming closure', 'Closure in progress', 'Dates in UTC', 'Emergency contact', 'These notices do not confirm changes to your visit. Check the schedule or contact the team.', 'The list is limited to the first 100 notices. Contact the team to confirm the remaining notices.', 'Original message from the team'],
    fr: ['Congés et fermetures', 'Avis de Cristal Water pour préparer les prochaines visites.', 'Actualiser', 'Choisissez un client pour consulter les avis.', 'Chargement des avis…', 'Aucun avis de fermeture en cours ou à venir publié.', 'Impossible de confirmer les avis. Réessayez.', 'La session a changé. Rouvrez la page avec le compte souhaité.', 'Fermeture à venir', 'Fermeture en cours', 'Dates en UTC', 'Contact d’urgence', 'Ces avis ne confirment pas de modification de votre visite. Consultez le calendrier ou contactez l’équipe.', 'La liste est limitée aux 100 premiers avis. Contactez l’équipe pour confirmer les autres avis.', 'Message original de l’équipe'],
    es: ['Vacaciones y cierres', 'Avisos de Cristal Water para preparar las próximas visitas.', 'Actualizar', 'Seleccione un cliente para consultar los avisos.', 'Cargando avisos…', 'No hay avisos de cierre actuales o futuros publicados.', 'No se pudieron confirmar los avisos. Inténtelo de nuevo.', 'La sesión cambió. Abra la página con la cuenta deseada.', 'Próximo cierre', 'Cierre en curso', 'Fechas en UTC', 'Contacto de emergencia', 'Estos avisos no confirman cambios en su visita. Consulte la agenda o contacte con el equipo.', 'La lista está limitada a los primeros 100 avisos. Contacte con el equipo para confirmar los restantes.', 'Mensaje original del equipo'],
    de: ['Urlaub und Schließzeiten', 'Mitteilungen von Cristal Water zur Planung der nächsten Besuche.', 'Aktualisieren', 'Wählen Sie einen Kunden aus, um Mitteilungen zu sehen.', 'Mitteilungen werden geladen…', 'Keine aktuellen oder zukünftigen Schließzeiten veröffentlicht.', 'Die Mitteilungen konnten nicht bestätigt werden. Versuchen Sie es erneut.', 'Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem gewünschten Konto.', 'Bevorstehende Schließzeit', 'Aktuelle Schließzeit', 'Datumsangaben in UTC', 'Notfallkontakt', 'Diese Mitteilungen bestätigen keine Änderung Ihres Besuchs. Prüfen Sie den Terminplan oder kontaktieren Sie das Team.', 'Die Liste ist auf die ersten 100 Mitteilungen begrenzt. Kontaktieren Sie das Team, um die übrigen zu bestätigen.', 'Originalnachricht des Teams'],
  };
  const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  function validList(data, clientId) {
    if (!object(data) || data.ok !== true || data.version !== 1 || data.clientId !== clientId || !positive(clientId) || !iso(data.asOf) || data.timeZone !== 'UTC' || typeof data.complete !== 'boolean' || data.limit !== 100 || !Array.isArray(data.closures) || data.closures.length > 100 || !data.complete && data.closures.length !== 100) return false;
    const ids = new Set(); let previous = null;
    return data.closures.every(row => {
      if (!object(row) || !positive(row.id) || ids.has(row.id) || !iso(row.startDate) || !iso(row.endDate) || row.startDate > row.endDate || row.endDate < data.asOf || typeof row.title !== 'string' || !row.title.trim() || typeof row.message !== 'string' || ['emergencyPhone', 'emergencyEmail'].some(key => row[key] !== null && typeof row[key] !== 'string') || previous && (row.startDate < previous.startDate || row.startDate === previous.startDate && row.id < previous.id)) return false;
      ids.add(row.id); previous = row; return true;
    });
  }
  function create({ context, language }) {
    const panel = document.getElementById('clientClosuresPanel');
    if (!panel) return { sync() {} };
    const el = id => document.getElementById('clientClosure' + id), list = el('List'), refresh = el('Refresh');
    const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
    const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
    const text = index => (labels[language()] || labels.pt)[index], selection = () => JSON.stringify(context());
    let principal, invalid = false, state = 'idle', rows = [], complete = true, request = null, observed = null, locale = language();
    let checked = 0, serverTime = 0, phase = '', timer = null, suspended = false;
    try {
      const token = keys.slice(0, 3).map(key => localStorage.getItem(key)).find(Boolean);
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))), role = claims.role;
      const id = Number(role === 'CLIENT' ? claims.clientId ?? claims.id : claims.userId || claims.id);
      const users = keys.slice(3).map(key => localStorage.getItem(key)).filter(Boolean).map(JSON.parse);
      if (!['CLIENT', 'ADMIN'].includes(role) || role === 'CLIENT' && claims.principalType && claims.principalType !== 'CLIENT' || !positive(id) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || !users.length || users.some(user => user.role !== role || Number(role === 'CLIENT' ? user.clientId ?? user.id : user.userId || user.id) !== id) || keys.slice(0, 3).some(key => localStorage.getItem(key) && localStorage.getItem(key) !== token)) throw Error('Session');
      principal = { token, fingerprint: fingerprint(), expires: claims.exp * 1000, clientId: role === 'CLIENT' ? id : null };
    } catch (_) { invalid = true; state = 'session'; }
    function abort() { if (request) { request.controller.abort(); clearTimeout(request.timer); request = null; } }
    function observe() {
      try {
        if (!invalid && principal.fingerprint === fingerprint() && principal.expires > Date.now() && (principal.clientId === null || context().clientId === principal.clientId)) return true;
      } catch (_) { /* Unreadable storage also invalidates the captured session. */ }
      invalid = true; abort(); rows = []; state = 'session'; render(); return false;
    }
    const clock = () => serverTime + Math.max(0, performance.now() - checked);
    const visible = () => rows.filter(row => Date.parse(row.endDate) >= clock());
    function node(tag, content, className) { const value = document.createElement(tag); value.textContent = content; if (className) value.className = className; return value; }
    function render() {
      for (const element of panel.querySelectorAll('[data-client-closure-text]')) element.textContent = text(Number(element.dataset.clientClosureText));
      const active = state === 'ready' ? visible() : [], display = state === 'ready' ? complete ? active.length ? 'ready' : 'empty' : 'partial' : state;
      panel.dataset.state = display; panel.setAttribute('aria-busy', String(state === 'loading'));
      el('Status').textContent = ({ idle: text(3), loading: text(4), empty: text(5), error: text(6), session: text(7), partial: text(13) })[display] || '';
      el('Status').setAttribute('role', ['session', 'error'].includes(display) ? 'alert' : 'status');
      refresh.disabled = invalid || suspended || !!request || !positive(context().clientId);
      list.replaceChildren();
      const locale = ({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' })[language()] || 'pt-PT';
      for (const row of active) {
        const fullDays = row.startDate.endsWith('T00:00:00.000Z') && row.endDate.endsWith('T23:59:59.999Z');
        const date = value => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(fullDays ? {} : { timeStyle: 'medium' }), timeZone: 'UTC' }).format(new Date(value));
        const card = node('article', '', 'service-item'); card.dataset.closureId = String(row.id);
        card.append(node('span', text(Date.parse(row.startDate) > clock() ? 8 : 9), 'pill'), node('h3', row.title));
        card.append(node('p', date(row.startDate) + ' – ' + date(row.endDate) + ' · ' + text(10), 'muted'));
        card.append(node('p', text(14), 'muted'), node('p', row.message, 'client-closure-message'));
        if (row.emergencyPhone || row.emergencyEmail) {
          card.append(node('h4', text(11)));
          // Original contact text is not interpreted as HTML, URLs or mail headers.
          for (const contact of [row.emergencyPhone, row.emergencyEmail]) if (contact) card.append(node('p', contact));
        }
        list.append(card);
      }
      el('Help').hidden = !active.length;
    }
    async function load() {
      if (suspended || !observe()) return;
      abort(); rows = []; phase = '';
      const id = context().clientId;
      if (!positive(id)) { state = 'idle'; render(); return; }
      const current = { controller: new AbortController(), selection: selection(), language: language() };
      request = current; current.timer = setTimeout(() => current.controller.abort(), 15000);
      state = 'loading'; render();
      const currentSelection = () => request === current && !suspended && selection() === current.selection && language() === current.language && observe();
      try {
        const response = await fetch(`/api/client-portal/${id}/company-closures`, { headers: { Authorization: 'Bearer ' + principal.token }, cache: 'no-store', redirect: 'error', signal: current.controller.signal });
        if (!currentSelection()) return;
        if (current.controller.signal.aborted || response.status !== 200 || (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json' || response.headers.get('X-CW-Portal-Type') !== 'company-closure-list' || response.headers.get('X-CW-Client-Id') !== String(id)) throw Error('Unconfirmed notices');
        const data = await response.json();
        if (!currentSelection()) return;
        if (current.controller.signal.aborted || !validList(data, id)) throw Error('Unconfirmed notice list');
        rows = data.closures; complete = data.complete; serverTime = Date.parse(data.asOf); checked = performance.now(); state = 'ready';
      } catch (_) { if (currentSelection()) { rows = []; state = 'error'; } }
      finally { clearTimeout(current.timer); if (request === current) { request = null; render(); } }
    }
    function sync() {
      if (suspended || !observe()) return;
      const next = selection(), nextLocale = language();
      if (observed !== next || locale !== nextLocale) { observed = next; locale = nextLocale; void load(); return; }
      if (state === 'ready') {
        // Revalidate while open; a failed refresh clears the previous snapshot.
        if (performance.now() - checked >= 60000) { void load(); return; }
        const nextPhase = visible().map(row => row.id + ':' + (Date.parse(row.startDate) > clock())).join('|');
        if (phase !== nextPhase) { phase = nextPhase; render(); }
      }
    }
    const start = () => { clearInterval(timer); timer = setInterval(sync, 250); };
    refresh.addEventListener('click', () => { if (!request) void load(); });
    window.addEventListener('storage', sync);
    window.addEventListener('focus', () => { if (!suspended && observe() && !request) void load(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !suspended && observe() && !request) void load(); });
    window.addEventListener('pagehide', () => { suspended = true; clearInterval(timer); abort(); rows = []; state = 'idle'; render(); });
    window.addEventListener('pageshow', event => { if (event.persisted) { suspended = false; observed = null; start(); sync(); } });
    render(); start(); sync(); return { sync };
  }
  return { create, validList };
}));
