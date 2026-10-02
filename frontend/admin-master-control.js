// Translate only original page labels and labels explicitly bound by their producers.
// Server data, cloned nodes and replaced leaves never acquire translation ownership.
const commandCopy = (() => {
  const copy = {
    "Administrador": ["Administrador", "Administrator", "Administrateur", "Administrador", "Administrator"],
    "Tecnico": ["Técnico", "Technician", "Technicien", "Técnico", "Techniker"],
    "Cliente": ["Cliente", "Client", "Client", "Cliente", "Kunde"],
    "Operacao": ["Operação", "Operations", "Opérations", "Operación", "Betrieb"],
    "Operação": ["Operação", "Operations", "Opérations", "Operaciones", "Betrieb"],
    "Financeiro": ["Financeiro", "Finance", "Finances", "Finanzas", "Finanzen"],
    "Clientes": ["Clientes", "Clients", "Clients", "Clientes", "Kunden"],
    "Piscinas": ["Piscinas", "Pools", "Piscines", "Piscinas", "Pools"],
    "Equipamentos": ["Equipamentos", "Equipment", "Équipements", "Equipos", "Ausrüstung"],
    "Hoje": ["Hoje", "Today", "Aujourd’hui", "Hoy", "Heute"],
    "Mapa operacional": ["Mapa operacional", "Operations map", "Carte des opérations", "Mapa operativo", "Betriebskarte"],
    "Viaturas": ["Viaturas", "Vehicles", "Véhicules", "Vehículos", "Fahrzeuge"],
    "Faturas": ["Faturas", "Invoices", "Factures", "Facturas", "Rechnungen"],
    "Pagamentos": ["Pagamentos", "Payments", "Paiements", "Pagos", "Zahlungen"],
    "Comunicacoes": ["Comunicações", "Communications", "Communications", "Comunicaciones", "Mitteilungen"],
    "Relatorios": ["Relatórios", "Reports", "Rapports", "Informes", "Berichte"],
    "Centro de relatorios": ["Centro de relatórios", "Report centre", "Centre de rapports", "Centro de informes", "Berichtszentrale"],
    "Visitas": ["Visitas", "Visits", "Visites", "Visitas", "Besuche"],
    "Tecnicos": ["Técnicos", "Technicians", "Techniciens", "Técnicos", "Techniker"],
    "Guias de transporte": ["Guias de transporte", "Transport guides", "Bordereaux de transport", "Guías de transporte", "Transportbegleitpapiere"],
    "Reparacoes": ["Reparações", "Repairs", "Réparations", "Reparaciones", "Reparaturen"],
    "Historico": ["Histórico", "History", "Historique", "Historial", "Historie"],
    "Notificacoes": ["Notificações", "Notifications", "Notifications", "Notificaciones", "Benachrichtigungen"],
    "Cristal Water · Centro de Operações V2": ["Cristal Water · Centro de Operações V2", "Cristal Water · Operations Centre V2", "Cristal Water · Centre des opérations V2", "Cristal Water · Centro de operaciones V2", "Cristal Water · Betriebszentrale V2"],
    "Idioma": ["Idioma", "Language", "Langue", "Idioma", "Sprache"],
    "Centro": ["Centro", "Centre", "Centre", "Centro", "Start"],
    "mobileAlerts": ["Alertas", "Alerts", "Alertes", "Alertas", "Alarme"],
    "Centro de comando": ["Centro de comando", "Command centre", "Centre de commande", "Centro de mando", "Leitzentrale"],
    "Operação diária": ["Operação diária", "Daily operations", "Opérations quotidiennes", "Operación diaria", "Tagesbetrieb"],
    "Clientes e Equipas": ["Clientes e equipas", "Clients and teams", "Clients et équipes", "Clientes y equipos", "Kunden und Teams"],
    "Intervenções e Campo": ["Intervenções e campo", "Interventions and field work", "Interventions et terrain", "Intervenciones y campo", "Einsätze und Außendienst"],
    "Ativos e Armazém": ["Ativos e armazém", "Assets and warehouse", "Actifs et entrepôt", "Activos y almacén", "Anlagen und Lager"],
    "Financeiro e Relatórios": ["Financeiro e relatórios", "Finance and reports", "Finances et rapports", "Finanzas e informes", "Finanzen und Berichte"],
    "Sistema": ["Sistema", "System", "Système", "Sistema", "System"],
    "Rotas / Rondas": ["Rotas / Rondas", "Routes / Rounds", "Itinéraires / Tournées", "Rutas / Rondas", "Routen / Touren"],
    "Mapas / GPS": ["Mapas / GPS", "Maps / GPS", "Cartes / GPS", "Mapas / GPS", "Karten / GPS"],
    "Instalacoes": ["Instalações", "Installations", "Installations", "Instalaciones", "Installationen"],
    "Construcao": ["Construção", "Construction", "Construction", "Construcción", "Bau"],
    "Intervencoes": ["Intervenções", "Interventions", "Interventions", "Intervenciones", "Einsätze"],
    "Intervenções": ["Intervenções", "Interventions", "Interventions", "Intervenciones", "Einsätze"],
    "Historico de servico": ["Histórico de serviço", "Service history", "Historique de service", "Historial de servicio", "Serviceverlauf"],
    "Guias de trabalho": ["Guias de trabalho", "Work sheets", "Bons de travail", "Hojas de trabajo", "Arbeitsnachweise"],
    "Stock / Inventario": ["Stock / Inventário", "Stock / Inventory", "Stock / Inventaire", "Stock / Inventario", "Lager / Inventar"],
    "Armazens": ["Armazéns", "Warehouses", "Entrepôts", "Almacenes", "Lagerhäuser"],
    "Produtos": ["Produtos", "Products", "Produits", "Productos", "Produkte"],
    "Despesas": ["Despesas", "Expenses", "Dépenses", "Gastos", "Ausgaben"],
    "Cobranca": ["Cobrança", "Collections", "Recouvrement", "Cobro", "Forderungen"],
    "Cobranças": ["Cobranças", "Collections", "Recouvrement", "Cobros", "Forderungen"],
    "Definicoes": ["Definições", "Settings", "Paramètres", "Configuración", "Einstellungen"],
    "Permissoes": ["Permissões", "Permissions", "Autorisations", "Permisos", "Berechtigungen"],
    "Indice de rotas (todos os modulos)": ["Índice de rotas (todos os módulos)", "Route index (all modules)", "Index des itinéraires (tous les modules)", "Índice de rutas (todos los módulos)", "Routenverzeichnis (alle Module)"],
    "Resumo operacional em tempo real.": ["Resumo operacional em tempo real.", "Live operational summary.", "Résumé opérationnel en temps réel.", "Resumen operativo en tiempo real.", "Aktuelle Betriebsübersicht."],
    "Pesquisa universal": ["Pesquisa universal", "Universal search", "Recherche universelle", "Búsqueda universal", "Globale Suche"],
    "Pesquisa universal: alertas, visitas, stock, financeiro": ["Pesquisa universal: alertas, visitas, stock, financeiro", "Search: alerts, visits, stock, finance", "Rechercher : alertes, visites, stock, finances", "Buscar: alertas, visitas, stock, finanzas", "Suchen: Alarme, Besuche, Lager, Finanzen"],
    "Voltar": ["Voltar", "Back", "Retour", "Volver", "Zurück"],
    "Atualizar": ["Atualizar", "Refresh", "Actualiser", "Actualizar", "Aktualisieren"],
    "Estado da operação com foco em decisão rápida.": ["Estado da operação com foco em decisão rápida.", "Operational status for quick decisions.", "État des opérations pour décider rapidement.", "Estado operativo para decisiones rápidas.", "Betriebsstatus für schnelle Entscheidungen."],
    "Ver prioridades": ["Ver prioridades", "View priorities", "Voir les priorités", "Ver prioridades", "Prioritäten anzeigen"],
    "Aprovações pendentes": ["Aprovações pendentes", "Pending approvals", "Approbations en attente", "Aprobaciones pendientes", "Ausstehende Freigaben"],
    "Serviço técnico": ["Serviço técnico", "Technical service", "Service technique", "Servicio técnico", "Technischer Service"],
    "Ajustar rondas": ["Ajustar rondas", "Adjust rounds", "Ajuster les tournées", "Ajustar rondas", "Touren anpassen"],
    "Gerir visitas": ["Gerir visitas", "Manage visits", "Gérer les visites", "Gestionar visitas", "Besuche verwalten"],
    "Abrir mapa": ["Abrir mapa", "Open map", "Ouvrir la carte", "Abrir mapa", "Karte öffnen"],
    "Ver histórico técnico": ["Ver histórico técnico", "View technical history", "Voir l’historique technique", "Ver historial técnico", "Technischen Verlauf anzeigen"],
    "Centro de alertas": ["Centro de alertas", "Alert centre", "Centre d’alertes", "Centro de alertas", "Alarmzentrale"],
    "Abrir": ["Abrir", "Open", "Ouvrir", "Abrir", "Öffnen"],
    "P0 crítico": ["P0 crítico", "P0 critical", "P0 critique", "P0 crítico", "P0 kritisch"],
    "P1 alto": ["P1 alto", "P1 high", "P1 élevé", "P1 alto", "P1 hoch"],
    "P2 monitorizar": ["P2 monitorizar", "P2 monitor", "P2 surveiller", "P2 supervisar", "P2 beobachten"],
    "Ver fila": ["Ver fila", "View queue", "Voir la file", "Ver cola", "Warteschlange anzeigen"],
    "Sempre visível no topo para decisão imediata.": ["Sempre visível no topo para decisão imediata.", "Always visible at the top for immediate decisions.", "Toujours visible en haut pour décider immédiatement.", "Siempre visible arriba para decidir de inmediato.", "Für sofortige Entscheidungen stets oben sichtbar."],
    "Financeiro rápido": ["Financeiro rápido", "Finance at a glance", "Finances en bref", "Finanzas rápidas", "Finanzübersicht"],
    "Detalhe": ["Detalhe", "Details", "Détails", "Detalle", "Details"],
    "Receber": ["Receber", "Receivables", "À recevoir", "Por cobrar", "Forderungen"],
    "Atrasos": ["Atrasos", "Overdue", "Retards", "Atrasos", "Überfällig"],
    "Estado geral": ["Estado geral", "Overall status", "État général", "Estado general", "Gesamtstatus"],
    "Visitas ativas": ["Visitas ativas", "Active visits", "Visites actives", "Visitas activas", "Aktive Besuche"],
    "Alertas críticos": ["Alertas críticos", "Critical alerts", "Alertes critiques", "Alertas críticas", "Kritische Alarme"],
    "Atualização": ["Atualização", "Update", "Actualisation", "Actualización", "Aktualisierung"],
    "Resumo executivo": ["Resumo executivo", "Executive summary", "Résumé exécutif", "Resumen ejecutivo", "Managementübersicht"],
    "4 KPIs principais": ["4 KPIs principais", "4 main KPIs", "4 indicateurs clés", "4 indicadores principales", "4 Hauptkennzahlen"],
    "Prioridades": ["Prioridades", "Priorities", "Priorités", "Prioridades", "Prioritäten"],
    "decisões necessárias": ["decisões necessárias", "decisions required", "décisions nécessaires", "decisiones necesarias", "Entscheidungen erforderlich"],
    "Operação do dia": ["Operação do dia", "Today’s operations", "Opérations du jour", "Operación del día", "Tagesbetrieb"],
    "atrasadas, em execução e próximas": ["atrasadas, em execução e próximas", "overdue, in progress and upcoming", "en retard, en cours et à venir", "atrasadas, en curso y próximas", "überfällig, laufend und bevorstehend"],
    "Em campo": ["Em campo", "In the field", "Sur le terrain", "En campo", "Im Einsatz"],
    "Disponível": ["Disponível", "Available", "Disponible", "Disponible", "Verfügbar"],
    "Atenção atraso": ["Atenção atraso", "Delay warning", "Alerte de retard", "Aviso de retraso", "Verzögerungswarnung"],
    "Registos da operação": ["Registos da operação", "Operational records", "Registres opérationnels", "Registros operativos", "Betriebsprotokolle"],
    "Informação secundária": ["Informação secundária", "Additional information", "Informations complémentaires", "Información adicional", "Zusätzliche Informationen"],
    "Histórico operacional recente": ["Histórico operacional recente", "Recent operational history", "Historique opérationnel récent", "Historial operativo reciente", "Aktueller Betriebsverlauf"],
    "Mapa de operações": ["Mapa de operações", "Operations map", "Carte des opérations", "Mapa de operaciones", "Betriebskarte"],
    "Planeamento e execução do dia.": ["Planeamento e execução do dia.", "Today’s planning and execution.", "Planification et exécution du jour.", "Planificación y ejecución del día.", "Planung und Ausführung des Tages."],
    "Editar visita": ["Editar visita", "Edit visit", "Modifier la visite", "Editar visita", "Besuch bearbeiten"],
    "Fechar": ["Fechar", "Close", "Fermer", "Cerrar", "Schließen"],
    "Data e hora": ["Data e hora", "Date and time", "Date et heure", "Fecha y hora", "Datum und Uhrzeit"],
    "Estado": ["Estado", "Status", "État", "Estado", "Status"],
    "Motivo": ["Motivo", "Reason", "Motif", "Motivo", "Grund"],
    "Notas": ["Notas", "Notes", "Notes", "Notas", "Notizen"],
    "Notas internas": ["Notas internas", "Internal notes", "Notes internes", "Notas internas", "Interne Notizen"],
    "Abrir módulo visitas": ["Abrir módulo visitas", "Open visits module", "Ouvrir le module visites", "Abrir módulo de visitas", "Besuchsmodul öffnen"],
    "Abrir menu completo": ["Abrir menu completo", "Open full menu", "Ouvrir le menu complet", "Abrir menú completo", "Vollständiges Menü öffnen"],
    "Menu completo administrador": ["Menu completo administrador", "Full administrator menu", "Menu administrateur complet", "Menú completo del administrador", "Vollständiges Administratormenü"],
    "Fechar menu": ["Fechar menu", "Close menu", "Fermer le menu", "Cerrar menú", "Menü schließen"],
    "Navegação principal": ["Navegação principal", "Main navigation", "Navigation principale", "Navegación principal", "Hauptnavigation"],
    "Módulos completos": ["Módulos completos", "All modules", "Tous les modules", "Todos los módulos", "Alle Module"],
    "Contexto de navegacao": ["Contexto de navegação", "Navigation context", "Contexte de navigation", "Contexto de navegación", "Navigationskontext"],
    "Aprovações pendentes em destaque": ["Aprovações pendentes em destaque", "Highlighted pending approvals", "Approbations en attente mises en évidence", "Aprobaciones pendientes destacadas", "Hervorgehobene ausstehende Freigaben"],
    "Ações rápidas operacionais": ["Ações rápidas operacionais", "Operational quick actions", "Actions opérationnelles rapides", "Acciones operativas rápidas", "Schnellaktionen im Betrieb"],
    "Resumo rápido de comando": ["Resumo rápido de comando", "Quick command summary", "Résumé rapide de commande", "Resumen rápido de mando", "Schnelle Leitübersicht"],
    "Hierarquia de alertas": ["Hierarquia de alertas", "Alert hierarchy", "Hiérarchie des alertes", "Jerarquía de alertas", "Alarmhierarchie"],
    "Prioridades P0 P1 P2": ["Prioridades P0 P1 P2", "Priorities P0 P1 P2", "Priorités P0 P1 P2", "Prioridades P0 P1 P2", "Prioritäten P0 P1 P2"],
    "Leitura financeira imediata": ["Leitura financeira imediata", "Finance at a glance", "Vue financière immédiate", "Vista financiera inmediata", "Finanzen auf einen Blick"],
    "Receber atrasos e cobranças": ["Receber atrasos e cobranças", "Receivables, overdue and collections", "À recevoir, retards et recouvrement", "Por cobrar, atrasos y cobros", "Forderungen, Rückstände und Einzug"],
    "Estado rápido": ["Estado rápido", "Quick status", "État rapide", "Estado rápido", "Schnellstatus"],
    "Painel operacional por prioridade": ["Painel operacional por prioridade", "Operations by priority", "Opérations par priorité", "Operaciones por prioridad", "Betrieb nach Priorität"],
    "Estado visual técnicos em campo": ["Estado visual técnicos em campo", "Field technician status", "État des techniciens sur le terrain", "Estado de técnicos en campo", "Status der Außendiensttechniker"],
    "Navegação móvel administrador": ["Navegação móvel administrador", "Administrator mobile navigation", "Navigation mobile administrateur", "Navegación móvil del administrador", "Mobile Administratornavigation"],
    "Todos os módulos do administrador": ["Todos os módulos do administrador", "All administrator modules", "Tous les modules administrateur", "Todos los módulos del administrador", "Alle Administratormodule"],
    "Hoje operacao": ["Hoje operação", "Today’s operations", "Opérations du jour", "Operación de hoy", "Heutiger Betrieb"],
    "Rotas Rondas": ["Rotas e rondas", "Routes and rounds", "Itinéraires et tournées", "Rutas y rondas", "Routen und Touren"],
    "Mapas GPS": ["Mapas e GPS", "Maps and GPS", "Cartes et GPS", "Mapas y GPS", "Karten und GPS"],
    "Stock inventario": ["Stock e inventário", "Stock and inventory", "Stock et inventaire", "Stock e inventario", "Lager und Inventar"],
    "Indice de rotas todos os modulos": ["Índice de rotas: todos os módulos", "Route index: all modules", "Index des itinéraires : tous les modules", "Índice de rutas: todos los módulos", "Routenverzeichnis: alle Module"],
    "Mapa de operações do dia": ["Mapa de operações do dia", "Today’s operations map", "Carte des opérations du jour", "Mapa de operaciones del día", "Betriebskarte des Tages"],
    "A carregar dados por secção": ["A carregar dados por secção", "Loading data by section", "Chargement des données par section", "Cargando datos por sección", "Daten werden je Abschnitt geladen"],
    "Dados parciais": ["Dados parciais", "Partial data", "Données partielles", "Datos parciales", "Teilweise Daten"],
    "Sincronizado": ["Sincronizado", "Synced", "Synchronisé", "Sincronizado", "Synchronisiert"],
    "A navegar": ["A navegar", "Browsing", "Navigation en cours", "Navegando", "Navigation"],
    "A atualizar visitas, alertas e equipa.": ["A atualizar visitas, alertas e equipa.", "Refreshing visits, alerts and team.", "Actualisation des visites, alertes et équipes.", "Actualizando visitas, alertas y equipo.", "Besuche, Alarme und Team werden aktualisiert."],
    "Alguns dados estão indisponíveis. Atualize para confirmar a situação da equipa.": ["Alguns dados estão indisponíveis. Atualize para confirmar a situação da equipa.", "Some data is unavailable. Refresh to confirm the team’s status.", "Certaines données sont indisponibles. Actualisez pour confirmer l’état de l’équipe.", "Algunos datos no están disponibles. Actualice para confirmar el estado del equipo.", "Einige Daten sind nicht verfügbar. Aktualisieren Sie, um den Teamstatus zu prüfen."],
    "Visitas, alertas e equipa — informação atualizada.": ["Visitas, alertas e equipa — informação atualizada.", "Visits, alerts and team — up-to-date information.", "Visites, alertes et équipes — informations à jour.", "Visitas, alertas y equipo — información actualizada.", "Besuche, Alarme und Team — aktuelle Informationen."],
    "Atualizado agora": ["Atualizado agora", "Updated just now", "Actualisé à l’instant", "Actualizado ahora", "Soeben aktualisiert"],
    "Tentar novamente": ["Tentar novamente", "Try again", "Réessayer", "Reintentar", "Erneut versuchen"],
    "Continuar sem dados": ["Continuar sem dados", "Continue without data", "Continuer sans données", "Continuar sin datos", "Ohne Daten fortfahren"],
    "A carregar resumo": ["A carregar resumo", "Loading summary", "Chargement du résumé", "Cargando resumen", "Übersicht wird geladen"],
    "Os indicadores principais estão a ser preparados.": ["Os indicadores principais estão a ser preparados.", "The main indicators are being prepared.", "Les principaux indicateurs sont en préparation.", "Se están preparando los indicadores principales.", "Die Hauptkennzahlen werden vorbereitet."],
    "A carregar prioridades": ["A carregar prioridades", "Loading priorities", "Chargement des priorités", "Cargando prioridades", "Prioritäten werden geladen"],
    "As prioridades e alertas ainda estão a ser reunidos.": ["As prioridades e alertas ainda estão a ser reunidos.", "Priorities and alerts are still being gathered.", "Les priorités et alertes sont en cours de collecte.", "Se están recopilando las prioridades y alertas.", "Prioritäten und Alarme werden zusammengestellt."],
    "A carregar estado geral": ["A carregar estado geral", "Loading overall status", "Chargement de l’état général", "Cargando estado general", "Gesamtstatus wird geladen"],
    "A leitura rápida da operação vai aparecer em breve.": ["A leitura rápida da operação vai aparecer em breve.", "The operational overview will appear shortly.", "L’aperçu des opérations apparaîtra bientôt.", "La vista operativa aparecerá en breve.", "Die Betriebsübersicht wird in Kürze angezeigt."],
    "Não foi possível carregar os dados": ["Não foi possível carregar os dados", "Unable to load data", "Impossible de charger les données", "No se pudieron cargar los datos", "Daten konnten nicht geladen werden"],
    "Não foi possível carregar os dados.": ["Não foi possível carregar os dados.", "Unable to load data.", "Impossible de charger les données.", "No se pudieron cargar los datos.", "Daten konnten nicht geladen werden."],
    "Dados indisponíveis": ["Dados indisponíveis", "Data unavailable", "Données indisponibles", "Datos no disponibles", "Daten nicht verfügbar"],
    "Pode continuar a navegar sem o resumo.": ["Pode continuar a navegar sem o resumo.", "You can continue browsing without the summary.", "Vous pouvez continuer sans le résumé.", "Puede continuar sin el resumen.", "Sie können ohne die Übersicht fortfahren."],
    "As prioridades ficam vazias até voltar a carregar.": ["As prioridades ficam vazias até voltar a carregar.", "Priorities remain empty until data is loaded again.", "Les priorités restent vides jusqu’au prochain chargement.", "Las prioridades estarán vacías hasta volver a cargar.", "Prioritäten bleiben bis zum erneuten Laden leer."],
    "O resumo rápido não está disponível, mas a página permanece funcional.": ["O resumo rápido não está disponível, mas a página permanece funcional.", "The quick summary is unavailable, but the page remains usable.", "Le résumé rapide est indisponible, mais la page reste utilisable.", "El resumen rápido no está disponible, pero la página sigue funcionando.", "Die Schnellübersicht ist nicht verfügbar; die Seite bleibt bedienbar."],
    "A carregar operação do dia": ["A carregar operação do dia", "Loading today’s operations", "Chargement des opérations du jour", "Cargando operación del día", "Tagesbetrieb wird geladen"],
    "As visitas e o estado operacional estão a chegar.": ["As visitas e o estado operacional estão a chegar.", "Visits and operational status are being loaded.", "Les visites et l’état opérationnel sont en cours de chargement.", "Se están cargando las visitas y el estado operativo.", "Besuche und Betriebsstatus werden geladen."],
    "A carregar visitas": ["A carregar visitas", "Loading visits", "Chargement des visites", "Cargando visitas", "Besuche werden geladen"],
    "A lista de visitas abre assim que os dados chegam.": ["A lista de visitas abre assim que os dados chegam.", "The visit list opens as soon as the data arrives.", "La liste des visites s’affiche dès réception des données.", "La lista de visitas se abre al recibir los datos.", "Die Besuchsliste wird nach Eingang der Daten angezeigt."],
    "A carregar propagação técnica": ["A carregar propagação técnica", "Loading technical events", "Chargement des événements techniques", "Cargando eventos técnicos", "Technische Ereignisse werden geladen"],
    "Os eventos técnicos aparecem quando o pedido responde.": ["Os eventos técnicos aparecem quando o pedido responde.", "Technical events appear when the request completes.", "Les événements techniques s’affichent à la réponse.", "Los eventos técnicos aparecen al recibir la respuesta.", "Technische Ereignisse erscheinen nach Eingang der Antwort."],
    "A operação do dia pode ser aberta sem este bloco.": ["A operação do dia pode ser aberta sem este bloco.", "Today’s operations can be opened without this section.", "Les opérations du jour sont accessibles sans cette section.", "La operación del día puede abrirse sin esta sección.", "Der Tagesbetrieb kann ohne diesen Abschnitt geöffnet werden."],
    "Sem visitas carregadas por enquanto.": ["Sem visitas carregadas por enquanto.", "No visits loaded yet.", "Aucune visite chargée pour le moment.", "Aún no hay visitas cargadas.", "Noch keine Besuche geladen."],
    "Sem eventos técnicos carregados por enquanto.": ["Sem eventos técnicos carregados por enquanto.", "No technical events loaded yet.", "Aucun événement technique chargé pour le moment.", "Aún no hay eventos técnicos cargados.", "Noch keine technischen Ereignisse geladen."],
    "Resposta inválida do servidor.": ["Resposta inválida do servidor.", "Invalid server response.", "Réponse du serveur invalide.", "Respuesta del servidor no válida.", "Ungültige Serverantwort."],
    "Erro HTTP {status}": ["Erro HTTP {status}", "HTTP error {status}", "Erreur HTTP {status}", "Error HTTP {status}", "HTTP-Fehler {status}"],
    "Não foi possível carregar os dados. O pedido excedeu o tempo limite.": ["Não foi possível carregar os dados. O pedido excedeu o tempo limite.", "Unable to load data. The request timed out.", "Impossible de charger les données. Le délai a été dépassé.", "No se pudieron cargar los datos. La solicitud agotó el tiempo.", "Daten konnten nicht geladen werden. Zeitüberschreitung der Anfrage."],
    "Pedido cancelado.": ["Pedido cancelado.", "Request cancelled.", "Requête annulée.", "Solicitud cancelada.", "Anfrage abgebrochen."],
    "Críticos": ["Críticos", "Critical", "Critiques", "Críticos", "Kritisch"],
    "ações imediatas": ["ações imediatas", "immediate actions", "actions immédiates", "acciones inmediatas", "sofortiger Handlungsbedarf"],
    "Visitas hoje": ["Visitas hoje", "Today’s visits", "Visites du jour", "Visitas de hoy", "Heutige Besuche"],
    "planeadas no dia": ["planeadas no dia", "planned for today", "prévues aujourd’hui", "planificadas para hoy", "heute geplant"],
    "Técnicos ativos": ["Técnicos ativos", "Active technicians", "Techniciens actifs", "Técnicos activos", "Aktive Techniker"],
    "em operação no terreno": ["em operação no terreno", "working in the field", "en activité sur le terrain", "trabajando en campo", "im Außendienst tätig"],
    "Pendências": ["Pendências", "Outstanding items", "Éléments en attente", "Pendientes", "Offene Punkte"],
    "financeiro por fechar": ["financeiro por fechar", "finance awaiting completion", "finances à clôturer", "finanzas por cerrar", "offene Finanzvorgänge"],
    "Abrir {label}": ["Abrir {label}", "Open {label}", "Ouvrir {label}", "Abrir {label}", "{label} öffnen"],
    "{count} crítico(s)": ["{count} crítico(s)", "{count} critical", "{count} critique(s)", "{count} crítico(s)", "{count} kritisch"],
    "{count} requer(em) atenção": ["{count} requer(em) atenção", "{count} need attention", "{count} nécessitent une attention", "{count} requieren atención", "{count} erfordern Aufmerksamkeit"],
    "{count} informativo(s)": ["{count} informativo(s)", "{count} informational", "{count} informatif(s)", "{count} informativo(s)", "{count} informativ"],
    "Decisão imediata necessária": ["Decisão imediata necessária", "Immediate decision required", "Décision immédiate nécessaire", "Decisión inmediata necesaria", "Sofortige Entscheidung erforderlich"],
    "Pode impactar operação hoje": ["Pode impactar operação hoje", "May affect today’s operations", "Peut affecter les opérations du jour", "Puede afectar la operación de hoy", "Kann den Tagesbetrieb beeinträchtigen"],
    "Monitorização e planeamento": ["Monitorização e planeamento", "Monitoring and planning", "Suivi et planification", "Seguimiento y planificación", "Überwachung und Planung"],
    "Ver restantes": ["Ver restantes", "View remaining", "Voir les autres", "Ver restantes", "Übrige anzeigen"],
    "{count} prioridade(s) agrupadas sem duplicação.": ["{count} prioridade(s) agrupadas sem duplicação.", "{count} priorities grouped without duplication.", "{count} priorités regroupées sans doublon.", "{count} prioridades agrupadas sin duplicados.", "{count} Prioritäten ohne Duplikate gruppiert."],
    "Visitas em atraso": ["Visitas em atraso", "Overdue visits", "Visites en retard", "Visitas atrasadas", "Überfällige Besuche"],
    "Em execução": ["Em execução", "In progress", "En cours", "En curso", "In Bearbeitung"],
    "Técnicos disponíveis": ["Técnicos disponíveis", "Available technicians", "Techniciens disponibles", "Técnicos disponibles", "Verfügbare Techniker"],
    "Próxima decisão": ["Próxima decisão", "Next decision", "Prochaine décision", "Próxima decisión", "Nächste Entscheidung"],
    "Sem eventos técnicos propagados nas últimas horas.": ["Sem eventos técnicos propagados nas últimas horas.", "No technical events shared in recent hours.", "Aucun événement technique transmis ces dernières heures.", "No se han propagado eventos técnicos en las últimas horas.", "Keine technischen Ereignisse in den letzten Stunden weitergegeben."],
    "Abrir ficha técnica": ["Abrir ficha técnica", "Open technical sheet", "Ouvrir la fiche technique", "Abrir ficha técnica", "Technisches Datenblatt öffnen"],
    "Atenção": ["Atenção", "Attention", "Attention", "Atención", "Achtung"],
    "Pontos a rever": ["Pontos a rever", "Items to review", "Points à revoir", "Puntos por revisar", "Zu prüfende Punkte"],
    "Atualizado": ["Atualizado", "Updated", "Actualisé", "Actualizado", "Aktualisiert"],
    "Atualizado às {time}": ["Atualizado às {time}", "Updated at {time}", "Actualisé à {time}", "Actualizado a las {time}", "Aktualisiert um {time}"],
    "Atenção operacional": ["Atenção operacional", "Operational attention", "Attention opérationnelle", "Atención operativa", "Betrieblicher Handlungsbedarf"],
    "{done} concluídas · {planned} planeadas · {messages} mensagem(ns) · {notifications} aviso(s) · {events} evento(s) técnicos/24h · {risk} ponto(s) a rever": ["{done} concluídas · {planned} planeadas · {messages} mensagem(ns) · {notifications} aviso(s) · {events} evento(s) técnicos/24h · {risk} ponto(s) a rever", "{done} completed · {planned} planned · {messages} messages · {notifications} notices · {events} technical events/24h · {risk} items to review", "{done} terminées · {planned} prévues · {messages} messages · {notifications} avis · {events} événements techniques/24h · {risk} points à revoir", "{done} completadas · {planned} planificadas · {messages} mensajes · {notifications} avisos · {events} eventos técnicos/24h · {risk} puntos por revisar", "{done} erledigt · {planned} geplant · {messages} Nachrichten · {notifications} Hinweise · {events} technische Ereignisse/24h · {risk} Prüfpunkte"],
    "Sem visitas abertas. Quando existirem rondas/visitas, aparecem aqui.": ["Sem visitas abertas. Quando existirem rondas/visitas, aparecem aqui.", "No open visits. Rounds and visits will appear here when available.", "Aucune visite ouverte. Les tournées et visites apparaîtront ici.", "No hay visitas abiertas. Las rondas y visitas aparecerán aquí.", "Keine offenen Besuche. Vorhandene Touren und Besuche erscheinen hier."],
    "Editar": ["Editar", "Edit", "Modifier", "Editar", "Bearbeiten"],
    "Sem piscinas pendentes de ronda.": ["Sem piscinas pendentes de ronda.", "No pools awaiting a round.", "Aucune piscine en attente de tournée.", "No hay piscinas pendientes de ronda.", "Keine Pools warten auf eine Tour."],
    "Planear": ["Planear", "Plan", "Planifier", "Planificar", "Planen"],
    "Resumo carregado com sucesso. {clients} cliente(s), {pools} piscina(s), {technicians} técnico(s).": ["Resumo carregado com sucesso. {clients} cliente(s), {pools} piscina(s), {technicians} técnico(s).", "Summary loaded. {clients} clients, {pools} pools, {technicians} technicians.", "Résumé chargé. {clients} clients, {pools} piscines, {technicians} techniciens.", "Resumen cargado. {clients} clientes, {pools} piscinas, {technicians} técnicos.", "Übersicht geladen. {clients} Kunden, {pools} Pools, {technicians} Techniker."],
    "Sistema carregado com sucesso. {clients} cliente(s), {pools} piscina(s), {technicians} técnico(s).": ["Sistema carregado com sucesso. {clients} cliente(s), {pools} piscina(s), {technicians} técnico(s).", "System loaded. {clients} clients, {pools} pools, {technicians} technicians.", "Système chargé. {clients} clients, {pools} piscines, {technicians} techniciens.", "Sistema cargado. {clients} clientes, {pools} piscinas, {technicians} técnicos.", "System geladen. {clients} Kunden, {pools} Pools, {technicians} Techniker."],
    "Atenção: existem ": ["Atenção: existem ", "Attention: there are ", "Attention : il y a ", "Atención: hay ", "Achtung: Es gibt "],
    " mensagem(ns) de clientes por responder. ": [" mensagem(ns) de clientes por responder. ", " client messages awaiting a reply. ", " messages clients en attente de réponse. ", " mensajes de clientes pendientes de respuesta. ", " Kundennachrichten ohne Antwort. "],
    "Abrir mensagens": ["Abrir mensagens", "Open messages", "Ouvrir les messages", "Abrir mensajes", "Nachrichten öffnen"],
    "Alertas": ["Alertas", "Alerts", "Alertes", "Alertas", "Warnmeldungen"],
    "CRM": ["CRM", "CRM", "CRM", "CRM", "CRM"],
    "Chaves": ["Chaves", "Keys", "Clés", "Llaves", "Schlüssel"],
    "Menu": ["Menu", "Menu", "Menu", "Menú", "Menü"],
    "Menu completo": ["Menu completo", "Full menu", "Menu complet", "Menú completo", "Vollständiges Menü"],
    "Técnico": ["Técnico", "Technician", "Technicien", "Técnico", "Techniker"],
    "A agregar alertas e decisões...": ["A agregar alertas e decisões...", "Grouping alerts and decisions...", "Regroupement des alertes et décisions...", "Agrupando alertas y decisiones...", "Alarme und Entscheidungen werden zusammengefasst..."],
    "A carregar eventos técnicos...": ["A carregar eventos técnicos...", "Loading technical events...", "Chargement des événements techniques...", "Cargando eventos técnicos...", "Technische Ereignisse werden geladen..."],
    "A carregar visitas...": ["A carregar visitas...", "Loading visits...", "Chargement des visites...", "Cargando visitas...", "Besuche werden geladen..."],
    "mobileToday": ["Hoje", "Today", "Ce jour", "Hoy", "Heute"]
  };
  const languages = ['pt','en','fr','es','de'];
  const leaves = new Map(), attributes = new Map(), errors = new WeakMap();
  const language = () => Math.max(0,languages.indexOf(document.documentElement.lang));
  const format = (source,params,index,original = false) => (original ? source : copy[source][index]).replace(/\{(\w+)\}/g,(_,key) => String(typeof params[key] === 'function' ? params[key](index) : params[key] ?? ''));
  const value = (source,params = {},index = language()) => format(source,params,index);
  function owns(leaf) {
    const parent=leaf.node.parentNode;
    return leaf.node.isConnected && parent===leaf.parent && leaf.node.nodeValue===leaf.rendered && parent.childNodes.length===leaf.children.length && leaf.children.every((node,index)=>parent.childNodes[index]===node) && parent.getAttribute('href')===leaf.href && (!leaf.search || parent.getAttribute('data-shell-search')===leaf.search.rendered);
  }
  function bindNode(node,source,params = {},original = source) {
    if (!node || !Object.hasOwn(copy,source) || node.nodeType!==Node.TEXT_NODE || !node.parentElement) return;
    const expected=format(original,params,0,true), raw=node.nodeValue;
    if (raw!==expected && raw.trim()!==expected) return;
    const parent=node.parentElement,prefix=raw===expected?'':raw.slice(0,raw.indexOf(expected)),suffix=raw===expected?'':raw.slice(raw.indexOf(expected)+expected.length);
    const rendered=prefix+value(source,params)+suffix, metadata=parent.getAttribute('data-shell-search');
    const search=metadata===null?null:{source:metadata,rendered:Object.hasOwn(copy,metadata)?value(metadata):metadata};
    parent.dataset.cwNoI18n='';node.nodeValue=rendered;if(search)parent.setAttribute('data-shell-search',search.rendered);
    leaves.set(node,{node,parent,source,params:{...params},prefix,suffix,rendered,children:[...parent.childNodes],href:parent.getAttribute('href'),search});
  }
  function bind(node,source,params = {}) {
    if (!node || !Object.hasOwn(copy,source)) return;
    const expected=format(source,params,0,true);
    bindNode([...node.childNodes].find(child=>child.nodeType===Node.TEXT_NODE&&(child.nodeValue===expected||child.nodeValue.trim()===expected)),source,params);
  }
  function bindAttribute(node,name,source,params = {}) {
    if (!node || !Object.hasOwn(copy,source) || node.getAttribute(name)!==format(source,params,0,true)) return;
    const rendered=value(source,params);node.setAttribute(name,rendered);node.dataset.cwNoI18n='';
    if(!attributes.has(node))attributes.set(node,new Map());attributes.get(node).set(name,{source,params:{...params},rendered});
  }
  function paint() {
    for(const [node,leaf] of leaves){
      if(!owns(leaf)){leaves.delete(node);continue;}
      const rendered=leaf.prefix+value(leaf.source,leaf.params)+leaf.suffix;
      if(rendered!==leaf.rendered)node.nodeValue=rendered;leaf.rendered=rendered;
      if(leaf.search){const next=Object.hasOwn(copy,leaf.search.source)?value(leaf.search.source):leaf.search.source;if(next!==leaf.search.rendered)leaf.parent.setAttribute('data-shell-search',next);leaf.search.rendered=next;}
    }
    for(const [node,owned] of attributes){
      if(!node.isConnected){attributes.delete(node);continue;}
      for(const [name,leaf] of owned){if(node.getAttribute(name)!==leaf.rendered){owned.delete(name);continue;}const rendered=value(leaf.source,leaf.params);if(rendered!==leaf.rendered)node.setAttribute(name,rendered);leaf.rendered=rendered;}
      if(!owned.size)attributes.delete(node);
    }
  }
  function prune() {
    for(const [node,leaf] of leaves)if(!owns(leaf))leaves.delete(node);
    for(const [node] of attributes)if(!node.isConnected)attributes.delete(node);
  }
  function set(node,source,params = {}) {
    if(!node)return;
    node.textContent=format(source,params,0,true);
    bind(node,source,params);
    prune();
  }
  function labels(node) {
    const leaf=leaves.get(node?.firstChild);
    if(!leaf?.search)return [];
    if(!owns(leaf)){leaves.delete(leaf.node);return [];}
    return [leaf.source, leaf.search.source, ...copy[leaf.source], ...(Object.hasOwn(copy,leaf.search.source)?copy[leaf.search.source]:[])];
  }
  function problem(source,params = {}) {
    const error=new Error(format(source,params,0,true));errors.set(error,{source,params:{...params}});return error;
  }
  function bindError(node,error) {const owned=errors.get(error);if(owned)bind(node,owned.source,owned.params);}
  function state(root,title,message,ownedMessage = true) {
    bind(root.querySelector('b'),title);
    if(ownedMessage)bind(root.querySelector('.muted'),message);
    root.querySelectorAll('[data-dashboard-retry]').forEach(node=>bind(node,'Tentar novamente'));
    root.querySelectorAll('[data-dashboard-continue]').forEach(node=>bind(node,'Continuar sem dados'));
  }
  // Capture the page's original HTML once, before any business data is loaded.
  // Later renders bind only the specific labels their own producers create.
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),originals=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('script,style'))originals.push(walker.currentNode);
  for(const node of originals){const source=node.nodeValue.trim();if(Object.hasOwn(copy,source)){if(source==='Alertas'&&node.parentElement.closest('.cw-v2-mobile-nav'))bindNode(node,'mobileAlerts',{},'Alertas');else if(source==='Hoje'&&node.parentElement.closest('.cw-v2-mobile-nav'))bindNode(node,'mobileToday',{},'Hoje');else bindNode(node,source);}}
  bind(document.querySelector('title'),'Cristal Water · Centro de Operações V2');
  for(const node of document.body.querySelectorAll('[aria-label],[title],[placeholder]'))for(const name of ['aria-label','title','placeholder']){const source=node.getAttribute(name);if(Object.hasOwn(copy,source))bindAttribute(node,name,source);}
  document.getElementById('cwLanguageSelect')?.addEventListener('change',event=>window.CristalI18n?.applyLanguage(event.target.value));
  window.CWCommandSearch=Object.freeze({labels});
  window.addEventListener('DOMContentLoaded', () => {
    const requested = new URLSearchParams(location.search).get('lang');
    if (languages.includes(requested)) window.CristalI18n?.applyLanguage(requested);
  }, { once: true });
  window.addEventListener('cw-language-change',paint);
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  return {bind,bindNode,bindAttribute,bindError,problem,state,value,set,prune};
})();

