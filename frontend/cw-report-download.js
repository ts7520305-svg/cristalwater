(function () {
  'use strict';
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
  function session() {
    const token = keys.slice(0, 3).map(key => localStorage.getItem(key)).find(Boolean) || '';
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const userId = Number(claims.userId || claims.id);
    const users = keys.slice(3).map(key => localStorage.getItem(key)).filter(Boolean).map(JSON.parse);
    if (claims.role !== 'ADMIN' || !Number.isSafeInteger(userId) || userId < 1 || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() ||
        keys.slice(0, 3).some(key => localStorage.getItem(key) && localStorage.getItem(key) !== token) ||
        !users.length || users.some(user => user.role !== 'ADMIN' || Number(user.userId || user.id) !== userId)) throw Error('Sessão não confirmada. Reabra a página com a conta pretendida.');
    return { token, identity: fingerprint(), expires: claims.exp * 1000 };
  }
  function create({ context, state }) {
    let principal, invalid = false, operation = null;
    try { principal = session(); } catch (_) { invalid = true; }
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
    async function open(href, expected) {
      if (!observe()) return;
      if (operation?.loading) return;
      let op;
      try {
        const url = new URL(href, location.href);
        const allowed = /^\/api\/report-visit\/visit\/[1-9]\d*$/.test(url.pathname) || url.pathname === '/api/reports/monthly-print';
        if (url.origin !== location.origin || !allowed || url.username || url.password || url.hash) throw Error('Relatório fora da aplicação.');
        const selection = snapshot();
        if (operation) { close(operation); operation = null; }
        // Reserve the window inside the click gesture, before any asynchronous work.
        const popup = window.open('', '_blank');
        if (!popup) throw Error('A janela foi bloqueada. Permita novas janelas para esta aplicação e volte a abrir o relatório.');
        popup.opener = null;
        op = { popup, context: selection, controller: new AbortController(), loading: true, objectUrl: null };
        operation = op;
        op.watch = setInterval(observe, 250);
        op.timeout = setTimeout(() => { if (operation === op) cancel('O relatório demorou demasiado. Tente abrir novamente.', 'error'); }, 20000);
        state('loading', 'A preparar o relatório…');
        const response = await fetch(url.pathname + url.search, { headers: { Authorization: 'Bearer ' + principal.token }, cache: 'no-store', redirect: 'error', signal: op.controller.signal });
        if (!observe() || operation !== op) return;
        if (response.status !== 200) throw Error(response.status === 409 ? 'O cliente ou as configurações mudaram. Carregue novamente antes de abrir o relatório.' : [401, 403].includes(response.status) ? 'A sessão não permite abrir este relatório. Confirme a conta.' : 'Não foi possível preparar o relatório. Tente novamente.');
        const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (type !== expected.type || Object.entries(expected.headers).some(([key, value]) => response.headers.get(key) !== String(value))) throw Error('A resposta não confirma o relatório selecionado. Tente novamente.');
        const blob = await response.blob();
        if (!observe() || operation !== op) return;
        if (!blob.size) throw Error('O relatório recebido está vazio. Tente novamente.');
        const prefix = await blob.slice(0, 1024).text();
        const tail = await blob.slice(-1024).text();
        if (type === 'application/pdf' ? !prefix.startsWith('%PDF-') || !/%%EOF\s*$/.test(tail) : !/^\s*<!doctype html>/i.test(prefix) || !/<\/html>\s*$/i.test(tail)) throw Error('O ficheiro recebido não é um relatório válido.');
        if (!observe() || operation !== op) return;
        op.objectUrl = URL.createObjectURL(blob);
        if (!observe() || operation !== op) return;
        popup.location.href = op.objectUrl;
        op.loading = false; clearTimeout(op.timeout);
        op.expiry = setTimeout(() => { if (op.objectUrl) { URL.revokeObjectURL(op.objectUrl); op.objectUrl = null; } }, 60000);
        state('opened', 'Relatório aberto numa nova janela.');
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
    return { open, cancel, observe };
  }
  window.CristalReportDownloads = { create };
}());
