(function () {
  'use strict';
  const keys = ['name', 'internalName', 'phone', 'email', 'zone', 'notes', 'requiresInvoice', 'fiscalName', 'fiscalNif', 'fiscalAddress', 'fiscalEmail', 'externalBillingNotes'];
  const labels = {
    pt: ['Nome', 'Nome interno', 'Telefone', 'Email', 'Zona', 'Notas internas', 'Necessita fatura oficial noutro sistema', 'Nome fiscal', 'NIF', 'Morada fiscal', 'Email fiscal', 'Notas para contabilidade'],
    en: ['Name', 'Internal name', 'Phone', 'Email', 'Area', 'Internal notes', 'Needs an official invoice in another system', 'Billing name', 'Tax ID', 'Billing address', 'Billing email', 'Accounting notes'],
    fr: ['Nom', 'Nom interne', 'Téléphone', 'Email', 'Zone', 'Notes internes', 'Facture officielle nécessaire dans un autre système', 'Nom fiscal', 'Identifiant fiscal', 'Adresse fiscale', 'Email fiscal', 'Notes comptables'],
    es: ['Nombre', 'Nombre interno', 'Teléfono', 'Email', 'Zona', 'Notas internas', 'Necesita factura oficial en otro sistema', 'Nombre fiscal', 'Identificación fiscal', 'Dirección fiscal', 'Email fiscal', 'Notas contables'],
    de: ['Name', 'Interner Name', 'Telefon', 'E-Mail', 'Gebiet', 'Interne Notizen', 'Offizielle Rechnung in einem anderen System erforderlich', 'Rechnungsname', 'Steuernummer', 'Rechnungsadresse', 'Rechnungs-E-Mail', 'Buchhaltungsnotizen'],
  };
  const text = {
    pt: ['Editar cliente', 'Reveja os dados antes de guardar.', 'Guardar alterações', 'Fechar', 'Confirmar pedido pendente', 'Rever alterações', 'Preparar edição revista', 'Descartar rascunho', 'Nova palavra-passe do portal', 'Opcional. A palavra-passe não é guardada no rascunho; volte a introduzi-la se for pedida.', 'Faturação oficial externa', 'A carregar os dados atuais…', 'A guardar…', 'Alteração confirmada.', 'Envio não confirmado. As alterações foram conservadas; repita a confirmação.', 'Não foi possível guardar neste dispositivo. Nenhum novo pedido foi enviado.', 'A sessão mudou. Volte a abrir a página com a sua conta.', 'Os dados mudaram. Reveja as alterações antes de guardar.', 'Volte a introduzir a nova palavra-passe e confirme o mesmo pedido.', 'Outra janela está a tratar deste cliente.', 'O pedido guardado não pôde ser validado. Foi conservado neste dispositivo.', 'Não foi possível carregar os dados atuais. O rascunho foi conservado.', 'Não foi possível guardar o rascunho. Mantenha esta janela aberta ou descarte-o explicitamente.', 'Não há alterações para guardar.', 'Indique um nome e verifique os campos. A palavra-passe admite até 72 bytes.', 'Escolha o valor de cada campo em conflito.', 'A revisão está preparada. Confira os campos e guarde para enviar um novo pedido.', 'Alterações por confirmar', 'Pedido pendente', 'Atual', 'O seu rascunho', 'Pedido anterior', 'Escolha…', 'Manter atual', 'Usar rascunho', 'Usar pedido anterior', 'Sim', 'Não', '(vazio)', 'Carregar novamente'],
    en: ['Edit customer', 'Review the details before saving.', 'Save changes', 'Close', 'Confirm pending request', 'Review changes', 'Prepare revised edit', 'Discard draft', 'New portal password', 'Optional. Passwords are not stored in drafts; enter it again if requested.', 'Official billing in another system', 'Loading current details…', 'Saving…', 'Change confirmed.', 'Send not confirmed. Your changes were retained; retry confirmation.', 'Could not save on this device. No new request was sent.', 'The session changed. Reopen the page with your account.', 'The details changed. Review your changes before saving.', 'Enter the new password again and confirm the same request.', 'Another window is handling this customer.', 'The saved request could not be verified. It remains on this device.', 'Could not load current details. Your draft was retained.', 'Could not save the draft. Keep this window open or explicitly discard it.', 'There are no changes to save.', 'Enter a name and check the fields. Passwords allow up to 72 bytes.', 'Choose a value for every conflicting field.', 'The revision is ready. Review the fields and save to send a new request.', 'Changes awaiting confirmation', 'Pending request', 'Current', 'Your draft', 'Previous request', 'Choose…', 'Keep current', 'Use draft', 'Use previous request', 'Yes', 'No', '(empty)', 'Load again'],
    fr: ['Modifier le client', 'Vérifiez les données avant de les enregistrer.', 'Enregistrer les modifications', 'Fermer', 'Confirmer la demande en attente', 'Revoir les modifications', 'Préparer la modification révisée', 'Supprimer le brouillon', 'Nouveau mot de passe du portail', 'Facultatif. Le mot de passe n’est pas conservé dans le brouillon ; saisissez-le à nouveau si demandé.', 'Facturation officielle dans un autre système', 'Chargement des données actuelles…', 'Enregistrement…', 'Modification confirmée.', 'Envoi non confirmé. Les modifications sont conservées ; réessayez.', 'Impossible de conserver les données sur cet appareil. Aucune nouvelle demande envoyée.', 'La session a changé. Rouvrez la page avec votre compte.', 'Les données ont changé. Revoyez vos modifications avant de les enregistrer.', 'Saisissez à nouveau le nouveau mot de passe et confirmez la même demande.', 'Une autre fenêtre traite ce client.', 'La demande conservée n’a pas pu être vérifiée. Elle reste sur cet appareil.', 'Chargement impossible. Le brouillon est conservé.', 'Impossible de conserver le brouillon. Gardez cette fenêtre ouverte ou supprimez-le explicitement.', 'Aucune modification à enregistrer.', 'Indiquez un nom et vérifiez les champs. Le mot de passe est limité à 72 octets.', 'Choisissez une valeur pour chaque champ en conflit.', 'La révision est prête. Vérifiez les champs et enregistrez une nouvelle demande.', 'Modifications à confirmer', 'Demande en attente', 'Actuel', 'Votre brouillon', 'Demande précédente', 'Choisir…', 'Conserver l’actuel', 'Utiliser le brouillon', 'Utiliser la demande précédente', 'Oui', 'Non', '(vide)', 'Recharger'],
    es: ['Editar cliente', 'Revise los datos antes de guardar.', 'Guardar cambios', 'Cerrar', 'Confirmar solicitud pendiente', 'Revisar cambios', 'Preparar edición revisada', 'Descartar borrador', 'Nueva contraseña del portal', 'Opcional. La contraseña no se guarda en el borrador; introdúzcala de nuevo si se solicita.', 'Facturación oficial en otro sistema', 'Cargando datos actuales…', 'Guardando…', 'Cambio confirmado.', 'Envío sin confirmar. Se conservaron los cambios; repita la confirmación.', 'No se pudo guardar en este dispositivo. No se envió ninguna solicitud nueva.', 'La sesión cambió. Abra la página con su cuenta.', 'Los datos cambiaron. Revise los cambios antes de guardar.', 'Introduzca de nuevo la nueva contraseña y confirme la misma solicitud.', 'Otra ventana está procesando este cliente.', 'No se pudo verificar la solicitud guardada. Se conservó en este dispositivo.', 'No se pudieron cargar los datos actuales. Se conservó el borrador.', 'No se pudo guardar el borrador. Mantenga esta ventana abierta o descártelo expresamente.', 'No hay cambios para guardar.', 'Indique un nombre y revise los campos. La contraseña admite hasta 72 bytes.', 'Elija un valor para cada campo en conflicto.', 'La revisión está preparada. Revise los campos y guarde una nueva solicitud.', 'Cambios por confirmar', 'Solicitud pendiente', 'Actual', 'Su borrador', 'Solicitud anterior', 'Elija…', 'Mantener actual', 'Usar borrador', 'Usar solicitud anterior', 'Sí', 'No', '(vacío)', 'Cargar de nuevo'],
    de: ['Kunden bearbeiten', 'Prüfen Sie die Angaben vor dem Speichern.', 'Änderungen speichern', 'Schließen', 'Ausstehende Anfrage bestätigen', 'Änderungen prüfen', 'Überarbeitete Änderung vorbereiten', 'Entwurf verwerfen', 'Neues Portal-Passwort', 'Optional. Passwörter werden nicht im Entwurf gespeichert. Bei Bedarf erneut eingeben.', 'Offizielle Rechnung in einem anderen System', 'Aktuelle Angaben werden geladen…', 'Wird gespeichert…', 'Änderung bestätigt.', 'Senden nicht bestätigt. Die Änderungen bleiben erhalten; erneut bestätigen.', 'Speichern auf diesem Gerät fehlgeschlagen. Keine neue Anfrage gesendet.', 'Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut mit Ihrem Konto.', 'Die Angaben haben sich geändert. Prüfen Sie Ihre Änderungen vor dem Speichern.', 'Geben Sie das neue Passwort erneut ein und bestätigen Sie dieselbe Anfrage.', 'Ein anderes Fenster bearbeitet diesen Kunden.', 'Die gespeicherte Anfrage konnte nicht geprüft werden. Sie bleibt auf diesem Gerät.', 'Aktuelle Angaben konnten nicht geladen werden. Der Entwurf bleibt erhalten.', 'Entwurf konnte nicht gespeichert werden. Lassen Sie dieses Fenster offen oder verwerfen Sie ihn ausdrücklich.', 'Keine Änderungen zu speichern.', 'Namen eingeben und Felder prüfen. Passwörter dürfen höchstens 72 Byte enthalten.', 'Wählen Sie für jedes widersprüchliche Feld einen Wert.', 'Die Überarbeitung ist bereit. Prüfen Sie die Felder und speichern Sie eine neue Anfrage.', 'Änderungen zur Bestätigung', 'Ausstehende Anfrage', 'Aktuell', 'Ihr Entwurf', 'Vorherige Anfrage', 'Auswählen…', 'Aktuellen Wert behalten', 'Entwurf verwenden', 'Vorherige Anfrage verwenden', 'Ja', 'Nein', '(leer)', 'Erneut laden'],
  };
  const versionPattern = /^client-v1:[0-9a-f]{64}$/, uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validId = id => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
  const canonical = value => value && typeof value === 'object' ? (Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))) : value;
  const serialized = value => JSON.stringify(canonical(value));
  const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(serialized(value));
  const normalize = (key, value) => key === 'requiresInvoice' ? value === true : String(value ?? '').trim() || null;
  const equalValues = (left, right) => keys.every(key => normalize(key, left?.[key]) === normalize(key, right?.[key]));
  const changes = (base, values) => Object.fromEntries(keys.filter(key => normalize(key, base[key]) !== normalize(key, values[key])).map(key => [key, normalize(key, values[key])]));
  function create(options) {
    const el = id => document.getElementById(id), modal = el('editClientModal'), form = el('editClientForm'), password = el('editPassword'), save = el('saveEditClient');
    const fields = Object.fromEntries(keys.map(key => [key, el('edit' + key[0].toUpperCase() + key.slice(1))]));
    const status = el('clientEditStatus'), preview = el('clientEditPending'), reviewBox = el('clientEditComparison'), banner = el('clientEditPendingList');
    const retry = el('clientEditRetry'), review = el('clientEditReview'), apply = el('clientEditApplyReview'), discard = el('clientEditDiscard'), reload = el('clientEditReload');
    let credential = '', owner = '', db, current = null, working = false, invalidated = false, unavailable = false, controller;
    // Older generic snapshots had neither client identity nor credential filtering.
    try { localStorage.removeItem('cw:lastform:editClientForm'); if (localStorage.getItem('cw:lastform:key') === 'editClientForm') localStorage.removeItem('cw:lastform:key'); } catch { unavailable = true; }
    const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
    try { credential = token(); } catch { unavailable = true; }
    const language = () => { const value = String(window.CristalI18n?.readLanguage?.() || document.documentElement.lang || 'pt').slice(0, 2); return text[value] ? value : 'pt'; };
    const copy = index => text[language()][index];
    const key = id => `${owner}:${id}`, draftKey = id => `cwClientEditDraft:v1:${key(id)}`;
    const values = () => Object.fromEntries(keys.map(key => [key, key === 'requiresInvoice' ? fields[key].checked : fields[key].value]));
    const assign = data => keys.forEach(key => { if (key === 'requiresInvoice') fields[key].checked = data?.[key] === true; else fields[key].value = data?.[key] ?? ''; });
    const isCurrent = view => current === view && !invalidated;
    function note(index, view = current) { if (view) view.message = index; render(); }
    function active() {
      let same = false; try { same = !!credential && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential); } catch { /* fail closed */ }
      if (!invalidated && same) return true;
      if (!invalidated) { invalidated = true; controller?.abort(); password.value = ''; assign(null); preview.replaceChildren(); reviewBox.replaceChildren(); banner.replaceChildren(); options.invalidated?.(); }
      if (current) current.message = 16; render(); return false;
    }
    function render() {
      const view = current, blocked = unavailable || invalidated || !db || !view?.base || view.loading || working || view.unavailable;
      Object.values(fields).forEach(field => { field.disabled = !!(blocked || view?.pending || view?.conflict || view?.review); });
      password.disabled = !!(blocked || view?.conflict || view?.review || (view?.pending && !view.needPassword));
      save.disabled = !!(blocked || view?.pending || view?.conflict || view?.review);
      save.hidden = !!(view?.pending || view?.conflict || view?.review);
      status.textContent = view?.message === undefined ? '' : copy(view.message); status.hidden = view?.message === undefined;
      status.dataset.tone = view?.message === 13 ? 'success' : [14, 15, 16, 17, 18, 20, 21, 22, 24, 25].includes(view?.message) ? 'warning' : 'info';
      retry.hidden = !view?.pending || !!view.conflict || invalidated; retry.disabled = !!(blocked || view?.review);
      review.hidden = !view?.conflict || !!view?.review || invalidated; review.disabled = !!blocked;
      apply.hidden = !view?.review || invalidated; apply.disabled = !!blocked;
      discard.hidden = !view?.base || !!view.pending || !!view.review || invalidated; discard.disabled = !!blocked;
      reload.hidden = !!view?.base || invalidated; reload.disabled = working || !!view?.loading || unavailable;
      form.setAttribute('aria-busy', String(working || !!view?.loading));
      const titles = labels[language()];
      keys.forEach((key, index) => { const label = key === 'requiresInvoice' ? el('editRequiresInvoiceLabel') : form.querySelector(`label[for="${fields[key].id}"]`); if (label) label.textContent = titles[index]; if (key !== 'requiresInvoice') fields[key].placeholder = titles[index]; });
      el('editClientTitle').textContent = copy(0); modal.querySelector('.cw-modal-head p').textContent = copy(1);
      save.textContent = copy(2); el('cancelEditClient').textContent = copy(3); el('closeEditClientModal').setAttribute('aria-label', copy(3));
      retry.textContent = copy(4); review.textContent = copy(5); apply.textContent = copy(6); discard.textContent = copy(7); reload.textContent = copy(39);
      form.querySelector('label[for="editPassword"]').textContent = copy(8); el('clientEditPasswordHint').textContent = copy(9); form.querySelector('.section-title').textContent = copy(10);
      preview.replaceChildren(); preview.hidden = !view?.pending || invalidated;
      if (view?.pending && !invalidated) {
        const title = document.createElement('strong'); title.textContent = copy(28); preview.append(title);
        for (const [field, value] of Object.entries(view.pending.submission.changes)) { const line = document.createElement('p'); line.textContent = `${titles[keys.indexOf(field)]}: ${display(value)}`; preview.append(line); }
        if (view.pending.submission.credentialIntent.password) { const line = document.createElement('p'); line.textContent = copy(8); preview.append(line); }
      }
    }
    const display = value => typeof value === 'boolean' ? copy(value ? 36 : 37) : value || copy(38);
    function access(mode, operation) {
      return new Promise((resolve, reject) => { const tx = db.transaction('edits', mode), request = operation(tx.objectStore('edits')); tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(tx.error || Error('Storage failed')); });
    }
    const read = async id => await access('readonly', store => store.get(key(id))) || { pending: null, confirmed: null };
    const write = (id, state) => access('readwrite', store => store.put(state, key(id)));
    function pick(client) { return { id: client.id, ...Object.fromEntries(keys.map(key => [key, key === 'requiresInvoice' ? client[key] === true : client[key] ?? null])) }; }
    function validClient(client, id) {
      return client && client.id === id && !('password' in client) && !('pin' in client) && typeof client.name === 'string' && !!client.name.trim()
        && keys.every(key => Object.hasOwn(client, key) && (key === 'requiresInvoice' ? typeof client[key] === 'boolean' : client[key] === null || typeof client[key] === 'string'));
    }
    function validBase(base, id) {
      return base && Object.keys(base).length === 2 && versionPattern.test(base.version) && validClient(base.client, id)
        && Object.keys(base.client).length === keys.length + 1 && Object.keys(base.client).every(key => key === 'id' || keys.includes(key));
    }
    function validValues(data) { return data && Object.keys(data).length === keys.length && keys.every(key => key === 'requiresInvoice' ? typeof data[key] === 'boolean' : typeof data[key] === 'string' && data[key].length <= 10000); }
    function validDraft(draft, id) { return draft && draft.schema === 1 && draft.owner === owner && draft.clientId === id && validBase(draft.base, id) && validValues(draft.values) && (!draft.requestId || uuid.test(draft.requestId)); }
    async function validRecord(record, id) {
      try {
        if (!record || record.schema !== 1 || record.owner !== owner || record.clientId !== id || !uuid.test(record.requestId) || !validBase(record.base, id) || !validValues(record.values)
          || Object.keys(record).some(key => !['schema', 'owner', 'clientId', 'requestId', 'base', 'values', 'submission', 'payloadHash'].includes(key))) return false;
        const intent = record.submission?.credentialIntent;
        if (typeof intent?.password !== 'boolean' || intent.pin !== false || Object.keys(intent).length !== 2) return false;
        const expected = { v: 1, clientId: id, expectedVersion: record.base.version, changes: changes(record.base.client, record.values), credentialIntent: intent };
        return serialized(record.submission) === serialized(expected) && record.payloadHash === await hash(expected);
      } catch { return false; }
    }
    function verify(result, record) {
      const receipt = result?.receipt;
      if (result?.ok !== true || !validClient(result.client, record.clientId) || !versionPattern.test(result.version)
        || receipt?.scope !== 'CLIENT_EDIT' || receipt.actorKey !== owner || receipt.requestId !== record.requestId || receipt.clientId !== record.clientId
        || receipt.expectedVersion !== record.base.version || receipt.payloadHash !== record.payloadHash || receipt.version !== result.version || !validId(receipt.auditId)
        || serialized(receipt.credentialsChanged) !== serialized(record.submission.credentialIntent) || Object.entries(record.submission.changes).some(([field, value]) => result.client[field] !== value)) throw Error('Unconfirmed edit');
      return { version: result.version, client: pick(result.client) };
    }
    async function checkState(state, id) {
      if (state.pending && !await validRecord(state.pending, id)) throw Error('Invalid pending edit');
      if (state.confirmed) { if (!await validRecord(state.confirmed.record, id)) throw Error('Invalid saved confirmation'); verify(state.confirmed.result, state.confirmed.record); }
      return state;
    }
    function saveDraft(view = current, data = values(), requestId = view?.lastRequestId || null) {
      if (!view?.base || !active() || !isCurrent(view)) return false;
      try { sessionStorage.setItem(draftKey(view.id), JSON.stringify({ schema: 1, owner, clientId: view.id, base: view.base, values: data, requestId })); return true; }
      catch { note(22, view); return false; }
    }
    async function latest(id) {
      if (!active()) throw Error('Session changed');
      const response = await fetch(`/api/core/clients/${id}/edit-state`, { headers: { Authorization: `Bearer ${credential}` } });
      const result = await response.json(); if (!active()) throw Error('Session changed');
      if (response.status !== 200 || result.ok !== true || result.scope !== 'CLIENT_EDIT' || result.clientId !== id || !validClient(result.client, id)) throw Error('State unavailable');
      const snapshot = { version: result.version, client: pick(result.client) }; if (!validBase(snapshot, id)) throw Error('State invalid'); return snapshot;
    }
    async function bannerRefresh() {
      if (!db || !active()) return;
      const states = await access('readonly', store => store.getAll()); if (!active()) return;
      banner.replaceChildren(); const pending = states.map(state => state.pending).filter(record => record?.owner === owner);
      banner.hidden = !pending.length;
      if (pending.length) { const title = document.createElement('p'); title.textContent = copy(27); banner.append(title); }
      for (const record of pending) {
        if (!validId(record.clientId)) continue;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'cw-v2-btn'; button.dataset.clientEditPending = record.clientId;
        button.textContent = `${record.base?.client?.name || '#' + record.clientId} — ${copy(4)}`; button.onclick = () => void open(record.clientId); banner.append(button);
      }
    }
    const ready = (async () => {
      try {
        const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))));
        if (String(user.role).toUpperCase() !== 'ADMIN') throw Error('Administrator required');
        const id = Number(user.userId || user.id); if (!validId(id)) throw Error('Invalid identity');
        owner = user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN:' + await digest(String(user.email || '').trim().toLowerCase()) : 'USER:' + id;
        db = await new Promise((resolve, reject) => { const request = indexedDB.open('cw-client-edits-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('edits'); request.onsuccess = () => resolve(request.result); request.onerror = request.onblocked = () => reject(Error('Local storage unavailable')); });
        if (active()) await bannerRefresh();
      } catch { unavailable = true; note(15); }
      render();
    })();
    function applyConfirmation(view, record, result) {
      const snapshot = verify(result, record);
      if (!isCurrent(view)) return;
      const own = values(), belongs = view.lastRequestId === record.requestId || (view.base?.version === record.base.version && equalValues(own, record.values) && !password.value);
      view.pending = null; view.needPassword = false; view.review = null; reviewBox.replaceChildren();
      if (belongs) {
        view.base = snapshot; assign(snapshot.client); password.value = ''; view.lastRequestId = null; view.conflict = false;
        try { sessionStorage.removeItem(draftKey(view.id)); } catch { /* The saved confirmation prevents stale replay. */ }
        note(13, view);
      } else { view.conflict = true; note(17, view); saveDraft(view); }
    }
    async function sync() {
      if (!db || working || !active()) return;
      const view = current;
      try {
        await bannerRefresh(); if (!view?.base || view.loading) return;
        const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view) || working) return;
        if (state.pending) { if (view.lastRequestId !== state.pending.requestId && view.pending?.requestId !== state.pending.requestId) password.value = ''; view.pending = state.pending; note(28, view); }
        else if (state.confirmed && (view.pending?.requestId === state.confirmed.record.requestId || view.lastRequestId === state.confirmed.record.requestId)) applyConfirmation(view, state.confirmed.record, state.confirmed.result);
        else if (view.pending) { view.pending = null; view.conflict = true; note(17, view); }
        render();
      } catch { if (isCurrent(view)) { view.unavailable = true; note(20, view); } }
    }
    async function open(id) {
      id = Number(id); if (!validId(id) || (current && !close())) return;
      const view = { id, base: null, loading: true, message: 11, lastRequestId: null }; current = view;
      password.value = ''; assign(null); reviewBox.replaceChildren(); options.show(); render();
      await ready; if (!active() || !isCurrent(view)) return;
      try {
        if (!db || unavailable) throw Error('No local storage');
        const state = await checkState(await read(id), id); if (!isCurrent(view) || !active()) return;
        let draft = null;
        try { const raw = sessionStorage.getItem(draftKey(id)); if (raw) { draft = JSON.parse(raw); if (!validDraft(draft, id)) throw Error('Invalid draft'); } }
        catch { view.unavailable = true; note(20, view); return; }
        if (draft && state.confirmed && (draft.requestId === state.confirmed.record.requestId || (draft.base.version === state.confirmed.record.base.version && equalValues(draft.values, state.confirmed.record.values)))) { draft = null; try { sessionStorage.removeItem(draftKey(id)); } catch { /* confirmation retained */ } }
        if (draft) { view.base = draft.base; view.lastRequestId = draft.requestId; assign(draft.values); }
        if (state.pending) {
          view.pending = state.pending;
          if (!draft) { view.base = state.pending.base; view.lastRequestId = state.pending.requestId; assign(state.pending.values); }
          note(28, view);
        } else {
          const fresh = await latest(id); if (!isCurrent(view)) return;
          if (!draft) { view.base = fresh; assign(fresh.client); view.message = undefined; }
          else if (fresh.version !== view.base.version) { view.conflict = true; note(17, view); }
          else view.message = undefined;
        }
      } catch { if (isCurrent(view)) note(unavailable ? 15 : 21, view); }
      finally { if (isCurrent(view)) { view.loading = false; render(); if (!view.pending && !view.conflict) fields.name.focus(); } }
    }
    function close() {
      const view = current;
      if (view?.base && !invalidated && !view.unavailable && !(view.discarded && equalValues(values(), view.base.client) && !password.value) && !saveDraft(view)) return false;
      current = null; password.value = ''; assign(null); reviewBox.replaceChildren(); options.hide(); return true;
    }
    async function transport(record, secret, view) {
      if (!active() || !await validRecord(record, record.clientId)) throw Error('Invalid request');
      if (!active()) return 'unknown';
      if (isCurrent(view)) note(12, view);
      controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`/api/core/clients/${record.clientId}`, { method: 'PUT', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...record.submission.changes, requestId: record.requestId, expectedVersion: record.base.version, credentialIntent: record.submission.credentialIntent, ...(secret ? { password: secret } : {}) }), signal: controller.signal });
        const result = await response.json(); if (!active()) return 'unknown';
        if (response.status === 409 && result.ok === false && result.code === 'CLIENT_VERSION_CONFLICT') { if (isCurrent(view)) { view.conflict = true; note(17, view); } return 'conflict'; }
        if (response.status === 428 && result.ok === false && result.code === 'CLIENT_EDIT_CREDENTIAL_REQUIRED' && serialized(result.fields) === serialized(['password'])) { if (isCurrent(view)) { view.needPassword = true; note(18, view); password.focus(); } return 'credential'; }
        if (![200, 201].includes(response.status)) throw Error('Unconfirmed response');
        verify(result, record);
        const state = await checkState(await read(record.clientId), record.clientId); if (!active()) return 'unknown';
        if (state.pending?.requestId !== record.requestId || state.pending.payloadHash !== record.payloadHash) throw Error('Pending edit changed');
        const savedResult = { ok: true, version: result.version, client: pick(result.client), receipt: result.receipt, replayed: result.replayed === true };
        await write(record.clientId, { pending: null, confirmed: { record, result: savedResult } });
        if (!active()) return 'unknown';
        if (isCurrent(view)) applyConfirmation(view, record, result);
        channel?.postMessage('changed'); await bannerRefresh();
        try { if (active()) await options.confirmed?.(result); } catch { /* A failed list refresh does not revoke confirmation. */ }
        return 'confirmed';
      } catch { if (active() && isCurrent(view)) note(14, view); return 'unknown'; }
      finally { clearTimeout(timer); controller = null; }
    }
    async function withLock(view, operation) {
      if (!navigator.locks?.request || !crypto.randomUUID) { note(15, view); return; }
      await navigator.locks.request(`cw-client-edit:${key(view.id)}`, { ifAvailable: true }, async lock => {
        if (!lock) { if (isCurrent(view)) note(19, view); return; }
        if (active()) await operation();
      });
    }
    async function execute(repeat = false) {
      const view = current; if (!view?.base || working || unavailable || view.unavailable || view.loading || view.review || view.conflict) return;
      working = true; render();
      try {
        await ready; if (!active()) return;
        await withLock(view, async () => {
          const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view)) return;
          if (state.pending) {
            if (view.lastRequestId !== state.pending.requestId && view.pending?.requestId !== state.pending.requestId) password.value = '';
            view.pending = state.pending;
            if (repeat) await transport(state.pending, password.value.trim(), view); else note(28, view);
            return;
          }
          if (state.confirmed && (view.lastRequestId === state.confirmed.record.requestId || (view.base.version === state.confirmed.record.base.version && equalValues(values(), state.confirmed.record.values) && !password.value))) { applyConfirmation(view, state.confirmed.record, state.confirmed.result); return; }
          if (repeat) { view.pending = null; view.conflict = true; note(17, view); return; }
          const data = values(), secret = password.value.trim(), patch = changes(view.base.client, data);
          if (!validValues(data) || !data.name.trim() || new TextEncoder().encode(secret).length > 72) { note(24, view); return; }
          if (!Object.keys(patch).length && !secret) { note(23, view); return; }
          const submission = { v: 1, clientId: view.id, expectedVersion: view.base.version, changes: patch, credentialIntent: { password: !!secret, pin: false } };
          const record = { schema: 1, owner, clientId: view.id, requestId: crypto.randomUUID(), base: view.base, values: data, submission, payloadHash: await hash(submission) };
          if (!active() || !isCurrent(view)) return;
          await write(view.id, { ...state, pending: record });
          const stored = await read(view.id); if (!await validRecord(stored.pending, view.id) || stored.pending.requestId !== record.requestId) throw Error('Local write not confirmed');
          if (!active()) return;
          view.pending = record; view.lastRequestId = record.requestId; saveDraft(view, data, record.requestId);
          channel?.postMessage('changed'); render(); await bannerRefresh(); await transport(record, secret, view);
        });
      } catch { if (active() && isCurrent(view)) note(15, view); }
      finally { working = false; render(); if (isCurrent(view) && view.needPassword && !password.disabled) password.focus(); }
    }
    function buildReview(view, snapshot, pending) {
      const own = values(), title = labels[language()], rows = [];
      reviewBox.replaceChildren();
      for (const field of keys) {
        const actual = normalize(field, snapshot.client[field]), mine = normalize(field, own[field]), old = normalize(field, view.base.client[field]);
        const candidates = [{ source: 'current', value: actual, label: 33 }];
        if (mine !== old && mine !== actual) candidates.push({ source: 'draft', value: mine, label: 34 });
        if (pending && Object.hasOwn(pending.submission.changes, field)) { const value = pending.submission.changes[field]; if (!candidates.some(candidate => candidate.value === value)) candidates.push({ source: 'pending', value, label: 35 }); }
        if (candidates.length === 1) continue;
        const section = document.createElement('section'); section.className = 'client-edit-choice';
        const heading = document.createElement('strong'); heading.textContent = title[keys.indexOf(field)]; section.append(heading);
        for (const candidate of candidates) { const line = document.createElement('p'); line.textContent = `${copy(candidate.source === 'current' ? 29 : candidate.source === 'draft' ? 30 : 31)}: ${display(candidate.value)}`; section.append(line); }
        const select = document.createElement('select'); select.dataset.clientEditField = field; select.setAttribute('aria-label', heading.textContent);
        select.add(new Option(copy(32), '')); for (const candidate of candidates) select.add(new Option(copy(candidate.label), candidate.source));
        if (candidates.length === 2) { const candidate = candidates[1], baseline = candidate.source === 'draft' ? old : normalize(field, pending.base.client[field]); if (actual === baseline) select.value = candidate.source; }
        section.append(select); reviewBox.append(section); rows.push({ field, candidates, select });
      }
      view.review = { snapshot, pendingId: pending?.requestId || null, rows }; render();
    }
    async function prepareReview() {
      const view = current; if (!view?.base || working || !view.conflict) return;
      working = true; render();
      try {
        await withLock(view, async () => {
          const state = await checkState(await read(view.id), view.id); if (!isCurrent(view) || !active()) return;
          if (state.pending && await transport(state.pending, '', view) !== 'conflict') return;
          const snapshot = await latest(view.id); if (isCurrent(view) && active()) buildReview(view, snapshot, state.pending);
        });
      } catch { if (isCurrent(view) && active()) note(21, view); }
      finally { working = false; render(); }
    }
    async function applyReview() {
      const view = current, revision = view?.review; if (!revision || working) return;
      const missing = revision.rows.find(row => !row.select.value); if (missing) { note(25, view); missing.select.focus(); return; }
      working = true; render();
      try {
        await withLock(view, async () => {
          const state = await checkState(await read(view.id), view.id); if (!isCurrent(view) || !active()) return;
          if ((state.pending?.requestId || null) !== revision.pendingId) { view.review = null; reviewBox.replaceChildren(); note(17, view); return; }
          if (state.pending && await transport(state.pending, '', view) !== 'conflict') return;
          const next = { ...revision.snapshot.client };
          for (const row of revision.rows) next[row.field] = row.candidates.find(candidate => candidate.source === row.select.value).value;
          const data = Object.fromEntries(keys.map(key => [key, key === 'requiresInvoice' ? next[key] === true : next[key] ?? '']));
          // Persist the reviewed draft before removing an explicitly rejected pending request.
          sessionStorage.setItem(draftKey(view.id), JSON.stringify({ schema: 1, owner, clientId: view.id, base: revision.snapshot, values: data, requestId: null }));
          if (state.pending) await write(view.id, { ...state, pending: null });
          if (!active() || !isCurrent(view)) return;
          view.base = revision.snapshot; view.pending = null; view.lastRequestId = null; view.conflict = false; view.review = null; view.needPassword = false;
          password.value = ''; assign(data); reviewBox.replaceChildren(); note(26, view); channel?.postMessage('changed'); await bannerRefresh();
        });
      } catch { if (isCurrent(view) && active()) note(22, view); }
      finally { working = false; render(); }
    }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cw-client-edits') : null;
    if (channel) channel.onmessage = () => void sync();
    retry.onclick = () => void execute(true); review.onclick = () => void prepareReview(); apply.onclick = () => void applyReview(); reload.onclick = () => current && void open(current.id);
    discard.onclick = () => { if (!current?.base || current.pending || working || !active()) return; try { sessionStorage.removeItem(draftKey(current.id)); assign(current.base.client); password.value = ''; current.lastRequestId = null; current.discarded = true; current.message = 23; render(); } catch { note(22); } };
    Object.values(fields).forEach(field => { field.maxLength = 10000; field.addEventListener('input', () => saveDraft()); field.addEventListener('change', () => saveDraft()); });
    window.addEventListener('storage', active); window.addEventListener('focus', () => void sync()); window.addEventListener('cw-language-change', () => {
      if (current?.review) { const revision = current.review, selections = new Map(revision.rows.map(row => [row.field, row.select.value])); buildReview(current, revision.snapshot, current.pending); for (const row of current.review.rows) if (selections.has(row.field)) row.select.value = selections.get(row.field); }
      render(); void bannerRefresh().catch(() => {});
    });
    setInterval(() => { active(); }, 500);
    render(); return { ready, open, close, save: () => execute(false), sync };
  }
  window.CWClientEdit = { create };
})();