const API = '/api/core';
const DASHBOARD_TIMEOUTS = window.__CW_DASHBOARD_TIMEOUTS__ || {};
const SUMMARY_TIMEOUT_MS = Number(DASHBOARD_TIMEOUTS.summary || 12000);
const CORE_TIMEOUT_MS = Number(DASHBOARD_TIMEOUTS.core || 12000);
const TECHNICIANS_TIMEOUT_MS = Number(DASHBOARD_TIMEOUTS.technicians || 8000);
const MODULE_ROUTES = {
  technicians: '/admin-technicians',
  clients: '/admin-clients',
  pools: '/admin-pools',
  rounds: '/admin-rounds',
  visits: '/admin-visits',
  stock: '/admin-inventory',
  billing: '/billing',
  'simulate-full-flow': '/api/core/simulate-full-flow'
};
const VISIT_STATUSES = ['PLANNED', 'PENDING_TECHNICIAN', 'IN_PROGRESS', 'RETAINED', 'NOT_DONE', 'DONE', 'CANCELLED'];
const state = {
  summary: null,
  dashboard: null,
  technicians: [],
  loadState: {
    summary: 'idle',
    core: 'idle',
    technicians: 'idle',
  },
};

let loadGeneration = 0;
const activeLoadControllers = new Set();

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

