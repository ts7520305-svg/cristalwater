const API = "/api";
const socket = window.io ? io("/") : { emit() {}, on() {} };
const queryClientId = new URLSearchParams(location.search).get("clientId");
const queryLanguage = new URLSearchParams(location.search).get("lang") || new URLSearchParams(location.search).get("language");
let clientId = Number(queryClientId || localStorage.getItem("cw_client_id") || localStorage.getItem("clientId") || 0);
const el = (id) => document.getElementById(id);
let adminOnline = false;
let portalLanguage = normalizeLanguage(queryLanguage || localStorage.getItem("cw_language") || localStorage.getItem("cw_client_lang") || navigator.language || "pt");
let currentPaymentInstructions = null;
let adminClients = [];
let currentServiceHistory = [];
let serviceHistoryToolsReady = false;
let lastPortalSnapshot = {};
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  safeError: (err, fallback) => (err && err.message) || fallback,
};

function portalAuthHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const COPY = {
  pt: {
    brandPortal: "Portal do Cliente",
    logout: "Sair",
    adminBackClients: "Voltar aos clientes",
    portalTitle: "Portal Cliente",
    clientDefault: "Cliente",
    portalIntro: "Acompanhe visitas, piscinas, mensagens e pagamentos num painel simples e transparente.",
    loadingState: "A carregar estado...",
    loadError: "Nao foi possivel carregar dados",
    noDataStatus: "Sem dados do cliente.",
    poolsJacuzzis: "Piscinas / jacuzzis",
    financialState: "Estado financeiro",
    nextVisitMetric: "Proxima visita",
    quickAccess: "Acesso rapido",
    clientRole: "Cliente",
    message: "Mensagem",
    agenda: "Agenda",
    services: "Servicos",
    payments: "Pagamentos",
    paymentReference: "Referencia de pagamento",
    paymentInstructionShort: "Ao pagar, indique sempre esta referencia.",
    paymentInstructionFull: "Ao pagar, indique sempre esta referencia e avise a administracao pelo portal ou WhatsApp.",
    amountPlaceholder: "Valor pago / transferido",
    notePlaceholder: "Nota ou referencia do comprovativo",
    notifyPayment: "Avisar pagamento",
    whatsapp: "WhatsApp",
    whatsappNoClient: "Escolha ou entre como cliente antes de abrir o WhatsApp.",
    whatsappChooseContact: "Abre o WhatsApp com a mensagem pronta para enviar.",
    whatsappDirect: "Abre o WhatsApp diretamente para a Cristal Water.",
    methodTransfer: "Transferencia",
    methodMbway: "MBWay",
    methodCash: "Dinheiro",
    methodAtm: "Multibanco",
    methodOther: "Outro",
    paymentHelp: "<b>Instrucoes de pagamento:</b>Use sempre a referencia acima no pagamento. Depois clique em Avisar pagamento ou envie WhatsApp com a referencia e o comprovativo. Se nao conseguir usar o portal, contacte a Cristal Water para registarmos manualmente.",
    scheduleTitle: "Agendamento das piscinas",
    schedulePill: "PT",
    noSchedules: "Ainda nao existem agendamentos ativos para apresentar.",
    scheduleBackend: "Assim que o backend estiver ligado, o agendamento aparece aqui.",
    poolsTitle: "Piscinas",
    maintenancePill: "Manutencao",
    noPools: "Ainda nao existem piscinas associadas a este cliente.",
    poolsBackend: "Selecione um cliente acima para ver as piscinas.",
    summaryTitle: "Resumo transparente",
    account: "Conta",
    summaryBackend: "Assim que o backend estiver ligado, o resumo aparece aqui.",
    servicesTitle: "Servicos feitos",
    historyPill: "Historico",
    noServices: "Ainda nao existem servicos registados.",
    servicesUnavailable: "Servicos indisponiveis neste momento.",
    historySearchPlaceholder: "Pesquisar por piscina, tecnico, produto ou nota",
    historyAllPools: "Todas as piscinas",
    historyAllPeriods: "Todos",
    historyByDay: "Dia",
    historyByWeek: "Semana",
    historyByMonth: "Mes",
    historyByYear: "Ano",
    historyReferenceDate: "Data de referencia",
    historyDownload: "Download",
    historyFilteredCount: "servico(s) filtrado(s)",
    historyNoFiltered: "Nenhum servico encontrado para estes filtros.",
    billingTitle: "Faturacao e pagamentos",
    noInvoices: "Ainda nao existem faturas ou pagamentos registados.",
    billingUnavailable: "Faturacao indisponivel neste momento.",
    messagesTitle: "Mensagens com a administracao",
    checking: "A verificar",
    messagePlaceholder: "Escreva a sua mensagem...",
    attachment: "Anexo",
    send: "Enviar",
    adminOnline: "Administracao online",
    adminUnavailable: "Administracao indisponivel no momento",
    adminTyping: "Administracao esta a escrever...",
    noMessages: "Ainda nao existem mensagens.",
    messagesUnavailable: "Mensagens indisponiveis neste momento.",
    openAttachment: "Abrir anexo",
    statusDone: "Concluido",
    statusPlanned: "Planeado",
    statusPending: "Pendente",
    statusPartial: "Parcial",
    statusPaid: "Pago",
    statusOverdue: "Em atraso",
    statusNotDone: "Nao realizado",
    confirm: "A confirmar",
    operationalState: "Estado operacional",
    registeredServices: "servico(s) registado(s)",
    lastService: "Ultimo servico",
    paymentSummary: "Pagamentos",
    openAmount: "Valor em aberto",
    paidInPeriod: "Pago no periodo",
    positiveCredit: "Credito positivo",
    noPendingValues: "Sem valores pendentes registados.",
    scheduleDelayedHint: "Estamos atrasados e iremos assim que possivel.",
    schedulePlannedHint: "Proxima manutencao planeada.",
    accountPendingHint: "documento(s) por regularizar.",
    serviceHistoryHint: "Historico autorizado disponivel.",
    servicesFirstVisitHint: "Servicos aparecem aqui apos a primeira visita.",
    contactHint: "Canal privado com a administracao.",
    contact: "Contacto",
    upToDate: "Em dia",
    updatedState: "Estado atualizado",
    noPoolStatus: "Sem piscina associada",
    poolFallback: "Piscina",
    zoneUndefined: "Zona nao definida",
    active: "Ativa",
    calendarLabel: "Agenda",
    noConsumption: "Sem consumo registado",
    productFallback: "Produto",
    issued: "emitida",
    invoiceFallback: "Fatura",
    paid: "Pago",
    open: "Em aberto",
    paymentFallback: "Pagamento",
    invoiceLineMonthly: "Mensalidade",
    paymentNoticeGreeting: "Ola Cristal Water.",
    paymentNoticeText: "Informo que efetuei pagamento.",
    paymentNoticeRef: "Referencia cliente",
    paymentNoticeAmount: "Valor",
    paymentNoticeMethod: "Metodo",
    paymentNoticeNote: "Nota/comprovativo",
    clientNotIdentified: "Cliente nao identificado.",
    paymentNoticeFailed: "Nao foi possivel comunicar o pagamento.",
    paymentNoticeSuccess: "Pagamento comunicado com a referencia",
    sendMessageError: "Erro ao enviar mensagem.",
    adminSwitcherTitle: "Ver portal de cliente",
    adminSwitcherHelp: "Area de administrador. Escolha o cliente para confirmar agenda, servicos, mensagens e conta corrente.",
    adminChooseClientMeta: "Escolha um cliente para ver o portal.",
    adminClientSearch: "Pesquisar por nome, telefone, email, zona ou referencia",
    adminChooseClient: "Escolher cliente...",
    adminClientFile: "Ficha cliente",
    adminAccount: "Conta corrente",
    adminListFailed: "Nao foi possivel carregar a lista de clientes.",
    adminChooseTitle: "Escolha um cliente",
    adminMode: "Modo administrador",
    adminSelectPools: "Selecione um cliente acima para ver as piscinas.",
    adminSelectSchedule: "Selecione um cliente para ver o agendamento.",
    adminSelectSummary: "Selecione um cliente para ver o resumo da conta.",
    adminSelectServices: "Selecione um cliente para ver os servicos feitos.",
    adminSelectBilling: "Selecione um cliente para ver a faturacao.",
    adminSelectMessages: "Selecione um cliente para ver mensagens.",
  },
  en: {
    brandPortal: "Client Portal",
    logout: "Sign out",
    adminBackClients: "Back to clients",
    portalTitle: "Client Portal",
    clientDefault: "Client",
    portalIntro: "Follow visits, pools, messages and payments in one clear client area.",
    loadingState: "Loading status...",
    loadError: "Unable to load data",
    noDataStatus: "No client data.",
    poolsJacuzzis: "Pools / jacuzzis",
    financialState: "Financial status",
    nextVisitMetric: "Next visit",
    quickAccess: "Quick access",
    clientRole: "Client",
    message: "Message",
    agenda: "Schedule",
    services: "Services",
    payments: "Payments",
    paymentReference: "Payment reference",
    paymentInstructionShort: "Always use this reference when paying.",
    paymentInstructionFull: "Always use this reference when paying and notify the office through the portal or WhatsApp.",
    amountPlaceholder: "Amount paid / transferred",
    notePlaceholder: "Note or proof reference",
    notifyPayment: "Payment notice",
    whatsapp: "WhatsApp",
    whatsappNoClient: "Choose or sign in as a client before opening WhatsApp.",
    whatsappChooseContact: "Opens WhatsApp with the message ready to send.",
    whatsappDirect: "Opens WhatsApp directly to Cristal Water.",
    methodTransfer: "Bank transfer",
    methodMbway: "MBWay",
    methodCash: "Cash",
    methodAtm: "ATM reference",
    methodOther: "Other",
    paymentHelp: "<b>Payment instructions:</b>Always use the reference above when paying. Then click Payment notice or send a WhatsApp message with the reference and proof of payment. If you cannot use the portal, contact Cristal Water so we can register it manually.",
    scheduleTitle: "Pool schedule",
    schedulePill: "EN",
    noSchedules: "There are no active schedules to show yet.",
    scheduleBackend: "The schedule will appear here as soon as the backend is connected.",
    poolsTitle: "Pools",
    maintenancePill: "Maintenance",
    noPools: "There are no pools linked to this client yet.",
    poolsBackend: "Select a client above to see their pools.",
    summaryTitle: "Clear summary",
    account: "Account",
    summaryBackend: "The account summary will appear here as soon as the backend is connected.",
    servicesTitle: "Completed services",
    historyPill: "History",
    noServices: "There are no registered services yet.",
    servicesUnavailable: "Services are unavailable at the moment.",
    historySearchPlaceholder: "Search by pool, technician, product or note",
    historyAllPools: "All pools",
    historyAllPeriods: "All",
    historyByDay: "Day",
    historyByWeek: "Week",
    historyByMonth: "Month",
    historyByYear: "Year",
    historyReferenceDate: "Reference date",
    historyDownload: "Download",
    historyFilteredCount: "filtered service(s)",
    historyNoFiltered: "No services found for these filters.",
    billingTitle: "Billing and payments",
    noInvoices: "There are no invoices or payments registered yet.",
    billingUnavailable: "Billing is unavailable at the moment.",
    messagesTitle: "Messages with administration",
    checking: "Checking",
    messagePlaceholder: "Write your message...",
    attachment: "Attachment",
    send: "Send",
    adminOnline: "Administration online",
    adminUnavailable: "Administration unavailable right now",
    adminTyping: "Administration is typing...",
    noMessages: "There are no messages yet.",
    messagesUnavailable: "Messages are unavailable at the moment.",
    openAttachment: "Open attachment",
    statusDone: "Completed",
    statusPlanned: "Planned",
    statusPending: "Pending",
    statusPartial: "Partial",
    statusPaid: "Paid",
    statusOverdue: "Overdue",
    statusNotDone: "Not completed",
    confirm: "To confirm",
    operationalState: "Operational status",
    registeredServices: "registered service(s)",
    lastService: "Last service",
    paymentSummary: "Payments",
    openAmount: "Outstanding amount",
    paidInPeriod: "Paid in period",
    positiveCredit: "Positive credit",
    noPendingValues: "No outstanding amounts registered.",
    scheduleDelayedHint: "We are running late and will attend as soon as possible.",
    schedulePlannedHint: "Next maintenance planned.",
    accountPendingHint: "document(s) to settle.",
    serviceHistoryHint: "Authorised history available.",
    servicesFirstVisitHint: "Services will appear here after the first visit.",
    contactHint: "Private channel with administration.",
    contact: "Contact",
    upToDate: "Up to date",
    updatedState: "Status updated",
    noPoolStatus: "No pool linked",
    poolFallback: "Pool",
    zoneUndefined: "Zone not defined",
    active: "Active",
    calendarLabel: "Schedule",
    noConsumption: "No consumption registered",
    productFallback: "Product",
    issued: "issued",
    invoiceFallback: "Invoice",
    paid: "Paid",
    open: "Open",
    paymentFallback: "Payment",
    invoiceLineMonthly: "Monthly fee",
    paymentNoticeGreeting: "Hello Cristal Water.",
    paymentNoticeText: "I confirm that I have made a payment.",
    paymentNoticeRef: "Client reference",
    paymentNoticeAmount: "Amount",
    paymentNoticeMethod: "Method",
    paymentNoticeNote: "Note/proof",
    clientNotIdentified: "Client not identified.",
    paymentNoticeFailed: "Unable to communicate the payment.",
    paymentNoticeSuccess: "Payment notice sent with reference",
    sendMessageError: "Error sending message.",
    adminSwitcherTitle: "View client portal",
    adminSwitcherHelp: "Administrator area. Choose a client to confirm schedule, services, messages and account balance.",
    adminChooseClientMeta: "Choose a client to view the portal.",
    adminClientSearch: "Search by name, phone, email, zone or reference",
    adminChooseClient: "Choose client...",
    adminClientFile: "Client file",
    adminAccount: "Account",
    adminListFailed: "Unable to load the client list.",
    adminChooseTitle: "Choose a client",
    adminMode: "Administrator mode",
    adminSelectPools: "Select a client above to see their pools.",
    adminSelectSchedule: "Select a client to see the schedule.",
    adminSelectSummary: "Select a client to see the account summary.",
    adminSelectServices: "Select a client to see completed services.",
    adminSelectBilling: "Select a client to see billing.",
    adminSelectMessages: "Select a client to see messages.",
  },
  fr: {
    brandPortal: "Portail Client",
    logout: "Sortir",
    adminBackClients: "Retour aux clients",
    portalTitle: "Portail Client",
    clientDefault: "Client",
    portalIntro: "Suivez les visites, piscines, messages et paiements dans un espace clair.",
    loadingState: "Chargement de l'etat...",
    loadError: "Impossible de charger les donnees",
    noDataStatus: "Aucune donnee client.",
    poolsJacuzzis: "Piscines / jacuzzis",
    financialState: "Etat financier",
    nextVisitMetric: "Prochaine visite",
    quickAccess: "Acces rapide",
    clientRole: "Client",
    message: "Message",
    agenda: "Planning",
    services: "Services",
    payments: "Paiements",
    paymentReference: "Reference de paiement",
    paymentInstructionShort: "Utilisez toujours cette reference lors du paiement.",
    paymentInstructionFull: "Utilisez toujours cette reference lors du paiement et prevenez l'administration via le portail ou WhatsApp.",
    amountPlaceholder: "Montant paye / transfere",
    notePlaceholder: "Note ou reference du justificatif",
    notifyPayment: "Avis de paiement",
    whatsapp: "WhatsApp",
    whatsappNoClient: "Choisissez ou connectez-vous comme client avant d'ouvrir WhatsApp.",
    whatsappChooseContact: "Ouvre WhatsApp avec le message pret a envoyer.",
    whatsappDirect: "Ouvre WhatsApp directement vers Cristal Water.",
    methodTransfer: "Virement",
    methodMbway: "MBWay",
    methodCash: "Especes",
    methodAtm: "Multibanco",
    methodOther: "Autre",
    paymentHelp: "<b>Instructions de paiement:</b>Utilisez toujours la reference ci-dessus lors du paiement. Ensuite, cliquez sur Avis de paiement ou envoyez un WhatsApp avec la reference et le justificatif. Si vous ne pouvez pas utiliser le portail, contactez Cristal Water afin que nous l'enregistrions manuellement.",
    scheduleTitle: "Planning des piscines",
    schedulePill: "FR",
    noSchedules: "Aucune planification active a afficher pour le moment.",
    scheduleBackend: "Le planning apparaitra ici des que le backend sera connecte.",
    poolsTitle: "Piscines",
    maintenancePill: "Entretien",
    noPools: "Aucune piscine n'est encore liee a ce client.",
    poolsBackend: "Selectionnez un client ci-dessus pour voir ses piscines.",
    summaryTitle: "Resume clair",
    account: "Compte",
    summaryBackend: "Le resume du compte apparaitra ici des que le backend sera connecte.",
    servicesTitle: "Services realises",
    historyPill: "Historique",
    noServices: "Aucun service n'est encore enregistre.",
    servicesUnavailable: "Services indisponibles pour le moment.",
    historySearchPlaceholder: "Rechercher par piscine, technicien, produit ou note",
    historyAllPools: "Toutes les piscines",
    historyAllPeriods: "Tous",
    historyByDay: "Jour",
    historyByWeek: "Semaine",
    historyByMonth: "Mois",
    historyByYear: "Annee",
    historyReferenceDate: "Date de reference",
    historyDownload: "Telecharger",
    historyFilteredCount: "service(s) filtre(s)",
    historyNoFiltered: "Aucun service trouve pour ces filtres.",
    billingTitle: "Facturation et paiements",
    noInvoices: "Aucune facture ou paiement n'est encore enregistre.",
    billingUnavailable: "Facturation indisponible pour le moment.",
    messagesTitle: "Messages avec l'administration",
    checking: "Verification",
    messagePlaceholder: "Ecrivez votre message...",
    attachment: "Piece jointe",
    send: "Envoyer",
    adminOnline: "Administration en ligne",
    adminUnavailable: "Administration indisponible pour le moment",
    adminTyping: "L'administration ecrit...",
    noMessages: "Il n'y a pas encore de messages.",
    messagesUnavailable: "Messages indisponibles pour le moment.",
    openAttachment: "Ouvrir la piece jointe",
    statusDone: "Termine",
    statusPlanned: "Planifie",
    statusPending: "En attente",
    statusPartial: "Partiel",
    statusPaid: "Paye",
    statusOverdue: "En retard",
    statusNotDone: "Non realise",
    confirm: "A confirmer",
    operationalState: "Etat operationnel",
    registeredServices: "service(s) enregistre(s)",
    lastService: "Dernier service",
    paymentSummary: "Paiements",
    openAmount: "Montant ouvert",
    paidInPeriod: "Paye sur la periode",
    positiveCredit: "Credit positif",
    noPendingValues: "Aucun montant ouvert enregistre.",
    scheduleDelayedHint: "Nous sommes en retard et interviendrons des que possible.",
    schedulePlannedHint: "Prochain entretien planifie.",
    accountPendingHint: "document(s) a regulariser.",
    serviceHistoryHint: "Historique autorise disponible.",
    servicesFirstVisitHint: "Les services apparaitront ici apres la premiere visite.",
    contactHint: "Canal prive avec l'administration.",
    contact: "Contact",
    upToDate: "A jour",
    updatedState: "Etat mis a jour",
    noPoolStatus: "Aucune piscine liee",
    poolFallback: "Piscine",
    zoneUndefined: "Zone non definie",
    active: "Active",
    calendarLabel: "Planning",
    noConsumption: "Aucune consommation enregistree",
    productFallback: "Produit",
    issued: "emise",
    invoiceFallback: "Facture",
    paid: "Paye",
    open: "Ouvert",
    paymentFallback: "Paiement",
    invoiceLineMonthly: "Forfait mensuel",
    paymentNoticeGreeting: "Bonjour Cristal Water.",
    paymentNoticeText: "Je confirme avoir effectue un paiement.",
    paymentNoticeRef: "Reference client",
    paymentNoticeAmount: "Montant",
    paymentNoticeMethod: "Methode",
    paymentNoticeNote: "Note/justificatif",
    clientNotIdentified: "Client non identifie.",
    paymentNoticeFailed: "Impossible de communiquer le paiement.",
    paymentNoticeSuccess: "Avis de paiement envoye avec la reference",
    sendMessageError: "Erreur lors de l'envoi du message.",
    adminSwitcherTitle: "Voir le portail client",
    adminSwitcherHelp: "Zone administrateur. Choisissez un client pour verifier planning, services, messages et compte.",
    adminChooseClientMeta: "Choisissez un client pour voir le portail.",
    adminClientSearch: "Rechercher par nom, telephone, email, zone ou reference",
    adminChooseClient: "Choisir client...",
    adminClientFile: "Fiche client",
    adminAccount: "Compte",
    adminListFailed: "Impossible de charger la liste des clients.",
    adminChooseTitle: "Choisissez un client",
    adminMode: "Mode administrateur",
    adminSelectPools: "Selectionnez un client ci-dessus pour voir les piscines.",
    adminSelectSchedule: "Selectionnez un client pour voir le planning.",
    adminSelectSummary: "Selectionnez un client pour voir le resume du compte.",
    adminSelectServices: "Selectionnez un client pour voir les services realises.",
    adminSelectBilling: "Selectionnez un client pour voir la facturation.",
    adminSelectMessages: "Selectionnez un client pour voir les messages.",
  },
  de: {
    brandPortal: "Kundenportal",
    logout: "Abmelden",
    adminBackClients: "Zurueck zu Kunden",
    portalTitle: "Kundenportal",
    clientDefault: "Kunde",
    portalIntro: "Verfolgen Sie Besuche, Pools, Nachrichten und Zahlungen in einem klaren Kundenbereich.",
    loadingState: "Status wird geladen...",
    loadError: "Daten konnten nicht geladen werden",
    noDataStatus: "Keine Kundendaten.",
    poolsJacuzzis: "Pools / Whirlpools",
    financialState: "Finanzstatus",
    nextVisitMetric: "Naechster Besuch",
    quickAccess: "Schnellzugriff",
    clientRole: "Kunde",
    message: "Nachricht",
    agenda: "Termine",
    services: "Services",
    payments: "Zahlungen",
    paymentReference: "Zahlungsreferenz",
    paymentInstructionShort: "Verwenden Sie bei der Zahlung immer diese Referenz.",
    paymentInstructionFull: "Verwenden Sie bei der Zahlung immer diese Referenz und informieren Sie die Verwaltung ueber Portal oder WhatsApp.",
    amountPlaceholder: "Bezahlter / ueberwiesener Betrag",
    notePlaceholder: "Notiz oder Belegreferenz",
    notifyPayment: "Zahlung melden",
    whatsapp: "WhatsApp",
    whatsappNoClient: "Waehlen Sie einen Kunden oder melden Sie sich als Kunde an, bevor Sie WhatsApp oeffnen.",
    whatsappChooseContact: "Oeffnet WhatsApp mit einer vorbereiteten Nachricht.",
    whatsappDirect: "Oeffnet WhatsApp direkt zu Cristal Water.",
    methodTransfer: "Bankueberweisung",
    methodMbway: "MBWay",
    methodCash: "Bar",
    methodAtm: "Multibanco",
    methodOther: "Andere",
    paymentHelp: "<b>Zahlungsanweisungen:</b> Verwenden Sie bei der Zahlung immer die oben genannte Referenz. Klicken Sie danach auf Zahlung melden oder senden Sie eine WhatsApp-Nachricht mit Referenz und Beleg. Wenn Sie das Portal nicht nutzen koennen, kontaktieren Sie Cristal Water, damit wir die Zahlung manuell erfassen koennen.",
    scheduleTitle: "Pool-Termine",
    schedulePill: "DE",
    noSchedules: "Es gibt noch keine aktiven Termine.",
    scheduleBackend: "Die Termine erscheinen hier, sobald das Backend verbunden ist.",
    poolsTitle: "Pools",
    maintenancePill: "Wartung",
    noPools: "Es sind noch keine Pools mit diesem Kunden verknuepft.",
    poolsBackend: "Waehlen Sie oben einen Kunden aus, um die Pools zu sehen.",
    summaryTitle: "Klare Uebersicht",
    account: "Konto",
    summaryBackend: "Die Kontouebersicht erscheint hier, sobald das Backend verbunden ist.",
    servicesTitle: "Abgeschlossene Services",
    historyPill: "Verlauf",
    noServices: "Es sind noch keine Services registriert.",
    servicesUnavailable: "Services sind derzeit nicht verfuegbar.",
    historySearchPlaceholder: "Nach Pool, Techniker, Produkt oder Notiz suchen",
    historyAllPools: "Alle Pools",
    historyAllPeriods: "Alle",
    historyByDay: "Tag",
    historyByWeek: "Woche",
    historyByMonth: "Monat",
    historyByYear: "Jahr",
    historyReferenceDate: "Referenzdatum",
    historyDownload: "Download",
    historyFilteredCount: "gefilterte(r) Service(s)",
    historyNoFiltered: "Keine Services fuer diese Filter gefunden.",
    billingTitle: "Rechnungen und Zahlungen",
    noInvoices: "Es sind noch keine Rechnungen oder Zahlungen registriert.",
    billingUnavailable: "Rechnungen sind derzeit nicht verfuegbar.",
    messagesTitle: "Nachrichten mit Verwaltung",
    checking: "Pruefung",
    messagePlaceholder: "Schreiben Sie Ihre Nachricht...",
    attachment: "Anhang",
    send: "Senden",
    adminOnline: "Verwaltung online",
    adminUnavailable: "Verwaltung derzeit nicht verfuegbar",
    adminTyping: "Verwaltung schreibt...",
    noMessages: "Es gibt noch keine Nachrichten.",
    messagesUnavailable: "Nachrichten sind derzeit nicht verfuegbar.",
    openAttachment: "Anhang oeffnen",
    statusDone: "Abgeschlossen",
    statusPlanned: "Geplant",
    statusPending: "Ausstehend",
    statusPartial: "Teilweise",
    statusPaid: "Bezahlt",
    statusOverdue: "Ueberfaellig",
    statusNotDone: "Nicht erledigt",
    confirm: "Zu bestaetigen",
    operationalState: "Betriebsstatus",
    registeredServices: "registrierte(r) Service(s)",
    lastService: "Letzter Service",
    paymentSummary: "Zahlungen",
    openAmount: "Offener Betrag",
    paidInPeriod: "Im Zeitraum bezahlt",
    positiveCredit: "Positives Guthaben",
    noPendingValues: "Keine offenen Betraege registriert.",
    scheduleDelayedHint: "Wir sind verspaetet und kommen so bald wie moeglich.",
    schedulePlannedHint: "Naechste Wartung geplant.",
    accountPendingHint: "Dokument(e) offen.",
    serviceHistoryHint: "Autorisierter Verlauf verfuegbar.",
    servicesFirstVisitHint: "Services erscheinen hier nach dem ersten Besuch.",
    contactHint: "Privater Kanal mit der Verwaltung.",
    contact: "Kontakt",
    upToDate: "Aktuell",
    updatedState: "Status aktualisiert",
    noPoolStatus: "Kein Pool verknuepft",
    poolFallback: "Pool",
    zoneUndefined: "Zone nicht definiert",
    active: "Aktiv",
    calendarLabel: "Termine",
    noConsumption: "Kein Verbrauch registriert",
    productFallback: "Produkt",
    issued: "ausgestellt",
    invoiceFallback: "Rechnung",
    paid: "Bezahlt",
    open: "Offen",
    paymentFallback: "Zahlung",
    invoiceLineMonthly: "Monatsgebuhr",
    paymentNoticeGreeting: "Hallo Cristal Water.",
    paymentNoticeText: "Ich bestaetige, dass ich eine Zahlung vorgenommen habe.",
    paymentNoticeRef: "Kundenreferenz",
    paymentNoticeAmount: "Betrag",
    paymentNoticeMethod: "Methode",
    paymentNoticeNote: "Notiz/Beleg",
    clientNotIdentified: "Kunde nicht identifiziert.",
    paymentNoticeFailed: "Zahlung konnte nicht gemeldet werden.",
    paymentNoticeSuccess: "Zahlungsmeldung gesendet mit Referenz",
    sendMessageError: "Fehler beim Senden der Nachricht.",
    adminSwitcherTitle: "Kundenportal anzeigen",
    adminSwitcherHelp: "Administratorbereich. Waehlen Sie einen Kunden, um Termine, Services, Nachrichten und Konto zu pruefen.",
    adminChooseClientMeta: "Waehlen Sie einen Kunden, um das Portal zu sehen.",
    adminClientSearch: "Suche nach Name, Telefon, E-Mail, Zone oder Referenz",
    adminChooseClient: "Kunde waehlen...",
    adminClientFile: "Kundendatei",
    adminAccount: "Konto",
    adminListFailed: "Kundenliste konnte nicht geladen werden.",
    adminChooseTitle: "Kunde waehlen",
    adminMode: "Administratormodus",
    adminSelectPools: "Waehlen Sie oben einen Kunden aus, um die Pools zu sehen.",
    adminSelectSchedule: "Waehlen Sie einen Kunden, um die Termine zu sehen.",
    adminSelectSummary: "Waehlen Sie einen Kunden, um die Kontouebersicht zu sehen.",
    adminSelectServices: "Waehlen Sie einen Kunden, um abgeschlossene Services zu sehen.",
    adminSelectBilling: "Waehlen Sie einen Kunden, um Rechnungen zu sehen.",
    adminSelectMessages: "Waehlen Sie einen Kunden, um Nachrichten zu sehen.",
  },
};

