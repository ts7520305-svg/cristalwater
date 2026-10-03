const API = "/api";
const roundCopy = (() => {
  const languages = ['pt','en','fr','es','de'];
  const copy = {
    title: ['Cristal Water LDA - Rondas','Cristal Water LDA - Rounds','Cristal Water LDA - Tournées','Cristal Water LDA - Rondas','Cristal Water LDA - Rundgänge'],
    heading: ['Rondas','Rounds','Tournées','Rondas','Rundgänge'],
    intro: ['Uma ronda principal por dia e por tecnico, com apoio, substituicoes e visitas de outro dia controladas no planeador.','One main round per day and technician, with support, substitutions and visits from another day managed in the planner.','Une tournée principale par jour et technicien, avec renforts, remplacements et visites d’un autre jour gérés dans le planning.','Una ronda principal por día y técnico, con apoyo, sustituciones y visitas de otro día gestionadas en el planificador.','Ein Hauptrundgang pro Tag und Techniker; Unterstützung, Vertretungen und Besuche anderer Tage werden im Planer verwaltet.'],
    back: ['Voltar','Back','Retour','Volver','Zurück'],
    centre: ['Centro de Operacoes','Operations centre','Centre des opérations','Centro de operaciones','Betriebszentrale'],
    attention: ['Visitas que precisam de atenção','Visits needing attention','Visites nécessitant une attention','Visitas que requieren atención','Besuche mit Handlungsbedarf'],
    coverageIntro: ['Verifique atrasos, piscinas sem manutenção concluída e visitas sem técnico. Se faltar pessoal, viatura ou química, selecione apenas o trabalho ainda por iniciar.','Check delays, pools without completed maintenance and visits without a technician. If staff, vehicle or chemicals are missing, select only work not yet started.','Vérifiez les retards, les piscines sans entretien terminé et les visites sans technicien. En cas de manque de personnel, de véhicule ou de produits, sélectionnez seulement les travaux non commencés.','Comprueba retrasos, piscinas sin mantenimiento completado y visitas sin técnico. Si faltan personal, vehículo o productos, selecciona solo el trabajo aún no iniciado.','Verspätungen, Pools ohne abgeschlossene Wartung und Besuche ohne Techniker prüfen. Bei fehlendem Personal, Fahrzeug oder Chemikalien nur noch nicht begonnene Arbeiten auswählen.'],
    check: ['Verificar agora','Check now','Vérifier maintenant','Comprobar ahora','Jetzt prüfen'],
    newTechnician: ['Novo técnico','New technician','Nouveau technicien','Nuevo técnico','Neuer Techniker'],
    selectTechnician: ['Selecionar técnico','Select technician','Sélectionner un technicien','Seleccionar técnico','Techniker auswählen'],
    cause: ['Motivo da redistribuição','Reassignment reason','Motif de réaffectation','Motivo de redistribución','Grund der Neuverteilung'],
    absence: ['Ausência de técnico','Technician absence','Absence du technicien','Ausencia de técnico','Abwesenheit des Technikers'],
    vehicle: ['Avaria de viatura','Vehicle breakdown','Panne de véhicule','Avería del vehículo','Fahrzeugausfall'],
    chemicals: ['Falta de produtos químicos','Missing chemicals','Manque de produits chimiques','Falta de productos químicos','Fehlende Chemikalien'],
    equipment: ['Falta de material ou equipamento','Missing materials or equipment','Manque de matériel ou d’équipement','Falta de material o equipo','Fehlendes Material oder Gerät'],
    support: ['Apoio à rota','Route support','Renfort de tournée','Apoyo a la ruta','Routenunterstützung'],
    management: ['Informação para a gestão','Information for management','Informations pour la gestion','Información para la gestión','Informationen für die Verwaltung'],
    coverageExample: ['Ex.: viatura sem hipoclorito; confirmar reposição','E.g. vehicle without hypochlorite; confirm restocking','Ex. : véhicule sans hypochlorite ; confirmer le réapprovisionnement','Ej.: vehículo sin hipoclorito; confirmar reposición','Z. B. Fahrzeug ohne Hypochlorit; Nachschub bestätigen'],
    transfer: ['Pré-visualizar transferência','Preview transfer','Prévisualiser le transfert','Previsualizar transferencia','Übertragung prüfen'],
    transferNote: ['A transferência conserva datas e histórico. Visitas iniciadas, água aberta e bombas em manual exigem acompanhamento próprio. O novo técnico deve atualizar a rota; esta ação não confirma que já a recebeu.','Transfers preserve dates and history. Started visits, open water and pumps in manual mode require separate follow-up. The new technician must refresh the route; this action does not confirm receipt.','Le transfert conserve les dates et l’historique. Les visites commencées, l’eau ouverte et les pompes en mode manuel exigent un suivi distinct. Le nouveau technicien doit actualiser la tournée ; cette action ne confirme pas sa réception.','La transferencia conserva fechas e historial. Las visitas iniciadas, el agua abierta y las bombas en manual requieren seguimiento específico. El nuevo técnico debe actualizar la ruta; esta acción no confirma su recepción.','Übertragungen erhalten Termine und Verlauf. Begonnene Besuche, offenes Wasser und Pumpen im Handbetrieb erfordern gesonderte Betreuung. Der neue Techniker muss die Route aktualisieren; diese Aktion bestätigt nicht den Empfang.'],
    receipts: ['Receção das visitas atribuídas','Receipt of assigned visits','Réception des visites attribuées','Recepción de visitas asignadas','Empfang zugewiesener Besuche'],
    receiptNote: ['Confirmar receção não significa iniciar ou concluir a visita, nem aceitar água aberta ou bomba manual.','Confirming receipt does not start or complete the visit, or accept open water or a pump in manual mode.','Confirmer la réception ne démarre ni ne termine la visite et ne valide pas l’eau ouverte ni une pompe en mode manuel.','Confirmar la recepción no inicia ni completa la visita, ni acepta agua abierta o una bomba en manual.','Eine Empfangsbestätigung beginnt oder beendet den Besuch nicht und bestätigt weder offenes Wasser noch eine Pumpe im Handbetrieb.'],
    poolsInRounds: ['Piscinas em rondas','Pools in rounds','Piscines en tournée','Piscinas en rondas','Pools in Rundgängen'],
    technicians: ['Tecnicos','Technicians','Techniciens','Técnicos','Techniker'],
    visits: ['Visitas','Visits','Visites','Visitas','Besuche'],
    unassignedRounds: ['Rondas sem tecnico','Rounds without technician','Tournées sans technicien','Rondas sin técnico','Rundgänge ohne Techniker'],
    createRound: ['Criar ronda','Create round','Créer une tournée','Crear ronda','Rundgang erstellen'],
    roundName: ['Nome da ronda','Round name','Nom de la tournée','Nombre de la ronda','Name des Rundgangs'],
    frequency: ['Frequência','Frequency','Fréquence','Frecuencia','Häufigkeit'],
    weekly: ['Semanal','Weekly','Hebdomadaire','Semanal','Wöchentlich'],
    dailyEvery: ['Diária — todos os dias','Daily - every day','Quotidienne - tous les jours','Diaria - todos los días','Täglich - jeden Tag'],
    daily: ['Diária','Daily','Quotidienne','Diaria','Täglich'],
    monthly: ['Mensal','Monthly','Mensuelle','Mensual','Monatlich'],
    monthDayPrefix: ['Mensal · dia {day}','Monthly · day {day}','Mensuelle · jour {day}','Mensual · día {day}','Monatlich · Tag {day}'],
    weekday: ['Dia da semana','Day of week','Jour de la semaine','Día de la semana','Wochentag'],
    day0: ['Domingo','Sunday','Dimanche','Domingo','Sonntag'],
    day1: ['Segunda','Monday','Lundi','Lunes','Montag'],
    day2: ['Terca','Tuesday','Mardi','Martes','Dienstag'],
    day3: ['Quarta','Wednesday','Mercredi','Miércoles','Mittwoch'],
    day4: ['Quinta','Thursday','Jeudi','Jueves','Donnerstag'],
    day5: ['Sexta','Friday','Vendredi','Viernes','Freitag'],
    day6: ['Sabado','Saturday','Samedi','Sábado','Samstag'],
    monthDay: ['Dia do mês (1–31)','Day of month (1–31)','Jour du mois (1–31)','Día del mes (1–31)','Tag des Monats (1–31)'],
    optionalStart: ['Início (opcional)','Start (optional)','Début (facultatif)','Inicio (opcional)','Beginn (optional)'],
    optionalEnd: ['Fim (opcional)','End (optional)','Fin (facultative)','Fin (opcional)','Ende (optional)'],
    recurrenceNote: ['Sem fim: repete enquanto estiver ativa. No modo mensal, um dia inexistente passa ao último dia desse mês. Alterações não apagam visitas já geradas.','No end: repeats while active. In monthly mode, a missing day moves to the last day of that month. Changes do not delete visits already generated.','Sans fin : répétition tant que la tournée est active. En mode mensuel, un jour inexistant passe au dernier jour du mois. Les modifications ne suppriment pas les visites déjà générées.','Sin fin: se repite mientras esté activa. En modo mensual, un día inexistente pasa al último día del mes. Los cambios no borran visitas ya generadas.','Ohne Ende: Wiederholung solange aktiv. Im Monatsmodus wird ein fehlender Tag auf den letzten Monatstag verschoben. Änderungen löschen keine bereits erzeugten Besuche.'],
    assignTechnician: ['Atribuir tecnico','Assign technician','Attribuer un technicien','Asignar técnico','Techniker zuweisen'],
    assignmentNote: ['Atribua a ronda por um período ou sem fim. A nova atribuição prevalece nas datas indicadas; fora desse período aplica-se a atribuição anterior. Visitas iniciadas, histórico e lembretes críticos mantêm os responsáveis.','Assign the round for a period or without an end. The new assignment applies on the specified dates; outside that period the previous assignment applies. Started visits, history and critical reminders retain their owners.','Attribuez la tournée pour une période ou sans fin. La nouvelle affectation prévaut aux dates indiquées ; en dehors de cette période l’affectation précédente s’applique. Les visites commencées, l’historique et les rappels critiques conservent leurs responsables.','Asigna la ronda por un periodo o sin fin. La nueva asignación prevalece en las fechas indicadas; fuera de ese periodo se aplica la anterior. Las visitas iniciadas, el historial y los recordatorios críticos conservan sus responsables.','Den Rundgang befristet oder unbefristet zuweisen. Die neue Zuweisung gilt an den angegebenen Tagen; außerhalb bleibt die bisherige Zuweisung gültig. Begonnene Besuche, Verlauf und kritische Erinnerungen behalten ihre Verantwortlichen.'],
    round: ['Ronda','Round','Tournée','Ronda','Rundgang'],
    technician: ['Tecnico','Technician','Technicien','Técnico','Techniker'],
    validity: ['Validade','Validity','Validité','Validez','Gültigkeit'],
    range: ['De data X a data Y','From date X to date Y','De la date X à la date Y','De la fecha X a la fecha Y','Von Datum X bis Datum Y'],
    oneDay: ['Um dia','One day','Un jour','Un día','Ein Tag'],
    oneWeek: ['Uma semana (7 dias)','One week (7 days)','Une semaine (7 jours)','Una semana (7 días)','Eine Woche (7 Tage)'],
    oneMonth: ['Um mês','One month','Un mois','Un mes','Ein Monat'],
    permanent: ['Sempre, desde a data de início','Always, from the start date','Toujours, à partir de la date de début','Siempre, desde la fecha de inicio','Unbefristet ab dem Anfangsdatum'],
    startDate: ['Data de início','Start date','Date de début','Fecha de inicio','Anfangsdatum'],
    lastDay: ['Último dia incluído','Last day included','Dernier jour inclus','Último día incluido','Letzter eingeschlossener Tag'],
    assignmentReason: ['Motivo da atribuição','Assignment reason','Motif de l’affectation','Motivo de asignación','Grund der Zuweisung'],
    assignmentExample: ['Ex.: férias, substituição ou mudança permanente','E.g. holiday, substitution or permanent change','Ex. : congés, remplacement ou changement permanent','Ej.: vacaciones, sustitución o cambio permanente','Z. B. Urlaub, Vertretung oder dauerhafte Änderung'],
    reviewAssignment: ['Rever e atribuir ronda','Review and assign round','Vérifier et attribuer la tournée','Revisar y asignar ronda','Rundgang prüfen und zuweisen'],
    assignPool: ['Atribuir piscina','Assign pool','Attribuer une piscine','Asignar piscina','Pool zuweisen'],
    pool: ['Piscina','Pool','Piscine','Piscina','Pool'],
    order: ['Ordem','Order','Ordre','Orden','Reihenfolge'],
    extraVisit: ['Visita extra / pontual','Extra / one-off visit','Visite supplémentaire / ponctuelle','Visita extra / puntual','Zusätzlicher / einmaliger Besuch'],
    dateTime: ['Data e hora','Date and time','Date et heure','Fecha y hora','Datum und Uhrzeit'],
    quantity: ['Quantidade','Quantity','Quantité','Cantidad','Anzahl'],
    howMany: ['Quantas visitas','How many visits','Nombre de visites','Cuántas visitas','Anzahl der Besuche'],
    repetition: ['Repeticao','Repetition','Répétition','Repetición','Wiederholung'],
    once: ['Uma vez','Once','Une fois','Una vez','Einmal'],
    everyDay: ['Todos os dias','Every day','Tous les jours','Todos los días','Jeden Tag'],
    allDays: ['Todos os dias','All days','Tous les jours','Todos los días','Alle Tage'],
    billing: ['Faturacao','Billing','Facturation','Facturación','Abrechnung'],
    billable: ['Extra cobravel','Chargeable extra','Supplément facturable','Extra facturable','Kostenpflichtiger Zusatz'],
    included: ['Incluida no contrato','Included in contract','Incluse dans le contrat','Incluida en el contrato','Im Vertrag enthalten'],
    noCharge: ['Sem cobranca','No charge','Sans facturation','Sin cobro','Kostenfrei'],
    extraPrice: ['Valor por visita extra','Price per extra visit','Prix par visite supplémentaire','Precio por visita extra','Preis je Zusatzbesuch'],
    internalNotes: ['Notas internas','Internal notes','Notes internes','Notas internas','Interne Notizen'],
    notesExample: ['Motivo, instrucoes ou observacoes internas','Reason, instructions or internal remarks','Motif, instructions ou observations internes','Motivo, instrucciones u observaciones internas','Grund, Anweisungen oder interne Hinweise'],
    createExtra: ['Criar visita extra','Create extra visit','Créer une visite supplémentaire','Crear visita extra','Zusatzbesuch erstellen'],
    billingNote: ['As visitas extra cobraveis ficam marcadas para conta corrente quando forem concluidas.','Chargeable extra visits are marked for the account statement when completed.','Les visites supplémentaires facturables sont inscrites au compte courant une fois terminées.','Las visitas extra facturables se marcan para la cuenta corriente al completarse.','Kostenpflichtige Zusatzbesuche werden nach Abschluss für das Kundenkonto vorgemerkt.'],
    weeklyOperations: ['Operacao semanal','Weekly operations','Opérations hebdomadaires','Operación semanal','Wochenbetrieb'],
    generate: ['Gerar visitas da semana','Generate weekly visits','Générer les visites de la semaine','Generar visitas de la semana','Wochenbesuche erzeugen'],
    missing: ['Verificar visitas em falta','Check missing visits','Vérifier les visites manquantes','Comprobar visitas faltantes','Fehlende Besuche prüfen'],
    forceNote: ['Substitui apenas visitas planeadas ainda nao concluidas. As visitas podem depois ser movidas para apoio, substituicao ou outro dia.','Replaces only planned visits not yet completed. Visits can then be moved for support, substitution or another day.','Remplace uniquement les visites prévues non terminées. Les visites peuvent ensuite être déplacées pour un renfort, un remplacement ou un autre jour.','Sustituye solo visitas planificadas aún no completadas. Después pueden moverse para apoyo, sustitución u otro día.','Ersetzt nur geplante, noch nicht abgeschlossene Besuche. Danach können Besuche für Unterstützung, Vertretung oder einen anderen Tag verschoben werden.'],
    weeklyVisits: ['Visitas da semana','Weekly visits','Visites de la semaine','Visitas de la semana','Wochenbesuche'],
    search: ['Pesquisa','Search','Recherche','Búsqueda','Suche'],
    searchExample: ['Pesquisar por cliente, piscina, jacuzzi, tecnico, ronda, zona ou alerta','Search client, pool, hot tub, technician, round, zone or alert','Rechercher client, piscine, jacuzzi, technicien, tournée, zone ou alerte','Buscar cliente, piscina, jacuzzi, técnico, ronda, zona o alerta','Kunde, Pool, Whirlpool, Techniker, Rundgang, Gebiet oder Alarm suchen'],
    day: ['Dia','Day','Jour','Día','Tag'],
    week: ['Semana','Week','Semaine','Semana','Woche'],
    dayFilter: ['Filtrar por dia','Filter by day','Filtrer par jour','Filtrar por día','Nach Tag filtern'],
    weekFilter: ['Filtrar por semana','Filter by week','Filtrer par semaine','Filtrar por semana','Nach Woche filtern'],
    allTechnicians: ['Todos os tecnicos','All technicians','Tous les techniciens','Todos los técnicos','Alle Techniker'],
    allRounds: ['Todas as rondas','All rounds','Toutes les tournées','Todas las rondas','Alle Rundgänge'],
    status: ['Estado','Status','État','Estado','Status'],
    allStatuses: ['Todos os estados','All statuses','Tous les états','Todos los estados','Alle Status'],
    alerts: ['Com alertas','With alerts','Avec alertes','Con alertas','Mit Alarmen'],
    late: ['Atrasadas','Overdue','En retard','Atrasadas','Überfällig'],
    pending: ['Pendentes / em curso','Pending / in progress','En attente / en cours','Pendientes / en curso','Ausstehend / in Bearbeitung'],
    done: ['Concluidas','Completed','Terminées','Completadas','Abgeschlossen'],
    extra: ['Visitas extra','Extra visits','Visites supplémentaires','Visitas extra','Zusatzbesuche'],
    billableExtras: ['Extras cobraveis','Chargeable extras','Suppléments facturables','Extras facturables','Kostenpflichtige Zusätze'],
    clear: ['Limpar filtros','Clear filters','Effacer les filtres','Limpiar filtros','Filter zurücksetzen'],
    roundsByDay: ['Rondas por dia','Rounds by day','Tournées par jour','Rondas por día','Rundgänge nach Tag'],
    noRounds: ['Sem rondas','No rounds','Aucune tournée','Sin rondas','Keine Rundgänge'],
    noTechnicians: ['Sem tecnicos','No technicians','Aucun technicien','Sin técnicos','Keine Techniker'],
    noPools: ['Sem piscinas','No pools','Aucune piscine','Sin piscinas','Keine Pools'],
    extraPool: ['Piscina / jacuzzi da visita extra','Pool / hot tub for extra visit','Piscine / jacuzzi de la visite supplémentaire','Piscina / jacuzzi de la visita extra','Pool / Whirlpool für den Zusatzbesuch'],
    noTechnician: ['Sem tecnico definido','No technician assigned','Aucun technicien attribué','Sin técnico asignado','Kein Techniker zugewiesen'],
    technicianNumber: ['Tecnico #{id}','Technician #{id}','Technicien #{id}','Técnico #{id}','Techniker #{id}'],
    poolNumber: ['Piscina #{id}','Pool #{id}','Piscine #{id}','Piscina #{id}','Pool #{id}'],
    noClient: ['Sem cliente','No client','Sans client','Sin cliente','Kein Kunde'],
  };
  const bindings = new Map();
  const text = key => copy[key][Math.max(0,languages.indexOf(String(document.documentElement.lang || 'pt').toLowerCase().split('-')[0]))];
  // Direct text leaves let mixed labels retain their original selects/textareas.
  function bind(node,key,attribute='') {
    if(!node)return;
    const render = typeof key==='function'?key:()=>text(key);
    const leaf = attribute?null:[...node.childNodes].find(child=>child.nodeType===Node.TEXT_NODE&&child.nodeValue.trim());
    if(!attribute&&!leaf)return;
    if(node.tagName==='OPTION'&&!node.hasAttribute('value'))node.setAttribute('value',node.value);
    const rendered = render();
    if(attribute)node.setAttribute(attribute,rendered);else leaf.nodeValue=rendered;
    const entries=bindings.get(node)||new Map();entries.set(attribute,{render,rendered,leaf,children:[...node.childNodes]});bindings.set(node,entries);
  }
  function paint() {
    for(const [node,entries] of bindings) {
      if(!node.isConnected){bindings.delete(node);continue;}
      for(const [attribute,entry] of entries) {
        if(attribute?node.getAttribute(attribute)!==entry.rendered:entry.leaf.parentNode!==node||entry.leaf.nodeValue!==entry.rendered||node.childNodes.length!==entry.children.length||entry.children.some((child,index)=>node.childNodes[index]!==child)){entries.delete(attribute);continue;}
        bind(node,entry.render,attribute);
      }
      if(!entries.size)bindings.delete(node);
    }
  }
  const staticCopy = [
    ['title','title'],['main h1','heading'],['.page-head p','intro'],['.page-head [data-cw-back]','back'],['.page-head a[href="/admin-master-control"]','centre'],
    ['#coveragePanel >h2','attention'],['#coveragePanel >p:first-of-type','coverageIntro'],['#coverageRefresh','check'],['#coverageTransfer label:nth-of-type(1)','newTechnician'],['#coverageTransfer label:nth-of-type(2)','cause'],['#coverageTransfer label:nth-of-type(3)','management'],['#coverageReason','coverageExample','placeholder'],['#coverageTransfer button','transfer'],['#coveragePanel >p:nth-of-type(3)','transferNote'],['#coveragePanel >h3','receipts'],['#coveragePanel >p:nth-of-type(4)','receiptNote'],
    ['#kpiRounds+.label','heading'],['#kpiPools+.label','poolsInRounds'],['#kpiTechs+.label','technicians'],['#kpiVisits+.label','visits'],['#kpiUnassignedRounds+.label','unassignedRounds'],
    ['.cols2>.card:first-child>h2:nth-of-type(1),#createRoundBtn','createRound'],['label[for="roundName"]','roundName'],['#roundName','roundName','placeholder'],['label[for="roundRecurrence"]','frequency'],['#roundRecurrence option[value="WEEKLY"],#extraRepeatMode option[value="weekly"]','weekly'],['#roundRecurrence option[value="DAILY"]','dailyEvery'],['#roundRecurrence option[value="MONTHLY"]','monthly'],['label[for="roundDay"],label[for="visitDayFilter"]','weekday'],['label[for="roundMonthDay"]','monthDay'],['label[for="roundStartsOn"]','optionalStart'],['label[for="roundEndsOn"]','optionalEnd'],['.cols2>.card:first-child>p.mini:first-of-type','recurrenceNote'],
    ['.cols2>.card:first-child>h2:nth-of-type(2)','assignTechnician'],['.cols2>.card:first-child>.rule-note','assignmentNote'],['label[for="assignTechRound"],label[for="assignPoolRound"],label[for="visitRoundFilter"]','round'],['label[for="assignTech"],label[for="extraTechnician"],label[for="visitTechnicianFilter"]','technician'],['label[for="assignmentPeriod"]','validity'],['#assignmentPeriod option[value="RANGE"]','range'],['#assignmentPeriod option[value="DAY"]','oneDay'],['#assignmentPeriod option[value="WEEK"]','oneWeek'],['#assignmentPeriod option[value="MONTH"]','oneMonth'],['#assignmentPeriod option[value="PERMANENT"]','permanent'],['label[for="assignmentStart"]','startDate'],['label[for="assignmentEnd"]','lastDay'],['label[for="assignmentReason"]','assignmentReason'],['#assignmentReason','assignmentExample','placeholder'],['#assignTechBtn','reviewAssignment'],
    ['.cols2>.card:first-child>h2:nth-of-type(3),#assignPoolBtn','assignPool'],['label[for="assignPool"],label[for="extraPool"]','pool'],['label[for="assignPoolOrder"]','order'],['#assignPoolOrder','order','placeholder'],['.cols2>.card:first-child>h2:nth-of-type(4)','extraVisit'],['label[for="extraStart"]','dateTime'],['label[for="extraRepeatCount"]','quantity'],['#extraRepeatCount','howMany','placeholder'],['label[for="extraRepeatMode"]','repetition'],['#extraRepeatMode option[value="once"]','once'],['#extraRepeatMode option[value="daily"]','everyDay'],['#visitDayFilter option[value=""]','allDays'],['label[for="extraBillingMode"]','billing'],['#extraBillingMode option[value="EXTRA"]','billable'],['#extraBillingMode option[value="INCLUDED"]','included'],['#extraBillingMode option[value="NO_CHARGE"]','noCharge'],['label[for="extraPrice"]','extraPrice'],['#extraPrice','extraPrice','placeholder'],['label[for="extraNotes"]','internalNotes'],['#extraNotes','notesExample','placeholder'],['#createExtraVisitBtn','createExtra'],['.cols2>.card:first-child>p.mini:last-of-type','billingNote'],
    ['.cols2>.card:last-child>h2','weeklyOperations'],['#generateWeekBtn','generate'],['#forceGenerateBtn','missing'],['.force-note','forceNote'],['.cols2>.card:last-child>h3','weeklyVisits'],['label[for="visitSearch"]','search'],['#visitSearch','searchExample','placeholder'],['label[for="visitDateFilter"]','day'],['label[for="visitWeekFilter"]','week'],['#visitDateFilter','dayFilter','title'],['#visitWeekFilter','weekFilter','title'],['label[for="visitStatusFilter"]','status'],['#visitStatusFilter option[value=""]','allStatuses'],['#visitStatusFilter option[value="alerts"]','alerts'],['#visitStatusFilter option[value="late"]','late'],['#visitStatusFilter option[value="pending"]','pending'],['#visitStatusFilter option[value="done"]','done'],['#visitStatusFilter option[value="extra"]','extra'],['#visitStatusFilter option[value="billable"]','billableExtras'],['#clearVisitFilters','clear'],['main>section:last-child>h2','roundsByDay'],
  ];
  for(const [selector,key,attribute] of staticCopy)for(const node of document.querySelectorAll(selector))bind(node,key,attribute);
  for(let day=0;day<7;day++)for(const node of document.querySelectorAll(`#roundDay option[value="${day}"],#visitDayFilter option[value="${day}"]`))bind(node,'day'+day);
  for(const [index,key] of ['absence','vehicle','chemicals','equipment','support'].entries())bind(document.querySelectorAll('#coverageCause option')[index],key);
  window.addEventListener('cw-language-change',paint);
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  function bindRound(node,round) {
    const name=String(round.name),recurrence=round.recurrence,day=Number(round.dayOfWeek)||0,monthDay=String(round.dayOfMonth);
    bind(node,()=>`${recurrence==='DAILY'?text('daily'):recurrence==='MONTHLY'?text('monthDayPrefix').replace('{day}',monthDay):day>=0&&day<=6?text('day'+day):String(dayNames[day])} - ${name}`);
  }
  function bindPool(node,pool) {
    const name=pool.name,client=pool.client?.name||pool.clientName,id=String(pool.id);
    bind(node,()=>`${name||text('poolNumber').replace('{id}',id)} - ${client||text('noClient')}`);
  }
  function forget(root) {
    if(root)for(const node of bindings.keys())if(root.contains(node))bindings.delete(node);
  }
  return {bind,text,bindRound,bindPool,forget};
})();
const dayNames = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
};

