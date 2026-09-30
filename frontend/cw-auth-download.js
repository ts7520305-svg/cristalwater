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
    INCOMPLETE: 'O documento recebido está incompleto. Volte a tentar.',
    TIMEOUT: 'O documento demorou demasiado. Volte a tentar.',
    CANCELLED: 'A abertura foi cancelada. Pode abrir novamente o documento.',
    RETRY: 'Não foi possível abrir o documento. Volte a tentar.'
  };
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
    INVALID_DOCUMENT: [messages.INVALID_DOCUMENT, 'The document is outside the application or the link is invalid.', 'Le document est hors de l’application ou le lien est invalide.', 'El documento está fuera de la aplicación o el enlace no es válido.', 'Das Dokument liegt außerhalb der Anwendung oder der Link ist ungültig.'],
    SESSION: [messages.SESSION, 'The session has changed or expired. Sign in again to open the document.', 'La session a changé ou a expiré. Connectez-vous à nouveau pour ouvrir le document.', 'La sesión ha cambiado o ha caducado. Inicia sesión de nuevo para abrir el documento.', 'Die Sitzung hat sich geändert oder ist abgelaufen. Melden Sie sich erneut an, um das Dokument zu öffnen.'],
    POPUP: [messages.POPUP, 'Allow a new window to open to view the document.', 'Autorisez l’ouverture d’une nouvelle fenêtre pour consulter le document.', 'Permite abrir una nueva ventana para consultar el documento.', 'Erlauben Sie das Öffnen eines neuen Fensters, um das Dokument anzusehen.'],
    UNAVAILABLE: [messages.UNAVAILABLE, 'Your session does not permit access to this document, or it is no longer available.', 'Votre session ne permet pas de consulter ce document ou il n’est plus disponible.', 'Tu sesión no permite consultar este documento o ya no está disponible.', 'Ihre Sitzung erlaubt keinen Zugriff auf dieses Dokument oder es ist nicht mehr verfügbar.'],
    UNCONFIRMED: [messages.UNCONFIRMED, 'The response does not confirm the selected document. Try again.', 'La réponse ne confirme pas le document sélectionné. Réessayez.', 'La respuesta no confirma el documento seleccionado. Vuelve a intentarlo.', 'Die Antwort bestätigt das ausgewählte Dokument nicht. Versuchen Sie es erneut.'],
    INCOMPLETE: [messages.INCOMPLETE, 'The received document is incomplete. Try again.', 'Le document reçu est incomplet. Réessayez.', 'El documento recibido está incompleto. Vuelve a intentarlo.', 'Das empfangene Dokument ist unvollständig. Versuchen Sie es erneut.'],
    TIMEOUT: [messages.TIMEOUT, 'The document took too long. Try again.', 'Le document a mis trop de temps à arriver. Réessayez.', 'El documento ha tardado demasiado. Vuelve a intentarlo.', 'Das Dokument hat zu lange gebraucht. Versuchen Sie es erneut.'],
    CANCELLED: [messages.CANCELLED, 'Opening was cancelled. You can open the document again.', 'L’ouverture a été annulée. Vous pouvez ouvrir à nouveau le document.', 'Se ha cancelado la apertura. Puedes abrir el documento de nuevo.', 'Das Öffnen wurde abgebrochen. Sie können das Dokument erneut öffnen.'],
    RETRY: [messages.RETRY, 'The document could not be opened. Try again.', 'Impossible d’ouvrir le document. Réessayez.', 'No se ha podido abrir el documento. Vuelve a intentarlo.', 'Das Dokument konnte nicht geöffnet werden. Versuchen Sie es erneut.']
  };
  const errorCopies = new WeakMap(), copyCodes = new WeakMap();
  const presentation = {
    error: error => errorCopies.get(error) || null,
    format(entry, language = document.documentElement.lang || 'pt') {
      if (!copyCodes.has(entry)) return String(entry ?? '');
      const index = Math.max(0, languages.indexOf(String(language).toLowerCase().split('-')[0]));
      return copy[copyCodes.get(entry)][index];
    }
  };
  const failure = code => {
    const error = Object.assign(new Error(messages[code]), { code }), entry = Object.freeze({});
    errorCopies.set(error, entry); copyCodes.set(entry, code); return error;
  };
  let notice = null;
  function releaseNotice() {
    if (!notice) return;
    notice.node.removeAttribute('data-cw-download-copy');
    if (!notice.protected) notice.node.removeAttribute('data-cw-no-i18n');
    notice = null;
  }
  function paintNotice() {
    if (!notice) return;
    const { node } = notice;
    if (!node.isConnected || node.style.display === 'none' || node.textContent !== notice.rendered || node.firstChild !== notice.textNode) { releaseNotice(); return; }
    const rendered = presentation.format(notice.entry);
    if (node.textContent !== rendered) node.textContent = rendered;
    notice.rendered = rendered; notice.textNode = node.firstChild;
  }
  const noticeObserver = new MutationObserver(paintNotice);
  noticeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('cw-language-change', paintNotice);
  function announce(error) {
    releaseNotice();
    const entry = presentation.error(error), rendered = entry ? presentation.format(entry) : error.message;
    if (window.CristalAuth?.toast) {
      window.CristalAuth.toast(rendered);
      const node = document.getElementById('cw-v21-toast');
      if (!entry || !node || node.textContent !== rendered) return;
      notice = { node, entry, rendered, textNode: node.firstChild, protected: node.hasAttribute('data-cw-no-i18n') };
      node.setAttribute('data-cw-download-copy', ''); node.setAttribute('data-cw-no-i18n', '');
      // Release ownership if another producer replaces or hides the same toast.
      noticeObserver.observe(node, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    } else window.alert(rendered);
  }
  const positive = value => /^[1-9]\d{0,9}$/.test(String(value)) && Number(value) <= 2147483647;
  const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
  function principal() {
    try {
      const token = keys.slice(0, 3).map(key => localStorage.getItem(key)).find(Boolean);
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || keys.slice(0, 3).some(key => localStorage.getItem(key) && localStorage.getItem(key) !== token)) throw Error();
      const clientId = String(claims.role).toUpperCase() === 'CLIENT' ? String(claims.clientId || claims.id) : null;
      if (clientId !== null && !positive(clientId)) throw Error();
      const role=String(claims.role).toUpperCase(),user=String(claims.userId||claims.id),tech=String(claims.technicianId||claims.id);
      const owner=role==='ADMIN'&&positive(user)?'ADMIN:'+user:['TECHNICIAN','TEAM_LEADER'].includes(role)&&positive(tech)?(claims.principalType==='USER'&&positive(user)?'USER:'+user+':TECH:'+tech:'TECH:'+tech):null;
      return { token, clientId, owner, fingerprint: fingerprint(), expires: claims.exp * 1000 };
    } catch (_) { throw failure('SESSION'); }
  }
  function target(href) {
    const url = new URL(href, location.href), p = url.pathname;
    if (url.origin !== location.origin || url.username || url.password || url.search || url.hash || href !== p && href !== url.origin + p) throw failure('INVALID_DOCUMENT');
    const guideFile=/^\/api\/transport-guide-documents\/([1-9]\d{0,9})\/files\/([1-9]\d{0,9})$/.exec(p);
    if(guideFile&&positive(guideFile[1])&&positive(guideFile[2]))return {path:p,type:'guide-attachment',headers:{'X-CW-Document-Type':'guide-attachment','X-CW-Guide-Id':guideFile[1],'X-CW-Document-Id':guideFile[2]},attachment:true};
    const definitions = [
      [/^\/api\/invoice-pdf\/([1-9]\d{0,9})$/, 'invoice-pdf', 'X-CW-Invoice-Id'],
      [/^\/api\/invoice-pdf\/extras\/([1-9]\d{0,9})$/, 'extra-billing-pdf', 'X-CW-Client-Id'],
      [/^\/api\/guides\/transport\/([1-9]\d{0,9})\/pdf$/, 'transport-guide', 'X-CW-Document-Id'],
      [/^\/api\/guides\/transport\/latest\/([1-9]\d{0,9})\/pdf$/, 'transport-guide', 'X-CW-Vehicle-Id'],
      [/^\/api\/guides\/work\/([1-9]\d{0,9})\/pdf$/, 'work-guide', 'X-CW-Document-Id'],
      [/^\/api\/guides\/vehicles\/([1-9]\d{0,9})\/insurance\/pdf$/, 'vehicle-insurance', 'X-CW-Vehicle-Id'],
      [/^\/api\/transport-guide-documents\/current\/([1-9]\d{0,9})$/, 'guide-attachment', 'X-CW-Guide-Id'],
      [/^\/api\/client-messages\/attachments\/([1-9]\d{0,9})$/, 'chat-attachment', 'X-CW-Message-Id']
    ];
    for (const [pattern, type, key] of definitions) {
      const match = pattern.exec(p);
      if (match && positive(match[1])) return { path: p, type, headers: { 'X-CW-Document-Type': type, [key]: match[1] }, attachment: ['chat-attachment','guide-attachment'].includes(type) };
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
      if(document.type==='guide-attachment'&&(!session.owner||response.headers.get('X-CW-Owner')!==session.owner||!positive(response.headers.get('X-CW-Guide-Id'))||!positive(response.headers.get('X-CW-Vehicle-Id'))&&response.headers.get('X-CW-Vehicle-Id')!=='unassigned'||!positive(response.headers.get('X-CW-Document-Id'))&&response.headers.get('X-CW-Document-Id')!=='legacy'||!/^[a-f0-9]{64}$/.test(response.headers.get('X-CW-SHA256')||'')))throw failure('UNCONFIRMED');
      const blob = await response.blob(); current(op);
      if(document.type==='guide-attachment'){if(blob.size<=0||blob.size>25*1024*1024)throw failure('INCOMPLETE');const bytes=await blob.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');current(op);if(hash!==response.headers.get('X-CW-SHA256'))throw failure('INCOMPLETE');}

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
    open(link.href).catch(announce);
  });
  window.CristalDownloads = { open, cancel, presentation };
}());