function trackLoadController(controller) {
  activeLoadControllers.add(controller);
  return controller;
}

function releaseLoadController(controller) {
  activeLoadControllers.delete(controller);
}

function abortActiveLoads() {
  activeLoadControllers.forEach((controller) => {
    try {
      controller.abort();
    } catch (_) {
      // noop
    }
  });
  activeLoadControllers.clear();
}

function setLoadState(group, status) {
  state.loadState[group] = status;
  refreshLoadStatus();
}

function refreshLoadStatus() {
  const syncState = $('#syncState');
  const metricsHint = $('#metricsHint');
  const lastUpdate = $('#lastUpdate');
  const summaryState = state.loadState.summary;
  const coreState = state.loadState.core;

  if (syncState) {
    if ([summaryState, coreState, state.loadState.technicians].includes('loading')) {
      commandCopy.set(syncState, 'A carregar dados por secção');
    } else if ([summaryState, coreState, state.loadState.technicians].includes('error')) {
      commandCopy.set(syncState, 'Dados parciais');
    } else if (summaryState === 'ready' && coreState === 'ready' && state.loadState.technicians === 'ready') {
      commandCopy.set(syncState, 'Sincronizado');
    } else {
      commandCopy.set(syncState, 'A navegar');
    }
  }

  if (metricsHint) {
    if ([summaryState, coreState, state.loadState.technicians].includes('loading')) {
      commandCopy.set(metricsHint, 'A atualizar visitas, alertas e equipa.');
    } else if ([summaryState, coreState, state.loadState.technicians].includes('error')) {
      commandCopy.set(metricsHint, 'Alguns dados estão indisponíveis. Atualize para confirmar a situação da equipa.');
    } else {
      commandCopy.set(metricsHint, 'Visitas, alertas e equipa — informação atualizada.');
    }
  }

  if (lastUpdate && summaryState === 'ready' && coreState === 'ready' && state.loadState.technicians === 'ready') {
    commandCopy.set(lastUpdate, 'Atualizado agora');
  }
}