const state = {
  rounds: [],
  pools: [],
  technicians: [],
  visits: [],
  extraVisits: []
};

function authHeaders(){
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setStatus(message, type = "info"){
  const el = document.getElementById("status");
  if(!el) return;
  el.textContent = message;
  el.className = `status ${type === "error" ? "error" : type === "ok" ? "ok" : ""}`.trim();
}

function val(id){
  return document.getElementById(id)?.value || "";
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJSON(url, options = {}){
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || data.ok === false){
    throw new Error(data.message || data.error || `Erro HTTP ${res.status}`);
  }
  return data;
}

function asArray(data, key){
  if(Array.isArray(data)) return data;
  if(Array.isArray(data?.[key])) return data[key];
  if(Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeText(value){
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addDays(date, days){
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfToday(){
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateInput(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTimeInput(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const ymd = formatDateInput(date);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${ymd}T${hh}:${mm}`;
}

function toValidDate(value){
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getWeekKey(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function roundLabel(round){
  return `${round.recurrence==='DAILY'?'Diária':round.recurrence==='MONTHLY'?'Mensal · dia '+round.dayOfMonth:dayNames[Number(round.dayOfWeek)||0]} - ${round.name}`;
}

function roundTechnicians(round){
  if(Object.prototype.hasOwnProperty.call(round,"nextOccurrence")&&!round.nextOccurrence)return (round.technicians||[]).filter(rt=>rt&&(rt.technician?.id||rt.technicianId));
  const nextDate=round.nextOccurrence?new Date(round.nextOccurrence):new Date();if(!round.nextOccurrence){nextDate.setHours(8,0,0,0);nextDate.setDate(nextDate.getDate()+(Number(round.dayOfWeek)-nextDate.getDay()+7)%7);}
  const rule=(round.assignments||[]).filter(item=>new Date(item.startsAt)<=nextDate&&(!item.endsBefore||new Date(item.endsBefore)>nextDate)).sort((a,b)=>b.id-a.id)[0];
  if(rule)return [{technicianId:rule.technicianId,technician:rule.technician}];
  return (round.technicians || []).filter((rt) => rt && (rt.technician?.id || rt.technicianId));
}

function roundHasTechnician(round){
  return roundTechnicians(round).length > 0;
}

function poolLabel(pool){
  const client = pool.client?.name || pool.clientName || "Sem cliente";
  return `${pool.name || `Piscina #${pool.id}`} - ${client}`;
}

function getServiceVisitDate(visit){
  return toValidDate(visit.plannedDate || visit.date || visit.scheduledAt || visit.startedAt);
}

function getExtraVisitDate(visit){
  return toValidDate(visit.scheduledAt || visit.date || visit.plannedDate);
}

function inferAssignmentMode(...values){
  const text = normalizeText(values.filter(Boolean).join(" "));
  if(text.includes("unassigned") || text.includes("sem tecnico")) return "UNASSIGNED";
  if(text.includes("substitution") || text.includes("substituicao")) return "SUBSTITUTION";
  if(text.includes("other_day") || text.includes("outro dia")) return "OTHER_DAY";
  if(text.includes("reschedule") || text.includes("reagend")) return "RESCHEDULE";
  if(text.includes("support") || text.includes("apoio") || text.includes("ajuda")) return "SUPPORT";
  return "NORMAL";
}

function normalizeServiceVisit(visit){
  const technician = visit.technician || {};
  return {
    ...visit,
    uid: `SERVICE-${visit.id}`,
    kind: "SERVICE",
    plannedAt: visit.plannedDate || visit.date,
    technicianId: visit.technicianId || technician.id || null,
    technicianName: visit.technicianName || technician.name || "",
    assignmentMode: inferAssignmentMode(visit.reason, visit.internalNotes, visit.notes),
    billingMode: "MONTHLY",
    isBillable: false,
    price: 0
  };
}

function normalizeExtraVisit(visit){
  const pool = visit.pool || {};
  const client = visit.client || pool.client || {};
  const technician = visit.technician || {};
  return {
    ...visit,
    uid: `EXTRA-${visit.id}`,
    kind: "EXTRA",
    client,
    pool,
    round: null,
    roundName: "Visita extra",
    plannedAt: visit.scheduledAt || visit.date,
    technicianId: visit.technicianId || technician.id || null,
    technicianName: technician.name || "",
    assignmentMode: inferAssignmentMode(visit.assignmentMode, visit.internalNote, visit.notes),
    isBillable: Boolean(visit.isBillable || visit.billingMode === "EXTRA"),
    price: Number(visit.totalPrice || visit.price || visit.unitPrice || 0)
  };
}

function allPlannerVisits(){
  const start = startOfToday();
  const end = addDays(start, 7);
  const normal = state.visits.map(normalizeServiceVisit);
  const extras = state.extraVisits
    .map(normalizeExtraVisit)
    .filter((visit) => {
      const date = getVisitDate(visit);
      return date && date >= start && date < end;
    });
  return [...normal, ...extras].sort((a, b) => (getVisitDate(a)?.getTime() || 0) - (getVisitDate(b)?.getTime() || 0));
}

function getVisitDate(visit){
  return visit.kind === "EXTRA" ? getExtraVisitDate(visit) : getServiceVisitDate(visit);
}

function visitClientName(visit){
  return visit.client?.name || visit.clientName || visit.pool?.client?.name || "-";
}

function visitPoolName(visit){
  return visit.pool?.name || visit.poolName || "-";
}

function visitTechnicianName(visit){
  return visit.technician?.name || visit.technicianName || state.technicians.find((tech) => String(tech.id) === String(visit.technicianId))?.name || "Sem tecnico";
}

function visitRoundName(visit){
  return visit.kind === "EXTRA" ? "Visita extra" : (visit.round?.name || visit.roundName || "-");
}

function assignmentLabel(value){
  return {
    NORMAL: "Normal",
    SUPPORT: "Ajuda / apoio",
    SUBSTITUTION: "Substituicao",
    OTHER_DAY: "Ronda de outro dia",
    RESCHEDULE: "Reagendada",
    UNASSIGNED: "Sem tecnico"
  }[String(value || "NORMAL").toUpperCase()] || "Normal";
}

function assignmentOptions(selected){
  const current = String(selected || "NORMAL").toUpperCase();
  return [
    ["NORMAL", "Normal"],
    ["SUPPORT", "Ajuda / apoio"],
    ["SUBSTITUTION", "Substituicao"],
    ["OTHER_DAY", "Ronda de outro dia"],
    ["RESCHEDULE", "Reagendamento"],
    ["UNASSIGNED", "Sem tecnico"]
  ].map(([value, label]) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`).join("");
}

function roundDayOptions(selected){
  const current = Number(selected);
  return dayNames.map((name, index) => `<option value="${index}" ${current === index ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
}

function visitHasAlert(visit){
  const status = normalizeText(visit.status);
  const priority = normalizeText(visit.priority);
  const text = normalizeText([
    visit.alertType,
    visit.alert,
    visit.problem,
    visit.issue,
    visit.notes,
    visit.adminNotes,
    visit.technicianNotes
  ].join(" "));
  return Boolean(
    visit.hasAlert ||
    visit.criticalAlert ||
    (Array.isArray(visit.alerts) && visit.alerts.length) ||
    (Array.isArray(visit.technicalAlerts) && visit.technicalAlerts.length) ||
    ["urgent", "critical", "critico", "alert"].some(word => status.includes(word) || priority.includes(word) || text.includes(word))
  );
}

function visitIsDone(visit){
  const status = normalizeText(visit.status || "PLANNED");
  return ["done", "completed", "concluida", "concluido", "finished", "closed", "fechada"].some(word => status.includes(word));
}

function visitIsLate(visit){
  const date = getVisitDate(visit);
  return Boolean(date && date < new Date() && !visitIsDone(visit));
}

function visitSearchText(visit){
  return normalizeText([
    visit.kind === "EXTRA" ? "extra visita cobravel pontual limpeza" : "normal ronda mensal",
    visitClientName(visit),
    visitPoolName(visit),
    visitTechnicianName(visit),
    visitRoundName(visit),
    assignmentLabel(visit.assignmentMode),
    visit.status,
    visit.billingMode,
    visit.pool?.address,
    visit.pool?.location,
    visit.client?.zone,
    visit.pool?.zone,
    visit.alertType,
    visit.problem,
    visit.notes
  ].join(" "));
}

function setSelectOptions(id, options, placeholder){
  const el = document.getElementById(id);
  if(!el) return;
  const previous = el.value;
  const body = options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  roundCopy.forget(el);
  el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${body}`;
  const ownPlaceholder={visitTechnicianFilter:'allTechnicians',visitRoundFilter:'allRounds'}[id];
  if(ownPlaceholder)roundCopy.bind(el.options[0],ownPlaceholder);
  if(options.some(option => String(option.value) === String(previous))) el.value = previous;
}

function uniqueVisitOptions(getValue){
  const map = new Map();
  allPlannerVisits().forEach(visit => {
    const value = getValue(visit);
    if(!value || value === "-") return;
    const key = String(value);
    if(!map.has(key)) map.set(key, { value: key, label: key });
  });
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-PT"));
}

function updateVisitFilterSelects(){
  setSelectOptions("visitTechnicianFilter", uniqueVisitOptions(visitTechnicianName), "Todos os tecnicos");
  setSelectOptions("visitRoundFilter", uniqueVisitOptions(visitRoundName), "Todas as rondas");
}

function getVisitFilters(){
  return {
    query: val("visitSearch"),
    date: val("visitDateFilter"),
    week: val("visitWeekFilter"),
    day: val("visitDayFilter"),
    technician: val("visitTechnicianFilter"),
    round: val("visitRoundFilter"),
    status: val("visitStatusFilter")
  };
}

function filterVisits(visits = allPlannerVisits()){
  const filters = getVisitFilters();
  const query = normalizeText(filters.query);
  return visits.filter(visit => {
    const date = getVisitDate(visit);
    if(query && !visitSearchText(visit).includes(query)) return false;
    if(filters.date && formatDateInput(date) !== filters.date) return false;
    if(filters.week && getWeekKey(date) !== filters.week) return false;
    if(filters.day !== "" && (!date || String(date.getDay()) !== filters.day)) return false;
    if(filters.technician && visitTechnicianName(visit) !== filters.technician) return false;
    if(filters.round && visitRoundName(visit) !== filters.round) return false;
    if(filters.status === "alerts" && !visitHasAlert(visit)) return false;
    if(filters.status === "late" && !visitIsLate(visit)) return false;
    if(filters.status === "pending" && visitIsDone(visit)) return false;
    if(filters.status === "done" && !visitIsDone(visit)) return false;
    if(filters.status === "extra" && visit.kind !== "EXTRA") return false;
    if(filters.status === "billable" && !(visit.kind === "EXTRA" && visit.billingMode === "EXTRA")) return false;
    return true;
  });
}

function updateSelects(){
  const roundOptions = state.rounds.map(r => `<option value="${r.id}">${escapeHtml(roundLabel(r))}</option>`).join("");
  const techOptions = state.technicians.map(t => `<option value="${t.id}">${escapeHtml(t.name || `Tecnico #${t.id}`)}</option>`).join("");
  const poolOptions = state.pools.map(p => `<option value="${p.id}">${escapeHtml(poolLabel(p))}</option>`).join("");
  for(const id of ['assignTechRound','assignPoolRound','assignTech','assignPool','extraPool','extraTechnician'])roundCopy.forget(document.getElementById(id));

  ["assignTechRound", "assignPoolRound"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = roundOptions || "<option>Sem rondas</option>";
    if(el)state.rounds.length?state.rounds.forEach((round,index)=>roundCopy.bindRound(el.options[index],round)):roundCopy.bind(el.options[0],'noRounds');
  });

  const assignTech = document.getElementById("assignTech");
  if(assignTech) assignTech.innerHTML = techOptions || "<option>Sem tecnicos</option>";
  if(assignTech)state.technicians.length?state.technicians.forEach((technician,index)=>{if(!technician.name){const id=String(technician.id);roundCopy.bind(assignTech.options[index],()=>roundCopy.text('technicianNumber').replace('{id}',id));}}):roundCopy.bind(assignTech.options[0],'noTechnicians');

  const assignPool = document.getElementById("assignPool");
  if(assignPool) assignPool.innerHTML = poolOptions || "<option>Sem piscinas</option>";
  if(assignPool)state.pools.length?state.pools.forEach((pool,index)=>roundCopy.bindPool(assignPool.options[index],pool)):roundCopy.bind(assignPool.options[0],'noPools');

  const extraPool = document.getElementById("extraPool");
  if(extraPool) extraPool.innerHTML = `<option value="">Piscina / jacuzzi da visita extra</option>${poolOptions}`;
  if(extraPool){roundCopy.bind(extraPool.options[0],'extraPool');state.pools.forEach((pool,index)=>roundCopy.bindPool(extraPool.options[index+1],pool));}

  const extraTechnician = document.getElementById("extraTechnician");
  if(extraTechnician) extraTechnician.innerHTML = `<option value="">Sem tecnico definido</option>${techOptions}`;
  if(extraTechnician){roundCopy.bind(extraTechnician.options[0],'noTechnician');state.technicians.forEach((technician,index)=>{if(!technician.name){const id=String(technician.id);roundCopy.bind(extraTechnician.options[index+1],()=>roundCopy.text('technicianNumber').replace('{id}',id));}});}

  if(!val("extraStart")){
    const initial = new Date();
    initial.setMinutes(0, 0, 0);
    document.getElementById("extraStart").value = formatDateTimeInput(initial);
  }

  updateVisitFilterSelects();
}

function renderKpis(){
  const activeRounds = state.rounds.filter(r => r.active !== false);
  const unassignedRounds = activeRounds.filter((round) => !roundHasTechnician(round));
  const poolIds = new Set();
  const techIds = new Set();
  state.rounds.forEach(r => {
    (r.pools || []).forEach(rp => poolIds.add(rp.poolId || rp.pool?.id));
    roundTechnicians(r).forEach(rt => techIds.add(rt.technicianId || rt.technician?.id));
  });
  document.getElementById("kpiRounds").textContent = activeRounds.length;
  document.getElementById("kpiPools").textContent = poolIds.size;
  document.getElementById("kpiTechs").textContent = techIds.size;
  document.getElementById("kpiVisits").textContent = allPlannerVisits().length;
  document.getElementById("kpiUnassignedRounds").textContent = unassignedRounds.length;

  const warning = document.getElementById("roundTechWarning");
  const warningCard = document.getElementById("kpiUnassignedRoundsCard");
  if(warning){
    if(unassignedRounds.length){
      const names = unassignedRounds.map(round => `${dayNames[Number(round.dayOfWeek) || 0]} - ${round.name}`).join(", ");
      warning.style.display = "block";
      warning.innerHTML = `<strong>Aviso: ${unassignedRounds.length} ronda(s) sem tecnico atribuido</strong><span>${escapeHtml(names)}. Associa um tecnico antes de gerar ou executar visitas.</span>`;
    }else{
      warning.style.display = "none";
      warning.innerHTML = "";
    }
  }
  if(warningCard) warningCard.classList.toggle("warning-card", unassignedRounds.length > 0);
}

function renderRounds(){
  const box = document.getElementById("roundsByDay");
  if(!box) return;
  const byDay = new Map();
  for(let i = 0; i < 7; i++) byDay.set(i, []);
  for(const frequency of ['DAILY','MONTHLY'])if(state.rounds.some(r=>r.recurrence===frequency))byDay.set(frequency,[]);
  state.rounds.forEach(r => byDay.get(['DAILY','MONTHLY'].includes(r.recurrence)?r.recurrence:Number(r.dayOfWeek)||0).push(r));

  box.innerHTML = [...byDay.entries()].map(([day, rounds]) => `
    <div class="day-card" data-help-topic="rounds">
      <h3>${escapeHtml(day==='DAILY'?'Rondas diárias':day==='MONTHLY'?'Rondas mensais':dayNames[day])}</h3>
      ${rounds.length ? rounds.map(renderRoundCard).join("") : `<div class="empty">Sem ronda definida</div>`}
    </div>
  `).join("");

  box.querySelectorAll("[data-delete-round]").forEach(btn => btn.addEventListener("click", () => deleteRound(btn.dataset.deleteRound)));
  box.querySelectorAll("[data-toggle-round]").forEach(btn => btn.addEventListener("click", () => toggleRound(btn.dataset.toggleRound)));
  box.querySelectorAll("[data-save-round]").forEach(btn => btn.addEventListener("click", () => saveRoundFromCard(btn.dataset.saveRound)));
  box.querySelectorAll("[data-focus-tech-round]").forEach(btn => btn.addEventListener("click", () => focusTechnicianAssignment(btn.dataset.focusTechRound)));
  box.querySelectorAll('[data-round-field="recurrence"]').forEach(select=>{const update=()=>{const card=select.closest('.round-card');card.querySelector('[data-schedule-week]').style.display=select.value==='WEEKLY'?'':'none';card.querySelector('[data-schedule-month]').style.display=select.value==='MONTHLY'?'':'none';};select.addEventListener('change',update);update();});
  setupRoundPoolDrag(box);
}

function renderRoundCard(round){
  const hasTechnician = roundHasTechnician(round);
  const technicians = roundTechnicians(round).map((rt, index) => ({
    name: rt.technician?.name || `Tecnico #${rt.technicianId}`,
    role: index === 0 ? (round.nextOccurrence===null?"atribuição base":"próxima ocorrência") : "apoio"
  })).filter(item => item.name);
  const pools = (round.pools || []).slice().sort((a,b)=>(a.order || 0)-(b.order || 0));
  return `
    <article class="round-card ${hasTechnician || round.active === false ? "" : "round-card-risk"}" data-help-topic="rounds" data-round-id="${round.id}">
      ${(round.assignments||[]).length?`<details><summary>Atribuições por período (${round.assignments.length})</summary><p>A atribuição mais recente prevalece quando as datas coincidem.</p>${round.assignments.map(rule=>`<p><strong>${escapeHtml(rule.technician?.name||rule.technicianId)}</strong>: ${escapeHtml(new Date(rule.startsAt).toLocaleDateString('pt-PT'))} — ${rule.endsBefore?escapeHtml(new Date(new Date(rule.endsBefore).getTime()-1).toLocaleDateString('pt-PT')):'sem fim'}<br>${escapeHtml(rule.reason)}</p>`).join('')}</details>`:''}
      <div class="round-top">
        <div>
          <strong>${escapeHtml(round.name)}</strong><br>
          <span class="mini">ID ${round.id} - ${round.active === false ? "Inativa" : "Ativa"}</span>
        </div>
        <span class="ds-badge is-muted">${pools.length} piscinas</span>
      </div>
      ${hasTechnician || round.active === false ? "" : `
        <div class="status error round-round-warning">
          Aviso: ronda ativa sem tecnico atribuido.
          <button class="cw-v2-btn" type="button" data-focus-tech-round="${round.id}">Associar tecnico</button>
        </div>
      `}
      <div class="round-editor">
        <label>Nome da ronda<input data-round-field="name" value="${escapeHtml(round.name)}"></label>
        <label>Frequência<select data-round-field="recurrence">${[['WEEKLY','Semanal'],['DAILY','Diária — todos os dias'],['MONTHLY','Mensal']].map(([value,label])=>`<option value="${value}" ${(round.recurrence||'WEEKLY')===value?'selected':''}>${label}</option>`).join('')}</select></label>
        <label data-schedule-week>Dia da semana<select data-round-field="dayOfWeek">${roundDayOptions(round.dayOfWeek)}</select></label>
        <label data-schedule-month>Dia do mês (1–31)<input data-round-field="dayOfMonth" type="number" min="1" max="31" value="${round.dayOfMonth||1}"></label>
        <label>Início (opcional)<input data-round-field="startsOn" type="date" value="${escapeHtml(String(round.startsOn||'').slice(0,10))}"></label>
        <label>Fim (opcional)<input data-round-field="endsOn" type="date" value="${escapeHtml(String(round.endsOn||'').slice(0,10))}"></label>
        <button class="cw-v2-btn" type="button" data-save-round="${round.id}">Guardar</button>
      </div>
      <div style="margin-top:9px">
        ${technicians.length
          ? technicians.map(item => `<span class="ds-badge is-muted">${escapeHtml(item.name)} · ${escapeHtml(item.role)}</span>`).join(" ")
          : `<span class="ds-badge is-warning">Sem tecnico</span>`}
      </div>
      <ul class="round-pool-list">
        ${pools.length ? pools.map(rp => `
          <li class="pool-line" draggable="true" data-source-round-id="${round.id}" data-pool-id="${rp.poolId || rp.pool?.id}">
            <b>#${rp.order || "-"} ${escapeHtml(rp.pool?.name || `Piscina #${rp.poolId}`)}</b>
            <span>${escapeHtml(rp.pool?.client?.name || "Sem cliente")} - arraste para outra ronda</span>
          </li>
        `).join("") : `<li class="mini">Ainda sem piscinas associadas. Pode arrastar uma piscina de outra ronda para aqui.</li>`}
      </ul>
      <div class="round-actions">
        <button class="cw-v2-btn" data-toggle-round="${round.id}">${round.active === false ? "Ativar" : "Pausar"}</button>
        <button class="cw-v2-btn danger" data-delete-round="${round.id}">Apagar</button>
      </div>
    </article>
  `;
}

function focusTechnicianAssignment(roundId){
  const selector = document.getElementById("assignTechRound");
  if(selector) {
    selector.value = String(roundId);
    selector.scrollIntoView({ behavior: "smooth", block: "center" });
    selector.focus();
  }
  setStatus("Seleciona o tecnico e confirma em Associar tecnico a ronda.", "error");
}

function setupRoundPoolDrag(container){
  container.querySelectorAll(".pool-line").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", JSON.stringify({
        type: "ROUND_POOL",
        poolId: item.dataset.poolId,
        sourceRoundId: item.dataset.sourceRoundId
      }));
      event.dataTransfer.effectAllowed = "move";
    });
  });

  container.querySelectorAll(".round-card").forEach((card) => {
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", async (event) => {
      event.preventDefault();
      card.classList.remove("drag-over");
      const raw = event.dataTransfer.getData("text/plain");
      if(!raw) return;
      const payload = JSON.parse(raw);
      if(payload.type !== "ROUND_POOL") return;
      await movePoolToRound(payload.poolId, payload.sourceRoundId, card.dataset.roundId);
    });
  });
}

