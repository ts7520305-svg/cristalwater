(function () {
  'use strict';
  const keys = ['name', 'clientId', 'type', 'zone', 'address', 'location', 'monthlyAmount', 'notes'];
  const labels = {
    pt: ['Nome', 'Cliente', 'Tipo', 'Zona', 'Morada', 'Local na propriedade', 'Valor mensal (€)', 'Notas gerais'],
    en: ['Name', 'Customer', 'Type', 'Area', 'Address', 'Location on the property', 'Monthly amount (€)', 'General notes'],
    fr: ['Nom', 'Client', 'Type', 'Zone', 'Adresse', 'Emplacement dans la propriété', 'Montant mensuel (€)', 'Notes générales'],
    es: ['Nombre', 'Cliente', 'Tipo', 'Zona', 'Dirección', 'Ubicación en la propiedad', 'Importe mensual (€)', 'Notas generales'],
    de: ['Name', 'Kunde', 'Typ', 'Gebiet', 'Adresse', 'Standort auf dem Grundstück', 'Monatsbetrag (€)', 'Allgemeine Notizen'],
  };
  const texts = {
    pt: ['Editar piscina', 'Reveja os dados antes de guardar.', 'Guardar alterações', 'Fechar', 'Confirmar pedido pendente', 'Rever alterações', 'Preparar edição revista', 'Descartar rascunho', 'A carregar os dados atuais…', 'A guardar…', 'Alteração confirmada.', 'Envio não confirmado. As alterações foram conservadas; repita a confirmação.', 'Não foi possível guardar neste dispositivo. Nenhum novo pedido foi enviado.', 'A sessão mudou. Volte a abrir a página com a sua conta.', 'Os dados mudaram. Reveja as alterações antes de guardar.', 'Outra janela está a tratar desta piscina.', 'O pedido guardado não pôde ser validado. Foi conservado neste dispositivo.', 'Não foi possível carregar os dados atuais. O rascunho foi conservado.', 'Não foi possível guardar o rascunho. Mantenha esta janela aberta ou descarte-o explicitamente.', 'Não há alterações para guardar.', 'Indique um nome, um cliente e um valor mensal válido igual ou superior a zero.', 'Escolha o valor de cada campo em conflito.', 'A revisão está preparada. Confira os campos e guarde para enviar um novo pedido.', 'Alterações por confirmar', 'Pedido pendente', 'Atual', 'O seu rascunho', 'Pedido anterior', 'Escolha…', 'Manter atual', 'Usar rascunho', 'Usar pedido anterior', '(vazio)', 'Carregar novamente', 'O cliente selecionado mudou ou deixou de estar disponível. Reveja a associação.', 'Alterar o cliente transfere as visitas ainda não iniciadas nem faturadas. O trabalho concluído e o histórico financeiro conservam o cliente original.', 'Cliente indisponível', 'Piscina', 'Jacuzzi', 'Tipo por definir'],
    en: ['Edit pool', 'Review the details before saving.', 'Save changes', 'Close', 'Confirm pending request', 'Review changes', 'Prepare revised edit', 'Discard draft', 'Loading current details…', 'Saving…', 'Change confirmed.', 'Send not confirmed. Your changes were retained; retry confirmation.', 'Could not save on this device. No new request was sent.', 'The session changed. Reopen the page with your account.', 'The details changed. Review your changes before saving.', 'Another window is handling this pool.', 'The saved request could not be verified. It remains on this device.', 'Could not load current details. Your draft was retained.', 'Could not save the draft. Keep this window open or explicitly discard it.', 'There are no changes to save.', 'Enter a name, a customer and a valid monthly amount of zero or more.', 'Choose a value for every conflicting field.', 'The revision is ready. Review the fields and save to send a new request.', 'Changes awaiting confirmation', 'Pending request', 'Current', 'Your draft', 'Previous request', 'Choose…', 'Keep current', 'Use draft', 'Use previous request', '(empty)', 'Load again', 'The selected customer changed or is no longer available. Review the assignment.', 'Changing the customer transfers visits that have not started or been billed. Completed work and financial history retain the original customer.', 'Customer unavailable', 'Pool', 'Jacuzzi', 'Type not set'],
    fr: ['Modifier la piscine', 'Vérifiez les données avant de les enregistrer.', 'Enregistrer les modifications', 'Fermer', 'Confirmer la demande en attente', 'Revoir les modifications', 'Préparer la modification révisée', 'Supprimer le brouillon', 'Chargement des données actuelles…', 'Enregistrement…', 'Modification confirmée.', 'Envoi non confirmé. Les modifications sont conservées ; réessayez.', 'Impossible de conserver les données sur cet appareil. Aucune nouvelle demande envoyée.', 'La session a changé. Rouvrez la page avec votre compte.', 'Les données ont changé. Revoyez vos modifications avant de les enregistrer.', 'Une autre fenêtre traite cette piscine.', 'La demande conservée n’a pas pu être vérifiée. Elle reste sur cet appareil.', 'Chargement impossible. Le brouillon est conservé.', 'Impossible de conserver le brouillon. Gardez cette fenêtre ouverte ou supprimez-le explicitement.', 'Aucune modification à enregistrer.', 'Indiquez un nom, un client et un montant mensuel valide égal ou supérieur à zéro.', 'Choisissez une valeur pour chaque champ en conflit.', 'La révision est prête. Vérifiez les champs et enregistrez une nouvelle demande.', 'Modifications à confirmer', 'Demande en attente', 'Actuel', 'Votre brouillon', 'Demande précédente', 'Choisir…', 'Conserver l’actuel', 'Utiliser le brouillon', 'Utiliser la demande précédente', '(vide)', 'Recharger', 'Le client sélectionné a changé ou n’est plus disponible. Revoyez l’affectation.', 'Changer le client transfère les visites non commencées et non facturées. Le travail terminé et l’historique financier conservent le client original.', 'Client indisponible', 'Piscine', 'Jacuzzi', 'Type non défini'],
    es: ['Editar piscina', 'Revise los datos antes de guardar.', 'Guardar cambios', 'Cerrar', 'Confirmar solicitud pendiente', 'Revisar cambios', 'Preparar edición revisada', 'Descartar borrador', 'Cargando datos actuales…', 'Guardando…', 'Cambio confirmado.', 'Envío sin confirmar. Se conservaron los cambios; repita la confirmación.', 'No se pudo guardar en este dispositivo. No se envió ninguna solicitud nueva.', 'La sesión cambió. Abra la página con su cuenta.', 'Los datos cambiaron. Revise los cambios antes de guardar.', 'Otra ventana está procesando esta piscina.', 'No se pudo verificar la solicitud guardada. Se conservó en este dispositivo.', 'No se pudieron cargar los datos actuales. Se conservó el borrador.', 'No se pudo guardar el borrador. Mantenga esta ventana abierta o descártelo expresamente.', 'No hay cambios para guardar.', 'Indique un nombre, un cliente y un importe mensual válido igual o superior a cero.', 'Elija un valor para cada campo en conflicto.', 'La revisión está preparada. Revise los campos y guarde una nueva solicitud.', 'Cambios por confirmar', 'Solicitud pendiente', 'Actual', 'Su borrador', 'Solicitud anterior', 'Elija…', 'Mantener actual', 'Usar borrador', 'Usar solicitud anterior', '(vacío)', 'Cargar de nuevo', 'El cliente seleccionado cambió o ya no está disponible. Revise la asignación.', 'Cambiar el cliente transfiere las visitas sin iniciar ni facturar. El trabajo terminado y el historial financiero conservan el cliente original.', 'Cliente no disponible', 'Piscina', 'Jacuzzi', 'Tipo sin definir'],
    de: ['Pool bearbeiten', 'Prüfen Sie die Angaben vor dem Speichern.', 'Änderungen speichern', 'Schließen', 'Ausstehende Anfrage bestätigen', 'Änderungen prüfen', 'Überarbeitete Änderung vorbereiten', 'Entwurf verwerfen', 'Aktuelle Angaben werden geladen…', 'Wird gespeichert…', 'Änderung bestätigt.', 'Senden nicht bestätigt. Die Änderungen bleiben erhalten; erneut bestätigen.', 'Speichern auf diesem Gerät fehlgeschlagen. Keine neue Anfrage gesendet.', 'Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut mit Ihrem Konto.', 'Die Angaben haben sich geändert. Prüfen Sie Ihre Änderungen vor dem Speichern.', 'Ein anderes Fenster bearbeitet diesen Pool.', 'Die gespeicherte Anfrage konnte nicht geprüft werden. Sie bleibt auf diesem Gerät.', 'Aktuelle Angaben konnten nicht geladen werden. Der Entwurf bleibt erhalten.', 'Entwurf konnte nicht gespeichert werden. Lassen Sie dieses Fenster offen oder verwerfen Sie ihn ausdrücklich.', 'Keine Änderungen zu speichern.', 'Geben Sie einen Namen, einen Kunden und einen gültigen Monatsbetrag ab null ein.', 'Wählen Sie für jedes widersprüchliche Feld einen Wert.', 'Die Überarbeitung ist bereit. Prüfen Sie die Felder und speichern Sie eine neue Anfrage.', 'Änderungen zur Bestätigung', 'Ausstehende Anfrage', 'Aktuell', 'Ihr Entwurf', 'Vorherige Anfrage', 'Auswählen…', 'Aktuellen Wert behalten', 'Entwurf verwenden', 'Vorherige Anfrage verwenden', '(leer)', 'Erneut laden', 'Der ausgewählte Kunde hat sich geändert oder ist nicht mehr verfügbar. Prüfen Sie die Zuordnung.', 'Beim Kundenwechsel werden noch nicht begonnene oder abgerechnete Besuche übertragen. Abgeschlossene Arbeiten und Finanzdaten behalten den ursprünglichen Kunden.', 'Kunde nicht verfügbar', 'Pool', 'Whirlpool', 'Typ nicht festgelegt'],
  };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const versionPattern = /^pool-v1:[0-9a-f]{64}$/, clientVersionPattern = /^pool-client-v1:[0-9a-f]{64}$/;
  const validId = id => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
  const canonical = value => value && typeof value === 'object' ? (Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))) : value;
  const serialized = value => JSON.stringify(canonical(value));
  const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(serialized(value));
  const normalize = (key, value) => key === 'clientId' ? Number(value) : key === 'monthlyAmount' ? Number(String(value).trim().replace(',', '.')) : String(value ?? '').trim() || null;
  const changes = (base, data) => Object.fromEntries(keys.filter(key => normalize(key, base[key]) !== normalize(key, data[key])).map(key => [key, normalize(key, data[key])]));
  const equal = (a, b) => keys.every(key => normalize(key, a?.[key]) === normalize(key, b?.[key]));
  function create(options = {}) {
    const modal = document.createElement('div'); modal.id = 'poolEditModal'; modal.className = 'pool-edit-modal'; modal.hidden = true; modal.dataset.cwNoI18n = '';
    modal.innerHTML = `<div class="pool-edit-card" role="dialog" aria-modal="true" aria-labelledby="poolEditTitle"><div class="pool-edit-head"><div><h2 id="poolEditTitle"></h2><p id="poolEditSubtitle"></p></div><button id="poolEditClose" type="button">×</button></div>
      <form id="poolEditForm" data-cw-form-memory="managed" data-cw-state-managed="manual"><p id="poolEditStatus" role="status" aria-live="polite" hidden></p><section id="poolEditPending" hidden></section><div id="poolEditComparison"></div><div id="poolEditFields" class="pool-edit-fields"></div><p id="poolEditTransferHint"></p>
      <div class="pool-edit-actions"><button id="poolEditReload" type="button" hidden></button><button id="poolEditDiscard" type="button" hidden></button><button id="poolEditRetry" type="button" class="primary" hidden></button><button id="poolEditReview" type="button" hidden></button><button id="poolEditApplyReview" type="button" class="primary" hidden></button><button id="poolEditCancel" type="button"></button><button id="poolEditSave" type="submit" class="primary"></button></div></form></div>`;
    document.body.append(modal);
    const el = id => document.getElementById('poolEdit' + id), form = el('Form'), status = el('Status'), preview = el('Pending'), reviewBox = el('Comparison'), fieldBox = el('Fields');
    const banner = document.getElementById('poolEditPendingList'), save = el('Save'), retry = el('Retry'), review = el('Review'), apply = el('ApplyReview'), discard = el('Discard'), reload = el('Reload');
    const fields = Object.fromEntries(keys.map(key => {
      const box = document.createElement('div'), label = document.createElement('label'), input = document.createElement(['clientId', 'type'].includes(key) ? 'select' : key === 'notes' ? 'textarea' : 'input');
      box.className = 'pool-edit-field'; if (key === 'notes') box.classList.add('wide'); input.id = 'poolEdit' + key[0].toUpperCase() + key.slice(1); input.name = key; label.htmlFor = input.id;
      if (key === 'name') input.required = true; if (key === 'monthlyAmount') input.inputMode = 'decimal'; if (!['clientId', 'type'].includes(key)) input.maxLength = 10000;
      box.append(label, input); fieldBox.append(box); return [key, input];
    }));
    let credential = '', owner = '', db, current = null, working = false, invalidated = false, unavailable = false, controller;
    const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
    try { credential = token(); } catch { unavailable = true; }
    const language = () => { const lang = String(window.CristalI18n?.readLanguage?.() || document.documentElement.lang || 'pt').slice(0, 2); return texts[lang] ? lang : 'pt'; };
    const copy = index => texts[language()][index], key = id => `${owner}:${id}`, draftKey = id => 'cwPoolEditDraft:v1:' + key(id);
    const values = () => Object.fromEntries(keys.map(key => [key, fields[key].value]));
    const isCurrent = view => current === view && !invalidated;
    function note(index, view = current) { if (view) view.message = index; render(); }
    function active() {
      let same = false; try { same = !!credential && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential); } catch { /* fail closed */ }
      if (!invalidated && same) return true;
      if (!invalidated) { invalidated = true; controller?.abort(); assign(null); fields.clientId.replaceChildren(); if (current) { current.catalog = []; current.names = {}; current.review = null; } preview.replaceChildren(); reviewBox.replaceChildren(); banner.replaceChildren(); options.invalidated?.(); }
      if (current) current.message = 13; render(); return false;
    }
    function assign(data) {
      for (const key of keys) {
        const value = String(data?.[key] ?? '');
        if (['clientId', 'type'].includes(key) && !Array.from(fields[key].options).some(option => option.value === value)) fields[key].add(new Option(key === 'clientId' ? '#' + value : value || copy(39), value));
        fields[key].value = value;
      }
    }
    function knownNames(view = current, data = values()) {
      return Object.fromEntries(Array.from(new Set([view?.base?.pool.clientId, Number(data.clientId)].filter(validId))).map(id => [id, view?.catalog?.find(client => client.id === id)?.name || view?.names?.[id] || '#' + id]));
    }
    function clientOptions(view, clients = []) {
      const selected = fields.clientId.value; view.catalog = clients; fields.clientId.replaceChildren();
      const rows = new Map(clients.map(client => [client.id, client]));
      for (const [id, name] of Object.entries(view.names || {})) if (!rows.has(Number(id))) rows.set(Number(id), { id: Number(id), name, selectable: false });
      for (const client of rows.values()) { const option = new Option(`${client.name} · #${client.id}${client.selectable ? '' : ' — ' + copy(36)}`, String(client.id)); option.disabled = !client.selectable && client.id !== view.base?.pool.clientId; fields.clientId.add(option); }
      if (selected && !rows.has(Number(selected))) fields.clientId.add(new Option('#' + selected, selected)); fields.clientId.value = selected;
    }
    function display(field, value, names = current?.names || {}) {
      if (field === 'clientId') return `${names[value] || current?.catalog?.find(client => client.id === value)?.name || ''} (#${value})`.trim();
      if (field === 'monthlyAmount') return new Intl.NumberFormat(language(), { style: 'currency', currency: 'EUR' }).format(value);
      if (field === 'type' && ['POOL', 'JACUZZI'].includes(value)) return copy(value === 'POOL' ? 37 : 38);
      return value || copy(32);
    }
    function render() {
      const view = current, blocked = unavailable || invalidated || !db || !view?.base || view.loading || working || view.unavailable;
      Object.values(fields).forEach(field => { field.disabled = !!(blocked || view?.pending || view?.conflict || view?.review); });
      save.hidden = !!(view?.pending || view?.conflict || view?.review); save.disabled = !!(blocked || save.hidden);
      retry.hidden = !view?.pending || !!view.conflict || invalidated; retry.disabled = !!(blocked || view?.review);
      review.hidden = !view?.conflict || !!view?.review || invalidated; review.disabled = !!blocked;
      apply.hidden = !view?.review || invalidated; apply.disabled = !!blocked;
      discard.hidden = !view?.base || !!view.pending || !!view.review || invalidated; discard.disabled = !!blocked;
      reload.hidden = !!view?.base || invalidated; reload.disabled = working || !!view?.loading || unavailable;
      fieldBox.hidden = !!view?.review; form.setAttribute('aria-busy', String(working || !!view?.loading));
      status.textContent = view?.message === undefined ? '' : copy(view.message); status.hidden = view?.message === undefined; status.dataset.tone = view?.message === 10 ? 'success' : 'info';
      el('Title').textContent = copy(0); el('Subtitle').textContent = copy(1); el('TransferHint').textContent = copy(35);
      for (const [button, index] of [[save, 2], [el('Cancel'), 3], [retry, 4], [review, 5], [apply, 6], [discard, 7], [reload, 33]]) button.textContent = copy(index);
      el('Close').setAttribute('aria-label', copy(3)); keys.forEach((key, index) => { form.querySelector(`label[for="${fields[key].id}"]`).textContent = labels[language()][index]; });
      for (const option of fields.type.options) if (['POOL', 'JACUZZI', ''].includes(option.value)) option.textContent = copy(option.value === 'POOL' ? 37 : option.value === 'JACUZZI' ? 38 : 39);
      preview.replaceChildren(); preview.hidden = !view?.pending || invalidated;
      if (view?.pending && !invalidated) {
        const title = document.createElement('strong'); title.textContent = copy(24); preview.append(title);
        for (const [field, value] of Object.entries(view.pending.submission.changes)) { const line = document.createElement('p'); line.textContent = `${labels[language()][keys.indexOf(field)]}: ${display(field, value, view.pending.names)}`; preview.append(line); }
      }
    }
    function access(mode, operation) { return new Promise((resolve, reject) => { const tx = db.transaction('edits', mode), request = operation(tx.objectStore('edits')); tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(tx.error || Error('Storage failed')); }); }
    const read = async id => await access('readonly', store => store.get(key(id))) || { pending: null, confirmed: null }, write = (id, state) => access('readwrite', store => store.put(state, key(id)));
    const pick = pool => ({ id: pool.id, ...Object.fromEntries(keys.map(key => [key, pool[key]])) });
    function validPool(pool, id) { return pool && pool.id === id && validId(pool.clientId) && typeof pool.monthlyAmount === 'number' && Number.isFinite(pool.monthlyAmount) && pool.monthlyAmount >= 0 && keys.every(key => Object.hasOwn(pool, key) && (['clientId', 'monthlyAmount'].includes(key) || pool[key] === null || typeof pool[key] === 'string')); }
    function validBase(base, id) { return base && Object.keys(base).length === 2 && versionPattern.test(base.version) && validPool(base.pool, id) && Object.keys(base.pool).length === keys.length + 1; }
    function validValues(data) { return data && Object.keys(data).length === keys.length && keys.every(key => typeof data[key] === 'string' && data[key].length <= 10000); }
    function validNames(names) { return names && typeof names === 'object' && !Array.isArray(names) && Object.entries(names).every(([id, name]) => validId(Number(id)) && typeof name === 'string' && name.length <= 10000); }
    function validDraft(draft, id) { return draft && draft.schema === 1 && draft.owner === owner && draft.poolId === id && validBase(draft.base, id) && validValues(draft.values) && validNames(draft.names) && (!draft.requestId || uuid.test(draft.requestId)); }
    async function validRecord(record, id) {
      try {
        if (!validDraft(record, id) || !uuid.test(record.requestId) || Object.keys(record).some(key => !['schema', 'owner', 'poolId', 'requestId', 'base', 'values', 'names', 'submission', 'payloadHash'].includes(key))) return false;
        const patch = changes(record.base.pool, record.values), recipient = record.submission?.expectedClientVersion;
        if (Object.hasOwn(patch, 'clientId') ? !clientVersionPattern.test(recipient) : recipient !== null) return false;
        const expected = { v: 1, poolId: id, expectedVersion: record.base.version, expectedClientVersion: recipient, changes: patch };
        return serialized(record.submission) === serialized(expected) && record.payloadHash === await hash(expected);
      } catch { return false; }
    }
    function verify(result, record) {
      const receipt = result?.receipt;
      if (result?.ok !== true || !validPool(result.pool, record.poolId) || !versionPattern.test(result.version) || receipt?.scope !== 'POOL_EDIT' || receipt.actorKey !== owner
        || receipt.requestId !== record.requestId || receipt.poolId !== record.poolId || receipt.expectedVersion !== record.base.version || receipt.expectedClientVersion !== record.submission.expectedClientVersion || receipt.version !== result.version
        || receipt.payloadHash !== record.payloadHash || !validId(receipt.historyId) || receipt.previousClientId !== record.base.pool.clientId || receipt.clientId !== result.pool.clientId
        || !Number.isSafeInteger(result.reassignedVisits) || result.reassignedVisits < 0 || receipt.reassignedVisits !== result.reassignedVisits
        || (!Object.hasOwn(record.submission.changes, 'clientId') && result.reassignedVisits !== 0) || Object.entries(record.submission.changes).some(([key, value]) => result.pool[key] !== value)) throw Error('Unconfirmed edit');
      return { version: result.version, pool: pick(result.pool) };
    }
    async function checkState(state, id) { if (state.pending && !await validRecord(state.pending, id)) throw Error('Invalid request'); if (state.confirmed) { if (!await validRecord(state.confirmed.record, id)) throw Error('Invalid confirmation'); verify(state.confirmed.result, state.confirmed.record); } return state; }
    function saveDraft(view = current, data = values(), requestId = view?.lastRequestId || null) {
      if (!view?.base || !active() || !isCurrent(view)) return false;
      try { sessionStorage.setItem(draftKey(view.id), JSON.stringify({ schema: 1, owner, poolId: view.id, base: view.base, values: data, names: knownNames(view, data), requestId })); return true; }
      catch { note(18, view); return false; }
    }
    async function latest(id) {
      if (!active()) throw Error('Session changed'); const response = await fetch(`/api/pools/${id}/edit-state`, { headers: { Authorization: `Bearer ${credential}` } });
      const result = await response.json(); if (!active()) throw Error('Session changed');
      if (response.status !== 200 || result.ok !== true || result.scope !== 'POOL_EDIT' || result.poolId !== id || !validPool(result.pool, id) || !Array.isArray(result.clients)
        || !result.clients.every(client => validId(client.id) && typeof client.name === 'string' && typeof client.selectable === 'boolean' && clientVersionPattern.test(client.version)) || new Set(result.clients.map(c => c.id)).size !== result.clients.length || !result.clients.some(client => client.id === result.pool.clientId)) throw Error('State unavailable');
      const base = { version: result.version, pool: pick(result.pool) }; if (!validBase(base, id)) throw Error('State invalid'); return { base, clients: result.clients };
    }
    async function bannerRefresh() {
      if (!db || !active()) return; const states = await access('readonly', store => store.getAll()); if (!active()) return;
      const pending = states.map(state => state.pending).filter(record => record?.owner === owner); banner.replaceChildren(); banner.hidden = !pending.length;
      if (pending.length) { const title = document.createElement('p'); title.textContent = copy(23); banner.append(title); }
      for (const record of pending) { if (!validId(record.poolId)) continue; const button = document.createElement('button'); button.type = 'button'; button.className = 'cw-v2-btn'; button.dataset.poolEditPending = record.poolId; button.textContent = `${record.base?.pool?.name || '#' + record.poolId} — ${copy(4)}`; button.onclick = () => void open(record.poolId); banner.append(button); }
    }
    const ready = (async () => {
      try {
        const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))));
        const id = Number(user.userId || user.id); if (String(user.role).toUpperCase() !== 'ADMIN' || !validId(id)) throw Error('Administrator required');
        owner = user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN:' + await digest(String(user.email || '').trim().toLowerCase()) : 'USER:' + id;
        db = await new Promise((resolve, reject) => { const request = indexedDB.open('cw-pool-edits-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('edits'); request.onsuccess = () => resolve(request.result); request.onerror = request.onblocked = () => reject(Error('Storage unavailable')); });
        if (active()) await bannerRefresh();
      } catch { unavailable = true; note(12); } render();
    })();
    function applyConfirmation(view, record, result) {
      const snapshot = verify(result, record); if (!isCurrent(view)) return;
      const belongs = view.lastRequestId === record.requestId || (view.base?.version === record.base.version && equal(values(), record.values));
      view.pending = null; view.review = null; reviewBox.replaceChildren();
      if (belongs) { view.base = snapshot; view.names = record.names; assign(snapshot.pool); view.lastRequestId = null; view.conflict = false; try { sessionStorage.removeItem(draftKey(view.id)); } catch { /* Saved confirmation prevents stale replay. */ } note(10, view); }
      else { view.conflict = true; note(14, view); saveDraft(view); }
    }
    async function sync() {
      if (!db || working || !active()) return; const view = current;
      try { await bannerRefresh(); if (!view?.base || view.loading) return; const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view) || working) return;
        if (state.pending) { view.pending = state.pending; note(24, view); }
        else if (state.confirmed && (view.pending?.requestId === state.confirmed.record.requestId || view.lastRequestId === state.confirmed.record.requestId)) applyConfirmation(view, state.confirmed.record, state.confirmed.result);
        else if (view.pending) { view.pending = null; view.conflict = true; note(14, view); } render();
      } catch { if (isCurrent(view)) { view.unavailable = true; note(16, view); } }
    }
    async function open(id, focusClient = false) {
      id = Number(id); if (!validId(id) || (current && !close())) return;
      const view = { id, base: null, loading: true, message: 8, lastRequestId: null, names: {}, catalog: [] }; current = view;
      fields.clientId.replaceChildren(); fields.type.replaceChildren(new Option(copy(37), 'POOL'), new Option(copy(38), 'JACUZZI')); assign(null); reviewBox.replaceChildren(); modal.hidden = false; document.body.style.overflow = 'hidden'; render();
      await ready; if (!active() || !isCurrent(view)) return;
      try {
        if (!db || unavailable) throw Error('No local storage'); const state = await checkState(await read(id), id); if (!active() || !isCurrent(view)) return;
        let draft = null;
        try { const raw = sessionStorage.getItem(draftKey(id)); if (raw) { draft = JSON.parse(raw); if (!validDraft(draft, id)) throw Error('Invalid draft'); } } catch { view.unavailable = true; note(16, view); return; }
        if (draft && state.confirmed && (draft.requestId === state.confirmed.record.requestId || (draft.base.version === state.confirmed.record.base.version && equal(draft.values, state.confirmed.record.values)))) { draft = null; try { sessionStorage.removeItem(draftKey(id)); } catch { /* Confirmation retained. */ } }
        if (draft) { view.base = draft.base; view.names = draft.names; view.lastRequestId = draft.requestId; clientOptions(view); assign(draft.values); }
        if (state.pending) { view.pending = state.pending; if (!draft) { view.base = state.pending.base; view.names = state.pending.names; view.lastRequestId = state.pending.requestId; clientOptions(view); assign(state.pending.values); } note(24, view); }
        else { const fresh = await latest(id); if (!isCurrent(view)) return; if (!draft) { view.base = fresh.base; view.names = Object.fromEntries(fresh.clients.filter(c => c.id === fresh.base.pool.clientId).map(c => [c.id, c.name])); } clientOptions(view, fresh.clients);
          if (!draft) { assign(fresh.base.pool); view.message = undefined; } else { assign(draft.values); if (fresh.base.version !== view.base.version) { view.conflict = true; note(14, view); } else view.message = undefined; }
        }
      } catch { if (isCurrent(view)) note(unavailable ? 12 : 17, view); }
      finally { if (isCurrent(view)) { view.loading = false; render(); if (!view.pending && !view.conflict) fields[focusClient ? 'clientId' : 'name'].focus(); } }
    }
    function close() {
      const view = current; if (view?.base && !invalidated && !view.unavailable && !(view.discarded && equal(values(), view.base.pool)) && !saveDraft(view)) return false;
      current = null; assign(null); reviewBox.replaceChildren(); modal.hidden = true; document.body.style.overflow = ''; return true;
    }
    async function transport(record, view) {
      if (!active() || !await validRecord(record, record.poolId)) throw Error('Invalid request'); if (!active()) return 'unknown'; if (isCurrent(view)) note(9, view);
      controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`/api/pools/${record.poolId}`, { method: 'PUT', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...record.submission.changes, requestId: record.requestId, expectedVersion: record.base.version, expectedClientVersion: record.submission.expectedClientVersion }), signal: controller.signal });
        const result = await response.json(); if (!active()) return 'unknown';
        if (response.status === 409 && result.ok === false && ['POOL_VERSION_CONFLICT', 'POOL_EDIT_RECIPIENT_CHANGED'].includes(result.code)) { if (isCurrent(view)) { view.conflict = true; note(result.code === 'POOL_EDIT_RECIPIENT_CHANGED' ? 34 : 14, view); } return 'conflict'; }
        if (![200, 201].includes(response.status)) throw Error('Unconfirmed response'); verify(result, record);
        const state = await checkState(await read(record.poolId), record.poolId); if (!active()) return 'unknown'; if (state.pending?.requestId !== record.requestId || state.pending.payloadHash !== record.payloadHash) throw Error('Pending request changed');
        const saved = { ok: true, pool: pick(result.pool), version: result.version, receipt: result.receipt, reassignedVisits: result.reassignedVisits, replayed: result.replayed === true };
        await write(record.poolId, { pending: null, confirmed: { record, result: saved } }); if (!active()) return 'unknown';
        if (isCurrent(view)) applyConfirmation(view, record, result); channel?.postMessage('changed'); await bannerRefresh();
        try { if (active()) await options.confirmed?.(result); } catch { /* List failure does not revoke confirmation. */ } return 'confirmed';
      } catch { if (active() && isCurrent(view)) note(11, view); return 'unknown'; } finally { clearTimeout(timer); controller = null; }
    }
    async function withLock(view, operation) {
      if (!navigator.locks?.request || !crypto.randomUUID) { note(12, view); return; }
      await navigator.locks.request(`cw-pool-edit:${key(view.id)}`, { ifAvailable: true }, async lock => { if (!lock) { if (isCurrent(view)) note(15, view); return; } if (active()) await operation(); });
    }
    async function execute(repeat = false) {
      const view = current; if (!view?.base || working || unavailable || view.unavailable || view.loading || view.review || view.conflict) return; working = true; render();
      try { await ready; if (!active()) return; await withLock(view, async () => {
        const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view)) return;
        if (state.pending) { view.pending = state.pending; if (repeat) await transport(state.pending, view); else note(24, view); return; }
        if (state.confirmed && (view.lastRequestId === state.confirmed.record.requestId || (view.base.version === state.confirmed.record.base.version && equal(values(), state.confirmed.record.values)))) { applyConfirmation(view, state.confirmed.record, state.confirmed.result); return; }
        if (repeat) { view.pending = null; view.conflict = true; note(14, view); return; }
        const data = values(), patch = changes(view.base.pool, data);
        if (!validValues(data) || !data.name.trim() || !validId(Number(data.clientId)) || !/^\d+(?:[.,]\d+)?$/.test(data.monthlyAmount.trim()) || !Number.isFinite(normalize('monthlyAmount', data.monthlyAmount)) || (Object.hasOwn(patch, 'type') && !['POOL', 'JACUZZI'].includes(patch.type))) { note(20, view); return; }
        if (!Object.keys(patch).length) { note(19, view); return; }
        const client = view.catalog.find(client => client.id === Number(data.clientId));
        if (Object.hasOwn(patch, 'clientId') && (!client?.selectable || !clientVersionPattern.test(client.version))) { view.conflict = true; note(34, view); return; }
        const submission = { v: 1, poolId: view.id, expectedVersion: view.base.version, expectedClientVersion: Object.hasOwn(patch, 'clientId') ? client.version : null, changes: patch };
        const record = { schema: 1, owner, poolId: view.id, requestId: crypto.randomUUID(), base: view.base, values: data, names: knownNames(view, data), submission, payloadHash: await hash(submission) };
        if (!active() || !isCurrent(view)) return; await write(view.id, { ...state, pending: record }); const stored = await read(view.id);
        if (!await validRecord(stored.pending, view.id) || stored.pending.requestId !== record.requestId) throw Error('Local write not confirmed'); if (!active()) return;
        view.pending = record; view.lastRequestId = record.requestId; saveDraft(view, data, record.requestId); channel?.postMessage('changed'); render(); await bannerRefresh(); await transport(record, view);
      }); } catch { if (active() && isCurrent(view)) note(12, view); } finally { working = false; render(); }
    }
    function buildReview(view, snapshot, pending) {
      const own = values(), rows = []; reviewBox.replaceChildren();
      for (const field of keys) {
        const actual = normalize(field, snapshot.base.pool[field]), mine = normalize(field, own[field]), old = normalize(field, view.base.pool[field]);
        const candidates = [{ source: 'current', value: actual, label: 29 }];
        if (mine !== old && mine !== actual) candidates.push({ source: 'draft', value: mine, label: 30 });
        if (pending && Object.hasOwn(pending.submission.changes, field)) { const value = pending.submission.changes[field]; if (!candidates.some(candidate => candidate.value === value)) candidates.push({ source: 'pending', value, label: 31 }); }
        if (candidates.length === 1) continue;
        const section = document.createElement('section'); section.className = 'pool-edit-choice'; const title = document.createElement('strong'); title.textContent = labels[language()][keys.indexOf(field)]; section.append(title);
        const select = document.createElement('select'); select.dataset.poolEditField = field; select.setAttribute('aria-label', title.textContent); select.add(new Option(copy(28), ''));
        for (const candidate of candidates) { candidate.allowed = field !== 'clientId' || candidate.value === snapshot.base.pool.clientId || snapshot.clients.some(client => client.id === candidate.value && client.selectable);
          const line = document.createElement('p'); line.textContent = `${copy(candidate.source === 'current' ? 25 : candidate.source === 'draft' ? 26 : 27)}: ${display(field, candidate.value, { ...view.names, ...pending?.names })}${candidate.allowed ? '' : ' — ' + copy(36)}`; section.append(line);
          const option = new Option(copy(candidate.label), candidate.source); option.disabled = !candidate.allowed; select.add(option);
        }
        if (candidates.length === 2) { const candidate = candidates[1], baseline = candidate.source === 'draft' ? old : normalize(field, pending.base.pool[field]); if (actual === baseline && candidate.allowed) select.value = candidate.source; }
        section.append(select); reviewBox.append(section); rows.push({ field, candidates, select });
      }
      view.review = { snapshot, pendingId: pending?.requestId || null, rows }; render();
    }
    async function prepareReview() {
      const view = current; if (!view?.base || working || !view.conflict) return; working = true; render();
      try { await withLock(view, async () => { const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view)) return; if (state.pending && await transport(state.pending, view) !== 'conflict') return; const snapshot = await latest(view.id); if (active() && isCurrent(view)) buildReview(view, snapshot, state.pending); }); }
      catch { if (active() && isCurrent(view)) note(17, view); } finally { working = false; render(); }
    }
    async function applyReview() {
      const view = current, revision = view?.review; if (!revision || working) return;
      const missing = revision.rows.find(row => !row.candidates.some(candidate => candidate.source === row.select.value && candidate.allowed)); if (missing) { note(21, view); missing.select.focus(); return; }
      working = true; render();
      try { await withLock(view, async () => {
        const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view)) return;
        if ((state.pending?.requestId || null) !== revision.pendingId) { view.review = null; reviewBox.replaceChildren(); note(14, view); return; }
        if (state.pending && await transport(state.pending, view) !== 'conflict') return;
        const next = { ...revision.snapshot.base.pool }; for (const row of revision.rows) next[row.field] = row.candidates.find(candidate => candidate.source === row.select.value).value;
        const data = Object.fromEntries(keys.map(key => [key, String(next[key] ?? '')])), names = Object.fromEntries(revision.snapshot.clients.filter(client => [next.clientId, revision.snapshot.base.pool.clientId].includes(client.id)).map(client => [client.id, client.name]));
        sessionStorage.setItem(draftKey(view.id), JSON.stringify({ schema: 1, owner, poolId: view.id, base: revision.snapshot.base, values: data, names, requestId: null }));
        if (state.pending) await write(view.id, { ...state, pending: null }); if (!active() || !isCurrent(view)) return;
        view.base = revision.snapshot.base; view.names = names; view.pending = null; view.lastRequestId = null; view.conflict = false; view.review = null; clientOptions(view, revision.snapshot.clients); assign(data); reviewBox.replaceChildren(); note(22, view); channel?.postMessage('changed'); await bannerRefresh();
      }); } catch { if (active() && isCurrent(view)) note(18, view); } finally { working = false; render(); }
    }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cw-pool-edits') : null;
    if (channel) channel.onmessage = () => void sync();
    form.onsubmit = event => { event.preventDefault(); void execute(); }; retry.onclick = () => void execute(true); review.onclick = () => void prepareReview(); apply.onclick = () => void applyReview();
    el('Cancel').onclick = close; el('Close').onclick = close; reload.onclick = () => current && void open(current.id);
    discard.onclick = () => { if (!current?.base || current.pending || working || !active()) return; try { sessionStorage.removeItem(draftKey(current.id)); assign(current.base.pool); current.lastRequestId = null; current.discarded = true; note(19); } catch { note(18); } };
    Object.values(fields).forEach(field => { field.addEventListener('input', () => saveDraft()); field.addEventListener('change', () => saveDraft()); });
    window.addEventListener('storage', active); window.addEventListener('focus', () => void sync());
    window.addEventListener('cw-language-change', () => { if (!active()) return; if (current?.review) { const old = current.review, selected = new Map(old.rows.map(row => [row.field, row.select.value])); buildReview(current, old.snapshot, current.pending); for (const row of current.review.rows) if (selected.has(row.field)) row.select.value = selected.get(row.field); } if (current) clientOptions(current, current.catalog); render(); void bannerRefresh().catch(() => {}); });
    setInterval(active, 500); render(); return { ready, open, close, save: () => execute(), sync };
  }
  window.CWPoolEdit = { create };
})();