function logout() {
  if (isAdminUser()) {
    location.href = "/admin-clients";
    return;
  }
  localStorage.removeItem("cw_client_id");
  localStorage.removeItem("clientId");
  location.href = "/client-login";
}

window.logout = logout;

function normalizeLanguage(value) {
  const lang = String(value || "pt").trim().toLowerCase().slice(0, 2);
  return ["pt", "en", "fr", "de"].includes(lang) ? lang : "pt";
}

function preferredLanguage(serverLanguage) {
  return normalizeLanguage(
    queryLanguage
    || localStorage.getItem("cw_language")
    || serverLanguage
    || localStorage.getItem("cw_client_lang")
    || portalLanguage
    || navigator.language
    || "pt"
  );
}

function globalShellLanguage() {
  return normalizeLanguage(
    queryLanguage
    || document.getElementById("cwLanguageSelect")?.value
    || document.body?.dataset?.cwLanguage
    || localStorage.getItem("cw_language")
    || portalLanguage
  );
}

function parseJsonStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch (_) {
    return {};
  }
}

function currentUser() {
  return parseJsonStorage("cristalwater_user").role ? parseJsonStorage("cristalwater_user") : parseJsonStorage("user");
}

function isAdminUser() {
  return String(currentUser().role || "").toUpperCase() === "ADMIN";
}