function renderInlineState({ title, message, group, tone = 'loading' }) {
  const stateClass = tone === 'error' ? 'cw-v2-state-error' : 'cw-v2-state-loading';
  return `
    <div class="${stateClass}" data-cw-state="${tone}" data-cw-state-context="${tone}" role="${tone === 'error' ? 'alert' : 'status'}" aria-live="${tone === 'error' ? 'assertive' : 'polite'}">
      <div style="display:grid; gap:6px; min-width:0;">
        <b>${esc(title)}</b>
        <div class="muted">${esc(message)}</div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        <button type="button" class="btn ghost" data-dashboard-retry="${esc(group)}">Tentar novamente</button>
        <button type="button" class="btn ghost" data-dashboard-continue="${esc(group)}">Continuar sem dados</button>
      </div>
    </div>
  `;
}

function renderSectionLoading(root, title, message, group) {
  if (!root) return;
  root.innerHTML = renderInlineState({ title, message, group, tone: 'loading' });
  commandCopy.state(root, title, message);
  commandCopy.prune();
}

function renderSectionError(root, title, error, group) {
  if (!root) return;
  const failure = error?.message ? error : commandCopy.problem('Não foi possível carregar os dados.');
  root.innerHTML = renderInlineState({ title, message: failure.message, group, tone: 'error' });
  commandCopy.state(root, title, '', false);
  commandCopy.bindError(root.querySelector('.muted'), failure);
  commandCopy.prune();
}

