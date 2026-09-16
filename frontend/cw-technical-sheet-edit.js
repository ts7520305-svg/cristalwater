(function () {
  'use strict';
  const keys = ["name", "type", "zone", "address", "monthlyAmount", "notes", "lengthM", "widthM", "depthMinM", "depthMaxM", "averageDepthM", "pumpFlowM3h", "targetSalinityPpm", "targetChlorinePpm", "currentWaterTempC", "pumpType", "pumpPower", "filterType", "filterMedia", "saltSystem", "lightsCount", "lightsType", "equipmentNotes", "technicalRoomLocation", "technicalRoomCondition", "technicalRoomVentilation", "technicalRoomElectrical", "technicalRoomNotes", "historyNote"];
  const labels = {
  "pt": [
    "Nome",
    "Tipo",
    "Zona",
    "Morada",
    "Valor mensal (€)",
    "Notas gerais",
    "Comprimento (m)",
    "Largura (m)",
    "Profundidade mínima (m)",
    "Profundidade máxima (m)",
    "Profundidade média (m)",
    "Caudal da bomba (m³/h)",
    "Sal alvo (ppm)",
    "Cloro alvo (ppm)",
    "Temperatura da água (°C)",
    "Tipo de bomba",
    "Potência da bomba",
    "Tipo de filtro",
    "Meio filtrante",
    "Máquina de sal",
    "Número de luzes",
    "Tipo de luzes",
    "Notas do equipamento",
    "Localização da casa técnica",
    "Estado geral",
    "Ventilação",
    "Quadro elétrico",
    "Notas da casa técnica",
    "Nova nota para o histórico"
  ],
  "en": [
    "Name",
    "Type",
    "Area",
    "Address",
    "Monthly amount (€)",
    "General notes",
    "Length (m)",
    "Width (m)",
    "Minimum depth (m)",
    "Maximum depth (m)",
    "Average depth (m)",
    "Pump flow (m³/h)",
    "Target salinity (ppm)",
    "Target chlorine (ppm)",
    "Water temperature (°C)",
    "Pump type",
    "Pump power",
    "Filter type",
    "Filter media",
    "Salt system",
    "Number of lights",
    "Light type",
    "Equipment notes",
    "Technical room location",
    "General condition",
    "Ventilation",
    "Electrical panel",
    "Technical room notes",
    "New history note"
  ],
  "fr": [
    "Nom",
    "Type",
    "Zone",
    "Adresse",
    "Montant mensuel (€)",
    "Notes générales",
    "Longueur (m)",
    "Largeur (m)",
    "Profondeur minimale (m)",
    "Profondeur maximale (m)",
    "Profondeur moyenne (m)",
    "Débit de pompe (m³/h)",
    "Salinité cible (ppm)",
    "Chlore cible (ppm)",
    "Température de l’eau (°C)",
    "Type de pompe",
    "Puissance de pompe",
    "Type de filtre",
    "Média filtrant",
    "Électrolyseur au sel",
    "Nombre de lampes",
    "Type de lampes",
    "Notes sur les équipements",
    "Emplacement du local technique",
    "État général",
    "Ventilation",
    "Tableau électrique",
    "Notes du local technique",
    "Nouvelle note d’historique"
  ],
  "es": [
    "Nombre",
    "Tipo",
    "Zona",
    "Dirección",
    "Importe mensual (€)",
    "Notas generales",
    "Longitud (m)",
    "Anchura (m)",
    "Profundidad mínima (m)",
    "Profundidad máxima (m)",
    "Profundidad media (m)",
    "Caudal de bomba (m³/h)",
    "Salinidad objetivo (ppm)",
    "Cloro objetivo (ppm)",
    "Temperatura del agua (°C)",
    "Tipo de bomba",
    "Potencia de bomba",
    "Tipo de filtro",
    "Medio filtrante",
    "Sistema de sal",
    "Número de luces",
    "Tipo de luces",
    "Notas de equipos",
    "Ubicación del cuarto técnico",
    "Estado general",
    "Ventilación",
    "Cuadro eléctrico",
    "Notas del cuarto técnico",
    "Nueva nota para el historial"
  ],
  "de": [
    "Name",
    "Typ",
    "Gebiet",
    "Adresse",
    "Monatsbetrag (€)",
    "Allgemeine Notizen",
    "Länge (m)",
    "Breite (m)",
    "Mindesttiefe (m)",
    "Höchsttiefe (m)",
    "Mittlere Tiefe (m)",
    "Pumpendurchfluss (m³/h)",
    "Zielsalzgehalt (ppm)",
    "Zielchlorgehalt (ppm)",
    "Wassertemperatur (°C)",
    "Pumpentyp",
    "Pumpenleistung",
    "Filtertyp",
    "Filtermedium",
    "Salzanlage",
    "Anzahl der Leuchten",
    "Leuchtentyp",
    "Gerätenotizen",
    "Standort des Technikraums",
    "Allgemeiner Zustand",
    "Belüftung",
    "Schalttafel",
    "Technikraumnotizen",
    "Neue Verlaufsnotiz"
  ]
};
  const texts = {
    pt: ['Editar ficha técnica', 'Reveja os dados antes de guardar.', 'Guardar alterações', 'Fechar', 'Confirmar pedido pendente', 'Rever alterações', 'Preparar edição revista', 'Descartar rascunho', 'A carregar os dados atuais…', 'A guardar…', 'Alteração confirmada.', 'Envio não confirmado. As alterações foram conservadas; repita a confirmação.', 'Não foi possível guardar neste dispositivo. Nenhum novo pedido foi enviado.', 'A sessão mudou. Volte a abrir a página com a sua conta.', 'Os dados mudaram. Reveja as alterações antes de guardar.', 'Outra janela está a tratar desta piscina.', 'O pedido guardado não pôde ser validado. Foi conservado neste dispositivo.', 'Não foi possível carregar os dados atuais. O rascunho foi conservado.', 'Não foi possível guardar o rascunho. Mantenha esta janela aberta ou descarte-o explicitamente.', 'Não há alterações para guardar.', 'Verifique o nome, os valores numéricos e a ordem das profundidades. O valor mensal é obrigatório e não pode ser negativo.', 'Escolha o valor de cada campo em conflito.', 'A revisão está preparada. Confira os campos e guarde para enviar um novo pedido.', 'Alterações por confirmar', 'Pedido pendente', 'Atual', 'O seu rascunho', 'Pedido anterior', 'Escolha…', 'Manter atual', 'Usar rascunho', 'Usar pedido anterior', '(vazio)', 'Carregar novamente', 'O cliente selecionado mudou ou deixou de estar disponível. Reveja a associação.', 'O volume usa as dimensões e o formato guardado na calculadora técnica. A nova nota é acrescentada uma única vez após confirmação.', 'Piscina de crianças', 'Piscina', 'Jacuzzi', 'Tipo por definir', 'Sem máquina de sal', 'Com máquina de sal', 'Volume calculado (m³)'],
    en: ['Edit technical sheet', 'Review the details before saving.', 'Save changes', 'Close', 'Confirm pending request', 'Review changes', 'Prepare revised edit', 'Discard draft', 'Loading current details…', 'Saving…', 'Change confirmed.', 'Send not confirmed. Your changes were retained; retry confirmation.', 'Could not save on this device. No new request was sent.', 'The session changed. Reopen the page with your account.', 'The details changed. Review your changes before saving.', 'Another window is handling this pool.', 'The saved request could not be verified. It remains on this device.', 'Could not load current details. Your draft was retained.', 'Could not save the draft. Keep this window open or explicitly discard it.', 'There are no changes to save.', 'Check the name, numeric values and depth order. The monthly amount is required and cannot be negative.', 'Choose a value for every conflicting field.', 'The revision is ready. Review the fields and save to send a new request.', 'Changes awaiting confirmation', 'Pending request', 'Current', 'Your draft', 'Previous request', 'Choose…', 'Keep current', 'Use draft', 'Use previous request', '(empty)', 'Load again', 'The selected customer changed or is no longer available. Review the assignment.', 'Volume uses the dimensions and shape saved in the technical calculator. The new note is added once after confirmation.', 'Children’s pool', 'Pool', 'Jacuzzi', 'Type not set', 'Without salt system', 'With salt system', 'Calculated volume (m³)'],
    fr: ['Modifier la fiche technique', 'Vérifiez les données avant de les enregistrer.', 'Enregistrer les modifications', 'Fermer', 'Confirmer la demande en attente', 'Revoir les modifications', 'Préparer la modification révisée', 'Supprimer le brouillon', 'Chargement des données actuelles…', 'Enregistrement…', 'Modification confirmée.', 'Envoi non confirmé. Les modifications sont conservées ; réessayez.', 'Impossible de conserver les données sur cet appareil. Aucune nouvelle demande envoyée.', 'La session a changé. Rouvrez la page avec votre compte.', 'Les données ont changé. Revoyez vos modifications avant de les enregistrer.', 'Une autre fenêtre traite cette piscine.', 'La demande conservée n’a pas pu être vérifiée. Elle reste sur cet appareil.', 'Chargement impossible. Le brouillon est conservé.', 'Impossible de conserver le brouillon. Gardez cette fenêtre ouverte ou supprimez-le explicitement.', 'Aucune modification à enregistrer.', 'Vérifiez le nom, les valeurs numériques et l’ordre des profondeurs. Le montant mensuel est obligatoire et ne peut pas être négatif.', 'Choisissez une valeur pour chaque champ en conflit.', 'La révision est prête. Vérifiez les champs et enregistrez une nouvelle demande.', 'Modifications à confirmer', 'Demande en attente', 'Actuel', 'Votre brouillon', 'Demande précédente', 'Choisir…', 'Conserver l’actuel', 'Utiliser le brouillon', 'Utiliser la demande précédente', '(vide)', 'Recharger', 'Le client sélectionné a changé ou n’est plus disponible. Revoyez l’affectation.', 'Le volume utilise les dimensions et la forme du calculateur technique. La nouvelle note est ajoutée une seule fois après confirmation.', 'Piscine pour enfants', 'Piscine', 'Jacuzzi', 'Type non défini', 'Sans électrolyseur', 'Avec électrolyseur', 'Volume calculé (m³)'],
    es: ['Editar ficha técnica', 'Revise los datos antes de guardar.', 'Guardar cambios', 'Cerrar', 'Confirmar solicitud pendiente', 'Revisar cambios', 'Preparar edición revisada', 'Descartar borrador', 'Cargando datos actuales…', 'Guardando…', 'Cambio confirmado.', 'Envío sin confirmar. Se conservaron los cambios; repita la confirmación.', 'No se pudo guardar en este dispositivo. No se envió ninguna solicitud nueva.', 'La sesión cambió. Abra la página con su cuenta.', 'Los datos cambiaron. Revise los cambios antes de guardar.', 'Otra ventana está procesando esta piscina.', 'No se pudo verificar la solicitud guardada. Se conservó en este dispositivo.', 'No se pudieron cargar los datos actuales. Se conservó el borrador.', 'No se pudo guardar el borrador. Mantenga esta ventana abierta o descártelo expresamente.', 'No hay cambios para guardar.', 'Revise el nombre, los valores numéricos y el orden de las profundidades. El importe mensual es obligatorio y no puede ser negativo.', 'Elija un valor para cada campo en conflicto.', 'La revisión está preparada. Revise los campos y guarde una nueva solicitud.', 'Cambios por confirmar', 'Solicitud pendiente', 'Actual', 'Su borrador', 'Solicitud anterior', 'Elija…', 'Mantener actual', 'Usar borrador', 'Usar solicitud anterior', '(vacío)', 'Cargar de nuevo', 'El cliente seleccionado cambió o ya no está disponible. Revise la asignación.', 'El volumen usa las dimensiones y la forma de la calculadora técnica. La nueva nota se añade una sola vez tras la confirmación.', 'Piscina infantil', 'Piscina', 'Jacuzzi', 'Tipo sin definir', 'Sin sistema de sal', 'Con sistema de sal', 'Volumen calculado (m³)'],
    de: ['Technisches Datenblatt bearbeiten', 'Prüfen Sie die Angaben vor dem Speichern.', 'Änderungen speichern', 'Schließen', 'Ausstehende Anfrage bestätigen', 'Änderungen prüfen', 'Überarbeitete Änderung vorbereiten', 'Entwurf verwerfen', 'Aktuelle Angaben werden geladen…', 'Wird gespeichert…', 'Änderung bestätigt.', 'Senden nicht bestätigt. Die Änderungen bleiben erhalten; erneut bestätigen.', 'Speichern auf diesem Gerät fehlgeschlagen. Keine neue Anfrage gesendet.', 'Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut mit Ihrem Konto.', 'Die Angaben haben sich geändert. Prüfen Sie Ihre Änderungen vor dem Speichern.', 'Ein anderes Fenster bearbeitet diesen Pool.', 'Die gespeicherte Anfrage konnte nicht geprüft werden. Sie bleibt auf diesem Gerät.', 'Aktuelle Angaben konnten nicht geladen werden. Der Entwurf bleibt erhalten.', 'Entwurf konnte nicht gespeichert werden. Lassen Sie dieses Fenster offen oder verwerfen Sie ihn ausdrücklich.', 'Keine Änderungen zu speichern.', 'Prüfen Sie Namen, Zahlenwerte und Tiefenreihenfolge. Der Monatsbetrag ist erforderlich und darf nicht negativ sein.', 'Wählen Sie für jedes widersprüchliche Feld einen Wert.', 'Die Überarbeitung ist bereit. Prüfen Sie die Felder und speichern Sie eine neue Anfrage.', 'Änderungen zur Bestätigung', 'Ausstehende Anfrage', 'Aktuell', 'Ihr Entwurf', 'Vorherige Anfrage', 'Auswählen…', 'Aktuellen Wert behalten', 'Entwurf verwenden', 'Vorherige Anfrage verwenden', '(leer)', 'Erneut laden', 'Der ausgewählte Kunde hat sich geändert oder ist nicht mehr verfügbar. Prüfen Sie die Zuordnung.', 'Das Volumen nutzt die Maße und Form aus dem technischen Rechner. Die neue Notiz wird nach Bestätigung einmal hinzugefügt.', 'Kinderbecken', 'Pool', 'Whirlpool', 'Typ nicht festgelegt', 'Ohne Salzanlage', 'Mit Salzanlage', 'Berechnetes Volumen (m³)'],
  };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const versionPattern = /^technical-sheet-v1:[0-9a-f]{64}$/;
  const extra = ['clientId', 'volumeM3', 'calculatedVolumeM3', 'treatmentVolumeM3', 'shape', 'diameterM', 'shapeFactor'];
  const numeric = ['monthlyAmount', 'lengthM', 'widthM', 'depthMinM', 'depthMaxM', 'averageDepthM', 'pumpFlowM3h', 'targetSalinityPpm', 'targetChlorinePpm', 'currentWaterTempC', 'lightsCount'];
  const validId = id => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
  const canonical = value => value && typeof value === 'object' ? (Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))) : value;
  const serialized = value => JSON.stringify(canonical(value));
  const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(serialized(value));
  const normalize = (key, value) => {
    if (key === 'saltSystem') return value === true || value === 'true';
    if (numeric.includes(key)) { const raw = String(value ?? '').trim(); return !raw ? (key === 'monthlyAmount' ? NaN : null) : Number(raw.replace(',', '.')); }
    return String(value ?? '').trim() || null;
  };
  function predicted(base, patch) {
    const next = { ...base, ...patch, historyNote: null };
    if (!['lengthM', 'widthM', 'depthMinM', 'depthMaxM', 'averageDepthM'].some(key => Object.hasOwn(patch, key))) return next;
    let depth = next.averageDepthM;
    if ((!depth || (!Object.hasOwn(patch, 'averageDepthM') && ['depthMinM', 'depthMaxM'].some(key => Object.hasOwn(patch, key)))) && next.depthMinM > 0 && next.depthMaxM > 0) depth = next.averageDepthM = (next.depthMinM + next.depthMaxM) / 2;
    const factor = next.shapeFactor ?? 1, circle = /^(CIRCULAR|CIRCLE|ROUND)$/i.test(next.shape || ''); let volume;
    if (depth > 0 && factor > 0) {
      if (circle && next.diameterM > 0) volume = Math.PI * (next.diameterM / 2) ** 2 * depth * factor;
      else if (next.lengthM > 0 && next.widthM > 0) volume = next.lengthM * next.widthM * depth * factor;
      else if (next.diameterM > 0) volume = Math.PI * (next.diameterM / 2) ** 2 * depth * factor;
    }
    if (volume !== undefined) next.volumeM3 = next.calculatedVolumeM3 = next.treatmentVolumeM3 = Math.round(volume * 10) / 10;
    return next;
  }
  function validInput(data, base) {
    if (!String(data.name || '').trim() || !String(data.type || '').trim()) return false;
    if (!numeric.every(key => { const n = normalize(key, data[key]); return (n === null && key !== 'monthlyAmount') || (Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER && (key === 'currentWaterTempC' || n >= 0) && (key !== 'lightsCount' || (Number.isSafeInteger(n) && n <= 2147483647))); })) return false;
    const next = predicted(base, changes(base, data));
    return !(next.depthMinM != null && next.depthMaxM != null && next.depthMinM > next.depthMaxM) && (next.volumeM3 == null || (Number.isFinite(next.volumeM3) && next.volumeM3 <= Number.MAX_SAFE_INTEGER));
  }
  const changes = (base, data) => Object.fromEntries(keys.filter(key => normalize(key, base[key]) !== normalize(key, data[key])).map(key => [key, normalize(key, data[key])]));
  const equal = (a, b) => keys.every(key => normalize(key, a?.[key]) === normalize(key, b?.[key]));
  function create(options = {}) {
    const form = document.getElementById('sheetForm');
    const panel = document.createElement('section'); panel.className = 'card sheet-edit-recovery'; panel.dataset.cwNoI18n = '';
    panel.innerHTML = `<h2 id="sheetEditTitle"></h2><p id="sheetEditSubtitle"></p><section id="sheetEditPending" hidden></section><div id="sheetEditComparison"></div><div id="sheetEditPendingList" hidden></div><div class="sheet-edit-actions"><button id="sheetEditReload" type="button" hidden></button><button id="sheetEditDiscard" type="button" hidden></button><button id="sheetEditRetry" type="button" class="primary" hidden></button><button id="sheetEditReview" type="button" hidden></button><button id="sheetEditApplyReview" type="button" class="primary" hidden></button></div>`;
    form.prepend(panel);
    const el = id => document.getElementById('sheetEdit' + id), status = document.getElementById('status'), preview = el('Pending'), reviewBox = el('Comparison');
    status.dataset.cwNoI18n = ''; const banner = el('PendingList'), save = form.querySelector('button[type="submit"]'), retry = el('Retry'), review = el('Review'), apply = el('ApplyReview'), discard = el('Discard'), reload = el('Reload');
    save.dataset.cwNoI18n = '';
    const fields = Object.fromEntries(keys.map(key => {
      const input = document.getElementById(key); input.dataset.cwNoI18n = ''; input.maxLength = 10000;
      if (numeric.includes(key)) { input.type = 'text'; input.inputMode = 'decimal'; }
      const label = form.querySelector(`label[for="${key}"]`); if (label) label.dataset.cwNoI18n = '';
      return [key, input];
    }));
    const volume = document.getElementById('volumeM3'), volumeLabel = form.querySelector('label[for="volumeM3"]'); volumeLabel.dataset.cwNoI18n = '';
    const help = form.querySelector('.calc-help'); help.dataset.cwNoI18n = '';
    let credential = '', owner = '', db, current = null, working = false, invalidated = false, unavailable = false, controller;
    const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
    try { credential = token(); } catch { unavailable = true; }
    const language = () => { const lang = String(window.CristalI18n?.readLanguage?.() || document.documentElement.lang || 'pt').slice(0, 2); return texts[lang] ? lang : 'pt'; };
    const copy = index => texts[language()][index], key = id => `${owner}:${id}`, draftKey = id => 'cwTechnicalSheetDraft:v1:' + key(id);
    const values = () => Object.fromEntries(keys.map(key => [key, fields[key].value]));
    const isCurrent = view => current === view && !invalidated;
    function note(index, view = current) { if (view) view.message = index; render(); }
    function active() {
      let same = false; try { same = !!credential && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential); } catch { /* fail closed */ }
      if (!invalidated && same) return true;
      if (!invalidated) { invalidated = true; controller?.abort(); assign(null);  if (current) current.review = null; preview.replaceChildren(); reviewBox.replaceChildren(); banner.replaceChildren(); options.invalidated?.(); }
      if (current) current.message = 13; render(); return false;
    }
    function assign(data) {
      for (const key of keys) {
        const value = String(data?.[key] ?? '');
        if (key === 'type' && !Array.from(fields[key].options).some(option => option.value === value)) fields[key].add(new Option(value || copy(39), value));
        fields[key].value = value;
      }
    }
    function display(field, value) {
      if (field === 'monthlyAmount') return new Intl.NumberFormat(language(), { style: 'currency', currency: 'EUR' }).format(value);
      if (field === 'saltSystem') return copy(value ? 41 : 40);
      if (field === 'type' && ['POOL', 'JACUZZI', 'CHILDREN_POOL'].includes(value)) return copy(value === 'POOL' ? 37 : value === 'JACUZZI' ? 38 : 36);
      return value == null || value === '' ? copy(32) : String(value);
    }
    function updateVolume() { volume.value = current?.base && !invalidated ? predicted(current.base.pool, changes(current.base.pool, values())).volumeM3 ?? '' : ''; }
    function render() {
      const view = current, blocked = unavailable || invalidated || !db || !view?.base || view.loading || working || view.unavailable;
      Object.values(fields).forEach(field => { field.disabled = !!(blocked || view?.pending || view?.conflict || view?.review); });
      save.hidden = !!(view?.pending || view?.conflict || view?.review); save.disabled = !!(blocked || save.hidden);
      retry.hidden = !view?.pending || !!view.conflict || invalidated; retry.disabled = !!(blocked || view?.review);
      review.hidden = !view?.conflict || !!view?.review || invalidated; review.disabled = !!blocked;
      apply.hidden = !view?.review || invalidated; apply.disabled = !!blocked;
      discard.hidden = !view?.base || !!view.pending || !!view.review || invalidated; discard.disabled = !!blocked;
      reload.hidden = (!!view?.base && !view.unavailable) || invalidated; reload.disabled = working || !!view?.loading || unavailable;
      form.setAttribute('aria-busy', String(working || !!view?.loading));
      status.textContent = view?.message === undefined ? '' : copy(view.message); status.hidden = view?.message === undefined; status.dataset.tone = view?.message === 10 ? 'success' : 'info';
      el('Title').textContent = copy(0); const heading = document.querySelector('.page-head h1'); heading.dataset.cwNoI18n = ''; heading.textContent = copy(0); el('Subtitle').textContent = copy(1); help.textContent = copy(35); volumeLabel.textContent = copy(42);
      for (const [button, index] of [[save, 2], [retry, 4], [review, 5], [apply, 6], [discard, 7], [reload, 33]]) button.textContent = copy(index);
      keys.forEach((key, index) => { form.querySelector(`label[for="${fields[key].id}"]`).textContent = labels[language()][index]; fields[key].placeholder = labels[language()][index]; });
      for (const option of fields.type.options) if (['POOL', 'JACUZZI', 'CHILDREN_POOL', ''].includes(option.value)) option.textContent = copy(option.value === 'POOL' ? 37 : option.value === 'JACUZZI' ? 38 : option.value === 'CHILDREN_POOL' ? 36 : 39);
      for (const option of fields.saltSystem.options) option.textContent = copy(option.value === 'true' ? 41 : 40);
      updateVolume();
      preview.replaceChildren(); preview.hidden = !view?.pending || invalidated;
      if (view?.pending && !invalidated) {
        const title = document.createElement('strong'); title.textContent = copy(24); preview.append(title);
        for (const [field, value] of Object.entries(view.pending.submission.changes)) { const line = document.createElement('p'); line.textContent = `${labels[language()][keys.indexOf(field)]}: ${display(field, value)}`; preview.append(line); }
      }
    }
    function access(mode, operation) { return new Promise((resolve, reject) => { const tx = db.transaction('edits', mode), request = operation(tx.objectStore('edits')); tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(tx.error || Error('Storage failed')); }); }
    const read = async id => await access('readonly', store => store.get(key(id))) || { pending: null, confirmed: null }, write = (id, state) => access('readwrite', store => store.put(state, key(id)));
    const pick = pool => ({ id: pool.id, ...Object.fromEntries([...keys, ...extra].map(key => [key, pool[key]])) });
    function validPool(pool, id) {
      return pool && pool.id === id && validId(pool.clientId) && pool.historyNote === null && typeof pool.saltSystem === 'boolean' && typeof pool.monthlyAmount === 'number' && Number.isFinite(pool.monthlyAmount) && pool.monthlyAmount >= 0
        && [...keys, ...extra].every(key => Object.hasOwn(pool, key) && (key === 'clientId' || key === 'saltSystem' || (numeric.includes(key) || ['volumeM3', 'calculatedVolumeM3', 'treatmentVolumeM3', 'diameterM', 'shapeFactor'].includes(key) ? pool[key] === null || (typeof pool[key] === 'number' && Number.isFinite(pool[key])) : pool[key] === null || typeof pool[key] === 'string')));
    }
    function validBase(base, id) { return base && Object.keys(base).length === 2 && versionPattern.test(base.version) && validPool(base.pool, id) && Object.keys(base.pool).length === keys.length + extra.length + 1; }
    function validValues(data) { return data && Object.keys(data).length === keys.length && keys.every(key => typeof data[key] === 'string' && data[key].length <= 10000); }
    function validDraft(draft, id) { return draft && draft.schema === 1 && draft.owner === owner && draft.poolId === id && validBase(draft.base, id) && validValues(draft.values) && (!draft.requestId || uuid.test(draft.requestId)); }
    async function validRecord(record, id) {
      try {
        if (!validDraft(record, id) || !uuid.test(record.requestId) || Object.keys(record).some(key => !['schema', 'owner', 'poolId', 'requestId', 'base', 'values', 'submission', 'payloadHash'].includes(key))) return false;
        if (!validInput(record.values, record.base.pool)) return false;
        const patch = changes(record.base.pool, record.values);
        if (!Object.keys(patch).length) return false;
        const expected = { v: 1, poolId: id, expectedVersion: record.base.version, changes: patch };
        return serialized(record.submission) === serialized(expected) && record.payloadHash === await hash(expected);
      } catch { return false; }
    }
    function verify(result, record) {
      const receipt = result?.receipt, propagation = result?.propagation, noteId = result?.noteHistoryId;
      if (result?.ok !== true || !validPool(result.pool, record.poolId) || !versionPattern.test(result.version) || receipt?.scope !== 'TECHNICAL_SHEET_EDIT' || receipt.actorKey !== owner
        || receipt.requestId !== record.requestId || receipt.poolId !== record.poolId || receipt.expectedVersion !== record.base.version || receipt.version !== result.version || receipt.payloadHash !== record.payloadHash
        || !validId(result.historyId) || receipt.historyId !== result.historyId || receipt.noteHistoryId !== noteId || (record.submission.changes.historyNote ? !validId(noteId) : noteId !== null)
        || propagation?.persisted !== true || !validId(propagation.historyId) || !validId(propagation.notificationId) || receipt.propagationHistoryId !== propagation.historyId || receipt.notificationId !== propagation.notificationId
        || new Set([result.historyId, propagation.historyId, ...(noteId ? [noteId] : [])]).size !== (noteId ? 3 : 2)
        || serialized(pick(result.pool)) !== serialized(predicted(record.base.pool, record.submission.changes))) throw Error('Unconfirmed edit');
      return { version: result.version, pool: pick(result.pool) };
    }
    const confirmations = state => [...(state.settled || []), ...(state.confirmed ? [state.confirmed] : [])];
    async function checkState(state, id) {
      if (!state || typeof state !== 'object' || Array.isArray(state) || (state.settled !== undefined && !Array.isArray(state.settled))) throw Error('Invalid recovery state');
      if (state.pending && !await validRecord(state.pending, id)) throw Error('Invalid request');
      for (const item of confirmations(state)) { if (!await validRecord(item?.record, id)) throw Error('Invalid confirmation'); verify(item.result, item.record); }
      return state;
    }
    function saveDraft(view = current, data = values(), requestId = view?.lastRequestId || null) {
      if (!view?.base || !active() || !isCurrent(view)) return false;
      try { sessionStorage.setItem(draftKey(view.id), JSON.stringify({ schema: 1, owner, poolId: view.id, base: view.base, values: data, requestId })); return true; }
      catch { note(18, view); return false; }
    }
    async function latest(id) {
      if (!active()) throw Error('Session changed'); const response = await fetch(`/api/core/pools/${id}/technical-sheet/edit-state`, { headers: { Authorization: `Bearer ${credential}` } });
      const result = await response.json(); if (!active()) throw Error('Session changed');
      if (response.status !== 200 || result.ok !== true || result.scope !== 'TECHNICAL_SHEET_EDIT' || result.poolId !== id || !validPool(result.pool, id)) throw Error('State unavailable');
      const base = { version: result.version, pool: pick(result.pool) }; if (!validBase(base, id)) throw Error('State invalid'); return { base };
    }
    async function bannerRefresh() {
      if (!db || !active()) return; const states = await access('readonly', store => store.getAll()); if (!active()) return;
      const pending = states.map(state => state.pending).filter(record => record?.owner === owner && record.poolId !== current?.id); banner.replaceChildren(); banner.hidden = !pending.length;
      if (pending.length) { const title = document.createElement('p'); title.textContent = copy(23); banner.append(title); }
      for (const record of pending) { if (!validId(record.poolId) || record.poolId === current?.id) continue; const link = document.createElement('a'); link.href = `/admin-pool-technical?poolId=${record.poolId}`; link.textContent = `${record.base?.pool?.name || '#' + record.poolId} — ${copy(4)}`; banner.append(link); }
    }
    const ready = (async () => {
      try {
        const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))));
        const id = Number(user.userId || user.id); if (String(user.role).toUpperCase() !== 'ADMIN' || !validId(id)) throw Error('Administrator required');
        owner = user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN:' + await digest(String(user.email || '').trim().toLowerCase()) : 'USER:' + id;
        db = await new Promise((resolve, reject) => { const request = indexedDB.open('cw-technical-sheet-edits-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('edits'); request.onsuccess = () => resolve(request.result); request.onerror = request.onblocked = () => reject(Error('Storage unavailable')); });
        if (active()) await bannerRefresh();
      } catch { unavailable = true; note(12); } render();
    })();
    function applyConfirmation(view, record, result) {
      const snapshot = verify(result, record); if (!isCurrent(view)) return;
      const belongs = view.lastRequestId === record.requestId || (view.base?.version === record.base.version && equal(values(), record.values));
      view.pending = null; view.review = null; reviewBox.replaceChildren();
      if (belongs) { view.base = snapshot; assign(snapshot.pool); view.lastRequestId = null; view.conflict = false; try { sessionStorage.removeItem(draftKey(view.id)); } catch { /* Saved confirmation prevents stale replay. */ } note(10, view); }
      else { view.conflict = true; note(14, view); saveDraft(view); }
    }
    async function sync() {
      if (!db || working || !active()) return; const view = current;
      try { await bannerRefresh(); if (!view?.base || view.loading) return; const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view) || working) return;
        if (state.pending) { view.pending = state.pending; note(24, view); }
        else if (confirmations(state).some(item => view.pending?.requestId === item.record.requestId || view.lastRequestId === item.record.requestId)) { const item = confirmations(state).find(item => view.pending?.requestId === item.record.requestId || view.lastRequestId === item.record.requestId); applyConfirmation(view, item.record, item.result); }
        else if (view.pending) { view.pending = null; view.conflict = true; note(14, view); } render();
      } catch { if (isCurrent(view)) { view.unavailable = true; note(16, view); } }
    }
    async function open(id) {
      id = Number(id); if (!validId(id) || (current && !close())) return;
      const view = { id, base: null, loading: true, message: 8, lastRequestId: null }; current = view;
      fields.type.replaceChildren(new Option(copy(37), 'POOL'), new Option(copy(38), 'JACUZZI'), new Option(copy(36), 'CHILDREN_POOL')); assign(null); reviewBox.replaceChildren(); render();
      await ready; if (!active() || !isCurrent(view)) return;
      try {
        if (!db || unavailable) throw Error('No local storage'); const state = await checkState(await read(id), id); if (!active() || !isCurrent(view)) return;
        let draft = null;
        try { const raw = sessionStorage.getItem(draftKey(id)); if (raw) { draft = JSON.parse(raw); if (!validDraft(draft, id)) throw Error('Invalid draft'); } } catch { view.unavailable = true; note(16, view); return; }
        if (draft && confirmations(state).some(item => draft.requestId === item.record.requestId || (draft.base.version === item.record.base.version && equal(draft.values, item.record.values)))) { draft = null; try { sessionStorage.removeItem(draftKey(id)); } catch { /* Confirmation retained. */ } }
        if (draft) { view.base = draft.base; view.lastRequestId = draft.requestId; assign(draft.values); }
        if (state.pending) { view.pending = state.pending; if (!draft) { view.base = state.pending.base; view.lastRequestId = state.pending.requestId; assign(state.pending.values); } note(24, view); }
        else { const fresh = await latest(id); if (!isCurrent(view)) return;
          if (!draft) { view.base = fresh.base; assign(fresh.base.pool); view.message = undefined; }
          else { assign(draft.values); if (fresh.base.version !== view.base.version) { view.conflict = true; note(14, view); } else view.message = undefined; }
        }
      } catch { if (isCurrent(view)) { view.unavailable = true; note(unavailable ? 12 : 17, view); } }
      finally { if (isCurrent(view)) { view.loading = false; render(); } }
    }
    function close() {
      const view = current; if (view?.base && !invalidated && !view.unavailable && !(view.discarded && equal(values(), view.base.pool)) && !saveDraft(view)) return false;
      current = null; assign(null); reviewBox.replaceChildren(); return true;
    }
    async function transport(record, view) {
      if (!active() || !await validRecord(record, record.poolId)) throw Error('Invalid request'); if (!active()) return 'unknown'; if (isCurrent(view)) note(9, view);
      controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`/api/core/pools/${record.poolId}/technical-sheet`, { method: 'PUT', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...record.submission.changes, requestId: record.requestId, expectedVersion: record.base.version }), signal: controller.signal });
        const result = await response.json(); if (!active()) return 'unknown';
        if (response.status === 409 && result.ok === false && result.code === 'TECHNICAL_SHEET_VERSION_CONFLICT') { if (isCurrent(view)) { view.conflict = true; note(14, view); } return 'conflict'; }
        if (response.status !== 200) throw Error('Unconfirmed response'); verify(result, record);
        const state = await checkState(await read(record.poolId), record.poolId); if (!active()) return 'unknown'; if (state.pending?.requestId !== record.requestId || state.pending.payloadHash !== record.payloadHash) throw Error('Pending request changed');
        const saved = { ok: true, pool: pick(result.pool), version: result.version, receipt: result.receipt, historyId: result.historyId, noteHistoryId: result.noteHistoryId, propagation: result.propagation, replayed: result.replayed === true };
        // Keep older verified acknowledgements: a closed tab may still hold that request's note.
        await write(record.poolId, { pending: null, confirmed: { record, result: saved }, settled: confirmations(state).filter(item => item.record.requestId !== record.requestId) }); if (!active()) return 'unknown';
        if (isCurrent(view)) applyConfirmation(view, record, result); channel?.postMessage('changed'); await bannerRefresh();
        try { if (active()) await options.confirmed?.(result); } catch { /* List failure does not revoke confirmation. */ } return 'confirmed';
      } catch { if (active() && isCurrent(view)) note(11, view); return 'unknown'; } finally { clearTimeout(timer); controller = null; }
    }
    async function withLock(view, operation) {
      if (!navigator.locks?.request || !crypto.randomUUID) { note(12, view); return; }
      await navigator.locks.request(`cw-technical-sheet-edit:${key(view.id)}`, { ifAvailable: true }, async lock => { if (!lock) { if (isCurrent(view)) note(15, view); return; } if (active()) await operation(); });
    }
    async function execute(repeat = false) {
      const view = current; if (!view?.base || working || unavailable || view.unavailable || view.loading || view.review || view.conflict) return; working = true; render();
      try { await ready; if (!active()) return; await withLock(view, async () => {
        const state = await checkState(await read(view.id), view.id); if (!active() || !isCurrent(view)) return;
        if (state.pending) { view.pending = state.pending; if (repeat) await transport(state.pending, view); else note(24, view); return; }
        const prior = confirmations(state).find(item => view.lastRequestId === item.record.requestId || (view.base.version === item.record.base.version && equal(values(), item.record.values)));
        if (prior) { applyConfirmation(view, prior.record, prior.result); return; }
        if (repeat) { view.pending = null; view.conflict = true; note(14, view); return; }
        const data = values(), patch = changes(view.base.pool, data);
        if (!validValues(data) || !validInput(data, view.base.pool) || (Object.hasOwn(patch, 'type') && !['POOL', 'JACUZZI', 'CHILDREN_POOL'].includes(patch.type))) { note(20, view); return; }
        if (!Object.keys(patch).length) { note(19, view); return; }
        const submission = { v: 1, poolId: view.id, expectedVersion: view.base.version, changes: patch };
        const record = { schema: 1, owner, poolId: view.id, requestId: crypto.randomUUID(), base: view.base, values: data, submission, payloadHash: await hash(submission) };
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
        const section = document.createElement('section'); section.className = 'sheet-edit-choice'; const title = document.createElement('strong'); title.textContent = labels[language()][keys.indexOf(field)]; section.append(title);
        const select = document.createElement('select'); select.dataset.sheetEditField = field; select.setAttribute('aria-label', title.textContent); select.add(new Option(copy(28), ''));
        for (const candidate of candidates) { candidate.allowed = true;
          const line = document.createElement('p'); line.textContent = `${copy(candidate.source === 'current' ? 25 : candidate.source === 'draft' ? 26 : 27)}: ${display(field, candidate.value)}${candidate.allowed ? '' : ' — ' + copy(36)}`; section.append(line);
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
        const data = Object.fromEntries(keys.map(key => [key, String(next[key] ?? '')]));
        sessionStorage.setItem(draftKey(view.id), JSON.stringify({ schema: 1, owner, poolId: view.id, base: revision.snapshot.base, values: data, requestId: null }));
        if (state.pending) await write(view.id, { ...state, pending: null }); if (!active() || !isCurrent(view)) return;
        view.base = revision.snapshot.base; view.pending = null; view.lastRequestId = null; view.conflict = false; view.review = null; assign(data); reviewBox.replaceChildren(); note(22, view); channel?.postMessage('changed'); await bannerRefresh();
      }); } catch { if (active() && isCurrent(view)) note(18, view); } finally { working = false; render(); }
    }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cw-technical-sheet-edits') : null;
    if (channel) channel.onmessage = () => void sync();
    form.onsubmit = event => { event.preventDefault(); void execute(); }; retry.onclick = () => void execute(true); review.onclick = () => void prepareReview(); apply.onclick = () => void applyReview();
    reload.onclick = () => current && void open(current.id);
    discard.onclick = () => { if (!current?.base || current.pending || working || !active()) return; try { sessionStorage.removeItem(draftKey(current.id)); assign(current.base.pool); current.lastRequestId = null; current.discarded = true; note(19); } catch { note(18); } };
    Object.values(fields).forEach(field => { field.addEventListener('input', () => { saveDraft(); updateVolume(); }); field.addEventListener('change', () => { saveDraft(); updateVolume(); }); });
    window.addEventListener('storage', active); window.addEventListener('focus', () => void sync());
    window.addEventListener('cw-language-change', () => { if (!active()) return; if (current?.review) { const old = current.review, selected = new Map(old.rows.map(row => [row.field, row.select.value])); buildReview(current, old.snapshot, current.pending); for (const row of current.review.rows) if (selected.has(row.field)) row.select.value = selected.get(row.field); } render(); void bannerRefresh().catch(() => {}); });
    setInterval(active, 500); render(); return { ready, open, close, save: () => execute(), sync };
  }
  window.CWTechnicalSheetEdit = { create };
})();
