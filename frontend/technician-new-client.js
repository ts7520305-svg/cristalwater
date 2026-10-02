(function () {
  'use strict';
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
    documentTitle: ['Cristal Water · Novo Cliente em Campo', 'Cristal Water · New Client in the Field', 'Cristal Water · Nouveau client sur le terrain', 'Cristal Water · Nuevo cliente en campo', 'Cristal Water · Neuer Kunde vor Ort'],
    pageTitle: ['➕ Novo cliente/piscina em campo', '➕ New client/pool in the field', '➕ Nouveau client / piscine sur le terrain', '➕ Nuevo cliente/piscina en campo', '➕ Neuer Kunde/Pool vor Ort'],
    pageIntro: ['Ficha provisória criada pelo técnico. Conserve a ficha e confirme o registo antes de preparar a ronda.', 'Provisional form created by the technician. Keep the form and confirm the record before preparing the route.', 'Fiche provisoire créée par le technicien. Conservez la fiche et confirmez l’enregistrement avant de préparer la tournée.', 'Ficha provisional creada por el técnico. Conserve la ficha y confirme el registro antes de preparar la ruta.', 'Vorläufiges Formular des Technikers. Bewahren Sie es auf und bestätigen Sie den Datensatz, bevor die Route vorbereitet wird.'],
    backToRoute: ['Voltar à ronda', 'Back to route', 'Retour à la tournée', 'Volver a la ruta', 'Zur Route zurück'],
    checkingPermissions: ['A verificar permissões...', 'Checking permissions...', 'Vérification des autorisations...', 'Comprobando permisos...', 'Berechtigungen werden geprüft...'],
    refreshPermission: ['Atualizar permissão', 'Refresh permission', 'Actualiser l’autorisation', 'Actualizar permiso', 'Berechtigung aktualisieren'],
    customerSection: ['Dados mínimos do cliente', 'Minimum client details', 'Données minimales du client', 'Datos mínimos del cliente', 'Mindestangaben zum Kunden'],
    clientName: ['Nome do cliente *', 'Client name *', 'Nom du client *', 'Nombre del cliente *', 'Kundenname *'],
    clientNamePlaceholder: ['Ex: Villa Silva', 'E.g. Villa Silva', 'Ex. : Villa Silva', 'Ej.: Villa Silva', 'z. B. Villa Silva'],
    phone: ['Telefone', 'Phone', 'Téléphone', 'Teléfono', 'Telefon'],
    email: ['Email', 'Email', 'E-mail', 'Correo electrónico', 'E-Mail'],
    emailPlaceholder: ['cliente@email.com', 'client@email.com', 'client@email.com', 'cliente@email.com', 'kunde@email.com'],
    zone: ['Zona', 'Zone', 'Zone', 'Zona', 'Zone'],
    zonePlaceholder: ['Lagos, Aljezur, Portimão...', 'Lagos, Aljezur, Portimão...', 'Lagos, Aljezur, Portimão...', 'Lagos, Aljezur, Portimão...', 'Lagos, Aljezur, Portimão...'],
    address: ['Morada', 'Address', 'Adresse', 'Dirección', 'Adresse'],
    addressPlaceholder: ['Morada ou ponto de referência', 'Address or landmark', 'Adresse ou point de repère', 'Dirección o punto de referencia', 'Adresse oder Orientierungspunkt'],
    poolSection: ['Piscina', 'Pool', 'Piscine', 'Piscina', 'Pool'],
    poolName: ['Nome da piscina', 'Pool name', 'Nom de la piscine', 'Nombre de la piscina', 'Poolname'],
    poolNamePlaceholder: ['Piscina principal', 'Main pool', 'Piscine principale', 'Piscina principal', 'Hauptpool'],
    poolType: ['Tipo', 'Type', 'Type', 'Tipo', 'Typ'],
    poolTypeSelect: ['Selecionar', 'Select', 'Sélectionner', 'Seleccionar', 'Auswählen'],
    poolTypePrivate: ['Privada', 'Private', 'Privée', 'Privada', 'Privat'],
    poolTypeCondo: ['Condomínio', 'Condominium', 'Copropriété', 'Comunidad', 'Wohnanlage'],
    poolTypeHotel: ['Hotel', 'Hotel', 'Hôtel', 'Hotel', 'Hotel'],
    poolTypeJacuzzi: ['Jacuzzi', 'Jacuzzi', 'Jacuzzi', 'Jacuzzi', 'Jacuzzi'],
    volume: ['Volume m³', 'Volume m³', 'Volume m³', 'Volumen m³', 'Volumen m³'],
    volumePlaceholder: ['ex: 75', 'e.g. 75', 'ex. : 75', 'ej.: 75', 'z. B. 75'],
    gpsLabel: ['GPS', 'GPS', 'GPS', 'GPS', 'GPS'],
    gpsButton: ['📍 Usar localização atual', '📍 Use current location', '📍 Utiliser la position actuelle', '📍 Usar ubicación actual', '📍 Aktuellen Standort verwenden'],
    latitude: ['Latitude', 'Latitude', 'Latitude', 'Latitud', 'Breitengrad'],
    longitude: ['Longitude', 'Longitude', 'Longitude', 'Longitud', 'Längengrad'],
    gpsEmpty: ['Sem localização indicada.', 'No location entered.', 'Aucune position indiquée.', 'Sin ubicación indicada.', 'Kein Standort angegeben.'],
    gpsCoordinates: ['Coordenadas: {lat}, {lng}', 'Coordinates: {lat}, {lng}', 'Coordonnées : {lat}, {lng}', 'Coordenadas: {lat}, {lng}', 'Koordinaten: {lat}, {lng}'],
    notes: ['Notas rápidas', 'Quick notes', 'Notes rapides', 'Notas rápidas', 'Kurze Notizen'],
    notesPlaceholder: ['Acesso, estado da piscina, problemas, fotos a tirar, pedido do cliente...', 'Access, pool condition, issues, photos to take, client request...', 'Accès, état de la piscine, problèmes, photos à prendre, demande du client...', 'Acceso, estado de la piscina, problemas, fotos por tomar, pedido del cliente...', 'Zugang, Poolzustand, Probleme, aufzunehmende Fotos, Kundenwunsch...'],
    submit: ['Guardar ficha provisória', 'Save provisional form', 'Enregistrer la fiche provisoire', 'Guardar ficha provisional', 'Vorläufiges Formular speichern'],
    policyDefault: ['O estado da ficha depende da configuração verificada pelo servidor. A gravação não agenda visitas.', 'The form status depends on the configuration checked by the server. Saving does not schedule visits.', 'L’état de la fiche dépend de la configuration vérifiée par le serveur. L’enregistrement ne planifie pas de visites.', 'El estado de la ficha depende de la configuración verificada por el servidor. Guardar no agenda visitas.', 'Der Formularstatus hängt von der vom Server geprüften Konfiguration ab. Speichern plant keine Besuche.'],
    retryConfirm: ['Confirmar ficha guardada', 'Confirm saved form', 'Confirmer la fiche enregistrée', 'Confirmar ficha guardada', 'Gespeichertes Formular bestätigen'],
    retryClear: ['Limpar ficha confirmada', 'Clear confirmed form', 'Effacer la fiche confirmée', 'Limpiar ficha confirmada', 'Bestätigtes Formular leeren'],
    sessionChangedRecover: ['A sessão mudou. Reabra com a conta original para recuperar a ficha.', 'The session changed. Reopen with the original account to recover the form.', 'La session a changé. Rouvrez avec le compte d’origine pour récupérer la fiche.', 'La sesión cambió. Vuelva a abrir con la cuenta original para recuperar la ficha.', 'Die Sitzung wurde geändert. Öffnen Sie mit dem ursprünglichen Konto erneut, um das Formular wiederherzustellen.'],
    sessionChanged: ['A sessão mudou. Reabra com a conta original.', 'The session changed. Reopen with the original account.', 'La session a changé. Rouvrez avec le compte d’origine.', 'La sesión cambió. Vuelva a abrir con la cuenta original.', 'Die Sitzung wurde geändert. Öffnen Sie mit dem ursprünglichen Konto erneut.'],
    draftUnreadable: ['Rascunho ilegível. Preserve os dados e peça apoio ao escritório.', 'Unreadable draft. Keep the data and ask the office for support.', 'Brouillon illisible. Conservez les données et demandez de l’aide au bureau.', 'Borrador ilegible. Conserve los datos y pida ayuda a la oficina.', 'Unlesbarer Entwurf. Bewahren Sie die Daten auf und bitten Sie das Büro um Hilfe.'],
    draftInvalid: ['Rascunho inválido. Preserve os dados e peça apoio ao escritório.', 'Invalid draft. Keep the data and ask the office for support.', 'Brouillon invalide. Conservez les données et demandez de l’aide au bureau.', 'Borrador no válido. Conserve los datos y pida ayuda a la oficina.', 'Ungültiger Entwurf. Bewahren Sie die Daten auf und bitten Sie das Büro um Hilfe.'],
    localSaveUnconfirmed: ['A gravação local não ficou confirmada.', 'Local saving was not confirmed.', 'L’enregistrement local n’a pas été confirmé.', 'El guardado local no quedó confirmado.', 'Das lokale Speichern wurde nicht bestätigt.'],
    changedOtherWindow: ['A ficha mudou noutra janela. Copie os dados desta janela e reabra para rever.', 'The form changed in another window. Copy the data from this window and reopen to review.', 'La fiche a changé dans une autre fenêtre. Copiez les données de cette fenêtre et rouvrez pour vérifier.', 'La ficha cambió en otra ventana. Copie los datos de esta ventana y vuelva a abrir para revisar.', 'Das Formular wurde in einem anderen Fenster geändert. Kopieren Sie die Daten aus diesem Fenster und öffnen Sie es zur Prüfung erneut.'],
    missingSubmission: ['O envio do rascunho não foi encontrado. Preserve os dados.', 'The draft submission was not found. Keep the data.', 'L’envoi du brouillon est introuvable. Conservez les données.', 'No se encontró el envío del borrador. Conserve los datos.', 'Die Entwurfssendung wurde nicht gefunden. Bewahren Sie die Daten auf.'],
    draftDiffers: ['O rascunho difere do envio guardado. Ambos foram preservados; peça revisão.', 'The draft differs from the saved submission. Both were preserved; ask for review.', 'Le brouillon diffère de l’envoi enregistré. Les deux ont été conservés ; demandez une vérification.', 'El borrador difiere del envío guardado. Ambos se conservaron; pida revisión.', 'Der Entwurf weicht von der gespeicherten Sendung ab. Beide wurden bewahrt; bitten Sie um Prüfung.'],
    pendingUseConfirm: ['Ficha guardada neste dispositivo, por confirmar. Use Confirmar ficha guardada.', 'Form saved on this device, awaiting confirmation. Use Confirm saved form.', 'Fiche enregistrée sur cet appareil, à confirmer. Utilisez Confirmer la fiche enregistrée.', 'Ficha guardada en este dispositivo, pendiente de confirmación. Use Confirmar ficha guardada.', 'Formular auf diesem Gerät gespeichert, Bestätigung ausstehend. Verwenden Sie Gespeichertes Formular bestätigen.'],
    pendingFailure: ['Ficha guardada neste dispositivo, por confirmar. {failure}', 'Form saved on this device, awaiting confirmation. {failure}', 'Fiche enregistrée sur cet appareil, à confirmer. {failure}', 'Ficha guardada en este dispositivo, pendiente de confirmación. {failure}', 'Formular auf diesem Gerät gespeichert, Bestätigung ausstehend. {failure}'],
    unsavedPreserve: ['A ficha não ficou guardada. Conserve o texto.', 'The form was not saved. Keep the text.', 'La fiche n’a pas été enregistrée. Conservez le texte.', 'La ficha no se guardó. Conserve el texto.', 'Das Formular wurde nicht gespeichert. Bewahren Sie den Text auf.'],
    confirmedReview: ['Cliente #{clientId} e piscina #{poolId} registados. Aguardam revisão do escritório.', 'Client #{clientId} and pool #{poolId} registered. Awaiting office review.', 'Client #{clientId} et piscine #{poolId} enregistrés. En attente de vérification par le bureau.', 'Cliente #{clientId} y piscina #{poolId} registrados. Pendientes de revisión de la oficina.', 'Kunde #{clientId} und Pool #{poolId} registriert. Prüfung durch das Büro ausstehend.'],
    confirmedActive: ['Cliente #{clientId} e piscina #{poolId} registados. Cadastro ativo conforme a configuração. A ficha técnica e a ronda requerem preparação.', 'Client #{clientId} and pool #{poolId} registered. Registration is active according to configuration. The technical sheet and route still need preparation.', 'Client #{clientId} et piscine #{poolId} enregistrés. L’inscription est active selon la configuration. La fiche technique et la tournée restent à préparer.', 'Cliente #{clientId} y piscina #{poolId} registrados. El cadastro está activo según la configuración. La ficha técnica y la ruta requieren preparación.', 'Kunde #{clientId} und Pool #{poolId} registriert. Die Anlage ist gemäß Konfiguration aktiv. Technisches Datenblatt und Route müssen vorbereitet werden.'],
    accountDraft: ['Rascunho desta conta; ainda não enviado.', 'Draft for this account; not sent yet.', 'Brouillon de ce compte ; pas encore envoyé.', 'Borrador de esta cuenta; aún no enviado.', 'Entwurf dieses Kontos; noch nicht gesendet.'],
    saveDraftFailed: ['A ficha não ficou guardada. {error}', 'The form was not saved. {error}', 'La fiche n’a pas été enregistrée. {error}', 'La ficha no se guardó. {error}', 'Das Formular wurde nicht gespeichert. {error}'],
    draftSaved: ['Rascunho guardado neste dispositivo; ainda não enviado.', 'Draft saved on this device; not sent yet.', 'Brouillon enregistré sur cet appareil ; pas encore envoyé.', 'Borrador guardado en este dispositivo; aún no enviado.', 'Entwurf auf diesem Gerät gespeichert; noch nicht gesendet.'],
    locksUnavailable: ['Este navegador não permite coordenar os envios. Preserve a ficha.', 'This browser cannot coordinate submissions. Keep the form.', 'Ce navigateur ne permet pas de coordonner les envois. Conservez la fiche.', 'Este navegador no permite coordinar los envíos. Conserve la ficha.', 'Dieser Browser kann Sendungen nicht koordinieren. Bewahren Sie das Formular auf.'],
    lockBusy: ['Outra janela está a tratar desta ficha.', 'Another window is handling this form.', 'Une autre fenêtre traite cette fiche.', 'Otra ventana está gestionando esta ficha.', 'Ein anderes Fenster bearbeitet dieses Formular.'],
    notSent: ['A ficha não foi enviada.', 'The form was not sent.', 'La fiche n’a pas été envoyée.', 'La ficha no se envió.', 'Das Formular wurde nicht gesendet.'],
    alreadyConfirmedPreserved: ['Ficha já confirmada; rascunho preservado.', 'Form already confirmed; draft preserved.', 'Fiche déjà confirmée ; brouillon conservé.', 'Ficha ya confirmada; borrador conservado.', 'Formular bereits bestätigt; Entwurf bewahrt.'],
    savedPending: ['Ficha guardada, por confirmar.', 'Form saved, awaiting confirmation.', 'Fiche enregistrée, à confirmer.', 'Ficha guardada, pendiente de confirmación.', 'Formular gespeichert, Bestätigung ausstehend.'],
    sendError: ['{prefix} {error}', '{prefix} {error}', '{prefix} {error}', '{prefix} {error}', '{prefix} {error}'],
    permissionUnconfirmed: ['Permissão por confirmar.', 'Permission not confirmed yet.', 'Autorisation pas encore confirmée.', 'Permiso pendiente de confirmación.', 'Berechtigung noch nicht bestätigt.'],
    registrationDisabled: ['Cadastro desativado. Pode conservar o rascunho e confirmar um envio anterior.', 'Registration disabled. You can keep the draft and confirm a previous submission.', 'Inscription désactivée. Vous pouvez conserver le brouillon et confirmer un envoi précédent.', 'Registro desactivado. Puede conservar el borrador y confirmar un envío anterior.', 'Registrierung deaktiviert. Sie können den Entwurf behalten und eine frühere Sendung bestätigen.'],
    allowedReview: ['Cadastro permitido; as fichas requerem revisão do escritório.', 'Registration allowed; forms require office review.', 'Inscription autorisée ; les fiches nécessitent une vérification du bureau.', 'Registro permitido; las fichas requieren revisión de la oficina.', 'Registrierung erlaubt; Formulare erfordern Prüfung durch das Büro.'],
    allowedDirect: ['Cadastro permitido sem revisão obrigatória; a ficha técnica e a ronda serão preparadas pelo escritório.', 'Registration allowed without mandatory review; the office will prepare the technical sheet and route.', 'Inscription autorisée sans vérification obligatoire ; le bureau préparera la fiche technique et la tournée.', 'Registro permitido sin revisión obligatoria; la oficina preparará la ficha técnica y la ruta.', 'Registrierung ohne Pflichtprüfung erlaubt; das Büro bereitet technisches Datenblatt und Route vor.'],
    policyReview: ['A ficha fica pendente de revisão. A gravação não confirma visita agendada.', 'The form stays pending review. Saving does not confirm a scheduled visit.', 'La fiche reste en attente de vérification. L’enregistrement ne confirme pas de visite planifiée.', 'La ficha queda pendiente de revisión. Guardar no confirma una visita agendada.', 'Das Formular bleibt zur Prüfung offen. Speichern bestätigt keinen geplanten Besuch.'],
    policyDirect: ['O cadastro fica ativo conforme a configuração; não agenda visitas nem ativa faturação.', 'The registration becomes active according to configuration; it does not schedule visits or activate billing.', 'L’inscription devient active selon la configuration ; elle ne planifie pas de visites et n’active pas la facturation.', 'El registro queda activo según la configuración; no agenda visitas ni activa facturación.', 'Die Registrierung wird gemäß Konfiguration aktiv; sie plant keine Besuche und aktiviert keine Abrechnung.'],
    permissionUnavailable: ['Não foi possível confirmar a permissão. Pode conservar o rascunho; o servidor verifica a permissão ao enviar.', 'Permission could not be confirmed. You can keep the draft; the server checks permission when sending.', 'Impossible de confirmer l’autorisation. Vous pouvez conserver le brouillon ; le serveur vérifie l’autorisation à l’envoi.', 'No se pudo confirmar el permiso. Puede conservar el borrador; el servidor verifica el permiso al enviar.', 'Berechtigung konnte nicht bestätigt werden. Sie können den Entwurf behalten; der Server prüft die Berechtigung beim Senden.'],
    gpsUnavailable: ['Localização indisponível; pode indicar as coordenadas.', 'Location unavailable; you can enter the coordinates.', 'Position indisponible ; vous pouvez indiquer les coordonnées.', 'Ubicación no disponible; puede indicar las coordenadas.', 'Standort nicht verfügbar; Sie können die Koordinaten eingeben.'],
    gpsFailed: ['Não foi possível obter a localização. As coordenadas anteriores foram conservadas.', 'Could not get the location. Previous coordinates were kept.', 'Impossible d’obtenir la position. Les coordonnées précédentes ont été conservées.', 'No se pudo obtener la ubicación. Se conservaron las coordenadas anteriores.', 'Standort konnte nicht ermittelt werden. Frühere Koordinaten wurden beibehalten.']
  };
  const store = window.CWFieldWriteStore, captured = store?.session(), form = document.getElementById('form'), status = document.getElementById('result'), permission = document.getElementById('permissionBox'), save = form.querySelector('[type=submit]'), retry = document.getElementById('intakeRetry'), gps = document.getElementById('gpsBtn');
  const scope = 'FIELD_CLIENT_INTAKE', key = 'cwFieldIntakeDraft:' + captured?.owner, fields = ['clientName', 'phone', 'email', 'address', 'zone', 'poolName', 'poolType', 'volumeM3', 'latitude', 'longitude', 'notes'], limits = { clientName: 200, phone: 60, email: 254, address: 1000, zone: 120, poolName: 200, poolType: 80, volumeM3: 40, latitude: 40, longitude: 40, notes: 5000 };
  const blank = () => ({ v: 1, owner: captured?.owner, ...Object.fromEntries(fields.map(k => [k, ''])), requestId: null });
  let draft = blank(), observed, state = null, ready = false, busy = false, conflict = false, closed = false, unsaved = false, revision = 0, policy = null, gpsRevision = 0, statusState = null, permissionState = null, policyState = 'policyDefault', lastLanguage = '';
  const normalizeLanguage = value => window.CristalI18n?.normalizeLanguage?.(value) || (languages.includes(String(value || '').toLowerCase().slice(0, 2)) ? String(value).toLowerCase().slice(0, 2) : 'pt');
  const currentLanguage = () => normalizeLanguage(window.CristalI18n?.readLanguage?.() || document.documentElement.lang || 'pt');
  const index = () => Math.max(0, languages.indexOf(currentLanguage()));
  const t = (key, params = {}) => (copy[key]?.[index()] || copy[key]?.[0] || key).replace(/\{(\w+)\}/g, (_, name) => {
    const value = params[name];
    return value && typeof value === 'object' ? formatCopy(value) : value ?? '';
  });
  const formatCopy = value => value.key === 'fieldWriteError' ? store.message(value.params.code, currentLanguage()) : value.literal ?? t(value.key, value.params);
  const errorCopy = error => error?.intakeCopy || (error?.copy?.key === 'fieldWriteError' ? error.copy : { literal: error.message || String(error) });
  const active = () => !closed && store?.same(captured);
  function problem(key, params = {}) { const error = Error(t(key, params)); error.intakeCopy = { key, params }; return error; }
  const requireActive = () => { if (!active()) throw problem('sessionChangedRecover'); };
  const values = value => Object.fromEntries(fields.map(k => [k, value[k]])), same = (a, b) => fields.every(k => a[k] === b[k]);
  function setStatus(key, params = {}) { statusState = { key, params }; paintStatus(); }
  function setError(error) { statusState = errorCopy(error); paintStatus(); }
  function setPermission(key, params = {}) { permissionState = { key, params }; paintPermission(); }
  function setPolicy(key) { policyState = key; paintPolicy(); }
  function paintStaticCopy() {
    document.title = t('documentTitle');
    for (const node of document.querySelectorAll('[data-intake-copy]')) node.textContent = t(node.dataset.intakeCopy);
    for (const node of document.querySelectorAll('[data-intake-placeholder]')) node.setAttribute('placeholder', t(node.dataset.intakePlaceholder));
    for (const node of document.querySelectorAll('[data-intake-option]')) node.textContent = t(node.dataset.intakeOption);
  }
  function paintStatus() { if (!statusState) return; status.textContent = formatCopy(statusState); }
  function paintPermission() { if (permissionState) permission.textContent = t(permissionState.key, permissionState.params); }
  function paintPolicy() { const node = document.getElementById('intakePolicy'); if (node) node.textContent = t(policyState); }
  function repaintAll() { paintStaticCopy(); paintStatus(); paintPermission(); paintPolicy(); paintGps(); render(); lastLanguage = currentLanguage(); }
  function show(value) { for (const k of fields) form.elements[k].value = value[k]; paintGps(); }
  function paintGps() { const lat = form.elements.latitude.value, lng = form.elements.longitude.value; document.getElementById('gpsState').textContent = lat && lng ? t('gpsCoordinates', { lat, lng }) : t('gpsEmpty'); }
  function render() {
    const locked = busy || conflict || !ready || !active();
    for (const k of fields) {
      const node = form.elements[k];
      if (node.tagName === 'SELECT') node.disabled = locked || !!state;
      else node.readOnly = locked || !!state;
    }
    save.disabled = locked || !!state || policy?.techniciansCanCreateClientsPools === false;
    save.hidden = !!state; gps.disabled = locked || !!state; retry.hidden = !state; retry.disabled = locked; retry.textContent = state?.response ? t('retryClear') : t('retryConfirm'); form.classList.remove('hidden'); status.classList.remove('hidden');
  }
  function read() {
    requireActive();
    const raw = localStorage.getItem(key); let value;
    try { value = raw ? JSON.parse(raw) : blank(); } catch (_) { throw problem('draftUnreadable'); }
    if (!value || Object.keys(value).length !== 14 || Object.keys(value).some(k => !Object.hasOwn(blank(), k)) || value.v !== 1 || value.owner !== captured.owner || fields.some(k => typeof value[k] !== 'string' || value[k].length > limits[k]) || !['', 'Privada', 'Condomínio', 'Hotel', 'Jacuzzi'].includes(value.poolType) || value.requestId !== null && !/^[0-9a-f-]{36}$/i.test(value.requestId)) throw problem('draftInvalid');
    if (observed === undefined) observed = raw;
    return value;
  }
  function write(value) {
    requireActive(); read();
    if (localStorage.getItem(key) !== observed) { conflict = true; throw problem('changedOtherWindow'); }
    const raw = JSON.stringify(value); localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw problem('localSaveUnconfirmed');
    observed = raw; draft = value; unsaved = false;
  }
  async function refresh() {
    if (!active()) { ++revision; ++gpsRevision; show(blank()); draft = blank(); state = null; ready = false; setStatus('sessionChanged'); render(); return; }
    if (busy) return;
    const generation = ++revision;
    try {
      const saved = read(), rows = await store.records(scope, captured, true);
      if (!active() || revision !== generation || busy) return;
      if (conflict) { render(); return; }
      if (!unsaved) draft = saved;
      state = rows.find(r => !r.response) || (draft.requestId ? rows.find(r => r.requestId === draft.requestId) : null);
      if (draft.requestId && !state) throw problem('missingSubmission');
      if (state && fields.some(k => draft[k] !== '') && !same(draft, state.payload)) throw problem('draftDiffers');
      if (state) { draft = { ...blank(), ...state.payload, requestId: state.requestId }; show(draft); }
      else if (!unsaved) show(draft);
      ready = true;
      const confirmed = state?.response || rows.filter(r => r.response).at(-1)?.response;
      if (state && !state.response) setStatus(state.failure?.message ? 'pendingFailure' : 'pendingUseConfirm', { failure: state.failure?.message || '' });
      else if (unsaved) setStatus('unsavedPreserve');
      else if (confirmed) setStatus(confirmed.pendingReview ? 'confirmedReview' : 'confirmedActive', { clientId: confirmed.intake.clientId, poolId: confirmed.intake.poolId });
      else setStatus('accountDraft');
      render();
    } catch (e) { if (active() && generation === revision) { conflict = true; setError(e); render(); } }
  }
  function saveDraft() {
    if (busy || state || conflict || !ready) return;
    ++revision; ++gpsRevision; draft = { ...draft, ...Object.fromEntries(fields.map(k => [k, form.elements[k].value])) }; unsaved = true;
    try { write(draft); setStatus('draftSaved'); } catch (e) { setStatus('saveDraftFailed', { error: errorCopy(e) }); }
    paintGps(); render();
  }
  function clearConfirmed() { write(blank()); state = null; show(draft); }
  async function send() {
    if (busy || conflict || !ready) return;
    busy = true; render(); let error = null;
    try {
      requireActive();
      if (!navigator.locks?.request) throw problem('locksUnavailable');
      await navigator.locks.request('cw-field-intake-draft:' + captured.owner, { ifAvailable: true }, async lock => {
        if (!lock) throw problem('lockBusy');
        requireActive();
        if (state?.response) { clearConfirmed(); return; }
        const value = state ? { ...draft, ...state.payload, requestId: state.requestId } : { ...draft, ...Object.fromEntries(fields.map(k => [k, form.elements[k].value])) };
        write(value); state = await store.prepare(scope, captured.technicianId, values(value), { label: value.clientName }, captured); write({ ...value, requestId: state.requestId }); await store.send(state.requestId, captured); state = await store.get(state.requestId, captured); clearConfirmed();
      });
    } catch (e) { error = errorCopy(e); }
    finally {
      busy = false;
      if (!error || state || !active()) await refresh(); else render();
      if (error && active()) setStatus('sendError', { prefix: { key: state?.response ? 'alreadyConfirmedPreserved' : state ? 'savedPending' : 'notSent' }, error });
    }
  }
  async function permissions() {
    try {
      requireActive();
      const response = await fetch('/api/technician-intake/settings', { headers: { Authorization: 'Bearer ' + captured.token }, cache: 'no-store', signal: AbortSignal.timeout(8000) }), data = await response.json();
      requireActive();
      if (!response.ok || data.ok !== true || ['techniciansCanCreateClientsPools', 'requireAdminReview', 'poolsActiveByDefault'].some(k => typeof data[k] !== 'boolean')) throw problem('permissionUnconfirmed');
      policy = data;
      setPermission(!data.techniciansCanCreateClientsPools ? 'registrationDisabled' : data.requireAdminReview ? 'allowedReview' : 'allowedDirect');
      setPolicy(data.requireAdminReview ? 'policyReview' : 'policyDirect');
    } catch (e) { if (active()) setPermission('permissionUnavailable'); }
    render();
  }
  for (const k of fields) { const node = form.elements[k]; if (node.tagName !== 'SELECT') node.maxLength = limits[k]; node.addEventListener(node.tagName === 'SELECT' ? 'change' : 'input', saveDraft); }
  form.addEventListener('submit', event => { event.preventDefault(); void send(); }); retry.addEventListener('click', send); document.getElementById('intakeCheckPermission').addEventListener('click', permissions);
  gps.addEventListener('click', () => {
    if (!active() || state || busy || conflict || !ready) return;
    const generation = ++gpsRevision;
    if (!navigator.geolocation) { setStatus('gpsUnavailable'); return; }
    navigator.geolocation.getCurrentPosition(position => { if (!active() || state || busy || generation !== gpsRevision) return; form.elements.latitude.value = String(position.coords.latitude); form.elements.longitude.value = String(position.coords.longitude); saveDraft(); }, () => { if (active() && generation === gpsRevision) setStatus('gpsFailed'); }, { timeout: 10000, maximumAge: 0 });
  });
  window.addEventListener('storage', event => { if (event.key === key && event.newValue !== observed && !busy) { conflict = true; setStatus('changedOtherWindow'); render(); } if (!active()) refresh(); }); window.addEventListener('cw:session-change', refresh); window.addEventListener('cw:field-write-change', refresh); window.addEventListener('pagehide', () => { closed = true; ++revision; ++gpsRevision; }); window.addEventListener('pageshow', () => { closed = false; refresh(); permissions(); }); window.addEventListener('cw-language-change', repaintAll);
  new MutationObserver(() => { const language = currentLanguage(); if (language !== lastLanguage) repaintAll(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  setInterval(() => { if (!active()) refresh(); }, 1000);
  repaintAll(); render(); refresh(); permissions(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
