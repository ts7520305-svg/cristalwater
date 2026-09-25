(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CWAdminCatalogue=api;}(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const languages=['pt','en','fr','es','de'];
 const groups=[
 ['Visão geral','Overview','Vue d’ensemble','Vista general','Übersicht'],['Operação','Operations','Opérations','Operación','Betrieb'],['Clientes','Clients','Clients','Clientes','Kunden'],['Piscinas','Pools','Piscines','Piscinas','Pools'],['Técnicos e equipa','Technicians and team','Techniciens et équipe','Técnicos y equipo','Techniker und Team'],['Comercial','Commercial','Commercial','Comercial','Vertrieb'],['Financeiro','Finance','Finances','Finanzas','Finanzen'],['Stock e produtos','Stock and products','Stock et produits','Stock y productos','Bestand und Produkte'],['Equipamentos','Equipment','Équipements','Equipos','Ausstattung'],['Obras e logística','Works and logistics','Travaux et logistique','Obras y logística','Arbeiten und Logistik'],['Comunicação','Communication','Communication','Comunicación','Kommunikation'],['Relatórios e estatísticas','Reports and statistics','Rapports et statistiques','Informes y estadísticas','Berichte und Statistiken'],['Configurações','Settings','Paramètres','Configuración','Einstellungen']
 ];
 const labels={
 '/admin-master-control':['Centro de operações','Operations centre','Centre des opérations','Centro de operaciones','Betriebszentrale'],
 '/admin-today':['Visitas do dia','Daily visits','Visites du jour','Visitas del día','Tagesbesuche'],
 '/admin-dashboard':['Indicadores principais','Main indicators','Indicateurs principaux','Indicadores principales','Hauptkennzahlen'],
 '/admin-alerts':['Alertas operacionais','Operational alerts','Alertes opérationnelles','Alertas operativas','Betriebsmeldungen'],
 '/alerts-financial':['Alertas financeiros','Financial alerts','Alertes financières','Alertas financieras','Finanzmeldungen'],
 '/operational-dashboard':['Resumo operacional','Operational summary','Résumé opérationnel','Resumen operativo','Betriebsübersicht'],
 '/admin-visits':['Gestão de visitas','Visit management','Gestion des visites','Gestión de visitas','Besuche verwalten'],
 '/admin-visits-dashboard':['Painel de visitas','Visit dashboard','Tableau des visites','Panel de visitas','Besuchsübersicht'],
 '/admin-rounds':['Rotas e rondas','Routes and rounds','Itinéraires et tournées','Rutas y rondas','Routen und Touren'],
 '/admin-live-map':['Localização da equipa','Team locations','Localisation de l’équipe','Ubicación del equipo','Teamstandorte'],
 '/incident-center':['Ocorrências','Incidents','Incidents','Incidencias','Vorfälle'],
 '/admin-service-log':['Histórico operacional','Operational history','Historique opérationnel','Historial operativo','Betriebsverlauf'],
 '/admin-clients':['Clientes','Clients','Clients','Clientes','Kunden'],
 '/admin-client-settings':['Preferências dos clientes','Client preferences','Préférences des clients','Preferencias de clientes','Kundeneinstellungen'],
 '/admin-crm':['CRM e oportunidades','CRM and opportunities','CRM et opportunités','CRM y oportunidades','CRM und Chancen'],
 '/communications':['Histórico de comunicações','Communication history','Historique des communications','Historial de comunicaciones','Kommunikationsverlauf'],
 '/admin-pools':['Piscinas','Pools','Piscines','Piscinas','Pools'],
 '/admin-pool-technical':['Ficha técnica e equipamentos','Technical sheet and equipment','Fiche technique et équipements','Ficha técnica y equipos','Technisches Datenblatt und Ausstattung'],
 '/admin-pool-calculator':['Análise da água e cálculos','Water analysis and calculations','Analyse de l’eau et calculs','Análisis del agua y cálculos','Wasseranalyse und Berechnungen'],
 '/admin-keys':['Chaves e acessos','Keys and access','Clés et accès','Llaves y accesos','Schlüssel und Zugang'],
 '/admin-map':['Mapa de piscinas','Pool map','Carte des piscines','Mapa de piscinas','Poolkarte'],
 '/admin-technicians':['Técnicos','Technicians','Techniciens','Técnicos','Techniker'],
 '/admin-vehicles':['Viaturas','Vehicles','Véhicules','Vehículos','Fahrzeuge'],
 '/admin-vehicles#works':['Guias de obra','Work guides','Bons de travail','Partes de trabajo','Arbeitsbelege'],
 '/admin-vehicles#guides':['Guias de transporte','Transport guides','Bons de transport','Documentos de transporte','Transportbelege'],
 '/admin-onboarding':['Entrada guiada de clientes','Guided client setup','Création guidée de clients','Alta guiada de clientes','Geführte Kundenanlage'],
 '/admin-alerts?scope=repairs':['Reparações e orçamentos','Repairs and quotes','Réparations et devis','Reparaciones y presupuestos','Reparaturen und Angebote'],
 '/repair-execution':['Execução de reparações','Repair execution','Exécution des réparations','Ejecución de reparaciones','Reparaturausführung'],
 '/admin-company-closures':['Férias e encerramentos','Holidays and closures','Congés et fermetures','Vacaciones y cierres','Urlaub und Schließzeiten'],
 '/billing':['Resumo financeiro','Financial summary','Résumé financier','Resumen financiero','Finanzübersicht'],
 '/admin-ai':['Gestão com IA','AI management','Gestion avec IA','Gestión con IA','Verwaltung mit KI'],
 '/admin-credit-revenue':['Reduções por serviço','Service reductions','Réductions de service','Reducciones por servicio','Servicekürzungen'],
 '/admin-revenue':['Repartição de mensalidades','Monthly fee allocation','Répartition des mensualités','Reparto de cuotas mensuales','Monatliche Gebührenaufteilung'],
 '/admin-expenses':['Despesas e contas a pagar','Expenses and payables','Dépenses et dettes fournisseurs','Gastos y cuentas por pagar','Ausgaben und Verbindlichkeiten'],
 '/labor-cost-bases':['Bases de custo de trabalho','Labour cost bases','Bases du coût du travail','Bases del coste laboral','Arbeitskostengrundlagen'],
 '/billing-center':['Centro de cobranças','Collections centre','Centre de recouvrement','Centro de cobros','Forderungsübersicht'],
 '/invoices':['Documentos de cobrança','Billing documents','Documents de facturation','Documentos de cobro','Abrechnungsdokumente'],
 '/admin-payments':['Pagamentos','Payments','Paiements','Pagos','Zahlungen'],
 '/admin-collection':['Contas correntes','Client accounts','Comptes clients','Cuentas de clientes','Kundenkonten'],
 '/billing-history':['Histórico financeiro','Financial history','Historique financier','Historial financiero','Finanzverlauf'],
 '/to-issue':['Documentos por emitir','Documents to issue','Documents à émettre','Documentos por emitir','Auszustellende Dokumente'],
 '/admin-payment-settings':['Revisão dos avisos de pagamento','Payment reminder review','Vérification des rappels de paiement','Revisión de avisos de pago','Zahlungserinnerungen prüfen'],
 '/admin-inventory':['Stock e inventário','Stock and inventory','Stock et inventaire','Stock e inventario','Bestand und Inventur'],
 '/admin-inventory?tab=products':['Stock do armazém','Warehouse stock','Stock de l’entrepôt','Stock del almacén','Lagerbestand'],
 '/admin-inventory?tab=movements':['Movimentos de stock','Stock movements','Mouvements de stock','Movimientos de stock','Bestandsbewegungen'],
 '/admin-suppliers':['Fornecedores','Suppliers','Fournisseurs','Proveedores','Lieferanten'],
 '/technician-chat':['Conversa da equipa','Team conversation','Conversation de l’équipe','Conversación del equipo','Teamgespräch'],
 '/chat':['Conversas com clientes','Client conversations','Conversations avec les clients','Conversaciones con clientes','Kundengespräche'],
 '/admin-notifications':['Notificações','Notifications','Notifications','Notificaciones','Benachrichtigungen'],
 '/admin-operational-settings#equipmentReminderControls':['Avisos de manutenção','Maintenance reminders','Rappels de maintenance','Avisos de mantenimiento','Wartungserinnerungen'],
 '/admin-email-logs':['Histórico de emails','Email history','Historique des emails','Historial de emails','E-Mail-Verlauf'],
 '/admin-email-review':['Revisão de envios de email','Email sending review','Vérification des envois email','Revisión de envíos de email','E-Mail-Versand prüfen'],
 '/admin-reports':['Relatórios operacionais','Operational reports','Rapports opérationnels','Informes operativos','Betriebsberichte'],
 '/report-center':['Centro de relatórios','Report centre','Centre de rapports','Centro de informes','Berichtszentrale'],
 '/report-settings':['Configuração de relatórios','Report settings','Paramètres des rapports','Configuración de informes','Berichtseinstellungen'],
 '/metrics':['Métricas','Metrics','Indicateurs','Métricas','Kennzahlen'],
 '/ranking':['Produtividade','Productivity','Productivité','Productividad','Produktivität'],
 '/admin-operational-settings':['Configurações operacionais','Operational settings','Paramètres opérationnels','Configuración operativa','Betriebseinstellungen'],
 '/admin-security':['Segurança e contas','Security and accounts','Sécurité et comptes','Seguridad y cuentas','Sicherheit und Konten'],
 '/admin-ui-settings':['Tema e interface','Theme and interface','Thème et interface','Tema e interfaz','Design und Oberfläche'],
 '/help-center':['Ajuda','Help','Aide','Ayuda','Hilfe'],
 '/settings':['Preferências da conta','Account preferences','Préférences du compte','Preferencias de la cuenta','Kontoeinstellungen'],
 '/billing-extras':['Histórico de extras','Extra service history','Historique des suppléments','Historial de extras','Zusatzleistungsverlauf'],
 '/technician-profit':['Atividade e valores por técnico','Technician activity and values','Activité et montants par technicien','Actividad e importes por técnico','Aktivität und Beträge je Techniker'],
 '/multi-map':['Visitas por técnico','Visits by technician','Visites par technicien','Visitas por técnico','Besuche je Techniker'],
 '/profit-map':['Trabalho planeado','Planned work','Travail planifié','Trabajo planificado','Geplante Arbeit'],
 '/map':['Áreas geográficas','Geographical areas','Zones géographiques','Áreas geográficas','Geografische Gebiete'],
 '/route-map':['Sugestão de rota','Route suggestion','Suggestion d’itinéraire','Sugerencia de ruta','Routenvorschlag']
 };
 const extras=[['12','/settings'],['6','/billing-extras'],['4','/technician-profit'],['1','/multi-map'],['1','/profit-map'],['3','/map'],['1','/route-map']];
 const destinations={'/admin-pool-technical':{href:'/admin-pools',context:'pool'},'/admin-inventory?tab=products':{href:'/admin-inventory#stock'},'/admin-inventory?tab=movements':{href:'/admin-inventory#movements'},'/admin-alerts?scope=repairs':{href:'/admin-alerts#commercialQuotes'}};
 const label=(values,lang)=>values[languages.indexOf(lang)>=0?languages.indexOf(lang):0];
 function safeHref(value){return typeof value==='string'&&/^\/[a-z][a-z0-9_-]*(?:\.html)?(?:\?[a-zA-Z]+=[a-zA-Z0-9_-]+)?(?:#[a-zA-Z][a-zA-Z0-9_-]*)?$/.test(value);}
 function canonical(href){if(!safeHref(href))throw Error('Invalid catalogue destination');return href.replace(/\.html(?=[?#]|$)/,'');}
 function build(navigation){
  if(!navigation||navigation.version!==1||!Array.isArray(navigation.groups)||navigation.groups.length!==groups.length)throw Error('Unavailable catalogue');const found=new Map();
  function add(group,raw,term=""){const key=canonical(raw);if(!labels[key]||!/^\d+$/.test(group)||!groups[Number(group)])throw Error('Unknown catalogue entry');if(found.has(key)){const old=found.get(key);if(!old.groups.includes(group))old.groups.push(group);old.terms.push(term);return;}const destination=destinations[key]||{href:key};if(!safeHref(destination.href))throw Error('Invalid catalogue destination');found.set(key,{key,href:destination.href,context:destination.context||null,groups:[group],labels:labels[key],terms:[term]});}
  navigation.groups.forEach((group,index)=>{if(group.id!==String(index)||!Array.isArray(group.links)||!group.links.length)throw Error('Invalid catalogue group');for(const link of group.links){if(!Array.isArray(link)||link.length!==2||typeof link[1]!=='string')throw Error('Invalid catalogue entry');add(group.id,link[0],link[1]+" "+group.label);}});for(const [group,href] of extras)add(group,href);return [...found.values()];
 }
 const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').trim();
 function filters(search){const params=new URLSearchParams(search);if([...params.keys()].some(k=>!['q','group','lang'].includes(k))||['q','group','lang'].some(k=>params.getAll(k).length>1))return null;const q=params.get('q')||'',group=params.get('group')||'',lang=params.get('lang')||'pt';if(q.length>100||/[\u0000-\u001f\u007f]/.test(q)||(group!==''&&!groups.some((_,i)=>String(i)===group))||!languages.includes(lang))return null;return {q,group,lang};}
 function search(rows,filter){const term=normalize(filter.q);return rows.filter(r=>(filter.group===''||r.groups.includes(filter.group))&&(!term||normalize([...r.labels,...r.terms,r.key,r.href,...r.groups.flatMap(g=>groups[Number(g)])].join(' ')).includes(term)));}
 function href(row,lang){if(!languages.includes(lang)||!safeHref(row.href))throw Error('Invalid link');const url=new URL(row.href,'https://catalogue.invalid');url.searchParams.set('lang',lang);return url.pathname+url.search+url.hash;}
 return {languages,groups,labels,label,canonical,safeHref,build,filters,search,href};
}));
