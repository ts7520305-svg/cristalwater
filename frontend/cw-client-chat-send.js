(function () {
  'use strict';
  const texts = {
    pt: ['A enviar…', 'Mensagem guardada na conversa.', 'Envio não confirmado. O conteúdo foi conservado; repita o envio.', 'Não foi possível guardar o envio neste dispositivo. Nenhum novo pedido foi enviado.', 'A sessão mudou. Volte a abrir esta página com a sua conta.', 'Repetir envio', 'Envio pendente', 'Há um envio pendente na conversa', 'Outra janela está a tratar deste envio.', 'O envio pendente não pôde ser validado. Foi conservado neste dispositivo.', 'Escreva uma mensagem até 10000 caracteres ou escolha um anexo até 25 MB.', 'Não foi possível atualizar a conversa. A última lista foi conservada.', 'Ainda há um envio pendente. Use Repetir envio.', 'Não foi possível guardar o rascunho neste dispositivo.'],
    en: ['Sending…', 'Message saved in the conversation.', 'Send not confirmed. Your content was retained; retry the send.', 'Could not save the send on this device. No new request was sent.', 'The session changed. Reopen this page with your account.', 'Retry send', 'Pending send', 'There is a pending send in conversation', 'Another window is handling this send.', 'The pending send could not be verified. It was retained on this device.', 'Write up to 10000 characters or choose an attachment up to 25 MB.', 'Could not refresh the conversation. The last list was retained.', 'A send is still pending. Use Retry send.', 'Could not save the draft on this device.'],
    fr: ['Envoi…', 'Message enregistré dans la conversation.', 'Envoi non confirmé. Le contenu est conservé ; réessayez.', 'Impossible de conserver cet envoi sur cet appareil. Aucune nouvelle demande envoyée.', 'La session a changé. Rouvrez cette page avec votre compte.', 'Réessayer', 'Envoi en attente', 'Un envoi est en attente dans la conversation', 'Une autre fenêtre traite cet envoi.', 'Impossible de vérifier cet envoi. Il reste conservé sur cet appareil.', 'Écrivez jusqu’à 10000 caractères ou choisissez une pièce jointe de 25 Mo maximum.', 'Actualisation impossible. La dernière liste est conservée.', 'Un envoi est encore en attente. Utilisez Réessayer.', 'Impossible de conserver le brouillon sur cet appareil.'],
    es: ['Enviando…', 'Mensaje guardado en la conversación.', 'Envío sin confirmar. Se conservó el contenido; vuelva a intentarlo.', 'No se pudo guardar el envío en este dispositivo. No se envió ninguna solicitud nueva.', 'La sesión cambió. Abra esta página con su cuenta.', 'Reintentar envío', 'Envío pendiente', 'Hay un envío pendiente en la conversación', 'Otra ventana está procesando este envío.', 'No se pudo verificar el envío pendiente. Se conservó en este dispositivo.', 'Escriba hasta 10000 caracteres o elija un archivo de hasta 25 MB.', 'No se pudo actualizar la conversación. Se conservó la última lista.', 'Hay un envío pendiente. Use Reintentar envío.', 'No se pudo guardar el borrador en este dispositivo.'],
    de: ['Wird gesendet…', 'Nachricht im Gespräch gespeichert.', 'Senden nicht bestätigt. Der Inhalt bleibt erhalten; erneut senden.', 'Senden konnte auf diesem Gerät nicht gespeichert werden. Keine neue Anfrage gesendet.', 'Die Sitzung hat sich geändert. Öffnen Sie diese Seite mit Ihrem Konto erneut.', 'Erneut senden', 'Ausstehende Nachricht', 'Eine Nachricht wartet im Gespräch', 'Ein anderes Fenster bearbeitet diese Nachricht.', 'Die ausstehende Nachricht konnte nicht geprüft werden. Sie bleibt auf diesem Gerät.', 'Bis zu 10000 Zeichen schreiben oder eine Datei bis 25 MB wählen.', 'Gespräch konnte nicht aktualisiert werden. Die letzte Liste bleibt erhalten.', 'Eine Nachricht wartet noch. Erneut senden verwenden.', 'Entwurf konnte auf diesem Gerät nicht gespeichert werden.'],
  };
  const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
  const validId = id => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
  const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  function create(options) {
    const credential = token(), input = options.input;
    let owner, role, db, pending = null, working = false, invalidated = false, unavailable = false, revision = 0, draftClient = 0, controller;
    const box = document.createElement('section'); box.className = 'cw-client-chat-recovery'; box.dataset.cwNoI18n = ''; box.dataset.cwStateManaged = 'manual'; box.style.cssText = 'padding:12px;overflow-wrap:anywhere;';
    const status = document.createElement('p'); status.id = 'clientChatSendStatus'; status.setAttribute('role', 'status'); status.setAttribute('data-cw-state-managed', 'manual');
    const preview = document.createElement('p'); preview.id = 'clientChatPending'; preview.style.whiteSpace = 'pre-wrap';
    const retry = document.createElement('button'); retry.id = 'clientChatRetry'; retry.type = 'button'; retry.className = options.sendButton?.className || ''; retry.style.minHeight = '44px';
    box.append(status, preview, retry); options.mount.append(box);
    const copy = index => (texts[String(options.language?.() || document.documentElement.lang || 'pt').slice(0, 2)] || texts.pt)[index];
    function note(index) { status.textContent = copy(index); status.dataset.message = index; }
    function active() {
      if (!invalidated && credential && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential)) return true;
      if (!invalidated) { invalidated = true; revision++; controller?.abort(); input.value = ''; if (options.fileInput) options.fileInput.value = ''; options.list.replaceChildren(); options.invalidate?.(); }
      note(4); render(); return false;
    }
    const allowed = () => !options.canSend || options.canSend();
    const currentId = () => Number(options.clientId());
    function render() {
      if (status.dataset.message !== undefined) status.textContent = copy(Number(status.dataset.message));
      const blocked = invalidated || unavailable || working || !db || !!pending || !allowed();
      input.disabled = blocked;
      if (options.sendButton) options.sendButton.disabled = blocked;
      if (options.fileButton) options.fileButton.disabled = blocked;
      preview.hidden = !pending || invalidated;
      preview.textContent = pending && !invalidated ? `${copy(pending.clientId === currentId() ? 6 : 7)} #${pending.clientId}\n${pending.kind === 'FILE' ? pending.name : pending.text}` : '';
      retry.textContent = copy(5); retry.hidden = !pending || invalidated;
      retry.disabled = working || unavailable || invalidated || !allowed() || pending?.clientId !== currentId();
      box.setAttribute('aria-busy', String(working));
    }
    function access(mode, operation) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('pending', mode), request = operation(tx.objectStore('pending'));
        tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(tx.error || Error('Local storage failed'));
      });
    }
    const read = () => access('readonly', store => store.get(owner));
    function valid(record) {
      return record && record.schema === 1 && record.owner === owner && validId(record.clientId) && /^[0-9a-f-]{36}$/.test(record.requestId) && /^[0-9a-f]{64}$/.test(record.payloadHash)
        && (record.kind === 'TEXT' ? typeof record.text === 'string' && !!record.text.trim() && record.text.length <= 10000 : record.kind === 'FILE' && record.blob instanceof Blob && record.blob.size > 0 && record.blob.size <= 25 * 1024 * 1024 && typeof record.name === 'string' && !!record.name && !/[\x00-\x1f/\\]/.test(record.name) && record.name.length <= 255);
    }
    async function fingerprint(record) {
      return hash(JSON.stringify(record.kind === 'TEXT' ? { v: 1, clientId: record.clientId, kind: 'TEXT', text: record.text }
        : { v: 1, clientId: record.clientId, kind: 'FILE', name: record.name, size: record.blob.size, sha256: await hash(await record.blob.arrayBuffer()) }));
    }
    function draftKey(id) { return `cwClientChatDraft:v1:${owner}:${id}`; }
    function saveDraft() { if (!owner || !active() || !validId(draftClient)) return; try { sessionStorage.setItem(draftKey(draftClient), input.value); } catch { note(13); } }
    function selectDraft() {
      if (!owner || !active() || draftClient === currentId()) return;
      saveDraft(); draftClient = currentId();
      try { input.value = sessionStorage.getItem(draftKey(draftClient)) || ''; } catch { note(13); }
      if (!input.value && pending?.clientId === draftClient && pending.kind === 'TEXT') input.value = pending.text;
    }
    const ready = (async () => {
      try {
        const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
        role = String(user.role || '').toUpperCase(); if (role === 'CUSTOMER') role = 'CLIENT';
        if (!['ADMIN', 'CLIENT'].includes(role)) throw Error('Invalid identity');
        const type = role === 'CLIENT' ? 'CLIENT' : user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN' : 'USER';
        const id = Number(type === 'CLIENT' ? user.clientId || user.id : user.userId || user.id); if (!validId(id)) throw Error('Invalid identity');
        owner = `${type}:${type === 'ENV_ADMIN' ? await hash(String(user.email || '').trim().toLowerCase()) : id}`;
        db = await new Promise((resolve, reject) => { const request = indexedDB.open('cw-client-chat-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('pending'); request.onsuccess = () => resolve(request.result); request.onerror = request.onblocked = () => reject(Error('Local storage unavailable')); });
        await sync();
      } catch { unavailable = true; note(3); render(); }
    })();
    async function sync() {
      if (!db || working || !active()) return;
      try { const stamp = revision, record = await read(); if (!active() || working || stamp !== revision) return; pending = record; if (pending && !valid(pending)) { unavailable = true; note(9); } selectDraft(); render(); }
      catch { unavailable = true; note(3); render(); }
    }
    async function transport(record) {
      if (!active()) return;
      if (!valid(record) || await fingerprint(record) !== record.payloadHash) { unavailable = true; note(9); return; }
      if (!active()) return;
      note(0); controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      try {
        let body, headers = { Authorization: `Bearer ${credential}` };
        if (record.kind === 'FILE') { body = new FormData(); body.append('clientId', String(record.clientId)); body.append('requestId', record.requestId); body.append('fileName', record.name); body.append('file', record.blob, record.name); }
        else { body = JSON.stringify({ clientId: record.clientId, text: record.text, requestId: record.requestId }); headers['Content-Type'] = 'application/json'; }
        const response = await fetch(record.kind === 'FILE' ? '/api/client-messages/upload' : '/api/client-messages', { method: 'POST', headers, body, signal: controller.signal });
        const result = await response.json(); if (!active()) return;
        const receipt = result?.receipt, message = result?.message;
        if (![200, 201].includes(response.status) || result.ok !== true || receipt?.scope !== 'CLIENT_CHAT_SEND' || receipt.actorKey !== owner || receipt.requestId !== record.requestId || receipt.clientId !== record.clientId || receipt.payloadHash !== record.payloadHash
          || !validId(receipt.messageId) || message?.id !== receipt.messageId || message.clientId !== record.clientId || message.senderType !== role
          || (record.kind === 'TEXT' ? message.text !== record.text || message.message !== record.text : message.fileName !== record.name || !message.fileUrl || message.message !== message.fileUrl)) throw Error('Unconfirmed response');
        const stored = await read(); if (!active()) return;
        if (stored?.requestId !== record.requestId || stored.payloadHash !== record.payloadHash) throw Error('Pending record changed');
        await access('readwrite', store => store.delete(owner)); pending = null; revision++;
        if (!active()) return;
        if (currentId() === record.clientId) {
          if (record.kind === 'TEXT' && input.value.trim() === record.text) { input.value = ''; saveDraft(); }
          if (record.kind === 'FILE' && options.fileInput) options.fileInput.value = '';
        }
        channel?.postMessage('changed'); note(1);
        await options.confirmed?.(message);
      } catch { if (active()) note(2); }
      finally { clearTimeout(timer); controller = null; }
    }
    async function execute(kind, file) {
      if (working) return; working = true; revision++; render();
      try {
        await ready;
        if (!active() || unavailable || !allowed()) return;
        if (!navigator.locks?.request || !crypto.randomUUID) { note(3); return; }
        const selectedClient = currentId(), text = input.value.trim();
        await navigator.locks.request(`cw-client-chat:${owner}`, { ifAvailable: true }, async lock => {
          if (!lock) { note(8); return; }
          pending = await read(); if (!active()) return;
          if (pending && !valid(pending)) { unavailable = true; note(9); return; }
          if (kind === 'RETRY') { if (pending?.clientId === selectedClient) await transport(pending); return; }
          if (pending) { note(12); return; }
          if (!validId(selectedClient) || (kind === 'TEXT' ? !text || text.length > 10000 : !(file instanceof Blob) || !file.size || file.size > 25 * 1024 * 1024 || !file.name || file.name.length > 255 || /[\x00-\x1f/\\]/.test(file.name))) { note(10); return; }
          const record = { schema: 1, owner, clientId: selectedClient, requestId: crypto.randomUUID(), kind, ...(kind === 'TEXT' ? { text } : { name: file.name, blob: file }) };
          record.payloadHash = await fingerprint(record); if (!active()) return;
          await access('readwrite', store => store.put(record, owner)); pending = await read();
          if (!valid(pending) || pending.requestId !== record.requestId || pending.payloadHash !== record.payloadHash) throw Error('Local write not confirmed');
          channel?.postMessage('changed'); render(); await transport(record);
        });
      } catch { if (active()) note(3); }
      finally { working = false; render(); }
    }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cw-client-chat') : null;
    if (channel) channel.onmessage = () => void sync();
    retry.addEventListener('click', () => void execute('RETRY'));
    input.addEventListener('input', saveDraft);
    window.addEventListener('storage', active); window.addEventListener('focus', () => void sync());
    setInterval(() => { if (active() && !working) { selectDraft(); render(); } }, 500);
    render();
    return { ready, active, sync, render, selectionChanged() { revision++; selectDraft(); render(); }, sendText: () => execute('TEXT'), sendFile: file => execute('FILE', file),
      begin() { return active() ? { revision: ++revision, clientId: currentId() } : null; },
      accepts(read) { return read && active() && read.revision === revision && read.clientId === currentId(); },
      headers() { return { Authorization: `Bearer ${credential}` }; },
      readError() { note(11); }, get busy() { return working || unavailable || invalidated || !!pending; } };
  }
  window.CWClientChat = { create };
})();
