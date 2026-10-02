// Only producer-owned interface copy is translated; received values stay literal.
const visitUi = (() => {
  const languages = ['pt','en','fr','es','de'];
  const copy = {
  "title": [
    "Cristal Water - Visita Técnica",
    "Cristal Water - Technical Visit",
    "Cristal Water - Visite technique",
    "Cristal Water - Visita técnica",
    "Cristal Water - Technischer Besuch"
  ],
  "back": [
    "Voltar ao campo",
    "Back to the field",
    "Retour au terrain",
    "Volver al campo",
    "Zurück zum Außendienst"
  ],
  "execution": [
    "Execução de visita",
    "Visit work",
    "Intervention sur site",
    "Ejecución de la visita",
    "Besuch durchführen"
  ],
  "topIntro": [
    "Checklist, química, foto e fecho operacional",
    "Checklist, chemistry, photo and completion",
    "Liste de contrôle, chimie, photo et clôture",
    "Lista de tareas, química, foto y cierre",
    "Checkliste, Wasserchemie, Foto und Abschluss"
  ],
  "kicker": [
    "Técnico no terreno",
    "Technician in the field",
    "Technicien sur le terrain",
    "Técnico en el campo",
    "Techniker im Außendienst"
  ],
  "heading": [
    "Visita técnica",
    "Technical visit",
    "Visite technique",
    "Visita técnica",
    "Technischer Besuch"
  ],
  "intro": [
    "Abrir visita, registar leituras, documentar evidência e concluir sem perder contexto operacional.",
    "Open the visit, record readings, document evidence and complete it with the operational context intact.",
    "Ouvrez la visite, consignez les mesures et les preuves, puis terminez en conservant le contexte opérationnel.",
    "Abre la visita, registra lecturas y pruebas y complétala conservando el contexto operativo.",
    "Besuch öffnen, Messwerte und Nachweise erfassen und mit dem betrieblichen Kontext abschließen."
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
  "alerts": [
    "Alertas",
    "Alerts",
    "Alertes",
    "Alertas",
    "Hinweise"
  ],
  "photos": [
    "Fotos",
    "Photos",
    "Photos",
    "Fotos",
    "Fotos"
  ],
  "toLoad": [
    "Por carregar",
    "Not loaded yet",
    "À charger",
    "Por cargar",
    "Noch nicht geladen"
  ],
  "preparing": [
    "A preparar a ficha da visita.",
    "Preparing the visit record.",
    "Préparation de la fiche de visite.",
    "Preparando la ficha de la visita.",
    "Besuchsformular wird vorbereitet."
  ],
  "summary": [
    "Resumo da visita",
    "Visit summary",
    "Résumé de la visite",
    "Resumen de la visita",
    "Besuchsübersicht"
  ],
  "infoLoading": [
    "A carregar informação da visita.",
    "Loading visit information.",
    "Chargement des informations de la visite.",
    "Cargando información de la visita.",
    "Besuchsinformationen werden geladen."
  ],
  "readings": [
    "Leituras da água",
    "Water readings",
    "Mesures de l’eau",
    "Lecturas del agua",
    "Wassermesswerte"
  ],
  "ph": [
    "pH",
    "pH",
    "pH",
    "pH",
    "pH"
  ],
  "chlorine": [
    "Cloro",
    "Chlorine",
    "Chlore",
    "Cloro",
    "Chlor"
  ],
  "alkalinity": [
    "Alcalinidade",
    "Alkalinity",
    "Alcalinité",
    "Alcalinidad",
    "Alkalinität"
  ],
  "salt": [
    "Sal",
    "Salt",
    "Sel",
    "Sal",
    "Salz"
  ],
  "temperature": [
    "Temperatura",
    "Temperature",
    "Température",
    "Temperatura",
    "Temperatur"
  ],
  "orp": [
    "ORP",
    "ORP",
    "ORP",
    "ORP",
    "ORP"
  ],
  "phExample": [
    "Ex.: 7.2",
    "E.g.: 7.2",
    "Ex. : 7.2",
    "Ej.: 7.2",
    "Z. B.: 7.2"
  ],
  "chlorineExample": [
    "Ex.: 1.5",
    "E.g.: 1.5",
    "Ex. : 1.5",
    "Ej.: 1.5",
    "Z. B.: 1.5"
  ],
  "alkalinityExample": [
    "Ex.: 110",
    "E.g.: 110",
    "Ex. : 110",
    "Ej.: 110",
    "Z. B.: 110"
  ],
  "saltExample": [
    "Ex.: 4200 ppm",
    "E.g.: 4200 ppm",
    "Ex. : 4200 ppm",
    "Ej.: 4200 ppm",
    "Z. B.: 4200 ppm"
  ],
  "temperatureExample": [
    "Ex.: 25.5 ºC",
    "E.g.: 25.5 ºC",
    "Ex. : 25.5 ºC",
    "Ej.: 25.5 ºC",
    "Z. B.: 25.5 ºC"
  ],
  "orpExample": [
    "Ex.: 720 mV",
    "E.g.: 720 mV",
    "Ex. : 720 mV",
    "Ej.: 720 mV",
    "Z. B.: 720 mV"
  ],
  "targetsPending": [
    "Os intervalos recomendados serão carregados com a ficha técnica quando existirem.",
    "Recommended ranges will be loaded from the technical sheet when available.",
    "Les plages recommandées seront chargées depuis la fiche technique si elles sont disponibles.",
    "Los intervalos recomendados se cargarán desde la ficha técnica cuando estén disponibles.",
    "Empfohlene Bereiche werden aus dem technischen Datenblatt geladen, sofern vorhanden."
  ],
  "work": [
    "Trabalho executado",
    "Work performed",
    "Travail effectué",
    "Trabajo realizado",
    "Ausgeführte Arbeiten"
  ],
  "cleaning": [
    "Limpeza",
    "Cleaning",
    "Nettoyage",
    "Limpieza",
    "Reinigung"
  ],
  "cleaningHint": [
    "Confirmar aspiração, recolha e limpeza geral.",
    "Confirm vacuuming, debris collection and general cleaning.",
    "Confirmez l’aspiration, le ramassage et le nettoyage général.",
    "Confirma aspiración, recogida y limpieza general.",
    "Absaugen, Einsammeln und allgemeine Reinigung bestätigen."
  ],
  "brushing": [
    "Escovado",
    "Brushing",
    "Brossage",
    "Cepillado",
    "Bürsten"
  ],
  "brushingHint": [
    "Marcar se paredes e linhas de água foram escovadas.",
    "Tick if the walls and waterline were brushed.",
    "Cochez si les parois et la ligne d’eau ont été brossées.",
    "Marca si se cepillaron las paredes y la línea de agua.",
    "Ankreuzen, wenn Wände und Wasserlinie gebürstet wurden."
  ],
  "notesHeading": [
    "Notas da visita",
    "Visit notes",
    "Notes de visite",
    "Notas de la visita",
    "Besuchsnotizen"
  ],
  "notesLabel": [
    "Resumo para histórico técnico",
    "Summary for the technical history",
    "Résumé pour l’historique technique",
    "Resumen para el historial técnico",
    "Zusammenfassung für die technische Historie"
  ],
  "notesPlaceholder": [
    "Descreve rapidamente o estado da piscina, ações executadas e alertas para seguimento.",
    "Briefly describe the pool’s condition, work performed and alerts to follow up.",
    "Décrivez brièvement l’état de la piscine, les actions réalisées et les alertes à suivre.",
    "Describe brevemente el estado de la piscina, las acciones realizadas y las alertas para seguimiento.",
    "Poolzustand, ausgeführte Arbeiten und Hinweise zur Nachverfolgung kurz beschreiben."
  ],
  "alternative": [
    "Encerramento alternativo",
    "Alternative closure",
    "Clôture alternative",
    "Cierre alternativo",
    "Alternativer Abschluss"
  ],
  "reasonLabel": [
    "Motivo se a visita não foi realizada",
    "Reason if the visit was not carried out",
    "Motif si la visite n’a pas été réalisée",
    "Motivo si no se realizó la visita",
    "Grund, falls der Besuch nicht durchgeführt wurde"
  ],
  "reasonPlaceholder": [
    "Explica impedimento, ausência de acesso, avaria ou outro bloqueio operacional.",
    "Explain the obstacle, lack of access, breakdown or other operational blockage.",
    "Expliquez l’empêchement, l’absence d’accès, la panne ou tout autre blocage opérationnel.",
    "Explica el impedimento, la falta de acceso, la avería u otro bloqueo operativo.",
    "Hindernis, fehlenden Zugang, Defekt oder andere betriebliche Blockade erläutern."
  ],
  "photoHeading": [
    "Foto de apoio",
    "Supporting photo",
    "Photo à l’appui",
    "Foto de apoyo",
    "Ergänzendes Foto"
  ],
  "photoLabel": [
    "Anexar fotografia do local",
    "Attach a photo of the site",
    "Joindre une photo du site",
    "Adjuntar una fotografía del lugar",
    "Foto des Standorts anhängen"
  ],
  "noFile": [
    "Sem ficheiro selecionado.",
    "No file selected.",
    "Aucun fichier sélectionné.",
    "Ningún archivo seleccionado.",
    "Keine Datei ausgewählt."
  ],
  "upload": [
    "Enviar fotografia",
    "Send photo",
    "Envoyer la photo",
    "Enviar fotografía",
    "Foto senden"
  ],
  "contextHeading": [
    "Contexto operacional",
    "Operational context",
    "Contexte opérationnel",
    "Contexto operativo",
    "Betrieblicher Kontext"
  ],
  "state": [
    "Estado",
    "Status",
    "État",
    "Estado",
    "Status"
  ],
  "contextPending": [
    "A aguardar carregamento do contexto.",
    "Waiting for the context to load.",
    "En attente du chargement du contexte.",
    "Esperando la carga del contexto.",
    "Kontext wird noch geladen."
  ],
  "complete": [
    "Concluir visita",
    "Complete visit",
    "Terminer la visite",
    "Completar visita",
    "Besuch abschließen"
  ],
  "notDone": [
    "Marcar como não feita",
    "Mark as not done",
    "Marquer comme non réalisée",
    "Marcar como no realizada",
    "Als nicht durchgeführt markieren"
  ],
  "refresh": [
    "Atualizar ficha",
    "Refresh record",
    "Actualiser la fiche",
    "Actualizar ficha",
    "Formular aktualisieren"
  ],
  "poolMissing": [
    "Piscina sem nome",
    "Unnamed pool",
    "Piscine sans nom",
    "Piscina sin nombre",
    "Pool ohne Namen"
  ],
  "clientMissing": [
    "Cliente por identificar",
    "Client not identified",
    "Client à identifier",
    "Cliente por identificar",
    "Kunde noch zu ermitteln"
  ],
  "locationMissing": [
    "Local por confirmar",
    "Location to be confirmed",
    "Lieu à confirmer",
    "Lugar por confirmar",
    "Standort noch zu bestätigen"
  ],
  "dateMissing": [
    "Sem data",
    "No date",
    "Sans date",
    "Sin fecha",
    "Kein Datum"
  ],
  "stateMissing": [
    "Sem estado",
    "No status",
    "Sans état",
    "Sin estado",
    "Kein Status"
  ],
  "heroMeta": [
    "{location} · {date} · Estado {status}",
    "{location} · {date} · Status {status}",
    "{location} · {date} · État {status}",
    "{location} · {date} · Estado {status}",
    "{location} · {date} · Status {status}"
  ],
  "topMeta": [
    "Visita #{id} · {status}",
    "Visit #{id} · {status}",
    "Visite nº {id} · {status}",
    "Visita n.º {id} · {status}",
    "Besuch #{id} · {status}"
  ],
  "location": [
    "Local",
    "Location",
    "Lieu",
    "Lugar",
    "Standort"
  ],
  "planned": [
    "Planeada para",
    "Planned for",
    "Prévue pour",
    "Planeada para",
    "Geplant für"
  ],
  "permanentNotes": [
    "Notas permanentes",
    "Permanent notes",
    "Notes permanentes",
    "Notas permanentes",
    "Dauerhafte Notizen"
  ],
  "temporaryNotes": [
    "Notas temporárias",
    "Temporary notes",
    "Notes temporaires",
    "Notas temporales",
    "Vorübergehende Notizen"
  ],
  "alertsOpen": [
    "Alertas abertos",
    "Open alerts",
    "Alertes ouvertes",
    "Alertas abiertas",
    "Offene Hinweise"
  ],
  "alertCount": [
    "{count} alerta(s)",
    "{count} alert(s)",
    "{count} alerte(s)",
    "{count} alerta(s)",
    "{count} Hinweis(e)"
  ],
  "photosAssociated": [
    "Fotos associadas",
    "Associated photos",
    "Photos associées",
    "Fotos asociadas",
    "Zugehörige Fotos"
  ],
  "photoCount": [
    "{count} fotografia(s)",
    "{count} photo(s)",
    "{count} photo(s)",
    "{count} fotografía(s)",
    "{count} Foto(s)"
  ],
  "rangePh": [
    "pH {min}-{max}",
    "pH {min}-{max}",
    "pH {min}-{max}",
    "pH {min}-{max}",
    "pH {min}-{max}"
  ],
  "rangeChlorine": [
    "Cloro {min}-{max}",
    "Chlorine {min}-{max}",
    "Chlore {min}-{max}",
    "Cloro {min}-{max}",
    "Chlor {min}-{max}"
  ],
  "rangeAlkalinity": [
    "Alcalinidade {min}-{max}",
    "Alkalinity {min}-{max}",
    "Alcalinité {min}-{max}",
    "Alcalinidad {min}-{max}",
    "Alkalinität {min}-{max}"
  ],
  "ranges": [
    "Intervalos recomendados: {ranges}.",
    "Recommended ranges: {ranges}.",
    "Plages recommandées : {ranges}.",
    "Intervalos recomendados: {ranges}.",
    "Empfohlene Bereiche: {ranges}."
  ],
  "noRanges": [
    "Sem ficha técnica com intervalos definidos.",
    "No technical sheet with defined ranges.",
    "Aucune fiche technique avec des plages définies.",
    "Sin ficha técnica con intervalos definidos.",
    "Kein technisches Datenblatt mit festgelegten Bereichen."
  ],
  "noSelection": [
    "Sem visita selecionada. Abre esta página a partir da rota do técnico.",
    "No visit selected. Open this page from the technician’s route.",
    "Aucune visite sélectionnée. Ouvrez cette page depuis la tournée du technicien.",
    "Ninguna visita seleccionada. Abre esta página desde la ruta del técnico.",
    "Kein Besuch ausgewählt. Diese Seite über die Technikerroute öffnen."
  ],
  "selectValid": [
    "Escolhe uma visita válida para continuar.",
    "Choose a valid visit to continue.",
    "Choisissez une visite valide pour continuer.",
    "Elige una visita válida para continuar.",
    "Einen gültigen Besuch auswählen, um fortzufahren."
  ],
  "loading": [
    "A carregar dados reais da visita.",
    "Loading actual visit data.",
    "Chargement des données réelles de la visite.",
    "Cargando los datos reales de la visita.",
    "Besuchsdaten werden geladen."
  ],
  "visitUnavailable": [
    "Visita indisponível.",
    "Visit unavailable.",
    "Visite indisponible.",
    "Visita no disponible.",
    "Besuch nicht verfügbar."
  ],
  "ready": [
    "Ficha da visita pronta para registo de leituras e fecho.",
    "Visit record ready for readings and completion.",
    "Fiche de visite prête pour les mesures et la clôture.",
    "Ficha de la visita lista para registrar lecturas y cerrar.",
    "Besuchsformular ist bereit für Messwerte und Abschluss."
  ],
  "loadFailed": [
    "Não foi possível carregar a visita.",
    "Could not load the visit.",
    "Impossible de charger la visite.",
    "No se pudo cargar la visita.",
    "Besuch konnte nicht geladen werden."
  ],
  "contextError": [
    "Erro",
    "Error",
    "Erreur",
    "Error",
    "Fehler"
  ],
  "contextUnavailable": [
    "Sem contexto disponível.",
    "No context available.",
    "Aucun contexte disponible.",
    "Sin contexto disponible.",
    "Kein Kontext verfügbar."
  ],
  "loadFallback": [
    "Falha ao carregar visita.",
    "Failed to load visit.",
    "Échec du chargement de la visite.",
    "Error al cargar la visita.",
    "Besuch konnte nicht geladen werden."
  ],
  "completing": [
    "A concluir visita e a fechar o relatório técnico.",
    "Completing the visit and closing the technical report.",
    "Clôture de la visite et du rapport technique.",
    "Completando la visita y cerrando el informe técnico.",
    "Besuch und technischer Bericht werden abgeschlossen."
  ],
  "completed": [
    "Visita concluída com sucesso.",
    "Visit completed successfully.",
    "Visite terminée avec succès.",
    "Visita completada correctamente.",
    "Besuch erfolgreich abgeschlossen."
  ],
  "completeFallback": [
    "Não foi possível concluir a visita.",
    "Could not complete the visit.",
    "Impossible de terminer la visite.",
    "No se pudo completar la visita.",
    "Besuch konnte nicht abgeschlossen werden."
  ],
  "reasonMissing": [
    "Indica primeiro o motivo para marcar a visita como não feita.",
    "First enter the reason for marking the visit as not done.",
    "Indiquez d’abord le motif pour marquer la visite comme non réalisée.",
    "Indica primero el motivo para marcar la visita como no realizada.",
    "Zuerst einen Grund eingeben, um den Besuch als nicht durchgeführt zu markieren."
  ],
  "notDoing": [
    "A marcar a visita como não realizada.",
    "Marking the visit as not carried out.",
    "Marquage de la visite comme non réalisée.",
    "Marcando la visita como no realizada.",
    "Besuch wird als nicht durchgeführt markiert."
  ],
  "notDoneSuccess": [
    "Visita marcada como não feita.",
    "Visit marked as not done.",
    "Visite marquée comme non réalisée.",
    "Visita marcada como no realizada.",
    "Besuch als nicht durchgeführt markiert."
  ],
  "notDoneFallback": [
    "Não foi possível marcar a visita como não feita.",
    "Could not mark the visit as not done.",
    "Impossible de marquer la visite comme non réalisée.",
    "No se pudo marcar la visita como no realizada.",
    "Besuch konnte nicht als nicht durchgeführt markiert werden."
  ],
  "fileMissing": [
    "Seleciona primeiro uma fotografia para enviar.",
    "First select a photo to send.",
    "Sélectionnez d’abord une photo à envoyer.",
    "Selecciona primero una fotografía para enviar.",
    "Zuerst ein Foto zum Senden auswählen."
  ],
  "uploading": [
    "A enviar fotografia da visita.",
    "Sending the visit photo.",
    "Envoi de la photo de visite.",
    "Enviando la fotografía de la visita.",
    "Besuchsfoto wird gesendet."
  ],
  "uploaded": [
    "Fotografia enviada com sucesso.",
    "Photo sent successfully.",
    "Photo envoyée avec succès.",
    "Fotografía enviada correctamente.",
    "Foto erfolgreich gesendet."
  ],
  "uploadedHint": [
    "Fotografia enviada. Podes anexar outra se necessário.",
    "Photo sent. You can attach another if needed.",
    "Photo envoyée. Vous pouvez en joindre une autre si nécessaire.",
    "Fotografía enviada. Puedes adjuntar otra si es necesario.",
    "Foto gesendet. Bei Bedarf kann ein weiteres angehängt werden."
  ],
  "uploadFallback": [
    "Não foi possível enviar a fotografia.",
    "Could not send the photo.",
    "Impossible d’envoyer la photo.",
    "No se pudo enviar la fotografía.",
    "Foto konnte nicht gesendet werden."
  ],
  "fileMeta": [
    "{name} · {size} KB",
    "{name} · {size} KB",
    "{name} · {size} KB",
    "{name} · {size} KB",
    "{name} · {size} KB"
  ],
  "httpFailure": [
    "Falha HTTP {status}",
    "HTTP failure {status}",
    "Échec HTTP {status}",
    "Error HTTP {status}",
    "HTTP-Fehler {status}"
  ]
};
  const guardCopy={
  "accountChanged": [
    "A conta mudou. Atualiza a ficha com a conta atual.",
    "Account changed. Refresh the record using the current account.",
    "Le compte a changé. Actualisez la fiche avec le compte actuel.",
    "La cuenta ha cambiado. Actualiza la ficha con la cuenta actual.",
    "Das Konto wurde gewechselt. Formular mit dem aktuellen Konto neu laden."
  ],
  "accountUnavailable": [
    "A sessão já não permite esta visita. Volta a entrar com a conta original.",
    "The session no longer permits this visit. Sign in again with the original account.",
    "La session ne permet plus cette visite. Reconnectez-vous avec le compte initial.",
    "La sesión ya no permite esta visita. Vuelve a entrar con la cuenta original.",
    "Die Sitzung erlaubt diesen Besuch nicht mehr. Erneut mit dem ursprünglichen Konto anmelden."
  ]
};
  const entries=new WeakSet(),bindings=new Map(),attributes=new Map(),errors=new WeakMap();
  const value=(key,params={})=>{const entry=Object.freeze({key,params:Object.freeze({...params})});entries.add(entry);return entry;};
  function text(entry,language=document.documentElement.lang||'pt') {
    if(!entry||typeof entry!=='object'||!entries.has(entry))return String(entry??'');
    const index=Math.max(0,languages.indexOf(String(language).toLowerCase().split('-')[0]));
    return (copy[entry.key]||guardCopy[entry.key])[index].replace(/\{(\w+)\}/g,(_,key)=>entry.parts?entry.parts.map(part=>text(part,language)).join(' · '):text(entry.params[key],language));
  }
  function clearTree(root){if(root)for(const node of bindings.keys())if(root.contains(node))bindings.delete(node);}
  function bind(node,entry){
    if(!node)return;
    if(!entry||typeof entry!=='object'||!entries.has(entry)){bindings.delete(node);return;}
    const rendered=text(entry);
    if(node.textContent!==rendered){if(node.childNodes.length===1&&node.firstChild.nodeType===Node.TEXT_NODE)node.firstChild.nodeValue=rendered;else node.textContent=rendered;}
    bindings.set(node,{entry,rendered,textNode:node.firstChild,parent:node.parentNode});
  }
  function setText(node,entry){if(!node)return;clearTree(node);node.textContent=text(entry);bind(node,entry);}
  function bindAttribute(node,name,entry){if(!node)return;const rendered=text(entry);node.setAttribute(name,rendered);attributes.set(node,{name,entry,rendered,parent:node.parentNode});}
  function paint(){
    for(const [node,leaf] of bindings){
      if(!node.isConnected||node.parentNode!==leaf.parent||node.childNodes.length!==1||node.firstChild!==leaf.textNode||leaf.textNode.nodeValue!==leaf.rendered){bindings.delete(node);continue;}
      const rendered=text(leaf.entry);if(rendered!==leaf.rendered)leaf.textNode.nodeValue=rendered;leaf.rendered=rendered;
    }
    for(const [node,leaf] of attributes){
      if(!node.isConnected||node.parentNode!==leaf.parent||node.getAttribute(leaf.name)!==leaf.rendered){attributes.delete(node);continue;}
      const rendered=text(leaf.entry);if(rendered!==leaf.rendered)node.setAttribute(leaf.name,rendered);leaf.rendered=rendered;
    }
  }
  for(const selector of ['main.visit-shell','.visit-topbar']){const root=document.querySelector(selector);if(root){root.dataset.cwNoI18n='';root.dataset.cwStateManaged='manual';}}
  const labels=[["title", "title"], [".visit-back", "back"], [".visit-top-meta > b", "execution"], ["#visitTopMeta", "topIntro"], [".visit-kicker", "kicker"], [".visit-title", "heading"], ["#visitHeroCopy", "intro"], [".visit-stat:nth-child(1)>span", "pool"], [".visit-stat:nth-child(2)>span", "client"], [".visit-stat:nth-child(3)>span", "alerts"], [".visit-stat:nth-child(4)>span", "photos"], ["#heroPool", "toLoad"], ["#heroClient", "toLoad"], ["#statusBox", "preparing"], [".visit-section-label", "summary"], ["#info>.visit-empty", "infoLoading"], [".visit-grid>section>.visit-card:nth-child(2)>h3", "readings"], ["label[for=ph]", "ph"], ["label[for=chlorine]", "chlorine"], ["label[for=alkalinity]", "alkalinity"], ["label[for=salt]", "salt"], ["label[for=temperature]", "temperature"], ["label[for=orp]", "orp"], ["#targetRanges", "targetsPending"], [".visit-grid>section>.visit-card:nth-child(3)>h3", "work"], ["label[for=cleaned] strong", "cleaning"], ["label[for=cleaned] small", "cleaningHint"], ["label[for=brushed] strong", "brushing"], ["label[for=brushed] small", "brushingHint"], [".visit-grid>section>.visit-card:nth-child(4)>h3", "notesHeading"], ["label[for=notes]", "notesLabel"], [".visit-grid>aside>.visit-card:nth-child(1)>h3", "alternative"], ["label[for=notDoneReason]", "reasonLabel"], [".visit-file-box>h3", "photoHeading"], ["label[for=photo]", "photoLabel"], ["#photoMeta", "noFile"], ["#uploadBtn", "upload"], [".visit-grid>aside>.visit-card:nth-child(3)>h3", "contextHeading"], ["#contextBox span", "state"], ["#contextBox strong", "contextPending"], ["#completeBtn", "complete"], ["#notDoneBtn", "notDone"], ["#refreshBtn", "refresh"]];
  for(const [selector,key] of labels){const node=document.querySelector(selector);if(!node||node.childNodes.length!==1||node.firstChild.nodeType!==Node.TEXT_NODE||node.textContent!==copy[key][0])continue;node.dataset.cwNoI18n='';bind(node,value(key));}
  const attributeLabels=[["#ph", "placeholder", "phExample"], ["#chlorine", "placeholder", "chlorineExample"], ["#alkalinity", "placeholder", "alkalinityExample"], ["#salt", "placeholder", "saltExample"], ["#temperature", "placeholder", "temperatureExample"], ["#orp", "placeholder", "orpExample"], ["#notes", "placeholder", "notesPlaceholder"], ["#notDoneReason", "placeholder", "reasonPlaceholder"]];
  for(const [selector,name,key] of attributeLabels){const node=document.querySelector(selector);if(node?.getAttribute(name)===copy[key][0])bindAttribute(node,name,value(key));}
  const style=document.createElement('style');style.textContent='main.visit-shell .visit-hero,main.visit-shell .visit-stat,main.visit-shell .visit-meta-item,main.visit-shell .visit-card,main.visit-shell .visit-status,main.visit-shell .visit-file-meta,.visit-topbar .visit-top-meta{min-width:0;overflow-wrap:anywhere;}main.visit-shell .visit-hero .visit-title{color:#fff;}';document.head.appendChild(style);
  window.addEventListener('cw-language-change',paint);
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  function languageReady(){const language=new URLSearchParams(location.search).get('lang');if(languages.includes(language))window.CristalI18n?.applyLanguage(language);paint();}
  if(window.CristalI18n)languageReady();else{
    let script=document.querySelector('script[src="/cw-i18n.js"]');
    if(!script){script=document.createElement('script');script.src='/cw-i18n.js';script.defer=true;script.addEventListener('load',languageReady,{once:true});document.head.appendChild(script);}
    else script.addEventListener('load',languageReady,{once:true});
  }
  return Object.freeze({value,text,bind,setText,clearTree,join:(key,parts)=>{const entry=Object.freeze({key,parts:Object.freeze([...parts])});entries.add(entry);return entry;},error:entry=>{const error=new Error(text(entry));errors.set(error,entry);return error;},failure:(error,key)=>errors.get(error)||error?.message||value(key)});
})();

const API = "/api";

const params = new URLSearchParams(window.location.search);
const visitId = params.get("visit");

const infoBox = document.getElementById("info");
const contextBox = document.getElementById("contextBox");
const statusBox = document.getElementById("statusBox");
const photoInput = document.getElementById("photo");
const photoMeta = document.getElementById("photoMeta");
const uploadBtn = document.getElementById("uploadBtn");
const completeBtn = document.getElementById("completeBtn");
const notDoneBtn = document.getElementById("notDoneBtn");
const refreshBtn = document.getElementById("refreshBtn");
const targetRanges = document.getElementById("targetRanges");

// A late reply is tied to the requesting principal and the current read generation.
const visitGuard = (() => {
  const fields=['ph','chlorine','alkalinity','salt','temperature','orp','cleaned','brushed','notes','notDoneReason','photo'];
  const work=new Map();let owner=null,generation=0,blocked=false,loaded=false,hasPrivateFields=false;
  function session(){
    try{
      const credential=window.CristalAuth?.getToken?.()||localStorage.getItem('cristalwater_jwt')||localStorage.getItem('token')||'';
      const user=window.CristalAuth?.parseUser?.()||JSON.parse(localStorage.getItem('cristalwater_user')||localStorage.getItem('user')||'{}');
      const chunk=credential.split('.')[1];if(!chunk)return null;
      const claims=JSON.parse(atob(chunk.replace(/-/g,'+').replace(/_/g,'/'))),role=String(claims.role||'').toUpperCase().trim();
      const kind=String(claims.principalType||'').toUpperCase()==='USER'?'USER':'TECH';
      const id=Number(kind==='USER'?(claims.userId||claims.id):claims.id),technicianId=Number(claims.technicianId||(kind==='TECH'?claims.id:0));
      if(!['TECHNICIAN','TEAM_LEADER'].includes(role)||String(user.role||'').toUpperCase().trim()!==role||!Number.isInteger(id)||id<=0||!Number.isInteger(technicianId)||technicianId<=0||Number(user.id)!==Number(claims.id)||(kind==='USER'&&Number(user.userId||user.id)!==id)||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000)return null;
      if(user.technicianId&&Number(user.technicianId)!==technicianId)return null;
      return {owner:role+':'+kind+':'+id+':TECH:'+technicianId};
    }catch(_){return null;}
  }
  function remember(){
    if(!owner||!hasPrivateFields||blocked)return;
    work.set(owner,fields.map(id=>{const node=document.getElementById(id);return {id,value:node.type==='file'?Array.from(node.files):node.type==='checkbox'?node.checked:node.value};}));
  }
  function restore(){
    const saved=work.get(owner);if(!saved)return;
    for(const {id,value} of saved){const node=document.getElementById(id);if(node.type==='file'){const transfer=new DataTransfer();for(const file of value)transfer.items.add(file);node.files=transfer.files;visitUi.setText(photoMeta,value.length?visitUi.value('fileMeta',{name:value[0].name,size:Math.max(1,Math.round(value[0].size/1024))}):visitUi.value('noFile'));}else if(node.type==='checkbox')node.checked=value;else node.value=value;}
  }
  function clear(){
    for(const id of fields){const node=document.getElementById(id);if(node.type==='checkbox')node.checked=false;else node.value='';}
    for(const id of ['heroPool','heroClient'])visitUi.setText(document.getElementById(id),visitUi.value('toLoad'));
    for(const id of ['heroAlerts','heroPhotos'])document.getElementById(id).textContent='0';
    visitUi.setText(document.getElementById('visitHeroCopy'),visitUi.value('intro'));visitUi.setText(document.getElementById('visitTopMeta'),visitUi.value('topIntro'));
    visitUi.setText(targetRanges,visitUi.value('targetsPending'));visitUi.setText(photoMeta,visitUi.value('noFile'));
    visitUi.clearTree(infoBox);infoBox.innerHTML='<p class="visit-empty"></p>';
    visitUi.clearTree(contextBox);contextBox.innerHTML='<div class="visit-meta-item"><span></span><strong></strong></div>';
    visitUi.setText(contextBox.querySelector('span'),visitUi.value('contextError'));visitUi.setText(contextBox.querySelector('strong'),visitUi.value('contextUnavailable'));
  }
  function check(){
    const now=session();if(now?.owner===owner&&!blocked)return true;
    if(!blocked){remember();generation++;loaded=false;hasPrivateFields=false;blocked=true;clear();}
    const entry=visitUi.value(now?'accountChanged':'accountUnavailable');visitUi.setText(infoBox.firstChild,entry);setStatus(entry,'error');setFormEnabled(false);refreshBtn.disabled=!now;
    return false;
  }
  function startLoad(){
    const now=session();if(!now){check();return null;}
    const restoreWork=blocked||now.owner!==owner;
    if(now.owner!==owner){check();owner=now.owner;hasPrivateFields=false;}
    blocked=false;loaded=false;return {owner,generation:++generation,restoreWork};
  }
  function current(captured){const now=session();if(now?.owner!==owner){check();return false;}return !!captured&&!blocked&&captured.owner===owner&&captured.generation===generation;}
  function canWrite(){return check()&&loaded;}
  function capture(){return canWrite()?{owner,generation}:null;}
  function finishLoad(captured){if(!current(captured))return false;if(captured.restoreWork)restore();loaded=true;hasPrivateFields=true;window.dispatchEvent(new Event('cw:visit-context-ready'));return true;}
  function finishBusy(captured){if(session()?.owner!==captured.owner||blocked){check();return;}setBusy(false);setFormEnabled(loaded);}
  owner=session()?.owner||null;
  window.addEventListener('cw:session-change',check);
  window.addEventListener('storage',event=>{if(event.key===null||['token','cristalwater_jwt','adminToken','user','cristalwater_user'].includes(event.key))check();});
  window.CWVisitNavigationMemory=Object.freeze({scope(){
    const id=Number(visitId);
    return canWrite()&&Number.isSafeInteger(id)&&id>0?{owner,visitId:String(id)}:null;
  }});
  return Object.freeze({startLoad,current,capture,finishLoad,finishBusy});
})();

function setStatus(message, tone = "") {
  if (!statusBox) return;
  visitUi.setText(statusBox,message);
  if (tone) {
    statusBox.dataset.tone = tone;
  } else {
    statusBox.removeAttribute("data-tone");
  }
}

function asNumberOrNull(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function formatDate(value) {
  if (!value) return visitUi.value("dateMissing");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return visitUi.value("dateMissing");
  return parsed.toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setBusy(isBusy) {
  [uploadBtn, completeBtn, notDoneBtn, refreshBtn].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
}

function setFormEnabled(isEnabled) {
  [
    'ph',
    'chlorine',
    'alkalinity',
    'salt',
    'temperature',
    'orp',
    'cleaned',
    'brushed',
    'notes',
    'notDoneReason',
    'photo',
  ].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.disabled = !isEnabled;
  });
  if (uploadBtn) uploadBtn.disabled = !isEnabled;
  if (completeBtn) completeBtn.disabled = !isEnabled;
  if (notDoneBtn) notDoneBtn.disabled = !isEnabled;
}

function requireVisitAccess() {
  if (!window.CristalAuth) return true;
  const hydrated = window.CristalAuth.hydrate();
  if (!hydrated) {
    window.CristalAuth.logout();
    return false;
  }
  const user = window.CristalAuth.parseUser ? window.CristalAuth.parseUser() : {};
  const role = String(user.role || "").toUpperCase().trim();
  if (!["TECHNICIAN", "TEAM_LEADER", "ADMIN"].includes(role)) {
    window.CristalAuth.logout();
    return false;
  }
  return true;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  if (!response.ok) {
    throw data.error || data.message ? new Error(data.error || data.message) : visitUi.error(visitUi.value("httpFailure",{status:response.status}));
  }
  return data;
}

function getPayload() {
  return {
    visitId: Number(visitId),
    ph: asNumberOrNull(document.getElementById("ph")?.value),
    chlorine: asNumberOrNull(document.getElementById("chlorine")?.value),
    alkalinity: asNumberOrNull(document.getElementById("alkalinity")?.value),
    salt: asNumberOrNull(document.getElementById("salt")?.value),
    temperature: asNumberOrNull(document.getElementById("temperature")?.value),
    orp: asNumberOrNull(document.getElementById("orp")?.value),
    cleaned: Boolean(document.getElementById("cleaned")?.checked),
    brushed: Boolean(document.getElementById("brushed")?.checked),
    notes: String(document.getElementById("notes")?.value || "").trim(),
  };
}

function renderVisit(visit, context = {}) {
  const poolName = visit?.pool?.name || context.pool?.name || visitUi.value("poolMissing");
  const clientName = visit?.client?.name || context.customer?.name || visitUi.value("clientMissing");
  const location = context.pool?.location || context.pool?.address || visit?.pool?.location || visit?.pool?.address || visitUi.value("locationMissing");
  const plannedDate = formatDate(visit?.plannedDate || visit?.date || visit?.startAt);
  const status = visit?.status || visitUi.value("stateMissing");
  const photosCount = Array.isArray(visit?.photos) ? visit.photos.length : Number(context.photosCount || 0);
  const alertsCount = Number(context.alertsCount || 0);

  const setValue = (id, value) => {
    const input = document.getElementById(id);
    if (input && value !== undefined && value !== null && input.value === "") input.value = String(value);
  };

  setValue("ph", visit?.ph);
  setValue("chlorine", visit?.chlorine);
  setValue("alkalinity", visit?.alkalinity);
  setValue("salt", visit?.salt);
  setValue("temperature", visit?.temperature);
  setValue("orp", visit?.orpMv);
  const notesInput = document.getElementById("notes");
  if (notesInput && !notesInput.value && visit?.notes) notesInput.value = visit.notes;

  visitUi.setText(document.getElementById("heroPool"),poolName);
  visitUi.setText(document.getElementById("heroClient"),clientName);
  document.getElementById("heroAlerts").textContent = String(alertsCount);
  document.getElementById("heroPhotos").textContent = String(photosCount);
  visitUi.setText(document.getElementById("visitHeroCopy"),visitUi.value("heroMeta",{location,date:plannedDate,status}));
  visitUi.setText(document.getElementById("visitTopMeta"),visitUi.value("topMeta",{id:visit.id||visitId,status}));

  if (infoBox) {
    visitUi.clearTree(infoBox);
    infoBox.innerHTML = `
      <div class="visit-meta-item">
        <span>${escapeHtml(visitUi.text(visitUi.value("pool")))}</span>
        <strong>${escapeHtml(visitUi.text(poolName))}</strong>
      </div>
      <div class="visit-meta-item">
        <span>${escapeHtml(visitUi.text(visitUi.value("client")))}</span>
        <strong>${escapeHtml(visitUi.text(clientName))}</strong>
      </div>
      <div class="visit-meta-item">
        <span>${escapeHtml(visitUi.text(visitUi.value("location")))}</span>
        <strong>${escapeHtml(visitUi.text(location))}</strong>
      </div>
      <div class="visit-meta-item">
        <span>${escapeHtml(visitUi.text(visitUi.value("planned")))}</span>
        <strong>${escapeHtml(visitUi.text(plannedDate))}</strong>
      </div>
    `;
    for(const [index,entry] of [visitUi.value('pool'),visitUi.value('client'),visitUi.value('location'),visitUi.value('planned')].entries())visitUi.bind(infoBox.children[index]?.querySelector('span'),entry);
    for(const [index,entry] of [poolName,clientName,location,plannedDate].entries())visitUi.bind(infoBox.children[index]?.querySelector('strong'),entry);
  }

  if (contextBox) {
    const permanentNotes = context.permanentNotes ? `<div class="visit-meta-item"><span>${escapeHtml(visitUi.text(visitUi.value("permanentNotes")))}</span><strong>${escapeHtml(context.permanentNotes)}</strong></div>` : "";
    const temporaryNotes = context.temporaryNotes ? `<div class="visit-meta-item"><span>${escapeHtml(visitUi.text(visitUi.value("temporaryNotes")))}</span><strong>${escapeHtml(context.temporaryNotes)}</strong></div>` : "";
    visitUi.clearTree(contextBox);
    contextBox.innerHTML = `
      <div class="visit-meta-item">
        <span>${escapeHtml(visitUi.text(visitUi.value("alertsOpen")))}</span>
        <strong>${escapeHtml(visitUi.text(visitUi.value("alertCount",{count:alertsCount})))}</strong>
      </div>
      <div class="visit-meta-item">
        <span>${escapeHtml(visitUi.text(visitUi.value("photosAssociated")))}</span>
        <strong>${escapeHtml(visitUi.text(visitUi.value("photoCount",{count:photosCount})))}</strong>
      </div>
      ${permanentNotes}
      ${temporaryNotes}
    `;
    const labelEntries=[visitUi.value('alertsOpen'),visitUi.value('photosAssociated')];
    if(context.permanentNotes)labelEntries.push(visitUi.value('permanentNotes'));
    if(context.temporaryNotes)labelEntries.push(visitUi.value('temporaryNotes'));
    labelEntries.forEach((entry,index)=>visitUi.bind(contextBox.children[index]?.querySelector('span'),entry));
    visitUi.bind(contextBox.children[0]?.querySelector('strong'),visitUi.value('alertCount',{count:alertsCount}));
    visitUi.bind(contextBox.children[1]?.querySelector('strong'),visitUi.value('photoCount',{count:photosCount}));
  }

  const targets = context.chemistryTargets;
  if (targetRanges && targets) {
    const parts = [];
    if (targets.ph && targets.ph.min != null && targets.ph.max != null) parts.push(visitUi.value("rangePh",{min:targets.ph.min,max:targets.ph.max}));
    if (targets.chlorine && targets.chlorine.min != null && targets.chlorine.max != null) parts.push(visitUi.value("rangeChlorine",{min:targets.chlorine.min,max:targets.chlorine.max}));
    if (targets.alkalinity && targets.alkalinity.min != null && targets.alkalinity.max != null) parts.push(visitUi.value("rangeAlkalinity",{min:targets.alkalinity.min,max:targets.alkalinity.max}));
    visitUi.setText(targetRanges,parts.length?visitUi.join("ranges",parts):visitUi.value("noRanges"));
  } else if(targetRanges)visitUi.setText(targetRanges,visitUi.value('noRanges'));
}

async function loadVisit() {
  if (!requireVisitAccess()) {
    return;
  }

  const captured=visitGuard.startLoad();if(!captured)return;
  if (!visitId) {
    setStatus(visitUi.value("noSelection"), "error");
    setFormEnabled(false);
    if(infoBox){visitUi.clearTree(infoBox);infoBox.innerHTML='<p class="visit-empty"></p>';visitUi.setText(infoBox.firstChild,visitUi.value("selectValid"));}
    return;
  }

  setFormEnabled(false);
  setStatus(visitUi.value("loading"), "loading");

  try {
    const data = await parseResponse(await fetch(`${API}/visits/${visitId}`));
    if(!visitGuard.current(captured))return;
    const visit = data.visit;
    if(!visit||Number(visit.id)!==Number(visitId))throw visitUi.error(visitUi.value("visitUnavailable"));
    renderVisit(visit, data.context || {});
    if(!visitGuard.finishLoad(captured))return;
    setFormEnabled(true);
    setStatus(visitUi.value("ready"), "success");
  } catch (error) {
    if(!visitGuard.current(captured))return;
    if(infoBox){visitUi.clearTree(infoBox);infoBox.innerHTML='<p class="visit-empty"></p>';visitUi.setText(infoBox.firstChild,visitUi.value("loadFailed"));}
    if(contextBox){visitUi.clearTree(contextBox);contextBox.innerHTML='<div class="visit-meta-item"><span></span><strong></strong></div>';visitUi.setText(contextBox.querySelector("span"),visitUi.value("contextError"));visitUi.setText(contextBox.querySelector("strong"),visitUi.value("contextUnavailable"));}
    setFormEnabled(false);
    setStatus(visitUi.failure(error,"loadFallback"), "error");
  }
}

async function completeVisit() {
  if (!visitId) return;
  const captured=visitGuard.capture();if(!captured)return;
  setBusy(true);
  setStatus(visitUi.value("completing"), "loading");

  try {
    await parseResponse(await fetch(`${API}/visits/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getPayload()),
    }));
    if(!visitGuard.current(captured))return;
    setStatus(visitUi.value("completed"), "success");
    await loadVisit();
  } catch (error) {
    if(!visitGuard.current(captured))return;
    setStatus(visitUi.failure(error,"completeFallback"), "error");
  } finally {
    visitGuard.finishBusy(captured);
  }
}

async function markNotDone() {
  if (!visitId) return;
  const captured=visitGuard.capture();if(!captured)return;
  const reason = String(document.getElementById("notDoneReason")?.value || "").trim();
  if (!reason) {
    setStatus(visitUi.value("reasonMissing"), "warning");
    return;
  }

  setBusy(true);
  setStatus(visitUi.value("notDoing"), "loading");

  try {
    await parseResponse(await fetch(`${API}/visits/${visitId}/not-done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: reason, internalNotes: reason }),
    }));
    if(!visitGuard.current(captured))return;
    setStatus(visitUi.value("notDoneSuccess"), "success");
    await loadVisit();
  } catch (error) {
    if(!visitGuard.current(captured))return;
    setStatus(visitUi.failure(error,"notDoneFallback"), "error");
  } finally {
    visitGuard.finishBusy(captured);
  }
}

