(function () {
  'use strict';
  const labels = {
    pt: ['Relatórios mensais de visitas', 'Consulte os relatórios guardados. Os PDFs estão em português.', 'Mês', 'Todos os meses', 'Atualizar', 'Anterior', 'Seguinte', 'Abrir PDF', 'Guardado', 'Revisão necessária', 'Relatório histórico', 'Gerado em', 'Escolha um cliente para consultar os relatórios.', 'A carregar relatórios…', 'Ainda não existem relatórios mensais guardados.', 'Não existem relatórios para este mês.', 'Não foi possível confirmar os relatórios. Tente atualizar.', 'A sessão mudou. Reabra a página com a conta pretendida.', 'A preparar o PDF…', 'PDF aberto numa nova janela.', 'Não foi possível abrir o PDF. Confirme que permite novas janelas e tente novamente.', 'de'],
    en: ['Monthly visit reports', 'View saved reports. The PDFs are in Portuguese.', 'Month', 'All months', 'Refresh', 'Previous', 'Next', 'Open PDF', 'Saved', 'Review required', 'Historical report', 'Created on', 'Choose a customer to view reports.', 'Loading reports…', 'No monthly reports have been saved yet.', 'There are no reports for this month.', 'The reports could not be confirmed. Try refreshing.', 'The session changed. Reopen the page with the intended account.', 'Preparing the PDF…', 'PDF opened in a new window.', 'The PDF could not be opened. Allow new windows and try again.', 'of'],
    fr: ['Rapports mensuels des visites', 'Consultez les rapports enregistrés. Les PDF sont en portugais.', 'Mois', 'Tous les mois', 'Actualiser', 'Précédent', 'Suivant', 'Ouvrir le PDF', 'Enregistré', 'Vérification nécessaire', 'Rapport historique', 'Créé le', 'Choisissez un client pour consulter les rapports.', 'Chargement des rapports…', 'Aucun rapport mensuel enregistré.', 'Aucun rapport pour ce mois.', 'Impossible de confirmer les rapports. Réessayez.', 'La session a changé. Rouvrez la page avec le compte souhaité.', 'Préparation du PDF…', 'PDF ouvert dans une nouvelle fenêtre.', 'Impossible d’ouvrir le PDF. Autorisez les nouvelles fenêtres et réessayez.', 'sur'],
    es: ['Informes mensuales de visitas', 'Consulte los informes guardados. Los PDF están en portugués.', 'Mes', 'Todos los meses', 'Actualizar', 'Anterior', 'Siguiente', 'Abrir PDF', 'Guardado', 'Revisión necesaria', 'Informe histórico', 'Creado el', 'Seleccione un cliente para consultar los informes.', 'Cargando informes…', 'Todavía no hay informes mensuales guardados.', 'No hay informes para este mes.', 'No se pudieron confirmar los informes. Intente actualizar.', 'La sesión cambió. Abra la página con la cuenta deseada.', 'Preparando el PDF…', 'PDF abierto en una nueva ventana.', 'No se pudo abrir el PDF. Permita nuevas ventanas e inténtelo de nuevo.', 'de'],
    de: ['Monatliche Besuchsberichte', 'Gespeicherte Berichte ansehen. Die PDFs sind auf Portugiesisch.', 'Monat', 'Alle Monate', 'Aktualisieren', 'Zurück', 'Weiter', 'PDF öffnen', 'Gespeichert', 'Prüfung erforderlich', 'Historischer Bericht', 'Erstellt am', 'Wählen Sie einen Kunden aus.', 'Berichte werden geladen…', 'Noch keine monatlichen Berichte gespeichert.', 'Keine Berichte für diesen Monat.', 'Die Berichte konnten nicht bestätigt werden. Bitte erneut laden.', 'Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem gewünschten Konto.', 'PDF wird vorbereitet…', 'PDF in einem neuen Fenster geöffnet.', 'PDF konnte nicht geöffnet werden. Erlauben Sie neue Fenster und versuchen Sie es erneut.', 'von'],
  };
  const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const validMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  function create({ context, language }) {
    const root = document.getElementById('monthlyReportsPanel');
    if (!root) return { sync() {} };
    const el = id => document.getElementById('monthly' + id), list = el('List'), filter = el('Month');
    const text = index => (labels[language()] || labels.pt)[index];
    const selection = () => JSON.stringify(context());
    let rows = [], page = 0, generation = 0, selected = null, request = null, invalid = false;
    let observed = null, locale = language(), listState = 'idle', openState = 'idle';
    const reader = window.CristalReportDownloads.create({
      access: 'CLIENT_MONTHLY',
      context: () => ({ selection: context(), language: language(), generation, month: filter.value, page, selected }),
      state: kind => {
        openState = kind;
        if (kind === 'session' && !invalid) {
          invalid = true; abort(); rows = []; selected = null; filter.value = ''; listState = 'session'; render();
        }
        el('OpenStatus').dataset.state = kind;
        el('OpenStatus').textContent = kind === 'loading' ? text(18) : kind === 'opened' ? text(19) : kind === 'error' ? text(20) : kind === 'session' ? text(17) : '';
        el('OpenStatus').setAttribute('role', ['session', 'error'].includes(kind) ? 'alert' : 'status');
        controls();
      },
    });
    function abort() {
      if (request) { request.controller.abort(); clearTimeout(request.timer); request = null; }
    }
    function filtered() { return rows.filter(row => !filter.value || row.month === filter.value); }
    function controls() {
      const disabled = invalid || listState === 'loading' || !validId(context().clientId);
      for (const id of ['Month', 'Clear', 'Refresh']) el(id).disabled = disabled;
      el('Previous').disabled = disabled || page === 0;
      el('Next').disabled = disabled || (page + 1) * 6 >= filtered().length;
      for (const button of list.querySelectorAll('button')) button.disabled = disabled || openState === 'loading';
    }
    function node(tag, content, className) {
      const element = document.createElement(tag); element.textContent = content;
      if (className) element.className = className; return element;
    }
    function date(value, month = false) {
      return new Intl.DateTimeFormat(({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' })[language()] || 'pt-PT',
        month ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(month ? value + '-01T00:00:00Z' : value));
    }
    function render() {
      for (const element of root.querySelectorAll('[data-monthly-text]')) element.textContent = text(Number(element.dataset.monthlyText));
      root.dataset.state = listState; root.setAttribute('aria-busy', String(listState === 'loading'));
      el('Status').textContent = ({ idle: text(12), loading: text(13), error: text(16), session: text(17) })[listState] || '';
      el('Status').setAttribute('role', ['error', 'session'].includes(listState) ? 'alert' : 'status');
      list.replaceChildren();
      const all = filtered(), visible = all.slice(page * 6, (page + 1) * 6);
      if (listState === 'ready') {
        if (!all.length) list.append(node('p', text(filter.value ? 15 : 14), 'empty'));
        for (const row of visible) {
          const card = node('article', '', 'service-item'); card.dataset.reportId = String(row.id);
          const head = node('div', '', 'cw-monthly-heading');
          head.append(node('h4', date(row.month, true)), node('span', text(row.data?.reportVersion === 2 ? row.data.reviewRequired ? 9 : 8 : 10), 'pill'));
          card.append(head, node('p', text(11) + ' ' + date(row.createdAt), 'muted'));
          const button = node('button', text(7), 'btn primary'); button.type = 'button';
          button.setAttribute('aria-label', text(7) + ': ' + date(row.month, true));
          button.addEventListener('click', () => {
            if (invalid || request || !reader.observe() || !rows.includes(row) || observed !== selection()) return;
            selected = row.id;
            reader.open(`/api/client-reports/${row.clientId}/reports/${row.id}/pdf`, { type: 'application/pdf', headers: {
              'Content-Language': 'pt', 'X-CW-Report-Type': 'client-monthly-pdf', 'X-CW-Client-Id': row.clientId, 'X-CW-Report-Id': row.id, 'X-CW-Month-Ref': row.month,
            } });
          });
          card.append(button); list.append(card);
        }
      }
      el('Pagination').hidden = listState !== 'ready' || !all.length;
      el('Summary').textContent = all.length ? `${page * 6 + 1}–${Math.min((page + 1) * 6, all.length)} ${text(21)} ${all.length}` : '';
      controls();
    }
    async function load() {
      if (invalid || !reader.observe()) return;
      abort(); ++generation; selected = null; reader.cancel(); rows = []; page = 0;
      const id = context().clientId;
      if (!validId(id)) { listState = 'idle'; render(); return; }
      const current = { controller: new AbortController(), key: selection(), locale: language() };
      request = current; current.timer = setTimeout(() => current.controller.abort(), 20000);
      listState = 'loading'; render();
      const active = () => !invalid && request === current && selection() === current.key && language() === current.locale;
      try {
        const data = await reader.readList(`/api/client-reports/${id}/reports`, current.controller.signal);
        if (!active()) return;
        const ids = new Set();
        if (!Array.isArray(data?.reports) || data.count !== data.reports.length || data.reports.some(row => {
          if (!validId(row?.id) || ids.has(row.id) || row.clientId !== id || row.type !== 'CLIENT' || !validMonth(row.month) ||
              typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)) || row.data?.reportVersion === 2 && typeof row.data.reviewRequired !== 'boolean') return true;
          ids.add(row.id); return false;
        })) throw Error('Unconfirmed report list');
        rows = data.reports.slice().sort((a, b) => b.month.localeCompare(a.month) || b.id - a.id); listState = 'ready';
      } catch (_) { if (active()) { rows = []; listState = 'error'; } }
      finally { clearTimeout(current.timer); if (request === current) { request = null; render(); } }
    }
    function sync() {
      reader.observe(); if (invalid) return;
      const next = selection(), nextLocale = language();
      if (observed !== next || locale !== nextLocale) {
        if (observed !== next) filter.value = '';
        observed = next; locale = nextLocale; void load();
      }
    }
    function changePage(next) { page = next; selected = null; reader.cancel(); render(); }
    filter.addEventListener('change', () => changePage(0));
    filter.addEventListener('input', () => changePage(0));
    el('Clear').addEventListener('click', () => { filter.value = ''; changePage(0); });
    el('Previous').addEventListener('click', () => { if (page > 0) changePage(page - 1); });
    el('Next').addEventListener('click', () => { if ((page + 1) * 6 < filtered().length) changePage(page + 1); });
    el('Refresh').addEventListener('click', () => { if (!request) void load(); });
    let timer = setInterval(sync, 250);
    window.addEventListener('pagehide', () => { abort(); clearInterval(timer); rows = []; selected = null; listState = 'idle'; render(); });
    window.addEventListener('pageshow', event => { if (event.persisted) { observed = null; timer = setInterval(sync, 250); sync(); } });
    sync(); return { sync };
  }
  window.CWClientMonthlyReports = { create };
}());