async function saveRoundFromCard(roundId){
  const card = document.querySelector(`.round-card[data-round-id="${roundId}"]`);
  if(!card) return;
  const name = card.querySelector('[data-round-field="name"]')?.value?.trim() || "";
  const schedule={recurrence:card.querySelector('[data-round-field=recurrence]').value,dayOfMonth:Number(card.querySelector('[data-round-field=dayOfMonth]').value),startsOn:card.querySelector('[data-round-field=startsOn]').value||null,endsOn:card.querySelector('[data-round-field=endsOn]').value||null};
  const dayOfWeek = Number(card.querySelector('[data-round-field="dayOfWeek"]')?.value || 1);
  if(!name){ setStatus("Indica o nome da ronda.", "error"); return; }
  try{
    setStatus("A guardar ronda...");
    await fetchJSON(`${API}/rounds/${roundId}`, {
      method: "PUT",
      body: JSON.stringify({ name, dayOfWeek, ...schedule })
    });
    await loadAll();
    setStatus("Ronda atualizada. Se necessario, volta a gerar as visitas planeadas.");
  }catch(err){ setStatus(err.message, "error"); }
}

async function movePoolToRound(poolId, sourceRoundId, targetRoundId){
  if(!poolId || !targetRoundId || String(sourceRoundId || "") === String(targetRoundId || "")){
    setStatus("Escolhe uma ronda diferente para mover a piscina.", "error");
    return;
  }
  try{
    setStatus("A mover piscina para outra ronda...");
    const data = await fetchJSON(`${API}/rounds/${targetRoundId}/move-pool`, {
      method: "POST",
      body: JSON.stringify({
        poolId: Number(poolId),
        sourceRoundId: Number(sourceRoundId || 0) || null,
        movePlannedVisits: true
      })
    });
    await loadAll();
    setStatus(`Piscina movida. ${data.updatedVisits || 0} visita(s) planeada(s) atualizada(s).`);
  }catch(err){ setStatus(err.message, "error"); }
}