function renderSectionEmpty(root, title, message) {
  if (!root) return;
  root.innerHTML = `
    <div class="empty cw-v2-state-empty" data-cw-state="empty" role="status" aria-live="polite">
      <b>${esc(title)}</b>
      <div class="muted">${esc(message)}</div>
    </div>
  `;
  commandCopy.state(root, title, message);
  commandCopy.prune();
}

function renderSummaryLoading() {
  renderSectionLoading($('#metrics'), 'A carregar resumo', 'Os indicadores principais estão a ser preparados.', 'summary');
  renderSectionLoading($('#prioritySummary'), 'A carregar prioridades', 'As prioridades e alertas ainda estão a ser reunidos.', 'summary');
  renderSectionLoading($('#statusStrip'), 'A carregar estado geral', 'A leitura rápida da operação vai aparecer em breve.', 'summary');
}

function renderSummaryError(message) {
  renderSectionError($('#metrics'), 'Não foi possível carregar os dados', message, 'summary');
  renderSectionError($('#prioritySummary'), 'Não foi possível carregar os dados', message, 'summary');
  renderSectionError($('#statusStrip'), 'Não foi possível carregar os dados', message, 'summary');
}

function renderSummaryFallback() {
  renderSectionEmpty($('#metrics'), 'Dados indisponíveis', 'Pode continuar a navegar sem o resumo.');
  renderSectionEmpty($('#prioritySummary'), 'Dados indisponíveis', 'As prioridades ficam vazias até voltar a carregar.');
  renderSectionEmpty($('#statusStrip'), 'Dados indisponíveis', 'O resumo rápido não está disponível, mas a página permanece funcional.');
}

