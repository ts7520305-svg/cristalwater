(function () {
  const ui = window.CwUi || {
    success: (m) => console.log(m),
    error: (m) => console.error(m),
    info: (m) => console.info(m),
  };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));

  // Capture presentation separately: photo.error, drafts and stored failures remain literal.
  const photoErrors = new WeakMap(), photoErrorBindings = new WeakMap();
  const photoErrorLanguages = ['pt', 'en', 'fr', 'es', 'de'];
  const photoErrorMessages = {
    restore: ['Falha ao recuperar fotografias: {detail}', 'Failed to recover photographs: {detail}', 'Impossible de récupérer les photographies : {detail}', 'No se pudieron recuperar las fotografías: {detail}', 'Fotos konnten nicht wiederhergestellt werden: {detail}'],
    pending: ['Pendente: {detail}', 'Pending: {detail}', 'En attente : {detail}', 'Pendiente: {detail}', 'Ausstehend: {detail}'],
  };
  function photoErrorText(value) {
    const language = String(document.documentElement.lang || 'pt').toLowerCase().split('-')[0];
    const detail = value.copy?.[language] || value.copy?.pt || value.detail;
    return value.wrapper ? photoErrorMessages[value.wrapper][Math.max(0, photoErrorLanguages.indexOf(language))].replace('{detail}', () => detail) : detail;
  }
  function bindPhotoError(node, value) {
    photoErrorBindings.set(node, { ...value, protected: node.hasAttribute('data-cw-no-i18n') });
    node.setAttribute('data-cw-photo-error-copy', ''); node.setAttribute('data-cw-no-i18n', '');
    node.textContent = photoErrorText(value);
  }
  function clearPhotoError(node) {
    const value = photoErrorBindings.get(node);
    if (!value) return;
    if (!value.protected) node.removeAttribute('data-cw-no-i18n');
    node.removeAttribute('data-cw-photo-error-copy'); photoErrorBindings.delete(node);
  }
  function repaintPhotoErrors() {
    for (const node of document.querySelectorAll('[data-cw-photo-error-copy]')) {
      const value = photoErrorBindings.get(node);
      if (value && node.textContent !== photoErrorText(value)) node.textContent = photoErrorText(value);
    }
  }
  function photoErrorToast(error, wrapper) {
    const value = { detail: error.message, copy: window.CWFieldPhotos.errorCopy(error), wrapper };
    toast(photoErrorText(value));
    const node = $('#toast'); if (node) bindPhotoError(node, value);
  }
  window.addEventListener('cw-language-change', repaintPhotoErrors);
  let photoErrorLanguage = document.documentElement.lang;
  new MutationObserver(() => {
    if (document.documentElement.lang === photoErrorLanguage) return;
    photoErrorLanguage = document.documentElement.lang; repaintPhotoErrors();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  const photoUiBindings = new WeakMap();
  const photoUiMessages = {
    title: ['Fotografias', 'Photographs', 'Photographies', 'Fotografías', 'Fotos'],
    section: ['Fotografias da visita', 'Visit photographs', 'Photographies de la visite', 'Fotografías de la visita', 'Fotos des Besuchs'],
    quick: ['registo rapido', 'quick record', 'enregistrement rapide', 'registro rápido', 'schnelle Erfassung'],
    beforeButton: ['Foto antes', 'Before photo', 'Photo avant', 'Foto antes', 'Foto vorher'],
    afterButton: ['Foto depois', 'After photo', 'Photo après', 'Foto después', 'Foto nachher'],
    problemButton: ['Foto problema', 'Problem photo', 'Photo du problème', 'Foto del problema', 'Problemfoto'],
    gallery: ['Câmara indisponível? Escolher do telemóvel', 'Camera unavailable? Choose from your phone', 'Appareil photo indisponible ? Choisir sur le téléphone', '¿Cámara no disponible? Elegir del teléfono', 'Kamera nicht verfügbar? Vom Telefon auswählen'],
    type: ['Tipo de fotografia', 'Photograph type', 'Type de photographie', 'Tipo de fotografía', 'Art des Fotos'],
    before: ['Antes', 'Before', 'Avant', 'Antes', 'Vorher'],
    after: ['Depois', 'After', 'Après', 'Después', 'Nachher'],
    problem: ['Problema', 'Problem', 'Problème', 'Problema', 'Problem'],
    access: ['Acesso', 'Access', 'Accès', 'Acceso', 'Zugang'],
    record: ['Registo', 'Record', 'Enregistrement', 'Registro', 'Dokumentation'],
    choose: ['Escolher fotografia guardada', 'Choose a saved photograph', 'Choisir une photographie enregistrée', 'Elegir una fotografía guardada', 'Gespeichertes Foto auswählen'],
    empty: ['Ainda sem fotografias nesta visita.', 'No photographs for this visit yet.', 'Aucune photographie pour cette visite pour le moment.', 'Todavía no hay fotografías de esta visita.', 'Noch keine Fotos für diesen Besuch.'],
    sync: ['Sincronizar fotografias', 'Synchronize photographs', 'Synchroniser les photographies', 'Sincronizar fotografías', 'Fotos synchronisieren'],
    uploaded: ['Sincronizada no registo', 'Synchronized with the record', 'Synchronisée avec le dossier', 'Sincronizada con el registro', 'Mit dem Datensatz synchronisiert'],
    uploading: ['A enviar...', 'Sending...', 'Envoi...', 'Enviando...', 'Wird gesendet...'],
    pending: ['Pendente por sincronizar', 'Awaiting synchronization', 'En attente de synchronisation', 'Pendiente de sincronización', 'Synchronisierung ausstehend'],
    alt: ['Fotografia {kind}', 'Photograph: {kind}', 'Photographie : {kind}', 'Fotografía: {kind}', 'Foto: {kind}'],
    file: ['Foto do servico', 'Service photograph', 'Photographie du service', 'Fotografía del servicio', 'Servicefoto'],
    send: ['Enviar', 'Send', 'Envoyer', 'Enviar', 'Senden'],
    remove: ['Remover', 'Remove', 'Supprimer', 'Eliminar', 'Entfernen'],
    savedAlt: ['Fotografia guardada no servidor; ligue à rede para consultar.', 'Photograph saved on the server; connect to view it.', 'Photographie enregistrée sur le serveur ; connectez-vous pour la consulter.', 'Fotografía guardada en el servidor; conéctese para verla.', 'Foto auf dem Server gespeichert; stellen Sie eine Verbindung her, um es anzusehen.'],
    session: ['A sessão mudou. Reabra a página com a conta original.', 'The session changed. Reopen the page with the original account.', 'La session a changé. Rouvrez la page avec le compte d’origine.', 'La sesión cambió. Abra la página con la cuenta original.', 'Die Sitzung wurde geändert. Öffnen Sie die Seite mit dem ursprünglichen Konto erneut.'],
    inactive: ['Sem visita ativa', 'No active visit', 'Aucune visite active', 'No hay una visita activa', 'Kein aktiver Besuch'],
    confirmed: ['Fotografia confirmada pelo servidor.', 'Photograph confirmed by the server.', 'Photographie confirmée par le serveur.', 'Fotografía confirmada por el servidor.', 'Foto vom Server bestätigt.'],
    alreadySynced: ['Fotografias ja sincronizadas.', 'Photographs already synchronized.', 'Photographies déjà synchronisées.', 'Fotografías ya sincronizadas.', 'Fotos bereits synchronisiert.'],
    stillPending: ['Ainda existem fotos pendentes.', 'Some photographs are still pending.', 'Certaines photographies sont encore en attente.', 'Todavía hay fotografías pendientes.', 'Einige Fotos sind noch ausstehend.'],
    synced: ['Fotografias sincronizadas.', 'Photographs synchronized.', 'Photographies synchronisées.', 'Fotografías sincronizadas.', 'Fotos synchronisiert.'],
    cameraFailed: ['Não foi possível abrir a câmara. Use a opção de fotografia guardada no telemóvel.', 'Could not open the camera. Choose a photograph saved on your phone.', 'Impossible d’ouvrir l’appareil photo. Choisissez une photographie enregistrée sur le téléphone.', 'No se pudo abrir la cámara. Elija una fotografía guardada en el teléfono.', 'Die Kamera konnte nicht geöffnet werden. Wählen Sie ein auf dem Telefon gespeichertes Foto.'],
    selectionChanged: ['A visita ou a sessão mudou. Escolha novamente a fotografia na visita correta.', 'The visit or session changed. Select the photograph again for the correct visit.', 'La visite ou la session a changé. Sélectionnez à nouveau la photographie pour la bonne visite.', 'La visita o la sesión cambió. Seleccione de nuevo la fotografía para la visita correcta.', 'Der Besuch oder die Sitzung wurde geändert. Wählen Sie das Foto für den richtigen Besuch erneut aus.'],
    chooseVisit: ['Escolha uma visita antes de adicionar fotografias.', 'Choose a visit before adding photographs.', 'Choisissez une visite avant d’ajouter des photographies.', 'Elija una visita antes de añadir fotografías.', 'Wählen Sie einen Besuch, bevor Sie Fotos hinzufügen.'],
    invalid: ['Escolha uma imagem válida, até 25 MB. A fotografia não foi adicionada.', 'Choose a valid image up to 25 MB. The photograph was not added.', 'Choisissez une image valide de 25 Mo maximum. La photographie n’a pas été ajoutée.', 'Elija una imagen válida de hasta 25 MB. La fotografía no se ha añadido.', 'Wählen Sie ein gültiges Bild mit höchstens 25 MB. Das Foto wurde nicht hinzugefügt.'],
    storageFailed: ['Não foi possível guardar a fotografia neste dispositivo. Liberte espaço e tente novamente; a fotografia não foi adicionada.', 'Could not save the photograph on this device. Free up space and try again; the photograph was not added.', 'Impossible d’enregistrer la photographie sur cet appareil. Libérez de l’espace et réessayez ; la photographie n’a pas été ajoutée.', 'No se pudo guardar la fotografía en este dispositivo. Libere espacio e inténtelo de nuevo; la fotografía no se ha añadido.', 'Das Foto konnte nicht auf diesem Gerät gespeichert werden. Geben Sie Speicherplatz frei und versuchen Sie es erneut; das Foto wurde nicht hinzugefügt.'],
    saved: ['Fotografia guardada neste telemóvel. Aguarda confirmação do envio.', 'Photograph saved on this phone. Awaiting confirmation of the upload.', 'Photographie enregistrée sur ce téléphone. En attente de confirmation de l’envoi.', 'Fotografía guardada en este teléfono. Pendiente de confirmación del envío.', 'Foto auf diesem Telefon gespeichert. Die Bestätigung des Uploads steht aus.'],
    cancelled: ['Nenhuma fotografia adicionada. Pode tentar novamente ou escolher uma fotografia guardada.', 'No photograph added. Try again or choose a saved photograph.', 'Aucune photographie ajoutée. Réessayez ou choisissez une photographie enregistrée.', 'No se ha añadido ninguna fotografía. Inténtelo de nuevo o elija una fotografía guardada.', 'Kein Foto hinzugefügt. Versuchen Sie es erneut oder wählen Sie ein gespeichertes Foto.'],
    finishBlocked: ['Ha fotografias pendentes. Sincroniza ou remove antes de concluir.', 'There are pending photographs. Synchronize or remove them before completing the visit.', 'Des photographies sont en attente. Synchronisez-les ou supprimez-les avant de terminer la visite.', 'Hay fotografías pendientes. Sincronícelas o elimínelas antes de finalizar la visita.', 'Es gibt ausstehende Fotos. Synchronisieren oder entfernen Sie sie, bevor Sie den Besuch abschließen.'],
  };
  function photoUiText(key, values = {}, language = document.documentElement.lang || 'pt') {
    const index = Math.max(0, photoErrorLanguages.indexOf(String(language).toLowerCase().split('-')[0]));
    return photoUiMessages[key][index].replace('{kind}', () => photoUiText(values.kind, {}, language));
  }
  function bindPhotoUi(node, key, values = {}, attribute) {
    if (!node) return;
    photoUiBindings.set(node, { key, values: Object.freeze({ ...values }), attribute, protected: node.hasAttribute('data-cw-no-i18n') });
    node.setAttribute('data-cw-photo-ui-copy', ''); node.setAttribute('data-cw-no-i18n', '');
    const text = photoUiText(key, values); if (attribute) node.setAttribute(attribute, text); else node.textContent = text;
  }
  function clearPhotoUi(node) {
    const value = photoUiBindings.get(node); if (!value) return;
    if (!value.protected) node.removeAttribute('data-cw-no-i18n');
    node.removeAttribute('data-cw-photo-ui-copy'); photoUiBindings.delete(node);
  }
  function repaintPhotoUi() {
    for (const node of document.querySelectorAll('[data-cw-photo-ui-copy]')) {
      const value = photoUiBindings.get(node); if (!value) continue;
      const text = photoUiText(value.key, value.values);
      if (value.attribute) { if (node.getAttribute(value.attribute) !== text) node.setAttribute(value.attribute, text); }
      else if (node.textContent !== text) node.textContent = text;
    }
  }
  function photoToast(key) { toast(photoUiText(key)); bindPhotoUi($('#toast'), key); }
  window.addEventListener('cw-language-change', repaintPhotoUi);
  let photoUiLanguage = document.documentElement.lang;
  new MutationObserver(() => {
    if (document.documentElement.lang === photoUiLanguage) return;
    photoUiLanguage = document.documentElement.lang; repaintPhotoUi();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // Water presentation captures values; language changes never reload reminders.
  const waterUi = (() => {
    const languages = ['pt', 'en', 'fr', 'es', 'de'];
    const copy = {
  "title": [
    "Agua aberta",
    "Running water",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "chip": [
    "Água aberta",
    "Running water",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "hint": [
    "alarme obrigatorio",
    "mandatory alarm",
    "alarme obligatoire",
    "alarma obligatoria",
    "Alarm erforderlich"
  ],
  "intro": [
    "Defina tempo ou hora para fechar e evitar esquecimentos.",
    "Set a delay or closing time so you do not forget.",
    "Définissez un délai ou une heure de fermeture pour éviter les oublis.",
    "Indique un plazo o una hora de cierre para no olvidarse.",
    "Legen Sie eine Frist oder Uhrzeit zum Schließen fest, damit Sie es nicht vergessen."
  ],
  "minutesPlaceholder": [
    "Minutos. Ex: 25",
    "Minutes. E.g. 25",
    "Minutes. Ex. : 25",
    "Minutos. Ej.: 25",
    "Minuten. Z. B. 25"
  ],
  "timeLabel": [
    "Hora para fechar a água",
    "Time to turn off the water",
    "Heure de fermeture de l’eau",
    "Hora para cerrar el agua",
    "Uhrzeit zum Abstellen des Wassers"
  ],
  "notePlaceholder": [
    "Nota opcional",
    "Optional note",
    "Note facultative",
    "Nota opcional",
    "Optionale Notiz"
  ],
  "open": [
    "Marcar água aberta",
    "Record running water",
    "Enregistrer l’ouverture de l’eau",
    "Registrar agua abierta",
    "Laufendes Wasser erfassen"
  ],
  "empty": [
    "Sem lembretes de agua aberta.",
    "No running-water reminders.",
    "Aucun rappel d’eau ouverte.",
    "No hay recordatorios de agua abierta.",
    "Keine Erinnerungen an laufendes Wasser."
  ],
  "pool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ],
  "client": [
    "Cliente",
    "Client",
    "Client",
    "Cliente",
    "Kunde"
  ],
  "location": [
    "Localizacao por confirmar",
    "Location unconfirmed",
    "Emplacement à confirmer",
    "Ubicación por confirmar",
    "Standort unbestätigt"
  ],
  "note": [
    "Sem nota adicional",
    "No additional note",
    "Aucune note supplémentaire",
    "Sin nota adicional",
    "Keine weitere Notiz"
  ],
  "place": [
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}"
  ],
  "pending": [
    "Por confirmar",
    "Unconfirmed",
    "À confirmer",
    "Por confirmar",
    "Unbestätigt"
  ],
  "recorded": [
    "Registado",
    "Recorded",
    "Enregistré",
    "Registrado",
    "Erfasst"
  ],
  "syncing": [
    "A sincronizar",
    "Synchronizing",
    "Synchronisation",
    "Sincronizando",
    "Synchronisierung"
  ],
  "closing": [
    "Fecho por enviar",
    "Closure awaiting upload",
    "Fermeture à envoyer",
    "Cierre pendiente de envío",
    "Schließen noch zu übermitteln"
  ],
  "alarm": [
    "ALARME",
    "ALARM",
    "ALARME",
    "ALARMA",
    "ALARM"
  ],
  "opened": [
    "Aberta",
    "Open",
    "Ouverte",
    "Abierta",
    "Offen"
  ],
  "close": [
    "Agua fechada",
    "Water turned off",
    "Eau fermée",
    "Agua cerrada",
    "Wasser abgestellt"
  ],
  "alert": [
    "Alertar equipa",
    "Alert the team",
    "Alerter l’équipe",
    "Avisar al equipo",
    "Team alarmieren"
  ],
  "unknownTime": [
    "Hora por confirmar",
    "Time unconfirmed",
    "Heure à confirmer",
    "Hora por confirmar",
    "Uhrzeit unbestätigt"
  ],
  "closedLabel": [
    "Torneira fechada; confirmação no servidor pendente",
    "Tap closed; server confirmation pending",
    "Robinet fermé ; confirmation du serveur en attente",
    "Grifo cerrado; confirmación del servidor pendiente",
    "Wasserhahn geschlossen; Serverbestätigung ausstehend"
  ],
  "overdueLabel": [
    "Água por confirmar - previsto {when}",
    "Water status unconfirmed - due {when}",
    "État de l’eau à confirmer - prévu {when}",
    "Agua por confirmar - previsto {when}",
    "Wasserstatus unbestätigt - vorgesehen {when}"
  ],
  "lateLabel": [
    "Atrasado desde {when}",
    "Overdue since {when}",
    "En retard depuis {when}",
    "Atrasado desde {when}",
    "Überfällig seit {when}"
  ],
  "dueLabel": [
    "Lembrar em {when}",
    "Reminder at {when}",
    "Rappel à {when}",
    "Recordar a las {when}",
    "Erinnerung um {when}"
  ],
  "alarmHeader": [
    "ALARME: agua aberta por fechar.",
    "ALARM: running water must be turned off.",
    "ALARME : l’eau ouverte doit être fermée.",
    "ALARMA: hay agua abierta por cerrar.",
    "ALARM: Laufendes Wasser muss abgestellt werden."
  ],
  "alarmPool": [
    "Piscina: {name}",
    "Pool: {name}",
    "Piscine : {name}",
    "Piscina: {name}",
    "Pool: {name}"
  ],
  "alarmClient": [
    "Cliente: {name}",
    "Client: {name}",
    "Client : {name}",
    "Cliente: {name}",
    "Kunde: {name}"
  ],
  "alarmNote": [
    "Nota: {note}",
    "Note: {note}",
    "Note : {note}",
    "Nota: {note}",
    "Notiz: {note}"
  ],
  "alarmAction": [
    "Verificar ou fechar imediatamente.",
    "Check or turn it off immediately.",
    "Vérifiez ou fermez immédiatement.",
    "Compruebe o cierre inmediatamente.",
    "Sofort prüfen oder abstellen."
  ],
  "alarmMessage": [
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}"
  ],
  "alarmLine": [
    "\n{text}",
    "\n{text}",
    "\n{text}",
    "\n{text}",
    "\n{text}"
  ],
  "alarmSaved": [
    "ALARME: verificar água aberta. A confirmar no servidor.",
    "ALARM: check the running water. Awaiting server confirmation.",
    "ALARME : vérifiez l’eau ouverte. En attente de confirmation du serveur.",
    "ALARMA: compruebe el agua abierta. Pendiente de confirmación del servidor.",
    "ALARM: Laufendes Wasser prüfen. Serverbestätigung ausstehend."
  ],
  "exceptionTitle": [
    "P0 - Agua aberta",
    "P0 - Running water",
    "P0 - Eau ouverte",
    "P0 - Agua abierta",
    "P0 - Wasser läuft"
  ]
};
    const specs = new WeakSet(), bindings = new Map();
    function value(key, params = {}) { const entry = Object.freeze({ key, params: Object.freeze({ ...params }) }); specs.add(entry); return entry; }
    function format(entry, language = document.documentElement.lang || 'pt') {
      if (!specs.has(entry)) return window.CWFieldReminders?.presentation?.format(entry) ?? String(entry ?? '');
      const index = Math.max(0, languages.indexOf(String(language).toLowerCase().split('-')[0]));
      return copy[entry.key][index].replace(/\{(\w+)\}/g, (_, key) => format(entry.params[key], language));
    }
    function clear(node) { const old = bindings.get(node); if (!old) return; bindings.delete(node); node.removeAttribute('data-cw-water-list-copy'); if (!old.protected && !node.hasAttribute('data-cw-water-copy')) node.removeAttribute('data-cw-no-i18n'); }
    function prune() { for (const node of bindings.keys()) if (!node.isConnected) clear(node); }
    function clearTree(root) { for (const node of bindings.keys()) if (node === root || root.contains(node) || !node.isConnected) clear(node); }
    function bind(node, entry, attribute = '') {
      if (!node) return;
      const previous = bindings.get(node), rendered = format(entry), protectedNode = previous ? previous.protected : node.hasAttribute('data-cw-no-i18n');
      node.setAttribute('data-cw-water-list-copy', ''); node.setAttribute('data-cw-no-i18n', '');
      if (attribute) { if (node.getAttribute(attribute) !== rendered) node.setAttribute(attribute, rendered); }
      else if (node.textContent !== rendered) node.textContent = rendered;
      bindings.set(node, { entry, attribute, rendered, protected: protectedNode, textNode: node.firstChild });
    }
    function paint() {
      for (const [node, item] of bindings) {
        const current = item.attribute ? node.getAttribute(item.attribute) : node.textContent;
        if (!node.isConnected || current !== item.rendered || (!item.attribute && node.firstChild !== item.textNode)) { clear(node); continue; }
        bind(node, item.entry, item.attribute);
      }
    }
    function notify(entry) { toast(format(entry)); bind($('#toast'), entry); }
    function error(error) { notify(window.CWFieldReminders?.presentation?.error(error) ?? String(error?.message ?? '')); }
    function showAlarm(entry) {
      const message = format(entry), previous = new Set(document.querySelectorAll('.cw-ui-toast'));
      ui.error(message);
      const created = Array.from(document.querySelectorAll('.cw-ui-toast')).filter(node => !previous.has(node) && node.textContent === message);
      if (created.length === 1) { prune(); bind(created[0], entry); }
    }
    window.addEventListener('cw-language-change', paint);
    let lastLanguage = document.documentElement.lang;
    new MutationObserver(() => { const language = document.documentElement.lang; if (language !== lastLanguage) { lastLanguage = language; paint(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return { value, format, bind, clear, clearTree, prune, notify, error, showAlarm };
  })();

  // Capture journal UI values; changing language neither rereads nor writes the journal.
  const alertUi = (() => {
    const languages = ['pt', 'en', 'fr', 'es', 'de'];
    const copy = {
  "centerTitle": [
    "Centro documental",
    "Document overview",
    "Vue d’ensemble des documents",
    "Resumen documental",
    "Dokumentenübersicht"
  ],
  "centerReady": [
    "Operacional",
    "Ready for work",
    "Opérationnel",
    "Operativo",
    "Betriebsbereit"
  ],
  "centerBlocked": [
    "Bloqueado",
    "Blocked",
    "Bloqué",
    "Bloqueado",
    "Gesperrt"
  ],
  "centerSource": [
    "Fonte: {source}",
    "Source: {source}",
    "Source : {source}",
    "Fuente: {source}",
    "Quelle: {source}"
  ],
  "centerLive": [
    "online",
    "online",
    "en ligne",
    "en línea",
    "online"
  ],
  "centerCache": [
    "cópia guardada",
    "saved copy",
    "copie enregistrée",
    "copia guardada",
    "gespeicherte Kopie"
  ],
  "centerMixed": [
    "parcial — consulte cada documento",
    "partial — check each document",
    "partielle — consultez chaque document",
    "parcial — consulta cada documento",
    "teilweise — prüfen Sie jedes Dokument"
  ],
  "centerUnconfirmed": [
    "por confirmar",
    "awaiting confirmation",
    "à confirmer",
    "por confirmar",
    "noch zu bestätigen"
  ],
  "centerSafety": [
    "Fichas",
    "Safety sheets",
    "Fiches de sécurité",
    "Fichas de seguridad",
    "Sicherheitsdatenblätter"
  ],
  "centerManuals": [
    "Manuais",
    "Manuals",
    "Manuels",
    "Manuales",
    "Handbücher"
  ],
  "centerValidated": [
    "Documentação obrigatória validada para iniciar e concluir.",
    "Required documents validated for starting and completing work.",
    "Documents obligatoires validés pour commencer et terminer l’intervention.",
    "Documentación obligatoria validada para iniciar y finalizar el trabajo.",
    "Erforderliche Dokumente für Beginn und Abschluss der Arbeit geprüft."
  ],
  "centerInitial": [
    "Resumo de estados: válido, pendente, expirado ou indisponível.",
    "Status overview: valid, pending, expired or unavailable.",
    "Résumé des états : valide, en attente, expiré ou indisponible.",
    "Resumen de estados: válido, pendiente, vencido o no disponible.",
    "Statusübersicht: gültig, ausstehend, abgelaufen oder nicht verfügbar."
  ],
  "centerWorkStock": [
    "Guia de obra/stock",
    "Work guide/stock",
    "Bon de travail/stock",
    "Guía de trabajo/stock",
    "Arbeitsbeleg/Bestand"
  ],
  "centerInsuranceInspection": [
    "Seguro/inspeção",
    "Insurance/inspection",
    "Assurance/contrôle technique",
    "Seguro/inspección",
    "Versicherung/Fahrzeugprüfung"
  ],
  "centerConsulted": [
    "{name}: consultado em {date}",
    "{name}: checked on {date}",
    "{name} : consulté le {date}",
    "{name}: consultado el {date}",
    "{name}: abgerufen am {date}"
  ],
  "centerCachedAt": [
    "{name}: cópia consultada em {date}",
    "{name}: copy checked on {date}",
    "{name} : copie consultée le {date}",
    "{name}: copia consultada el {date}",
    "{name}: Kopie abgerufen am {date}"
  ],
  "centerCacheWarning": [
    "A cópia guardada não confirma alterações recentes. Os PDFs precisam de ligação.",
    "The saved copy does not confirm recent changes. PDFs require a connection.",
    "La copie enregistrée ne confirme pas les changements récents. Les PDF nécessitent une connexion.",
    "La copia guardada no confirma cambios recientes. Los PDF requieren conexión.",
    "Die gespeicherte Kopie bestätigt keine aktuellen Änderungen. PDFs benötigen eine Verbindung."
  ],
  "centerVehicleConfirm": [
    "Confirme a viatura atribuída antes de consultar documentos.",
    "Confirm the assigned vehicle before viewing documents.",
    "Confirmez le véhicule attribué avant de consulter les documents.",
    "Confirma el vehículo asignado antes de consultar documentos.",
    "Bestätigen Sie das zugewiesene Fahrzeug, bevor Sie Dokumente abrufen."
  ],
  "centerUpdated": [
    "Guias atualizadas.",
    "Documents refreshed.",
    "Documents actualisés.",
    "Documentos actualizados.",
    "Dokumente aktualisiert."
  ],
  "centerRefreshUnconfirmed": [
    "Documentação com dados por confirmar. Consulte a origem de cada informação.",
    "Some document data needs confirmation. Check the source of each item.",
    "Certaines données documentaires restent à confirmer. Consultez la source de chaque information.",
    "Hay datos documentales por confirmar. Consulta la fuente de cada información.",
    "Einige Dokumentangaben sind noch zu bestätigen. Prüfen Sie die Quelle jeder Angabe."
  ],
  "crewAria": [
    "Identificação e documentos do técnico",
    "Technician identity and documents",
    "Identité et documents du technicien",
    "Identificación y documentos del técnico",
    "Identität und Dokumente des Technikers"
  ],
  "crewHeading": [
    "Técnico e viatura",
    "Technician and vehicle",
    "Technicien et véhicule",
    "Técnico y vehículo",
    "Techniker und Fahrzeug"
  ],
  "crewDescription": [
    "Estado documental e veículo do dia.",
    "Document status and today's vehicle.",
    "État des documents et véhicule du jour.",
    "Estado documental y vehículo del día.",
    "Dokumentenstatus und Fahrzeug des Tages."
  ],
  "crewSectionHint": [
    "viatura e documentos",
    "vehicle and documents",
    "véhicule et documents",
    "vehículo y documentos",
    "Fahrzeug und Dokumente"
  ],
  "crewVehicle": [
    "Viatura",
    "Vehicle",
    "Véhicule",
    "Vehículo",
    "Fahrzeug"
  ],
  "crewSafetyManuals": [
    "Fichas e manuais",
    "Safety sheets and manuals",
    "Fiches et manuels",
    "Fichas y manuales",
    "Datenblätter und Handbücher"
  ],
  "crewUnidentified": [
    "Por identificar",
    "Not yet identified",
    "À identifier",
    "Por identificar",
    "Noch zu identifizieren"
  ],
  "crewUnknownTechnician": [
    "Tecnico por identificar",
    "Technician not yet identified",
    "Technicien à identifier",
    "Técnico por identificar",
    "Techniker noch zu identifizieren"
  ],
  "crewUnknownTechnicianId": [
    "ID técnico por confirmar",
    "Technician ID needs confirmation",
    "Identifiant du technicien à confirmer",
    "ID del técnico por confirmar",
    "Techniker-ID noch zu bestätigen"
  ],
  "crewUnknownPlate": [
    "Matricula por confirmar",
    "Registration plate needs confirmation",
    "Immatriculation à confirmer",
    "Matrícula por confirmar",
    "Kennzeichen noch zu bestätigen"
  ],
  "crewVehicleInitial": [
    "Escolha ou carregue a viatura do dia.",
    "Choose or load today's vehicle.",
    "Choisissez ou chargez le véhicule du jour.",
    "Elige o carga el vehículo del día.",
    "Wählen oder laden Sie das Fahrzeug des Tages."
  ],
  "crewTransportInitial": [
    "Guia de transporte por carregar.",
    "Transport document not loaded yet.",
    "Bon de transport à charger.",
    "Guía de transporte por cargar.",
    "Transportbeleg noch zu laden."
  ],
  "crewWorkInitial": [
    "Guia de obra por abrir.",
    "Work guide not opened yet.",
    "Bon de travail à ouvrir.",
    "Guía de trabajo por abrir.",
    "Arbeitsbeleg noch zu öffnen."
  ],
  "crewInsuranceInitial": [
    "Seguro da viatura por validar.",
    "Vehicle insurance needs validation.",
    "Assurance du véhicule à valider.",
    "Seguro del vehículo por validar.",
    "Fahrzeugversicherung noch zu prüfen."
  ],
  "crewInspectionInitial": [
    "Sem inspeção visível para esta viatura.",
    "No inspection is visible for this vehicle.",
    "Aucun contrôle technique visible pour ce véhicule.",
    "No hay una inspección visible para este vehículo.",
    "Für dieses Fahrzeug ist keine Hauptuntersuchung sichtbar."
  ],
  "crewSafetyInitial": [
    "Fichas de segurança/manuais por confirmar.",
    "Safety sheets and manuals need confirmation.",
    "Fiches de sécurité et manuels à confirmer.",
    "Fichas de seguridad y manuales por confirmar.",
    "Sicherheitsdatenblätter und Handbücher noch zu bestätigen."
  ],
  "crewGreen": [
    "Verde",
    "Green",
    "Vert",
    "Verde",
    "Grün"
  ],
  "crewRed": [
    "Vermelha",
    "Red",
    "Rouge",
    "Roja",
    "Rot"
  ],
  "crewAssociated": [
    "associada",
    "linked",
    "associé",
    "asociada",
    "verknüpft"
  ],
  "crewTransportReady": [
    "AT {code} disponivel para apresentar.",
    "AT {code} available to show.",
    "AT {code} disponible à présenter.",
    "AT {code} disponible para presentar.",
    "AT {code} kann vorgelegt werden."
  ],
  "crewTransportMissing": [
    "Guia de transporte AT em falta ou por associar.",
    "AT transport document missing or not yet linked.",
    "Bon de transport AT manquant ou à associer.",
    "Guía de transporte AT ausente o por asociar.",
    "AT-Transportbeleg fehlt oder ist noch nicht verknüpft."
  ],
  "crewWorkLinked": [
    "Guia de obra #{id} ligada a AT.",
    "Work guide #{id} linked to AT.",
    "Bon de travail n°{id} associé à AT.",
    "Guía de trabajo #{id} vinculada a AT.",
    "Arbeitsbeleg #{id} mit AT verknüpft."
  ],
  "crewWorkProvisional": [
    "Guia de obra #{id} provisoria, falta AT.",
    "Work guide #{id} is provisional; AT is missing.",
    "Bon de travail n°{id} provisoire, AT manquant.",
    "Guía de trabajo #{id} provisional; falta AT.",
    "Arbeitsbeleg #{id} ist vorläufig; AT fehlt."
  ],
  "crewWorkMissing": [
    "Sem guia de obra aberta para esta viatura.",
    "No open work guide for this vehicle.",
    "Aucun bon de travail ouvert pour ce véhicule.",
    "No hay una guía de trabajo abierta para este vehículo.",
    "Kein offener Arbeitsbeleg für dieses Fahrzeug."
  ],
  "crewInsuranceReady": [
    "Seguro válido para operação.",
    "Insurance is valid for operation.",
    "Assurance valide pour l’activité.",
    "Seguro válido para operar.",
    "Versicherung für den Betrieb gültig."
  ],
  "crewInsuranceWarning": [
    "Seguro ausente, pendente ou expirado.",
    "Insurance is missing, pending or expired.",
    "Assurance absente, en attente ou expirée.",
    "Seguro ausente, pendiente o vencido.",
    "Versicherung fehlt, ist ausstehend oder abgelaufen."
  ],
  "crewInspectionReady": [
    "Inspeção válida para circulação.",
    "Inspection is valid for road use.",
    "Contrôle technique valide pour circuler.",
    "Inspección válida para circular.",
    "Hauptuntersuchung für den Straßenverkehr gültig."
  ],
  "crewInspectionWarning": [
    "Inspeção ausente, pendente ou expirada.",
    "Inspection is missing, pending or expired.",
    "Contrôle technique absent, en attente ou expiré.",
    "Inspección ausente, pendiente o vencida.",
    "Hauptuntersuchung fehlt, ist ausstehend oder abgelaufen."
  ],
  "crewSafetyReady": [
    "Fichas de segurança e manuais disponíveis.",
    "Safety sheets and manuals are available.",
    "Fiches de sécurité et manuels disponibles.",
    "Fichas de seguridad y manuales disponibles.",
    "Sicherheitsdatenblätter und Handbücher sind verfügbar."
  ],
  "crewSafetyWarning": [
    "Fichas de segurança/manuais pendentes ou indisponíveis.",
    "Safety sheets or manuals are pending or unavailable.",
    "Fiches de sécurité ou manuels en attente ou indisponibles.",
    "Fichas de seguridad o manuales pendientes o no disponibles.",
    "Sicherheitsdatenblätter oder Handbücher sind ausstehend oder nicht verfügbar."
  ],
  "crewPendingDocument": [
    "Documento pendente para operação segura.",
    "Document pending for safe operation.",
    "Document en attente pour une activité sûre.",
    "Documento pendiente para operar con seguridad.",
    "Dokument für einen sicheren Betrieb noch ausstehend."
  ],
  "crewIdentity": [
    "ID {id}",
    "ID {id}",
    "ID {id}",
    "ID {id}",
    "ID {id}"
  ],
  "crewVehicleId": [
    "Viatura ID {id}",
    "Vehicle ID {id}",
    "Véhicule ID {id}",
    "Vehículo ID {id}",
    "Fahrzeug-ID {id}"
  ],
  "crewVehicleDay": [
    "Viatura associada a este dia/ronda.",
    "Vehicle linked to this day or round.",
    "Véhicule associé à ce jour ou à cette tournée.",
    "Vehículo asociado a este día o ronda.",
    "Fahrzeug diesem Tag oder dieser Runde zugeordnet."
  ],
  "productLineLimit": [
    "Registe no máximo 50 linhas de produtos por visita.",
    "Record no more than 50 product lines per visit.",
    "Enregistrez au maximum 50 lignes de produits par visite.",
    "Registra como máximo 50 líneas de productos por visita.",
    "Erfassen Sie höchstens 50 Produktzeilen pro Besuch."
  ],
  "productGuideMissing": [
    "Sem guia de obra ativa para deduzir produtos.",
    "There is no active work guide to deduct products from.",
    "Aucun bon de travail actif ne permet de déduire les produits.",
    "No hay una guía de trabajo activa de la que descontar productos.",
    "Es gibt keinen aktiven Arbeitsbeleg, von dem Produkte abgebucht werden können."
  ],
  "productReselect": [
    "Selecione novamente cada produto na guia para confirmar a linha e a unidade. O rascunho foi conservado.",
    "Select each product again in the guide to confirm the line and unit. The draft has been preserved.",
    "Sélectionnez de nouveau chaque produit dans le bon pour confirmer la ligne et l’unité. Le brouillon a été conservé.",
    "Selecciona de nuevo cada producto en la guía para confirmar la línea y la unidad. El borrador se ha conservado.",
    "Wählen Sie jedes Produkt im Beleg erneut aus, um Zeile und Einheit zu bestätigen. Der Entwurf wurde aufbewahrt."
  ],
  "productLineChanged": [
    "A linha do produto mudou ou já não pertence à guia atual. Atualize e reveja a seleção.",
    "The product line has changed or no longer belongs to the current guide. Refresh and review the selection.",
    "La ligne du produit a changé ou n’appartient plus au bon actuel. Actualisez et vérifiez la sélection.",
    "La línea del producto ha cambiado o ya no pertenece a la guía actual. Actualiza y revisa la selección.",
    "Die Produktzeile wurde geändert oder gehört nicht mehr zum aktuellen Beleg. Aktualisieren und prüfen Sie die Auswahl."
  ],
  "productStockInsufficient": [
    "Stock insuficiente para {name}. Disponível: {quantity} {unit}.",
    "Insufficient stock for {name}. Available: {quantity} {unit}.",
    "Stock insuffisant pour {name}. Disponible : {quantity} {unit}.",
    "Existencias insuficientes de {name}. Disponible: {quantity} {unit}.",
    "Unzureichender Bestand für {name}. Verfügbar: {quantity} {unit}."
  ],
  "actionSessionChanged": [
    "A sessão mudou. Reabra a página com a conta original.",
    "The session has changed. Reopen the page with the original account.",
    "La session a changé. Rouvrez la page avec le compte d’origine.",
    "La sesión ha cambiado. Vuelve a abrir la página con la cuenta original.",
    "Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem ursprünglichen Konto erneut."
  ],
  "actionExtraDone": [
    "Visita extra concluída. Consulte o registo; correções exigem revisão pelo escritório.",
    "Extra visit completed. View the record; corrections require review by the office.",
    "Visite supplémentaire terminée. Consultez le compte rendu ; les corrections nécessitent une vérification par le bureau.",
    "Visita extra completada. Consulta el registro; las correcciones requieren revisión por la oficina.",
    "Zusatzbesuch abgeschlossen. Sehen Sie den Datensatz ein; Korrekturen müssen vom Büro geprüft werden."
  ],
  "actionReview": [
    "Registo aberto para corrigir.",
    "Record opened for correction.",
    "Compte rendu ouvert pour correction.",
    "Registro abierto para corregir.",
    "Datensatz zur Korrektur geöffnet."
  ],
  "actionDocsMissing": [
    "Bloqueio operacional: faltam documentos obrigatórios da viatura.",
    "Work blocked: required vehicle documents are missing.",
    "Intervention bloquée : des documents obligatoires du véhicule sont manquants.",
    "Trabajo bloqueado: faltan documentos obligatorios del vehículo.",
    "Arbeiten gesperrt: Erforderliche Fahrzeugdokumente fehlen."
  ],
  "actionStartLocal": [
    "Visita iniciada neste dispositivo. O registo será enviado ao concluir com ligação.",
    "Visit started on this device. The record will be sent when you complete it with a connection.",
    "Visite commencée sur cet appareil. Le compte rendu sera envoyé à la clôture avec une connexion.",
    "Visita iniciada en este dispositivo. El registro se enviará al completarla con conexión.",
    "Besuch auf diesem Gerät begonnen. Der Datensatz wird beim Abschluss mit Verbindung gesendet."
  ],
  "actionStartMemory": [
    "Início apenas em memória: a ronda não ficou guardada. Não feche a página.",
    "Start is only in memory: the round was not saved. Do not close the page.",
    "Début conservé uniquement en mémoire : la tournée n’a pas été enregistrée. Ne fermez pas la page.",
    "Inicio solo en memoria: la ronda no se ha guardado. No cierres la página.",
    "Beginn nur im Arbeitsspeicher: Die Tour wurde nicht gespeichert. Schließen Sie die Seite nicht."
  ],
  "actionStartUnconfirmed": [
    "A resposta não confirma o início desta visita. Atualize a rota.",
    "The response does not confirm that this visit has started. Refresh the route.",
    "La réponse ne confirme pas le début de cette visite. Actualisez l’itinéraire.",
    "La respuesta no confirma el inicio de esta visita. Actualiza la ruta.",
    "Die Antwort bestätigt den Beginn dieses Besuchs nicht. Aktualisieren Sie die Route."
  ],
  "actionStarted": [
    "{pool}: início confirmado.",
    "{pool}: start confirmed.",
    "{pool} : début confirmé.",
    "{pool}: inicio confirmado.",
    "{pool}: Beginn bestätigt."
  ],
  "actionStartFailed": [
    "Não foi possível iniciar a visita.",
    "Could not start the visit.",
    "Impossible de commencer la visite.",
    "No se pudo iniciar la visita.",
    "Der Besuch konnte nicht begonnen werden."
  ],
  "actionUnconfirmedProblems": [
    "Há ocorrências antigas sem confirmação. Preserve as notas e confirme o registo com o escritório antes de concluir.",
    "There are earlier incidents without confirmation. Preserve the notes and confirm the record with the office before completing the visit.",
    "Des incidents antérieurs restent sans confirmation. Conservez les notes et confirmez le compte rendu avec le bureau avant de terminer la visite.",
    "Hay incidencias anteriores sin confirmar. Conserva las notas y confirma el registro con la oficina antes de completar la visita.",
    "Frühere Vorfälle sind noch unbestätigt. Bewahren Sie die Notizen auf und klären Sie den Datensatz vor dem Abschluss mit dem Büro."
  ],
  "actionCorrectionUnconfirmed": [
    "A resposta não confirma a correção desta visita. Atualize a rota.",
    "The response does not confirm the correction to this visit. Refresh the route.",
    "La réponse ne confirme pas la correction de cette visite. Actualisez l’itinéraire.",
    "La respuesta no confirma la corrección de esta visita. Actualiza la ruta.",
    "Die Antwort bestätigt die Korrektur dieses Besuchs nicht. Aktualisieren Sie die Route."
  ],
  "actionCorrected": [
    "{pool}: correção guardada e stock reconciliado.",
    "{pool}: correction saved and stock reconciled.",
    "{pool} : correction enregistrée et stock rapproché.",
    "{pool}: corrección guardada y existencias conciliadas.",
    "{pool}: Korrektur gespeichert und Bestand abgeglichen."
  ],
  "actionCompletedStock": [
    "{pool}: visita concluída e stock atualizado.",
    "{pool}: visit completed and stock updated.",
    "{pool} : visite terminée et stock mis à jour.",
    "{pool}: visita completada y existencias actualizadas.",
    "{pool}: Besuch abgeschlossen und Bestand aktualisiert."
  ],
  "actionCompleted": [
    "{pool}: visita concluída.",
    "{pool}: visit completed.",
    "{pool} : visite terminée.",
    "{pool}: visita completada.",
    "{pool}: Besuch abgeschlossen."
  ],
  "visitPreparing": [
    "A preparar ronda...",
    "Preparing the round...",
    "Préparation de la tournée...",
    "Preparando la ronda...",
    "Tour wird vorbereitet..."
  ],
  "visitLoading": [
    "A carregar...",
    "Loading...",
    "Chargement...",
    "Cargando...",
    "Wird geladen..."
  ],
  "visitProgress": [
    "{done} de {total} visitas concluídas",
    "{done} of {total} visits completed",
    "Visites terminées : {done} / {total}",
    "{done} de {total} visitas completadas",
    "Besuche abgeschlossen: {done} / {total}"
  ],
  "visitNoAssigned": [
    "Sem visitas atribuídas",
    "No assigned visits",
    "Aucune visite attribuée",
    "Sin visitas asignadas",
    "Keine zugewiesenen Besuche"
  ],
  "visitFreeTitle": [
    "Hoje livre",
    "No visits pending today",
    "Aucune visite en attente aujourd’hui",
    "Sin visitas pendientes hoy",
    "Heute keine ausstehenden Besuche"
  ],
  "visitFreeMeta": [
    "Não tens visitas atribuídas. Atualiza a agenda, vê o calendário ou comunica com o administrador.",
    "You have no assigned visits. Refresh the schedule, view the calendar or contact the administrator.",
    "Aucune visite ne vous est attribuée. Actualisez le planning, consultez le calendrier ou contactez l’administrateur.",
    "No tienes visitas asignadas. Actualiza la agenda, consulta el calendario o contacta con el administrador.",
    "Ihnen sind keine Besuche zugewiesen. Aktualisieren Sie den Terminplan, sehen Sie im Kalender nach oder kontaktieren Sie die Verwaltung."
  ],
  "visitStart": [
    "Iniciar visita",
    "Start visit",
    "Commencer la visite",
    "Iniciar visita",
    "Besuch beginnen"
  ],
  "visitFinish": [
    "Concluir visita",
    "Complete visit",
    "Terminer la visite",
    "Completar visita",
    "Besuch abschließen"
  ],
  "visitReview": [
    "Rever registo",
    "Review record",
    "Revoir le compte rendu",
    "Revisar registro",
    "Datensatz prüfen"
  ],
  "visitView": [
    "Consultar registo",
    "View record",
    "Consulter le compte rendu",
    "Consultar registro",
    "Datensatz ansehen"
  ],
  "visitCorrect": [
    "Corrigir registo",
    "Correct record",
    "Corriger le compte rendu",
    "Corregir registro",
    "Datensatz korrigieren"
  ],
  "visitSaveCorrection": [
    "Guardar correção",
    "Save correction",
    "Enregistrer la correction",
    "Guardar corrección",
    "Korrektur speichern"
  ],
  "visitRefresh": [
    "Atualizar agenda",
    "Refresh schedule",
    "Actualiser le planning",
    "Actualizar agenda",
    "Terminplan aktualisieren"
  ],
  "visitHelp": [
    "Ajudar {name}",
    "Help {name}",
    "Aider {name}",
    "Ayudar a {name}",
    "{name} unterstützen"
  ],
  "visitColleague": [
    "colega",
    "colleague",
    "collègue",
    "colega",
    "Kollegen"
  ],
  "visitNextDay": [
    "Ronda do próximo dia",
    "Next day’s round",
    "Tournée du lendemain",
    "Ronda del día siguiente",
    "Tour des nächsten Tages"
  ],
  "visitCorrectionOpen": [
    "Feita / correção aberta",
    "Completed / correction open",
    "Terminée / correction ouverte",
    "Completada / corrección abierta",
    "Abgeschlossen / Korrektur offen"
  ],
  "visitExtraNotice": [
    "Visita extra: registe o trabalho, as medições, os produtos e as fotografias. Pode também registar revisões de equipamento, água aberta ou bomba em manual. Depois de concluir, use “{correction}” para rever os valores. Pode registar impedimentos e combinar o regresso com o escritório.",
    "Extra visit: record the work, measurements, products and photographs. You can also record equipment checks, running water or a pump in manual mode. After completing the visit, use “{correction}” to review the values. You can record obstacles and arrange a return with the office.",
    "Visite supplémentaire : consignez le travail, les mesures, les produits et les photos. Vous pouvez aussi consigner les contrôles d’équipement, l’eau ouverte ou une pompe en mode manuel. Après la visite, utilisez « {correction} » pour revoir les valeurs. Vous pouvez consigner les empêchements et convenir d’un retour avec le bureau.",
    "Visita extra: registra el trabajo, las mediciones, los productos y las fotografías. También puedes registrar revisiones de equipos, agua abierta o una bomba en modo manual. Después de completar la visita, usa «{correction}» para revisar los valores. Puedes registrar impedimentos y coordinar el regreso con la oficina.",
    "Zusatzbesuch: Erfassen Sie Arbeiten, Messwerte, Produkte und Fotos. Sie können auch Geräteprüfungen, laufendes Wasser oder eine Pumpe im Handbetrieb erfassen. Nutzen Sie nach Abschluss „{correction}“, um die Werte zu prüfen. Sie können Hindernisse erfassen und eine Rückkehr mit dem Büro vereinbaren."
  ],
  "visitActions": [
    "Ações principais da visita",
    "Main visit actions",
    "Actions principales de la visite",
    "Acciones principales de la visita",
    "Hauptaktionen des Besuchs"
  ],
  "visitSteps": [
    "Etapas da visita",
    "Visit steps",
    "Étapes de la visite",
    "Pasos de la visita",
    "Besuchsschritte"
  ],
  "visitAccess": [
    "Acesso",
    "Access",
    "Accès",
    "Acceso",
    "Zugang"
  ],
  "visitService": [
    "Serviço",
    "Service",
    "Service",
    "Servicio",
    "Service"
  ],
  "visitProducts": [
    "Produtos",
    "Products",
    "Produits",
    "Productos",
    "Produkte"
  ],
  "visitPhotos": [
    "Fotos",
    "Photos",
    "Photos",
    "Fotos",
    "Fotos"
  ],
  "visitLoadFailed": [
    "Não foi possível carregar",
    "Could not load",
    "Chargement impossible",
    "No se pudo cargar",
    "Laden nicht möglich"
  ],
  "visitCheckConnection": [
    "Verificar ligação",
    "Check connection",
    "Vérifier la connexion",
    "Comprobar conexión",
    "Verbindung prüfen"
  ],
  "visitLoadErrorTitle": [
    "Não foi possível atualizar a ronda",
    "Could not refresh the round",
    "Actualisation de la tournée impossible",
    "No se pudo actualizar la ronda",
    "Tour konnte nicht aktualisiert werden"
  ],
  "visitRetry": [
    "Tentar novamente",
    "Try again",
    "Réessayer",
    "Volver a intentar",
    "Erneut versuchen"
  ],
  "visitSelectedRegular": [
    "Visita feita aberta para corrigir.",
    "Completed visit opened for correction.",
    "Visite terminée ouverte pour correction.",
    "Visita completada abierta para corregir.",
    "Abgeschlossener Besuch zur Korrektur geöffnet."
  ],
  "visitSelectedExtra": [
    "Registo da visita extra concluída.",
    "Record of the completed extra visit.",
    "Compte rendu de la visite supplémentaire terminée.",
    "Registro de la visita extra completada.",
    "Datensatz des abgeschlossenen Zusatzbesuchs."
  ],
  "visitChoose": [
    "Escolha uma visita.",
    "Choose a visit.",
    "Choisissez une visite.",
    "Elige una visita.",
    "Wählen Sie einen Besuch."
  ],
  "roundChip": [
    "Piscinas do dia",
    "Today’s pools",
    "Piscines du jour",
    "Piscinas del día",
    "Pools des Tages"
  ],
  "roundTitle": [
    "Lista do dia",
    "Today’s list",
    "Liste du jour",
    "Lista del día",
    "Tagesliste"
  ],
  "roundHint": [
    "corrigir ou avançar",
    "correct or continue",
    "corriger ou continuer",
    "corregir o continuar",
    "korrigieren oder fortfahren"
  ],
  "roundFilters": [
    "Estado das piscinas",
    "Pool status",
    "État des piscines",
    "Estado de las piscinas",
    "Poolstatus"
  ],
  "roundTODO": [
    "Por fazer",
    "To do",
    "À faire",
    "Por hacer",
    "Offen"
  ],
  "roundIN_PROGRESS": [
    "Em curso",
    "In progress",
    "En cours",
    "En curso",
    "In Arbeit"
  ],
  "roundDONE": [
    "Concluídas",
    "Completed",
    "Terminées",
    "Completadas",
    "Erledigt"
  ],
  "roundEmpty": [
    "Sem piscinas neste estado.",
    "No pools with this status.",
    "Aucune piscine dans cet état.",
    "No hay piscinas en este estado.",
    "Keine Pools mit diesem Status."
  ],
  "roundNoVisits": [
    "Sem visitas",
    "No visits",
    "Aucune visite",
    "Sin visitas",
    "Keine Besuche"
  ],
  "roundNoAssigned": [
    "Não existem visitas atribuídas neste momento.",
    "No visits are assigned at the moment.",
    "Aucune visite n’est attribuée pour le moment.",
    "No hay visitas asignadas en este momento.",
    "Derzeit sind keine Besuche zugewiesen."
  ],
  "roundFreeAction": [
    "Atualiza a agenda, abre o calendário ou comunica com o administrador.",
    "Refresh the schedule, open the calendar or contact the administrator.",
    "Actualisez le planning, ouvrez le calendrier ou contactez l’administrateur.",
    "Actualiza la agenda, abre el calendario o contacta con el administrador.",
    "Terminplan aktualisieren, Kalender öffnen oder die Verwaltung kontaktieren."
  ],
  "roundTechnician": [
    "Técnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "roundDoneEdit": [
    "Feita / pode corrigir",
    "Completed / can be corrected",
    "Terminée / correction possible",
    "Completada / se puede corregir",
    "Abgeschlossen / Korrektur möglich"
  ],
  "roundPending": [
    "Pendente",
    "Pending",
    "En attente",
    "Pendiente",
    "Ausstehend"
  ],
  "roundPlanned": [
    "Planeada",
    "Planned",
    "Planifiée",
    "Planificada",
    "Geplant"
  ],
  "roundExtraStatus": [
    "Extra / {status}",
    "Extra / {status}",
    "Supplémentaire / {status}",
    "Extra / {status}",
    "Zusatzbesuch / {status}"
  ],
  "roundLocation": [
    "Local: {location}",
    "Location: {location}",
    "Lieu : {location}",
    "Lugar: {location}",
    "Ort: {location}"
  ],
  "roundLocationUnknown": [
    "Localização por confirmar",
    "Location to be confirmed",
    "Lieu à confirmer",
    "Ubicación por confirmar",
    "Ort noch zu bestätigen"
  ],
  "roundGPS": [
    "GPS: {latitude}, {longitude}",
    "GPS: {latitude}, {longitude}",
    "GPS : {latitude}, {longitude}",
    "GPS: {latitude}, {longitude}",
    "GPS: {latitude}, {longitude}"
  ],
  "roundGPSMissing": [
    "GPS por registar",
    "GPS not recorded",
    "GPS à enregistrer",
    "GPS sin registrar",
    "GPS noch nicht erfasst"
  ],
  "nowCurrent": [
    "Visita atual",
    "Current visit",
    "Visite actuelle",
    "Visita actual",
    "Aktueller Besuch"
  ],
  "nowStateTODO": [
    "Por iniciar",
    "Not started",
    "À commencer",
    "Por iniciar",
    "Noch nicht begonnen"
  ],
  "nowStateTRAVEL": [
    "A caminho",
    "On the way",
    "En route",
    "En camino",
    "Unterwegs"
  ],
  "nowStateIN_PROGRESS": [
    "Em intervenção",
    "Work in progress",
    "Intervention en cours",
    "Intervención en curso",
    "Arbeiten im Gange"
  ],
  "nowStateWATER_OPEN": [
    "Água aberta",
    "Water running",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "nowStateWAITING_MATERIAL": [
    "A aguardar material",
    "Waiting for materials",
    "En attente de matériel",
    "Esperando material",
    "Warten auf Material"
  ],
  "nowStateCRITICAL": [
    "Alerta crítico",
    "Critical alert",
    "Alerte critique",
    "Alerta crítica",
    "Kritischer Hinweis"
  ],
  "nowStateDONE": [
    "Concluída",
    "Completed",
    "Terminée",
    "Completada",
    "Abgeschlossen"
  ],
  "nowStateINCOMPLETE": [
    "Por concluir",
    "Incomplete",
    "À terminer",
    "Por completar",
    "Noch abzuschließen"
  ],
  "nowFree": [
    "Hoje está livre",
    "No visits pending today",
    "Aucune visite en attente aujourd’hui",
    "Sin visitas pendientes hoy",
    "Heute keine ausstehenden Besuche"
  ],
  "nowFreeAction": [
    "Ver agenda ou comunicar com o administrador",
    "View the schedule or contact the administrator",
    "Consulter le planning ou contacter l’administrateur",
    "Ver la agenda o contactar con el administrador",
    "Terminplan ansehen oder die Verwaltung kontaktieren"
  ],
  "nowFreeTiming": [
    "Sem intervenção ativa neste momento",
    "No active intervention at the moment",
    "Aucune intervention en cours actuellement",
    "Sin intervención activa en este momento",
    "Derzeit keine laufenden Arbeiten"
  ],
  "nowTechnician": [
    "Técnico por confirmar",
    "Technician to be confirmed",
    "Technicien à confirmer",
    "Técnico por confirmar",
    "Techniker noch zu bestätigen"
  ],
  "nowResponsible": [
    "Responsável por confirmar",
    "Responsible person to be confirmed",
    "Responsable à confirmer",
    "Responsable por confirmar",
    "Zuständige Person noch zu bestätigen"
  ],
  "nowRepair": [
    "Reparação",
    "Repair",
    "Réparation",
    "Reparación",
    "Reparatur"
  ],
  "nowMaintenance": [
    "Manutenção",
    "Maintenance",
    "Entretien",
    "Mantenimiento",
    "Wartung"
  ],
  "nowNoTime": [
    "Sem tempo em curso",
    "No timer running",
    "Aucun chronométrage en cours",
    "Sin tiempo en curso",
    "Keine laufende Zeitmessung"
  ],
  "nowElapsed": [
    "{minutes} minuto(s) em intervenção",
    "{minutes} minute(s) of work",
    "{minutes} minute(s) d’intervention",
    "{minutes} minuto(s) de intervención",
    "{minutes} Minute(n) im Einsatz"
  ],
  "chip": [
    "Interrupção operacional",
    "Operational interruption",
    "Interruption opérationnelle",
    "Interrupción operativa",
    "Betriebsunterbrechung"
  ],
  "historyTitle": [
    "Histórico de alertas",
    "Alert history",
    "Historique des alertes",
    "Historial de alertas",
    "Alarmverlauf"
  ],
  "historyIntro": [
    "Leituras registadas nesta conta, neste dispositivo e neste dia. O fecho da causa é confirmado no respetivo registo.",
    "Read acknowledgements for this account, device and day. The cause is closed in its own record.",
    "Lectures enregistrées pour ce compte, cet appareil et ce jour. La clôture de la cause est confirmée dans le dossier concerné.",
    "Lecturas registradas en esta cuenta, este dispositivo y este día. El cierre de la causa se confirma en su registro.",
    "Lesebestätigungen für dieses Konto, dieses Gerät und diesen Tag. Die Behebung der Ursache wird im zugehörigen Eintrag bestätigt."
  ],
  "historyEmpty": [
    "Sem historico local de excecoes.",
    "No local exception history.",
    "Aucun historique local des exceptions.",
    "No hay historial local de excepciones.",
    "Kein lokaler Verlauf von Ausnahmen."
  ],
  "observed": [
    "Alerta observado",
    "Alert observed",
    "Alerte observée",
    "Alerta observada",
    "Alarm wahrgenommen"
  ],
  "handlingHistory": [
    "Em tratamento local",
    "Being handled locally",
    "En cours de traitement local",
    "En tratamiento local",
    "Lokal in Bearbeitung"
  ],
  "readHistory": [
    "Leitura confirmada",
    "Read acknowledgement saved",
    "Lecture confirmée",
    "Lectura confirmada",
    "Lesebestätigung gespeichert"
  ],
  "record": [
    "Registo local",
    "Local record",
    "Enregistrement local",
    "Registro local",
    "Lokaler Eintrag"
  ],
  "exception": [
    "Excecao operacional",
    "Operational exception",
    "Exception opérationnelle",
    "Excepción operativa",
    "Betriebliche Ausnahme"
  ],
  "system": [
    "Sistema",
    "System",
    "Système",
    "Sistema",
    "System"
  ],
  "technician": [
    "Tecnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "notice": [
    "{count} alerta(s) por resolver · Ver",
    "{count} unresolved alert(s) · View",
    "{count} alerte(s) à traiter · Voir",
    "{count} alerta(s) por resolver · Ver",
    "{count} ungelöste Alarme · Anzeigen"
  ],
  "empty": [
    "Sem alertas críticos neste momento.",
    "No critical alerts at the moment.",
    "Aucune alerte critique pour le moment.",
    "No hay alertas críticas en este momento.",
    "Derzeit keine kritischen Alarme."
  ],
  "summary": [
    "Trate a causa de cada alerta no respetivo registo. Assumir ou confirmar a leitura neste dispositivo mantém o aviso visível.",
    "Address each alert’s cause in its own record. Taking responsibility or acknowledging it on this device keeps the alert visible.",
    "Traitez la cause de chaque alerte dans le dossier concerné. La prise en charge ou la confirmation de lecture sur cet appareil laisse l’alerte visible.",
    "Trate la causa de cada alerta en su registro. Asumirla o confirmar su lectura en este dispositivo mantiene el aviso visible.",
    "Bearbeiten Sie die Ursache jedes Alarms im zugehörigen Eintrag. Die Übernahme oder Lesebestätigung auf diesem Gerät lässt den Alarm sichtbar."
  ],
  "noCauses": [
    "Sem causas ativas. Histórico de leitura local disponível.",
    "No active causes. Local read history is available.",
    "Aucune cause active. L’historique local des lectures est disponible.",
    "No hay causas activas. Historial local de lectura disponible.",
    "Keine aktiven Ursachen. Der lokale Leseverlauf ist verfügbar."
  ],
  "priority": [
    "Prioridade: {priority} | Leitura local: {status}",
    "Priority: {priority} | Local read status: {status}",
    "Priorité : {priority} | Lecture locale : {status}",
    "Prioridad: {priority} | Lectura local: {status}",
    "Priorität: {priority} | Lokaler Lesestatus: {status}"
  ],
  "unread": [
    "Por ler",
    "Unread",
    "Non lue",
    "Sin leer",
    "Ungelesen"
  ],
  "handling": [
    "Em tratamento",
    "Being handled",
    "En cours de traitement",
    "En tratamiento",
    "In Bearbeitung"
  ],
  "read": [
    "Confirmada",
    "Acknowledged",
    "Confirmée",
    "Confirmada",
    "Bestätigt"
  ],
  "unconfirmed": [
    "Por confirmar",
    "Unconfirmed",
    "À confirmer",
    "Por confirmar",
    "Unbestätigt"
  ],
  "responsibility": [
    "Responsabilidade: criou {created} | recebeu {received}",
    "Responsibility: created by {created} | received by {received}",
    "Responsabilité : créée par {created} | reçue par {received}",
    "Responsabilidad: creó {created} | recibió {received}",
    "Verantwortung: erstellt von {created} | empfangen von {received}"
  ],
  "acknowledgement": [
    "Assumiu neste dispositivo: {assumed} | Confirmou leitura: {confirmed}",
    "Taken on this device by: {assumed} | Read acknowledged by: {confirmed}",
    "Prise en charge sur cet appareil : {assumed} | Lecture confirmée par : {confirmed}",
    "Asumió en este dispositivo: {assumed} | Confirmó la lectura: {confirmed}",
    "Auf diesem Gerät übernommen von: {assumed} | Lesen bestätigt von: {confirmed}"
  ],
  "pending": [
    "pendente",
    "pending",
    "en attente",
    "pendiente",
    "ausstehend"
  ],
  "elapsed": [
    "Tempo em curso: {duration}",
    "Elapsed time: {duration}",
    "Temps écoulé : {duration}",
    "Tiempo transcurrido: {duration}",
    "Verstrichene Zeit: {duration}"
  ],
  "noTime": [
    "Sem tempo em curso",
    "No elapsed time",
    "Aucun temps écoulé",
    "Sin tiempo transcurrido",
    "Keine verstrichene Zeit"
  ],
  "unavailableTime": [
    "duracao indisponivel",
    "duration unavailable",
    "durée indisponible",
    "duración no disponible",
    "Dauer nicht verfügbar"
  ],
  "minutes": [
    "{minutes} minuto(s)",
    "{minutes} minute(s)",
    "{minutes} minute(s)",
    "{minutes} minuto(s)",
    "{minutes} Minute(n)"
  ],
  "hours": [
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m"
  ],
  "resolve": [
    "Tratar causa",
    "Address cause",
    "Traiter la cause",
    "Tratar la causa",
    "Ursache bearbeiten"
  ],
  "assume": [
    "Assumir",
    "Take responsibility",
    "Prendre en charge",
    "Asumir",
    "Übernehmen"
  ],
  "confirm": [
    "Confirmar leitura",
    "Acknowledge reading",
    "Confirmer la lecture",
    "Confirmar lectura",
    "Lesen bestätigen"
  ],
  "retry": [
    "Rever histórico guardado",
    "Review saved history",
    "Revoir l’historique enregistré",
    "Revisar el historial guardado",
    "Gespeicherten Verlauf prüfen"
  ],
  "saved": [
    "Leitura guardada neste dispositivo. O alerta mantém-se até tratar a causa.",
    "Read acknowledgement saved on this device. The alert remains until its cause is addressed.",
    "Lecture enregistrée sur cet appareil. L’alerte reste visible jusqu’au traitement de sa cause.",
    "Lectura guardada en este dispositivo. La alerta se mantiene hasta tratar la causa.",
    "Lesebestätigung auf diesem Gerät gespeichert. Der Alarm bleibt bestehen, bis seine Ursache behoben ist."
  ],
  "writeFailed": [
    "O histórico não ficou guardado. {detail}",
    "The history was not saved. {detail}",
    "L’historique n’a pas été enregistré. {detail}",
    "El historial no se ha guardado. {detail}",
    "Der Verlauf wurde nicht gespeichert. {detail}"
  ],
  "changeFailed": [
    "A alteração não ficou guardada. {detail}",
    "The change was not saved. {detail}",
    "La modification n’a pas été enregistrée. {detail}",
    "El cambio no se ha guardado. {detail}",
    "Die Änderung wurde nicht gespeichert. {detail}"
  ],
  "pumpInstruction": [
    "Confirme o modo automático no registo da bomba. A leitura do alerta não fecha o lembrete.",
    "Confirm automatic mode in the pump record. Acknowledging the alert does not close the reminder.",
    "Confirmez le mode automatique dans le dossier de la pompe. La lecture de l’alerte ne clôture pas le rappel.",
    "Confirme el modo automático en el registro de la bomba. Leer la alerta no cierra el recordatorio.",
    "Bestätigen Sie den Automatikbetrieb im Pumpeneintrag. Die Lesebestätigung des Alarms schließt die Erinnerung nicht."
  ],
  "historyMeta": [
    "{date} | {actor}",
    "{date} | {actor}",
    "{date} | {actor}",
    "{date} | {actor}",
    "{date} | {actor}"
  ],
  "warnings": [
    "{read} {write}",
    "{read} {write}",
    "{read} {write}",
    "{read} {write}",
    "{read} {write}"
  ],
  "sourcePumpTitle": [
    "P0 - Bomba em manual",
    "P0 - Pump in manual mode",
    "P0 - Pompe en mode manuel",
    "P0 - Bomba en modo manual",
    "P0 - Pumpe im Handbetrieb"
  ],
  "sourcePumpSignal": [
    "Quem ativou: {who} | Piscina: {pool} | Duração: {duration} | Estado: {status}",
    "Activated by: {who} | Pool: {pool} | Duration: {duration} | Status: {status}",
    "Activée par : {who} | Piscine : {pool} | Durée : {duration} | État : {status}",
    "Activó: {who} | Piscina: {pool} | Duración: {duration} | Estado: {status}",
    "Aktiviert von: {who} | Pool: {pool} | Dauer: {duration} | Status: {status}"
  ],
  "sourceActivatorUnknown": [
    "por confirmar",
    "to be confirmed",
    "à confirmer",
    "por confirmar",
    "noch zu bestätigen"
  ],
  "sourcePoolUnknown": [
    "Piscina por confirmar",
    "Pool to be confirmed",
    "Piscine à confirmer",
    "Piscina por confirmar",
    "Pool noch zu bestätigen"
  ],
  "sourcePumpReminder": [
    "{pool} | {client} | Confirmar modo automático até {when}",
    "{pool} | {client} | Confirm automatic mode by {when}",
    "{pool} | {client} | Confirmer le mode automatique avant {when}",
    "{pool} | {client} | Confirmar el modo automático antes de {when}",
    "{pool} | {client} | Automatikbetrieb bis {when} bestätigen"
  ],
  "sourcePool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ],
  "sourceClient": [
    "Cliente",
    "Client",
    "Client",
    "Cliente",
    "Kunde"
  ],
  "sourceUnavailableTitle": [
    "P0 - Água e bombas por confirmar",
    "P0 - Water and pumps need confirmation",
    "P0 - Eau et pompes à confirmer",
    "P0 - Agua y bombas por confirmar",
    "P0 - Wasser und Pumpen noch zu bestätigen"
  ],
  "sourceCriticalTitle": [
    "P0 - Problema critico",
    "P0 - Critical problem",
    "P0 - Problème critique",
    "P0 - Problema crítico",
    "P0 - Kritisches Problem"
  ],
  "sourceCriticalDetail": [
    "{count} problema(s) critico(s) pendente(s).",
    "{count} critical problem(s) pending.",
    "{count} problème(s) critique(s) en attente.",
    "{count} problema(s) crítico(s) pendiente(s).",
    "{count} kritische Probleme ausstehend."
  ],
  "sourceDelayedTitle": [
    "P1 - Visita atrasada",
    "P1 - Delayed visit",
    "P1 - Visite en retard",
    "P1 - Visita atrasada",
    "P1 - Verspäteter Besuch"
  ],
  "sourceDelayedDetail": [
    "{pool} com atraso face ao planeado.",
    "{pool} is behind schedule.",
    "{pool} est en retard sur le planning.",
    "{pool} lleva retraso respecto a lo previsto.",
    "{pool} liegt hinter dem Zeitplan."
  ],
  "sourceDocsTitle": [
    "P1 - Documento obrigatorio em falta",
    "P1 - Required document missing",
    "P1 - Document obligatoire manquant",
    "P1 - Falta un documento obligatorio",
    "P1 - Erforderliches Dokument fehlt"
  ],
  "sourceDocsFallback": [
    "Documentacao da viatura incompleta para operacao segura.",
    "Vehicle documentation is incomplete for safe operation.",
    "Les documents du véhicule sont incomplets pour une utilisation sûre.",
    "La documentación del vehículo está incompleta para operar con seguridad.",
    "Die Fahrzeugunterlagen sind für einen sicheren Betrieb unvollständig."
  ],
  "sourceDocsReason": [
    "Bloqueio documental - {blockers}",
    "Document restriction - {blockers}",
    "Blocage documentaire - {blockers}",
    "Bloqueo documental - {blockers}",
    "Dokumentensperre - {blockers}"
  ],
  "sourceDocBlocker": [
    "{name}: {state}",
    "{name}: {state}",
    "{name} : {state}",
    "{name}: {state}",
    "{name}: {state}"
  ],
  "sourceDocTransport": [
    "Guia AT",
    "AT transport document",
    "Document de transport AT",
    "Documento de transporte AT",
    "AT-Transportdokument"
  ],
  "sourceDocWork": [
    "Guia de obra",
    "Work document",
    "Document de travail",
    "Documento de trabajo",
    "Arbeitsdokument"
  ],
  "sourceDocInsurance": [
    "Seguro",
    "Insurance",
    "Assurance",
    "Seguro",
    "Versicherung"
  ],
  "sourceDocInspection": [
    "Inspeção",
    "Inspection",
    "Contrôle technique",
    "Inspección",
    "Fahrzeugprüfung"
  ],
  "sourceDocUnavailable": [
    "Indisponível",
    "Unavailable",
    "Indisponible",
    "No disponible",
    "Nicht verfügbar"
  ],
  "sourceDocExpired": [
    "Expirado",
    "Expired",
    "Expiré",
    "Caducado",
    "Abgelaufen"
  ],
  "sourceDocPending": [
    "Pendente",
    "Pending",
    "En attente",
    "Pendiente",
    "Ausstehend"
  ],
  "sourceDocValid": [
    "Válido",
    "Valid",
    "Valide",
    "Válido",
    "Gültig"
  ],
  "sourceDocConfirm": [
    "Documentos por confirmar para a sessão, viatura e dia atuais",
    "Documents need confirmation for the current session, vehicle and day",
    "Documents à confirmer pour la session, le véhicule et le jour actuels",
    "Documentos por confirmar para la sesión, el vehículo y el día actuales",
    "Dokumente für die aktuelle Sitzung, das Fahrzeug und den Tag noch zu bestätigen"
  ],
  "sourceDocMismatch": [
    "As guias AT e de obra não correspondem. Atualize os documentos.",
    "The AT transport and work documents do not match. Refresh the documents.",
    "Les documents de transport AT et de travail ne correspondent pas. Actualisez les documents.",
    "Los documentos de transporte AT y de trabajo no coinciden. Actualice los documentos.",
    "AT-Transportdokument und Arbeitsdokument stimmen nicht überein. Aktualisieren Sie die Dokumente."
  ],
  "dashSummary": [
    "Resumo do dia em campo",
    "Field day summary",
    "Résumé de la journée sur le terrain",
    "Resumen de la jornada en campo",
    "Übersicht des Arbeitstags vor Ort"
  ],
  "dashToday": [
    "Hoje",
    "Today",
    "Aujourd’hui",
    "Hoy",
    "Heute"
  ],
  "dashPreparing": [
    "A preparar ronda",
    "Preparing the route",
    "Préparation de la tournée",
    "Preparando la ruta",
    "Route wird vorbereitet"
  ],
  "dashInitial": [
    "Serviço atual e cliente aparecem aqui.",
    "The current service and client appear here.",
    "Le service et le client actuels s’affichent ici.",
    "El servicio y el cliente actuales aparecen aquí.",
    "Der aktuelle Auftrag und Kunde werden hier angezeigt."
  ],
  "dashProgress": [
    "Progresso",
    "Progress",
    "Progression",
    "Progreso",
    "Fortschritt"
  ],
  "dashProgressInitial": [
    "visitas feitas / total",
    "visits completed / total",
    "visites effectuées / total",
    "visitas realizadas / total",
    "erledigte Besuche / gesamt"
  ],
  "dashDocuments": [
    "Documentos",
    "Documents",
    "Documents",
    "Documentos",
    "Dokumente"
  ],
  "dashCheck": [
    "Verificar",
    "Check",
    "Vérifier",
    "Comprobar",
    "Prüfen"
  ],
  "dashDocsInitial": [
    "guia, AT e seguro",
    "work document, AT and insurance",
    "document de travail, AT et assurance",
    "documento de trabajo, AT y seguro",
    "Arbeitsdokument, AT und Versicherung"
  ],
  "dashSubmissions": [
    "Envios",
    "Submissions",
    "Envois",
    "Envíos",
    "Übermittlungen"
  ],
  "dashPhotosInitial": [
    "0 fotos",
    "0 photos",
    "0 photos",
    "0 fotos",
    "0 Fotos"
  ],
  "dashSubmissionInitial": [
    "fotos e notas da visita",
    "visit photos and notes",
    "photos et notes de la visite",
    "fotos y notas de la visita",
    "Fotos und Notizen zum Besuch"
  ],
  "dashPriority": [
    "Prioridade P0",
    "Priority P0",
    "Priorité P0",
    "Prioridad P0",
    "Priorität P0"
  ],
  "dashGreeting": [
    "Bom dia, {name}",
    "Good morning, {name}",
    "Bonjour, {name}",
    "Buenos días, {name}",
    "Guten Morgen, {name}"
  ],
  "dashTechnician": [
    "Técnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "dashWater": [
    "Água aberta",
    "Water running",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "dashPump": [
    "Bomba em manual",
    "Pump in manual mode",
    "Pompe en mode manuel",
    "Bomba en modo manual",
    "Pumpe im Handbetrieb"
  ],
  "dashUnknown": [
    "Água e bombas por confirmar",
    "Water and pumps need confirmation",
    "Eau et pompes à confirmer",
    "Agua y bombas por confirmar",
    "Wasser und Pumpen noch zu bestätigen"
  ],
  "dashCritical": [
    "Alerta crítico",
    "Critical alert",
    "Alerte critique",
    "Alerta crítica",
    "Kritischer Alarm"
  ],
  "dashWaterActive": [
    "Água aberta ativa",
    "Water is still running",
    "L’eau est toujours ouverte",
    "El agua sigue abierta",
    "Wasser läuft weiterhin"
  ],
  "dashAlerts": [
    "Há alertas ativos",
    "There are active alerts",
    "Des alertes sont actives",
    "Hay alertas activas",
    "Es gibt aktive Alarme"
  ],
  "dashFree": [
    "Hoje está livre",
    "No visits today",
    "Aucune visite aujourd’hui",
    "Sin visitas hoy",
    "Heute keine Besuche"
  ],
  "dashCriticalMeta": [
    "Alerta crítico ativo. Trate primeiro e só depois continue a ronda.",
    "A critical alert is active. Deal with it before continuing the route.",
    "Une alerte critique est active. Traitez-la avant de poursuivre la tournée.",
    "Hay una alerta crítica activa. Atiéndala antes de continuar la ruta.",
    "Ein kritischer Alarm ist aktiv. Beheben Sie ihn, bevor Sie die Route fortsetzen."
  ],
  "dashLocation": [
    "local por confirmar",
    "location to be confirmed",
    "lieu à confirmer",
    "ubicación por confirmar",
    "Ort noch zu bestätigen"
  ],
  "dashVisitMeta": [
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}"
  ],
  "dashPoolOne": [
    "{count} piscina",
    "{count} pool",
    "{count} piscine",
    "{count} piscina",
    "{count} Pool"
  ],
  "dashPoolMany": [
    "{count} piscinas",
    "{count} pools",
    "{count} piscines",
    "{count} piscinas",
    "{count} Pools"
  ],
  "dashAlertOne": [
    "{count} alerta",
    "{count} alert",
    "{count} alerte",
    "{count} alerta",
    "{count} Alarm"
  ],
  "dashAlertMany": [
    "{count} alertas",
    "{count} alerts",
    "{count} alertes",
    "{count} alertas",
    "{count} Alarme"
  ],
  "dashWaterCount": [
    "{count} água aberta",
    "{count} running-water alert",
    "{count} alerte d’eau ouverte",
    "{count} alerta de agua abierta",
    "{count} Alarm wegen laufenden Wassers"
  ],
  "dashPumpCount": [
    "{count} bomba manual",
    "{count} manual-pump alert",
    "{count} alerte de pompe en manuel",
    "{count} alerta de bomba en manual",
    "{count} Alarm wegen einer Pumpe im Handbetrieb"
  ],
  "dashFreeMeta": [
    "Não tens visitas atribuídas neste momento. {stats}.",
    "You have no assigned visits at the moment. {stats}.",
    "Aucune visite ne vous est attribuée actuellement. {stats}.",
    "No tiene visitas asignadas en este momento. {stats}.",
    "Ihnen sind derzeit keine Besuche zugewiesen. {stats}."
  ],
  "dashPendingVisits": [
    "{count} visita(s) por concluir",
    "{count} visit(s) to complete",
    "{count} visite(s) à terminer",
    "{count} visita(s) por completar",
    "{count} Besuche noch abzuschließen"
  ],
  "dashRoundReady": [
    "Ronda pronta para fechar",
    "Route ready to close",
    "Tournée prête à clôturer",
    "Ruta lista para cerrar",
    "Route kann abgeschlossen werden"
  ],
  "dashScheduleFree": [
    "Agenda livre neste momento",
    "No visits scheduled at the moment",
    "Aucune visite prévue actuellement",
    "Sin visitas programadas en este momento",
    "Derzeit keine Besuche geplant"
  ],
  "dashValidating": [
    "A validar",
    "Validating",
    "Validation en cours",
    "Validando",
    "Wird geprüft"
  ],
  "dashValid": [
    "Válidos",
    "Valid",
    "Valides",
    "Válidos",
    "Gültig"
  ],
  "dashReview": [
    "Rever",
    "Review",
    "À vérifier",
    "Revisar",
    "Prüfen"
  ],
  "dashVehicleConfirm": [
    "A confirmar a viatura",
    "Confirming the vehicle",
    "Confirmation du véhicule",
    "Confirmando el vehículo",
    "Fahrzeug wird bestätigt"
  ],
  "dashDocsConfirmed": [
    "Obrigatórios confirmados",
    "Required documents confirmed",
    "Documents obligatoires confirmés",
    "Documentos obligatorios confirmados",
    "Pflichtdokumente bestätigt"
  ],
  "dashDocsCached": [
    "Cópia de hoje por confirmar",
    "Today’s copy needs confirmation",
    "Copie du jour à confirmer",
    "Copia de hoy por confirmar",
    "Heutige Kopie noch zu bestätigen"
  ],
  "dashDocsMissing": [
    "Abra Viatura para ver o que falta",
    "Open Vehicle to see what is missing",
    "Ouvrez Véhicule pour voir ce qui manque",
    "Abra Vehículo para ver qué falta",
    "Öffnen Sie Fahrzeug, um fehlende Dokumente zu sehen"
  ],
  "dashCheckingSubmissions": [
    "A verificar envios guardados",
    "Checking saved submissions",
    "Vérification des envois enregistrés",
    "Comprobando envíos guardados",
    "Gespeicherte Übermittlungen werden geprüft"
  ],
  "dashVisitPending": [
    "visita por confirmar",
    "visit awaiting confirmation",
    "visite en attente de confirmation",
    "visita pendiente de confirmación",
    "Besuch wartet auf Bestätigung"
  ],
  "dashPhotosPending": [
    "fotos por enviar",
    "photos awaiting upload",
    "photos à envoyer",
    "fotos pendientes de envío",
    "Fotos warten auf Übermittlung"
  ],
  "dashPendingSubmissions": [
    "envios pendentes nesta visita",
    "pending submissions for this visit",
    "envois en attente pour cette visite",
    "envíos pendientes de esta visita",
    "ausstehende Übermittlungen für diesen Besuch"
  ],
  "dashSubmissionsUnknown": [
    "Envios por verificar; preserve os dados",
    "Submissions need checking; preserve the data",
    "Envois à vérifier ; conservez les données",
    "Envíos por comprobar; conserve los datos",
    "Übermittlungen müssen geprüft werden; bewahren Sie die Daten auf"
  ],
  "dashTreat": [
    "Tratar alerta",
    "Address alert",
    "Traiter l’alerte",
    "Atender alerta",
    "Alarm bearbeiten"
  ],
  "dashContinue": [
    "Continuar",
    "Continue",
    "Continuer",
    "Continuar",
    "Fortsetzen"
  ],
  "dashContact": [
    "Comunicar",
    "Contact",
    "Communiquer",
    "Contactar",
    "Kontakt aufnehmen"
  ],
  "dashRefresh": [
    "Atualizar",
    "Refresh",
    "Actualiser",
    "Actualizar",
    "Aktualisieren"
  ],
  "dashAgenda": [
    "Ver agenda",
    "View schedule",
    "Voir le planning",
    "Ver agenda",
    "Terminplan anzeigen"
  ],
  "dashExtra": [
    "Consultar visita extra",
    "View extra visit",
    "Consulter la visite supplémentaire",
    "Consultar visita extra",
    "Zusatzbesuch ansehen"
  ],
  "dashNavigate": [
    "Navegar",
    "Navigate",
    "Itinéraire",
    "Navegar",
    "Navigieren"
  ],
  "dashOpen": [
    "Abrir visita",
    "Open visit",
    "Ouvrir la visite",
    "Abrir visita",
    "Besuch öffnen"
  ]
};
    const specs = new WeakSet(), bindings = new Map(), reminderSpecs = new WeakMap(), errorCopies = new WeakMap(), delegatedCopies = new WeakMap(), documentDates = new WeakMap();
    function value(key, params = {}) { const entry = Object.freeze({ key, params: Object.freeze({ ...params }) }); specs.add(entry); return entry; }
    function join(parts, separator = ' | ') { const entry = Object.freeze({ parts: Object.freeze([...parts]), separator }); specs.add(entry); return entry; }
    function reminder(value) { const entry = Object.freeze({}); reminderSpecs.set(entry, value); return entry; }
    // Only errors created here own translated presentation; original Error.message stays literal.
    function error(message, entry) { const failure = Error(message); errorCopies.set(failure, entry); return failure; }
    function delegated(source, entry) { const value = Object.freeze({}); delegatedCopies.set(value, { source, entry }); return value; }
    function documentDate(raw) { const entry = Object.freeze({}); documentDates.set(entry, String(raw ?? '')); return entry; }
    function documentWarning(result) { const source = window.CWFieldDocuments.presentation; return delegated(source, source.warning(result) ?? result.warning); }
    function draftStatus(node) { const source = window.CWFieldVisitDrafts.presentation; return delegated(source, source.copy(node)); }
    function failure(error, fallback = '') {
      if (errorCopies.has(error)) return errorCopies.get(error);
      for (const source of [window.CWFieldVisitDrafts?.presentation, window.CWVisitProductIdentity?.presentation, window.CWFieldDocuments?.presentation]) {
        const entry = source?.error(error); if (entry) return delegated(source, entry);
      }
      return error?.message || fallback;
    }
    function format(entry, language = document.documentElement.lang || 'pt') {
      const delegated = delegatedCopies.get(entry); if (delegated) return delegated.source.format(delegated.entry, language);
      if (documentDates.has(entry)) return window.CWFieldDocumentCopy.date(documentDates.get(entry), language);
      if (reminderSpecs.has(entry)) return window.CWFieldReminders.presentation.format(reminderSpecs.get(entry), language);
      if (!specs.has(entry)) return window.CWFieldAlertJournal?.presentation?.format(entry, language) ?? String(entry ?? '');
      if (entry.parts) return entry.parts.map(part => format(part, language)).join(entry.separator);
      const index = Math.max(0, languages.indexOf(String(language).toLowerCase().split('-')[0]));
      return copy[entry.key][index].replace(/\{(\w+)\}/g, (_, key) => format(entry.params[key], language));
    }
    function clear(node) { const old = bindings.get(node); if (!old) return; bindings.delete(node); node.removeAttribute('data-cw-alert-copy'); if (!old.protected) node.removeAttribute('data-cw-no-i18n'); }
    function clearTree(root) { for (const node of bindings.keys()) if (!node.isConnected || node === root || root.contains(node)) clear(node); }
    function bind(node, entry) {
      if (!node) return;
      const previous = bindings.get(node), rendered = format(entry), protectedNode = previous ? previous.protected : node.hasAttribute('data-cw-no-i18n');
      node.setAttribute('data-cw-alert-copy', ''); node.setAttribute('data-cw-no-i18n', '');
      if (node.textContent !== rendered) node.textContent = rendered;
      bindings.set(node, { entry, rendered, protected: protectedNode, textNode: node.firstChild });
    }
    function paint() {
      for (const [node, item] of bindings) {
        if (!node.isConnected || node.textContent !== item.rendered || node.firstChild !== item.textNode) { clear(node); continue; }
        bind(node, item.entry);
      }
    }
    function notify(entry) { toast(format(entry)); bind($('#toast'), entry); }
    window.addEventListener('cw-language-change', paint);
    let lastLanguage = document.documentElement.lang;
    new MutationObserver(() => { const language = document.documentElement.lang; if (language !== lastLanguage) { lastLanguage = language; paint(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return { value, join, reminder, error, failure, draftStatus, documentDate, documentWarning, format, bind, clear, clearTree, notify };
  })();

  for (const node of document.querySelectorAll('[data-dashboard-copy]')) alertUi.bind(node, alertUi.value(node.dataset.dashboardCopy));
  for (const node of document.querySelectorAll('[data-now-copy]')) alertUi.bind(node, alertUi.value(node.dataset.nowCopy));
  for (const node of document.querySelectorAll('[data-round-copy]')) alertUi.bind(node, alertUi.value(node.dataset.roundCopy));
  for (const node of document.querySelectorAll('[data-visit-copy]')) alertUi.bind(node, alertUi.value(node.dataset.visitCopy));
  for (const node of document.querySelectorAll('[data-crew-copy]')) alertUi.bind(node, alertUi.value(node.dataset.crewCopy));
  for (const node of document.querySelectorAll('[data-center-initial-copy]')) alertUi.bind(node, alertUi.value(node.dataset.centerInitialCopy));

  let visits = [];
  let routeConfirmedAt = null;
  window.CWFieldDaySnapshot = () => ({
    confirmedAt: sameFieldSession() && window.CWFieldRouteCache.same(routeContext) ? routeConfirmedAt : null,
    visits: sameFieldSession() && window.CWFieldRouteCache.same(routeContext) ? visits.map(visit => ({ id: visit.id, visitType: visit.visitType || 'REGULAR', name: visit.pool?.name || `Visita ${visit.id}`, done: isVisitDone(visit), future: visit.assistSource === 'tomorrow' })) : [],
  });
  let index = 0;
  let startedAt = null;
  let pendingProblems = [];
  let selectedPhotoType = "AFTER";
  const fieldWriteSession = window.CWFieldWriteStore?.session();
  let routeRevision = 0, routeContext = null, routeSnapshot = null, routeSessionBlocked = false;
  let fieldWriteGeneration = 0, selectedPhotoContext = null;
  let fieldPendingRevision = 0;
  window.addEventListener('pagehide', () => { ++fieldWriteGeneration; ++routeRevision; });
  const sameFieldSession = () => window.CWFieldWriteStore?.same(fieldWriteSession);
  const startingVisits = new Set();
  const extraVisitNotice = alertUi.value('visitExtraNotice', { correction: alertUi.value('visitCorrect') });
  window.CWFieldVisitContext = () => sameFieldSession() && current() ? { id:current().id, visitType:current().visitType || 'REGULAR', poolId:current().poolId || current().pool?.id, clientId:current().clientId || current().client?.id || current().pool?.clientId, poolName:current().pool?.name, clientName:current().client?.name, technicianName:activeTechnician?.name || current().technician?.name } : null;
  let visitPhotos = [];
  let currentDraftEntry = null;
  const visitDraftManager = window.CWFieldVisitDrafts.create(fieldWriteSession, { changed(entry, fill) {
    if (!sameFieldSession() || entry !== currentDraftEntry) return;
    if (fill) { const draft=visitDraftManager.expand(entry); applyVisitForm(draft); visitPhotos=(draft.photos || []).map(photo=>({...photo,visitId:entry.id,visitType:entry.type}));visitPhotosByKey[entry.key]=visitPhotos;renderPhotoList(); }
    visitDraftManager.paint(entry);
  } });
  window.CWFieldDraftSummary = () => visitDraftManager.pendingSummary();
  let visitPhotosByKey = {};
  let waterReminders = [];
  let waterRemindersError = '';
  let waterRemindersErrorCopy = '';
  let usedProducts = [];
  let productCatalogue = null;
  let activeWorkGuide = null;
  let activeWorkStock = [];
  let activeTransportGuide = null;
  let activeInsurance = null;
  let activeVehicle = null;
  let activeTechnician = null;
  let technicalProposals = [];
  let docsSource = "live";
  let docsContext = null, docsRevision = 0, docsDetail = '', docsWarning = '';
  let docsDetailCopy = '', docsWarningCopy = '';
  let docsCompliance = null;
  let documentsLoaded = false;
  let assistOptions = { loading: false, loadedKey: "", otherToday: [], tomorrow: [], error: "" };
  let notifiedVisitNoticeKey = "";
  let activePoolFilter = "TODO";
  let opsSnapshot = { docsReady: false, done: 0, total: 0, pending: 0 };
  const waterTimers = new Map();
  const draftFieldIds = ["ph", "chlorine", "alkalinity", "salt", "orp", "temperature", "notes"];
  const checkIds = ["cleaned", "vacuumed", "basketCleaned", "brushed", "waterlineClean", "backwashDone"];

  const POOL_STATE = {
    TODO: "Por iniciar",
    TRAVEL: "A caminho",
    IN_PROGRESS: "Em intervenção",
    WATER_OPEN: "Água aberta",
    WAITING_MATERIAL: "A aguardar material",
    CRITICAL: "Alerta crítico",
    DONE: "Concluída",
    INCOMPLETE: "Por concluir",
  };

  const MAP_ROUTE_PATH = "/technician-map";
  const FIELD_RETURN_CONTRACT_KEY = "cw:tech-field:return-contract:v1";
  const FIELD_UI_STATE_KEY = "cw:tech-field:ui-state:v1";
  const FIELD_LAST_EXPLICIT_FILTER_KEY = "cw:tech-field:last-explicit-filter:v1";
  let opJournalReadWarning = '', opJournalWriteWarning = '', opJournalBusy = false, pumpRemindersError = '';
  let opJournalReadCopy = '', opJournalWriteCopy = '';
  const alertHistoryCopy = new Map();
  const alertSourceCopies = new WeakMap(), pumpSourceCopies = new WeakMap(), documentSourceCopies = new WeakMap();
  let docsBlockReasonCopy = '', pumpRemindersErrorCopy = '';
  function withAlertSource(item, title, detail) { alertSourceCopies.set(item, { title: alertUi.value(title), detail }); return item; }
  const opJournalAttempts = new Set();

  function safeSessionRead(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeSessionWrite(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function safeSessionDelete(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (_) {}
  }

  function normalizePoolFilter(value, fallback = "TODO") {
    const safe = String(value || "").toUpperCase();
    if (["TODO", "IN_PROGRESS", "DONE"].includes(safe)) return safe;
    return fallback;
  }

  function normalizeFieldTab(value, fallback = "hoje") {
    const safe = String(value || "").toLowerCase();
    if (["hoje", "agora", "docs", "more", "mapa"].includes(safe)) return safe;
    return fallback;
  }

  function readDomActivePoolFilter(fallback = "TODO") {
    return normalizePoolFilter(
      document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter,
      fallback
    );
  }

  function currentFieldTab() {
    return normalizeFieldTab(document.body?.dataset?.fieldTab || "hoje", "hoje");
  }

  function selectedVisitId() {
    return current()?.id ? String(current().id) : "";
  }

  function selectedVisitTitle() {
    return current()?.pool?.name || "";
  }

  function persistFieldUiState() {
    const safeActiveFilter = readDomActivePoolFilter(activePoolFilter || "TODO");
    activePoolFilter = normalizePoolFilter(safeActiveFilter, "TODO");
    const payload = {
      activeTab: normalizeFieldTab(currentFieldTab(), "hoje"),
      activeFilter: activePoolFilter,
      selectedVisitId: selectedVisitId(),
      selectedVisitType: current()?.visitType || 'REGULAR',
      selectedVisitTitle: selectedVisitTitle(),
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
      savedAt: new Date().toISOString(),
    };
    storageWrite(FIELD_UI_STATE_KEY, payload);
    try {
      localStorage.setItem("cwFieldActivePoolFilter", payload.activeFilter);
    } catch (_) {}
  }

  function readFieldUiState() {
    const saved = storageRead(FIELD_UI_STATE_KEY, null);
    if (!saved || typeof saved !== "object") return null;
    return {
      activeTab: normalizeFieldTab(saved.activeTab, "hoje"),
      activeFilter: normalizePoolFilter(saved.activeFilter, "TODO"),
      selectedVisitId: String(saved.selectedVisitId || ""),
      selectedVisitType: saved.selectedVisitType || '',
      selectedVisitTitle: String(saved.selectedVisitTitle || ""),
      scrollY: Number.isFinite(Number(saved.scrollY)) ? Math.max(0, Number(saved.scrollY)) : 0,
    };
  }

  function readLastExplicitFilter() {
    try {
      const raw = String(localStorage.getItem(FIELD_LAST_EXPLICIT_FILTER_KEY) || "").trim();
      if (!raw) return "";
      return normalizePoolFilter(raw, "");
    } catch (_) {
      return "";
    }
  }

  function writeLastExplicitFilter(filter) {
    const safe = normalizePoolFilter(filter, "");
    if (!safe) return;
    try {
      localStorage.setItem(FIELD_LAST_EXPLICIT_FILTER_KEY, safe);
    } catch (_) {}
  }

  function buildMapReturnContract() {
    const domActiveFilter = readDomActivePoolFilter(activePoolFilter || "TODO");
    return {
      returnTo: `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`,
      activeTab: normalizeFieldTab(currentFieldTab(), "hoje"),
      activeFilter: normalizePoolFilter(domActiveFilter || activePoolFilter, "TODO"),
      selectedVisitId: selectedVisitId(),
      selectedVisitType: current()?.visitType || 'REGULAR',
      selectedVisitTitle: selectedVisitTitle(),
      activeInterventionVisitId: String(visits.find((visit) => hasActiveIntervention(visit))?.id || ""),
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
      createdAt: new Date().toISOString(),
      source: "technician-field-mode",
    };
  }

  function persistMapReturnContract(contract) {
    if (!contract) return;
    safeSessionWrite(FIELD_RETURN_CONTRACT_KEY, contract);
  }

  function sanitizeReturnToPath(raw) {
    const fallback = "/technician-field-mode";
    const text = String(raw || "").trim();
    if (!text.startsWith("/")) return fallback;
    if (!text.startsWith("/technician-field-mode")) return fallback;
    return text;
  }

  function buildMapRouteFromContract(contract) {
    const params = new URLSearchParams();
    params.set("returnTo", sanitizeReturnToPath(contract.returnTo));
    params.set("activeTab", normalizeFieldTab(contract.activeTab, "hoje"));
    params.set("activeFilter", normalizePoolFilter(contract.activeFilter, "TODO"));
    if (contract.selectedVisitId) params.set("selectedVisitId", String(contract.selectedVisitId));
    if (contract.selectedVisitType) params.set("selectedVisitType", contract.selectedVisitType);
    if (Number.isFinite(Number(contract.scrollY))) params.set("scrollY", String(Math.max(0, Number(contract.scrollY))));
    return `${MAP_ROUTE_PATH}?${params.toString()}`;
  }

  function readReturnContractFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const selectedVisit = params.get("selectedVisitId");
      const activeTab = params.get("activeTab");
      const activeFilter = params.get("activeFilter");
      const returnTo = params.get("returnTo");
      const scrollY = Number(params.get("scrollY"));

      if (!activeTab && !activeFilter && !selectedVisit) return null;
      if (returnTo && !sanitizeReturnToPath(returnTo).startsWith("/technician-field-mode")) return null;

      return {
        returnTo: sanitizeReturnToPath(returnTo || "/technician-field-mode"),
        activeTab: normalizeFieldTab(activeTab, "hoje"),
        activeFilter: normalizePoolFilter(activeFilter, "TODO"),
        selectedVisitId: String(selectedVisit || ""),
        selectedVisitType: params.get('selectedVisitType') || '',
        activeInterventionVisitId: "",
        scrollY: Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0,
        source: "url",
      };
    } catch (_) {
      return null;
    }
  }

  function readReturnContract() {
    const sessionContract = safeSessionRead(FIELD_RETURN_CONTRACT_KEY, null);
    if (sessionContract && sanitizeReturnToPath(sessionContract.returnTo).startsWith("/technician-field-mode")) {
      const returned = readReturnContractFromUrl();
      return {
        returnTo: sanitizeReturnToPath(sessionContract.returnTo),
        activeTab: normalizeFieldTab(sessionContract.activeTab, "hoje"),
        activeFilter: normalizePoolFilter(sessionContract.activeFilter, "TODO"),
        selectedVisitId: returned?.selectedVisitId || String(sessionContract.selectedVisitId || ""),
        selectedVisitType: returned?.selectedVisitId ? returned.selectedVisitType : sessionContract.selectedVisitType || '',
        selectedVisitTitle: String(sessionContract.selectedVisitTitle || ""),
        activeInterventionVisitId: String(sessionContract.activeInterventionVisitId || ""),
        scrollY: Number.isFinite(Number(sessionContract.scrollY)) ? Math.max(0, Number(sessionContract.scrollY)) : 0,
        source: "session",
      };
    }

    return readReturnContractFromUrl();
  }

  function clearReturnContract() {
    safeSessionDelete(FIELD_RETURN_CONTRACT_KEY);
  }

  function stripReturnParamsFromUrl() {
    try {
      const url = new URL(window.location.href);
      const keys = ["returnTo", "activeTab", "activeFilter", "selectedVisitId", "selectedVisitType", "scrollY"];
      const hadAny = keys.some((key) => url.searchParams.has(key));
      keys.forEach((key) => url.searchParams.delete(key));
      if (hadAny) {
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, "", next);
      }
    } catch (_) {}
  }

  function applyVisitSelectionFromId(visitId, visitType) {
    const wanted = String(visitId || "");
    if (!wanted) return false;
    const matches = visits.map((visit,position)=>({visit,position})).filter(({visit})=>String(visit.id || '')===wanted && (!visitType || (visit.visitType || 'REGULAR')===visitType));
    if (matches.length !== 1) return false;
    index = matches[0].position;
    return true;
  }

  function applyReturnState(contract, fallbackState) {
    const fallbackFilter = normalizePoolFilter(fallbackState?.activeFilter || "", "");
    const explicitFilter = normalizePoolFilter(readLastExplicitFilter(), "");
    const preferredFilter = normalizePoolFilter(
      contract?.activeFilter
        || (fallbackFilter && fallbackFilter !== "TODO" ? fallbackFilter : "")
        || explicitFilter
        || fallbackFilter
        || "TODO",
      "TODO"
    );
    activePoolFilter = preferredFilter;

    const restoredVisit = applyVisitSelectionFromId(contract?.selectedVisitId, contract?.selectedVisitType)
      || applyVisitSelectionFromId(contract?.activeInterventionVisitId)
      || applyVisitSelectionFromId(fallbackState?.selectedVisitId, fallbackState?.selectedVisitType);

    if (!restoredVisit) {
      index = visits.findIndex((visit) => !isVisitDone(visit));
      if (index < 0) index = visits.length;
    }
  }

  function elapsedMinutesLabel(startAt) {
    if (!startAt) return "Sem tempo em curso";
    const date = new Date(startAt);
    if (Number.isNaN(date.getTime())) return "Sem tempo em curso";
    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    return `${diffMinutes} minuto(s) em intervenção`;
  }

  function elapsedMinutesCopy(startAt) {
    if (!startAt) return alertUi.value('nowNoTime');
    const date = new Date(startAt);
    if (Number.isNaN(date.getTime())) return alertUi.value('nowNoTime');
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    return alertUi.value('nowElapsed', { minutes });
  }

  function visitHasWaterOpen(visit) {
    if (!visit) return false;
    const visitId = String(visit.id || "");
    const poolId = String(visit.pool?.id || visit.poolId || "");
    return activeWaterReminders().some((reminder) => {
      if (reminder.status === "CLOSED") return false;
      if ((visit.visitType || "REGULAR") === (reminder.visitType || "REGULAR") && visitId && String(reminder.visitId || "") === visitId) return true;
      if (poolId && String(reminder.poolId || "") === poolId) return true;
      return false;
    });
  }

  function visitHasCriticalProblem(visit) {
    const text = `${visit?.status || ""} ${visit?.notes || ""} ${visit?.internalNotes || ""}`.toLowerCase();
    if (text.includes("bomba") && text.includes("manual")) return true;
    if (text.includes("critic")) return true;
    return pendingProblems.some((problem) => {
      const sameVisit = isRegularVisit(visit) && String(problem.visitId || "") === String(visit?.id || "");
      return sameVisit && String(problem.severity || "").toUpperCase() === "URGENTE";
    });
  }

  function visitHasMaterialBlock(visit) {
    const text = `${visit?.status || ""} ${visit?.notes || ""} ${visit?.internalNotes || ""}`.toLowerCase();
    return text.includes("aguardar material") || text.includes("stock") || text.includes("falta material");
  }

  function operationalStateCode(visit) {
    if (isVisitDone(visit)) return "DONE";
    if (visitHasCriticalProblem(visit)) return "CRITICAL";
    if (visitHasWaterOpen(visit)) return "WATER_OPEN";
    if (visitHasMaterialBlock(visit)) return "WAITING_MATERIAL";

    const status = String(visit?.status || "").toUpperCase();
    if (status === 'INCOMPLETE') return 'INCOMPLETE';
    if (["IN_PROGRESS", "STARTED", "ACTIVE"].includes(status) || (visit?.startAt && !visit?.endAt)) {
      return "IN_PROGRESS";
    }
    if (["ON_ROUTE", "TRAVEL", "EM_TRANSITO", "A_CAMINHO"].includes(status)) {
      return "TRAVEL";
    }
    return "TODO";
  }

  function operationalStateCopy(visit) {
    return alertUi.value('nowState' + operationalStateCode(visit));
  }

  function elapsedSinceLabel(isoValue) {
    if (!isoValue) return "duracao indisponivel";
    const started = new Date(isoValue);
    if (Number.isNaN(started.getTime())) return "duracao indisponivel";
    const minutes = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
    if (minutes < 60) return `${minutes} minuto(s)`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return `${hours}h ${String(rem).padStart(2, "0")}m`;
  }

  function firstPresent(values = []) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (!text) continue;
      return value;
    }
    return null;
  }

  function resolvePumpManualSignal(visit = current()) {
    const equipment = visit?.pool?.equipment || visit?.equipment || {};
    const stateRaw = firstPresent([
      equipment.pumpMode,
      equipment.pumpStatus,
      equipment.mode,
      equipment.manualMode,
      visit?.pumpMode,
      visit?.pumpStatus,
      visit?.manualPumpState,
    ]);
    const stateText = String(stateRaw || "").toUpperCase();
    const manualFlag = [
      equipment.pumpManual,
      equipment.isPumpManual,
      equipment.manual,
      visit?.pumpManual,
      visit?.isPumpManual,
      visit?.manual,
    ].some((value) => value === true || String(value).toLowerCase() === "true");
    const active = manualFlag || stateText.includes("MANUAL");

    const whoValue = firstPresent([
      equipment.pumpManualBy,
      equipment.manualBy,
      visit?.pumpManualBy,
      visit?.manualBy,
      visit?.lastUpdatedBy,
    ]);
    const who = whoValue || "pendente backend";
    const since = firstPresent([
      equipment.pumpManualAt,
      equipment.manualAt,
      visit?.pumpManualAt,
      visit?.manualAt,
      visit?.updatedAt,
    ]);
    const status = active ? "MANUAL" : (stateText || "SEM_SINAL");
    const poolName = visit?.pool?.name || "Piscina por confirmar";
    const hasBackendSignal = manualFlag || Boolean(stateRaw);
    const hasFullMetadata = Boolean(since && who && who !== "pendente backend");

    const signal = {
      active,
      who,
      poolName,
      since,
      duration: elapsedSinceLabel(since),
      status,
      hasBackendSignal,
      hasFullMetadata,
      dependencyPending: !hasBackendSignal || !hasFullMetadata,
    };
    pumpSourceCopies.set(signal, { who: whoValue || alertUi.value('sourceActivatorUnknown'), pool: visit?.pool?.name || alertUi.value('sourcePoolUnknown'), duration: since ? alertDurationCopy(since) : alertUi.value('unavailableTime'), status });
    return signal;
  }

  function hasP0Interruption(visit = current()) {
    const pump = resolvePumpManualSignal(visit);
    const urgentProblems = pendingProblems.filter((problem) => String(problem.severity || "").toUpperCase() === "URGENTE").length;
    return activeWaterReminders().length > 0 || activePumpReminders().length > 0 || urgentProblems > 0 || pump.active;
  }

  function hasActiveIntervention(visit = current()) {
    if (!visit) return false;
    const code = operationalStateCode(visit);
    return ["IN_PROGRESS", "WATER_OPEN", "WAITING_MATERIAL"].includes(code) && !isVisitDone(visit);
  }

  function initialOperationalTab() {
    const hash = String(window.location.hash || "").toLowerCase();
    if (hash === "#agora") return "agora";
    if (hash === "#docs") return "docs";
    if (hash === "#more") return "more";
    if (hasActiveIntervention(current())) return "agora";
    if (hasP0Interruption(current())) return "hoje";
    return "hoje";
  }

  async function api(path, options = {}) {
    const { expectedStatus, ...fetchOptions } = options;
    const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...fetchOptions });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false || response.status === 202 || data.offline || (expectedStatus !== undefined && response.status !== expectedStatus)) throw new Error(data.error || data.message || "Sem confirmação do servidor; dados pendentes de sincronização");
    return data;
  }

  async function apiForm(path, formData) {
    const response = await fetch(path, { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false || response.status === 202 || data.offline) throw new Error(data.error || data.message || "Sem confirmação do servidor; dados pendentes de sincronização");
    return data;
  }

  function current() {
    return visits[index] || null;
  }

  function visitKey(visit = current()) {
    return visit?.id ? `visit-${visit.visitType || 'REGULAR'}-${visit.id}` : "visit-none";
  }

  function isRegularVisit(visit = current()) {
    return !!visit?.id && (!visit.visitType || visit.visitType === 'REGULAR');
  }

  function requireRegularVisit(visit = current()) {
    if (!sameFieldSession()) { alertUi.notify(alertUi.value('actionSessionChanged')); return false; }
    if (!isRegularVisit(visit)) { alertUi.notify(visit ? extraVisitNotice : alertUi.value('visitChoose')); return false; }
    return true;
  }

  function requireExecutableVisit(visit = current()) {
    if (!sameFieldSession()) { alertUi.notify(alertUi.value('actionSessionChanged')); return false; }
    if (!visit?.id || !['REGULAR','EXTRA'].includes(visit.visitType || 'REGULAR')) { alertUi.notify(alertUi.value('visitChoose')); return false; }
    if (visit.visitType === 'EXTRA' && isVisitDone(visit)) { alertUi.notify(alertUi.value('actionExtraDone')); return false; }
    return true;
  }
  const photoPreviewCache = new Map();

  function readFieldDrafts() {
    return visitDraftManager.read();
  }
  window.CWFieldDraftSnapshot = () => { if (!sameFieldSession()) throw Error('Sessão alterada.'); return readFieldDrafts(); };

  function isVisitDone(visit) {
    const status = String(visit?.status || "").toUpperCase();
    return Boolean(visit?.endAt) || ["DONE", "COMPLETED", "CONCLUIDA", "CONCLUIDA"].includes(status);
  }

  function storageRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function storageWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) { return false; }
  }

  function toast(message) {
    const node = $("#toast");
    if (!node) {
      ui.info(message);
      return;
    }
    alertUi.clear(node);
    waterUi.clear(node);
    clearPhotoError(node);
    clearPhotoUi(node);
    node.textContent = message;
    node.classList.add("show");
    setTimeout(() => node.classList.remove("show"), 2400);
  }

  function formatDate(value) {
    if (!value) return "Sem data definida";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sem data definida";
    return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  }

  function localIsoDate(date = new Date()) {
    const safe = Number.isNaN(date.getTime()) ? new Date() : date;
    return [
      safe.getFullYear(),
      String(safe.getMonth() + 1).padStart(2, "0"),
      String(safe.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function addLocalDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  function dayQueryParams(date, technicianId = currentTechnicianId()) {
    const params = new URLSearchParams();
    if (technicianId) params.set("technicianId", technicianId);
    params.set("date", localIsoDate(date));
    return params.toString();
  }

  function readVisitForm() {
    const values = {};
    draftFieldIds.forEach((id) => {
      values[id] = $(`#${id}`)?.value || "";
    });
    const checks = {};
    checkIds.forEach((id) => {
      checks[id] = Boolean($(`#${id}`)?.checked);
    });
    return {
      values,
      checks,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      pendingProblems,
      usedProducts: usedProducts.map((product) => ({ ...product })),
      photos: visitPhotos.map((photo) => ({
        localId: photo.localId,
        type: photo.type,
        fileName: photo.fileName,
        previewUrl: photo.previewUrl?.startsWith("blob:") ? "" : photo.previewUrl,
        status: photo.status,
        error: photo.error,
        url: photo.url,
        serverId: photo.serverId || null,
      })),
    };
  }

  function applyVisitForm(draft) {
    const values = draft?.values || {};
    draftFieldIds.forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.value = values[id] || (id === "shortageUnit" ? "L" : "");
    });

    const checks = draft?.checks || {};
    checkIds.forEach((id) => {
      const node = $(`#${id}`);
      if (!node) return;
      node.checked = Object.prototype.hasOwnProperty.call(checks, id)
        ? Boolean(checks[id])
        : false;
    });

    startedAt = draft?.startedAt ? new Date(draft.startedAt) : null;
    pendingProblems = Array.isArray(draft?.pendingProblems) ? draft.pendingProblems : [];
    usedProducts = Array.isArray(draft?.usedProducts) ? draft.usedProducts : [];
    updateAllReferenceStatuses();
    renderDoseRows();
  }

  function inputValue(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  function parseProductsValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return raw ? [{ name: raw, quantity: "", unit: "" }] : [];
    }
  }

  function productsFromVisit(visit) {
    const fromJson = Array.isArray(visit?.chemicalsJson) ? visit.chemicalsJson : [];
    const fromChemicals = Array.isArray(visit?.chemicals) ? visit.chemicals : [];
    const fromText = parseProductsValue(visit?.products);
    const source = fromJson.length ? fromJson : (fromChemicals.length ? fromChemicals : fromText);
    return source.map((product, itemIndex) => ({
      localId: `saved-dose-${visit?.id || "x"}-${product?.id || itemIndex}`,
      name: product?.name || product?.productName || "",
      quantity: inputValue(product?.quantity),
      unit: product?.unit ?? "",
      ...(product?.workGuideItemId !== undefined || product?.workGuideId !== undefined ? {workGuideItemId:product.workGuideItemId,workGuideId:product.workGuideId} : {}),
      notes: product?.notes || "",
    })).filter((product) => product.name || product.quantity);
  }

  function photosFromVisit(visit) {
    return (Array.isArray(visit?.photos) ? visit.photos : []).map((photo, itemIndex) => ({
      localId: `saved-photo-${visit?.id || "x"}-${photo?.id || itemIndex}`,
      visitId: visit?.id, visitType: visit?.visitType || 'REGULAR',
      type: photo?.type || "AFTER",
      fileName: photo?.fileName || `Foto ${photo?.id || itemIndex + 1}`,
      previewUrl: isRegularVisit(visit) ? photo?.url || "" : "",
      url: photo?.url || "",
      status: "uploaded",
      error: "",
      serverId: photo?.id || null,
    })).filter((photo) => photo.url);
  }

  function savedVisitDraft(visit) {
    return {
      values: {
        ph: inputValue(visit?.ph),
        chlorine: inputValue(visit?.chlorine),
        alkalinity: inputValue(visit?.alkalinity),
        salt: inputValue(visit?.salt),
        orp: inputValue(visit?.orpMv ?? visit?.orp),
        temperature: inputValue(visit?.temperature),
        notes: inputValue(visit?.notes),
      },
      checks: {
        cleaned: Boolean(visit?.cleaned),
        vacuumed: Boolean(visit?.vacuumed),
        basketCleaned: Boolean(visit?.basketCleaned),
        brushed: Boolean(visit?.brushed),
        waterlineClean: Boolean(visit?.waterlineClean),
        backwashDone: Boolean(visit?.backwashDone),
      },
      startedAt: visit?.startAt || null,
      pendingProblems: [],
      usedProducts: productsFromVisit(visit),
      photos: photosFromVisit(visit),
    };
  }

  function applySavedVisitData(visit) {
    applyVisitForm(savedVisitDraft(visit));
    visitPhotos = photosFromVisit(visit);
    renderPhotoList();
  }

  function mergeVisitSnapshot(base, incoming = {}, fallbackStatus) {
    const result = incoming && typeof incoming === "object" ? incoming : {};
    return {
      ...(base || {}),
      ...result,
      status: result.status || fallbackStatus || base?.status,
      pool: {
        ...(base?.pool || {}),
        ...(result.pool || {}),
      },
      client: result.client || result.pool?.client || base?.client,
      technician: {
        ...(base?.technician || {}),
        ...(result.technician || {}),
      },
    };
  }

  function saveCurrentDraft() {
    if (!sameFieldSession()) return Promise.resolve();
    const visit = current();
    if (!visit?.id || !currentDraftEntry || currentDraftEntry.key !== visitKey(visit) || (visit.visitType === 'EXTRA' && isVisitDone(visit))) return Promise.resolve();
    const key = visitKey(visit);
    visitPhotosByKey[key] = visitPhotos;
    return visitDraftManager.save(currentDraftEntry,readVisitForm());
  }

  function loadCurrentDraft() {
    const visit = current();
    if (!visit) { currentDraftEntry=null;applyVisitForm(null);visitPhotos=[];visitDraftManager.paint(null);return; }
    currentDraftEntry=visitDraftManager.bind(visit,savedVisitDraft(visit));
    if (visit.visitType === 'EXTRA' && isVisitDone(visit)) {
      applySavedVisitData(visit);
      visitDraftManager.paint(currentDraftEntry);
      return;
    }
    const key = visitKey(visit);
    const draft = visitDraftManager.expand(currentDraftEntry);
    applyVisitForm(draft);
    visitPhotos = visitPhotosByKey[key] || (draft?.photos || []);
    window.CWFieldPhotos.list(visit?.id, true, fieldWriteSession, visit?.visitType || 'REGULAR').then(pending => {
      if (!sameFieldSession() || visitKey(current()) !== key) { pending.forEach(photo => { if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl); }); return; }
      for(const photo of pending) { const position=visitPhotos.findIndex(p=>p.localId===photo.localId);if(position>=0){if(visitPhotos[position].previewUrl?.startsWith('blob:'))URL.revokeObjectURL(visitPhotos[position].previewUrl);visitPhotos[position]=photo;}else visitPhotos.push(photo); }
      renderPhotoList();
    }).catch(error=>{if(sameFieldSession())photoErrorToast(error, 'restore')});
    renderPhotoList();
    visitDraftManager.paint(currentDraftEntry);
  }

  function validCoordinate(value, type) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    if (Math.abs(number) < 0.0001) return null;
    if (type === "lat" && (number < -90 || number > 90)) return null;
    if (type === "lng" && (number < -180 || number > 180)) return null;
    return number;
  }

  function visitLocation(visit) {
    const pool = visit?.pool || {};
    const client = visit?.client || pool.client || {};
    const lat = validCoordinate(pool.latitude ?? client.latitude, "lat");
    const lng = validCoordinate(pool.longitude ?? client.longitude, "lng");
    const address = [pool.address, pool.location, client.address, pool.zone]
      .map(value=>String(value ?? '').trim())
      .find(value=>value && !['-','—','n/a','null','undefined'].includes(value.toLowerCase())) || '';
    const label = [pool.name, client.name, address].filter(Boolean).join(", ");
    return { lat, lng, address, label: label || "Cristal Water" };
  }

  function setTileTone(selector, tone) {
    const node = $(selector);
    if (!node) return;
    node.classList.remove("ok", "warn");
    if (tone) node.classList.add(tone);
  }

  function guideHasTransportReference() {
    return Boolean(activeTransportGuide?.id || activeWorkGuide?.guideId || activeWorkGuide?.guide?.id);
  }

  function clearFieldDocuments(message = '') {
    ++docsRevision; docsContext = null; documentsLoaded = false;
    activeTransportGuide = null; activeWorkGuide = null; activeWorkStock = []; activeInsurance = null; activeVehicle = null;
    docsSource = 'unavailable'; docsDetail = ''; docsWarning = message;
    docsDetailCopy = ''; docsWarningCopy = message;
    ['transport', 'work', 'insurance'].forEach(kind => renderDocumentSection(kind, null, 'unavailable', ''));
    renderDoseRows(); renderCrewStatus(); updateFieldDashboard(current());
  }

  function parseDateSafe(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function firstDocDate(values = []) {
    for (const value of values) {
      const date = parseDateSafe(value);
      if (date) return date;
    }
    return null;
  }

  function normalizeDocStatus({ present, statusText, dueDate, required }) {
    const text = String(statusText || "").toUpperCase();
    if (!present) return { code: "UNAVAILABLE", label: "Indisponível", required };
    if (text.includes("EXPIR") || text.includes("VENC")) return { code: "EXPIRED", label: "Expirado", required };
    if (text.includes("PEND") || text.includes("DRAFT") || text.includes("PROVIS")) return { code: "PENDING", label: "Pendente", required };
    if (dueDate && dueDate.getTime() < Date.now()) return { code: "EXPIRED", label: "Expirado", required };
    return { code: "VALID", label: "Válido", required };
  }

  function computeDocsCompliance() {
    const vehicle = activeVehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || {};
    const transportDue = firstDocDate([activeTransportGuide?.validUntil, activeTransportGuide?.expiresAt]);
    const workDue = firstDocDate([activeWorkGuide?.validUntil, activeWorkGuide?.expiresAt]);
    const insuranceDue = firstDocDate([activeInsurance?.dueDate, activeInsurance?.validUntil, vehicle?.insuranceDueDate]);
    const inspectionDue = firstDocDate([
      vehicle?.inspectionDueDate,
      vehicle?.inspection?.dueDate,
      vehicle?.inspection?.validUntil,
    ]);
    const safetyDocs = Array.isArray(vehicle?.safetySheets)
      ? vehicle.safetySheets
      : (Array.isArray(vehicle?.documents) ? vehicle.documents.filter((doc) => String(doc.type || "").toUpperCase().includes("SAFETY")) : []);
    const manuals = Array.isArray(vehicle?.manuals)
      ? vehicle.manuals
      : (Array.isArray(vehicle?.documents) ? vehicle.documents.filter((doc) => String(doc.type || "").toUpperCase().includes("MANUAL")) : []);

    const states = {
      transport: normalizeDocStatus({
        present: Boolean(activeTransportGuide?.id || activeWorkGuide?.guideId || activeWorkGuide?.guide?.id),
        statusText: activeTransportGuide?.status || activeWorkGuide?.guide?.status,
        dueDate: transportDue,
        required: true,
      }),
      workGuide: normalizeDocStatus({
        present: Boolean(activeWorkGuide?.id),
        statusText: activeWorkGuide?.status,
        dueDate: workDue,
        required: true,
      }),
      insurance: normalizeDocStatus({
        present: Boolean(activeInsurance?.id || activeInsurance?.policyNumber || activeInsurance?.title),
        statusText: activeInsurance?.status,
        dueDate: insuranceDue,
        required: true,
      }),
      inspection: normalizeDocStatus({
        present: Boolean(vehicle?.inspection || vehicle?.inspectionDueDate || vehicle?.inspectionStatus),
        statusText: vehicle?.inspectionStatus || vehicle?.inspection?.status,
        dueDate: inspectionDue,
        required: true,
      }),
      safety: normalizeDocStatus({
        present: safetyDocs.length > 0,
        statusText: safetyDocs.find((doc) => doc?.status)?.status,
        dueDate: firstDocDate(safetyDocs.map((doc) => doc?.dueDate || doc?.validUntil)),
        required: false,
      }),
      manuals: normalizeDocStatus({
        present: manuals.length > 0,
        statusText: manuals.find((doc) => doc?.status)?.status,
        dueDate: firstDocDate(manuals.map((doc) => doc?.dueDate || doc?.validUntil)),
        required: false,
      }),
    };

    const blockerCopies = [];
    const blockers = Object.entries(states)
      .filter(([, state]) => state.required && state.code !== "VALID")
      .map(([key, state]) => {
        const name = ({ transport: 'sourceDocTransport', workGuide: 'sourceDocWork', insurance: 'sourceDocInsurance', inspection: 'sourceDocInspection' })[key];
        const label = ({ UNAVAILABLE: 'sourceDocUnavailable', EXPIRED: 'sourceDocExpired', PENDING: 'sourceDocPending', VALID: 'sourceDocValid' })[state.code];
        blockerCopies.push(alertUi.value('sourceDocBlocker', { name: name ? alertUi.value(name) : key, state: label ? alertUi.value(label) : state.label }));
        return `${({transport:"Guia AT",workGuide:"Guia de obra",insurance:"Seguro",inspection:"Inspeção"})[key] || key}: ${state.label}`;
      });
    if (!documentsLoaded || !window.CWFieldDocuments.same(docsContext) || docsContext.vehicleId !== Number($('#vehicleId')?.value)) { blockers.push('Documentos por confirmar para a sessão, viatura e dia atuais'); blockerCopies.push(alertUi.value('sourceDocConfirm')); }
    if (activeTransportGuide?.id && activeWorkGuide?.guideId && activeTransportGuide.id !== activeWorkGuide.guideId) { blockers.push('As guias AT e de obra não correspondem. Atualize os documentos.'); blockerCopies.push(alertUi.value('sourceDocMismatch')); }
    const readyForOperation = blockers.length === 0;

    const result = {
      states,
      blockers,
      readyForOperation,
      reason: readyForOperation ? "" : `Bloqueio documental - ${blockers.join(" | ")}`,
    };
    documentSourceCopies.set(result, readyForOperation ? '' : alertUi.value('sourceDocsReason', { blockers: alertUi.join(blockerCopies) }));
    return result;
  }

  function setCrewDocStatus(selector, ok, valueId, metaId, value, meta) {
    const node = $(selector);
    if (!node) return;
    node.classList.toggle("ok", Boolean(ok));
    node.classList.toggle("warn", !ok);
    const valueNode = $(`#${valueId}`);
    const metaNode = $(`#${metaId}`);
    if (valueNode) alertUi.bind(valueNode, value || alertUi.value(ok ? "crewGreen" : "crewRed"));
    if (metaNode) alertUi.bind(metaNode, meta || "");
  }

  function setCrewDocState(selector, valueId, metaId, state, okMeta, warnMeta) {
    const isOk = state?.code === "VALID";
    const labels = { VALID: "sourceDocValid", UNAVAILABLE: "sourceDocUnavailable", EXPIRED: "sourceDocExpired", PENDING: "sourceDocPending" };
    const label = Object.hasOwn(labels, state?.code) ? alertUi.value(labels[state.code]) : (state?.label || alertUi.value("sourceDocUnavailable"));
    setCrewDocStatus(
      selector,
      isOk,
      valueId,
      metaId,
      label,
      isOk ? okMeta : (warnMeta || alertUi.value("crewPendingDocument"))
    );
  }

  function syncTechnicianContextFromVisit(visit) {
    const technician = visit?.technician || visits.find((item) => item.technician?.id || item.technician?.name)?.technician || null;
    if (technician) activeTechnician = technician;

    const vehicle = technician?.vehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || activeVehicle || null;
    if (vehicle) activeVehicle = activeVehicle?.id === vehicle.id ? {...activeVehicle, ...vehicle} : vehicle;

    const technicianInput = $("#technicianId");
    if (technician?.id) {
      if (technicianInput) technicianInput.value = technician.id;
      localStorage.setItem("cwTechnicianId", String(technician.id));
    }

    const vehicleInput = $("#vehicleId");
    if (vehicle?.id) {
      if (vehicleInput) vehicleInput.value = vehicle.id;
      localStorage.setItem("cwVehicleId", String(vehicle.id));
    }

    renderCrewStatus();
  }

  function renderCrewStatus() {
    const vehicleInputValue = ($("#vehicleId")?.value || localStorage.getItem("cwVehicleId") || "").trim();
    const technicianInputValue = ($("#technicianId")?.value || localStorage.getItem("cwTechnicianId") || "").trim();
    const vehicle = activeVehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || null;
    const technician = activeTechnician || activeWorkGuide?.technician || current()?.technician || null;
    const plate = vehicle?.plate || activeWorkGuide?.vehicle?.plate || activeTransportGuide?.vehicle?.plate || vehicleInputValue || alertUi.value("crewUnknownPlate");
    const vehicleName = [vehicle?.name, vehicle?.status].filter(Boolean).join(" - ");
    const compliance = computeDocsCompliance();
    docsCompliance = compliance;
    const atOk = compliance.states.transport.code === "VALID";
    const workOk = compliance.states.workGuide.code === "VALID";
    const atCode = activeTransportGuide?.codeAT || activeWorkGuide?.guide?.codeAT || activeWorkGuide?.guideId || "";

    const technicianName = $("#fieldTechnicianName");
    const technicianMeta = $("#fieldTechnicianMeta");
    const vehiclePlate = $("#fieldVehiclePlate");
    const vehicleMeta = $("#fieldVehicleMeta");

    if (technicianName) alertUi.bind(technicianName, technician?.name || alertUi.value("crewUnknownTechnician"));
    if (technicianMeta) alertUi.bind(technicianMeta, technician?.id ? alertUi.value("crewIdentity", { id: technician.id }) : (technicianInputValue ? alertUi.value("crewIdentity", { id: technicianInputValue }) : alertUi.value("crewUnknownTechnicianId")));
    if (vehiclePlate) alertUi.bind(vehiclePlate, plate);
    if (vehicleMeta) alertUi.bind(vehicleMeta, vehicleName || (vehicle?.id ? alertUi.value("crewVehicleId", { id: vehicle.id }) : alertUi.value("crewVehicleDay")));

    setCrewDocStatus(
      "#fieldTransportGuideStatus",
      atOk,
      "fieldTransportGuideValue",
      "fieldTransportGuideMeta",
      alertUi.value(atOk ? "crewGreen" : "crewRed"),
      atOk ? alertUi.value("crewTransportReady", { code: atCode || alertUi.value("crewAssociated") }) : alertUi.value("crewTransportMissing")
    );

    setCrewDocStatus(
      "#fieldWorkGuideStatus",
      workOk,
      "fieldWorkGuideValue",
      "fieldWorkGuideMeta",
      alertUi.value(workOk ? "crewGreen" : "crewRed"),
      workOk ? alertUi.value(activeWorkGuide.guideId ? "crewWorkLinked" : "crewWorkProvisional", { id: activeWorkGuide.id }) : alertUi.value("crewWorkMissing")
    );

    setCrewDocState(
      "#fieldInsuranceStatus",
      "fieldInsuranceValue",
      "fieldInsuranceMeta",
      compliance.states.insurance,
      alertUi.value("crewInsuranceReady"),
      alertUi.value("crewInsuranceWarning")
    );

    setCrewDocState(
      "#fieldInspectionStatus",
      "fieldInspectionValue",
      "fieldInspectionMeta",
      compliance.states.inspection,
      alertUi.value("crewInspectionReady"),
      alertUi.value("crewInspectionWarning")
    );

    const safetyAggregate = compliance.states.safety.code === "VALID" && compliance.states.manuals.code === "VALID"
      ? { code: "VALID", label: "Válido" }
      : (compliance.states.safety.code !== "VALID" ? compliance.states.safety : compliance.states.manuals);
    setCrewDocState(
      "#fieldSafetyStatus",
      "fieldSafetyValue",
      "fieldSafetyMeta",
      safetyAggregate,
      alertUi.value("crewSafetyReady"),
      alertUi.value("crewSafetyWarning")
    );

    const center = $("#documentCenterBox");
    if (center) {
      alertUi.clearTree(center);
      center.innerHTML = `
        <div class="doc-head"><span class="chip" data-center-copy="title"></span><strong class="${compliance.readyForOperation ? "status-ok" : "status-warn"}" data-center-copy="state"></strong></div>
        <div class="doc-number" data-center-copy="source"></div>
        ${docsDetail ? '<div class="muted" data-center-copy="detail"></div>' : ''}
        ${docsWarning ? '<div class="muted" role="status" data-center-copy="warning"></div>' : ''}
        <div class="doc-meta">
          ${['transport', 'workGuide', 'insurance', 'inspection', 'safety', 'manuals'].map(kind => `<span data-center-state="${kind}"></span>`).join('')}
        </div>
        ${compliance.reason ? '<div class="muted" data-doc-lock-reason="1" data-center-copy="reason"></div>' : '<div class="muted" data-center-copy="validated"></div>'}
      `;
      const sources = { live: 'centerLive', cache: 'centerCache', mixed: 'centerMixed', unavailable: 'centerUnconfirmed' };
      const values = {
        title: alertUi.value('centerTitle'), state: alertUi.value(compliance.readyForOperation ? 'centerReady' : 'centerBlocked'),
        source: alertUi.value('centerSource', { source: alertUi.value(Object.hasOwn(sources, docsSource) ? sources[docsSource] : 'centerUnconfirmed') }),
        detail: docsDetailCopy || docsDetail, warning: docsWarningCopy || docsWarning,
        reason: documentSourceCopies.get(compliance) || compliance.reason, validated: alertUi.value('centerValidated'),
      };
      for (const node of center.querySelectorAll('[data-center-copy]')) alertUi.bind(node, values[node.dataset.centerCopy]);
      const names = { transport: 'sourceDocTransport', workGuide: 'sourceDocWork', insurance: 'sourceDocInsurance', inspection: 'sourceDocInspection', safety: 'centerSafety', manuals: 'centerManuals' };
      const states = { UNAVAILABLE: 'sourceDocUnavailable', EXPIRED: 'sourceDocExpired', PENDING: 'sourceDocPending', VALID: 'sourceDocValid' };
      for (const node of center.querySelectorAll('[data-center-state]')) {
        const kind = node.dataset.centerState, state = compliance.states[kind];
        alertUi.bind(node, alertUi.value('sourceDocBlocker', { name: alertUi.value(names[kind]), state: Object.hasOwn(states, state.code) ? alertUi.value(states[state.code]) : state.label }));
      }
    }
  }

  function currentTechnicianId() {
    const principal = window.CristalAuth?.parseUser?.() || {};
    if (['TECHNICIAN','TEAM_LEADER'].includes(principal.role)) return String(principal.technicianId || principal.id || '');
    const fromQuery = new URLSearchParams(location.search).get("technicianId") || "";
    const fromInput = $("#technicianId")?.value || "";
    const fromStorage = localStorage.getItem("cwTechnicianId") || "";
    const fromActive = activeTechnician?.id ? String(activeTechnician.id) : "";
    return String(fromQuery || fromInput || fromStorage || fromActive || "").trim();
  }

  function currentPoolId() {
    const visit = current();
    const poolId = visit?.pool?.id || visit?.poolId || "";
    return String(poolId || "").trim();
  }

  function parseProposalPhotoLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function renderTechnicalProposalList() {
    const list = $("#technicalProposalList");
    if (!list) return;
    if (!technicalProposals.length) {
      list.textContent = "Sem propostas desta piscina nesta sessão.";
      return;
    }
    list.innerHTML = technicalProposals.slice(0, 4).map((item) => {
      const when = formatDate(item.submittedAt || item.createdAt);
      const risk = esc(item.riskLevel || "MEDIUM");
      const reason = esc(item.reason || "Sem motivo");
      const changesCount = Array.isArray(item.changes) ? item.changes.length : 0;
      const photosCount = Array.isArray(item.photos) ? item.photos.length : 0;
      return `<div class="interrupt-item" data-tech-proposal-id="${esc(item.id)}"><strong>${risk}</strong><div>${reason}</div><div class="muted">${when} | ${changesCount} alteração(ões) | ${photosCount} foto(s)</div></div>`;
    }).join("");
  }

  async function loadTechnicalProposals(poolId) {
    void technicalProposalEditor.open(Number(poolId));
    if (!poolId) {
      technicalProposals = [];
      renderTechnicalProposalList();
      return;
    }
    const credential = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
    const relevant = () => currentPoolId() === String(poolId) && credential === (localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '');
    technicalProposals = [];
    const list = $("#technicalProposalList");
    if (list) list.textContent = "A consultar propostas...";
    try {
      const data = await api(`/api/core/pools/${encodeURIComponent(poolId)}/technical-change-proposals?onlyPending=true`);
      if (!relevant()) return;
      technicalProposals = Array.isArray(data.proposals) ? data.proposals : [];
      renderTechnicalProposalList();
    } catch (_) {
      if (!relevant()) return;
      if (list) list.textContent = "Não foi possível consultar as propostas. Atualize antes de repetir um envio.";
    }
  }

  const technicalProposalEditor = window.CWTechnicalProposalEditor.create({ saved: async id => { if (Number(currentPoolId()) === id) await loadTechnicalProposals(currentPoolId()); } });
  async function submitTechnicalProposal() { return technicalProposalEditor.submit(); }

  function todayQueryParams() {
    return dayQueryParams(new Date(), currentTechnicianId());
  }

  function updateFieldDashboardLegacy(visit) {
    const done = visits.filter(isVisitDone).length;
    const total = visits.length;
    const pending = Math.max(total - done, 0);
    const hasTransport = guideHasTransportReference();
    const hasWorkGuide = Boolean(activeWorkGuide?.id);
    const docsReady = hasTransport && hasWorkGuide;
    const readyDocs = [hasTransport, hasWorkGuide].filter(Boolean).length;
    const photoCount = visitPhotos.length;
    const location = visit ? visitLocation(visit) : null;

    const focusNow = $("#fieldFocusNow");
    const focusMeta = $("#fieldFocusMeta");
    const progressValue = $("#fieldProgressValue");
    const progressMeta = $("#fieldProgressMeta");
    const docsValue = $("#fieldDocsValue");
    const docsMeta = $("#fieldDocsMeta");
    const photosValue = $("#fieldPhotosValue");
    const photosMeta = $("#fieldPhotosMeta");

    if (focusNow) focusNow.textContent = visit ? (visit.pool?.name || "Piscina") : "Dia concluido";
    if (focusMeta) {
      focusMeta.textContent = visit
        ? `${visit.client?.name || "Cliente"} - ${location?.address || visit.pool?.zone || "local por confirmar"}`
        : "Sem visitas pendentes nesta ronda.";
    }

    if (progressValue) progressValue.textContent = `${done} / ${total}`;
    if (progressMeta) progressMeta.textContent = pending ? `${pending} visita(s) por concluir` : "Ronda pronta para fechar";

    if (docsValue) docsValue.textContent = docsReady ? "Associados" : "Atenção";
    if (docsMeta) docsMeta.textContent = docsReady ? "guia de obra ligada a AT" : "confirmar guia AT/obra e seguro";

    if (photosValue) photosValue.textContent = `${photoCount} foto${photoCount === 1 ? "" : "s"}`;
    if (photosMeta) photosMeta.textContent = photoCount ? "registos prontos para sincronizar" : "sem fotos nesta visita";

    setTileTone("#fieldProgressTile", pending ? "" : "ok");
    setTileTone("#fieldDocsTile", docsReady ? "ok" : "warn");
    setTileTone("#fieldPhotosTile", photoCount ? "ok" : "");
  }

  function actorName() {
    const parsed = window.CristalAuth?.parseUser?.() || {};
    return parsed?.name || activeTechnician?.name || "Tecnico em campo";
  }

  function readOpJournal() {
    try {
      const context = window.CWFieldAlertJournal.scope(fieldWriteSession), value = window.CWFieldAlertJournal.read(context);
      opJournalReadCopy = window.CWFieldAlertJournal.presentation.legacyWarning(context);
      opJournalReadWarning = window.CWFieldAlertJournal.presentation.format(opJournalReadCopy, 'pt');
      return { context, value, states: window.CWFieldAlertJournal.states(value) };
    } catch (error) {
      opJournalReadWarning = error.message;
      opJournalReadCopy = window.CWFieldAlertJournal?.presentation?.error(error) ?? error.message;
      return { context: null, value: { entries: [] }, states: {} };
    }
  }

  function activePumpReminders() {
    try { const rows = window.CWFieldReminders?.list('PUMP_MANUAL') || []; pumpRemindersError = ''; pumpRemindersErrorCopy = ''; return rows.filter(row => row.status !== 'CLOSED'); }
    catch (error) { pumpRemindersError = error.message; pumpRemindersErrorCopy = window.CWFieldReminders?.presentation?.error(error) ?? error.message; return []; }
  }

  function exceptionDurationLabel(isoStart) {
    if (!isoStart) return "Sem tempo em curso";
    return elapsedSinceLabel(isoStart);
  }

  function isVisitDelayed(visit) {
    if (!visit || isVisitDone(visit)) return false;
    const planned = new Date(visit.plannedDate || visit.date || 0);
    if (Number.isNaN(planned.getTime())) return false;
    return Date.now() - planned.getTime() > 20 * 60 * 1000;
  }

  function collectOperationalExceptions() {
    const items = [];
    const visit = current();
    const nowIso = new Date().toISOString();
    const pump = resolvePumpManualSignal(visit);
    const pumpReminders = activePumpReminders();

    if (pump.active && !pumpReminders.some(row => row.poolId === (visit?.poolId || visit?.pool?.id))) {
      items.push(withAlertSource({
        id: `pump-manual:${visitKey(visit)}:${String(pump.since || 'unknown')}`,
        category: "PUMP_MANUAL",
        title: "P0 - Bomba em manual",
        detail: `Quem ativou: ${pump.who} | Piscina: ${pump.poolName} | Duração: ${pump.duration} | Estado: ${pump.status}`,
        priority: "P0",
        createdBy: pump.who || "Sistema",
        createdAt: pump.since || nowIso,
        targetAction: "problem",
      }, 'sourcePumpTitle', alertUi.value('sourcePumpSignal', pumpSourceCopies.get(pump))));
    }

    pumpReminders.forEach(reminder => items.push(withAlertSource({
      id: `pump-manual:${reminder.visitType}:${reminder.localId}`,
      category: 'PUMP_MANUAL', title: 'P0 - Bomba em manual', priority: 'P0',
      detail: `${reminder.poolName || 'Piscina'} | ${reminder.clientName || 'Cliente'} | Confirmar modo automático até ${formatDate(reminder.dueAt)}`,
      createdBy: reminder.technicianName || 'Técnico', createdAt: reminder.createdAt || nowIso, targetAction: 'pump',
    }, 'sourcePumpTitle', alertUi.value('sourcePumpReminder', { pool: reminder.poolName || alertUi.value('sourcePool'), client: reminder.clientName || alertUi.value('sourceClient'), when: formatDate(reminder.dueAt) }))));

    activeWaterReminders().forEach((reminder) => {
      items.push({
        id: `water-open:${reminder.visitType}:${String(reminder.localId || reminder.serverId || reminder.id || "none")}`,
        category: "WATER_OPEN",
        title: "P0 - Agua aberta",
        detail: `${reminder.poolName || "Piscina"} | ${reminder.clientName || "Cliente"} | ${waterReminderLabel(reminder)}`,
        priority: reminder.status === "OVERDUE" ? "P0" : "P1",
        createdBy: reminder.technicianName || "Tecnico",
        createdAt: reminder.createdAt || nowIso,
        targetAction: "water",
      });
    });

    if (waterRemindersError || pumpRemindersError) items.push(withAlertSource({ id: 'reminders-unavailable:device', category: 'REMINDER_UNAVAILABLE', title: 'P0 - Água e bombas por confirmar', priority: 'P0', detail: waterRemindersError || pumpRemindersError, createdBy: 'Sistema', createdAt: nowIso, targetAction: 'water' }, 'sourceUnavailableTitle', alertUi.reminder(waterRemindersError ? waterRemindersErrorCopy : pumpRemindersErrorCopy)));
    const urgentProblems = pendingProblems.filter((problem) => String(problem.severity || "").toUpperCase() === "URGENTE");
    if (urgentProblems.length) {
      const first = urgentProblems[0];
      items.push(withAlertSource({
        id: `critical-problem:${visit?.visitType || 'REGULAR'}:${String(first.visitId || visit?.id || "none")}:${visit?.poolId || visit?.pool?.id || 'none'}`,
        category: "CRITICAL_PROBLEM",
        title: "P0 - Problema critico",
        detail: `${urgentProblems.length} problema(s) critico(s) pendente(s).`,
        priority: "P0",
        createdBy: actorName(),
        createdAt: first.createdAt || nowIso,
        targetAction: "problem",
      }, 'sourceCriticalTitle', alertUi.value('sourceCriticalDetail', { count: urgentProblems.length })));
    }

    if (isVisitDelayed(visit)) {
      items.push(withAlertSource({
        id: `visit-delayed:${visitKey(visit)}:${visit?.poolId || visit?.pool?.id || 'none'}`,
        category: "VISIT_DELAYED",
        title: "P1 - Visita atrasada",
        detail: `${visit?.pool?.name || "Piscina"} com atraso face ao planeado.`,
        priority: "P1",
        createdBy: "Sistema",
        createdAt: visit?.plannedDate || visit?.date || nowIso,
        targetAction: "hoje",
      }, 'sourceDelayedTitle', alertUi.value('sourceDelayedDetail', { pool: visit?.pool?.name || alertUi.value('sourcePool') })));
    }

    if (documentsLoaded && !opsSnapshot.docsReady) {
      items.push(withAlertSource({
        id: `docs-missing:${Number($('#vehicleId')?.value) || 'none'}`,
        category: "DOC_MISSING",
        title: "P1 - Documento obrigatorio em falta",
        detail: opsSnapshot.docsBlockReason || "Documentacao da viatura incompleta para operacao segura.",
        priority: "P1",
        createdBy: "Sistema",
        createdAt: nowIso,
        targetAction: "docs",
      }, 'sourceDocsTitle', opsSnapshot.docsBlockReason ? docsBlockReasonCopy : alertUi.value('sourceDocsFallback')));
    }

    return items;
  }

  function ensureOperationalExceptionState(exceptions) {
    const snapshot = readOpJournal(), context = snapshot.context;
    if (context && !opJournalBusy) {
      const prefix = window.CWFieldAlertJournal.key(context) + ':';
      const missing = exceptions.filter(item => !snapshot.states[item.id] && !opJournalAttempts.has(prefix + item.id));
      if (missing.length) {
        missing.forEach(item => opJournalAttempts.add(prefix + item.id)); opJournalBusy = true;
        window.CWFieldAlertJournal.record(context, missing, 'OPEN', actorName())
          .then(() => { if (sameFieldSession()) { opJournalWriteWarning = ''; opJournalWriteCopy = ''; } })
          .catch(error => { if (sameFieldSession()) { opJournalWriteWarning = 'O histórico não ficou guardado. ' + error.message; opJournalWriteCopy = alertUi.value('writeFailed', { detail: window.CWFieldAlertJournal.presentation.error(error) }); } })
          .finally(() => { opJournalBusy = false; if (sameFieldSession()) renderInterruptBoard(); });
      }
    }
    return snapshot.states;
  }

  async function recordOperationalException(exception, action) {
    if (!sameFieldSession()) return;
    try {
      const context = window.CWFieldAlertJournal.scope(fieldWriteSession);
      await window.CWFieldAlertJournal.record(context, [exception], action, actorName(), () => sameFieldSession() && collectOperationalExceptions().some(item => item.id === exception.id));
      if (!sameFieldSession()) return;
      opJournalWriteWarning = ''; opJournalWriteCopy = ''; renderInterruptBoard();
      alertUi.notify(alertUi.value('saved'));
    } catch (error) {
      if (!sameFieldSession()) return;
      opJournalWriteWarning = 'A alteração não ficou guardada. ' + error.message;
      opJournalWriteCopy = alertUi.value('changeFailed', { detail: window.CWFieldAlertJournal.presentation.error(error) });
      renderInterruptBoard(); alertUi.notify(opJournalWriteCopy);
    }
  }

  function assumeOperationalException(exception) {
    return recordOperationalException(exception, 'ASSUMED');
  }

  function confirmOperationalException(exception) {
    return recordOperationalException(exception, 'CONFIRMED');
  }

  function renderExceptionHistory(history) {
    alertHistoryCopy.clear();
    if (!history.length) {
      return '<div class="interrupt-item" data-history-empty="1">Sem historico local de excecoes.</div>';
    }
    return history.slice(-6).reverse().map((entry) => {
      const text = {
        action: alertUi.value(({ OPEN: 'observed', ASSUMED: 'handlingHistory', CONFIRMED: 'readHistory' })[entry.action] || 'record'),
        historyTitle: entry.title || alertUi.value('exception'),
        historyMeta: alertUi.value('historyMeta', { date: formatDate(entry.createdAt), actor: entry.by || alertUi.value('system') }),
      };
      alertHistoryCopy.set(String(entry.id || ''), text);
      return `
      <div class="interrupt-item" data-history-entry="${esc(entry.id || "")}" style="border-style:dashed">
        <strong data-alert-text="action">${esc(alertUi.format(text.action))}</strong>
        <div data-alert-text="historyTitle">${esc(alertUi.format(text.historyTitle))}</div>
        <div class="muted" data-alert-text="historyMeta">${esc(alertUi.format(text.historyMeta))}</div>
      </div>
    `;
    }).join("");
  }

  function alertDurationCopy(isoStart) {
    if (!isoStart) return alertUi.value('noTime');
    const started = new Date(isoStart);
    if (Number.isNaN(started.getTime())) return alertUi.value('unavailableTime');
    const minutes = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
    return minutes < 60 ? alertUi.value('minutes', { minutes }) : alertUi.value('hours', { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, '0') });
  }

  function updateFieldDashboard(visit) {
    const done = visits.filter(isVisitDone).length;
    const total = visits.length;
    const pending = Math.max(total - done, 0);
    const compliance = computeDocsCompliance();
    const docsReady = Boolean(compliance.readyForOperation);
    opsSnapshot = { docsReady, done, total, pending, docsBlockReason: compliance.reason || "" };
    docsBlockReasonCopy = documentSourceCopies.get(compliance) || opsSnapshot.docsBlockReason;
    const readyDocs = Object.values(compliance.states).filter((state) => state.code === "VALID").length;
    const photoCount = visitPhotos.length;
    const location = visit ? visitLocation(visit) : null;

    const focusNow = $("#fieldFocusNow");
    const focusMeta = $("#fieldFocusMeta");
    const progressValue = $("#fieldProgressValue");
    const progressMeta = $("#fieldProgressMeta");
    const docsValue = $("#fieldDocsValue");
    const docsMeta = $("#fieldDocsMeta");
    const photosValue = $("#fieldPhotosValue");
    const photosMeta = $("#fieldPhotosMeta");
    const heroLabel = $("#fieldHeroLabel");
    const heroActions = $("#fieldHeroActions");
    const heroTile = $("#fieldHeroTile");
    const userName = String(window.CristalAuth?.parseUser?.().name || activeTechnician?.name || "").trim();
    const firstName = userName ? userName.split(/\s+/)[0] : "Técnico";
    const exceptions = collectOperationalExceptions().filter((item) => item && item.id);
    ensureOperationalExceptionState(exceptions);
    const openExceptions = exceptions;
    const openAlerts = openExceptions.length;
    const hasWaterOpen = openExceptions.some((item) => item.category === "WATER_OPEN");
    const hasManualPump = openExceptions.some((item) => item.category === "PUMP_MANUAL");
    const hasActiveVisit = Boolean(visit);
    const hasIntervention = hasActiveIntervention(visit);
    const hasP0 = openExceptions.some((item) => String(item.priority || "").toUpperCase() === "P0") || hasManualPump;

    function setHeroButton(index, text, action, variant = "secondary") {
      const button = heroActions?.querySelector(`button:nth-child(${index + 1})`);
      if (!button) return;
      if (!text || !action) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      alertUi.bind(button, text);
      button.dataset.heroAction = action;
      button.classList.remove("primary", "secondary");
      button.classList.add(variant);
    }

    document.body.dataset.fieldMode = hasActiveVisit ? "active" : "free";
    document.body.dataset.fieldPriority = hasP0 ? "p0" : "normal";
    if (heroTile) heroTile.classList.toggle("p0", hasP0);

    if (heroLabel) {
      alertUi.bind(heroLabel, hasP0 ? alertUi.value('dashPriority') : alertUi.value('dashGreeting', { name: userName ? firstName : alertUi.value('dashTechnician') }));
    }

    if (focusNow) {
      if (hasP0) {
        alertUi.bind(focusNow, alertUi.value(hasWaterOpen ? 'dashWater' : hasManualPump ? 'dashPump' : openExceptions.some(item => item.category === 'REMINDER_UNAVAILABLE') ? 'dashUnknown' : 'dashCritical'));
      } else if (visit) {
        alertUi.bind(focusNow, visit.pool?.name || alertUi.value(hasManualPump ? 'dashPump' : 'sourcePool'));
      } else {
        alertUi.bind(focusNow, alertUi.value(openAlerts ? (hasWaterOpen ? 'dashWaterActive' : hasManualPump ? 'dashPump' : 'dashAlerts') : 'dashFree'));
      }
    }
    if (focusMeta) {
      if (hasP0) {
        alertUi.bind(focusMeta, alertUi.value('dashCriticalMeta'));
      } else if (visit) {
        alertUi.bind(focusMeta, alertUi.value('dashVisitMeta', { client: visit.client?.name || alertUi.value('sourceClient'), location: location?.address || visit.pool?.zone || alertUi.value('dashLocation') }));
      } else {
        const statParts = [
          alertUi.value(total === 1 ? 'dashPoolOne' : 'dashPoolMany', { count: total }),
          alertUi.value(openAlerts === 1 ? 'dashAlertOne' : 'dashAlertMany', { count: openAlerts }),
          alertUi.value('dashWaterCount', { count: hasWaterOpen ? 1 : 0 }),
          alertUi.value('dashPumpCount', { count: hasManualPump ? 1 : 0 }),
        ];
        alertUi.bind(focusMeta, alertUi.value('dashFreeMeta', { stats: alertUi.join(statParts, ' · ') }));
      }
    }

    if (progressValue) alertUi.bind(progressValue, visit ? `${done} / ${total}` : `${total} / ${total}`);
    if (progressMeta) alertUi.bind(progressMeta, alertUi.value(visit ? (pending ? 'dashPendingVisits' : 'dashRoundReady') : 'dashScheduleFree', { count: pending }));

    if (docsValue) alertUi.bind(docsValue, alertUi.value(!documentsLoaded ? 'dashValidating' : docsReady ? 'dashValid' : 'dashReview'));
    if (docsMeta) alertUi.bind(docsMeta, alertUi.value(!documentsLoaded ? 'dashVehicleConfirm' : docsReady ? docsSource === 'live' ? 'dashDocsConfirmed' : 'dashDocsCached' : 'dashDocsMissing'));

    const pendingPhotos = visitPhotos.filter(photo => photo.status !== "uploaded").length;
    const pendingRevision = ++fieldPendingRevision;
    if (photosValue) alertUi.bind(photosValue, '…');
    if (photosMeta) alertUi.bind(photosMeta, alertUi.value('dashCheckingSubmissions'));
    Promise.resolve(visit ? window.CWFieldOffline.pending(visit.id, visit.visitType || 'REGULAR') : false).then(pendingVisit => {
      if (!sameFieldSession() || pendingRevision !== fieldPendingRevision) return;
      if (photosValue) alertUi.bind(photosValue, String(pendingPhotos + (pendingVisit ? 1 : 0)));
      if (photosMeta) alertUi.bind(photosMeta, alertUi.value(pendingVisit ? 'dashVisitPending' : pendingPhotos ? 'dashPhotosPending' : 'dashPendingSubmissions'));
      setTileTone('#fieldPhotosTile', pendingPhotos || pendingVisit ? 'warn' : 'ok');
    }).catch(() => { if (sameFieldSession() && pendingRevision === fieldPendingRevision) { if (photosValue) alertUi.bind(photosValue, '?'); if (photosMeta) alertUi.bind(photosMeta, alertUi.value('dashSubmissionsUnknown')); setTileTone('#fieldPhotosTile','warn'); } });

    if (heroActions) {
      heroActions.hidden = false;
      if (hasP0) {
        setHeroButton(0, alertUi.value('dashTreat'), "p0", "primary");
        setHeroButton(1, alertUi.value('dashContinue'), "continue", "secondary");
        setHeroButton(2, alertUi.value('dashContact'), "contact", "secondary");
      } else if (!hasActiveVisit) {
        setHeroButton(0, alertUi.value('dashRefresh'), "refresh", "primary");
        setHeroButton(1, alertUi.value('dashAgenda'), "agenda", "secondary");
        setHeroButton(2, alertUi.value('dashContact'), "contact", "secondary");
      } else if (!isRegularVisit(visit) && isVisitDone(visit)) {
        setHeroButton(0, alertUi.value('dashExtra'), "continue", "primary");
        setHeroButton(1, alertUi.value('dashNavigate'), "map", "secondary");
        setHeroButton(2, alertUi.value('dashContact'), "contact", "secondary");
      } else if (hasIntervention) {
        setHeroButton(0, alertUi.value('dashContinue'), "continue", "primary");
        setHeroButton(1, alertUi.value('dashNavigate'), "map", "secondary");
        setHeroButton(2, alertUi.value('dashContact'), "contact", "secondary");
      } else {
        setHeroButton(0, alertUi.value('dashOpen'), "openVisit", "primary");
        setHeroButton(1, alertUi.value('dashNavigate'), "map", "secondary");
        setHeroButton(2, alertUi.value('dashContact'), "contact", "secondary");
      }
    }

    const freeMode = !visit;
    setTileTone("#fieldProgressTile", freeMode ? "" : (pending ? "" : "ok"));
    setTileTone("#fieldDocsTile", freeMode ? "" : (docsReady ? "ok" : "warn"));
    setTileTone("#fieldPhotosTile", "warn");
    const progressTile = $("#fieldProgressTile");
    const docsTile = $("#fieldDocsTile");
    const photosTile = $("#fieldPhotosTile");
    if (progressTile) progressTile.hidden = freeMode;
    if (docsTile) docsTile.hidden = freeMode;
    if (photosTile) photosTile.hidden = freeMode;
    const routeCard = $("#routeCard");
    const dayVisitsCard = $("#dayVisitsCard");
    if (routeCard) routeCard.hidden = freeMode;
    if (dayVisitsCard) dayVisitsCard.hidden = freeMode;
    renderCrewStatus();
    renderInterruptBoard();
  }

  function renderInterruptBoard() {
    const card = $("#interruptCard");
    const summary = $("#interruptSummary");
    const list = $("#interruptList");
    if (!card || !summary || !list) return;

    const exceptions = collectOperationalExceptions().filter((item) => item && item.id);
    const stateById = ensureOperationalExceptionState(exceptions);
    const openExceptions = exceptions;
    const history = readOpJournal().value.entries;
    const warning = [opJournalReadWarning, opJournalWriteWarning].filter(Boolean).join(' ');
    const warningCopy = opJournalReadWarning && opJournalWriteWarning ? alertUi.value('warnings', { read: opJournalReadCopy, write: opJournalWriteCopy }) : opJournalReadWarning ? opJournalReadCopy : opJournalWriteCopy;
    const bindWarning = root => {
      for (const node of root.querySelectorAll('[role="status"]')) { node.dataset.alertText = 'warning'; alertUi.bind(node, warningCopy); }
      for (const node of root.querySelectorAll('[data-interrupt-action="retry"]')) alertUi.bind(node, alertUi.value('retry'));
    };
    alertUi.clearTree(list); list.setAttribute('data-cw-no-i18n', '');

    const historyList = $("#fieldAlertHistoryList");
    if (historyList) {
      alertUi.clearTree(historyList); historyList.setAttribute('data-cw-no-i18n', '');
      historyList.innerHTML = `<p data-alert-text="intro">Leituras registadas nesta conta, neste dispositivo e neste dia. O fecho da causa é confirmado no respetivo registo.</p>${warning ? `<p role="status">${esc(warning)}</p>` : ''}` + renderExceptionHistory(history);
      alertUi.bind(historyList.querySelector('[data-alert-text="intro"]'), alertUi.value('historyIntro'));
      alertUi.bind(historyList.querySelector('[data-history-empty]'), alertUi.value('historyEmpty'));
      for (const row of historyList.querySelectorAll('[data-history-entry]')) for (const node of row.querySelectorAll('[data-alert-text]')) alertUi.bind(node, alertHistoryCopy.get(row.dataset.historyEntry)[node.dataset.alertText]);
      bindWarning(historyList);
    }
    const priorityNotice = $("#fieldPriorityNotice");
    if (priorityNotice) { priorityNotice.hidden = !openExceptions.length; alertUi.bind(priorityNotice, alertUi.value('notice', { count: openExceptions.length })); }

    if (!openExceptions.length) {
      card.hidden = !warning;
      alertUi.bind(summary, alertUi.value('empty'));
      list.innerHTML = warning ? `<p role="status">${esc(warning)}</p><button type="button" data-interrupt-action="retry">Rever histórico guardado</button>` : '';
      bindWarning(list);
      return;
    }

    card.hidden = false;
    alertUi.bind(summary, alertUi.value(openExceptions.length ? 'summary' : 'noCauses'));
    const rowCopy = new Map();
    const sourceById = new Map(openExceptions.map(item => [String(item.id), alertSourceCopies.get(item)]));

    const exceptionsHtml = openExceptions.map((item) => {
      const state = stateById[item.id] || {};
      const status = state.status || "OPEN";
      const canAssume = status === "OPEN";
      const canConfirm = ["ASSUMED", "OPEN"].includes(status);
      const createdAt = state.createdAt || item.createdAt || new Date().toISOString();
      const text = {
        priority: alertUi.value('priority', { priority: item.priority, status: alertUi.value(({ OPEN: 'unread', ASSUMED: 'handling', CONFIRMED: 'read' })[status] || 'unconfirmed') }),
        responsibility: alertUi.value('responsibility', { created: state.createdBy || item.createdBy || alertUi.value('system'), received: state.receivedBy || alertUi.value('technician') }),
        acknowledgement: alertUi.value('acknowledgement', { assumed: state.assumedBy || alertUi.value('pending'), confirmed: state.confirmedBy || alertUi.value('pending') }),
        elapsed: alertUi.value('elapsed', { duration: alertDurationCopy(createdAt) }),
      };
      rowCopy.set(String(item.id), text);
      return `
      <div class="interrupt-item" data-exception-id="${esc(item.id)}" data-exception-category="${esc(item.category)}">
        <strong>${esc(item.title)}</strong>
        <div>${esc(item.detail)}</div>
        <div class="muted" data-alert-text="priority">${esc(alertUi.format(text.priority))}</div>
        <div class="muted" data-alert-text="responsibility">${esc(alertUi.format(text.responsibility))}</div>
        <div class="muted" data-alert-text="acknowledgement">${esc(alertUi.format(text.acknowledgement))}</div>
        <div class="muted" data-alert-text="elapsed">${esc(alertUi.format(text.elapsed))}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${item.targetAction ? `<button type="button" data-interrupt-action="resolve" data-interrupt-target="${esc(item.targetAction)}" data-exception-id="${esc(item.id)}">Tratar causa</button>` : ""}
          ${canAssume ? `<button type="button" data-interrupt-action="assume" data-exception-id="${esc(item.id)}">Assumir</button>` : ""}
          ${canConfirm ? `<button type="button" data-interrupt-action="confirm" data-exception-id="${esc(item.id)}">Confirmar leitura</button>` : ""}
        </div>
      </div>
    `;
    }).join("");

    list.innerHTML = (warning ? `<p role="status">${esc(warning)}</p><button type="button" data-interrupt-action="retry">Rever histórico guardado</button>` : '') + exceptionsHtml;
    bindWarning(list);
    for (const row of list.querySelectorAll('[data-exception-category]')) {
      const source = sourceById.get(row.dataset.exceptionId);
      if (source) { alertUi.bind(row.querySelector(':scope > strong'), source.title); alertUi.bind(row.querySelector(':scope > strong + div'), source.detail); }
      for (const node of row.querySelectorAll('[data-alert-text]')) alertUi.bind(node, rowCopy.get(row.dataset.exceptionId)[node.dataset.alertText]);
      for (const node of row.querySelectorAll('[data-interrupt-action]')) alertUi.bind(node, alertUi.value(node.dataset.interruptAction));
    }
    waterUi.prune();
    for (const node of list.querySelectorAll('[data-exception-category="WATER_OPEN"] > strong')) waterUi.bind(node, waterUi.value('exceptionTitle'));
  }

  function mapsSearchUrl(visit) {
    const location = visitLocation(visit);
    if (location.lat && location.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
    }
    return location.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}` : null;
  }

  function navigationUrl(visit) {
    const location = visitLocation(visit);
    if (location.lat && location.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${location.lat},${location.lng}`)}&travelmode=driving`;
    }
    return mapsSearchUrl(visit);
  }

  function renderRouteCard(visit) {
    const title = $("#routeTitle");
    const summary = $("#routeSummary");
    const mapBox = $("#mapBox");
    const meta = $("#routeMeta");
    const navLink = $("#navLink");
    const mapsLink = $("#mapsLink");
    if (!title || !summary || !mapBox || !meta || !navLink || !mapsLink) return;

    if (!visit) {
      title.textContent = "Hoje livre";
      summary.textContent = "Não tens visitas atribuídas neste momento.";
      mapBox.innerHTML = '<div class="map-fallback">Atualiza a agenda ou comunica com o administrador.</div>';
      meta.innerHTML = `<span>Sem próxima piscina para navegar.</span>`;
      [navLink,mapsLink].forEach(link=>{link.removeAttribute("href");link.setAttribute("aria-disabled","true");});
      return;
    }

    const location = visitLocation(visit);
    const poolName = visit.pool?.name || "Piscina";
    const clientName = visit.client?.name || "Cliente";
    title.textContent = poolName;
    summary.textContent = `${clientName} - ${visit.status || "Pendente"}`;
    for(const [link,url] of [[navLink,navigationUrl(visit)],[mapsLink,mapsSearchUrl(visit)]]){
      if(url){link.href=url;link.removeAttribute('aria-disabled');}
      else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
    }

    if (location.lat && location.lng) {
      const delta = 0.008;
      const bbox = [
        location.lng - delta,
        location.lat - delta,
        location.lng + delta,
        location.lat + delta,
      ].join("%2C");
      mapBox.innerHTML = `
        <iframe
          id="fieldMapFrame"
          title="Mapa da proxima piscina"
          loading="lazy"
          src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${encodeURIComponent(`${location.lat},${location.lng}`)}">
        </iframe>
        <div class="map-overlay"><span>Destino</span><strong>${esc(poolName)}</strong></div>
      `;
      meta.innerHTML = `
        <span>Coordenadas: ${esc(location.lat.toFixed(6))}, ${esc(location.lng.toFixed(6))}</span>
        <span>${esc(location.address || "Morada nao indicada")}</span>
      `;
      return;
    }

    mapBox.innerHTML = `
      <div class="map-fallback">
        <div>
          <strong>Sem coordenadas GPS nesta piscina.</strong><br>
          ${location.address ? "A navegação abre pela morada/zona registada." : "Sem morada confirmada. Peça a localização ao escritório antes de navegar."}
        </div>
      </div>
    `;
    meta.innerHTML = `<span>${esc(location.address || "Morada ou zona por confirmar")}</span>`;
  }

  function readingNumber(value) {
    const raw = String(value ?? "").replace(",", ".").trim();
    if (!raw) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  function updateReferenceStatus(input) {
    if (!input) return;
    const min = readingNumber(input.dataset.min);
    const max = readingNumber(input.dataset.max);
    const value = readingNumber(input.value);
    const status = $(`#${input.id}Status`);
    if (!status || min === null || max === null) return;

    status.className = "range-status";
    if (value === null) {
      status.textContent = "Por medir";
      return;
    }

    if (value < min) {
      status.textContent = "Baixo";
      status.classList.add("low");
      return;
    }

    if (value > max) {
      status.textContent = "Alto";
      status.classList.add("high");
      return;
    }

    status.textContent = "OK";
    status.classList.add("ok");
  }

  function updateAllReferenceStatuses() {
    ["ph", "chlorine", "alkalinity", "orp"].forEach((id) => updateReferenceStatus($(`#${id}`)));
  }

  function docButton(href, label) {
    const protectedDownload = (String(href || "").startsWith("/api/guides/") || String(href || "").startsWith("/api/transport-guide-documents/")) ? " data-auth-download" : "";
    return `<a class="doc-btn"${protectedDownload} href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }

  function renderItems(items, mode) {
    return window.CWFieldMaterials.list(items, mode === 'work' ? 'balance' : 'transport');
  }

  function renderUsage(items) {
    return window.CWFieldMaterials.list(items, 'usage');
  }

  function movementNotesLabel(move) {
    const notes = move?.userNotes || move?.notes || "";
    if (!notes) return "";
    try {
      const parsed = JSON.parse(notes);
      return parsed?.userNotes || "";
    } catch (_) {
      return notes;
    }
  }

  function paintDocumentText() {
    const copy = window.CWFieldDocumentCopy, language = document.documentElement.lang;
    document.querySelectorAll('.field-panel-docs [data-doc-copy]').forEach(node => {
      const summary = node.closest('[data-consumption-summary]'), section = node.closest('[data-confirmed-at]');
      node.textContent = copy.text(node.dataset.docCopy, {
        shown: summary?.dataset.shown, total: summary?.dataset.total, available: summary?.dataset.available,
        date: section?.dataset.confirmedAt ? copy.date(section.dataset.confirmedAt, language) : '',
      }, language);
    });
    document.querySelectorAll('.field-panel-docs time[data-doc-date]').forEach(node => { node.textContent = copy.date(node.dateTime, language); });
  }
  new MutationObserver(() => { paintDocumentText(); renderDoseRows(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  function renderMovements(data) {
    const summary = window.CWFieldDocuments.consumptionSummary(data), { rows, available, total } = summary;
    const label = rows.length ? (total === null ? 'legacy' : 'confirmed') : (total === null ? 'legacyEmpty' : 'empty');
    return `<section data-consumption-summary data-shown="${rows.length}" data-available="${available}" data-total="${total ?? ''}" data-cw-no-i18n>
      <h3 class="doc-subtitle" data-doc-copy="summary"></h3>
      <p data-consumption-count data-doc-copy="${label}"></p>
      <div class="doc-items">${rows.map(move => `
        <article class="doc-item" data-consumption-id="${move.id}">
          <span>${esc(move.itemName)}<small>${esc(move.locationLabel || move.location || 'Local não indicado')}</small></span>
          <strong>${esc(move.quantity)} ${move.unit === null ? '<span data-doc-copy="unit"></span>' : esc(move.unit)}</strong>
          <time data-doc-date datetime="${esc(move.createdAt)}"></time>
          ${movementNotesLabel(move) ? `<div class="muted">${esc(movementNotesLabel(move))}</div>` : ''}
        </article>
      `).join('')}</div>
      <div class="doc-actions"><a class="doc-btn" data-complete-movements href="/technician-guide#movementPanel" data-doc-copy="full"></a></div>
      <p class="muted" data-doc-copy="connection"></p>
    </section>`;
  }

  function renderStockSummary(items) {
    return window.CWFieldMaterials.summary(items);
  }

  const doseText = (key, values) => window.CWFieldDocumentCopy.text(key, values, document.documentElement.lang);
  function productOptions(row) {
    const R = window.CWVisitProductIdentity, rows = Array.isArray(activeWorkStock) ? activeWorkStock : [];
    const selection = window.CWProductCatalogue.selection(rows, activeWorkGuide?.id, row, productCatalogue.view);
    const options = selection.entries.map(({ item, position, valid, chosen, pinned }) => {
      const qty = Number.isFinite(item.quantity) ? item.quantity : doseText('quantityUnknown');
      const label = `${doseText('productRow', { number: position + 1 })} · #${item.id} · ${item.name ?? doseText('materialNameUnknown')} · ${qty} ${R.text(item.unit) ? item.unit : doseText('unit')}${pinned ? ' · ' + doseText('cataloguePinned') : ''}`;
      return `<option value="${esc(item.id)}" data-catalogue-result="${pinned ? 'pinned' : 'page'}" ${chosen ? 'selected' : ''} ${valid ? '' : 'disabled'}>${esc(label)}</option>`;
    }).join('');
    const stored = selection.saved
      ? `<option value="saved" selected>${esc(row.name || doseText('productUnknown'))} · ${esc(row.unit || doseText('unit'))} · ${esc(doseText('productSaved'))}</option>` : '';
    return `<option value="" ${!selection.entries.some(entry => entry.chosen) && !stored ? 'selected' : ''}>${esc(doseText('productChoose'))}</option>${stored}${options}`;
  }

  function ensureDoseRow() {
    const row = {
      localId: `dose-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: "",
      quantity: "",
      unit: "",
      notes: "",
    };
    usedProducts.push(row);
    renderDoseRows();
    saveCurrentDraft();
  }

  function productStockForRow(row) {
    try { return window.CWVisitProductIdentity.resolve(activeWorkStock || [], row, activeWorkGuide?.id); }
    catch (_) { return null; }
  }

  function updateDoseRow(localId, field, value) {
    const row = usedProducts.find(item => item.localId === localId);
    if (!row) return;
    if (field === 'name') {
      if (value === 'saved') return;
      if (!value) { delete row.workGuideItemId; delete row.workGuideId; row.name = ''; row.unit = ''; }
      else {
        const stock = (activeWorkStock || []).find(item => item.id === Number(value));
        try { Object.assign(row, window.CWVisitProductIdentity.fromItem(stock, activeWorkGuide?.id)); }
        catch (error) { alertUi.notify(alertUi.failure(error)); return; }
      }
    } else row[field] = value;
    renderDoseRows();
    saveCurrentDraft();
  }

  function removeDoseRow(localId) {
    usedProducts = usedProducts.filter((item) => item.localId !== localId);
    renderDoseRows();
    saveCurrentDraft();
  }

  function renderDoseRows() {
    const box = $("#doseRows");
    if (!box) return;
    if (!productCatalogue) { const host = document.createElement('div'); box.before(host); productCatalogue = window.CWProductCatalogue.mount(host, renderDoseRows); }
    productCatalogue.update({ key: visitKey(), active: sameFieldSession(), disabled: !current(), available: !!current() && !!activeWorkGuide, items: current() ? activeWorkStock : [], language: document.documentElement.lang });
    if (!usedProducts.length) {
      box.innerHTML = `<div class="dose-empty" data-cw-no-i18n>${esc(doseText('productEmpty'))}</div>`;
      visitDraftManager.paint(currentDraftEntry);
      return;
    }
    box.innerHTML = usedProducts.map((row) => `
      <div class="dose-row" data-dose-id="${esc(row.localId)}" data-cw-no-i18n>
        <select data-dose-field="name" aria-label="${esc(doseText('productUsed'))}">
          ${productOptions(row)}
        </select>
        <input data-dose-field="quantity" inputmode="decimal" aria-label="${esc(doseText('productQuantity'))}" placeholder="${esc(doseText('productQuantity'))}" value="${esc(row.quantity ?? "")}">
        <input data-dose-field="unit" placeholder="Un." value="${esc(row.unit ?? "")}" readonly aria-label="${esc(doseText('productUnit'))}">
        <button class="dose-remove" type="button" data-dose-remove="${esc(row.localId)}">${esc(doseText('productRemove'))}</button>
      </div>
    `).join("");
    visitDraftManager.paint(currentDraftEntry);
  }

  function normalizedUsedProducts() {
    if (usedProducts.length > 50) throw alertUi.error('Registe no máximo 50 linhas de produtos por visita.', alertUi.value('productLineLimit'));
    return usedProducts.map(product => window.CWVisitProductIdentity.payload(product));
  }

  async function validateUsedProducts(products) {
    if (!products.length) return;
    if (!activeWorkGuide?.id) await loadGuides(false);
    if (!activeWorkGuide?.id) throw alertUi.error('Sem guia de obra ativa para deduzir produtos.', alertUi.value('productGuideMissing'));
    const totals = new Map();
    for (const product of products) {
      if (!window.CWVisitProductIdentity.hasIdentity(product)) throw alertUi.error('Selecione novamente cada produto na guia para confirmar a linha e a unidade. O rascunho foi conservado.', alertUi.value('productReselect'));
      const stock = productStockForRow(product);
      if (!stock || !Number.isFinite(stock.quantity)) throw alertUi.error('A linha do produto mudou ou já não pertence à guia atual. Atualize e reveja a seleção.', alertUi.value('productLineChanged'));
      const previous = totals.get(stock.id) || [], quantities = [...previous, product.quantity]; totals.set(stock.id, quantities);
      if (Number(window.CWFieldMaterials.sum(quantities)) > stock.quantity) throw alertUi.error(`Stock insuficiente para ${product.name}. Disponível: ${stock.quantity} ${stock.unit}.`, alertUi.value('productStockInsufficient', { name: product.name, quantity: stock.quantity, unit: stock.unit }));
    }
  }


  function listOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function uniqueByKey(items, keyForItem) {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyForItem(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function accessTypeLabel(type) {
    const normalized = String(type || "").trim().toUpperCase();
    if (normalized.includes("GATE") || normalized.includes("PORT")) return "Portao";
    if (normalized.includes("ALARM") || normalized.includes("ALARME")) return "Alarme";
    if (normalized.includes("BOX") || normalized.includes("CAIXA")) return "Caixa de chaves";
    if (normalized.includes("KEY") || normalized.includes("CHAVE")) return "Chave";
    if (normalized.includes("CODE") || normalized.includes("COD")) return "Codigo";
    return "Acesso";
  }

  function visibleAccesses(visit) {
    const poolKeys = listOf(visit?.pool?.keyAccesses)
      .filter((key) => key && key.active !== false && key.visibleToTechnician !== false)
      .map((key) => ({
        source: "Piscina",
        code: key.keyCode,
        title: "Chave / codigo da piscina",
        type: "KEY",
        instructions: key.description || "",
        required: key.requiredForVisit !== false
      }));

    const clientKeys = [
      ...listOf(visit?.client?.accesses),
      ...listOf(visit?.pool?.client?.accesses)
    ]
      .filter((key) => key && key.active !== false && key.visibleToTechnician !== false)
      .map((key) => ({
        source: "Cliente",
        code: key.codeValue,
        title: key.title || "Chave / codigo do cliente",
        type: key.accessType,
        instructions: key.instructions || "",
        required: true
      }));

    return uniqueByKey([...poolKeys, ...clientKeys].filter((key) => key.code || key.instructions), (key) => (
      `${key.source}:${key.type || ""}:${key.code || ""}:${key.instructions || ""}`
    ));
  }

  function repeatLabel(rule) {
    const value = String(rule || "").trim();
    if (!value || value === "NONE") return "";
    if (value === "WEEKLY") return "Repeticao semanal";
    if (value === "MONTHLY") return "Repeticao mensal";
    if (value === "QUARTERLY") return "Repeticao trimestral";
    if (value === "SEMIANNUAL") return "Repeticao semestral";
    if (value === "YEARLY" || value === "ANNUAL") return "Repeticao anual";
    if (value.startsWith("CUSTOM")) return value.replace(/^CUSTOM[:|]?/i, "Repeticao personalizada: ");
    return value;
  }

  function reminderIsRecurring(reminder) {
    const repeat = String(reminder?.repeatRule || "").trim().toUpperCase();
    return Boolean(repeat && repeat !== "NONE");
  }

  function normalizeReminder(reminder, source, model) {
    const due = reminder?.dueDate || reminder?.dueAt || null;
    const dueDate = due ? new Date(due) : null;
    const hasValidDue = dueDate && !Number.isNaN(dueDate.getTime());
    const recurring = reminderIsRecurring(reminder);
    const overdue = Boolean(hasValidDue && dueDate < new Date());
    return {
      id: reminder?.id,
      model,
      source,
      title: reminder?.title || "Lembrete",
      description: reminder?.description || "",
      due,
      category: reminder?.category || "",
      priority: reminder?.priority || "NORMAL",
      repeatRule: reminder?.repeatRule || "",
      recurring,
      overdue,
      label: overdue ? (recurring ? "Lembrete recorrente atrasado" : "Lembrete atrasado") : (recurring ? "Lembrete recorrente" : "Lembrete pontual")
    };
  }

  function visibleReminders(visit) {
    const open = reminder => reminder && reminder.isCompleted !== true && !reminder.completedAt && !["DONE", "CLOSED", "COMPLETED", "RESOLVED", "CANCELLED", "CANCELED"].includes(String(reminder.status || "").toUpperCase());
    const reminders = [
      ...listOf(visit?.pool?.operationalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Piscina", "operational")),
      ...listOf(visit?.client?.operationalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "operational")),
      ...listOf(visit?.pool?.client?.operationalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "operational")),
      ...listOf(visit?.pool?.generalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Piscina", "general")),
      ...listOf(visit?.client?.generalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "general")),
      ...listOf(visit?.pool?.client?.generalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "general"))
    ].filter((reminder) => reminder && reminder.title);

    return uniqueByKey(reminders, (reminder) => (
      `${reminder.model}:${reminder.source}:${reminder.id || ""}:${reminder.title}:${reminder.due || ""}`
    ));
  }

  function reminderClass(reminder) {
    if (reminder.overdue) return "reminder-overdue";
    return reminder.recurring ? "reminder-permanent" : "reminder-temporary";
  }

  function renderVisitNoticeStrip(visit, accesses, reminders, notes = "") {
    const strip = $("#visitNoticeStrip");
    const nextCard = document.querySelector(".next");
    if (!strip) return;

    const returnInstructions = visit?.reason === "INCOMPLETE_RETURN" ? String(visit.returnInstructions || "Confirme as instruções com o escritório") : "";
    const hasNotices = Boolean(visit && (accesses.length || reminders.length || notes || returnInstructions));
    if (nextCard) nextCard.classList.toggle("has-alerts", hasNotices);
    if (!hasNotices) {
      strip.hidden = true;
      strip.innerHTML = "";
      return;
    }

    const pills = [
      notes ? '<span class="visit-notice-pill reminder">Notas da piscina</span>' : "",
      accesses.length ? `<span class="visit-notice-pill access">${accesses.length} acesso(s)</span>` : "",
      reminders.length ? `<span class="visit-notice-pill reminder">${reminders.length} lembrete(s)</span>` : ""
    ].filter(Boolean).join("");

    strip.hidden = false;
    strip.innerHTML = `
      ${returnInstructions ? `<b>Regresso agendado pelo escritório</b><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(returnInstructions)}</p>` : "<b>Atencao antes de entrar</b>"}
      <div class="visit-notice-pills">${pills}</div>
      <small>Confirma codigos, chaves e instrucoes desta piscina antes de iniciar ou concluir a visita.</small>
    `;
  }

  function maybeNotifyVisitNotices(visit, accesses, reminders, notes) {
    const total = accesses.length + reminders.length + (notes ? 1 : 0);
    if (!visit || !total) {
      notifiedVisitNoticeKey = "";
      return;
    }
    const key = `${visitKey(visit)}:${accesses.length}:${reminders.length}:${notes || ""}`;
    if (notifiedVisitNoticeKey === key) return;
    notifiedVisitNoticeKey = key;
    toast(`Atencao: esta visita tem ${total} aviso(s), notas ou lembretes.`);
  }

  function renderAccessCard(visit) {
    const card = $("#accessCard");
    const list = $("#accessList");
    if (!card || !list) return;

    if (!visit) {
      card.hidden = false;
      card.classList.remove("has-alerts");
      renderVisitNoticeStrip(null, [], []);
      list.innerHTML = '<div class="muted">Sem piscina selecionada.</div>';
      return;
    }

    const accesses = visibleAccesses(visit);
    const reminders = visibleReminders(visit);
    const notes = typeof visit.pool?.notes === "string" ? visit.pool.notes.trim() : "";
    const hasNotices = accesses.length || reminders.length || notes;
    card.hidden = false;
    card.classList.toggle("has-alerts", Boolean(hasNotices));
    renderVisitNoticeStrip(visit, accesses, reminders, notes);
    maybeNotifyVisitNotices(visit, accesses, reminders, notes);

    if (!hasNotices) {
      list.innerHTML = `
        <div class="access-item">
          <div class="access-code">Sem código, nota ou lembrete registado</div>
          <div class="access-meta">Se esta piscina precisar de codigo de portao, alarme, chave ou aviso permanente, o administrador deve registar na ficha do cliente ou da piscina.</div>
        </div>
      `;
      return;
    }

    const accessHtml = accesses.map((access) => `
      <div class="access-item access-code-item">
        <span class="chip">${esc(accessTypeLabel(access.type))} - ${esc(access.source)}${access.required ? " - obrigatorio" : ""}</span>
        <div class="access-code">${esc(access.code || "Sem codigo")}</div>
        <div class="access-meta">${esc(access.title || "")}${access.instructions ? `<br>${esc(access.instructions)}` : ""}</div>
      </div>
    `).join("");

    const reminderHtml = reminders.map((reminder) => {
      const repeat = repeatLabel(reminder.repeatRule);
      const when = reminder.due ? formatDate(reminder.due) : "Sem data definida";
      const meta = [
        reminder.description,
        `Quando: ${when}`,
        repeat
      ].filter(Boolean).map((part) => esc(part)).join("<br>");
      return `
        <div class="access-item ${reminderClass(reminder)}">
          <span class="chip"><span>${esc(reminder.label)}</span> - <span>${esc(reminder.source)}</span></span>
          <div class="access-code" data-cw-no-i18n>${esc(reminder.title)}</div>
          <div class="access-meta">${meta}</div>
        </div>
      `;
    }).join("");

    const notesHtml = notes ? `<div class="access-item reminder-permanent" data-pool-notes><span class="chip">Notas da piscina</span><div class="access-meta" data-cw-no-i18n style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(notes)}</div></div>` : "";
    list.innerHTML = `${notesHtml}${accessHtml}${reminderHtml}`;
  }

  function photoTypeKey(type) {
    const keys = { BEFORE: 'before', AFTER: 'after', PROBLEM: 'problem', ACCESS: 'access' };
    return Object.hasOwn(keys, type) ? keys[type] : 'record';
  }
  function photoTypeLabel(type) { return photoUiText(photoTypeKey(type)); }

  function photoStatusText(photo) {
    if (photo.status === "uploaded") return photoUiText('uploaded');
    if (photo.status === "uploading") return photoUiText('uploading');
    return photo.error ? `Pendente: ${photo.error}` : photoUiText('pending');
  }

  function renderPhotoList() {
    const list = $("#photoList");
    if (!list) return;
    updateFieldDashboard(current());

    if (!visitPhotos.length) {
      list.innerHTML = '<div class="muted">Ainda sem fotografias nesta visita.</div>';
      bindPhotoUi(list.firstElementChild, 'empty');
      return;
    }

    list.innerHTML = visitPhotos.map((photo) => `
      <div class="photo-item" data-photo-id="${esc(photo.localId)}">
        <img class="photo-thumb" ${photo.visitType === 'EXTRA' && photo.status === 'uploaded' ? `data-extra-photo-url="${esc(photo.url)}"` : `src="${esc(photo.previewUrl || photo.url || "")}"`} alt="Fotografia ${esc(photoTypeLabel(photo.type))}">
        <div class="photo-meta">
          <strong>${esc(photoTypeLabel(photo.type))}</strong>
          <span class="photo-status ${photo.status === "uploaded" ? "ok" : "warn"}">${esc(photoStatusText(photo))}</span>
          <span class="muted">${esc(photo.fileName || "Foto do servico")}</span>
          <div class="photo-mini">
            ${photo.status !== "uploaded" ? `<button type="button" data-photo-retry="${esc(photo.localId)}">Enviar</button>` : ""}
            ${photo.status !== "uploaded" ? `<button type="button" data-photo-remove="${esc(photo.localId)}">Remover</button>` : ""}
          </div>
        </div>
      </div>
    `).join("");

    for (const node of list.querySelectorAll('[data-photo-id]')) {
      const photo = visitPhotos.find(item => item.localId === node.dataset.photoId);
      if (!photo) continue;
      bindPhotoUi(node.querySelector('strong'), photoTypeKey(photo.type));
      bindPhotoUi(node.querySelector('.photo-thumb'), 'alt', { kind: photoTypeKey(photo.type) }, 'alt');
      bindPhotoUi(node.querySelector('[data-photo-retry]'), 'send');
      bindPhotoUi(node.querySelector('[data-photo-remove]'), 'remove');
      if (!photo.fileName) bindPhotoUi(node.querySelector('.photo-meta > .muted'), 'file');
      if (!photo.error || ['uploaded', 'uploading'].includes(photo.status)) bindPhotoUi(node.querySelector('.photo-status'), ['uploaded', 'uploading'].includes(photo.status) ? photo.status : 'pending');
      if (!photo?.error || ['uploaded', 'uploading'].includes(photo.status)) continue;
      const captured = photoErrors.get(photo);
      bindPhotoError(node.querySelector('.photo-status'), { detail: photo.error, copy: captured?.detail === photo.error ? captured.copy : undefined, wrapper: 'pending' });
    }

    for (const node of list.querySelectorAll('[data-extra-photo-url]')) {
      const url = node.dataset.extraPhotoUrl;
      if (photoPreviewCache.has(url)) { node.src = photoPreviewCache.get(url); continue; }
      if (!/^\/uploads\/(?:qa\/)?extra-visit-/.test(url)) continue;
      fetch(url,{headers:{Authorization:'Bearer '+fieldWriteSession.token},cache:'no-store'}).then(async response=>{
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error('Fotografia por confirmar.');
        const file=await response.blob(); if (!sameFieldSession()) return;
        const preview=URL.createObjectURL(file); photoPreviewCache.set(url,preview); if(node.isConnected)node.src=preview;
      }).catch(()=>{if(node.isConnected)bindPhotoUi(node, 'savedAlt', {}, 'alt');});
    }

    list.querySelectorAll("[data-photo-retry]").forEach((button) => {
      button.addEventListener("click", () => {
        const photo = visitPhotos.find((item) => item.localId === button.dataset.photoRetry);
        if (photo) uploadPhoto(photo);
      });
    });

    list.querySelectorAll("[data-photo-remove]").forEach((button) => {
      button.addEventListener("click", async () => {
        const photo = visitPhotos.find((item) => item.localId === button.dataset.photoRemove);
        if (!photo || !sameFieldSession()) return;
        button.disabled = true;
        try {
          await window.CWFieldPhotos.remove(photo.visitId || current()?.id, photo.localId, fieldWriteSession, photo.visitType || 'REGULAR');
          if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
          if (!sameFieldSession()) return;
          visitPhotos = visitPhotos.filter((item) => item.localId !== photo.localId);
          saveCurrentDraft(); renderPhotoList();
        } catch (error) { if (sameFieldSession()) photoErrorToast(error); }
        finally { button.disabled = false; }
      });
    });
  }

  async function uploadPhoto(photo) {
    const generation = fieldWriteGeneration;
    if (!sameFieldSession()) { photoFeedback('session'); return false; }
    const visit = visits.find(v => (v.visitType || 'REGULAR') === (photo?.visitType || 'REGULAR') && String(v.id) === String(photo?.visitId));
    if (photo?.status === 'uploading') return false;
    if (!visit?.id || !(photo?.file instanceof Blob)) {
      photo.status = "pending";
      photo.error = "Sem visita ativa";
      photoErrors.set(photo, { detail: photo.error, copy: Object.freeze(Object.fromEntries(photoErrorLanguages.map(language => [language, photoUiText('inactive', {}, language)]))) });
      renderPhotoList();
      return false;
    }

    photo.status = "uploading";
    photo.error = "";
    renderPhotoList();

    try {
      const data = await window.CWFieldPhotos.send(visit.id, photo.localId, fieldWriteSession, {}, visit.visitType || 'REGULAR');
      if (!sameFieldSession() || generation !== fieldWriteGeneration) return false;
      photo.status = "uploaded";
      photo.url = data.photo.url;
      photo.serverId = data.photo?.id || null;
      if (visitKey(current()) === visitKey(visit)) { saveCurrentDraft(); photoFeedback('confirmed'); renderPhotoList(); }
      return true;
    } catch (error) {
      photo.status = "pending";
      photo.error = error.message;
      photoErrors.set(photo, { detail: error.message, copy: window.CWFieldPhotos.errorCopy(error) });
      if (sameFieldSession() && generation === fieldWriteGeneration && visitKey(current()) === visitKey(visit)) renderPhotoList();
      return false;
    }
  }

  async function syncPendingPhotos(showFeedback = true) {
    if (!current()?.id) return false;
    const target = visitKey();
    const pending = visitPhotos.filter((photo) => photo.status !== "uploaded");
    if (!pending.length) {
      if (showFeedback) photoToast('alreadySynced');
      return true;
    }

    for (const photo of pending) {
      await uploadPhoto(photo);
      if (visitKey() !== target || !sameFieldSession()) return false;
    }

    const stillPending = visitPhotos.some((photo) => photo.status !== "uploaded");
    if (showFeedback) {
      photoToast(stillPending ? 'stillPending' : 'synced');
    }
    return !stillPending;
  }

  function photoFeedback(key) {
    const node = $('#photoFeedback');
    if(node){if(key)bindPhotoUi(node,key);else{clearPhotoUi(node);node.textContent='';}node.hidden=!key;}
  }

  function pickPhoto(type, gallery = false) {
    if (!requireExecutableVisit()) return;
    const input = $(gallery ? '#galleryPhotoInput' : '#photoInput');
    if (!input) return;
    selectedPhotoType = type || "AFTER";
    if (!sameFieldSession()) { photoFeedback('session'); return; }
    selectedPhotoContext = { visitId: current()?.id, visitKey:visitKey(), type: selectedPhotoType, generation: fieldWriteGeneration };
    input.value = "";
    try { input.click(); }
    catch(error){ photoFeedback('cameraFailed'); }
  }

  async function addSelectedPhoto(file, selection = selectedPhotoContext) {
    if (!file) return;
    if (!sameFieldSession() || (selection && (selection.generation !== fieldWriteGeneration || selection.visitKey !== visitKey()))) { photoFeedback('selectionChanged'); return; }
    if (!requireExecutableVisit()) return;
    const target = visitKey();
    if (!current()?.id) { photoFeedback('chooseVisit'); return; }
    if (!file.type.startsWith('image/') || !file.size || file.size > 25*1024*1024) {
      photoFeedback('invalid'); return;
    }
    const photo = {
      localId: crypto.randomUUID(),
      visitId: current()?.id, visitType:current()?.visitType || 'REGULAR', poolId:current()?.poolId || current()?.pool?.id,
      type: selection?.type || selectedPhotoType || "AFTER",
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
      error: "",
    };
    try { await window.CWFieldPhotos.save(photo.visitId,photo,fieldWriteSession, current()?.visitType || 'REGULAR'); }
    catch(error) { URL.revokeObjectURL(photo.previewUrl);photoFeedback('storageFailed');return; }
    if (!sameFieldSession() || target !== visitKey()) { URL.revokeObjectURL(photo.previewUrl); return; }
    photoFeedback('saved');
    visitPhotos.unshift(photo);
    saveCurrentDraft();
    renderPhotoList();
    uploadPhoto(photo);
  }

  function activeWaterReminders() {
    loadWaterRemindersFromStorage();
    return waterReminders.filter((reminder) => reminder.status !== "CLOSED" && reminderBelongsToCurrentContext(reminder));
  }

  function reminderBelongsToCurrentContext() { return sameFieldSession(); }

  function loadWaterRemindersFromStorage() {
    try { waterReminders = window.CWFieldReminders?.list('WATER_OPEN') || []; waterRemindersError = ''; waterRemindersErrorCopy = ''; }
    catch (error) { waterReminders = []; waterRemindersError = error.message; waterRemindersErrorCopy = window.CWFieldReminders?.presentation?.error(error) ?? error.message; }
  }

  function waterReminderLabelCopy(reminder) {
    const due = new Date(reminder.dueAt);
    if (Number.isNaN(due.getTime())) return waterUi.value('unknownTime');
    const now = new Date();
    if (reminder.status === "CLOSED") return waterUi.value('closedLabel');
    if (reminder.status === "OVERDUE") return waterUi.value('overdueLabel', { when: formatDate(due) });
    if (due <= now && reminder.status !== "CLOSED") return waterUi.value('lateLabel', { when: formatDate(due) });
    return waterUi.value('dueLabel', { when: formatDate(due) });
  }
  function waterReminderLabel(reminder) { return waterUi.format(waterReminderLabelCopy(reminder), 'pt'); }

  function waterReminderSyncBadge(reminder) {
    if (reminder.syncError) return '<span class="chip" data-water-list-text="sync" style="background:#fce4e4;border-color:#bd6464;color:#842020">Por confirmar</span>';
    if (reminder.serverId) return '<span class="chip" data-water-list-text="sync" style="background:#ddf4e7;border-color:#68a880;color:#185a30">Registado</span>';
    return '<span class="chip" data-water-list-text="sync" style="background:#fff0c6;border-color:#bd9c45;color:#604800">A sincronizar</span>';
  }

  function showWaterAlarmPopup(reminder) {
    const message = waterUi.value('alarmMessage', {
      header: waterUi.value('alarmHeader'),
      pool: reminder.poolName ? waterUi.value('alarmLine', { text: waterUi.value('alarmPool', { name: reminder.poolName }) }) : '',
      client: reminder.clientName ? waterUi.value('alarmLine', { text: waterUi.value('alarmClient', { name: reminder.clientName }) }) : '',
      note: reminder.note ? waterUi.value('alarmLine', { text: waterUi.value('alarmNote', { note: reminder.note }) }) : '',
      action: waterUi.value('alarmAction'),
    });
    setTimeout(() => waterUi.showAlarm(message), 80);
  }

  function renderWaterReminders() {
    const list = $("#waterReminderList");
    if (!list) return;
    waterUi.clearTree(list); list.setAttribute('data-cw-no-i18n', '');
    loadWaterRemindersFromStorage();
    if (waterRemindersError) { waterUi.bind(list, waterRemindersErrorCopy); renderInterruptBoard(); return; }
    const active = waterReminders.filter(row=>row.status!=="CLOSED" || !row.closeSyncedAt).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    if (!active.length) {
      list.innerHTML = '<div class="muted">Sem lembretes de agua aberta.</div>';
      waterUi.bind(list.firstElementChild, waterUi.value('empty'));
      renderInterruptBoard();
      return;
    }

    const rowCopies = new Map();
    list.innerHTML = active.map((reminder) => {
      const overdue = reminder.status === "OVERDUE" || new Date(reminder.dueAt) <= new Date();
      const label = waterReminderLabelCopy(reminder);
      rowCopies.set(String(reminder.localId), {
        pool: reminder.poolName || waterUi.value('pool'),
        place: waterUi.value('place', { client: reminder.clientName || waterUi.value('client'), location: reminder.location || waterUi.value('location') }),
        note: reminder.note || waterUi.value('note'),
        status: waterUi.value(reminder.status === 'CLOSED' ? 'closing' : overdue ? 'alarm' : 'opened'),
        sync: waterUi.value(reminder.syncError ? 'pending' : reminder.serverId ? 'recorded' : 'syncing'),
        due: label, close: waterUi.value('close'), alert: waterUi.value('alert'),
      });
      return `
        <div class="water-item ${overdue ? "overdue" : ""}" data-water-id="${esc(reminder.localId)}">
          <div class="water-line">
            <div>
              <strong data-water-list-text="pool">${esc(reminder.poolName || "Piscina")}</strong>
              <div class="muted" data-water-list-text="place">${esc(reminder.clientName || "Cliente")} - ${esc(reminder.location || "Localizacao por confirmar")}</div>
              <div class="muted" data-water-list-text="note">${esc(reminder.note || "Sem nota adicional")}</div>
              ${reminder.syncError ? `<div class="muted" style="color:#842020;background:#fce4e4;padding:4px;border-radius:4px"> ${esc(reminder.syncError)}</div>` : ""}
            </div>
            <div style="display:grid;gap:6px;justify-items:end">
              <span class="chip" data-water-list-text="status">${reminder.status === "CLOSED" ? "Fecho por enviar" : overdue ? "ALARME" : "Aberta"}</span>
              ${waterReminderSyncBadge(reminder)}
            </div>
          </div>
          <div class="doc-number" data-water-list-text="due" style="font-size:18px">${esc(waterUi.format(label, 'pt'))}</div>
          <div class="water-actions" style="${reminder.status === "CLOSED" ? "display:none" : ""}">
            <button class="close" type="button" data-water-list-text="close" data-water-close="${esc(reminder.localId)}">Agua fechada</button>
            <button class="alarm" type="button" data-water-list-text="alert" data-water-alarm="${esc(reminder.localId)}">Alertar equipa</button>
          </div>
        </div>
      `;
    }).join("");

    for (const row of list.querySelectorAll('[data-water-id]')) {
      const values = rowCopies.get(row.dataset.waterId);
      for (const node of row.querySelectorAll('[data-water-list-text]')) waterUi.bind(node, values[node.dataset.waterListText]);
    }
    list.querySelectorAll("[data-water-close]").forEach((button) => {
      button.addEventListener("click", () => closeWaterReminder(button.dataset.waterClose));
    });
    list.querySelectorAll("[data-water-alarm]").forEach((button) => {
      button.addEventListener("click", () => escalateWaterReminder(button.dataset.waterAlarm, true));
    });
    renderInterruptBoard();
  }

  function clearWaterTimer(localId) {
    const timer = waterTimers.get(localId);
    if (timer) clearTimeout(timer);
    waterTimers.delete(localId);
  }

  function scheduleWaterReminder(reminder) {
    if (!reminder?.localId || reminder.status !== "OPEN") return;
    clearWaterTimer(reminder.localId);
    const dueMs = new Date(reminder.dueAt).getTime();
    if (!Number.isFinite(dueMs)) return;
    const delay = Math.max(0, dueMs - Date.now());
    const timer = setTimeout(() => escalateWaterReminder(reminder.localId, false), delay);
    waterTimers.set(reminder.localId, timer);
  }

  function scheduleWaterReminders() {
    waterTimers.forEach((timer) => clearTimeout(timer));
    waterTimers.clear();
    activeWaterReminders().forEach(scheduleWaterReminder);
  }

  async function createWaterReminder() {
    try { await window.CWWaterReminders?.open(); } catch (error) { waterUi.error(error); }
  }

  async function closeWaterReminder(localId) {
    try { await window.CWWaterReminders?.close(localId); } catch (error) { waterUi.error(error); }
  }

  async function escalateWaterReminder(localId, manual) {
    if (!sameFieldSession()) return;
    const reminder = window.CWFieldReminders?.list('WATER_OPEN').find(item=>item.localId===localId);
    if (!reminder || reminder.status === 'CLOSED') return;
    try {
      await window.CWFieldReminders.mark('WATER_OPEN',localId,'alarm');
      if (navigator.vibrate) navigator.vibrate([300,120,300]);
      waterUi.notify(waterUi.value('alarmSaved'));
      if (!manual) showWaterAlarmPopup(reminder);
      await window.CWFieldReminders.sync();
    } catch (error) { waterUi.error(error); }
  }

  function renderDocumentSection(kind, section, source, vehicleId) {
    const box = $(({transport:'#transportGuideBox', work:'#workGuideBox', insurance:'#insuranceBox'})[kind]);
    if (!box) return;
    box.dataset.source = section ? source : source === 'loading' ? 'loading' : 'unavailable';
    if (!section) {
      delete box.dataset.confirmedAt;
      box.innerHTML = `<div data-cw-no-i18n><div class="doc-head"><span class="chip" data-doc-copy="${kind}"></span></div><p data-doc-provenance role="status" data-doc-copy="${box.dataset.source}"></p>${source === 'loading' ? '' : '<p class="muted" data-doc-copy="unavailableHelp"></p>'}</div>`;
    } else {
      box.dataset.confirmedAt = section.confirmedAt;
      const data = section.data;
      if (kind === 'transport') renderTransportGuide(data.guide, data.items);
      if (kind === 'work') renderWorkGuide(data.workGuide, data.stock, data);
      if (kind === 'insurance') renderInsurance(data.vehicle, data.insurance, vehicleId);
      box.insertAdjacentHTML('afterbegin', `<div data-doc-provenance data-cw-no-i18n><strong data-doc-copy="${source}"></strong>${source === 'cache' ? '<p data-doc-copy="cacheHelp"></p>' : ''}</div>`);
    }
    paintDocumentText();
  }

  function renderTransportGuide(guide, items) {
    const box = $("#transportGuideBox");
    if (!box) return;
    if (!guide) {
      box.innerHTML = `
        <div class="doc-head"><span class="chip">Guia AT</span><strong class="status-warn">Em falta</strong></div>
        <div class="doc-number">Sem guia de transporte ativa</div>
        <div class="muted">Pode iniciar o servico em modo provisorio. O administrador fica com alerta para associar a guia AT assim que estiver disponivel.</div>
      `;
      return;
    }

    const vehicle = guide.vehicle || {};
    const pdfHref = guide.id
      ? `/api/guides/transport/${encodeURIComponent(guide.id)}/pdf`
      : `/api/guides/transport/latest/${encodeURIComponent(guide.vehicleId || vehicle.id || "")}/pdf`;
    const officialDocument = guide.officialDocument || guide.transportGuideDocument || null;
    const officialDocumentMeta = officialDocument?.url
      ? `<span>Ficheiro AT oficial: ${esc(officialDocument.originalName || officialDocument.filename || "documento")}</span>`
      : `<span>Ficheiro AT oficial: por anexar pelo administrador</span>`;
    const officialDocumentButton = officialDocument?.url
      ? docButton(officialDocument.url, "Abrir guia AT oficial")
      : "";
    box.innerHTML = `
      <div class="doc-head"><span class="chip">Guia AT</span><strong class="status-ok">${esc(guide.status || "ACTIVE")}</strong></div>
      <div class="doc-number">${esc(guide.codeAT || `Guia #${guide.id}`)}</div>
      <div class="doc-meta">
        <span>Empresa: Cristal Water LDA</span>
        <span>Viatura: ${esc(vehicle.plate || guide.vehiclePlate || guide.vehicleId || "Nao indicada")}</span>
        <span>Origem: ${esc(guide.origin || "Armazem Cristal Water")}</span>
        <span>Destino: ${esc(guide.destination || "Clientes em rota")}</span>
        <span>Validade: ${esc(formatDate(guide.validFrom))} - ${esc(formatDate(guide.validUntil))}</span>
        ${officialDocumentMeta}
      </div>
      ${renderItems(items, "transport")}
      <div class="doc-actions">${officialDocumentButton}${docButton(pdfHref, officialDocument?.url ? "Abrir PDF guia AT gerado" : "Abrir PDF guia AT")}</div>
    `;
  }

  function renderWorkGuide(workGuide, stock, data) {
    const box = $("#workGuideBox");
    if (!box) return;
    if (!workGuide) {
      box.innerHTML = `
        <div class="doc-head"><span class="chip">Guia de obra</span><strong class="status-warn">Em falta</strong></div>
        <div class="doc-number">Sem guia de obra aberta</div>
        <div class="muted">Abre a gestao de guias para iniciar uma guia de trabalho ligada a viatura.</div>
      `;
      return;
    }

    const stockRows = stock;
    box.innerHTML = `
      <div class="doc-head"><span class="chip">Guia de obra</span><strong class="${workGuide.guideId ? "status-ok" : "status-warn"}">${esc(workGuide.status || "OPEN")}</strong></div>
      <div class="doc-number">Obra #${esc(workGuide.id)}</div>
      <div class="doc-meta">
        <span>Empresa: Cristal Water LDA</span>
        <span>Tecnico: ${esc(workGuide.technician?.name || workGuide.technicianId || "Nao indicado")}</span>
        <span>Viatura: ${esc(workGuide.vehicle?.plate || workGuide.vehicleId || "Nao indicada")}</span>
        <span>Guia AT associada: ${esc(workGuide.guide?.codeAT || workGuide.guideId || "AT em falta - associar mais tarde")}</span>
        <span>Inicio: ${esc(formatDate(workGuide.createdAt))}</span>
      </div>
      ${renderUsage(stockRows)}
      ${renderMovements(data)}
      ${renderItems(stockRows, "work")}
      ${renderStockSummary(stockRows)}
      <div class="doc-actions">${docButton(`/api/guides/work/${encodeURIComponent(workGuide.id)}/pdf`, "Abrir PDF guia de obra")} <a class="cw-btn" href="/work-guide-close?workGuideId=${encodeURIComponent(workGuide.id)}">Rever fecho da guia</a></div>
    `;
  }

  function renderInsurance(vehicle, insurance, vehicleId) {
    const box = $("#insuranceBox");
    if (!box) return;
    const plate = vehicle?.plate || vehicleId || "Nao indicada";
    if (!insurance) {
      box.innerHTML = `
        <div class="doc-head"><span class="chip">Seguro</span><strong class="status-warn">Por validar</strong></div>
        <div class="doc-number">Seguro da viatura</div>
        <div class="doc-meta">
          <span>Empresa: Cristal Water LDA</span>
          <span>Matricula: ${esc(plate)}</span>
          <span>Sem seguro registado na ficha da viatura.</span>
        </div>
        <div class="doc-actions">${docButton(`/api/guides/vehicles/${encodeURIComponent(vehicleId)}/insurance/pdf`, "Abrir ficha do seguro")}</div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="doc-head"><span class="chip">Seguro</span><strong class="status-ok">${esc(insurance.status || "Ativo")}</strong></div>
      <div class="doc-number">${esc(insurance.title || "Seguro da viatura")}</div>
      <div class="doc-meta">
        <span>Empresa: Cristal Water LDA</span>
        <span>Matricula: ${esc(plate)}</span>
        <span>Validade: ${esc(formatDate(insurance.dueDate))}</span>
        <span>${esc(insurance.notes || "Documento registado na frota.")}</span>
      </div>
      <div class="doc-actions">${docButton(`/api/guides/vehicles/${encodeURIComponent(vehicleId)}/insurance/pdf`, "Abrir PDF seguro")}</div>
    `;
  }

  async function loadGuides(showFeedback = true) {
    if (!sameFieldSession()) return;
    const vehicleInput = $('#vehicleId'), technicianInput = $('#technicianId');
    const vehicleId = Number(vehicleInput?.value || localStorage.getItem('cwVehicleId'));
    clearFieldDocuments();
    if (!Number.isSafeInteger(vehicleId) || vehicleId < 1) { docsWarning = 'Confirme a viatura atribuída antes de consultar documentos.'; docsWarningCopy = alertUi.value('centerVehicleConfirm'); renderCrewStatus(); return; }
    const context = window.CWFieldDocuments.scope(fieldWriteSession, vehicleId), revision = docsRevision;
    const relevant = () => revision === docsRevision && window.CWFieldDocuments.same(context) && Number(vehicleInput?.value) === vehicleId;
    docsContext = context;
    vehicleInput.value = String(vehicleId);
    if (technicianInput) { technicianInput.value = String(fieldWriteSession.technicianId); technicianInput.readOnly = true; }
    localStorage.setItem('cwVehicleId', String(vehicleId));
    localStorage.setItem('cwTechnicianId', String(fieldWriteSession.technicianId));
    ['transport', 'work', 'insurance'].forEach(kind => renderDocumentSection(kind, null, 'loading', vehicleId));
    const result = await window.CWFieldDocuments.load(context, relevant);
    if (!result || !relevant()) return;
    const transport = result.sections.transport?.data, work = result.sections.work?.data, insurance = result.sections.insurance?.data;
    activeTransportGuide = transport?.guide || null;
    activeWorkGuide = work?.workGuide || null;
    activeWorkStock = work?.stock || [];
    activeInsurance = insurance?.insurance || null;
    activeVehicle = insurance?.vehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || null;
    ['transport', 'work', 'insurance'].forEach(kind => renderDocumentSection(kind, result.sections[kind], result.sources[kind] || 'unavailable', vehicleId));
    renderDoseRows();
    const sources = Object.values(result.sources), hasCache = sources.includes('cache');
    docsSource = sources.length === 3 && sources.every(source => source === 'live') ? 'live' : sources.length === 3 && sources.every(source => source === 'cache') ? 'cache' : sources.some(source => source === 'live' || source === 'cache') ? 'mixed' : 'unavailable';
    docsDetail = ['transport', 'work', 'insurance'].map(kind => {
      const title = ({transport:'Guia AT',work:'Guia de obra/stock',insurance:'Seguro/inspeção'})[kind], section = result.sections[kind];
      return title + ': ' + (section ? (result.sources[kind] === 'cache' ? 'cópia consultada em ' : 'consultado em ') + window.CWFieldDocumentCopy.date(section.confirmedAt) : 'indisponível');
    }).join(' · ');
    docsDetailCopy = alertUi.join(['transport', 'work', 'insurance'].map(kind => {
      const name = alertUi.value(({ transport: 'sourceDocTransport', work: 'centerWorkStock', insurance: 'centerInsuranceInspection' })[kind]), section = result.sections[kind];
      return section ? alertUi.value(result.sources[kind] === 'cache' ? 'centerCachedAt' : 'centerConsulted', { name, date: alertUi.documentDate(section.confirmedAt) }) : alertUi.value('sourceDocBlocker', { name, state: alertUi.value('sourceDocUnavailable') });
    }), ' · ');
    docsWarning = [result.warning, hasCache ? 'A cópia guardada não confirma alterações recentes. Os PDFs precisam de ligação.' : ''].filter(Boolean).join(' ');
    docsWarningCopy = alertUi.join([result.warning ? alertUi.documentWarning(result) : '', hasCache ? alertUi.value('centerCacheWarning') : ''].filter(Boolean), ' ');
    documentsLoaded = true;
    renderCrewStatus(); updateFieldDashboard(current()); visitDraftManager.paint(currentDraftEntry);
    if (showFeedback) alertUi.notify(result.denied ? alertUi.documentWarning(result) : docsSource === 'live' ? (result.warning ? alertUi.documentWarning(result) : alertUi.value('centerUpdated')) : alertUi.value('centerRefreshUnconfirmed'));
  }

  function resetForm() {
    ["ph", "chlorine", "alkalinity", "salt", "orp", "temperature", "notes"].forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.value = "";
    });
    updateAllReferenceStatuses();
    checkIds.forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.checked = false;
    });
    startedAt = null;
    pendingProblems = [];
    usedProducts = [];
    renderDoseRows();
    visitPhotos.forEach((photo) => {
      if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
    });
    visitPhotos = [];
    renderPhotoList();
  }

  function poolFilterGroup(code) {
    if (code === "DONE") return "DONE";
    if (["IN_PROGRESS", "WATER_OPEN", "WAITING_MATERIAL", "CRITICAL"].includes(code)) return "IN_PROGRESS";
    return "TODO";
  }

  function renderNowBoard(visit) {
    const stateLine = $("#nowStateLine");
    const responsibleLine = $("#nowResponsibleLine");
    const timingLine = $("#nowTimingLine");
    if (!stateLine || !responsibleLine || !timingLine) return;

    if (!visit) {
      alertUi.bind(stateLine, alertUi.value('nowFree'));
      alertUi.bind(responsibleLine, alertUi.value('nowFreeAction'));
      alertUi.bind(timingLine, alertUi.value('nowFreeTiming'));
      return;
    }

    const stateLabel = operationalStateCopy(visit);
    const technicianName = visit?.technician?.name || activeTechnician?.name || alertUi.value('nowTechnician');
    const taskType = alertUi.value(pendingProblems.length ? 'nowRepair' : 'nowMaintenance');
    alertUi.bind(stateLine, alertUi.join([visit.pool?.name || alertUi.value('sourcePool'), stateLabel], ' · '));
    alertUi.bind(responsibleLine, alertUi.join([technicianName, taskType], ' · '));
    alertUi.bind(timingLine, elapsedMinutesCopy(visit.startAt || startedAt));
  }

  // Exact protocol codes only; unknown source values remain literal.
  function roundStatusCopy(status) {
    const keys = {
      PLANNED: 'roundPlanned', PENDING: 'roundPending',
      IN_PROGRESS: 'nowStateIN_PROGRESS', STARTED: 'nowStateIN_PROGRESS', ACTIVE: 'nowStateIN_PROGRESS',
      ON_ROUTE: 'nowStateTRAVEL', TRAVEL: 'nowStateTRAVEL', EM_TRANSITO: 'nowStateTRAVEL', A_CAMINHO: 'nowStateTRAVEL',
      INCOMPLETE: 'nowStateINCOMPLETE',
      DONE: 'nowStateDONE', COMPLETED: 'nowStateDONE', CONCLUIDA: 'nowStateDONE',
    };
    const key = Object.hasOwn(keys, status) ? keys[status] : null;
    return key ? alertUi.value(key) : (status || alertUi.value('roundPending'));
  }

  function renderList() {
    const list = $("#visitList");
    const segments = $("#poolSegments");
    if (!list) return;
    alertUi.clearTree(list);
    const entries = [];
    function leaf(entry, tag = 'span', className = '') {
      const key = entries.push(entry) - 1;
      return `<${tag} class="${className}" data-round-value="${key}">${esc(alertUi.format(entry))}</${tag}>`;
    }
    function paintList(html) {
      list.innerHTML = html;
      for (const node of list.querySelectorAll('[data-round-value]')) alertUi.bind(node, entries[Number(node.dataset.roundValue)]);
    }

    if (segments) {
      segments.querySelectorAll("[data-pool-filter]").forEach((button) => {
        button.classList.toggle("active", button.dataset.poolFilter === activePoolFilter);
      });
    }

    if (!visits.length) {
      paintList(`
        <div class="visit">
          <div class="visit-top">
            ${leaf(alertUi.value('nowFree'), 'b')}
            ${leaf(alertUi.value('roundNoVisits'), 'span', 'chip')}
          </div>
          ${leaf(alertUi.value('roundNoAssigned'))}
          ${leaf(alertUi.value('roundFreeAction'), 'div', 'visit-state')}
        </div>
      `);
      return;
    }

    const grouped = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };

    visits.forEach((visit, i) => {
      const code = operationalStateCode(visit);
      const group = poolFilterGroup(code);
      grouped[group].push({ visit, i, code });
    });

    const groupOrder = activePoolFilter === "ALL" ? ["TODO", "IN_PROGRESS", "DONE"] : [activePoolFilter];
    const html = groupOrder.map((groupKey) => {
      const rows = grouped[groupKey] || [];
      if (!rows.length) {
        return `
          <div class="visit-group">
            ${leaf(alertUi.value('round' + groupKey), 'div', 'visit-group-title')}
            ${leaf(alertUi.value('roundEmpty'), 'div', 'empty')}
          </div>
        `;
      }

      const rowsHtml = rows.map(({ visit, i, code }) => {
        const location = visitLocation(visit);
        const done = isVisitDone(visit);
        const status = !isRegularVisit(visit)
          ? alertUi.value('roundExtraStatus', { status: done ? alertUi.value('nowStateDONE') : roundStatusCopy(visit.status) })
          : done ? alertUi.value('roundDoneEdit') : roundStatusCopy(visit.status);
        const techName = visit?.technician?.name || activeTechnician?.name || alertUi.value('roundTechnician');
        const taskType = alertUi.value(pendingProblems.length ? 'nowRepair' : 'nowMaintenance');
        return `
          <button class="visit ${i === index ? "active" : ""} ${done ? "done" : ""}" type="button" data-visit-index="${i}">
            <div class="visit-top">
              ${leaf(visit.pool?.name || alertUi.value('sourcePool'), 'b')}
              ${leaf(alertUi.value('nowState' + code), 'span', 'chip')}
            </div>
            ${leaf(visit.client?.name || alertUi.value('sourceClient'))}
            ${leaf(alertUi.join([techName, elapsedMinutesCopy(visit.startAt), taskType, status], ' · '), 'div', 'visit-state')}
            <div class="visit-location">
              ${leaf(alertUi.value('roundLocation', { location: location.address || visit.pool?.zone || alertUi.value('roundLocationUnknown') }))}
              ${leaf(location.lat && location.lng ? alertUi.value('roundGPS', { latitude: location.lat.toFixed(5), longitude: location.lng.toFixed(5) }) : alertUi.value('roundGPSMissing'))}
            </div>
          </button>
        `;
      }).join("");

      return `
        <div class="visit-group">
          ${leaf(alertUi.value('round' + groupKey), 'div', 'visit-group-title')}
          ${rowsHtml}
        </div>
      `;
    }).join("");

    paintList(html);
    list.querySelectorAll("[data-visit-index]").forEach((button) => {
      button.addEventListener("click", () => selectVisit(Number(button.dataset.visitIndex)));
    });
  }

  function ensureAssistPanel() {
    const nextCard = document.querySelector(".next");
    if (!nextCard) return null;
    let panel = $("#fieldAssistPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "fieldAssistPanel";
      panel.className = "field-assist-panel";
      nextCard.appendChild(panel);
    }
    return panel;
  }

  function pendingVisitsOnly(items) {
    return (Array.isArray(items) ? items : []).filter((visit) => !isVisitDone(visit));
  }

  function visitLine(visit) {
    const location = visitLocation(visit);
    const time = formatDate(visit.plannedDate || visit.date || visit.startAt);
    return `${time} - ${visit.client?.name || "Cliente"} - ${location.address || visit.pool?.zone || "local por confirmar"}`;
  }

  function assistCardHtml(visit, source) {
    const isTomorrow = source === "tomorrow";
    const techName = visit.technician?.name || visit.technicianName || "tecnico por confirmar";
    return `
      <button class="assist-card" type="button" data-assist-visit="${esc(visit.id)}" data-assist-type="${esc(visit.visitType || 'REGULAR')}" data-assist-source="${esc(source)}">
        <span class="chip">${isTomorrow ? "Amanha" : "Ajudar colega"}</span>
        <b>${esc(visit.pool?.name || "Piscina")}</b>
        <small>${esc(visitLine(visit))}</small>
        <small>${isTomorrow ? "Ronda propria antecipada" : `Ronda de ${techName}`}</small>
      </button>
    `;
  }

  function renderAssistPanel(mode = "overview") {
    const panel = ensureAssistPanel();
    if (!panel) return;
    if (current()) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    const other = assistOptions.otherToday || [];
    const tomorrow = assistOptions.tomorrow || [];
    const showOther = mode === "help" || mode === "overview";
    const showTomorrow = mode === "tomorrow" || mode === "overview";
    const loading = assistOptions.loading ? '<div class="assist-empty">A procurar trabalho pendente...</div>' : "";
    const error = assistOptions.error ? `<div class="assist-empty warn">${esc(assistOptions.error)}</div>` : "";
    const otherHtml = other.length
      ? `<div class="assist-list">${other.slice(0, 8).map((visit) => assistCardHtml(visit, "otherToday")).join("")}</div>`
      : '<div class="assist-empty">Nenhuma piscina pendente de colegas neste momento.</div>';
    const tomorrowHtml = tomorrow.length
      ? `<div class="assist-list">${tomorrow.slice(0, 8).map((visit) => assistCardHtml(visit, "tomorrow")).join("")}</div>`
      : '<div class="assist-empty">A ronda do proximo dia ainda nao tem piscinas pendentes.</div>';

    panel.innerHTML = `
      <div class="assist-head">
        <b>Depois da ronda</b>
        <span>${esc(`${other.length} colega(s) pendente(s) - ${tomorrow.length} para antecipar`)}</span>
      </div>
      <div class="assist-actions">
        <button type="button" data-assist-mode="help">Ajudar colegas</button>
        <button type="button" data-assist-mode="tomorrow">Antecipar amanha</button>
      </div>
      ${loading}
      ${error}
      ${showOther ? `<div class="assist-section"><h3>Ajudar outras rondas em trabalho</h3>${otherHtml}</div>` : ""}
      ${showTomorrow ? `<div class="assist-section"><h3>Comecar a ronda do proximo dia</h3>${tomorrowHtml}</div>` : ""}
    `;
  }

  async function loadAssistOptions(force = false) {
    const technicianId = currentTechnicianId();
    const key = `${technicianId || "all"}:${localIsoDate(new Date())}`;
    if (!force && assistOptions.loadedKey === key) {
      renderAssistPanel();
      return;
    }
    assistOptions = { ...assistOptions, loading: true, loadedKey: key, error: "" };
    renderAssistPanel();

    try {
      const todayAllQuery = dayQueryParams(new Date(), "");
      const tomorrowQuery = dayQueryParams(addLocalDays(1), technicianId);
      const [todayResult, tomorrowResult] = await Promise.allSettled([
        api(`/api/technician/today?${todayAllQuery}`),
        api(`/api/technician/today?${tomorrowQuery}`),
      ]);

      for(const result of [todayResult, tomorrowResult])if(result.status==='fulfilled'&&(result.value.complete!==true||!Array.isArray(result.value.visits)||result.value.total!==result.value.visits.length))throw Error('A resposta não confirma a ronda completa. Atualize antes de escolher outra visita.');
      const todayVisits = todayResult.status === "fulfilled" ? pendingVisitsOnly(todayResult.value.visits) : [];
      const tomorrowVisits = tomorrowResult.status === "fulfilled" ? pendingVisitsOnly(tomorrowResult.value.visits) : [];
      const otherToday = todayVisits
        .filter((visit) => !technicianId || String(visit.technician?.id || visit.technicianId || "") !== String(technicianId))
        .sort((a, b) => new Date(a.plannedDate || a.date || 0) - new Date(b.plannedDate || b.date || 0));

      assistOptions = {
        loading: false,
        loadedKey: key,
        otherToday,
        tomorrow: tomorrowVisits.sort((a, b) => new Date(a.plannedDate || a.date || 0) - new Date(b.plannedDate || b.date || 0)),
        error: "",
      };
    } catch (error) {
      assistOptions = { ...assistOptions, loading: false, error: error.message || "Nao foi possivel carregar alternativas." };
    }
    renderAssistPanel();
  }

  function openAssistVisit(visitId, source, visitType = 'REGULAR') {
    const pools = source === "tomorrow" ? assistOptions.tomorrow : assistOptions.otherToday;
    const found = pools.find((visit) => String(visit.id) === String(visitId) && (visit.visitType || 'REGULAR') === visitType);
    if (!found) return;
    const visit = { ...found, assistSource: source };
    const existing = visits.findIndex((item) => visitKey(item) === visitKey(visit));
    if (existing >= 0) {
      visits[existing] = { ...visits[existing], ...visit };
      index = existing;
    } else {
      visits.push(visit);
      index = visits.length - 1;
    }
    loadCurrentDraft();
    render();
    switchFieldTab("hoje", true);
    toast(source === "tomorrow" ? "Ronda de amanha aberta." : "Visita de apoio aberta.");
  }

  function showAssistMode(mode) {
    renderAssistPanel(mode);
    ensureAssistPanel()?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function readingLabel(value, suffix = "") {
    if (value === undefined || value === null || value === "") return "Sem registo";
    return `${value}${suffix ? ` ${suffix}` : ""}`;
  }

  function doneChecksLabel(visit) {
    const done = [];
    if (visit?.cleaned) done.push("Limpeza");
    if (visit?.vacuumed) done.push("Aspiracao");
    if (visit?.basketCleaned) done.push("Cesto");
    if (visit?.brushed) done.push("Escovagem");
    if (visit?.waterlineClean) done.push("Linha de agua");
    if (visit?.backwashDone) done.push("Filtro");
    return done.length ? done.join(" / ") : "Sem checklist marcada";
  }

  function productsLabel(products) {
    if (!products.length) return "Sem produtos";
    return products.map((product) => `${product.name} ${product.quantity || ""} ${product.unit || ""}`.trim()).join(" / ");
  }

  function renderCorrectionSummary(visit) {
    const card = $("#correctionSummaryCard");
    const summary = $("#correctionSummary");
    const savedAt = $("#correctionSavedAt");
    if (!card || !summary) return;

    if (!isVisitDone(visit)) {
      card.hidden = true;
      summary.innerHTML = "";
      return;
    }

    const products = productsFromVisit(visit);
    const photos = photosFromVisit(visit);
    card.hidden = false;
    if (savedAt) savedAt.textContent = visit?.endAt ? formatDate(visit.endAt) : "Feita";

    summary.innerHTML = `
      <div class="service-summary-grid">
        <div class="service-summary-item"><span>Checklist</span><b>${esc(doneChecksLabel(visit))}</b></div>
        <div class="service-summary-item"><span>pH</span><b>${esc(readingLabel(visit?.ph))}</b></div>
        <div class="service-summary-item"><span>Cloro</span><b>${esc(readingLabel(visit?.chlorine, "ppm"))}</b></div>
        <div class="service-summary-item"><span>Alcalinidade</span><b>${esc(readingLabel(visit?.alkalinity, "ppm"))}</b></div>
        <div class="service-summary-item"><span>ORP</span><b>${esc(readingLabel(visit?.orpMv, "mV"))}</b></div>
        <div class="service-summary-item"><span>Temperatura</span><b>${esc(readingLabel(visit?.temperature, "C"))}</b></div>
        <div class="service-summary-item"><span>Produtos</span><b>${esc(productsLabel(products))}</b></div>
        <div class="service-summary-item"><span>Fotos</span><b>${esc(`${photos.length} foto${photos.length === 1 ? "" : "s"}`)}</b></div>
        <div class="service-summary-item"><span>Estado</span><b>Correção aberta</b></div>
      </div>
      <div class="service-summary-note">
        <strong>Notas guardadas:</strong><br>
        ${esc(visit?.notes || "Sem notas registadas nesta visita.")}
      </div>
    `;
  }

  function selectVisit(nextIndex) {
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= visits.length) return;
    saveCurrentDraft();
    index = nextIndex;
    loadCurrentDraft();
    persistFieldUiState();
    render();
    if (isVisitDone(current())) {
      switchFieldTab("agora");
      alertUi.notify(alertUi.value(isRegularVisit(current()) ? 'visitSelectedRegular' : 'visitSelectedExtra'));
    }
  }

  function nextPendingIndex(afterIndex) {
    const later = visits.findIndex((visit, i) => i > afterIndex && !isVisitDone(visit));
    if (later >= 0) return later;
    const any = visits.findIndex((visit) => !isVisitDone(visit));
    return any >= 0 ? any : visits.length;
  }

  function render() {
    renderIncompleteStatus();
    const visit = current();
    window.dispatchEvent(new CustomEvent("cw:field-visit-selected", { detail: { visitId: visit?.id || null, visitType:visit?.visitType || null, poolId:visit?.poolId || visit?.pool?.id || null, state:JSON.stringify([visit?.status,visit?.startAt,visit?.endAt]) } }));
    const extra = !!visit && !isRegularVisit(visit);
    document.body.classList.toggle('field-extra-selected',extra);
    const readOnly = !visit || !sameFieldSession() || (extra && isVisitDone(visit));
    $('#fieldExtraVisitNotice').hidden = !extra;
    alertUi.bind($('#fieldExtraVisitNotice'), extra ? extraVisitNotice : '');
    for (const selector of [...draftFieldIds.map(id=>'#'+id),...checkIds.map(id=>'#'+id),'#startBtn','#finishBtn','#incompleteSave','#problemBtn','#saveProblemBtn','#openWaterBtn','#pumpReminderCreate','#sendAdminAlertBtn','#addDoseBtn','#galleryPhotoBtn','#photoInput','#galleryPhotoInput','[data-photo-type]','#doseRows input','#doseRows select','#doseRows button']) document.querySelectorAll(selector).forEach(node=>{node.disabled=readOnly;});
    for(const selector of ['#openWaterBtn','#pumpReminderCreate'])document.querySelectorAll(selector).forEach(node=>{node.disabled=!visit || !sameFieldSession();});
    if(extra)for(const selector of ['#problemBtn','#saveProblemBtn','#sendAdminAlertBtn'])document.querySelectorAll(selector).forEach(node=>{node.disabled=true;});
    window.CWFieldStockRequest?.contextChanged();
    window.CWFieldProblemReport?.contextChanged();
    alertUi.bind($('#progressText'), visits.length ? alertUi.value('visitProgress', { done: visits.filter(isVisitDone).length, total: visits.length }) : alertUi.value('visitNoAssigned'));

    if (!visit) {
      alertUi.bind($('#nextTitle'), alertUi.value('visitFreeTitle'));
      void technicalProposalEditor.open(null);
      alertUi.bind($('#nextMeta'), alertUi.value('visitFreeMeta'));
      if ($("#startBtn")) {
        $("#startBtn").disabled = false;
        alertUi.bind($('#startBtn'), alertUi.value('visitRefresh'));
        $("#startBtn").dataset.cwCheckinRequired = 'false';
        delete $("#startBtn").dataset.cwCheckinTarget;
      }
      $("#finishBtn").disabled = false;
      alertUi.bind($('#finishBtn'), alertUi.value('dashAgenda'));
      updateFieldConnection();
      renderCorrectionSummary(null);
      renderAccessCard(null);
      renderRouteCard(null);
      renderList();
      renderNowBoard(null);
      updateFieldDashboard(null);
      renderAssistPanel();
      loadAssistOptions(false);
      technicalProposals = [];
      renderTechnicalProposalList();
      return;
    }

    $("#finishBtn").disabled = !sameFieldSession();
    updateFieldConnection();
    alertUi.bind($('#nextTitle'), visit.pool?.name || alertUi.value('sourcePool'));
    const sourceLabel = visit.assistSource === "otherToday"
      ? alertUi.value('visitHelp', { name: visit.technician?.name || visit.technicianName || alertUi.value('visitColleague') })
      : (visit.assistSource === "tomorrow" ? alertUi.value('visitNextDay') : (visit.technician?.name || alertUi.value('roundTechnician')));
    const statusLabel = readOnly ? alertUi.value('roundExtraStatus', { status: roundStatusCopy(visit.status) }) : isVisitDone(visit) ? alertUi.value('visitCorrectionOpen') : roundStatusCopy(visit.status);
    alertUi.bind($('#nextMeta'), alertUi.join([visit.client?.name || alertUi.value('sourceClient'), sourceLabel, statusLabel], ' - '));
    if ($("#startBtn")) {
      alertUi.bind($('#startBtn'), alertUi.value(readOnly ? 'visitView' : isVisitDone(visit) ? 'visitReview' : 'visitStart'));
      $("#startBtn").dataset.cwCheckinRequired = String(!isVisitDone(visit));
      $("#startBtn").dataset.cwCheckinTarget = JSON.stringify([visit.visitType || 'REGULAR', visit.id, visit.pool?.id]);
      $("#startBtn").disabled = readOnly || startingVisits.has(visitKey(visit));
    }
    alertUi.bind($('#finishBtn'), alertUi.value(readOnly ? 'visitCorrect' : isVisitDone(visit) ? 'visitSaveCorrection' : 'visitFinish'));
    renderAssistPanel();
    renderCorrectionSummary(visit);
    renderAccessCard(visit);
    renderRouteCard(visit);
    renderList();
    renderNowBoard(visit);
    updateFieldDashboard(visit);
    loadTechnicalProposals(currentPoolId());
    persistFieldUiState();
    visitDraftManager.paint(currentDraftEntry);
  }

  function showRouteCacheWarning(message) {
    const node = $("#fieldRouteAge"); node.hidden = false; node.textContent = message;
  }

  function persistModernRoute() {
    if (!sameFieldSession() || !window.CWFieldRouteCache.same(routeContext) || !routeSnapshot) return false;
    try { routeSnapshot = window.CWFieldRouteCache.update(routeSnapshot, visits, routeContext); return true; }
    catch (error) { showRouteCacheWarning('A ronda não ficou guardada para uso offline. ' + error.message); return false; }
  }

  function protectFieldRouteSession() {
    if (sameFieldSession() && docsContext && !window.CWFieldDocuments.same(docsContext))
      clearFieldDocuments('O dia mudou. Consulte os documentos atuais com rede.');
    if (!sameFieldSession()) {
      if (routeSessionBlocked) return;
      for(const url of photoPreviewCache.values())URL.revokeObjectURL(url); photoPreviewCache.clear();
      routeSessionBlocked = true; ++routeRevision; visits = []; index = 0; routeConfirmedAt = null; routeSnapshot = null;
      const main = document.querySelector('main.field'); main.inert = true; main.style.setProperty('display', 'none', 'important');
      const banner = document.createElement('section'); banner.id = 'fieldRouteSessionChanged'; banner.setAttribute('role', 'alert'); banner.style.cssText = 'padding:20px;background:#fff4ce;color:#624400';
      const text = document.createElement('p'); text.textContent = 'A sessão mudou. Os dados guardados foram preservados. Reabra o modo de campo com a conta atual.';
      const link = document.createElement('a'); link.href = '/technician-field-mode'; link.textContent = 'Reabrir modo de campo'; banner.append(text, link); document.body.prepend(banner);
    } else if (routeContext && routeContext.day !== window.CWFieldRouteCache.today()) {
      ++routeRevision; visits = []; index = 0; routeConfirmedAt = null; routeSnapshot = null; routeContext = null;
      loadCurrentDraft(); render(); void load();
    }
  }
  window.addEventListener('storage', protectFieldRouteSession);
  window.addEventListener('pageshow', event => { protectFieldRouteSession(); if (event.persisted && !routeSessionBlocked) void load(); });
  window.setInterval(protectFieldRouteSession, 1000);

  async function load(options = {}) {
    if (!sameFieldSession() || routeSessionBlocked) { protectFieldRouteSession(); return; }
    const revision = ++routeRevision, context = window.CWFieldRouteCache.scope(fieldWriteSession);
    const relevant = () => revision === routeRevision && !routeSessionBlocked && sameFieldSession() && window.CWFieldRouteCache.same(context);
    if (window.CristalAuth && !window.CristalAuth.hydrate()) {
      window.CristalAuth.logout();
      return;
    }
    const role = String(window.CristalAuth?.parseUser?.().role || "").toUpperCase().trim();
    if (role && !["TECHNICIAN", "TEAM_LEADER", "ADMIN"].includes(role)) {
      window.CristalAuth?.logout();
      return;
    }

    try {
      const fallbackState = readFieldUiState();
      const returnContract = readReturnContract();
      const query = new URLSearchParams({ date: context.day, technicianId: String(context.session.technicianId) });
      let snapshot, failure;
      try {
        const response = await fetch('/api/technician/today?' + query, { headers: { Authorization: 'Bearer ' + context.session.token }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!relevant()) return;
        const data = await response.json(); if (!relevant()) return;
        if (response.status !== 200) throw Object.assign(Error(data.error || 'Não foi possível confirmar a ronda no servidor.'), { denied: [401,403].includes(response.status) });
        snapshot = window.CWFieldRouteCache.fromResponse(data, context);
      } catch (error) { if (!relevant()) return; failure = error; }
      if (!relevant()) return;
      $("#fieldRouteAge").hidden = true;
      if (snapshot) {
        routeConfirmedAt = snapshot.serverConfirmedAt;
        try { window.CWFieldRouteCache.save(snapshot, context); }
        catch (error) { showRouteCacheWarning('A ronda não ficou guardada para uso offline. ' + error.message); }
      } else {
        routeConfirmedAt = null;
        if (failure?.denied) { visits = []; routeSnapshot = null; routeContext = null; throw failure; }
        snapshot = window.CWFieldRouteCache.read(context);
        if (!snapshot) throw new Error('Sem ronda guardada para esta conta e este dia. Abra o modo de campo com ligação antes de sair.');
        showRouteCacheWarning(`Ronda de ${context.day}, consultada no servidor em ${new Date(snapshot.serverConfirmedAt).toLocaleString('pt-PT')}. Sem confirmação atual; alterações do escritório por verificar.`);
      }
      routeContext = context; routeSnapshot = snapshot; visits = snapshot.visits;
      $("#fieldLoadError").hidden = true;
      const liveState = options.preserveNavigation ? readFieldUiState() : fallbackState;
      const liveContract = options.preserveNavigation ? null : returnContract;
      applyReturnState(liveContract, liveState);
      const oldDrafts = localStorage.getItem(`cwFieldVisitDrafts:${currentTechnicianId()}`);
      $('#fieldDraftHistory').hidden = !oldDrafts || oldDrafts === '{}';
      loadWaterRemindersFromStorage();
      loadCurrentDraft();
      renderWaterReminders();
      scheduleWaterReminders();
      syncTechnicianContextFromVisit(current());
      render();
      const preferredTab = normalizeFieldTab(
        liveContract?.activeTab || liveState?.activeTab || initialOperationalTab(),
        initialOperationalTab()
      );
      switchFieldTab(preferredTab);
      activePoolFilter = readDomActivePoolFilter(activePoolFilter || "TODO");
      const scrollToY = Number.isFinite(Number(returnContract?.scrollY))
        ? Math.max(0, Number(returnContract.scrollY))
        : (Number.isFinite(Number(fallbackState?.scrollY)) ? Math.max(0, Number(fallbackState.scrollY)) : 0);
      if (scrollToY > 0 && !options.preserveNavigation) {
        window.setTimeout(() => {
          window.scrollTo({ top: scrollToY, behavior: "auto" });
        }, 40);
      }
      clearReturnContract();
      stripReturnParamsFromUrl();
      persistFieldUiState();
      await loadGuides(false).catch(() => renderCrewStatus());
      if (!relevant()) return;
      await loadTechnicalProposals(currentPoolId());
    } catch (error) {
      if (!relevant()) return;
      routeConfirmedAt = null;
      visits = []; index = 0; routeSnapshot = null; routeContext = null;
      loadCurrentDraft();
      render();
      renderPhotoList();
      $("#fieldLoadError").hidden = false; $("#fieldLoadErrorText").textContent = error.message;
      alertUi.bind($('#nextTitle'), alertUi.value('visitLoadFailed'));
      alertUi.bind($('#nextMeta'), error.message);
      alertUi.bind($('#progressText'), alertUi.value('visitCheckConnection'));
      $("#connectionState").textContent = error.denied ? "Sessão por validar" : "Offline";
      renderCrewStatus();
    }
  }

  function showProblemPanel() {
    if (window.CWFieldProblemReport) return window.CWFieldProblemReport.open();
    const panel = $("#problemPanel");
    if (!panel) return;
    panel.hidden = false;
    $("#problemText")?.focus();
  }

  function hideProblemPanel() {
    if (window.CWFieldProblemReport) return window.CWFieldProblemReport.close();
    const panel = $("#problemPanel");
    if (panel) panel.hidden = true;
  }

  async function saveProblem() {
    if (!requireRegularVisit(current())) return;
    if (!window.CWFieldProblemReport) { toast('Ocorrências indisponíveis. Conserve o texto e reabra a página.'); return; }
    return window.CWFieldProblemReport.send();
  }

  async function sendAdminStockAlert() {
    if (!requireRegularVisit(current())) return;
    if (!window.CWFieldStockRequest) { toast('Pedidos de material indisponíveis. Conserve o texto e reabra a página.'); return; }
    return window.CWFieldStockRequest.send();
  }

  function addSectionHeader(section, title, hint) {
    if (!section || section.dataset.fieldHeaderReady) return;
    section.dataset.fieldHeaderReady = "1";
    const header = document.createElement("div");
    header.className = "field-tab-title";
    header.innerHTML = `<h2>${esc(title)}</h2><span>${esc(hint)}</span>`;
    section.insertBefore(header, section.firstChild);
  }

  function markFieldSection(selector, panelClass, title, hint) {
    const node = $(selector);
    const section = node?.matches("section") ? node : node?.closest("section");
    if (!section) return null;
    section.classList.add("field-panel", panelClass);
    addSectionHeader(section, title, hint);
    return section;
  }

  function scrollFieldTabIntoView(tab) {
    const panel = document.querySelector(`.field-panel-${tab}`);
    if (!panel) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function switchFieldTab(tab, shouldScroll = false) {
    if (tab === "mapa") {
      activePoolFilter = normalizePoolFilter(
        document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter,
        activePoolFilter
      );
      writeLastExplicitFilter(activePoolFilter);
      const contract = buildMapReturnContract();
      persistMapReturnContract(contract);
      persistFieldUiState();
      window.location.href = buildMapRouteFromContract(contract);
      return;
    }

    const safeTab = ["hoje", "agora", "docs", "more"].includes(tab) ? tab : "hoje";
    document.body.dataset.fieldTab = safeTab;
    if ($("#fieldPageTitle")) $("#fieldPageTitle").textContent = {hoje:"O meu dia",agora:"Visita",docs:"Viatura e documentos",more:"Apoio"}[safeTab];
    try {
      localStorage.setItem("cwFieldActiveTab", safeTab);
    } catch (_) {}
    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.classList.toggle("active", button.dataset.fieldTabButton === safeTab);
      if (button.dataset.fieldTabButton === safeTab) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    persistFieldUiState();
    if (shouldScroll) {
      window.setTimeout(() => scrollFieldTabIntoView(safeTab), 0);
    }
  }

  function updateFieldConnection() {
    const badge = $("#connectionState"); if (!badge) return;
    badge.textContent = navigator.onLine ? "Rede disponível" : "Sem rede";
    badge.dataset.offline = String(!navigator.onLine);
  }
  window.addEventListener("online", updateFieldConnection);
  window.addEventListener("offline", updateFieldConnection);

  function setupFieldLayout() {
    alertUi.bind($('#interruptCard > .chip'), alertUi.value('chip'));
    alertUi.bind($('#fieldAlertHistoryList')?.parentElement.querySelector('summary'), alertUi.value('historyTitle'));
    $("#fieldPriorityNotice")?.addEventListener("click", () => {switchFieldTab("hoje"); $("#interruptCard")?.scrollIntoView({block:"start"});});
    $("#fieldReloadBtn")?.addEventListener("click", () => load());
    document.querySelectorAll("[data-field-jump]").forEach(button => button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.fieldJump);
      target?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"});
    }));
    document.body.classList.add("cw-tech-field-page");

    markFieldSection("#cleaningCard", "field-panel-agora", "Servico", "limpeza e leituras");
    markFieldSection("#doseRows", "field-panel-agora", "Produtos", "consumo do carro");
    markFieldSection("#photoList", "field-panel-agora", "Fotografias", "registo rapido");
    bindPhotoUi($('#photosCard'), 'section', {}, 'aria-label');
    for (const node of document.querySelectorAll('#photosCard [data-cw-photo-text]')) bindPhotoUi(node, node.dataset.cwPhotoText);
    bindPhotoUi($('#photosCard .field-tab-title h2'), 'title');
    bindPhotoUi($('#photosCard .field-tab-title span'), 'quick');
    markFieldSection("#accessCard", "field-panel-agora", "Acesso", "chaves e codigos");
    markFieldSection("#routeCard", "field-panel-hoje", "Rota", "proximo local");
    markFieldSection("#visitList", "field-panel-hoje", "Lista do dia", "corrigir ou avancar");
    alertUi.bind($('#dayVisitsCard .field-tab-title h2'), alertUi.value('roundTitle'));
    alertUi.bind($('#dayVisitsCard .field-tab-title span'), alertUi.value('roundHint'));
    markFieldSection(".crew-card", "field-panel-docs", "Tecnico", "viatura e documentos");
    alertUi.bind($('.crew-card .field-tab-title h2'), alertUi.value('dashTechnician'));
    alertUi.bind($('.crew-card .field-tab-title span'), alertUi.value('crewSectionHint'));
    markFieldSection("#transportGuideBox", "field-panel-docs", "Documentos", "AT, obra e seguro");
    markFieldSection("#waterReminderList", "field-panel-more", "Agua aberta", "alarme obrigatorio");
    const waterCard = $('#waterReminderList')?.closest('section');
    for (const [selector, key] of [['.field-tab-title h2', 'title'], ['.field-tab-title span', 'hint'], [':scope > .chip', 'chip'], [':scope > .muted', 'intro'], ['#openWaterBtn', 'open']]) waterUi.bind(waterCard?.querySelector(selector), waterUi.value(key));
    waterUi.bind($('#waterMinutes'), waterUi.value('minutesPlaceholder'), 'placeholder');
    waterUi.bind($('#waterCloseTime'), waterUi.value('timeLabel'), 'aria-label');
    waterUi.bind($('#waterNote'), waterUi.value('notePlaceholder'), 'placeholder');
    markFieldSection("#adminAlertMessage", "field-panel-more", "Avisos", "admin e stock");
    markFieldSection("#problemPanel", "field-panel-more", "Extras / problemas", "separado do servico");

    if (!document.querySelector(".field-tabs")) {
      const nav = document.createElement("nav");
      nav.className = "field-tabs";
      nav.setAttribute("aria-label", "Navegacao do tecnico em campo");
      nav.innerHTML = `
        <button type="button" data-field-tab-button="hoje">Hoje</button>
        <button type="button" data-field-tab-button="agora">Visita</button>
        <button type="button" data-field-tab-button="mapa">Mapa</button>
        <button type="button" data-field-tab-button="docs">Viatura</button>
        <button type="button" data-field-tab-button="more">Mais</button>
      `;
      document.body.appendChild(nav);
    }

    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.fieldTabButton;
        switchFieldTab(tab, true);
      });
    });
    document.querySelectorAll("[data-hero-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.heroAction;
        if (action === "refresh") {
          load();
          return;
        }
        if (action === "agenda") {
          window.location.href = "/technician-route";
          return;
        }
        if (action === "openVisit") {
          switchFieldTab("agora", true);
          document.querySelector("#nextTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "continue") {
          switchFieldTab("agora", true);
          document.querySelector("#nowBoard")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "map") {
          switchFieldTab("mapa", true);
          return;
        }
        if (action === "p0") {
          switchFieldTab("hoje", true);
          document.querySelector("#interruptCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "contact") {
          switchFieldTab("more", true);
          document.querySelector("#adminAlertMessage")?.scrollIntoView({ behavior: "smooth", block: "start" });
          document.querySelector("#adminAlertMessage")?.focus();
        }
      });
    });

    const interruptList = document.querySelector("#interruptList");
    if (interruptList && !interruptList.dataset.actionsReady) {
      interruptList.dataset.actionsReady = "1";
      interruptList.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-interrupt-action]");
        if (!actionButton || !sameFieldSession()) return;
        const action = actionButton.dataset.interruptAction;
        if (action === 'retry') { opJournalAttempts.clear(); opJournalWriteWarning = ''; opJournalWriteCopy = ''; renderInterruptBoard(); return; }
        const exceptionId = actionButton.dataset.exceptionId;
        const exception = collectOperationalExceptions().find((item) => item.id === exceptionId);
        if (action === "assume" && exception) {
          assumeOperationalException(exception);
          return;
        }
        if (action === "confirm" && exception) {
          confirmOperationalException(exception);
          return;
        }
        if ((action === "target" || action === "resolve") && exception) {
          const target = exception.targetAction;
          if (!target) return;
          if (target === 'pump') {
            switchFieldTab('more', true);
            document.querySelector('#pumpReminderBanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            alertUi.notify(alertUi.value('pumpInstruction'));
            return;
          }
          if (target === "problem") {
            switchFieldTab("more", true);
            showProblemPanel();
            return;
          }
          if (target === "docs") {
            switchFieldTab("docs", true);
            document.querySelector("#transportGuideBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (target === "water") {
            switchFieldTab("more", true);
            document.querySelector("#waterReminderList")?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (target === "hoje") {
            switchFieldTab("hoje", true);
          }
          return;
        }
        if (action === "problem") {
          switchFieldTab("more", true);
          showProblemPanel();
          return;
        }
        if (action === "docs") {
          switchFieldTab("docs", true);
          document.querySelector("#transportGuideBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "water") {
          switchFieldTab("more", true);
          document.querySelector("#waterReminderList")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    const assistPanel = ensureAssistPanel();
    if (assistPanel && !assistPanel.dataset.assistReady) {
      assistPanel.dataset.assistReady = "1";
      assistPanel.addEventListener("click", (event) => {
        const modeButton = event.target.closest("[data-assist-mode]");
        if (modeButton) {
          showAssistMode(modeButton.dataset.assistMode);
          return;
        }
        const visitButton = event.target.closest("[data-assist-visit]");
        if (visitButton) {
          openAssistVisit(visitButton.dataset.assistVisit, visitButton.dataset.assistSource, visitButton.dataset.assistType);
        }
      });
    }

    const segments = document.querySelector("#poolSegments");
    if (segments && !segments.dataset.eventsReady) {
      segments.dataset.eventsReady = "1";
      segments.addEventListener("click", (event) => {
        const button = event.target.closest("[data-pool-filter]");
        if (!button) return;
        activePoolFilter = normalizePoolFilter(button.dataset.poolFilter, "TODO");
        writeLastExplicitFilter(activePoolFilter);
        renderList();
        persistFieldUiState();
      });
    }

    // Keep a visual default without persisting, so load() can restore return contract state.
    document.body.dataset.fieldTab = "hoje";
    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.classList.toggle("active", button.dataset.fieldTabButton === "hoje");
    });
  }

  setupFieldLayout();

  if (!window.__cwFieldBeforeUnloadBound) {
    window.__cwFieldBeforeUnloadBound = true;
    window.addEventListener("beforeunload", () => {
      persistFieldUiState();
    });
    window.addEventListener("pageshow", () => {
      window.setTimeout(() => {
        persistFieldUiState();
      }, 0);
    });
  }

  const startBtn = $("#startBtn");
  if (startBtn) {
    startBtn.onclick = async () => {
      const visit = current();
      if (!visit) {
        showAssistMode("help");
        return;
      }
      if (!requireExecutableVisit(visit) || startingVisits.has(visitKey(visit))) return;
      if (isVisitDone(visit)) {
        switchFieldTab("agora");
        loadCurrentDraft();
        alertUi.notify(alertUi.value('actionReview'));
        return;
      }
      docsCompliance = computeDocsCompliance();
      if (!docsCompliance.readyForOperation) {
        switchFieldTab("docs", true);
        document.querySelector("#documentCenterBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
        alertUi.notify(documentSourceCopies.get(docsCompliance) || docsCompliance.reason || alertUi.value('actionDocsMissing'));
        return;
      }
      startedAt = new Date();
      if (!navigator.onLine && isRegularVisit(visit)) {
        visits[index] = mergeVisitSnapshot(visit, { startAt: startedAt.toISOString() }, "IN_PROGRESS");
        saveCurrentDraft();
        const saved = persistModernRoute();
        render();
        alertUi.notify(alertUi.value(saved ? 'actionStartLocal' : 'actionStartMemory'));
        return;
      }
      startBtn.disabled = true;
      const target = visitKey(visit);
      startingVisits.add(target);
      try {
        const result = visit.visitType === 'EXTRA' ? await window.CWFieldOffline.submitExtraStart(visit,fieldWriteSession) : await api(`/api/operational-state/visits/${visit.id}/state`, {
          method: "POST",
          body: JSON.stringify({
            state: "IN_PROGRESS",
            visitType: 'REGULAR',
            poolId: visit.poolId || visit.pool?.id,
          }),
        });
        if (!sameFieldSession()) return;
        const confirmed = result.visit;
        if (result.ok !== true || confirmed?.id !== visit.id || confirmed.poolId !== (visit.poolId || visit.pool?.id) || confirmed.technicianId !== fieldWriteSession.technicianId || !['IN_PROGRESS','STARTED','EM_EXECUCAO'].includes(confirmed.status) || !Number.isFinite(Date.parse(confirmed.startAt)) || confirmed.endAt) throw alertUi.error('A resposta não confirma o início desta visita. Atualize a rota.', alertUi.value('actionStartUnconfirmed'));
        const position = visits.findIndex(row=>visitKey(row)===target);
        if (position < 0) return;
        visits[position] = mergeVisitSnapshot(visits[position], confirmed, 'IN_PROGRESS');
        if (visitKey() === target) { startedAt = new Date(confirmed.startAt); saveCurrentDraft(); }
        persistModernRoute();
        render();
        alertUi.notify(alertUi.value('actionStarted', { pool: visit.pool?.name || alertUi.value('sourcePool') }));
      } catch (error) {
        if (sameFieldSession()) alertUi.notify(alertUi.failure(error, alertUi.value('actionStartFailed')));
      } finally {
        startingVisits.delete(target);
        if (sameFieldSession()) startBtn.disabled = (current()?.visitType === 'EXTRA' && isVisitDone(current())) || startingVisits.has(visitKey());
      }
    };
  }

  const problemBtn = $("#problemBtn");
  if (problemBtn) problemBtn.onclick = showProblemPanel;

  const saveProblemBtn = $("#saveProblemBtn");
  if (saveProblemBtn) saveProblemBtn.onclick = saveProblem;

  const cancelProblemBtn = $("#cancelProblemBtn");
  if (cancelProblemBtn) cancelProblemBtn.onclick = hideProblemPanel;

  const loadGuidesBtn = $("#loadGuidesBtn");
  if (loadGuidesBtn) loadGuidesBtn.onclick = () => loadGuides(true);

  const refreshCrewStatus = $("#refreshCrewStatus");
  if (refreshCrewStatus) refreshCrewStatus.onclick = () => loadGuides(true);

  const submitTechnicalProposalBtn = $("#submitTechnicalProposalBtn");
  if (submitTechnicalProposalBtn) {
    submitTechnicalProposalBtn.onclick = async () => {
      try {
        await submitTechnicalProposal();
      } catch (error) {
        const status = $("#technicalProposalStatus");
        if (status) status.textContent = error.message || "Erro ao submeter proposta.";
        toast(error.message || "Erro ao submeter proposta.");
      }
    };
  }

  document.querySelectorAll("[data-photo-type]").forEach((button) => {
    button.addEventListener("click", () => pickPhoto(button.dataset.photoType));
  });

  for(const id of ['photoInput','galleryPhotoInput']){
    const input = $(`#${id}`);
    input?.addEventListener('change', () => { const selection = selectedPhotoContext; selectedPhotoContext = null; Array.from(input.files || []).forEach(file => addSelectedPhoto(file, selection)); });
    input?.addEventListener('cancel', () => photoFeedback('cancelled'));
  }
  $('#galleryPhotoBtn')?.addEventListener('click', () => pickPhoto($('#galleryPhotoType').value, true));

  const syncPhotosBtn = $("#syncPhotosBtn");
  if (syncPhotosBtn) syncPhotosBtn.onclick = () => syncPendingPhotos(true);

  const openWaterBtn = $("#openWaterBtn");
  if (openWaterBtn) openWaterBtn.onclick = createWaterReminder;

  const sendAdminAlertBtn = $("#sendAdminAlertBtn");
  if (sendAdminAlertBtn) sendAdminAlertBtn.onclick = sendAdminStockAlert;

  const addDoseBtn = $("#addDoseBtn");
  if (addDoseBtn) addDoseBtn.onclick = ensureDoseRow;

  const refreshDoseStockBtn = $("#refreshDoseStockBtn");
  if (refreshDoseStockBtn) refreshDoseStockBtn.onclick = () => loadGuides(true);
  $('#vehicleId')?.addEventListener('input', () => clearFieldDocuments('A viatura mudou. Consulte os documentos antes de iniciar ou concluir.'));
  if ($('#technicianId')) $('#technicianId').readOnly = true;

  const doseRows = $("#doseRows");
  if (doseRows) {
    doseRows.addEventListener("input", (event) => {
      const row = event.target.closest("[data-dose-id]");
      const field = event.target.dataset.doseField;
      if (!row || !field) return;
      const item = usedProducts.find((product) => product.localId === row.dataset.doseId);
      if (!item) return;
      if (field === "name") return;
      item[field] = event.target.value;
      saveCurrentDraft();
    });
    doseRows.addEventListener("change", (event) => {
      const row = event.target.closest("[data-dose-id]");
      const field = event.target.dataset.doseField;
      // Quantity edits are already saved by the input event. Saving again on
      // blur would disable the completion button while its click is arriving.
      if (!row || field !== 'name') return;
      updateDoseRow(row.dataset.doseId, field, event.target.value);
    });
    doseRows.addEventListener("click", (event) => {
      const id = event.target.dataset.doseRemove;
      if (!id) return;
      removeDoseRow(id);
    });
  }

  ["ph", "chlorine", "alkalinity", "orp"].forEach((id) => {
    const input = $(`#${id}`);
    if (input) input.addEventListener("input", () => updateReferenceStatus(input));
  });

  // Persist field draft while typing so browser refresh does not lose in-progress notes/measurements.
  draftFieldIds.forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener("input", () => saveCurrentDraft());
  });

  checkIds.forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener("change", () => saveCurrentDraft());
  });

  const finishBtn = $("#finishBtn");
  if (finishBtn) {
    finishBtn.onclick = async () => {
      if (!sameFieldSession()) { alertUi.notify(alertUi.value('actionSessionChanged')); return; }
      const visit = current();
      if (!visit) {
        showAssistMode("tomorrow");
        return;
      }
      if(visit.visitType==='EXTRA'&&isVisitDone(visit)){await window.CWExtraVisitCorrection.open(visit,fieldWriteSession);return;}
      if (!requireExecutableVisit(visit)) return;
      if (pendingProblems.some(problem=>!problem.synced)) { alertUi.notify(alertUi.value('actionUnconfirmedProblems')); switchFieldTab('more'); showProblemPanel(); return; }
      const target = visitKey(visit);
      const wasDone = isVisitDone(visit);
      const draftEntry = currentDraftEntry;
      if (draftEntry?.submitting) return;
      await saveCurrentDraft();
      if (!sameFieldSession() || visitKey() !== target) return;
      if (draftEntry.error || draftEntry.external || Object.keys(draftEntry.conflicts).length || draftEntry.request) { visitDraftManager.paint(draftEntry);alertUi.notify(alertUi.draftStatus($('#fieldSaveStatus')));return; }
      try { readFieldDrafts(); } catch (error) { alertUi.notify(alertUi.failure(error)); return; }
      docsCompliance = computeDocsCompliance();
      if (!wasDone && !docsCompliance.readyForOperation) {
        switchFieldTab("docs", true);
        document.querySelector("#documentCenterBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
        alertUi.notify(documentSourceCopies.get(docsCompliance) || docsCompliance.reason || alertUi.value('actionDocsMissing'));
        return;
      }
      draftEntry.submitting = true;
      visitDraftManager.paint(draftEntry);
      try {
      $("#finishBtn").disabled = true;
      const photosReady = await syncPendingPhotos(false);
      if (!sameFieldSession() || visitKey(current()) !== visitKey(visit)) { finishBtn.disabled = current()?.visitType === 'EXTRA' && isVisitDone(current()); return; }
      if (!photosReady && navigator.onLine) {
        $("#finishBtn").disabled = false;
        photoToast('finishBlocked');
        return;
      }

      let productsUsed;
      try {
        productsUsed = normalizedUsedProducts();
        if (!wasDone) await validateUsedProducts(productsUsed);
      } catch (validationError) {
        $("#finishBtn").disabled = false;
        alertUi.notify(alertUi.failure(validationError));
        return;
      }

      const productsPayload = productsUsed.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unit: product.unit,
        notes: product.notes,
        ...(window.CWVisitProductIdentity.hasIdentity(product) ? window.CWVisitProductIdentity.identity(product) : {}),
      }));

      if (!sameFieldSession() || visitKey(current()) !== visitKey(visit)) { finishBtn.disabled = current()?.visitType === 'EXTRA' && isVisitDone(current()); return; }

      const body = {
        cleaned: $("#cleaned").checked,
        vacuumed: $("#vacuumed")?.checked || false,
        basketCleaned: $("#basketCleaned").checked,
        brushed: $("#brushed").checked,
        waterlineClean: $("#waterlineClean")?.checked || false,
        backwashDone: $("#backwashDone").checked,
        ph: $("#ph").value,
        chlorine: $("#chlorine").value,
        alkalinity: $("#alkalinity").value,
        salt: $("#salt").value,
        orp: $("#orp").value,
        temperature: $("#temperature").value,
        notes: $("#notes").value,
        problem: pendingProblems.filter((problem) => !problem.synced).map((problem) => `${problem.category || "Servico normal"} - ${problem.type}: ${problem.message}`).join("\n") || undefined,
        problemCategory: pendingProblems.some((problem) => problem.category === "Extra / reparacao") ? "Extra / reparacao" : undefined,
        priority: pendingProblems.some((problem) => problem.severity === "Urgente") ? "HIGH" : "NORMAL",
        startedAt,
        completedAt: new Date(),
        performedByTechnicianId: currentTechnicianId() || undefined,
        performedByTechnicianName: activeTechnician?.name || undefined,
        vehicleId: ($("#vehicleId")?.value || localStorage.getItem("cwVehicleId") || "").trim() || undefined,
        workGuideId: activeWorkGuide?.id || undefined,
        products: wasDone ? JSON.stringify(productsPayload) : (productsPayload.length ? JSON.stringify(productsPayload) : undefined),
        photos: visitPhotos
          .filter((photo) => photo.url)
          .map((photo) => ({ url: photo.url, type: photo.type || "AFTER" })),
      };

      try {
        if (wasDone) {
          await saveCurrentDraft();
          const result = await visitDraftManager.prepare(draftEntry,()=>api(`/api/technician/visits/${visit.id}/correction`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }));
          if (!sameFieldSession()) return;
          if (result.visit?.id !== visit.id || result.visit?.poolId !== (visit.poolId || visit.pool?.id)) throw alertUi.error('A resposta não confirma a correção desta visita. Atualize a rota.', alertUi.value('actionCorrectionUnconfirmed'));
          const updatedVisit = {
            ...visit,
            ...(result.visit || {}),
            status: "DONE",
            pool: {
              ...(visit.pool || {}),
              ...((result.visit || {}).pool || {}),
            },
            client: (result.visit || {}).client || (result.visit || {}).pool?.client || visit.client,
            technician: {
              ...(visit.technician || {}),
              ...((result.visit || {}).technician || {}),
            },
          };
          const position = visits.findIndex(row=>visitKey(row)===target);
          if (position >= 0) visits[position] = updatedVisit;
          await visitDraftManager.acceptCorrection(draftEntry,savedVisitDraft(updatedVisit));
          if (!sameFieldSession()) return;
          if (visitKey() === target) loadCurrentDraft();
          persistModernRoute();
          render();
          alertUi.notify(alertUi.value('actionCorrected', { pool: visit.pool?.name || alertUi.value('sourcePool') }));
          $("#finishBtn").disabled = current()?.visitType === 'EXTRA' && isVisitDone(current());
          return;
        }

        // These fields are server-derived or already stored through the photo contract.
        const { startedAt: ignoredStart, completedAt: ignoredEnd, performedByTechnicianId: ignoredActor, performedByTechnicianName: ignoredName, photos: ignoredPhotos, problemCategory: ignoredCategory, ...completionBody } = body;
        await saveCurrentDraft();
        const prepared = await visitDraftManager.prepare(draftEntry,()=>window.CWFieldOffline.prepareCompletion(visit.id, visit.visitType === 'EXTRA' ? {...completionBody,visitType:'EXTRA',poolId:visit.poolId || visit.pool?.id} : completionBody, fieldWriteSession, visit.visitType || 'REGULAR'));
        const completeResult = await window.CWFieldOffline.sendPreparedCompletion(prepared,fieldWriteSession);
        if (!sameFieldSession()) return;
        // Stock is consumed atomically by the completion transaction on the server.
        const stockUpdated = productsUsed.length > 0;
        if (stockUpdated) await loadGuides(false).catch(() => {});
        if (!sameFieldSession()) return;
        const completedVisit = mergeVisitSnapshot(visit, completeResult.visit || {}, "DONE");
        completedVisit.status = "DONE";
        completedVisit.endAt = completeResult.visit?.endAt || completedVisit.endAt || new Date().toISOString();
        const position = visits.findIndex(row=>visitKey(row)===target);
        if (position >= 0) visits[position] = completedVisit;
        persistModernRoute();
        alertUi.notify(alertUi.value(stockUpdated ? 'actionCompletedStock' : 'actionCompleted', { pool: visit.pool?.name || alertUi.value('sourcePool') }));
        if (visitKey() === target && position >= 0) {
          index = nextPendingIndex(position);
          loadCurrentDraft();
        }
        render();
      } catch (error) {
        if (sameFieldSession()) { $("#finishBtn").disabled = current()?.visitType === 'EXTRA' && isVisitDone(current()); visitDraftManager.paint(currentDraftEntry); alertUi.notify(alertUi.failure(error)); }
      }
      } finally { draftEntry.submitting=false; if(sameFieldSession())visitDraftManager.paint(currentDraftEntry); }
    };
  }

  window.addEventListener('cw:visit-synced', event => {
    if (!sameFieldSession() || event.detail.owner !== fieldWriteSession.owner || event.detail.token !== fieldWriteSession.token) return;
    const position = visits.findIndex(v => (v.visitType || 'REGULAR') === (event.detail.visitType || 'REGULAR') && String(v.id) === String(event.detail.visitId));
    if (position >= 0 && !(isVisitDone(visits[position]) && event.detail.visit.status === 'IN_PROGRESS')) visits[position] = mergeVisitSnapshot(visits[position], event.detail.visit, event.detail.visit.status);
    persistModernRoute();
    render();
  });
  window.addEventListener('cw:extra-correction-confirmed',event=>{if(sameFieldSession()&&event.detail.owner===fieldWriteSession.owner&&event.detail.token===fieldWriteSession.token)void load();});
  window.addEventListener('cw:water-state-updated', () => { loadWaterRemindersFromStorage(); renderWaterReminders(); scheduleWaterReminders(); renderList(); renderNowBoard(current()); updateFieldDashboard(current()); });
  window.addEventListener('cw:alert-journal-updated', () => { if (sameFieldSession()) renderInterruptBoard(); });
  window.addEventListener('storage', event => { if (sameFieldSession() && event.key?.startsWith('cwFieldAlertJournal:')) renderInterruptBoard(); });
  function renderIncompleteStatus(){void window.CWFieldIncomplete?.refresh();}
  window.addEventListener('cw:incomplete-confirmed',event=>{if(sameFieldSession()&&event.detail.owner===fieldWriteSession.owner&&event.detail.token===fieldWriteSession.token)void load({preserveNavigation:true});});
  void load();
  updateAllReferenceStatuses();
})();
