(function () {
  'use strict';
  const labels = {
    pt: ['Documentos disponíveis', 'Pesquise e transfira os ficheiros partilhados consigo.', 'Pesquisar por título, tipo ou nome do ficheiro', 'Limpar pesquisa', 'Atualizar', 'Anterior', 'Seguinte', 'Transferir', 'Documento', 'Guardado em', 'Escolha um cliente para consultar os documentos.', 'A carregar documentos…', 'Ainda não existem documentos disponíveis.', 'Não existem documentos para esta pesquisa.', 'Não foi possível confirmar os documentos. Tente novamente.', 'A sessão mudou. Reabra a página com a conta pretendida.', 'A preparar o ficheiro…', 'Transferência iniciada. Consulte as transferências do navegador.', 'Não foi possível transferir o ficheiro. Atualize a lista e tente novamente.', 'de', 'Tentar novamente'],
    en: ['Available documents', 'Search and download the files shared with you.', 'Search by title, type or filename', 'Clear search', 'Refresh', 'Previous', 'Next', 'Download', 'Document', 'Saved on', 'Choose a customer to view documents.', 'Loading documents…', 'No documents are available yet.', 'No documents match this search.', 'The documents could not be confirmed. Please try again.', 'The session changed. Reopen the page with the intended account.', 'Preparing the file…', 'Download started. Check your browser downloads.', 'The file could not be downloaded. Refresh the list and try again.', 'of', 'Try again'],
    fr: ['Documents disponibles', 'Recherchez et téléchargez les fichiers partagés avec vous.', 'Rechercher par titre, type ou nom de fichier', 'Effacer la recherche', 'Actualiser', 'Précédent', 'Suivant', 'Télécharger', 'Document', 'Enregistré le', 'Choisissez un client pour consulter les documents.', 'Chargement des documents…', 'Aucun document disponible pour le moment.', 'Aucun document ne correspond à cette recherche.', 'Impossible de confirmer les documents. Réessayez.', 'La session a changé. Rouvrez la page avec le compte souhaité.', 'Préparation du fichier…', 'Téléchargement lancé. Consultez les téléchargements du navigateur.', 'Impossible de télécharger le fichier. Actualisez la liste et réessayez.', 'sur', 'Réessayer'],
    es: ['Documentos disponibles', 'Busque y descargue los archivos compartidos con usted.', 'Buscar por título, tipo o nombre de archivo', 'Borrar búsqueda', 'Actualizar', 'Anterior', 'Siguiente', 'Descargar', 'Documento', 'Guardado el', 'Seleccione un cliente para consultar los documentos.', 'Cargando documentos…', 'Todavía no hay documentos disponibles.', 'No hay documentos para esta búsqueda.', 'No se pudieron confirmar los documentos. Inténtelo de nuevo.', 'La sesión cambió. Abra la página con la cuenta deseada.', 'Preparando el archivo…', 'Descarga iniciada. Consulte las descargas del navegador.', 'No se pudo descargar el archivo. Actualice la lista e inténtelo de nuevo.', 'de', 'Reintentar'],
    de: ['Verfügbare Dokumente', 'Suchen und laden Sie die mit Ihnen geteilten Dateien herunter.', 'Nach Titel, Typ oder Dateiname suchen', 'Suche löschen', 'Aktualisieren', 'Zurück', 'Weiter', 'Herunterladen', 'Dokument', 'Gespeichert am', 'Wählen Sie einen Kunden aus.', 'Dokumente werden geladen…', 'Noch keine Dokumente verfügbar.', 'Keine Dokumente für diese Suche.', 'Die Dokumente konnten nicht bestätigt werden. Versuchen Sie es erneut.', 'Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem gewünschten Konto.', 'Datei wird vorbereitet…', 'Download gestartet. Prüfen Sie die Downloads des Browsers.', 'Die Datei konnte nicht heruntergeladen werden. Aktualisieren Sie die Liste und versuchen Sie es erneut.', 'von', 'Erneut versuchen'],
  };
  const validClient = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const documentId = value => ['number', 'string'].includes(typeof value) && /^[1-9]\d{0,15}$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? String(value) : null;
  const plain = value => typeof value === 'string' ? value : '';
  const searchable = value => plain(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  function create({ context, language }) {
    const root = document.getElementById('clientDocumentsPanel');
    if (!root) return { sync() {} };
    const el = id => document.getElementById('document' + id), list = el('List'), filter = el('Search');
    const text = index => (labels[language()] || labels.pt)[index], selection = () => JSON.stringify(context());
    let rows = [], page = 0, generation = 0, selected = null, request = null, invalid = false;
    let observed = null, locale = language(), listState = 'idle', downloadState = 'idle';
    const reader = window.CristalReportDownloads.create({
      access: 'CLIENT_DOCUMENTS',
      context: () => ({ selection: context(), language: language(), generation, search: filter.value, page, selected }),
      state: kind => {
        downloadState = kind;
        if (kind === 'session' && !invalid) {
          invalid = true; abort(); rows = []; selected = null; filter.value = ''; listState = 'session'; render();
        }
        el('DownloadStatus').dataset.state = kind;
        el('DownloadStatus').textContent = ({ loading: text(16), started: text(17), error: text(18), session: text(15) })[kind] || '';
        el('DownloadStatus').setAttribute('role', ['session', 'error'].includes(kind) ? 'alert' : 'status');
        controls();
      },
    });
    function abort() {
      if (request) { request.controller.abort(); clearTimeout(request.timer); request = null; }
    }
    function filtered() {
      const query = searchable(filter.value).trim();
      return rows.filter(row => !query || [row.title, row.type, row.originalName].some(value => searchable(value).includes(query)));
    }
    function controls() {
      const disabled = invalid || listState === 'loading' || !validClient(context().clientId);
      for (const id of ['Search', 'Clear', 'Refresh']) el(id).disabled = disabled;
      el('Previous').disabled = disabled || page === 0;
      el('Next').disabled = disabled || (page + 1) * 6 >= filtered().length;
      for (const button of list.querySelectorAll('button')) button.disabled = disabled || downloadState === 'loading';
    }
    function node(tag, content, className) {
      const element = document.createElement(tag); element.textContent = content;
      if (className) element.className = className; return element;
    }
    function render() {
      for (const element of root.querySelectorAll('[data-document-text]')) element.textContent = text(Number(element.dataset.documentText));
      root.dataset.state = listState; root.setAttribute('aria-busy', String(listState === 'loading'));
      el('Status').textContent = ({ idle: text(10), loading: text(11), session: text(15) })[listState] || '';
      el('Status').setAttribute('role', listState === 'session' ? 'alert' : 'status');
      list.replaceChildren();
      const all = filtered();
      if (listState === 'error') {
        const message = node('p', text(14)); message.setAttribute('role', 'alert');
        const retry = node('button', text(20), 'btn'); retry.type = 'button'; retry.addEventListener('click', () => { void load(); });
        list.append(message, retry);
      }
      if (listState === 'ready') {
        if (!all.length) list.append(node('p', text(filter.value.trim() ? 13 : 12), 'empty'));
        for (const row of all.slice(page * 6, (page + 1) * 6)) {
          const card = node('article', '', 'service-item'); card.dataset.documentId = String(row.id);
          const title = plain(row.title) || plain(row.originalName) || text(8);
          card.append(node('h4', title), node('p', plain(row.type) || text(8), 'muted'));
          if (row.originalName && row.originalName !== title) card.append(node('p', plain(row.originalName), 'muted'));
          if (typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))) {
            const date = new Intl.DateTimeFormat(({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' })[language()] || 'pt-PT', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(row.createdAt));
            card.append(node('p', text(9) + ' ' + date, 'muted'));
          }
          if (row.notes) card.append(node('p', plain(row.notes)));
          const button = node('button', text(7), 'btn primary'); button.type = 'button'; button.setAttribute('aria-label', text(7) + ': ' + title);
          button.addEventListener('click', () => {
            if (invalid || request || !reader.observe() || !rows.includes(row) || observed !== selection()) return;
            selected = String(row.id); void reader.download(row.downloadUrl);
          });
          card.append(button); list.append(card);
        }
      }
      el('Pagination').hidden = listState !== 'ready' || !all.length;
      el('Summary').textContent = all.length ? `${page * 6 + 1}–${Math.min((page + 1) * 6, all.length)} ${text(19)} ${all.length}` : '';
      controls();
    }
    async function load() {
      if (invalid || !reader.observe()) return;
      abort(); ++generation; selected = null; reader.cancel(); rows = []; page = 0;
      const id = context().clientId;
      if (!validClient(id)) { listState = 'idle'; render(); return; }
      const current = { controller: new AbortController(), key: selection(), locale: language() };
      request = current; current.timer = setTimeout(() => current.controller.abort(), 20000);
      listState = 'loading'; render();
      const active = () => !invalid && request === current && selection() === current.key && language() === current.locale;
      try {
        const data = await reader.readList(`/api/client-portal/${id}/documents`, current.controller.signal);
        if (!active()) return;
        const ids = new Set();
        if (data?.ok !== true || !Array.isArray(data.documents) || data.documents.some(row => {
          const key = documentId(row?.id), url = `/api/client-portal/${id}/documents/${key}/download`;
          if (!key || ids.has(key) || row.clientId != null && documentId(row.clientId) !== String(id) || row.downloadUrl !== url || row.url !== url) return true;
          ids.add(key); return false;
        })) throw Error('Unconfirmed document list');
        const time = row => typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt)) ? Date.parse(row.createdAt) : 0;
        rows = data.documents.slice().sort((a, b) => time(b) - time(a) || Number(b.id) - Number(a.id)); listState = 'ready';
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
  window.CWClientDocuments = { create };
}());