function renderCoreLoading() {
  renderSectionLoading($('#operationDigest'), 'A carregar operação do dia', 'As visitas e o estado operacional estão a chegar.', 'core');
  renderSectionLoading($('#todayList'), 'A carregar visitas', 'A lista de visitas abre assim que os dados chegam.', 'core');
  renderSectionLoading($('#technicalPropagationList'), 'A carregar propagação técnica', 'Os eventos técnicos aparecem quando o pedido responde.', 'core');
}

function renderCoreError(message) {
  renderSectionError($('#operationDigest'), 'Não foi possível carregar os dados', message, 'core');
  renderSectionError($('#todayList'), 'Não foi possível carregar os dados', message, 'core');
  renderSectionError($('#technicalPropagationList'), 'Não foi possível carregar os dados', message, 'core');
}

function renderCoreFallback() {
  renderSectionEmpty($('#operationDigest'), 'Dados indisponíveis', 'A operação do dia pode ser aberta sem este bloco.');
  renderSectionEmpty($('#todayList'), 'Dados indisponíveis', 'Sem visitas carregadas por enquanto.');
  renderSectionEmpty($('#technicalPropagationList'), 'Dados indisponíveis', 'Sem eventos técnicos carregados por enquanto.');
}

async function api(path, options = {}) {
  const url = path.startsWith('/api') ? path : API + path;
  const timeoutMs = Number(options.timeoutMs || 0);
  const externalSignal = options.signal || null;
  const controller = new AbortController();
  let timeoutId = null;
  let timedOut = false;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  if (timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });
  let invalidResponse = null;
  const json = await response.json().catch(() => {
    invalidResponse = commandCopy.problem('Resposta inválida do servidor.');
    return { ok: false, error: invalidResponse.message };
  });
  if (timeoutId) clearTimeout(timeoutId);
  if (!response.ok || json.ok === false) {
    throw invalidResponse || (json.error || json.message
      ? new Error(json.error || json.message)
      : commandCopy.problem('Erro HTTP {status}', { status: response.status }));
  }
  return json;
}

async function apiWithTimeout(path, options = {}) {
  try {
    return await api(path, options);
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (options.timeoutMs) {
        const timeoutError = commandCopy.problem('Não foi possível carregar os dados. O pedido excedeu o tempo limite.');
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      const abortError = commandCopy.problem('Pedido cancelado.');
      abortError.code = 'ABORTED';
      throw abortError;
    }
    throw error;
  }
}