function paymentReference(clientIdValue) {
  return `CW-${String(Number(clientIdValue || 0)).padStart(6, "0")}`;
}

function localeForLanguage() {
  if (portalLanguage === "en") return "en-GB";
  if (portalLanguage === "fr") return "fr-FR";
  if (portalLanguage === "de") return "de-DE";
  return "pt-PT";
}

function copy(key) {
  return COPY[portalLanguage]?.[key] || COPY.pt[key] || key;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));
}

function fmtDate(value) {
  if (!value) return copy("confirm");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy("confirm");
  return date.toLocaleDateString(localeForLanguage(), { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(value) {
  if (!value) return copy("confirm");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy("confirm");
  return date.toLocaleString(localeForLanguage(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value) {
  return Number(value || 0).toLocaleString(localeForLanguage(), { style: "currency", currency: "EUR" });
}

function statusText(value) {
  const status = String(value || "").toUpperCase();
  const labels = {
    DONE: copy("statusDone"),
    COMPLETED: copy("statusDone"),
    PLANNED: copy("statusPlanned"),
    PENDING: copy("statusPending"),
    PARTIAL: copy("statusPartial"),
    PAID: copy("statusPaid"),
    OVERDUE: copy("statusOverdue"),
    NOT_DONE: copy("statusNotDone"),
  };
  return labels[status] || value || "-";
}

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value;
}

function setHtml(id, value) {
  const node = el(id);
  if (node) node.innerHTML = value;
}

function setPlaceholder(id, value) {
  const node = el(id);
  if (node) node.placeholder = value;
}

function setOptionLabels() {
  const select = el("paymentNoticeMethod");
  if (!select) return;
  const current = select.value;
  const labels = {
    Transferencia: copy("methodTransfer"),
    MBWay: copy("methodMbway"),
    Dinheiro: copy("methodCash"),
    Multibanco: copy("methodAtm"),
    Outro: copy("methodOther"),
  };
  Array.from(select.options).forEach((option) => {
    option.textContent = labels[option.value] || option.value;
  });
  select.value = current;
}

function applyLanguage(language) {
  portalLanguage = normalizeLanguage(language);
  localStorage.setItem("cw_client_lang", portalLanguage);
  localStorage.setItem("cw_language", portalLanguage);
  document.documentElement.lang = portalLanguage;
  document.title = `Cristal Water LDA - ${copy("brandPortal")}`;
  setText("brandPortalLabel", copy("brandPortal"));
  setText("portalLogoutBtn", isAdminUser() ? copy("adminBackClients") : copy("logout"));
  setText("adminSwitcherTitle", copy("adminSwitcherTitle"));
  const adminHelp = document.querySelector("#adminClientSwitcher .section-head .muted");
  if (adminHelp) adminHelp.textContent = copy("adminSwitcherHelp");
  setText("adminSwitcherBadge", "Admin");
  setPlaceholder("adminClientSearch", copy("adminClientSearch"));
  const adminSelect = el("adminClientSelect");
  if (adminSelect?.options?.[0]) adminSelect.options[0].textContent = copy("adminChooseClient");
  setText("adminOpenClientFile", copy("adminClientFile"));
  setText("adminOpenAccount", copy("adminAccount"));
  setText("portalIntro", copy("portalIntro"));
  setText("poolCountLabel", copy("poolsJacuzzis"));
  setText("paymentStateLabel", copy("financialState"));
  setText("nextVisitLabel", copy("nextVisitMetric"));
  setText("quickAccessTitle", copy("quickAccess"));
  setText("quickAccessRole", copy("clientRole"));
  setText("quickMessageLink", copy("message"));
  setText("quickAgendaLink", copy("agenda"));
  setText("quickServicesLink", copy("services"));
  setText("quickPaymentsLink", copy("payments"));
  setText("paymentReferenceLabel", copy("paymentReference"));
  setPlaceholder("paymentNoticeAmount", copy("amountPlaceholder"));
  setPlaceholder("paymentNoticeNote", copy("notePlaceholder"));
  setText("paymentNoticeBtn", copy("notifyPayment"));
  setText("paymentWhatsappLink", copy("whatsapp"));
  setText("scheduleTitle", copy("scheduleTitle"));
  setText("scheduleLang", copy("schedulePill"));
  setText("poolsTitle", copy("poolsTitle"));
  setText("poolsPill", copy("maintenancePill"));
  setText("summaryTitle", copy("summaryTitle"));
  setText("summaryPill", copy("account"));
  setText("servicesTitle", copy("servicesTitle"));
  setText("servicesPill", copy("historyPill"));
  setPlaceholder("serviceHistorySearch", copy("historySearchPlaceholder"));
  setText("serviceHistoryDownload", copy("historyDownload"));
  const historyDate = el("serviceHistoryDate");
  if (historyDate) historyDate.title = copy("historyReferenceDate");
  setText("billingTitle", copy("billingTitle"));
  setText("billingPill", copy("account"));
  setText("messagesTitle", copy("messagesTitle"));
  setPlaceholder("messageInput", copy("messagePlaceholder"));
  setText("photoBtn", copy("attachment"));
  setText("sendBtn", copy("send"));
  setHtml("paymentHelpText", copy("paymentHelp"));
  setOptionLabels();
  updateServiceHistoryOptionLabels();
  renderClientFocus(lastPortalSnapshot);
  renderAdminClientOptions();
  if (currentServiceHistory.length) renderFilteredServiceHistory();
  updatePresence();
  refreshPaymentWhatsappLink();
}

window.addEventListener("cw-language-change", (event) => {
  const nextLanguage = normalizeLanguage(event.detail?.language);
  applyLanguage(nextLanguage);
  if (clientId) loadPortal().catch(() => {});
});

let languageSyncInFlight = false;
async function syncLanguageFromShell() {
  const nextLanguage = globalShellLanguage();
  if (nextLanguage === portalLanguage || languageSyncInFlight) return;
  languageSyncInFlight = true;
  try {
    applyLanguage(nextLanguage);
    if (clientId) {
      await loadPortal();
      await loadMessages();
    } else if (isAdminUser()) {
      showNoClientSelectedState();
    }
  } finally {
    languageSyncInFlight = false;
  }
}

function scheduleClass(state) {
  return ["scheduled", "inProgress", "delayed", "afterHours", "completed", "noSchedule"].includes(state)
    ? state
    : "scheduled";
}

function renderPoolSchedules(schedules) {
  const list = el("poolScheduleList");
  if (!list) return;

  if (!schedules.length) {
    list.innerHTML = `<div class="empty">${esc(copy("noSchedules"))}</div>`;
    return;
  }

  list.innerHTML = schedules.map((schedule) => `
    <article class="schedule-item ${esc(scheduleClass(schedule.state))}">
      <div class="schedule-top">
        <div>
          <div class="schedule-title">${esc(schedule.poolName || copy("poolFallback"))}</div>
          <div class="muted">${esc(schedule.zone || schedule.poolType || "Cristal Water")}</div>
        </div>
        <span class="pill">${esc(schedule.label || copy("calendarLabel"))}</span>
      </div>
      <div>
        <div class="schedule-date">${esc(schedule.plannedDate ? fmtDateTime(schedule.plannedDate) : copy("confirm"))}</div>
        <div class="schedule-message"><b>${esc(schedule.title || "")}</b><br>${esc(schedule.message || "")}</div>
      </div>
    </article>
  `).join("");
}

function renderPools(pools) {
  const list = el("poolsList");
  if (!list) return;
  if (!pools.length) {
    list.innerHTML = `<div class="empty">${esc(copy("noPools"))}</div>`;
    return;
  }
  list.innerHTML = pools.map((pool) => `
    <div class="item">
      <b>${esc(pool.name || copy("poolFallback"))}</b>
      <div class="muted">${esc(pool.zone || pool.location || copy("zoneUndefined"))} - ${esc(pool.type || copy("poolFallback"))}</div>
      <div style="margin-top:8px"><span class="pill">${esc(pool.status || copy("active"))}</span></div>
    </div>
  `).join("");
}

function renderSummary(data) {
  const list = el("summaryList");
  if (!list) return;
  const totalOpen = Number(data.summary?.totalOpen || 0);
  const totalPaid = Number(data.summary?.totalPaid || 0);
  const creditBalance = Number(data.summary?.creditBalance || 0);
  const completedServices = Number(data.summary?.completedServices || 0);
  const lastService = data.summary?.lastServiceAt ? fmtDate(data.summary.lastServiceAt) : copy("confirm");
  const nextVisit = data.nextVisit ? fmtDate(data.nextVisit.plannedDate || data.nextVisit.date) : copy("confirm");
  list.innerHTML = `
    <div class="item"><b>${esc(copy("operationalState"))}</b><div class="muted">${completedServices} ${esc(copy("registeredServices"))}. ${esc(copy("lastService"))}: ${esc(lastService)}.</div></div>
    <div class="item"><b>${esc(copy("paymentSummary"))}</b><div class="muted">${totalOpen > 0 ? `${esc(copy("openAmount"))}: ${money(totalOpen)}.` : esc(copy("noPendingValues"))} ${creditBalance > 0 ? `${esc(copy("positiveCredit"))}: ${money(creditBalance)}.` : ""} ${esc(copy("paidInPeriod"))}: ${money(totalPaid)}.</div></div>
    <div class="item"><b>${esc(copy("nextVisitMetric"))}</b><div class="muted">${esc(nextVisit)}</div></div>
  `;
}

function renderClientFocus(data = {}) {
  const box = el("clientFocusPanel");
  if (!box) return;
  lastPortalSnapshot = data || {};

  const schedules = Array.isArray(data.poolSchedules) ? data.poolSchedules : [];
  const services = Array.isArray(data.serviceHistory) ? data.serviceHistory : [];
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  const totalOpen = Number(data.summary?.totalOpen || 0);
  const creditBalance = Number(data.summary?.creditBalance || 0);
  const nextVisit = data.nextVisit ? fmtDate(data.nextVisit.plannedDate || data.nextVisit.date) : copy("confirm");
  const delayed = schedules.some((schedule) => ["delayed", "afterhours"].includes(String(schedule.state || "").toLowerCase()));
  const unpaid = invoices.filter((invoice) => ["PENDING", "PARTIAL", "OVERDUE", "VENCIDA"].includes(String(invoice.status || "").toUpperCase())).length;

  const cards = [
    {
      tone: delayed ? "warn" : "info",
      label: copy("agenda"),
      value: nextVisit,
      hint: delayed ? copy("scheduleDelayedHint") : copy("schedulePlannedHint")
    },
    {
      tone: totalOpen > 0 ? "warn" : "ok",
      label: copy("account"),
      value: totalOpen > 0 ? money(totalOpen) : copy("upToDate"),
      hint: creditBalance > 0 ? `${copy("positiveCredit")}: ${money(creditBalance)}` : (unpaid ? `${unpaid} ${copy("accountPendingHint")}` : copy("noPendingValues"))
    },
    {
      tone: services.length ? "ok" : "info",
      label: copy("services"),
      value: String(services.length),
      hint: services.length ? copy("serviceHistoryHint") : copy("servicesFirstVisitHint")
    },
    {
      tone: "info",
      label: copy("contact"),
      value: copy("message"),
      hint: copy("contactHint")
    }
  ];

  box.innerHTML = cards.map((card) => `
    <div class="client-focus-card ${esc(card.tone)}">
      <span>${esc(card.label)}</span>
      <b>${esc(card.value)}</b>
      <small>${esc(card.hint)}</small>
    </div>
  `).join("");
}

function readingPills(readings = {}) {
  return [
    ["pH", readings.ph],
    ["Cloro", readings.chlorine],
    ["Alcal.", readings.alkalinity],
    ["ORP", readings.orpMv],
    ["Temp.", readings.temperature],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => `<span class="mini">${esc(label)}: ${esc(value)}</span>`).join("");
}

function checklistPills(checklist = {}) {
  const labels = {
    cleaned: "Agua limpa",
    brushed: "Escovagem",
    vacuumed: "Aspiracao",
    basketCleaned: "Cestos limpos",
    waterlineClean: "Linha de agua",
    backwashDone: "Lavagem filtro",
  };
  return Object.entries(labels)
    .filter(([key]) => checklist[key])
    .map(([, label]) => `<span class="mini">${esc(label)}</span>`)
    .join("");
}

function productPills(products = []) {
  if (!Array.isArray(products) || !products.length) return `<span class="mini">${esc(copy("noConsumption"))}</span>`;
  return products.map((product) => `<span class="mini">${esc(product.name || product.productName || copy("productFallback"))} ${esc(product.quantity || "")} ${esc(product.unit || "")}</span>`).join("");
}

function parseProductList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeHistoryVisit(visit = {}) {
  return {
    id: visit.id,
    poolId: visit.poolId || visit.pool?.id || null,
    poolName: visit.pool?.name || visit.poolName || copy("poolFallback"),
    poolType: visit.pool?.type || visit.poolType || "POOL",
    technicianName: visit.technician?.name || visit.technicianName || "Cristal Water",
    plannedDate: visit.plannedDate || visit.date || visit.startAt || visit.createdAt || null,
    startAt: visit.startAt || null,
    endAt: visit.endAt || visit.completedAt || null,
    status: visit.status || "DONE",
    reason: visit.reason || null,
    notes: visit.notes || null,
    checklist: visit.checklist || {
      cleaned: Boolean(visit.cleaned),
      brushed: Boolean(visit.brushed),
      vacuumed: Boolean(visit.vacuumed),
      basketCleaned: Boolean(visit.basketCleaned),
      waterlineClean: Boolean(visit.waterlineClean),
      backwashDone: Boolean(visit.backwashDone),
    },
    readings: visit.readings || {
      ph: visit.ph,
      chlorine: visit.chlorine,
      alkalinity: visit.alkalinity,
      salt: visit.salt,
      temperature: visit.temperature,
      orpMv: visit.orpMv,
    },
    products: Array.isArray(visit.products) ? visit.products : parseProductList(visit.products || visit.chemicalsJson),
    photos: Array.isArray(visit.photos) ? visit.photos : [],
  };
}

async function loadCompleteServiceHistory(services = []) {
  if (!clientId || services.length < 40) return services;
  try {
    const response = await fetch(`${API}/client-portal/history/${clientId}`);
    const data = await response.json();
    const visits = Array.isArray(data.visits) ? data.visits : [];
    if (!response.ok || data.ok === false || visits.length <= services.length) return services;
    const merged = new Map();
    services.forEach((service) => merged.set(String(service.id), service));
    visits.forEach((visit) => merged.set(String(visit.id), normalizeHistoryVisit(visit)));
    return Array.from(merged.values()).sort((a, b) => (serviceDate(b) || 0) - (serviceDate(a) || 0));
  } catch (error) {
    console.warn("full service history unavailable", error);
    return services;
  }
}

function serviceDate(service) {
  const date = new Date(service.endAt || service.plannedDate || service.startAt || service.createdAt || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDay(date) {
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function groupLabel(key, period) {
  if (!key) return copy("confirm");
  if (period === "day") return fmtDate(`${key}T00:00:00`);
  if (period === "week") return `${copy("historyByWeek")} ${key.replace("-W", "/")}`;
  if (period === "year") return key;
  const [year, month] = key.split("-").map(Number);
  if (year && month) {
    return new Date(year, month - 1, 1).toLocaleDateString(localeForLanguage(), { month: "long", year: "numeric" });
  }
  return key;
}

function groupKey(date, period) {
  if (!date) return "";
  if (period === "day") return isoDay(date);
  if (period === "week") return isoWeek(date);
  if (period === "year") return String(date.getFullYear());
  return monthKey(date);
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function serviceSearchText(service) {
  const products = Array.isArray(service.products) ? service.products : [];
  return normalizeSearch([
    service.poolName,
    service.poolType,
    service.technicianName,
    service.status,
    service.notes,
    service.reason,
    products.map((product) => [product.name, product.productName, product.quantity, product.unit].filter(Boolean).join(" ")).join(" "),
  ].filter(Boolean).join(" "));
}

function selectedReferenceDate() {
  const input = el("serviceHistoryDate");
  const raw = input?.value || latestServiceDateValue();
  const date = raw ? new Date(`${raw}T00:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function latestServiceDateValue() {
  const latest = currentServiceHistory
    .map(serviceDate)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  return latest ? isoDay(latest) : "";
}

function updateServiceHistoryOptionLabels() {
  const pool = el("serviceHistoryPool");
  if (pool?.options?.[0]) pool.options[0].textContent = copy("historyAllPools");
  const period = el("serviceHistoryPeriod");
  if (period) {
    const labels = {
      all: copy("historyAllPeriods"),
      day: copy("historyByDay"),
      week: copy("historyByWeek"),
      month: copy("historyByMonth"),
      year: copy("historyByYear"),
    };
    Array.from(period.options).forEach((option) => {
      option.textContent = labels[option.value] || option.value;
    });
  }
}

function populateServicePoolOptions(services) {
  const select = el("serviceHistoryPool");
  if (!select) return;
  const current = select.value;
  const pools = new Map();
  services.forEach((service) => {
    if (service.poolId) pools.set(String(service.poolId), service.poolName || copy("poolFallback"));
  });
  select.innerHTML = `<option value="">${esc(copy("historyAllPools"))}</option>` + Array.from(pools.entries())
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), localeForLanguage()))
    .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`)
    .join("");
  if (current && pools.has(current)) select.value = current;
}

function setupServiceHistoryTools() {
  if (serviceHistoryToolsReady) return;
  serviceHistoryToolsReady = true;
  ["serviceHistorySearch", "serviceHistoryPool", "serviceHistoryPeriod", "serviceHistoryDate"].forEach((id) => {
    const node = el(id);
    if (!node) return;
    node.addEventListener("input", renderFilteredServiceHistory);
    node.addEventListener("change", renderFilteredServiceHistory);
  });
  el("serviceHistoryDownload")?.addEventListener("click", downloadFilteredServiceHistory);
}

function filteredServiceHistory() {
  const poolId = el("serviceHistoryPool")?.value || "";
  const period = el("serviceHistoryPeriod")?.value || "all";
  const query = normalizeSearch(el("serviceHistorySearch")?.value || "");
  const reference = selectedReferenceDate();
  const referenceKey = reference && period !== "all" ? groupKey(reference, period) : "";

  return currentServiceHistory.filter((service) => {
    const date = serviceDate(service);
    if (poolId && String(service.poolId || "") !== poolId) return false;
    if (query && !serviceSearchText(service).includes(query)) return false;
    if (referenceKey && groupKey(date, period) !== referenceKey) return false;
    return true;
  });
}

function serviceCard(service) {
  return `
    <article class="service-item">
      <div class="service-head">
        <div>
          <div class="service-title">${esc(service.poolName || copy("poolFallback"))}</div>
          <div class="muted">${esc(fmtDateTime(service.endAt || service.plannedDate))} - ${esc(service.technicianName || "Cristal Water")}</div>
        </div>
        <span class="pill">${esc(statusText(service.status))}</span>
      </div>
      <div class="readings">${readingPills(service.readings)}</div>
      <div class="checklist">${checklistPills(service.checklist)}</div>
      <div class="products">${productPills(service.products)}</div>
      ${service.notes ? `<div class="muted">${esc(service.notes)}</div>` : ""}
      ${Array.isArray(service.photos) && service.photos.length ? `<div class="photo-strip">${service.photos.slice(0, 6).map((photo) => `<img src="${esc(photo.url)}" alt="${esc(copy("services"))}">`).join("")}</div>` : ""}
    </article>
  `;
}

function renderFilteredServiceHistory() {
  const list = el("serviceHistoryList");
  if (!list) return;
  const tools = el("serviceHistoryTools");
  const summary = el("serviceHistorySummary");
  if (!currentServiceHistory.length) {
    if (tools) tools.hidden = true;
    if (summary) summary.hidden = true;
    list.innerHTML = `<div class="empty">${esc(copy("noServices"))}</div>`;
    return;
  }

  const useIndexedView = currentServiceHistory.length > 2;
  if (tools) tools.hidden = !useIndexedView;
  if (summary) summary.hidden = !useIndexedView;
  if (!useIndexedView) {
    list.innerHTML = currentServiceHistory.map(serviceCard).join("");
    return;
  }

  const filtered = filteredServiceHistory();
  if (summary) {
    summary.textContent = `${filtered.length} / ${currentServiceHistory.length} ${copy("historyFilteredCount")}`;
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="empty">${esc(copy("historyNoFiltered"))}</div>`;
    return;
  }

  const period = el("serviceHistoryPeriod")?.value || "all";
  const grouped = new Map();
  filtered
    .slice()
    .sort((a, b) => (serviceDate(b) || 0) - (serviceDate(a) || 0))
    .forEach((service) => {
      const key = groupKey(serviceDate(service), period);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(service);
    });

  list.innerHTML = Array.from(grouped.entries()).map(([key, items]) => `
    <section class="service-group">
      <div class="service-group-head">
        <span>${esc(groupLabel(key, period))}</span>
        <span class="pill">${esc(items.length)} ${esc(copy("services").toLowerCase())}</span>
      </div>
      ${items.map(serviceCard).join("")}
    </section>
  `).join("");
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFilteredServiceHistory() {
  const services = filteredServiceHistory();
  if (!services.length) {
    ui.info(copy("historyNoFiltered"));
    return;
  }
  const rows = [
    ["Data", "Piscina/Jacuzzi", "Tecnico", "Estado", "pH", "Cloro", "Alcalinidade", "ORP", "Temperatura", "Produtos", "Notas"],
    ...services.map((service) => {
      const readings = service.readings || {};
      const products = Array.isArray(service.products)
        ? service.products.map((product) => `${product.name || product.productName || copy("productFallback")} ${product.quantity || ""} ${product.unit || ""}`.trim()).join(" | ")
        : "";
      return [
        fmtDateTime(service.endAt || service.plannedDate),
        service.poolName || "",
        service.technicianName || "",
        statusText(service.status),
        readings.ph ?? "",
        readings.chlorine ?? "",
        readings.alkalinity ?? "",
        readings.orpMv ?? "",
        readings.temperature ?? "",
        products,
        service.notes || service.reason || "",
      ];
    }),
  ];
  const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const period = el("serviceHistoryPeriod")?.value || "all";
  link.href = url;
  link.download = `cristal-water-historico-cliente-${clientId || "sem-cliente"}-${period}-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderServiceHistory(services = []) {
  const list = el("serviceHistoryList");
  if (!list) return;
  currentServiceHistory = Array.isArray(services) ? services : [];
  setupServiceHistoryTools();
  populateServicePoolOptions(currentServiceHistory);
  const dateInput = el("serviceHistoryDate");
  if (dateInput && !dateInput.value) dateInput.value = latestServiceDateValue();
  updateServiceHistoryOptionLabels();
  renderFilteredServiceHistory();
}

function invoiceLineDescription(description) {
  const text = String(description || "").trim();
  const monthly = text.match(/^Mensalidade(\s+.+)?$/i);
  if (monthly) return `${copy("invoiceLineMonthly")}${monthly[1] || ""}`;
  return text;
}

function renderInvoices(invoices = []) {
  const list = el("invoiceList");
  if (!list) return;
  if (!invoices.length) {
    list.innerHTML = `<div class="empty">${esc(copy("noInvoices"))}</div>`;
    return;
  }
  list.innerHTML = invoices.slice(0, 8).map((invoice) => {
    const tone = String(invoice.status || "").toLowerCase();
    const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
    const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
    return `
      <article class="invoice-item ${esc(tone)}">
        <div class="invoice-head">
          <div>
            <div class="invoice-title">${esc(invoice.invoiceNumber || invoice.monthRef || `${copy("invoiceFallback")} ${invoice.id}`)}</div>
            <div class="muted">${esc(statusText(invoice.status))} - ${esc(copy("issued"))} ${esc(fmtDate(invoice.issueDate))}</div>
          </div>
          <div class="invoice-total">${money(invoice.total)}</div>
        </div>
        <div class="invoice-lines">${lines.map((line) => `<span class="mini">${esc(invoiceLineDescription(line.description))}: ${money(line.total)}</span>`).join("")}</div>
        <div class="muted">${esc(copy("paid"))}: ${money(invoice.amountPaid)} - ${esc(copy("open"))}: ${money(invoice.amountOpen)}</div>
        ${payments.length ? `<div class="products">${payments.map((payment) => `<span class="mini">${esc(payment.method || copy("paymentFallback"))} ${money(payment.amount)}</span>`).join("")}</div>` : ""}
      </article>
    `;
  }).join("");
}

function renderNotifications(notifications = []) {
  const list = el("notificationList");
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = `<div class="empty">Sem notificações recentes.</div>`;
    return;
  }
  list.innerHTML = notifications.slice(0, 8).map((notification) => `
    <article class="service-item">
      <div class="service-head">
        <div>
          <div class="service-title">${esc(notification.title || "Notificação")}</div>
          <div class="muted">${esc(fmtDateTime(notification.createdAt))}</div>
        </div>
        <span class="pill">${esc(notification.status || "PENDING")}</span>
      </div>
      <div class="muted">${esc(notification.message || "")}</div>
    </article>
  `).join("");
}

function renderDocuments(documents = []) {
  const list = el("documentList");
  if (!list) return;
  if (!documents.length) {
    list.innerHTML = `<div class="empty">Sem documentos disponíveis.</div>`;
    return;
  }
  list.innerHTML = documents.slice(0, 8).map((documentItem) => `
    <article class="service-item">
      <div class="service-head">
        <div>
          <div class="service-title">${esc(documentItem.title || documentItem.originalName || "Documento")}</div>
          <div class="muted">${esc(documentItem.type || "Documento")}</div>
        </div>
        <a class="btn primary" href="${esc(documentItem.downloadUrl || documentItem.url || "#")}" target="_blank" rel="noopener">Abrir</a>
      </div>
      <div class="muted">${esc(documentItem.notes || "")}</div>
    </article>
  `).join("");
}

function renderPermissions(permissions = {}) {
  const list = el("permissionsList");
  if (!list) return;
  list.innerHTML = `
    <div class="client-focus-card info"><span>Isolamento</span><b>${permissions.readOnly ? "Read-only" : "Ativo"}</b><small>${esc(permissions.isolation?.scope || "customer-owned-data-only")}</small></div>
    <div class="client-focus-card"><span>Visitas</span><b>${permissions.canRequestVisit ? "Permitido" : "Bloqueado"}</b><small>Pedidos de visita e prioridade</small></div>
    <div class="client-focus-card"><span>Documentos</span><b>${permissions.canDownloadSecureDocuments ? "Seguro" : "Restrito"}</b><small>Faturas, relatórios e guias</small></div>
    <div class="client-focus-card"><span>Conta</span><b>${permissions.billingActive ? "Ativa" : "Pendente"}</b><small>${esc(permissions.paymentReference || "-")}</small></div>
  `;
}

async function loadCustomerExtras() {
  if (!clientId) return;
  if (!portalAuthHeaders().Authorization && isAdminUser()) return;
  const [notificationsRes, documentsRes, permissionsRes] = await Promise.all([
    fetch(`${API}/client-portal/${clientId}/notifications`, { headers: portalAuthHeaders() }),
    fetch(`${API}/client-portal/${clientId}/documents`, { headers: portalAuthHeaders() }),
    fetch(`${API}/client-portal/${clientId}/permissions`, { headers: portalAuthHeaders() }),
  ]);

  const notifications = await notificationsRes.json().catch(() => ({}));
  const documents = await documentsRes.json().catch(() => ({}));
  const permissions = await permissionsRes.json().catch(() => ({}));

  renderNotifications(Array.isArray(notifications.notifications) ? notifications.notifications : []);
  renderDocuments(Array.isArray(documents.documents) ? documents.documents : []);
  renderPermissions(permissions.permissions || {});
}

function renderPaymentInstructions(instructions = {}) {
  currentPaymentInstructions = instructions || {};
  const reference = instructions.paymentReference || `CW-${String(clientId || 0).padStart(6, "0")}`;
  const amountOpen = Number(instructions.amountOpen || 0);
  setText("paymentReference", reference);
  setText(
    "paymentInstructions",
    portalLanguage === "pt" && instructions.instructions ? instructions.instructions : copy("paymentInstructionFull")
  );

  const amountInput = el("paymentNoticeAmount");
  if (amountInput && amountOpen > 0 && !amountInput.value) {
    amountInput.value = amountOpen.toFixed(2);
  }

  refreshPaymentWhatsappLink();
}

function buildPaymentNoticeMessage(channel = "PORTAL_CLIENTE") {
  const reference = currentPaymentInstructions?.paymentReference || `CW-${String(clientId || 0).padStart(6, "0")}`;
  const amount = Number(el("paymentNoticeAmount")?.value || 0);
  const method = el("paymentNoticeMethod")?.value || "Transferencia";
  const note = el("paymentNoticeNote")?.value?.trim() || "";
  return {
    amount,
    method,
    note,
    channel,
    text: [
      copy("paymentNoticeGreeting"),
      copy("paymentNoticeText"),
      `${copy("paymentNoticeRef")}: ${reference}.`,
      amount > 0 ? `${copy("paymentNoticeAmount")}: ${amount.toFixed(2)} EUR.` : "",
      `${copy("paymentNoticeMethod")}: ${method}.`,
      note ? `${copy("paymentNoticeNote")}: ${note}.` : "",
    ].filter(Boolean).join(" "),
  };
}

function normalizeWhatsappNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function setWhatsappLinkDisabled(link, message) {
  link.href = "#";
  link.dataset.disabled = "1";
  link.setAttribute("aria-disabled", "true");
  link.title = message;
  link.onclick = (event) => {
    event.preventDefault();
    ui.info(message);
  };
}

function setWhatsappLinkEnabled(link, href, title) {
  link.href = href;
  link.dataset.disabled = "0";
  link.removeAttribute("aria-disabled");
  link.title = title;
  link.onclick = null;
}

function refreshPaymentWhatsappLink() {
  const link = el("paymentWhatsappLink");
  if (!link) return;
  const notice = buildPaymentNoticeMessage("WHATSAPP");
  if (!clientId || String(currentPaymentInstructions?.paymentReference || "").endsWith("000000")) {
    setWhatsappLinkDisabled(link, copy("whatsappNoClient"));
    return;
  }

  const companyNumber = normalizeWhatsappNumber(
    currentPaymentInstructions?.whatsappNumber
    || currentPaymentInstructions?.companyWhatsappNumber
    || window.CW_COMPANY_WHATSAPP
    || ""
  );
  const encodedText = encodeURIComponent(notice.text);
  if (companyNumber) {
    setWhatsappLinkEnabled(link, `https://wa.me/${companyNumber}?text=${encodedText}`, copy("whatsappDirect"));
    return;
  }
  setWhatsappLinkEnabled(link, `https://api.whatsapp.com/send?text=${encodedText}`, copy("whatsappChooseContact"));
}

function adminClientSearchText(client) {
  return [
    client.id,
    client.name,
    client.internalName,
    client.email,
    client.phone,
    client.zone,
    client.address,
    client.paymentReference || paymentReference(client.id),
    ...(client.pools || []).map((pool) => [pool.name, pool.zone, pool.type, pool.location, pool.address].filter(Boolean).join(" ")),
  ].filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function selectedAdminClient() {
  return adminClients.find((client) => Number(client.id) === Number(clientId)) || null;
}

function clientTotals(client) {
  const pools = client?.pools || [];
  const invoices = client?.invoices || [];
  return {
    pools: pools.length,
    open: invoices.reduce((sum, invoice) => sum + Number(invoice.amountOpen || 0), 0),
  };
}

function renderAdminClientMeta() {
  const meta = el("adminClientMeta");
  const file = el("adminOpenClientFile");
  const account = el("adminOpenAccount");
  if (!meta) return;
  const client = selectedAdminClient();
  if (!client) {
    meta.innerHTML = `<span class="pill">${esc(copy("adminChooseClientMeta"))}</span>`;
    if (file) file.href = "/admin-clients";
    if (account) account.href = "/invoices";
    return;
  }
  const totals = clientTotals(client);
  meta.innerHTML = `
    <span class="pill">${esc(copy("clientDefault"))} #${esc(client.id)}</span>
    <span class="pill">${esc(client.name || copy("clientDefault"))}</span>
    <span class="pill">${esc(client.paymentReference || paymentReference(client.id))}</span>
    <span class="pill">${esc(totals.pools)} ${esc(copy("poolsJacuzzis").toLowerCase())}</span>
    <span class="pill">${esc(copy("open"))} ${esc(money(totals.open))}</span>
  `;
  if (file) file.href = `/admin-clients?search=${encodeURIComponent(client.name || client.id)}`;
  if (account) account.href = `/invoices?clientId=${encodeURIComponent(client.id)}`;
}

function renderAdminClientOptions() {
  const select = el("adminClientSelect");
  if (!select) return;
  const query = (el("adminClientSearch")?.value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const terms = query.split(/\s+/).filter(Boolean);
  const clients = terms.length
    ? adminClients.filter((client) => terms.every((term) => adminClientSearchText(client).includes(term)))
    : adminClients;
  select.innerHTML = `<option value="">${esc(copy("adminChooseClient"))}</option>` + clients.slice(0, 250).map((client) => {
    const totals = clientTotals(client);
    const label = `${client.name || copy("clientDefault")} - ${client.paymentReference || paymentReference(client.id)} - ${totals.pools} ${copy("poolsTitle").toLowerCase()}`;
    return `<option value="${esc(client.id)}" ${Number(client.id) === Number(clientId) ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");
  renderAdminClientMeta();
}

function showNoClientSelectedState() {
  setText("clientName", copy("adminChooseTitle"));
  setText("useStatus", copy("adminMode"));
  setText("poolCount", "0");
  setText("paymentState", "-");
  setText("nextVisit", copy("confirm"));
  const useStatus = el("useStatus");
  if (useStatus) useStatus.className = "status";
  if (el("poolsList")) el("poolsList").innerHTML = `<div class="empty">${esc(copy("adminSelectPools"))}</div>`;
  if (el("poolScheduleList")) el("poolScheduleList").innerHTML = `<div class="empty">${esc(copy("adminSelectSchedule"))}</div>`;
  if (el("summaryList")) el("summaryList").innerHTML = `<div class="empty">${esc(copy("adminSelectSummary"))}</div>`;
  currentServiceHistory = [];
  if (el("serviceHistoryTools")) el("serviceHistoryTools").hidden = true;
  if (el("serviceHistorySummary")) el("serviceHistorySummary").hidden = true;
  if (el("serviceHistoryList")) el("serviceHistoryList").innerHTML = `<div class="empty">${esc(copy("adminSelectServices"))}</div>`;
  if (el("invoiceList")) el("invoiceList").innerHTML = `<div class="empty">${esc(copy("adminSelectBilling"))}</div>`;
  if (el("chatBox")) el("chatBox").innerHTML = `<div class="empty">${esc(copy("adminSelectMessages"))}</div>`;
  renderClientFocus({});
  renderPaymentInstructions({ paymentReference: "CW-000000", amountOpen: 0 });
}

async function chooseAdminClient(nextClientId, updateUrl = true) {
  const id = Number(nextClientId || 0);
  clientId = Number.isInteger(id) && id > 0 ? id : 0;
  if (clientId) sessionStorage.setItem("cw_admin_preview_client_id", String(clientId));
  if (updateUrl) {
    const url = new URL(location.href);
    if (clientId) url.searchParams.set("clientId", String(clientId));
    else url.searchParams.delete("clientId");
    history.replaceState({}, "", url);
  }
  renderAdminClientOptions();
  if (!clientId) {
    showNoClientSelectedState();
    return;
  }
  socket.emit("joinClient", clientId);
  await loadPortal();
  await loadMessages();
}

async function setupAdminClientSwitcher() {
  const panel = el("adminClientSwitcher");
  if (!panel || !isAdminUser()) return;
  panel.hidden = false;
  const logoutButton = document.querySelector(".top .btn.danger");
  if (logoutButton) logoutButton.textContent = copy("adminBackClients");

  if (!queryClientId) {
    clientId = Number(sessionStorage.getItem("cw_admin_preview_client_id") || 0);
  }

  try {
    const response = await fetch(`${API}/core/clients?includeInactive=true`);
    const data = await response.json();
    adminClients = Array.isArray(data.clients) ? data.clients : [];
    renderAdminClientOptions();
  } catch (error) {
    console.warn(error);
    adminClients = [];
    const meta = el("adminClientMeta");
    if (meta) meta.innerHTML = `<span class="pill">${esc(copy("adminListFailed"))}</span>`;
  }

  el("adminClientSearch")?.addEventListener("input", renderAdminClientOptions);
  el("adminClientSelect")?.addEventListener("change", (event) => chooseAdminClient(event.target.value));
}

async function notifyPayment() {
  if (!clientId) {
    ui.error(copy("clientNotIdentified"));
    return;
  }
  const notice = buildPaymentNoticeMessage("PORTAL_CLIENTE");
  const response = await fetch(`${API}/client-portal/${clientId}/payment-notice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notice),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    ui.error(data.error || copy("paymentNoticeFailed"));
    return;
  }
  await loadMessages();
  ui.success(`${copy("paymentNoticeSuccess")} ${data.paymentReference || currentPaymentInstructions?.paymentReference || ""}.`);
}

async function loadPortal() {
  try {
    if (!clientId && isAdminUser()) {
      showNoClientSelectedState();
      return;
    }
    if (!clientId) throw new Error(copy("clientNotIdentified"));
    const response = await fetch(`${API}/client-portal/${clientId}?lang=${encodeURIComponent(portalLanguage)}`);
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || copy("noDataStatus"));

    applyLanguage(preferredLanguage(data.language));
    const client = data.client || {};
    lastPortalSnapshot = data || {};
    const pools = Array.isArray(client.pools) ? client.pools : [];
    const schedules = Array.isArray(data.poolSchedules) ? data.poolSchedules : [];
    const totalOpen = Number(data.summary?.totalOpen || 0);
    const nextVisit = data.nextVisit ? fmtDate(data.nextVisit.plannedDate || data.nextVisit.date) : copy("confirm");
    const portalStatus = data.portalStatus || {};

    setText("clientName", client.name || copy("clientDefault"));
    setText("poolCount", String(pools.length));
    setText("paymentState", totalOpen > 0 ? copy("statusPending") : copy("upToDate"));
    setText("nextVisit", nextVisit);
    setText("useStatus", portalLanguage === "pt" && portalStatus.label ? portalStatus.label : (pools.length ? copy("updatedState") : copy("noPoolStatus")));
    const useStatus = el("useStatus");
    if (useStatus) useStatus.className = `status ${scheduleClass(portalStatus.state || "scheduled")}`;
    renderPools(pools);
    renderPoolSchedules(schedules);
    renderSummary(data);
    renderClientFocus(data);
    renderPaymentInstructions(data.paymentInstructions || { paymentReference: client.paymentReference, amountOpen: totalOpen });
    const completeServiceHistory = await loadCompleteServiceHistory(Array.isArray(data.serviceHistory) ? data.serviceHistory : []);
    renderServiceHistory(completeServiceHistory);
    renderInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    await loadCustomerExtras();
  } catch (error) {
    console.warn(error);
    setText("clientName", copy("portalTitle"));
    setText("useStatus", copy("loadError"));
    setText("paymentState", "-");
    setText("nextVisit", copy("confirm"));
    el("poolsList").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    el("poolScheduleList").innerHTML = `<div class="empty">${esc(copy("scheduleBackend"))}</div>`;
    el("summaryList").innerHTML = `<div class="empty">${esc(copy("summaryBackend"))}</div>`;
    renderClientFocus({});
    currentServiceHistory = [];
    if (el("serviceHistoryTools")) el("serviceHistoryTools").hidden = true;
    if (el("serviceHistorySummary")) el("serviceHistorySummary").hidden = true;
    if (el("serviceHistoryList")) el("serviceHistoryList").innerHTML = `<div class="empty">${esc(copy("servicesUnavailable"))}</div>`;
    if (el("invoiceList")) el("invoiceList").innerHTML = `<div class="empty">${esc(copy("billingUnavailable"))}</div>`;
  }
}

function appendMessage(message) {
  const chat = el("chatBox");
  if (!chat) return;
  const sender = String(message.sender || message.from || "").toLowerCase();
  const isClient = sender.includes("client") || sender.includes("cliente");
  const text = message.text || message.message || "";
  const date = message.createdAt ? new Date(message.createdAt).toLocaleString(localeForLanguage()) : "";
  const div = document.createElement("div");
  div.className = `msg ${isClient ? "client" : "admin"}`;
  div.innerHTML = `<b>${isClient ? esc(copy("clientDefault")) : "Cristal Water"}</b><br>${String(text).startsWith("/uploads/") ? `<a href="${esc(text)}" target="_blank">${esc(copy("openAttachment"))}</a>` : esc(text)}<div class="muted">${esc(date)}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function loadMessages() {
  const chat = el("chatBox");
  if (!chat) return;
  try {
    if (!clientId) throw new Error(copy("clientNotIdentified"));
    const secureHeaders = portalAuthHeaders();
    const response = await fetch(
      secureHeaders.Authorization
        ? `${API}/client-portal/${clientId}/messages`
        : `${API}/chat/client/${clientId}`,
      secureHeaders.Authorization ? { headers: secureHeaders } : undefined
    );
    const data = await response.json();
    chat.innerHTML = "";
    const messages = Array.isArray(data) ? data : (Array.isArray(data.messages) ? data.messages : []);
    if (!messages.length) {
      chat.innerHTML = `<div class="empty">${esc(copy("noMessages"))}</div>`;
      return;
    }
    messages.forEach(appendMessage);
  } catch (error) {
    console.warn(error);
    chat.innerHTML = `<div class="empty">${esc(copy("messagesUnavailable"))}</div>`;
  }
}

async function sendMessage() {
  const input = el("messageInput");
  const text = input.value.trim();
  if (!text || !clientId) return;
  const secureHeaders = portalAuthHeaders();
  const response = await fetch(
    secureHeaders.Authorization
      ? `${API}/client-portal/${clientId}/messages`
      : `${API}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...secureHeaders },
      body: JSON.stringify({ clientId, sender: "client", text }),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    ui.error(data.error || copy("sendMessageError"));
    return;
  }
  appendMessage(data.message || { sender: "CLIENT", text, createdAt: new Date() });
  input.value = "";
  socket.emit("sendMessage", data.message);
}

async function requestVisit() {
  const input = el("visitRequestInput");
  const text = input?.value?.trim() || "";
  if (!text || !clientId) return;
  const response = await fetch(`${API}/client-portal/${clientId}/visit-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...portalAuthHeaders() },
    body: JSON.stringify({ message: text }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    ui.error(data.error || "Nao foi possivel solicitar a visita.");
    return;
  }
  input.value = "";
  ui.success("Pedido de visita enviado com sucesso.");
  await loadCustomerExtras();
}

function updatePresence(lastSeen) {
  const text = adminOnline
    ? copy("adminOnline")
    : lastSeen
      ? copy("adminUnavailable")
      : copy("adminUnavailable");
  setText("adminStatusText", text);
}

document.addEventListener("DOMContentLoaded", async () => {
  applyLanguage(portalLanguage);
  await setupAdminClientSwitcher();
  window.setInterval(() => syncLanguageFromShell().catch(() => {}), 900);
  if (clientId) {
    socket.emit("joinClient", clientId);
    socket.emit("userOnline", { userId: `client_${clientId}` });
  }
  socket.on("newMessage", appendMessage);
  socket.on("presenceUpdate", (data) => {
    if (String(data.userId) === "admin_public") {
      adminOnline = data.online;
      updatePresence(data.lastSeen);
    }
  });
  socket.on("typing", () => {
    if (!adminOnline) return;
    setText("typing", copy("adminTyping"));
    setTimeout(() => setText("typing", ""), 2000);
  });
  el("sendBtn").onclick = sendMessage;
  if (el("visitRequestBtn")) el("visitRequestBtn").onclick = requestVisit;
  if (el("paymentNoticeBtn")) el("paymentNoticeBtn").onclick = notifyPayment;
  ["paymentNoticeAmount", "paymentNoticeMethod", "paymentNoticeNote"].forEach((id) => {
    const node = el(id);
    if (node) node.addEventListener("input", refreshPaymentWhatsappLink);
    if (node) node.addEventListener("change", refreshPaymentWhatsappLink);
  });
  el("messageInput").addEventListener("keydown", (event) => {
    socket.emit("typing", { clientId });
    if (event.key === "Enter") sendMessage();
  });
  el("photoBtn").onclick = () => el("photoInput").click();
  await loadPortal();
  if (clientId) await loadMessages();
  if (clientId) fetch(`${API}/client-messages/seen/${clientId}?actor=client`, { method: "POST" }).catch(() => {});
});