async function uploadPhoto() {
  if (!visitId) return;
  const captured=visitGuard.capture();if(!captured)return;
  const file = photoInput?.files?.[0];
  if (!file) {
    setStatus(visitUi.value("fileMissing"), "warning");
    return;
  }

  const form = new FormData();
  form.append("photo", file);

  setBusy(true);
  setStatus(visitUi.value("uploading"), "loading");

  try {
    await parseResponse(await fetch(`${API}/visits/${visitId}/photo`, {
      method: "POST",
      body: form,
    }));
    if(!visitGuard.current(captured))return;
    setStatus(visitUi.value("uploaded"), "success");
    if (photoInput) photoInput.value = "";
    if(photoMeta)visitUi.setText(photoMeta,visitUi.value("uploadedHint"));
    await loadVisit();
  } catch (error) {
    if(!visitGuard.current(captured))return;
    setStatus(visitUi.failure(error,"uploadFallback"), "error");
  } finally {
    visitGuard.finishBusy(captured);
  }
}

if (photoInput) {
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    visitUi.setText(photoMeta,file?visitUi.value("fileMeta",{name:file.name,size:Math.max(1,Math.round(file.size/1024))}):visitUi.value("noFile"));
  });
}

if (uploadBtn) uploadBtn.addEventListener("click", uploadPhoto);
if (completeBtn) completeBtn.addEventListener("click", completeVisit);
if (notDoneBtn) notDoneBtn.addEventListener("click", markNotDone);
if (refreshBtn) refreshBtn.addEventListener("click", loadVisit);

window.completeVisit = completeVisit;
window.markNotDone = markNotDone;
window.uploadPhoto = uploadPhoto;

loadVisit();