function number(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function statusClass(value, type = 'normal') {
  const v = number(value);
  if (type === 'bad' && v > 0) return 'bad-card';
  if (type === 'warn' && v > 0) return 'warn-card';
  if (type === 'ok' && v > 0) return 'ok-card';
  return '';
}

// Fixed vector artwork keeps operational indicators readable without emoji fonts.
const metricIcons = Object.freeze({
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  technician: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 8-5.65M16 3a4 4 0 0 0 0 7l-4 8 3 2 4-8a4 4 0 0 0 3-6l-3 3-2-2 2-3"/>',
  payment: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20m-16 5h4"/>'
});
function metricIcon(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${metricIcons[name] || ''}</svg>`;
}

function renderMetrics(counts = {}) {
  const criticalAlerts = number(counts.repairsOpen) + number(counts.notificationsUnread);
  const techniciansInField = number(counts.techniciansActive || counts.techniciansOnField || counts.technicians);
  const lowStock = number(counts.productsLowStock || counts.stockLow || counts.inventoryLow);
  const items = [
    { icon: 'alert', label: 'Críticos', value: criticalAlerts, hint: 'ações imediatas', tone: 'bad', href: '/admin-alerts?priority=critical' },
    { icon: 'location', label: 'Visitas hoje', value: counts.visitsPlanned, hint: 'planeadas no dia', tone: 'warn', href: '/admin-rounds?date=today' },
    { icon: 'technician', label: 'Técnicos ativos', value: techniciansInField, hint: 'em operação no terreno', tone: 'ok', href: '/admin-technicians?status=active' },
    { icon: 'payment', label: 'Pendências', value: counts.invoicesOpen, hint: 'financeiro por fechar', tone: 'warn', href: '/invoices?status=pending' }
  ];

  $('#metrics').innerHTML = items.map((item) => `
    <a class="card metric-card ${statusClass(item.value, item.tone)}" href="${esc(item.href)}" aria-label="Abrir ${esc(item.label)}" title="Abrir ${esc(item.label)}">
      <div class="metric-top">
        <div class="metric-icon" aria-hidden="true">${metricIcon(item.icon)}</div>
        <span class="pill">${esc(item.label)}</span>
      </div>
      <div class="metric-value">${number(item.value)}</div>
      <div class="metric-label">${esc(item.hint)}</div>
    </a>
  `).join('');
  $('#metrics').querySelectorAll('.metric-card').forEach((node, index) => {
    const item = items[index];
    commandCopy.bind(node.querySelector('.pill'), item.label);
    commandCopy.bind(node.querySelector('.metric-label'), item.hint);
    const params = { label: (language) => commandCopy.value(item.label, {}, language) };
    commandCopy.bindAttribute(node, 'aria-label', 'Abrir {label}', params);
    commandCopy.bindAttribute(node, 'title', 'Abrir {label}', params);
  });
  commandCopy.prune();
}

function renderPrioritySummary(counts = {}, pendingPools = []) {
  const critical = number(counts.repairsOpen) + number(counts.notificationsUnread);
  const attention = number(counts.invoicesOpen) + number(counts.messagesUnread) + number(counts.productsLowStock || counts.stockLow);
  const info = Math.max(number(counts.visitsPlanned) - number(counts.visitsDone), 0) + (Array.isArray(pendingPools) ? pendingPools.length : 0);

  const total = critical + attention + info;
  $('#prioritySummary').innerHTML = `
    <a class="item" href="/admin-alerts?priority=critical">
      <div>
        <b>${critical} crítico(s)</b>
        <div class="muted">Decisão imediata necessária</div>
      </div>
      <span class="pill">Abrir</span>
    </a>
    <a class="item" href="/admin-alerts?priority=warning">
      <div>
        <b>${attention} requer(em) atenção</b>
        <div class="muted">Pode impactar operação hoje</div>
      </div>
      <span class="pill">Abrir</span>
    </a>
    <a class="item" href="/admin-alerts">
      <div>
        <b>${info} informativo(s)</b>
        <div class="muted">Monitorização e planeamento</div>
      </div>
      <span class="pill">Ver restantes</span>
    </a>
    <div class="small">${total} prioridade(s) agrupadas sem duplicação.</div>
  `;
  const rows = $('#prioritySummary').querySelectorAll('.item');
  [['{count} crítico(s)', critical, 'Decisão imediata necessária', 'Abrir'],
    ['{count} requer(em) atenção', attention, 'Pode impactar operação hoje', 'Abrir'],
    ['{count} informativo(s)', info, 'Monitorização e planeamento', 'Ver restantes']].forEach(([source, count, hint, action], index) => {
    commandCopy.bind(rows[index].querySelector('b'), source, { count });
    commandCopy.bind(rows[index].querySelector('.muted'), hint);
    commandCopy.bind(rows[index].querySelector('.pill'), action);
  });
  commandCopy.bind($('#prioritySummary > .small'), '{count} prioridade(s) agrupadas sem duplicação.', { count: total });
  commandCopy.prune();
}

function renderOperationDigest(counts = {}, visits = []) {
  const now = Date.now();
  const active = visits.filter((visit) => String(visit.status || '').toUpperCase() === 'IN_PROGRESS').length;
  const done = visits.filter((visit) => ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUÍDA'].includes(String(visit.status || '').toUpperCase())).length;
  const delayed = visits.filter((visit) => {
    const status = String(visit.status || '').toUpperCase();
    if (['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUÍDA'].includes(status)) return false;
    const when = new Date(visit.plannedDate || visit.scheduledAt || visit.createdAt || 0).getTime();
    return Number.isFinite(when) && when < now;
  }).length;
  const nextDecision = Math.max(number(counts.repairsOpen), number(counts.messagesUnread), number(counts.notificationsUnread));

  const digest = document.getElementById('operationDigest');
  if (!digest) return;
  digest.innerHTML = `
    <div class="item"><strong>${delayed}</strong><span>Visitas em atraso</span></div>
    <div class="item"><strong>${active}</strong><span>Em execução</span></div>
    <div class="item"><strong>${number(counts.techniciansActive || counts.techniciansOnField || counts.technicians)}</strong><span>Técnicos disponíveis</span></div>
    <div class="item"><strong>${nextDecision}</strong><span>Próxima decisão</span></div>
  `;
  ['Visitas em atraso', 'Em execução', 'Técnicos disponíveis', 'Próxima decisão'].forEach((source, index) => commandCopy.bind(digest.querySelectorAll('.item span')[index], source));
  commandCopy.prune();
}

function renderTechnicalPropagation(events = []) {
  const root = $('#technicalPropagationList');
  if (!root) return;
  if (!Array.isArray(events) || events.length === 0) {
    root.innerHTML = '<div class="empty cw-v2-state-empty" data-cw-state="empty" role="status" aria-live="polite">Sem eventos técnicos propagados nas últimas horas.</div>';
    commandCopy.bind(root.querySelector('.empty'), 'Sem eventos técnicos propagados nas últimas horas.');
    commandCopy.prune();
    return;
  }

  root.innerHTML = events.slice(0, 10).map((event) => `
    <div class="item">
      <div>
        <b>${esc(event.message || event.component || 'Evento técnico')}</b>
        <div class="muted">Piscina #${esc(event.poolId || '-')} · ${esc(event.type || 'TECHNICAL_EVENT')}</div>
        <div class="small">${formatDate(event.at)}</div>
      </div>
      <a class="btn ghost" href="/admin-pool-technical">Abrir ficha técnica</a>
    </div>
  `).join('');
  root.querySelectorAll('a').forEach(node => commandCopy.bind(node, 'Abrir ficha técnica'));
  commandCopy.prune();
}

function renderStatusStrip(counts = {}, pendingPools = []) {
  const planned = number(counts.visitsPlanned);
  const done = number(counts.visitsDone);
  const repairs = number(counts.repairsOpen);
  const invoices = number(counts.invoicesOpen);
  const messages = number(counts.messagesUnread);
  const notifications = number(counts.notificationsUnread);
  const technicalSheetEvents = number(counts.technicalSheetEvents24h);
  const pending = Array.isArray(pendingPools) ? pendingPools.length : 0;
  const risk = repairs + invoices + messages + notifications + pending;
  const now = new Date();
  const lastUpdate = document.getElementById('lastUpdate');
  const syncState = document.getElementById('syncState');

  $('#statusStrip').innerHTML = `
    <div class="status-mini"><strong>${risk > 0 ? 'Atenção' : 'OK'}</strong><span>Estado geral</span></div>
    <div class="status-mini"><strong>${planned}</strong><span>Visitas ativas</span></div>
    <div class="status-mini"><strong>${risk}</strong><span>Pontos a rever</span></div>
    <div class="status-mini"><strong>${now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</strong><span>Atualizado</span></div>
  `;

  ['Estado geral', 'Visitas ativas', 'Pontos a rever', 'Atualizado'].forEach((source, index) => commandCopy.bind($('#statusStrip').querySelectorAll('.status-mini span')[index], source));
  if (risk > 0) commandCopy.bind($('#statusStrip .status-mini strong'), 'Atenção');
  commandCopy.set(lastUpdate, 'Atualizado às {time}', { time: now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) });
  commandCopy.set(syncState, risk > 0 ? 'Atenção operacional' : 'Sincronizado');

  commandCopy.set($('#metricsHint'), '{done} concluídas · {planned} planeadas · {messages} mensagem(ns) · {notifications} aviso(s) · {events} evento(s) técnicos/24h · {risk} ponto(s) a rever', { done, planned, messages, notifications, events: technicalSheetEvents, risk });
  commandCopy.prune();
}

function morningTone(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'BAD') return 'bad';
  if (value === 'WARN') return 'warn';
  return 'ok';
}

function morningStatusLabel(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'BAD') return 'Critico';
  if (value === 'WARN') return 'Rever';
  return 'OK';
}

function renderMorningCheck(morningCheck = {}) {
  const grid = $('#morningCheckGrid');
  const message = $('#morningCheckMessage');
  const status = $('#morningCheckStatus');
  if (!grid || !message || !status) return;

  const checks = Array.isArray(morningCheck.checks) ? morningCheck.checks : [];
  const counts = morningCheck.counts || {};
  const tone = morningTone(morningCheck.status);

  message.textContent = morningCheck.message || 'Guias, quimicos, agenda, chaves e lembretes ficam aqui antes das equipas sairem.';
  status.innerHTML = `
    <span class="morning-badge ${tone}">${esc(morningCheck.title || morningStatusLabel(morningCheck.status))}</span>
    <span class="morning-badge bad">${number(counts.bad)} critico(s)</span>
    <span class="morning-badge warn">${number(counts.warn)} aviso(s)</span>
    <span class="morning-badge ok">${number(counts.ok)} ok</span>
  `;

  if (!checks.length) {
    grid.innerHTML = '<div class="morning-empty">Sem dados de arranque disponiveis. Atualiza o Centro de Operacoes.</div>';
    return;
  }

  grid.innerHTML = checks.map((check) => {
    const cardTone = morningTone(check.status);
    const details = Array.isArray(check.details) ? check.details.filter(Boolean).slice(0, 4) : [];
    const href = check.href || '#';
    return `
      <a class="morning-card ${cardTone}" href="${esc(href)}">
        <div class="morning-card-top">
          <div>
            <h3>${esc(check.label || 'Verificacao')}</h3>
            <span class="pill">${esc(morningStatusLabel(check.status))}</span>
          </div>
          <div class="morning-count">${number(check.count)}</div>
        </div>
        <div class="morning-message">${esc(check.message || 'Sem mensagem operacional.')}</div>
        <div class="morning-details">
          ${details.length ? details.map((detail) => `<span>${esc(detail)}</span>`).join('') : '<span>Sem detalhe pendente.</span>'}
        </div>
        <div class="morning-actions">
          <span class="small">Clique para resolver</span>
          <span class="morning-link">Abrir</span>
        </div>
      </a>
    `;
  }).join('');
}

function formatDate(value) {
  if (!value) return 'sem data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocal(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function technicianOptions(selectedId) {
  const selected = String(selectedId || '');
  const options = ['<option value="">Sem tecnico</option>'];
  state.technicians.forEach((tech) => {
    options.push(`<option value="${esc(tech.id)}" ${String(tech.id) === selected ? 'selected' : ''}>${esc(tech.name || `Tecnico #${tech.id}`)}</option>`);
  });
  return options.join('');
}

function statusOptions(selectedStatus) {
  const selected = String(selectedStatus || 'PLANNED').toUpperCase();
  return VISIT_STATUSES.map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>${status}</option>`).join('');
}

function ensureVisitEditor() {
  if ($('#visitEditModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="visitEditModal" class="visit-modal" hidden>
      <div class="visit-modal-panel" role="dialog" aria-modal="true" aria-labelledby="visitEditTitle">
        <div class="visit-modal-head">
          <div>
            <h2 id="visitEditTitle">Editar visita</h2>
            <p id="visitEditSubtitle" class="muted">Ajusta a visita sem sair do Centro de Operacoes.</p>
          </div>
          <button id="visitEditClose" type="button" class="btn ghost">Fechar</button>
        </div>
        <form id="visitEditForm" class="visit-edit-form">
          <input id="visitEditId" type="hidden">
          <label>Data e hora
            <input id="visitEditPlannedDate" type="datetime-local">
          </label>
          <label>Tecnico
            <select id="visitEditTechnician"></select>
          </label>
          <label>Estado
            <select id="visitEditStatus"></select>
          </label>
          <label>Motivo / impedimento
            <input id="visitEditReason" placeholder="Ex: cliente pediu adiamento, sem acesso">
          </label>
          <label class="wide">Notas para a equipa
            <textarea id="visitEditNotes" rows="3" placeholder="Notas operacionais da visita"></textarea>
          </label>
          <label class="wide">Notas internas
            <textarea id="visitEditInternalNotes" rows="3" placeholder="Notas internas para administracao"></textarea>
          </label>
          <div id="visitEditStatusBox" class="visit-edit-status"></div>
          <div class="visit-modal-actions">
            <a id="visitEditOpenModule" class="btn ghost" href="/admin-visits">Abrir modulo visitas</a>
            <button type="submit" class="primary">Guardar alteracoes</button>
          </div>
        </form>
      </div>
    </div>
  `);

  $('#visitEditClose')?.addEventListener('click', closeVisitEditor);
  $('#visitEditModal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'visitEditModal') closeVisitEditor();
  });
  $('#visitEditForm')?.addEventListener('submit', saveVisitEdit);
}

function findVisit(id) {
  return (state.dashboard?.nextVisits || []).find((visit) => String(visit.id) === String(id));
}

function openVisitEditor(id) {
  ensureVisitEditor();
  const visit = findVisit(id);
  if (!visit) return;

  $('#visitEditId').value = visit.id;
  $('#visitEditTitle').textContent = `Editar visita #${visit.id}`;
  $('#visitEditSubtitle').textContent = `${visit.pool?.name || 'Piscina'} - ${visit.client?.name || 'Cliente'}`;
  $('#visitEditPlannedDate').value = toDatetimeLocal(visit.plannedDate || visit.date || visit.createdAt);
  $('#visitEditTechnician').innerHTML = technicianOptions(visit.technicianId || visit.technician?.id);
  $('#visitEditStatus').innerHTML = statusOptions(visit.status);
  $('#visitEditReason').value = visit.reason || '';
  $('#visitEditNotes').value = visit.notes || '';
  $('#visitEditInternalNotes').value = visit.internalNotes || '';
  $('#visitEditOpenModule').href = `/admin-visits?visitId=${encodeURIComponent(visit.id)}`;
  $('#visitEditStatusBox').textContent = '';
  $('#visitEditModal').hidden = false;
}

function closeVisitEditor() {
  const modal = $('#visitEditModal');
  if (modal) modal.hidden = true;
}

async function saveVisitEdit(event) {
  event.preventDefault();
  const id = $('#visitEditId')?.value;
  if (!id) return;

  const box = $('#visitEditStatusBox');
  if (box) {
    box.className = 'visit-edit-status';
    box.textContent = 'A guardar visita...';
  }

  try {
    const plannedValue = $('#visitEditPlannedDate')?.value || '';
    const payload = {
      plannedDate: plannedValue ? new Date(plannedValue).toISOString() : undefined,
      technicianId: $('#visitEditTechnician')?.value || null,
      status: $('#visitEditStatus')?.value || 'PLANNED',
      reason: $('#visitEditReason')?.value || '',
      notes: $('#visitEditNotes')?.value || '',
      internalNotes: $('#visitEditInternalNotes')?.value || '',
    };

    const result = await api(`/api/round-planner/visits/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    const visits = state.dashboard?.nextVisits || [];
    const index = visits.findIndex((visit) => String(visit.id) === String(id));
    if (index >= 0) visits[index] = result.visit;

    renderVisits(visits);
    if (box) {
      box.className = 'visit-edit-status ok';
      box.textContent = 'Visita atualizada.';
    }
    setTimeout(closeVisitEditor, 450);
  } catch (error) {
    if (box) {
      box.className = 'visit-edit-status error';
      box.textContent = error.message || 'Erro ao guardar visita.';
    }
  }
}

function renderVisits(visits = []) {
  if (!Array.isArray(visits) || visits.length === 0) {
    $('#todayList').innerHTML = '<div class="empty cw-v2-state-empty" data-cw-state="empty" role="status" aria-live="polite">Sem visitas abertas. Quando existirem rondas/visitas, aparecem aqui.</div>';
    commandCopy.bind($('#todayList').querySelector('.empty'), 'Sem visitas abertas. Quando existirem rondas/visitas, aparecem aqui.');
    commandCopy.prune();
    return;
  }

  $('#todayList').innerHTML = visits.slice(0, 20).map((visit) => `
    <div class="item visit-item">
      <div>
        <b>${esc(visit.pool?.name || 'Piscina')}</b>
        <div class="muted">${esc(visit.client?.name || 'Cliente nao definido')} · ${esc(visit.technician?.name || visit.technicianName || 'sem tecnico')}</div>
        <div class="small">${formatDate(visit.plannedDate || visit.scheduledAt || visit.createdAt)}</div>
      </div>
      <div class="visit-actions">
        <span class="pill">${esc(visit.status || 'SEM ESTADO')}</span>
        <button type="button" class="btn ghost" data-edit-visit="${esc(visit.id)}">Editar</button>
        <a class="btn ghost" href="/admin-visits?visitId=${esc(visit.id)}">Abrir</a>
      </div>
    </div>
  `).join('');
  $('#todayList').querySelectorAll('[data-edit-visit]').forEach(node => commandCopy.bind(node, 'Editar'));
  $('#todayList').querySelectorAll('.visit-actions a').forEach(node => commandCopy.bind(node, 'Abrir'));
  commandCopy.prune();
}

function renderPendingPools(pools = []) {
  if (!Array.isArray(pools) || pools.length === 0) {
    $('#pendingPoolsList').innerHTML = '<div class="empty cw-v2-state-empty" data-cw-state="empty" role="status" aria-live="polite">Sem piscinas pendentes de ronda.</div>';
    commandCopy.bind($('#pendingPoolsList').querySelector('.empty'), 'Sem piscinas pendentes de ronda.');
    commandCopy.prune();
    return;
  }

  $('#pendingPoolsList').innerHTML = pools.slice(0, 20).map((pool) => `
    <div class="item">
      <div>
        <b>${esc(pool.name || 'Piscina')}</b>
        <div class="muted">${esc(pool.client?.name || 'Cliente não definido')} · ${esc(pool.zone || pool.location || 'zona não definida')}</div>
      </div>
      <a class="btn ghost" href="/admin-rounds">Planear</a>
    </div>
  `).join('');
  $('#pendingPoolsList').querySelectorAll('a').forEach(node => commandCopy.bind(node, 'Planear'));
  commandCopy.prune();
}

function renderSummary(data = {}) {
  state.summary = data;
  const counts = data.metrics || {};
  const pendingPools = data.pending?.poolsWithoutRound || [];

  renderMetrics({
    repairsOpen: number(counts.alertsOpen) + number(counts.repairsPending),
    invoicesOpen: number(counts.invoicesPending),
    techniciansActive: number(counts.technicians),
    visitsPlanned: counts.visitsPlanned,
    visitsDone: counts.visitsDone,
    payments: counts.payments,
  });
  renderStatusStrip({
    repairsOpen: number(counts.alertsOpen) + number(counts.repairsPending),
    invoicesOpen: number(counts.invoicesPending),
    messagesUnread: 0,
    notificationsUnread: 0,
    technicalSheetEvents24h: 0,
    visitsPlanned: counts.visitsPlanned,
    visitsDone: counts.visitsDone,
    techniciansActive: number(counts.technicians),
  }, pendingPools);
  renderPrioritySummary({
    repairsOpen: number(counts.alertsOpen) + number(counts.repairsPending),
    invoicesOpen: number(counts.invoicesPending),
    messagesUnread: 0,
    notificationsUnread: 0,
    stockLow: 0,
    visitsPlanned: counts.visitsPlanned,
    visitsDone: counts.visitsDone,
  }, pendingPools);

  commandCopy.set($('#statusBox'), 'Resumo carregado com sucesso. {clients} cliente(s), {pools} piscina(s), {technicians} técnico(s).', { clients: number(counts.clients), pools: number(counts.pools), technicians: number(counts.technicians) });
  setLoadState('summary', 'ready');
}

function renderCore(data = {}) {
  state.dashboard = data;
  const counts = data.counts || {};
  const pendingPools = data.pendingPoolsWithoutRound || [];
  const visits = data.nextVisits || [];

  renderOperationDigest(counts, visits);
  renderTechnicalPropagation(data.technicalPropagation || []);
  renderMorningCheck(data.morningCheck || {});
  renderVisits(visits);
  renderPendingPools(pendingPools);

  const unreadMessages = number(counts.messagesUnread);
  if (unreadMessages > 0) {
    $('#statusBox').innerHTML = `Atenção: existem <b>${unreadMessages}</b> mensagem(ns) de clientes por responder. <a class="btn ghost" href="/chat?filter=unread" style="margin-left:8px">Abrir mensagens</a>`;
    commandCopy.bindNode($('#statusBox').firstChild, 'Atenção: existem ');
    commandCopy.bindNode($('#statusBox').childNodes[2], ' mensagem(ns) de clientes por responder. ');
    commandCopy.bind($('#statusBox a'), 'Abrir mensagens');
    commandCopy.prune();
    setLoadState('core', 'ready');
    return;
  }

  commandCopy.set($('#statusBox'), 'Sistema carregado com sucesso. {clients} cliente(s), {pools} piscina(s), {technicians} técnico(s).', { clients: number(counts.clients), pools: number(counts.pools), technicians: number(counts.technicians) });
  setLoadState('core', 'ready');
}

async function load() {
  const runId = ++loadGeneration;
  abortActiveLoads();

  const summaryController = trackLoadController(new AbortController());
  const coreController = trackLoadController(new AbortController());
  const techniciansController = trackLoadController(new AbortController());

  setLoadState('summary', 'loading');
  setLoadState('core', 'loading');
  setLoadState('technicians', 'loading');
  renderSummaryLoading();
  renderCoreLoading();

  const summaryPromise = apiWithTimeout('/api/operational-flow/summary', {
    timeoutMs: SUMMARY_TIMEOUT_MS,
    signal: summaryController.signal,
  }).then((data) => {
    if (runId !== loadGeneration) return;
    renderSummary(data || {});
  }).catch((error) => {
    if (runId !== loadGeneration || error?.code === 'ABORTED') return;
    console.error(error);
    setLoadState('summary', 'error');
    renderSummaryError(error);
  }).finally(() => releaseLoadController(summaryController));

  const corePromise = apiWithTimeout('/dashboard', {
    timeoutMs: CORE_TIMEOUT_MS,
    signal: coreController.signal,
  }).then((data) => {
    if (runId !== loadGeneration) return;
    renderCore(data || {});
  }).catch((error) => {
    if (runId !== loadGeneration || error?.code === 'ABORTED') return;
    console.error(error);
    setLoadState('core', 'error');
    renderCoreError(error);
  }).finally(() => releaseLoadController(coreController));

  const techniciansPromise = apiWithTimeout('/api/technicians', {
    timeoutMs: TECHNICIANS_TIMEOUT_MS,
    signal: techniciansController.signal,
  }).then((data) => {
    if (runId !== loadGeneration) return;
    state.technicians = Array.isArray(data) ? data : (data.technicians || []);
    setLoadState('technicians', 'ready');
  }).catch((error) => {
    if (runId !== loadGeneration || error?.code === 'ABORTED') return;
    console.error(error);
    state.technicians = [];
    setLoadState('technicians', 'error');
  }).finally(() => releaseLoadController(techniciansController));

  await Promise.allSettled([summaryPromise, corePromise, techniciansPromise]);
  if (runId !== loadGeneration) return;
  refreshLoadStatus();
}

const refreshBtn = $('#refreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', load);

document.addEventListener('click', (event) => {
  const retry = event.target.closest('[data-dashboard-retry]');
  if (retry) {
    event.preventDefault();
    load();
    return;
  }

  const continueButton = event.target.closest('[data-dashboard-continue]');
  if (continueButton) {
    event.preventDefault();
    const group = continueButton.dataset.dashboardContinue;
    if (group === 'summary') renderSummaryFallback();
    if (group === 'core') renderCoreFallback();
    setLoadState(group, 'idle');
  }
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-visit]');
  if (button) openVisitEditor(button.dataset.editVisit);
});

window.addEventListener('pagehide', abortActiveLoads);
window.addEventListener('beforeunload', abortActiveLoads);

document.addEventListener('DOMContentLoaded', load);
