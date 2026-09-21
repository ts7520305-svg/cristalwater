(function () {
  'use strict';
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
  function session(access) {
    const token = keys.slice(0, 3).map(key => localStorage.getItem(key)).find(Boolean) || '';
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const client = ['CLIENT_MONTHLY', 'CLIENT_DOCUMENTS'].includes(access) && claims.role === 'CLIENT';
    const role = client ? 'CLIENT' : 'ADMIN';
    const userId = Number(client ? claims.clientId ?? claims.id : claims.userId || claims.id);
    const users = keys.slice(3).map(key => localStorage.getItem(key)).filter(Boolean).map(JSON.parse);
    if (claims.role !== role || client && claims.principalType && claims.principalType !== 'CLIENT' || !Number.isSafeInteger(userId) || userId < 1 || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() ||
        keys.slice(0, 3).some(key => localStorage.getItem(key) && localStorage.getItem(key) !== token) ||
        !users.length || users.some(user => user.role !== role || Number(client ? user.clientId ?? user.id : user.userId || user.id) !== userId)) throw Error('Sessão não confirmada. Reabra a página com a conta pretendida.');
    return { token, identity: fingerprint(), expires: claims.exp * 1000, clientId: client ? userId : null };
  }
  function create({ context, state, access = 'ADMIN_REPORTS' }) {
    let principal, invalid = false, operation = null;
    try { principal = session(access); } catch (_) { invalid = true; }
    const sameSession = () => !invalid && principal && principal.identity === fingerprint() && principal.expires > Date.now();
    const snapshot = () => JSON.stringify(context());
    function close(op) {
      op.controller.abort(); clearTimeout(op.timeout); clearTimeout(op.expiry); clearInterval(op.watch);
      if (op.objectUrl) { URL.revokeObjectURL(op.objectUrl); op.objectUrl = null; }
      try { op.popup?.close(); } catch (_) { /* Window may already be gone. */ }
    }
    function cancel(message = 'A seleção mudou. Abra novamente o relatório pretendido.', kind = 'idle') {
      if (operation) { close(operation); operation = null; }
      state(kind, message);
    }
    function observe() {
      try {
        if (!sameSession()) { invalid = true; cancel('A sessão mudou. Reabra a página com a conta pretendida.', 'session'); return false; }
        if (operation && operation.context !== snapshot()) { cancel(); return false; }
        if (operation?.popup?.closed) { cancel('A janela foi fechada. Pode abrir novamente o relatório.'); return false; }
      } catch (_) { cancel(); return false; }
      return true;
    }
    function clientUrl(href, file) {
      const url = new URL(href, location.href);
      const documents = access === 'CLIENT_DOCUMENTS';
      const pattern = documents
        ? file ? /^\/api\/client-portal\/([1-9]\d{0,9})\/documents\/([1-9]\d{0,15})\/download$/ : /^\/api\/client-portal\/([1-9]\d{0,9})\/documents$/
        : file ? /^\/api\/client-reports\/([1-9]\d{0,9})\/reports\/([1-9]\d{0,9})\/pdf$/ : /^\/api\/client-reports\/([1-9]\d{0,9})\/reports$/;
      const match = pattern.exec(url.pathname);
      if (!['CLIENT_MONTHLY', 'CLIENT_DOCUMENTS'].includes(access) || url.origin !== location.origin || url.username || url.password || url.hash || url.search || !match ||
          Number(match[1]) > 2147483647 || match[2] && (!Number.isSafeInteger(Number(match[2])) || !documents && Number(match[2]) > 2147483647) ||
          principal.clientId !== null && Number(match[1]) !== principal.clientId || documents && href !== url.pathname && href !== url.origin + url.pathname) throw Error('Cliente do documento não confirmado.');
      return { url, clientId: match[1], documentId: match[2] };
    }
    async function readList(href, signal) {
      if (!observe()) throw Error('Sessão não confirmada.');
      const { url, clientId } = clientUrl(href, false), selection = snapshot();
      const current = () => { if (signal?.aborted || !observe() || selection !== snapshot()) throw Error('A seleção mudou.'); };
      const response = await fetch(url.pathname, { headers: { Authorization: 'Bearer ' + principal.token }, cache: 'no-store', redirect: 'error', signal });
      current();
      if (response.status !== 200 || (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json' ||
          response.headers.get(access === 'CLIENT_DOCUMENTS' ? 'X-CW-Document-Type' : 'X-CW-Report-Type') !== (access === 'CLIENT_DOCUMENTS' ? 'client-document-list' : 'client-monthly-list') ||
          response.headers.get('X-CW-Client-Id') !== clientId) throw Error('A resposta não confirma os documentos deste cliente.');
      const data = await response.json(); current(); return data;
    }
    async function open(href, expected) {
      // Retire any old selection, then honor this fresh click in the same session.
      observe();
      try { if (!sameSession()) return; } catch (_) { return; }
      if (operation?.loading) return;
      let op;
      try {
        const url = new URL(href, location.href);
        const attachment = access === 'CLIENT_DOCUMENTS';
        const scope = ['CLIENT_MONTHLY', 'CLIENT_DOCUMENTS'].includes(access) ? clientUrl(href, true) : null;
        const allowed = scope || /^\/api\/report-visit\/visit\/[1-9]\d*$/.test(url.pathname) || url.pathname === '/api/reports/monthly-print';
        if (url.origin !== location.origin || !allowed || url.username || url.password || url.hash) throw Error('Relatório fora da aplicação.');
        const selection = snapshot();
        if (operation) { close(operation); operation = null; }
        // Reserve the window inside the click gesture, before any asynchronous work.
        const popup = attachment ? null : window.open('', '_blank');
        if (!attachment && !popup) throw Error('A janela foi bloqueada. Permita novas janelas para esta aplicação e volte a abrir o relatório.');
        if (popup) popup.opener = null;
        op = { popup, context: selection, controller: new AbortController(), loading: true, objectUrl: null };
        operation = op;
        op.watch = setInterval(observe, 250);
        op.timeout = setTimeout(() => { if (operation === op) cancel('O relatório demorou demasiado. Tente abrir novamente.', 'error'); }, 20000);
        state('loading', 'A preparar o relatório…');
        const headers = { ...expected.headers };
        if (attachment) Object.assign(headers, { 'X-CW-Document-Type': 'client-document-file', 'X-CW-Client-Id': scope.clientId, 'X-CW-Document-Id': scope.documentId });
        let preferredLanguage = null;
        if (expected.clientPreference !== undefined) {
          const clientId = expected.clientPreference;
          if (!Number.isSafeInteger(clientId) || clientId < 1 || clientId > 2147483647 || !url.pathname.startsWith('/api/report-visit/visit/') || url.searchParams.get('clientId') !== String(clientId) || url.searchParams.has('lang')) throw Error('Cliente do relatório não confirmado.');
          const settingsResponse = await fetch('/api/report-settings/' + clientId, { headers: { Authorization: 'Bearer ' + principal.token }, cache: 'no-store', redirect: 'error', signal: op.controller.signal });
          if (!observe() || operation !== op) return;
          if (settingsResponse.status !== 200) throw Error('Não foi possível confirmar o idioma do cliente. Tente novamente.');
          const settings = await settingsResponse.json();
          if (!observe() || operation !== op) return;
          if (settings?.ok !== true || settings.reportSettingsVersion !== 1 || settings.client?.id !== clientId || !['pt', 'en', 'fr', 'es'].includes(settings.preferredLanguage) || typeof settings.version !== 'string' || !/^report-settings-v1:[a-f0-9]{64}$/.test(settings.version)) throw Error('A resposta não confirma o idioma deste cliente.');
          preferredLanguage = settings.preferredLanguage;
          url.searchParams.set('lang', preferredLanguage);
          url.searchParams.set('settingsVersion', settings.version);
          headers['Content-Language'] = preferredLanguage;
          headers['X-CW-Settings-Version'] = settings.version;
        }
        const response = await fetch(url.pathname + url.search, { headers: { Authorization: 'Bearer ' + principal.token }, cache: 'no-store', redirect: 'error', signal: op.controller.signal });
        if (!observe() || operation !== op) return;
        if (response.status !== 200) throw Error(response.status === 409 ? 'O cliente ou as configurações mudaram. Carregue novamente antes de abrir o relatório.' : [401, 403].includes(response.status) ? 'A sessão não permite abrir este relatório. Confirme a conta.' : 'Não foi possível preparar o relatório. Tente novamente.');
        const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (type !== expected.type || Object.entries(headers).some(([key, value]) => response.headers.get(key) !== String(value))) throw Error('A resposta não confirma o relatório selecionado. Tente novamente.');
        const disposition = response.headers.get('content-disposition') || '';
        if (attachment && (type !== 'application/octet-stream' || !/^attachment(?:\s*;|\s*$)/i.test(disposition))) throw Error('A resposta não confirma uma transferência de ficheiro.');
        const blob = await response.blob();
        if (!observe() || operation !== op) return;
        if (attachment) {
          const length = response.headers.get('content-length');
          if (length !== null && !response.headers.get('content-encoding') && (!/^(0|[1-9]\d*)$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) !== blob.size)) throw Error('O ficheiro recebido está incompleto.');
        } else {
          if (!blob.size) throw Error('O relatório recebido está vazio. Tente novamente.');
          const prefix = await blob.slice(0, 1024).text();
          const tail = await blob.slice(-1024).text();
          if (type === 'application/pdf' ? !prefix.startsWith('%PDF-') || !/%%EOF\s*$/.test(tail) : !/^\s*<!doctype html>/i.test(prefix) || !/<\/html>\s*$/i.test(tail)) throw Error('O ficheiro recebido não é um relatório válido.');
        }
        if (!observe() || operation !== op) return;
        op.objectUrl = URL.createObjectURL(blob);
        if (!observe() || operation !== op) return;
        if (attachment) {
          let filename = /;\s*filename="((?:\\.|[^"\\])*)"/i.exec(disposition)?.[1]?.replace(/\\(.)/g, '$1') || /;\s*filename=([^;\s]+)/i.exec(disposition)?.[1] || '';
          const encoded = /;\s*filename\*=UTF-8''([^;\s]+)/i.exec(disposition)?.[1];
          if (encoded) { try { filename = decodeURIComponent(encoded); } catch (_) { /* Use the plain filename when available. */ } }
          filename = filename.replace(/[\\/:*?"<>|\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '_').trim().replace(/^\.+|\.+$/g, '').slice(0, 240) || 'documento-' + scope.documentId;
          const link = document.createElement('a'); link.href = op.objectUrl; link.download = filename; link.hidden = true;
          document.body.append(link);
          try { link.click(); } finally { link.remove(); }
        } else popup.location.href = op.objectUrl;
        op.loading = false; clearTimeout(op.timeout);
        op.expiry = setTimeout(() => { if (op.objectUrl) { URL.revokeObjectURL(op.objectUrl); op.objectUrl = null; } }, 60000);
        state(attachment ? 'started' : 'opened', attachment ? 'Transferência iniciada.' : 'Relatório aberto numa nova janela.' + (preferredLanguage ? ' Idioma do cliente: ' + ({ pt: 'Português', en: 'English', fr: 'Français', es: 'Español' })[preferredLanguage] + '.' : ''));
      } catch (error) {
        if (op && operation !== op) return;
        if (op && !observe()) return;
        if (op) { close(op); operation = null; }
        state('error', error.name === 'AbortError' ? 'A abertura foi interrompida. Tente novamente.' : error.message || 'Não foi possível abrir o relatório.');
      }
    }
    window.addEventListener('storage', observe); window.addEventListener('focus', observe);
    window.addEventListener('pagehide', () => cancel('Abra novamente o relatório ao regressar à página.'));
    window.addEventListener('pageshow', event => { if (event.persisted) { cancel('Confirme a seleção e abra novamente o relatório.'); observe(); } });
    document.addEventListener('visibilitychange', observe);
    return { open, cancel, observe, readList, download: href => {
      if (access !== 'CLIENT_DOCUMENTS') throw Error('Transferência indisponível neste leitor.');
      return open(href, { type: 'application/octet-stream' });
    } };
  }
  window.CristalReportDownloads = { create };
}());
