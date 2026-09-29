(function () {
  'use strict';
  // Only explicitly owned UI copy is translated. Stored/user/server text stays literal.
  const languages = ['pt','en','fr','es','de'];
  const locales = ['pt-PT','en-GB','fr-FR','es-ES','de-DE'];
  const copy = {
    language: ['Idioma','Language','Langue','Idioma','Sprache'],
    title: ['Cristal Water - Técnico','Cristal Water - Technician','Cristal Water - Technicien','Cristal Water - Técnico','Cristal Water - Techniker'],
    route: ['Ronda do Técnico','Technician route','Tournée du technicien','Ruta del técnico','Technikerroute'],
    logout: ['Sair','Sign out','Se déconnecter','Salir','Abmelden'],
    install: ['📲 Instalar App','📲 Install app','📲 Installer l’application','📲 Instalar aplicación','📲 App installieren'],
    installHelp: ['Instalação disponível através do menu do navegador.','Installation is available from the browser menu.','L’installation est disponible dans le menu du navigateur.','La instalación está disponible en el menú del navegador.','Die Installation ist über das Browsermenü verfügbar.'],
    light: ['Modo claro','Light mode','Mode clair','Modo claro','Heller Modus'],
    dark: ['Modo escuro','Dark mode','Mode sombre','Modo oscuro','Dunkler Modus'],
    suggest: ['Sugerir ordem da rota','Suggest route order','Suggérer l’ordre de la tournée','Sugerir orden de la ruta','Routenreihenfolge vorschlagen'],
    startDay: ['▶️ Iniciar Dia','▶️ Start day','▶️ Commencer la journée','▶️ Iniciar jornada','▶️ Arbeitstag beginnen'],
    endDay: ['⏹️ Terminar Dia','⏹️ End day','⏹️ Terminer la journée','⏹️ Terminar jornada','⏹️ Arbeitstag beenden'],
    dayRefresh: ['Consultar jornada','Check workday','Consulter la journée','Consultar jornada','Arbeitstag abfragen'],
    dayRetry: ['Confirmar pedido guardado','Confirm saved request','Confirmer la demande enregistrée','Confirmar solicitud guardada','Gespeicherte Anfrage bestätigen'],
    daySession: ['A sessão mudou. Reabra a página com a conta atual.','The session has changed. Reopen the page with the current account.','La session a changé. Rouvrez la page avec le compte actuel.','La sesión ha cambiado. Vuelva a abrir la página con la cuenta actual.','Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem aktuellen Konto erneut.'],
    daySessionPreserved: ['A sessão mudou. Os pedidos de jornada foram preservados para a conta original.','The session has changed. Workday requests were preserved for the original account.','La session a changé. Les demandes de journée ont été conservées pour le compte d’origine.','La sesión ha cambiado. Las solicitudes de jornada se han conservado para la cuenta original.','Die Sitzung hat sich geändert. Anfragen zum Arbeitstag bleiben für das ursprüngliche Konto erhalten.'],
    dayUnreadable: ['Pedido de jornada ilegível. Os dados foram preservados; peça apoio ao escritório.','Unreadable workday request. The data was preserved; ask the office for help.','Demande de journée illisible. Les données ont été conservées ; demandez de l’aide au bureau.','Solicitud de jornada ilegible. Los datos se han conservado; pida ayuda a la oficina.','Anfrage zum Arbeitstag ist unlesbar. Die Daten bleiben erhalten; bitten Sie das Büro um Hilfe.'],
    dayInvalid: ['Pedido de jornada inválido ou de outra conta. Os dados foram preservados; peça revisão.','Invalid workday request or a request from another account. The data was preserved; ask for a review.','Demande de journée invalide ou liée à un autre compte. Les données ont été conservées ; demandez une vérification.','Solicitud de jornada no válida o de otra cuenta. Los datos se han conservado; solicite una revisión.','Ungültige Anfrage zum Arbeitstag oder Anfrage eines anderen Kontos. Die Daten bleiben erhalten; bitten Sie um Prüfung.'],
    dayNotStarted: ['não iniciada','not started','non commencée','no iniciada','nicht begonnen'],
    dayWorking: ['em trabalho','working','en cours','en curso','in Arbeit'],
    dayEnded: ['terminada','ended','terminée','terminada','beendet'],
    dayLast: ['{date}: {state}','{date}: {state}','{date} : {state}','{date}: {state}','{date}: {state}'],
    dayPrevious: [' Último estado consultado: {last}.',' Last checked status: {last}.',' Dernier état consulté : {last}.',' Último estado consultado: {last}.',' Zuletzt abgefragter Status: {last}.'],
    dayError: ['Estado da jornada por confirmar. {error}{previous}','Workday status awaiting confirmation. {error}{previous}','État de la journée à confirmer. {error}{previous}','Estado de la jornada por confirmar. {error}{previous}','Status des Arbeitstags noch nicht bestätigt. {error}{previous}'],
    dayStart: ['Início','Start','Début','Inicio','Beginn'],
    dayEnd: ['Fim','End','Fin','Fin','Ende'],
    dayPending: ['{operation} de {date} guardado, por confirmar. Use o pedido original.','{operation} for {date} saved, awaiting confirmation. Use the original request.','{operation} du {date} : demande enregistrée, à confirmer. Utilisez la demande d’origine.','{operation} de {date} guardado, por confirmar. Use la solicitud original.','{operation} vom {date} gespeichert, Bestätigung ausstehend. Verwenden Sie die ursprüngliche Anfrage.'],
    dayBusy: ['A consultar/confirmar a jornada…','Checking/confirming the workday…','Consultation/confirmation de la journée…','Consultando/confirmando la jornada…','Arbeitstag wird abgefragt/bestätigt…'],
    dayConfirmed: ['Estado confirmado no servidor — {last}.','Status confirmed on the server — {last}.','État confirmé sur le serveur — {last}.','Estado confirmado en el servidor — {last}.','Status auf dem Server bestätigt — {last}.'],
    dayStale: ['Sem confirmação atual — última consulta: {last}.','No current confirmation — last checked: {last}.','Aucune confirmation actuelle — dernière consultation : {last}.','Sin confirmación actual — última consulta: {last}.','Keine aktuelle Bestätigung — zuletzt abgefragt: {last}.'],
    dayUnknown: ['Jornada por consultar.','Workday not yet checked.','Journée à consulter.','Jornada pendiente de consulta.','Arbeitstag noch nicht abgefragt.'],
    dayIncomplete: ['Resposta incompleta ou de outra jornada. O pedido original foi preservado.','Incomplete response or a different workday. The original request was preserved.','Réponse incomplète ou correspondant à une autre journée. La demande d’origine a été conservée.','Respuesta incompleta o de otra jornada. La solicitud original se ha conservado.','Unvollständige Antwort oder anderer Arbeitstag. Die ursprüngliche Anfrage bleibt erhalten.'],
    dayMismatch: ['O estado recebido não corresponde à jornada guardada.','The received status does not match the saved workday.','L’état reçu ne correspond pas à la journée enregistrée.','El estado recibido no corresponde a la jornada guardada.','Der empfangene Status stimmt nicht mit dem gespeicherten Arbeitstag überein.'],
    dayNoConfirmation: ['Sem confirmação do servidor.','No server confirmation.','Aucune confirmation du serveur.','Sin confirmación del servidor.','Keine Bestätigung vom Server.'],
    dayChangedPreserve: ['O pedido mudou noutra janela. Preserve os dados e consulte novamente.','The request changed in another window. Keep the data and check again.','La demande a changé dans une autre fenêtre. Conservez les données et consultez à nouveau.','La solicitud ha cambiado en otra ventana. Conserve los datos y vuelva a consultar.','Die Anfrage wurde in einem anderen Fenster geändert. Bewahren Sie die Daten auf und fragen Sie erneut ab.'],
    dayClearFailed: ['A confirmação local não ficou guardada. Consulte a jornada novamente.','The local confirmation was not saved. Check the workday again.','La confirmation locale n’a pas été enregistrée. Consultez à nouveau la journée.','La confirmación local no se ha guardado. Vuelva a consultar la jornada.','Die lokale Bestätigung wurde nicht gespeichert. Fragen Sie den Arbeitstag erneut ab.'],
    dayOfflineSaved: ['Sem ligação. O pedido original continua guardado.','No connection. The original request is still saved.','Aucune connexion. La demande d’origine est toujours enregistrée.','Sin conexión. La solicitud original sigue guardada.','Keine Verbindung. Die ursprüngliche Anfrage bleibt gespeichert.'],
    dayNotConfirmed: ['A operação ainda não está confirmada. Preserve o pedido original.','The operation is not yet confirmed. Keep the original request.','L’opération n’est pas encore confirmée. Conservez la demande d’origine.','La operación aún no está confirmada. Conserve la solicitud original.','Der Vorgang ist noch nicht bestätigt. Bewahren Sie die ursprüngliche Anfrage auf.'],
    dayNoLocks: ['Este navegador não permite coordenar a jornada entre janelas.','This browser cannot coordinate the workday across windows.','Ce navigateur ne permet pas de coordonner la journée entre plusieurs fenêtres.','Este navegador no permite coordinar la jornada entre ventanas.','Dieser Browser kann den Arbeitstag nicht über mehrere Fenster koordinieren.'],
    dayLocked: ['A jornada está a ser confirmada noutra janela. Consulte novamente.','The workday is being confirmed in another window. Check again.','La journée est en cours de confirmation dans une autre fenêtre. Consultez à nouveau.','La jornada se está confirmando en otra ventana. Vuelva a consultar.','Der Arbeitstag wird in einem anderen Fenster bestätigt. Fragen Sie erneut ab.'],
    dayAlreadyPending: ['Já existe um pedido guardado. Confirme-o antes de iniciar outra operação.','A saved request already exists. Confirm it before starting another operation.','Une demande enregistrée existe déjà. Confirmez-la avant de commencer une autre opération.','Ya existe una solicitud guardada. Confírmela antes de iniciar otra operación.','Es gibt bereits eine gespeicherte Anfrage. Bestätigen Sie diese vor einem weiteren Vorgang.'],
    dayConnect: ['Ligue à rede para consultar e alterar a jornada.','Connect to check and change the workday.','Connectez-vous pour consulter et modifier la journée.','Conéctese para consultar y modificar la jornada.','Stellen Sie eine Verbindung her, um den Arbeitstag abzufragen und zu ändern.'],
    dayChanged: ['O pedido mudou noutra janela. Consulte a jornada novamente.','The request changed in another window. Check the workday again.','La demande a changé dans une autre fenêtre. Consultez à nouveau la journée.','La solicitud ha cambiado en otra ventana. Vuelva a consultar la jornada.','Die Anfrage wurde in einem anderen Fenster geändert. Fragen Sie den Arbeitstag erneut ab.'],
    dayNotSaved: ['O pedido não ficou guardado neste dispositivo. Não foi enviado.','The request was not saved on this device. It was not sent.','La demande n’a pas été enregistrée sur cet appareil. Elle n’a pas été envoyée.','La solicitud no se ha guardado en este dispositivo. No se ha enviado.','Die Anfrage wurde auf diesem Gerät nicht gespeichert. Sie wurde nicht gesendet.'],
    loading: ['A carregar…','Loading…','Chargement…','Cargando…','Wird geladen…'],
    alertTitle: ['🚨 Alerta Técnico Interno','🚨 Internal technician alert','🚨 Alerte interne du technicien','🚨 Alerta interna del técnico','🚨 Interne Technikermeldung'],
    alertPlaceholder: ['Problema encontrado, material necessário, avaria, acesso, etc...','Problem found, materials needed, breakdown, access, etc.','Problème constaté, matériel nécessaire, panne, accès, etc.','Problema encontrado, material necesario, avería, acceso, etc.','Festgestelltes Problem, benötigtes Material, Defekt, Zugang usw.'],
    online: ['Online','Online','En ligne','En línea','Online'],
    offline: ['Offline','Offline','Hors ligne','Sin conexión','Offline'],
    syncing: ['🔄 A sincronizar...','🔄 Syncing…','🔄 Synchronisation…','🔄 Sincronizando…','🔄 Synchronisierung…'],
    synced: ['✅ Sincronizado','✅ Synced','✅ Synchronisé','✅ Sincronizado','✅ Synchronisiert'],
    syncError: ['⚠️ Erro sync','⚠️ Sync error','⚠️ Erreur de synchronisation','⚠️ Error de sincronización','⚠️ Synchronisierungsfehler'],
    alertsPending: ['Alertas por confirmar','Alerts awaiting confirmation','Alertes à confirmer','Alertas por confirmar','Meldungen warten auf Bestätigung'],
    visitsPending: ['{count} visitas por confirmar','{count} visits awaiting confirmation','{count} visites à confirmer','{count} visitas por confirmar','{count} Besuche warten auf Bestätigung'],
    evidencePending: ['{photos} fotos por confirmar · {gps} GPS pendentes · {alerts} alertas por confirmar','{photos} photos awaiting confirmation · {gps} GPS records pending · {alerts} alerts awaiting confirmation','{photos} photos à confirmer · {gps} relevés GPS en attente · {alerts} alertes à confirmer','{photos} fotos por confirmar · {gps} registros GPS pendientes · {alerts} alertas por confirmar','{photos} Fotos warten auf Bestätigung · {gps} GPS-Einträge ausstehend · {alerts} Meldungen warten auf Bestätigung'],
    gpsReview: ['GPS por rever; os registos foram preservados.','GPS needs review; records have been preserved.','GPS à vérifier ; les relevés ont été conservés.','GPS por revisar; los registros se han conservado.','GPS muss geprüft werden; die Einträge wurden erhalten.'],
    pending: ['por confirmar. ','awaiting confirmation. ','à confirmer. ','por confirmar. ','Bestätigung ausstehend. '],
    retry: ['Confirmar envio guardado','Confirm saved submission','Confirmer l’envoi enregistré','Confirmar envío guardado','Gespeicherten Versand bestätigen'],
    completionReview: ['Conclusões por confirmar ou a rever.','Completions await confirmation or review.','Visites terminées à confirmer ou à vérifier.','Finalizaciones por confirmar o revisar.','Abschlüsse warten auf Bestätigung oder Prüfung.'],
    photoReview: ['Fotografias por confirmar ou a rever.','Photos await confirmation or review.','Photos à confirmer ou à vérifier.','Fotografías por confirmar o revisar.','Fotos warten auf Bestätigung oder Prüfung.'],
    gpsPending: ['GPS ainda por confirmar ou a rever.','GPS still awaits confirmation or review.','GPS encore à confirmer ou à vérifier.','GPS aún por confirmar o revisar.','GPS wartet noch auf Bestätigung oder Prüfung.'],
    routeOffline: ['Rota offline da conta atual, consultada em {at}. Confirme alterações com o escritório.','Offline route for the current account, checked at {at}. Confirm changes with the office.','Tournée hors ligne du compte actuel, consultée le {at}. Confirmez les changements avec le bureau.','Ruta sin conexión de la cuenta actual, consultada el {at}. Confirme los cambios con la oficina.','Offline-Route des aktuellen Kontos, abgerufen am {at}. Änderungen mit dem Büro abklären.'],
    routeCurrent: ['Rota atualizada para {day}.','Route updated for {day}.','Tournée mise à jour pour le {day}.','Ruta actualizada para el {day}.','Route für {day} aktualisiert.'],
    routeNotSaved: ['A rota não ficou guardada para uso offline. {error}','The route was not saved for offline use. {error}','La tournée n’a pas été enregistrée pour une utilisation hors ligne. {error}','La ruta no se ha guardado para usarla sin conexión. {error}','Die Route wurde nicht für die Offline-Nutzung gespeichert. {error}'],
    sessionChanged: ['A sessão mudou. Reabra a página para consultar a rota da conta atual.','The session has changed. Reopen the page to view the current account’s route.','La session a changé. Rouvrez la page pour consulter la tournée du compte actuel.','La sesión ha cambiado. Vuelva a abrir la página para consultar la ruta de la cuenta actual.','Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut, um die Route des aktuellen Kontos anzuzeigen.'],
    noOfflineRoute: ['Não há rota offline confirmada para esta conta e dia. Abra a ronda com ligação.','No confirmed offline route exists for this account and day. Open the route while online.','Aucune tournée hors ligne confirmée pour ce compte et ce jour. Ouvrez la tournée avec une connexion.','No hay una ruta sin conexión confirmada para esta cuenta y día. Abra la ruta con conexión.','Für dieses Konto und diesen Tag liegt keine bestätigte Offline-Route vor. Öffnen Sie die Route mit Internetverbindung.'],
    incompleteRoute: ['Não foi possível confirmar a rota completa desta conta e dia. A lista anterior foi conservada; tente atualizar com rede.','The complete route for this account and day could not be confirmed. The previous list was kept; refresh while online.','Impossible de confirmer la tournée complète de ce compte pour ce jour. La liste précédente a été conservée ; actualisez avec une connexion.','No se pudo confirmar la ruta completa de esta cuenta y día. Se ha conservado la lista anterior; actualice con conexión.','Die vollständige Route für dieses Konto und diesen Tag konnte nicht bestätigt werden. Die bisherige Liste bleibt erhalten; mit Internetverbindung aktualisieren.'],
    routeError: ['Não foi possível carregar a ronda. A lista anterior foi conservada.','The route could not be loaded. The previous list was kept.','Impossible de charger la tournée. La liste précédente a été conservée.','No se pudo cargar la ruta. Se ha conservado la lista anterior.','Die Route konnte nicht geladen werden. Die bisherige Liste bleibt erhalten.'],
    routeUnavailable: ['Rota indisponível sem confirmação desta conta e dia.','Route unavailable without confirmation for this account and day.','Tournée indisponible sans confirmation pour ce compte et ce jour.','Ruta no disponible sin confirmación de esta cuenta y día.','Route ohne Bestätigung für dieses Konto und diesen Tag nicht verfügbar.'],
    empty: ['Sem visitas hoje','No visits today','Aucune visite aujourd’hui','No hay visitas hoy','Heute keine Besuche'],
    state: ['Estado:','Status:','État :','Estado:','Status:'],
    planned: ['Planeada','Planned','Planifiée','Planificada','Geplant'],
    started: ['Em curso','In progress','En cours','En curso','In Bearbeitung'],
    completed: ['Concluída','Completed','Terminée','Completada','Abgeschlossen'],
    cancelled: ['Cancelada','Cancelled','Annulée','Cancelada','Storniert'],
    archived: ['Arquivada','Archived','Archivée','Archivada','Archiviert'],
    currentStop: ['Stop atual bloqueado para evitar execução duplicada.','Current stop locked to prevent duplicate work.','Étape actuelle verrouillée pour éviter une exécution en double.','Parada actual bloqueada para evitar trabajo duplicado.','Aktueller Stopp gesperrt, um doppelte Ausführung zu verhindern.'],
    blockedStop: ['Esta visita está bloqueada enquanto o stop atual estiver em curso.','This visit is locked while the current stop is in progress.','Cette visite est verrouillée tant que l’étape actuelle est en cours.','Esta visita está bloqueada mientras la parada actual esté en curso.','Dieser Besuch ist gesperrt, solange der aktuelle Stopp läuft.'],
    start: ['Início:','Start:','Début :','Inicio:','Beginn:'],
    end: ['Fim:','End:','Fin :','Fin:','Ende:'],
    chlorine: ['Cloro','Chlorine','Chlore','Cloro','Chlor'],
    alkalinity: ['Alcalinidade','Alkalinity','Alcalinité','Alcalinidad','Alkalinität'],
    salt: ['Sal','Salt','Sel','Sal','Salz'],
    products: ['Produtos adicionados','Products added','Produits ajoutés','Productos añadidos','Hinzugefügte Produkte'],
    notes: ['Observações técnicas','Technical notes','Observations techniques','Observaciones técnicas','Technische Notizen'],
    before: ['Antes','Before','Avant','Antes','Vorher'],
    after: ['Depois','After','Après','Después','Nachher'],
    beforePhoto: ['📸 Antes','📸 Before','📸 Avant','📸 Antes','📸 Vorher'],
    afterPhoto: ['📸 Depois','📸 After','📸 Après','📸 Después','📸 Nachher'],
    complete: ['✔ Concluir','✔ Complete','✔ Terminer','✔ Completar','✔ Abschließen'],
    navigate: ['Navegar','Navigate','Itinéraire','Navegar','Navigieren'],
    noCoordinates: ['Sem coordenadas: confirmar morada','No coordinates: confirm address','Sans coordonnées : confirmer l’adresse','Sin coordenadas: confirmar dirección','Keine Koordinaten: Adresse bestätigen'],
    coordinatesHelp: ['Coordenadas indisponíveis. Confirme a morada com o escritório.','Coordinates unavailable. Confirm the address with the office.','Coordonnées indisponibles. Confirmez l’adresse avec le bureau.','Coordenadas no disponibles. Confirme la dirección con la oficina.','Koordinaten nicht verfügbar. Bestätigen Sie die Adresse beim Büro.'],
    activeVisit: ['Há uma visita em curso. Conclua essa visita antes de avançar.','A visit is in progress. Complete it before continuing.','Une visite est en cours. Terminez-la avant de continuer.','Hay una visita en curso. Complétela antes de continuar.','Ein Besuch läuft bereits. Schließen Sie ihn zuerst ab.'],
    visitConfirmed: ['Visita confirmada no servidor.','Visit confirmed on the server.','Visite confirmée sur le serveur.','Visita confirmada en el servidor.','Besuch auf dem Server bestätigt.'],
    completionSaved: ['Conclusão guardada, por confirmar. {error}','Completion saved, awaiting confirmation. {error}','Fin de visite enregistrée, à confirmer. {error}','Finalización guardada, por confirmar. {error}','Abschluss gespeichert, Bestätigung ausstehend. {error}'],
    completionError: ['Não foi possível guardar a conclusão. Os campos foram preservados.','The completion could not be saved. The fields were preserved.','Impossible d’enregistrer la fin de visite. Les champs ont été conservés.','No se pudo guardar la finalización. Se han conservado los campos.','Der Abschluss konnte nicht gespeichert werden. Die Felder bleiben erhalten.'],
    photoConfirmed: ['Fotografia confirmada no servidor.','Photo confirmed on the server.','Photo confirmée sur le serveur.','Fotografía confirmada en el servidor.','Foto auf dem Server bestätigt.'],
    photoSaved: ['Fotografia guardada neste dispositivo; por confirmar. {error}','Photo saved on this device; awaiting confirmation. {error}','Photo enregistrée sur cet appareil ; à confirmer. {error}','Fotografía guardada en este dispositivo; por confirmar. {error}','Foto auf diesem Gerät gespeichert; Bestätigung ausstehend. {error}'],
    photoNotSaved: ['A fotografia não ficou guardada. Selecione-a novamente. {error}','The photo was not saved. Select it again. {error}','La photo n’a pas été enregistrée. Sélectionnez-la à nouveau. {error}','La fotografía no se ha guardado. Selecciónela de nuevo. {error}','Das Foto wurde nicht gespeichert. Wählen Sie es erneut aus. {error}'],
  };
  const spec = (key, params = {}) => ({ key, params });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function languageIndex() { const index = languages.indexOf(document.documentElement.lang); return index < 0 ? 0 : index; }
  function t(value, params = {}) {
    if (value && typeof value === 'object') return t(value.key, value.params);
    const index = languageIndex();
    if (value === 'literal') return String(params.text ?? '');
    if (value === 'time') return params.iso && Number.isFinite(Date.parse(params.iso)) ? new Date(params.iso).toLocaleString(locales[index]) : '-';
    if (value === 'joined') return (params.parts || []).map(part => typeof part === 'object' ? t(part) : String(part ?? '')).join('');
    if (value === 'visitState') {
      const key = {PLANNED:'planned',IN_PROGRESS:'started',STARTED:'started',ACTIVE:'started',DONE:'completed',COMPLETED:'completed',CONCLUDED:'completed',CONCLUIDA:'completed','CONCLUÍDA':'completed',CANCELLED:'cancelled',CANCELED:'cancelled',ARCHIVED:'archived'}[String(params.status).toUpperCase()];
      return key ? t(key) : String(params.status || '-');
    }
    return (copy[value]?.[index] || copy[value]?.[0] || String(value ?? '')).replace(/\{(\w+)\}/g, (_, key) => typeof params[key] === 'object' ? t(params[key]) : String(params[key] ?? ''));
  }
  function mark(key, params = {}) { return 'data-cw-legacy-text="' + escape(key) + '" data-cw-legacy-params="' + escape(JSON.stringify(params)) + '"'; }
  function span(key, params = {}) { return '<span ' + mark(key, params) + '>' + escape(t(key, params)) + '</span>'; }
  function paint(node) {
    let params = {}; try { params = JSON.parse(node.getAttribute('data-cw-legacy-params') || '{}'); } catch (_) { return; }
    if (node.hasAttribute('data-cw-legacy-text')) { const value = t(node.getAttribute('data-cw-legacy-text'),params); if (node.textContent !== value) node.textContent = value; }
    if (node.hasAttribute('data-cw-legacy-placeholder')) { const value = t(node.getAttribute('data-cw-legacy-placeholder'),params); if (node.getAttribute('placeholder') !== value) node.setAttribute('placeholder',value); }
  }
  function set(node, key, params = {}) {
    if (!node) return;
    if (key && typeof key === 'object') { params = key.params; key = key.key; }
    node.setAttribute('data-cw-legacy-text',key); node.setAttribute('data-cw-legacy-params',JSON.stringify(params)); paint(node);
  }
  function apply(root = document) {
    const selector = '[data-cw-legacy-text],[data-cw-legacy-placeholder]';
    if (root.matches?.(selector)) paint(root);
    root.querySelectorAll(selector).forEach(paint);
    const select = document.getElementById('cwLanguageSelect');
    if (select) {
      const label = t('language'), caption = select.parentElement.querySelector('span');
      if (select.getAttribute('aria-label') !== label) select.setAttribute('aria-label',label);
      if (caption && caption.textContent !== label) caption.textContent = label;
    }
  }
  function error(key, params) { const failure = new Error(t(key,params)); failure.copy = spec(key,params); return failure; }
  window.CWLegacyTechnicianCopy = { t, spec, set, mark, span, apply, error };
  window.addEventListener('cw-language-change', () => apply());
  let lastLanguage = document.documentElement.lang;
  new MutationObserver(() => { const current = document.documentElement.lang; if (lastLanguage !== current) { lastLanguage = current; apply(); } }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply(), {once:true}); else apply();
})();
