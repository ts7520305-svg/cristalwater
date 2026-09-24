(function () {
  'use strict';
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  const active = new Set();
  const messages = {
    INVALID_DOCUMENT: 'Documento fora da aplicação ou link inválido.',
    SESSION: 'A sessão mudou ou expirou. Entre novamente para abrir o documento.',
    POPUP: 'Permita a abertura de uma nova janela para consultar o documento.',
    UNAVAILABLE: 'A sua sessão não permite consultar este documento ou o documento já não está disponível.',
    UNCONFIRMED: 'A resposta não confirma o documento selecionado. Volte a tentar.',
    INCOMPLETE: 'O PDF recebido está incompleto. Volte a tentar.',
    TIMEOUT: 'O documento demorou demasiado. Volte a tentar.',
    CANCELLED: 'A abertura foi cancelada. Pode abrir novamente o documento.',
    RETRY: 'Não foi possível abrir o documento. Volte a tentar.'
  };
  const failure = code => Object.assign(new Error(messages[code]), { code });
  const positive = value => /^[1-9]\d{0,9}$/.test(String(value)) && Number(value) <= 2147483647;
  const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
  function principal() {
    try {
      const token = keys.slice(0, 3).map(key => localStorage.getItem(key)).find(Boolean);
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || keys.slice(0, 3).some(key => localStorage.getItem(key) && localStorage.getItem(key) !== token)) throw Error();
      const clientId = String(claims.role).toUpperCase() === 'CLIENT' ? String(claims.clientId || claims.id) : null;
      if (clientId !== null && !positive(clientId)) throw Error();
      return { token, clientId, fingerprint: fingerprint(), expires: claims.exp * 1000 };
    } catch (_) { throw failure('SESSION'); }
  }
  function target(href) {
    const url = new URL(href, location.href), p = url.pathname;
    if (url.origin !== location.origin || url.username || url.password || url.search || url.hash || href !== p && href !== url.origin + p) throw failure('INVALID_DOCUMENT');
    const definitions = [
      [/^\/api\/invoice-pdf\/([1-9]\d{0,9})$/, 'invoice-pdf', 'X-CW-Invoice-Id'],
      [/^\/api\/invoice-pdf\/extras\/([1-9]\d{0,9})$/, 'extra-billing-pdf', 'X-CW-Client-Id'],
      [/^\/api\/guides\/transport\/([1-9]\d{0,9})\/pdf$/, 'transport-guide', 'X-CW-Document-Id'],
      [/^\/api\/guides\/transport\/latest\/([1-9]\d{0,9})\/pdf$/, 'transport-guide', 'X-CW-Vehicle-Id'],
      [/^\/api\/guides\/work\/([1-9]\d{0,9})\/pdf$/, 'work-guide', 'X-CW-Document-Id'],
      [/^\/api\/guides\/vehicles\/([1-9]\d{0,9})\/insurance\/pdf$/, 'vehicle-insurance', 'X-CW-Vehicle-Id'],
      [/^\/api\/client-messages\/attachments\/([1-9]\d{0,9})$/, 'chat-attachment', 'X-CW-Message-Id']
    ];
    for (const [pattern, type, key] of definitions) {
      const match = pattern.exec(p);
      if (match && positive(match[1])) return { path: p, type, headers: { 'X-CW-Document-Type': type, [key]: match[1] }, attachment: type === 'chat-attachment' };
    }
    throw failure('INVALID_DOCUMENT');
  }
  function stop(op, code) {
    if (code && !op.reason) op.reason = failure(code);
    op.controller.abort(); clearTimeout(op.timeout); clearTimeout(op.revoke); clearInterval(op.watch);
    if (op.objectUrl) { URL.revokeObjectURL(op.objectUrl); op.objectUrl = null; }
    try { op.popup.close(); } catch (_) { /* Already closed. */ }
    active.delete(op);
  }
  function current(op) {
    try {
      if (op.principal.fingerprint !== fingerprint() || op.principal.expires <= Date.now()) stop(op, 'SESSION');
      else if (op.popup.closed) stop(op, 'CANCELLED');
    } catch (_) { stop(op, 'SESSION'); }
    if (op.reason) throw op.reason;
  }
  function observe() { for (const op of active) { try { current(op); } catch (_) { /* Fetch/UI receive the same refusal. */ } } }
  async function open(href) {
    const document = target(href), session = principal();
    // Resolve and capture the authenticated context before reserving a window.
    const popup = window.open('', '_blank');
    if (!popup) throw failure('POPUP');
    popup.opener = null;
    const op = { popup, principal: session, controller: new AbortController(), objectUrl: null };
    active.add(op);
    op.watch = setInterval(() => { try { current(op); } catch (_) {} }, 250);
    op.timeout = setTimeout(() => stop(op, 'TIMEOUT'), 20000);
    try {
      const response = await fetch(document.path, { headers: { Authorization: 'Bearer ' + session.token }, cache: 'no-store', redirect: 'error', signal: op.controller.signal });
      current(op);
      if (response.status === 401) { for (const item of active) stop(item, 'SESSION'); throw failure('SESSION'); }
      if (response.status !== 200) throw failure([403, 404].includes(response.status) ? 'UNAVAILABLE' : 'RETRY');
      const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (Object.entries(document.headers).some(([key, value]) => response.headers.get(key) !== value) ||
          response.headers.get('cache-control') !== 'private, no-store' || response.headers.get('x-content-type-options') !== 'nosniff') throw failure('UNCONFIRMED');
      if (!document.attachment) {
        if (type !== 'application/pdf') throw failure('UNCONFIRMED');
        const scopeKey = ['invoice-pdf', 'extra-billing-pdf'].includes(document.type) ? 'X-CW-Client-Id' : 'X-CW-Vehicle-Id';
        // A historical guide may have no vehicle. Its exact guide ID remains
        // authoritative; vehicle-selected routes still require the selected ID.
        const unassigned = scopeKey === 'X-CW-Vehicle-Id' && !document.headers[scopeKey] && response.headers.get(scopeKey) === 'unassigned';
        if (!positive(response.headers.get(scopeKey)) && !unassigned || document.type === 'transport-guide' && !positive(response.headers.get('X-CW-Document-Id')) ||
            session.clientId !== null && scopeKey === 'X-CW-Client-Id' && response.headers.get(scopeKey) !== session.clientId) throw failure('UNCONFIRMED');
      }
      const blob = await response.blob(); current(op);
      if (!document.attachment) {
        const start = await blob.slice(0, 5).text(), end = await blob.slice(-32).text(); current(op);
        if (start !== '%PDF-' || !/%%EOF\s*$/.test(end)) throw failure('INCOMPLETE');
      }
      if (document.attachment && !['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(type)) {
        // Preserve arbitrary attachments as inert downloads, never executable HTML/SVG.
        const fileUrl = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
        const link = window.document.createElement('a'); link.href = fileUrl;
        const plain = /filename="([^"\r\n]+)"/.exec(response.headers.get('content-disposition') || '');
        link.download = plain ? plain[1].replace(/[\\/]/g, '_') : 'anexo-' + document.path.split('/').pop();
        link.click(); stop(op); setTimeout(() => URL.revokeObjectURL(fileUrl), 60000); return;
      }
      op.objectUrl = URL.createObjectURL(blob); current(op);
      popup.location.href = op.objectUrl; clearTimeout(op.timeout);
      op.revoke = setTimeout(() => { if (op.objectUrl) { URL.revokeObjectURL(op.objectUrl); op.objectUrl = null; } }, 60000);
    } catch (error) {
      const reason = op.reason || (error.code && messages[error.code] ? error : failure('RETRY'));
      stop(op); throw reason;
    }
  }
  function cancel() { for (const op of active) stop(op, 'CANCELLED'); }
  window.addEventListener('storage', observe); window.addEventListener('focus', observe);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('pageshow', event => { if (event.persisted) cancel(); });
  document.addEventListener('click', event => {
    const link = event.target?.closest?.('a[data-auth-download]');
    if (!link) return;
    event.preventDefault();
    open(link.href).catch(error => {
      if (window.CristalAuth?.toast) window.CristalAuth.toast(error.message);
      else window.alert(error.message);
    });
  });
  window.CristalDownloads = { open, cancel };
}());
