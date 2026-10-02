(function () {
  'use strict';
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
    title: ['Sugestão de rota', 'Route suggestion', 'Suggestion de parcours', 'Sugerencia de ruta', 'Routenvorschlag'],
    intro: [
      'Visitas regulares planeadas para o técnico e dia escolhidos, a partir da sua localização atual. A ordem é uma sugestão por proximidade, sem trânsito ou horários. Não altera o planeamento nem inclui visitas extra ou já iniciadas.',
      'Regular visits planned for the selected technician and day, starting from your current location. The order is a proximity suggestion, without traffic or schedules. It does not change planning or include extra visits or visits already started.',
      'Visites régulières prévues pour le technicien et le jour choisis, depuis votre position actuelle. L’ordre est une suggestion de proximité, sans circulation ni horaires. Le planning reste inchangé ; les visites supplémentaires ou déjà commencées sont exclues.',
      'Visitas regulares planificadas para el técnico y el día elegidos, desde su ubicación actual. El orden es una sugerencia por proximidad, sin tráfico ni horarios. No modifica la planificación ni incluye visitas extra o ya iniciadas.',
      'Reguläre Besuche für den gewählten Techniker und Tag, ausgehend von Ihrem aktuellen Standort. Die Reihenfolge ist ein Vorschlag nach Nähe, ohne Verkehr oder Zeitplanung. Die Planung bleibt unverändert; Zusatzbesuche und bereits begonnene Besuche sind ausgeschlossen.'
    ],
    pools: ['Consultar piscinas', 'View pools', 'Consulter les piscines', 'Consultar piscinas', 'Pools anzeigen'],
    day: ['Dia', 'Day', 'Jour', 'Día', 'Tag'],
    technician: ['Técnico', 'Technician', 'Technicien', 'Técnico', 'Techniker'],
    reloadTechnicians: ['Atualizar técnicos', 'Refresh technicians', 'Actualiser les techniciens', 'Actualizar técnicos', 'Techniker aktualisieren'],
    reload: ['Atualizar sugestão', 'Refresh suggestion', 'Actualiser la suggestion', 'Actualizar sugerencia', 'Vorschlag aktualisieren'],
    mapLabel: ['Mapa com localizações confirmadas', 'Map with confirmed locations', 'Carte des positions confirmées', 'Mapa con ubicaciones confirmadas', 'Karte mit bestätigten Standorten'],
    session: ['A sessão mudou. Reabra a página com a conta pretendida.', 'The session changed. Reopen the page with the intended account.', 'La session a changé. Rouvrez la page avec le compte souhaité.', 'La sesión ha cambiado. Abra de nuevo la página con la cuenta deseada.', 'Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut mit dem gewünschten Konto.'],
    unavailable: ['Mapa indisponível. Consulte a lista e abra a navegação de cada piscina.', 'Map unavailable. Use the list and open navigation for each pool.', 'Carte indisponible. Consultez la liste et ouvrez la navigation de chaque piscine.', 'Mapa no disponible. Consulte la lista y abra la navegación de cada piscina.', 'Karte nicht verfügbar. Nutzen Sie die Liste und öffnen Sie die Navigation zu jedem Pool.'],
    mapped: ['Os pontos com coordenadas confirmadas aparecem também no mapa.', 'Points with confirmed coordinates also appear on the map.', 'Les points aux coordonnées confirmées figurent aussi sur la carte.', 'Los puntos con coordenadas confirmadas también aparecen en el mapa.', 'Punkte mit bestätigten Koordinaten erscheinen auch auf der Karte.'],
    noGps: ['Este dispositivo não disponibiliza localização.', 'This device does not provide location.', 'Cet appareil ne fournit pas de position.', 'Este dispositivo no ofrece ubicación.', 'Dieses Gerät stellt keinen Standort bereit.'],
    gps: ['Não foi possível obter a localização. Autorize o GPS e tente novamente.', 'Unable to obtain your location. Allow GPS and try again.', 'Impossible d’obtenir votre position. Autorisez le GPS et réessayez.', 'No se pudo obtener la ubicación. Autorice el GPS e inténtelo de nuevo.', 'Der Standort konnte nicht ermittelt werden. Erlauben Sie GPS und versuchen Sie es erneut.'],
    staleGps: ['A localização recebida não é atual ou válida. Tente novamente.', 'The received location is not current or valid. Try again.', 'La position reçue n’est pas récente ou valide. Réessayez.', 'La ubicación recibida no es actual o válida. Inténtelo de nuevo.', 'Der empfangene Standort ist nicht aktuell oder gültig. Versuchen Sie es erneut.'],
    readError: ['Não foi possível confirmar os dados. Use Atualizar para tentar novamente.', 'Unable to confirm the data. Use Refresh to try again.', 'Impossible de confirmer les données. Utilisez Actualiser pour réessayer.', 'No se pudieron confirmar los datos. Use Actualizar para intentarlo de nuevo.', 'Die Daten konnten nicht bestätigt werden. Nutzen Sie Aktualisieren, um es erneut zu versuchen.'],
    timeout: ['A consulta demorou demasiado. Use Atualizar para tentar novamente.', 'The query took too long. Use Refresh to try again.', 'La consultation a pris trop de temps. Utilisez Actualiser pour réessayer.', 'La consulta tardó demasiado. Use Actualizar para intentarlo de nuevo.', 'Die Abfrage dauerte zu lange. Nutzen Sie Aktualisieren, um es erneut zu versuchen.'],
    coordinates: ['Coordenadas: {coordinates}', 'Coordinates: {coordinates}', 'Coordonnées : {coordinates}', 'Coordenadas: {coordinates}', 'Koordinaten: {coordinates}'],
    missing: ['Sem coordenadas válidas. Confirme a localização na ficha da piscina.', 'No valid coordinates. Confirm the location in the pool record.', 'Aucune coordonnée valide. Confirmez la position dans la fiche de la piscine.', 'Sin coordenadas válidas. Confirme la ubicación en la ficha de la piscina.', 'Keine gültigen Koordinaten. Bestätigen Sie den Standort im Pooldatensatz.'],
    selection: ['A seleção mudou. Atualize para consultar os dados correspondentes.', 'The selection changed. Refresh to view the corresponding data.', 'La sélection a changé. Actualisez pour consulter les données correspondantes.', 'La selección ha cambiado. Actualice para consultar los datos correspondientes.', 'Die Auswahl hat sich geändert. Aktualisieren Sie, um die zugehörigen Daten anzuzeigen.'],
    locating: ['A obter localização atual…', 'Obtaining current location…', 'Obtention de la position actuelle…', 'Obteniendo ubicación actual…', 'Aktueller Standort wird ermittelt…'],
    choose: ['Escolha uma data válida e um técnico.', 'Choose a valid date and a technician.', 'Choisissez une date valide et un technicien.', 'Elija una fecha válida y un técnico.', 'Wählen Sie ein gültiges Datum und einen Techniker.'],
    confirming: ['A confirmar os dados…', 'Confirming data…', 'Confirmation des données…', 'Confirmando los datos…', 'Daten werden bestätigt…'],
    scope: ['A resposta não confirma a seleção. Atualize para tentar novamente.', 'The response does not confirm the selection. Refresh to try again.', 'La réponse ne confirme pas la sélection. Actualisez pour réessayer.', 'La respuesta no confirma la selección. Actualice para intentarlo de nuevo.', 'Die Antwort bestätigt die Auswahl nicht. Aktualisieren Sie und versuchen Sie es erneut.'],
    pool: ['Piscina #{id}', 'Pool #{id}', 'Piscine #{id}', 'Piscina #{id}', 'Pool #{id}'],
    noPool: ['Visita sem piscina associada', 'Visit without an associated pool', 'Visite sans piscine associée', 'Visita sin piscina asociada', 'Besuch ohne zugeordneten Pool'],
    duplicate: ['A resposta contém registos repetidos. Atualize para tentar novamente.', 'The response contains duplicate records. Refresh to try again.', 'La réponse contient des enregistrements répétés. Actualisez pour réessayer.', 'La respuesta contiene registros repetidos. Actualice para intentarlo de nuevo.', 'Die Antwort enthält doppelte Datensätze. Aktualisieren Sie und versuchen Sie es erneut.'],
    ready: ['{count} visitas planeadas · {missing} sem coordenadas válidas.', '{count} planned visits · {missing} without valid coordinates.', '{count} visites prévues · {missing} sans coordonnées valides.', '{count} visitas planificadas · {missing} sin coordenadas válidas.', '{count} geplante Besuche · {missing} ohne gültige Koordinaten.'],
    empty: ['Sem visitas regulares planeadas para este técnico e dia.', 'No regular visits planned for this technician and day.', 'Aucune visite régulière prévue pour ce technicien et ce jour.', 'No hay visitas regulares planificadas para este técnico y día.', 'Keine regulären Besuche für diesen Techniker und Tag geplant.'],
    invalid: ['Resposta inválida. Atualize para tentar novamente.', 'Invalid response. Refresh to try again.', 'Réponse invalide. Actualisez pour réessayer.', 'Respuesta inválida. Actualice para intentarlo de nuevo.', 'Ungültige Antwort. Aktualisieren Sie und versuchen Sie es erneut.'],
    unconfirmed: ['Consulta não confirmada. Tente novamente.', 'Query not confirmed. Try again.', 'Consultation non confirmée. Réessayez.', 'Consulta no confirmada. Inténtelo de nuevo.', 'Abfrage nicht bestätigt. Versuchen Sie es erneut.'],
    chooseTechnician: ['Escolha o técnico', 'Choose a technician', 'Choisissez un technicien', 'Elija un técnico', 'Techniker auswählen'],
    inactive: ['{name} · #{id} (inativo)', '{name} · #{id} (inactive)', '{name} · #{id} (inactif)', '{name} · #{id} (inactivo)', '{name} · #{id} (inaktiv)'],
    idle: ['Escolha o técnico e atualize para obter uma sugestão por proximidade.', 'Choose a technician and refresh to get a proximity suggestion.', 'Choisissez un technicien et actualisez pour obtenir une suggestion de proximité.', 'Elija un técnico y actualice para obtener una sugerencia por proximidad.', 'Wählen Sie einen Techniker und aktualisieren Sie für einen Vorschlag nach Nähe.'],
    noTechnicians: ['Sem técnicos disponíveis.', 'No technicians available.', 'Aucun technicien disponible.', 'No hay técnicos disponibles.', 'Keine Techniker verfügbar.'],
    techniciansError: ['Não foi possível carregar os técnicos. Use Atualizar técnicos.', 'Unable to load technicians. Use Refresh technicians.', 'Impossible de charger les techniciens. Utilisez Actualiser les techniciens.', 'No se pudieron cargar los técnicos. Use Actualizar técnicos.', 'Techniker konnten nicht geladen werden. Nutzen Sie Techniker aktualisieren.']
  };
  function text(key, params = {}) {
    const lang = window.CristalI18n?.readLanguage() || document.documentElement.lang;
    return copy[key][Math.max(0, languages.indexOf(lang))].replace(/\{(\w+)\}/g, (_, name) => String(params[name]));
  }
  function paint() {
    for (const node of document.querySelectorAll('[data-route-copy]')) {
      const value = text(node.dataset.routeCopy); if (node.textContent !== value) node.textContent = value;
    }
    document.title = text('title') + ' — Cristal Water';
    document.getElementById('map').setAttribute('aria-label', text('mapLabel'));
  }
  CWAdminMap.start('route', { text, paint });
})();
