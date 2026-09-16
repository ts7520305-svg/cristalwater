(function () {
  'use strict';
  const texts = {
    pt: ['A enviar…', 'Pedido de visita registado. Aguarde a confirmação do agendamento.', 'Aviso de pagamento registado. Aguarde a confirmação financeira.', 'Pedido não confirmado. O conteúdo foi conservado; repita o envio.', 'Não foi possível guardar o pedido neste dispositivo. Nenhum novo pedido foi enviado.', 'A sessão mudou. Volte a abrir esta página com a sua conta.', 'Repetir envio', 'Pedido pendente', 'Outra janela está a tratar deste pedido.', 'O pedido guardado não pôde ser validado. Foi conservado neste dispositivo.', 'Descreva a visita em até 4000 caracteres.', 'Indique um valor com até duas casas decimais, ou deixe-o vazio; a nota pode ter até 4000 caracteres.', 'Há um pedido pendente. Use Repetir envio.', 'Não foi possível guardar o rascunho neste dispositivo.', 'Consulta da administração. Apenas o cliente pode enviar pedidos.'],
    en: ['Sending…', 'Visit request recorded. Await scheduling confirmation.', 'Payment notice recorded. Await financial confirmation.', 'Request not confirmed. Your content was retained; retry the send.', 'Could not save the request on this device. No new request was sent.', 'The session changed. Reopen this page with your account.', 'Retry send', 'Pending request', 'Another window is handling this request.', 'The saved request could not be verified. It was retained on this device.', 'Describe the visit in up to 4000 characters.', 'Use an amount with up to two decimal places, or leave it blank; notes can contain up to 4000 characters.', 'A request is pending. Use Retry send.', 'Could not save the draft on this device.', 'Administrator preview. Only the client can submit requests.'],
    fr: ['Envoi…', 'Demande de visite enregistrée. Attendez la confirmation du rendez-vous.', 'Avis de paiement enregistré. Attendez la confirmation financière.', 'Demande non confirmée. Le contenu est conservé ; réessayez.', 'Impossible de conserver la demande sur cet appareil. Aucune nouvelle demande envoyée.', 'La session a changé. Rouvrez cette page avec votre compte.', 'Réessayer', 'Demande en attente', 'Une autre fenêtre traite cette demande.', 'Impossible de vérifier la demande conservée. Elle reste sur cet appareil.', 'Décrivez la visite en 4000 caractères maximum.', 'Indiquez un montant avec deux décimales maximum, ou laissez-le vide ; la note est limitée à 4000 caractères.', 'Une demande est en attente. Utilisez Réessayer.', 'Impossible de conserver le brouillon sur cet appareil.', 'Aperçu de l’administration. Seul le client peut envoyer une demande.'],
    es: ['Enviando…', 'Solicitud de visita registrada. Espere la confirmación de la cita.', 'Aviso de pago registrado. Espere la confirmación financiera.', 'Solicitud sin confirmar. Se conservó el contenido; vuelva a intentarlo.', 'No se pudo guardar la solicitud en este dispositivo. No se envió ninguna solicitud nueva.', 'La sesión cambió. Abra esta página con su cuenta.', 'Reintentar envío', 'Solicitud pendiente', 'Otra ventana está procesando esta solicitud.', 'No se pudo verificar la solicitud guardada. Se conservó en este dispositivo.', 'Describa la visita en hasta 4000 caracteres.', 'Indique un importe con hasta dos decimales o déjelo vacío; la nota admite hasta 4000 caracteres.', 'Hay una solicitud pendiente. Use Reintentar envío.', 'No se pudo guardar el borrador en este dispositivo.', 'Vista de administración. Solo el cliente puede enviar solicitudes.'],
    de: ['Wird gesendet…', 'Besuchsanfrage gespeichert. Warten Sie auf die Terminbestätigung.', 'Zahlungshinweis gespeichert. Warten Sie auf die finanzielle Bestätigung.', 'Anfrage nicht bestätigt. Der Inhalt bleibt erhalten; erneut senden.', 'Anfrage konnte auf diesem Gerät nicht gespeichert werden. Keine neue Anfrage gesendet.', 'Die Sitzung hat sich geändert. Öffnen Sie diese Seite mit Ihrem Konto erneut.', 'Erneut senden', 'Ausstehende Anfrage', 'Ein anderes Fenster bearbeitet diese Anfrage.', 'Die gespeicherte Anfrage konnte nicht geprüft werden. Sie bleibt auf diesem Gerät.', 'Beschreiben Sie den Besuch mit bis zu 4000 Zeichen.', 'Betrag mit höchstens zwei Dezimalstellen angeben oder leer lassen; die Notiz darf bis zu 4000 Zeichen enthalten.', 'Eine Anfrage wartet. Erneut senden verwenden.', 'Entwurf konnte auf diesem Gerät nicht gespeichert werden.', 'Administrationsansicht. Nur der Kunde kann Anfragen senden.'],
  };
  const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
  const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const methods = ['Transferencia', 'MBWay', 'Dinheiro', 'Multibanco', 'Outro'];
  const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(JSON.stringify(value));
  function create(options) {
    const visit = options.kind === 'VISIT_REQUEST', fields = options.fields;
    let credential = '', owner, clientId, db, pending = null, working = false, unavailable = false, invalidated = false, previewOnly = false, controller, lastConfirmedId = null;
    try { credential = token(); } catch { unavailable = true; }
    const box = options.mount; box.dataset.cwStateManaged = 'manual'; box.dataset.cwNoI18n = '';
    box.style.cssText = 'grid-column:1/-1;min-width:0;overflow-wrap:anywhere;';
    const status = document.createElement('p'); status.id = `${options.id}Status`; status.setAttribute('role', 'status');
    const preview = document.createElement('p'); preview.id = `${options.id}Pending`; preview.style.whiteSpace = 'pre-wrap';
    const retry = document.createElement('button'); retry.type = 'button'; retry.id = `${options.id}Retry`; retry.className = options.button.className; retry.style.minHeight = '44px';
    box.append(status, preview, retry);
    const copy = index => (texts[String(options.language?.() || 'pt').slice(0, 2)] || texts.pt)[index];
    const values = () => Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.value]));
    const assign = data => { Object.entries(fields).forEach(([key, node]) => { node.value = data?.[key] || (key === 'method' ? 'Transferencia' : ''); }); options.changed?.(); };
    const key = () => `${owner}:${options.kind}`;
    const draftKey = () => `cwPortalDraft:v1:${key()}`;
    function note(index) { status.dataset.message = index; status.textContent = copy(index); }
    function active() {
      let matches = false;
      try { matches = !!credential && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential); } catch { /* Fail closed. */ }
      if (!invalidated && matches) return true;
      if (!invalidated) { invalidated = true; controller?.abort(); assign(null); }
      note(5); render(); return false;
    }
    const allowed = () => !previewOnly && validId(clientId) && Number(options.clientId()) === clientId && options.canSend();
    function render() {
      if (status.dataset.message !== undefined) status.textContent = copy(Number(status.dataset.message));
      options.button.disabled = working || unavailable || invalidated || !db || !!pending || !allowed();
      // Preview drafts remain editable, but the administrator can never submit them.
      Object.values(fields).forEach(node => { node.disabled = working || unavailable || invalidated || !!pending; });
      preview.hidden = !pending || unavailable || invalidated;
      preview.textContent = pending && !unavailable && !invalidated ? `${copy(7)}\n${visit ? pending.submission.message : [pending.values.amount ? `${pending.values.amount} EUR` : '', pending.submission.method, pending.submission.note].filter(Boolean).join(' · ')}` : '';
      retry.textContent = copy(6); retry.hidden = !pending || invalidated;
      retry.disabled = working || unavailable || invalidated || !allowed();
      status.hidden = status.dataset.message === undefined;
      box.setAttribute('aria-busy', String(working));
    }
    function access(mode, operation, table = 'pending') {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(table, mode), request = operation(tx.objectStore(table));
        tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(tx.error || Error('Local storage failed'));
      });
    }
    const read = () => access('readonly', store => store.get(key()));
    const readConfirmed = () => access('readonly', store => store.get(key()), 'confirmed');
    function submission(data) {
      if (visit) {
        if (typeof data.message !== 'string' || !data.message.trim() || data.message.length > 4000) throw Error('Invalid visit request');
        return { v: 1, clientId, kind: options.kind, message: data.message.trim() };
      }
      if (typeof data.amount !== 'string' || (data.amount !== '' && !/^\d{1,8}(\.\d{1,2})?$/.test(data.amount)) || !methods.includes(data.method) || typeof data.note !== 'string' || data.note.length > 4000) throw Error('Invalid payment notice');
      const [whole, fraction = ''] = (data.amount || '0').split('.');
      const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      return { v: 1, clientId, kind: options.kind, amountCents: cents || null, method: data.method, note: data.note.trim(), channel: 'PORTAL_CLIENTE' };
    }
    async function valid(record) {
      try {
        return record && record.schema === 1 && record.owner === owner && record.clientId === clientId && record.kind === options.kind && uuid.test(record.requestId)
          && JSON.stringify(submission(record.values)) === JSON.stringify(record.submission) && await hash(record.submission) === record.payloadHash;
      } catch { return false; }
    }
    function saveDraft() {
      if (!owner || previewOnly || !active() || pending) return;
      try { sessionStorage.setItem(draftKey(), JSON.stringify({ values: values(), lastConfirmedId })); } catch { note(13); }
    }
    const sameValues = (left, right) => Object.keys(fields).every(key => left?.[key] === right?.[key]);
    async function observeConfirmation() {
      const confirmed = await readConfirmed(); if (!active()) return false;
      if (!confirmed || confirmed.requestId === lastConfirmedId) return false;
      if (!await valid(confirmed)) throw Error('Invalid local confirmation');
      await verifyAcknowledgement(confirmed.result, confirmed); if (!active()) return false;
      lastConfirmedId = confirmed.requestId;
      if (sameValues(values(), confirmed.values)) { assign(null); saveDraft(); }
      note(visit ? 1 : 2); return true;
    }
    async function sync() {
      if (!db || working || !active()) return;
      try {
        const record = await read(), verified = !record || await valid(record);
        if (!active() || working) return;
        pending = record;
        if (!verified) { unavailable = true; note(9); }
        else if (pending) assign(pending.values);
        else await observeConfirmation();
        render();
      } catch { unavailable = true; note(4); render(); }
    }
    const ready = (async () => {
      try {
        const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))));
        if (String(user.role).toUpperCase() === 'ADMIN') { previewOnly = true; note(14); render(); return; }
        if (!['CLIENT', 'CUSTOMER'].includes(String(user.role).toUpperCase())) throw Error('Invalid account');
        clientId = Number(user.clientId || user.id); if (!validId(clientId)) throw Error('Invalid identity'); owner = `CLIENT:${clientId}`;
        db = await new Promise((resolve, reject) => { const open = indexedDB.open('cw-client-portal-requests-v1', 1); open.onupgradeneeded = () => { open.result.createObjectStore('pending'); open.result.createObjectStore('confirmed'); }; open.onsuccess = () => resolve(open.result); open.onerror = open.onblocked = () => reject(Error('Local storage unavailable')); });
        if (!active()) return;
        const confirmed = await readConfirmed(); if (!active()) return;
        if (confirmed) { if (!await valid(confirmed)) throw Error('Invalid local confirmation'); await verifyAcknowledgement(confirmed.result, confirmed); lastConfirmedId = confirmed.requestId; }
        if (!active()) return;
        try {
          const raw = sessionStorage.getItem(draftKey()), draft = raw ? JSON.parse(raw) : null;
          if (draft?.values) {
            if (confirmed && draft.lastConfirmedId !== lastConfirmedId && sameValues(draft.values, confirmed.values)) { assign(null); saveDraft(); note(visit ? 1 : 2); }
            else assign(draft.values);
          }
        } catch { note(13); }
        await sync();
      } catch { unavailable = true; note(4); render(); }
    })();
    async function verifyAcknowledgement(result, record) {
      const receipt = result?.receipt, message = result?.message, notification = result?.notification;
      if (result?.ok !== true || receipt?.scope !== 'CLIENT_PORTAL_REQUEST' || receipt.actorKey !== owner || receipt.clientId !== clientId || receipt.kind !== options.kind || receipt.requestId !== record.requestId || receipt.payloadHash !== record.payloadHash
        || !validId(receipt.messageId) || !validId(receipt.notificationId) || !validId(receipt.communicationLogId) || !result.submission || Object.keys(result.submission).length !== Object.keys(record.submission).length || Object.keys(record.submission).some(key => result.submission[key] !== record.submission[key])
        || message?.id !== receipt.messageId || message.clientId !== clientId || message.senderType !== 'CLIENT' || message.actorKey !== owner || message.payloadHash !== record.payloadHash || message.messageType !== options.kind || typeof message.text !== 'string' || !message.text || await digest(message.text) !== receipt.messageHash || message.text !== message.message
        || notification?.id !== receipt.notificationId || notification.clientId !== clientId || notification.type !== options.kind
        || (visit ? message.text !== `Pedido de visita: ${record.submission.message}` || result.request?.id !== message.id : result.paymentReference !== `CW-${String(clientId).padStart(6, '0')}`)) throw Error('Unconfirmed response');
    }
    async function transport(record) {
      if (!active()) return;
      if (!await valid(record)) { unavailable = true; note(9); return; }
      if (!active()) return;
      note(0); controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`/api/client-portal/${clientId}/${visit ? 'visit-requests' : 'payment-notice'}`, {
          method: 'POST', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...record.values, requestId: record.requestId }), signal: controller.signal });
        const result = await response.json(); if (!active()) return;
        if (![200, 201].includes(response.status)) throw Error('Unconfirmed response');
        await verifyAcknowledgement(result, record);
        const stored = await read(); if (!active()) return;
        if (stored?.requestId !== record.requestId || stored.payloadHash !== record.payloadHash) throw Error('Pending request changed');
        await new Promise((resolve, reject) => {
          const tx = db.transaction(['pending', 'confirmed'], 'readwrite');
          tx.objectStore('confirmed').put({ ...record, result }, key());
          tx.objectStore('pending').delete(key());
          tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || Error('Local confirmation failed'));
        });
        pending = null; lastConfirmedId = record.requestId;
        if (!active()) return;
        if (JSON.stringify(values()) === JSON.stringify(record.values)) { assign(null); saveDraft(); }
        channel?.postMessage('changed'); note(visit ? 1 : 2);
        // A refresh failure does not turn an acknowledged write into an unconfirmed one.
        try { await options.confirmed?.(result); } catch { /* Existing readers show their own recovery state. */ }
      } catch { if (active()) note(3); }
      finally { clearTimeout(timer); controller = null; }
    }
    async function execute(repeat = false) {
      if (working) return; working = true; render();
      try {
        await ready;
        if (!active() || unavailable || !allowed()) return;
        if (!navigator.locks?.request || !crypto.randomUUID) { note(4); return; }
        const data = values();
        await navigator.locks.request(`cw-portal-request:${key()}`, { ifAvailable: true }, async lock => {
          if (!lock) { note(8); return; }
          pending = await read(); if (!active()) return;
          if (pending && !await valid(pending)) { unavailable = true; note(9); return; }
          if (!pending && await observeConfirmation()) return;
          if (!active() || !allowed()) return;
          if (repeat) { if (pending) { assign(pending.values); await transport(pending); } return; }
          if (pending) { assign(pending.values); note(12); return; }
          let canonical; try { canonical = submission(data); } catch { note(visit ? 10 : 11); return; }
          const record = { schema: 1, owner, clientId, kind: options.kind, requestId: crypto.randomUUID(), values: data, submission: canonical, payloadHash: await hash(canonical) };
          if (!active()) return;
          await access('readwrite', store => store.put(record, key())); pending = await read();
          if (!await valid(pending) || pending.requestId !== record.requestId || pending.payloadHash !== record.payloadHash) throw Error('Local write not confirmed');
          channel?.postMessage('changed'); render(); await transport(record);
        });
      } catch { if (active()) note(4); }
      finally { working = false; render(); }
    }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cw-client-portal-requests') : null;
    if (channel) channel.onmessage = () => void sync();
    retry.addEventListener('click', () => void execute(true));
    Object.values(fields).forEach(node => { node.addEventListener('input', saveDraft); node.addEventListener('change', saveDraft); });
    window.addEventListener('storage', active); window.addEventListener('focus', () => void sync());
    setInterval(() => { if (active() && !working) render(); }, 500);
    render();
    return { ready, render, active, sync, send: () => execute(false) };
  }
  window.CWClientPortalRequest = { create };
})();