function visitStatusOptions(selected){
  const statuses = [
    ["PLANNED", "Planeada"],
    ["ON_ROUTE", "A caminho"],
    ["IN_PROGRESS", "Em execucao"],
    ["DONE", "Concluida"],
    ["BLOCKED", "Retida / impedida"],
    ["RESCHEDULED", "Reagendada"],
    ["CANCELLED", "Cancelada"]
  ];
  return statuses.map(([value, label]) => `<option value="${value}" ${String(selected || "PLANNED").toUpperCase() === value ? "selected" : ""}>${label}</option>`).join("");
}

function billingOptions(selected){
  const options = [
    ["EXTRA", "Extra cobravel"],
    ["INCLUDED", "Incluida no contrato"],
    ["NO_CHARGE", "Sem cobranca"]
  ];
  return options.map(([value, label]) => `<option value="${value}" ${String(selected || "EXTRA").toUpperCase() === value ? "selected" : ""}>${label}</option>`).join("");
}

function technicianOptions(selected){
  const options = state.technicians.map((tech) => `<option value="${tech.id}" ${String(selected || "") === String(tech.id) ? "selected" : ""}>${escapeHtml(tech.name || `Tecnico #${tech.id}`)}</option>`).join("");
  return `<option value="">Sem tecnico</option>${options}`;
}

function renderPlanner(visits = filterVisits()){
  const box = document.getElementById("visitPlanner");
  if(!box) return;
  const columns = [
    { id: "", name: "Sem tecnico" },
    ...state.technicians.filter((tech) => tech.active !== false).map((tech) => ({ id: String(tech.id), name: tech.name || `Tecnico #${tech.id}` }))
  ];

  box.innerHTML = columns.map((column) => {
    const assigned = visits.filter((visit) => String(visit.technicianId || "") === String(column.id));
    return `
      <section class="tech-column" data-technician-id="${escapeHtml(column.id)}">
        <h4>${escapeHtml(column.name)} <span class="ds-badge is-muted">${assigned.length}</span></h4>
        <div class="tech-drop">
          ${assigned.length ? assigned.map(renderVisitChip).join("") : `<div class="empty">Arraste visitas para aqui</div>`}
        </div>
      </section>
    `;
  }).join("");

  box.querySelectorAll(".visit-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", JSON.stringify({ kind: chip.dataset.kind, id: chip.dataset.id }));
      event.dataTransfer.effectAllowed = "move";
    });
  });

  box.querySelectorAll(".tech-column").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const raw = event.dataTransfer.getData("text/plain");
      if(!raw) return;
      const payload = JSON.parse(raw);
      await reassignVisit(payload.kind, payload.id, column.dataset.technicianId || null);
    });
  });
}

function renderVisitChip(visit){
  const date = getVisitDate(visit);
  return `
    <article class="visit-chip ${visit.kind === "EXTRA" ? "extra" : ""} ${visitIsDone(visit) ? "done" : ""}" draggable="true" data-kind="${visit.kind}" data-id="${visit.id}">
      <b>${escapeHtml(visitPoolName(visit))}</b>
      <span>${escapeHtml(visitClientName(visit))}</span>
      <span>${escapeHtml(date ? date.toLocaleString("pt-PT") : "Sem data")} - ${visit.kind === "EXTRA" ? "Extra" : "Ronda"} - ${escapeHtml(assignmentLabel(visit.assignmentMode))}</span>
    </article>
  `;
}

function renderVisits(){
  const box = document.getElementById("weekVisits");
  if(!box) return;
  // Normalize once so the table and planner use the same visit snapshot.
  const allVisits = allPlannerVisits();
  const filteredVisits = filterVisits(allVisits);
  const summary = document.getElementById("visitFilterSummary");
  if(summary){
    const alertCount = filteredVisits.filter(visitHasAlert).length;
    const lateCount = filteredVisits.filter(visitIsLate).length;
    const extraCount = filteredVisits.filter((visit) => visit.kind === "EXTRA").length;
    const billableCount = filteredVisits.filter((visit) => visit.kind === "EXTRA" && visit.billingMode === "EXTRA").length;
    summary.textContent = `${filteredVisits.length} de ${allVisits.length} visita(s) - ${alertCount} alerta(s) - ${lateCount} atrasada(s) - ${extraCount} extra(s) - ${billableCount} cobravel(is)`;
  }

  renderPlanner(filteredVisits);

  if(!allVisits.length){
    box.innerHTML = `<div class="empty">Ainda nao existem visitas geradas para esta semana.</div>`;
    return;
  }
  if(!filteredVisits.length){
    box.innerHTML = `<div class="empty">Nenhuma visita corresponde aos filtros escolhidos.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="table-scroll" aria-label="Lista editavel de visitas da semana">
      <table class="visits-table">
        <thead>
          <tr><th>Data</th><th>Cliente</th><th>Piscina</th><th>Tecnico</th><th>Tipo / cobranca</th><th>Estado</th><th>Editar</th></tr>
        </thead>
        <tbody>
          ${filteredVisits.map(renderVisitRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  box.querySelectorAll("[data-save-visit]").forEach((btn) => {
    btn.addEventListener("click", () => saveVisitFromRow(btn.dataset.kind, btn.dataset.id));
  });
}

function renderVisitRow(visit){
  const date = getVisitDate(visit);
  const hasAlert = visitHasAlert(visit);
  const isLate = visitIsLate(visit);
  const classes = [
    hasAlert ? "visit-row-alert" : "",
    isLate ? "visit-row-late" : "",
    visit.kind === "EXTRA" ? "visit-row-extra" : ""
  ].filter(Boolean).join(" ");

  return `
    <tr class="${classes}" data-kind="${visit.kind}" data-id="${visit.id}">
      <td><input data-field="date" type="datetime-local" aria-label="Data da visita ${escapeHtml(visitPoolName(visit))}" value="${escapeHtml(formatDateTimeInput(date))}"></td>
      <td>${escapeHtml(visitClientName(visit))}</td>
      <td>${escapeHtml(visitPoolName(visit))}</td>
      <td><select data-field="technicianId" aria-label="Tecnico da visita ${escapeHtml(visitPoolName(visit))}">${technicianOptions(visit.technicianId)}</select></td>
      <td>
        ${visit.kind === "EXTRA"
          ? `<select data-field="billingMode" aria-label="Modo de faturacao da visita ${escapeHtml(visitPoolName(visit))}">${billingOptions(visit.billingMode)}</select><input class="money-input" data-field="unitPrice" aria-label="Valor da visita ${escapeHtml(visitPoolName(visit))}" type="number" min="0" step="0.01" value="${escapeHtml(visit.price || "")}" placeholder="Valor">`
          : `<span class="ds-badge is-muted">Ronda normal</span>`}
        <select data-field="assignmentMode" title="Motivo operacional" aria-label="Modo de atribuicao da visita ${escapeHtml(visitPoolName(visit))}">${assignmentOptions(visit.assignmentMode)}</select>
        ${hasAlert ? `<span class="ds-badge is-danger">Com alerta</span>` : ""}
      </td>
      <td><select data-field="status" aria-label="Estado da visita ${escapeHtml(visitPoolName(visit))}">${visitStatusOptions(visit.status)}</select></td>
      <td>
        <div class="table-actions">
          <button class="cw-v2-btn" data-save-visit data-kind="${visit.kind}" data-id="${visit.id}" type="button">Guardar alteracoes</button>
          <span class="mini">${escapeHtml(visitRoundName(visit))}${isLate ? " - atrasada" : ""}</span>
        </div>
      </td>
    </tr>
  `;
}

function render(){
  updateSelects();
  renderKpis();
  renderRounds();
  renderVisits();
}

async function loadAll(){
  try{
    setStatus("A carregar rondas, tecnicos, piscinas, visitas e extras...");
    const [roundsData, poolsData, techData, visitsData, extraData] = await Promise.allSettled([
      fetchJSON(`${API}/rounds`),
      fetchJSON(`${API}/pools`),
      fetchJSON(`${API}/technicians`),
      fetchJSON(`${API}/round-planner/week`),
      fetchJSON(`${API}/extra-visits`)
    ]);

    if(roundsData.status === "fulfilled") state.rounds = asArray(roundsData.value, "rounds");
    if(poolsData.status === "fulfilled") state.pools = asArray(poolsData.value, "pools");
    if(techData.status === "fulfilled") state.technicians = asArray(techData.value, "technicians");
    if(visitsData.status === "fulfilled") state.visits = asArray(visitsData.value, "visits");
    if(extraData.status === "fulfilled") state.extraVisits = asArray(extraData.value, "extraVisits");

    const errors = [roundsData, poolsData, techData, visitsData, extraData].filter(r => r.status === "rejected").map(r => r.reason.message);
    render();
    setStatus(errors.length ? `Carregado com avisos: ${errors.join(" - ")}` : "Rondas e visitas carregadas com sucesso.", errors.length ? "error" : "info");
  }catch(err){
    setStatus(err.message, "error");
  }
}

async function createRound(){
  const name = val("roundName").trim();
  const dayOfWeek = Number(val("roundDay"));
  const schedule={recurrence:val("roundRecurrence"),dayOfMonth:Number(val("roundMonthDay")),startsOn:val("roundStartsOn")||null,endsOn:val("roundEndsOn")||null};
  if(!name){ setStatus("Indica o nome da ronda.", "error"); return; }
  try{
    setStatus("A criar ronda...");
    await fetchJSON(`${API}/rounds`, { method:"POST", body: JSON.stringify({ name, dayOfWeek, ...schedule }) });
    document.getElementById("roundName").value = "";
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

async function assignTechnician(){
  const button=document.getElementById('assignTechBtn');if(button.disabled)return;
  const roundId = Number(val("assignTechRound"));
  const technicianId = Number(val("assignTech"));
  if(!roundId || !technicianId){ setStatus("Seleciona uma ronda e um tecnico.", "error"); return; }
  const payload={technicianId,period:val('assignmentPeriod'),startsOn:val('assignmentStart'),endsOn:val('assignmentEnd'),reason:val('assignmentReason')};
  button.disabled=true;
  try{
    const url=`${API}/rounds/${roundId}/technicians`;
    const preview=await fetchJSON(url,{method:'POST',body:JSON.stringify({...payload,preview:true})});
    const last=preview.endsBefore?new Date(new Date(preview.endsBefore).getTime()-1).toLocaleDateString('pt-PT'):'sem fim';
    if(!await ui.confirm(`Atribuir a ${preview.technicianName}, de ${new Date(preview.startsAt).toLocaleDateString('pt-PT')} até ${last}? ${preview.eligible} visita(s) ainda não iniciada(s) serão atualizadas e ${preview.preserved} preservada(s). As novas visitas geradas respeitarão este período. Lembretes críticos exigem passagem separada.`))return;
    setStatus("A atribuir ronda...");
    const result=await fetchJSON(url, { method:"POST", body: JSON.stringify(payload) });
    await loadAll();
    setStatus(`Atribuição guardada. ${result.updated} visita(s) atualizada(s); histórico e visitas iniciadas preservados.`,'ok');
  }catch(err){ setStatus(err.message, "error"); }finally{button.disabled=false;}
}

async function assignPool(){
  const roundId = Number(val("assignPoolRound"));
  const poolId = Number(val("assignPool"));
  const order = Number(val("assignPoolOrder") || 0);
  if(!roundId || !poolId){ setStatus("Seleciona uma ronda e uma piscina.", "error"); return; }
  try{
    setStatus("A associar piscina...");
    await fetchJSON(`${API}/rounds/${roundId}/pools`, { method:"POST", body: JSON.stringify({ poolId, order }) });
    document.getElementById("assignPoolOrder").value = "";
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

async function generateWeek(force = false){
  if(force){
    const ok = await ui.confirm("Verificar os próximos sete dias e criar apenas as visitas em falta? As visitas existentes e os seus registos serão conservados.", {
      title: "Verificar planeamento",
      confirmText: "Continuar",
      danger: true,
    });
    if(!ok) return;
  }
  try{
    setStatus(force ? "A verificar e preencher visitas em falta..." : "A gerar visitas da semana a partir das rondas...");
    const data = await fetchJSON(`${API}/round-planner/generate`, { method:"POST", body: JSON.stringify({ force }) });
    await loadAll();
    const blocked = Number(data.blocked || 0);
    const blockedText = blocked
      ? `, ${blocked} bloqueada(s) por ficha tecnica ou regras em falta`
      : "";
    const seasonalText=data.seasonal&&(data.seasonal.pending||data.seasonal.review)?` Serviços sazonais: ${data.seasonal.pending||0} por planear e ${data.seasonal.review||0} a rever nas configurações do cliente.`:'';
    setStatus(`Semana gerada: ${data.total || 0} visita(s) criada(s), ${data.skipped || 0} ja existente(s)${blockedText}.${seasonalText}`);
  }catch(err){ setStatus(err.message, "error"); }
}

async function createExtraVisits(){
  const poolId = Number(val("extraPool"));
  const technicianId = Number(val("extraTechnician")) || null;
  const start = toValidDate(val("extraStart"));
  const repeatMode = val("extraRepeatMode") || "once";
  const billingMode = val("extraBillingMode") || "EXTRA";
  const unitPrice = Number(val("extraPrice") || 0);
  const notes = val("extraNotes").trim();
  const count = repeatMode === "once" ? 1 : Math.min(90, Math.max(1, Number(val("extraRepeatCount") || 1)));

  if(!poolId){ setStatus("Seleciona a piscina ou jacuzzi da visita extra.", "error"); return; }
  if(!start){ setStatus("Seleciona a data e hora da visita extra.", "error"); return; }
  if(billingMode === "EXTRA" && unitPrice <= 0){ setStatus("Indica o valor da visita extra cobravel.", "error"); return; }

  try{
    setStatus(`A criar ${count} visita(s) extra...`);
    for(let i = 0; i < count; i += 1){
      const scheduledAt = repeatMode === "weekly" ? addDays(start, i * 7) : repeatMode === "daily" ? addDays(start, i) : start;
      await fetchJSON(`${API}/extra-visits`, {
        method: "POST",
        body: JSON.stringify({
          poolId,
          technicianId,
          scheduledAt: scheduledAt.toISOString(),
          visitType: repeatMode === "once" ? "ONE_OFF" : "RECURRING",
          type: "EXTRA_SERVICE",
          source: "ADMIN_PLANNER",
          origin: "ADMIN",
          billingMode,
          unitPrice: billingMode === "EXTRA" ? unitPrice : null,
          totalPrice: billingMode === "EXTRA" ? unitPrice : null,
          notes
        })
      });
    }
    document.getElementById("extraRepeatCount").value = "1";
    document.getElementById("extraNotes").value = "";
    await loadAll();
    setStatus(`${count} visita(s) extra criada(s) com sucesso.`);
  }catch(err){ setStatus(err.message, "error"); }
}

async function reassignVisit(kind, id, technicianId){
  try{
    const currentVisit = allPlannerVisits().find((visit) => visit.kind === kind && String(visit.id) === String(id));
    const oldTech = String(currentVisit?.technicianId || "");
    const newTech = String(technicianId || "");
    const assignmentMode = !newTech ? "UNASSIGNED" : (oldTech && oldTech !== newTech ? "SUPPORT" : "NORMAL");
    const payload = {
      technicianId: technicianId || null,
      assignmentMode,
      operationNote: assignmentMode === "SUPPORT"
        ? "Visita movida por drag-and-drop para apoio em campo."
        : "Visita movida no planeador."
    };
    setStatus("A reatribuir visita...");
    if(kind === "EXTRA"){
      await fetchJSON(`${API}/extra-visits/${id}`, { method:"PUT", body: JSON.stringify(payload) });
    }else{
      await fetchJSON(`${API}/round-planner/visits/${id}`, { method:"PATCH", body: JSON.stringify(payload) });
    }
    await loadAll();
    setStatus("Visita reatribuida com sucesso.");
  }catch(err){ setStatus(err.message, "error"); }
}

async function saveVisitFromRow(kind, id){
  const row = document.querySelector(`tr[data-kind="${kind}"][data-id="${id}"]`);
  if(!row) return;
  const dateValue = row.querySelector('[data-field="date"]')?.value || "";
  const date = toValidDate(dateValue);
  let technicianId = row.querySelector('[data-field="technicianId"]')?.value || null;
  const status = row.querySelector('[data-field="status"]')?.value || "PLANNED";
  const assignmentMode = row.querySelector('[data-field="assignmentMode"]')?.value || "NORMAL";
  if(assignmentMode === "UNASSIGNED") technicianId = null;

  if(!date){ setStatus("Data da visita invalida.", "error"); return; }

  try{
    setStatus("A guardar alteracoes da visita...");
    if(kind === "EXTRA"){
      const billingMode = row.querySelector('[data-field="billingMode"]')?.value || "EXTRA";
      const unitPrice = Number(row.querySelector('[data-field="unitPrice"]')?.value || 0);
      await fetchJSON(`${API}/extra-visits/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          scheduledAt: date.toISOString(),
          technicianId,
          status,
          assignmentMode,
          billingMode,
          unitPrice: billingMode === "EXTRA" ? unitPrice : null,
          totalPrice: billingMode === "EXTRA" ? unitPrice : null
        })
      });
    }else{
      await fetchJSON(`${API}/round-planner/visits/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plannedDate: date.toISOString(),
          technicianId,
          status,
          assignmentMode
        })
      });
    }
    await loadAll();
    setStatus("Alteracoes guardadas.");
  }catch(err){ setStatus(err.message, "error"); }
}

function clearVisitFilters(){
  ["visitSearch", "visitDateFilter", "visitWeekFilter", "visitDayFilter", "visitTechnicianFilter", "visitRoundFilter", "visitStatusFilter"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = "";
  });
  renderVisits();
}

function setupVisitFilters(){
  ["visitDateFilter", "visitWeekFilter", "visitDayFilter", "visitTechnicianFilter", "visitRoundFilter", "visitStatusFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderVisits);
  });
  document.getElementById("visitSearch")?.addEventListener("input", renderVisits);
  document.getElementById("clearVisitFilters")?.addEventListener("click", clearVisitFilters);
}

async function deleteRound(id){
  const ok = await ui.confirm("Apagar esta ronda? As visitas ja geradas nao sao apagadas automaticamente.", {
    title: "Confirmar eliminacao da ronda",
    confirmText: "Apagar",
    danger: true,
  });
  if(!ok) return;
  try{
    setStatus("A apagar ronda...");
    await fetchJSON(`${API}/rounds/${id}`, { method:"DELETE" });
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

async function toggleRound(id){
  const round = state.rounds.find(r => String(r.id) === String(id));
  if(!round) return;
  try{
    setStatus("A atualizar estado da ronda...");
    await fetchJSON(`${API}/rounds/${id}`, { method:"PUT", body: JSON.stringify({ name: round.name, dayOfWeek: round.dayOfWeek, active: round.active === false }) });
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn")?.addEventListener("click", loadAll);
  document.getElementById("createRoundBtn")?.addEventListener("click", createRound);
  const updateFrequency=()=>{for(const [id,visible] of [['roundWeekField',val('roundRecurrence')==='WEEKLY'],['roundMonthField',val('roundRecurrence')==='MONTHLY']]){const field=document.getElementById(id);field.hidden=!visible;field.style.display=visible?'':'none';}};document.getElementById('roundRecurrence').addEventListener('change',updateFrequency);updateFrequency();
  document.getElementById("assignTechBtn")?.addEventListener("click", assignTechnician);
  const assignmentNow=new Date();
  const assignmentDate=`${assignmentNow.getFullYear()}-${String(assignmentNow.getMonth()+1).padStart(2,'0')}-${String(assignmentNow.getDate()).padStart(2,'0')}`;
  document.getElementById('assignmentStart').value=assignmentDate;
  document.getElementById('assignmentEnd').value=assignmentDate;
  document.getElementById('assignmentPeriod').addEventListener('change',()=>{const field=document.getElementById('assignmentEndField');field.hidden=val('assignmentPeriod')!=='RANGE';field.style.display=field.hidden?'none':'';});
  document.getElementById("assignPoolBtn")?.addEventListener("click", assignPool);
  document.getElementById("generateWeekBtn")?.addEventListener("click", () => generateWeek(false));
  document.getElementById("forceGenerateBtn")?.addEventListener("click", () => generateWeek(true));
  document.getElementById("createExtraVisitBtn")?.addEventListener("click", createExtraVisits);
  setupVisitFilters();
  loadAll();
});

(() => {
  const labels={NO_ROUND:'Sem ronda ativa',STALE_COMPLETION:'Última manutenção precisa de revisão',NEVER_COMPLETED:'Sem manutenção concluída registada',NOT_SCHEDULED_TODAY:'Ronda prevista hoje, sem visita gerada',OVERDUE:'Em atraso',UNASSIGNED:'Sem técnico ativo',NO_DATE:'Sem data',INCOMPLETE:'Por concluir'};
  let revision=0;
  const message=()=>document.getElementById('coverageStatus');
  async function refresh(){
    const own=++revision,token=localStorage.getItem('token');message().textContent='A verificar as visitas…';
    try{
      const data=await fetchJSON('/api/rounds/coverage',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(own!==revision||token!==localStorage.getItem('token'))return;
      roundCopy.forget(document.getElementById('coverageTechnician'));
      document.getElementById('coverageTechnician').innerHTML='<option value="">Selecionar técnico</option>'+data.technicians.map(tech=>`<option value="${tech.id}">${escapeHtml(tech.name)}</option>`).join('');
      roundCopy.bind(document.getElementById('coverageTechnician').options[0],'selectTechnician');
      document.getElementById('coverageList').innerHTML=data.rows.map(row=>`<article class="coverage-pool" data-coverage-pool="${row.poolId}"><h3>${escapeHtml(row.poolName)}</h3><p>${escapeHtml(row.clientName)} · ${row.lastCompleted?'Última conclusão: '+new Date(row.lastCompleted).toLocaleDateString('pt-PT'):'Sem conclusão registada'}</p><p>${row.flags.map(flag=>escapeHtml(labels[flag])).join(' · ')}</p>${row.visits.map(visit=>`<label class="coverage-visit">${visit.canTransfer?`<input type="checkbox" data-transfer-visit="${visit.id}" aria-label="Selecionar visita ${visit.id}">`:''}<span>Visita #${visit.id} · ${visit.plannedDate?new Date(visit.plannedDate).toLocaleDateString('pt-PT'):'Sem data'} · ${escapeHtml(visit.technicianName||'Por atribuir')}<br>${visit.issues.map(flag=>escapeHtml(labels[flag])).join(' · ')||'Agendada'}${visit.canTransfer?'':' · Acompanhamento individual necessário'}</span></label>`).join('')}${row.visits.some(v=>v.issues.includes('INCOMPLETE'))?'<a href="/admin-alerts#incompleteFollowups">Combinar regresso</a>':''}${row.flags.includes('NOT_SCHEDULED_TODAY')?'<p>Verifique as rondas abaixo e utilize Gerar semana após confirmar o planeamento.</p>':''}</article>`).join('');
      document.getElementById('visitReceiptsAdmin').innerHTML=(data.receipts||[]).map(row=>`<p data-admin-receipt="${row.id}"><strong>${escapeHtml(row.poolName)} · #${row.visitId}</strong> · ${escapeHtml(row.technicianName)} · ${({PENDING:'Por confirmar pelo técnico',RECEIVED:'Receção confirmada',RECEIVED_PREVIOUS:'Receção confirmada numa atribuição anterior',SUPERSEDED:'Atribuição substituída',CLOSED:'Visita encerrada sem confirmação de receção'})[row.state]}${row.receivedAt?' · '+new Date(row.receivedAt).toLocaleString('pt-PT'):''}</p>`).join('')||'<p>Sem transferências com confirmação registada.</p>';
      message().textContent=`${data.rows.length} piscina(s) a verificar. ${data.scope} ${data.automaticAlertsEnabled?'Avisos ao escritório verificados automaticamente de hora a hora.':'Avisos automáticos desativados neste ambiente; utilize Verificar agora.'}`;
    }catch(error){if(own===revision&&token===localStorage.getItem('token'))message().textContent=`Não foi possível atualizar: ${error.message}. A informação anterior pode estar desatualizada.`;}
  }
  document.getElementById('coverageRefresh').addEventListener('click',refresh);
  document.getElementById('coverageTransfer').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.target.querySelector('button'),token=localStorage.getItem('token');
    const visitIds=[...document.querySelectorAll('[data-transfer-visit]:checked')].map(node=>Number(node.dataset.transferVisit));
    if(!visitIds.length){message().textContent='Selecione as visitas que pretende transferir.';return;}
    const payload={visitIds,technicianId:Number(val('coverageTechnician')),reason:val('coverageCause')+': '+val('coverageReason')};button.disabled=true;
    try{
      const preview=await fetchJSON('/api/rounds/transfer-visits',{method:'POST',body:JSON.stringify({...payload,preview:true}),signal:AbortSignal.timeout(15000)});
      if(token!==localStorage.getItem('token'))return;
      const description=preview.visits.map(v=>`#${v.id} ${v.poolName}`).join(', ');
      if(!await ui.confirm(`Transferir ${preview.updated} visita(s) para ${preview.technicianName}? ${preview.unchanged} já atribuída(s) a esse técnico. Datas preservadas. ${description}`,{title:'Confirmar redistribuição',confirmText:'Transferir'}))return;
      if(token!==localStorage.getItem('token'))return;
      const result=await fetchJSON('/api/rounds/transfer-visits',{method:'POST',body:JSON.stringify({...payload,expected:preview.visits,requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(15000)});
      if(token!==localStorage.getItem('token'))return;
      await refresh();message().textContent=`${result.updated} visita(s) transferida(s) para ${result.technicianName}. Peça ao técnico para atualizar a rota e confirmar consigo.`;
    }catch(error){if(token===localStorage.getItem('token'))message().textContent=`Transferência não confirmada: ${error.message}. Atualize a lista antes de repetir.`;}
    finally{button.disabled=false;}
  });
  refresh();
})();
