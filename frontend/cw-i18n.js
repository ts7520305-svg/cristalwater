// Cristal Water - idioma global PT / EN / FR / ES / DE
(function () {
  "use strict";
  if (window.__CW_I18N__) return;
  window.__CW_I18N__ = true;

  const SUPPORTED = ["pt", "en", "fr", "es", "de"];
  const STORAGE_KEY = "cw_language";
  const CLIENT_STORAGE_KEY = "cw_client_lang";
  const ATTR_ORIGINAL_TEXT = "data-cw-i18n-original";
  const ATTR_ORIGINAL_PLACEHOLDER = "data-cw-i18n-placeholder";
  const ATTR_ORIGINAL_TITLE = "data-cw-i18n-title";
  const textMemory = new WeakMap();
  let languageRevision = 0;
  let pendingRemoteWrite = Promise.resolve();

  const LANGUAGE_LABELS = {
    pt: "Português",
    en: "English",
    fr: "Français",
    es: "Español",
    de: "Deutsch",
  };

  const DICT = {
    "← Voltar": { en: "← Back", fr: "← Retour", de: "← Zurueck" },
    "Voltar": { en: "Back", fr: "Retour", de: "Zurueck" },
    "🏠 Inicio": { en: "🏠 Home", fr: "🏠 Accueil", de: "🏠 Start" },
    "🏠 Início": { en: "🏠 Home", fr: "🏠 Accueil", de: "🏠 Start" },
    "Inicio": { en: "Home", fr: "Accueil", de: "Start" },
    "Início": { en: "Home", fr: "Accueil", de: "Start" },
    "↶ Recuperar formulario": { en: "↶ Recover form", fr: "↶ Recuperer le formulaire", de: "↶ Formular wiederherstellen" },
    "↶ Recuperar formulário": { en: "↶ Recover form", fr: "↶ Recuperer le formulaire", de: "↶ Formular wiederherstellen" },
    "Recuperar formulario": { en: "Recover form", fr: "Recuperer le formulaire", de: "Formular wiederherstellen" },
    "Recuperar formulário": { en: "Recover form", fr: "Recuperer le formulaire", de: "Formular wiederherstellen" },
    "Cristal Water LDA": { en: "Cristal Water Ltd", fr: "Cristal Water LDA", de: "Cristal Water LDA" },
    "Centro de Operacoes": { en: "Operations Center", fr: "Centre des operations", de: "Betriebszentrum" },
    "Centro de Operações": { en: "Operations Center", fr: "Centre des operations", de: "Betriebszentrum" },
    "Command Center": { en: "Command Center", fr: "Centre de commande", de: "Kommandozentrale" },
    "Dashboard": { en: "Dashboard", fr: "Tableau de bord", de: "Dashboard" },
    "Hoje": { en: "Today", fr: "Aujourd'hui", de: "Heute" },
    "Mapa Live": { en: "Live Map", fr: "Carte en direct", de: "Live-Karte" },
    "Clientes": { en: "Clients", fr: "Clients", de: "Kunden" },
    "Piscinas": { en: "Pools", fr: "Piscines", de: "Pools" },
    "Chaves": { en: "Keys", fr: "Cles", de: "Schluessel" },
    "Portal do Cliente": { en: "Client Portal", fr: "Portail client", de: "Kundenportal" },
    "Alertas": { en: "Alerts", fr: "Alertes", de: "Alarme" },
    "Tecnicos": { en: "Technicians", fr: "Techniciens", de: "Techniker" },
    "Técnicos": { en: "Technicians", fr: "Techniciens", de: "Techniker" },
    "Rondas": { en: "Rounds", fr: "Tournees", de: "Routen" },
    "Visitas": { en: "Visits", fr: "Visites", de: "Besuche" },
    "Registo diario": { en: "Daily Log", fr: "Journal quotidien", de: "Tagesprotokoll" },
    "Registo diário": { en: "Daily Log", fr: "Journal quotidien", de: "Tagesprotokoll" },
    "Portal Tecnico": { en: "Technician Portal", fr: "Portail technicien", de: "Technikerportal" },
    "Portal Técnico": { en: "Technician Portal", fr: "Portail technicien", de: "Technikerportal" },
    "Stock": { en: "Stock", fr: "Stock", de: "Lager" },
    "Viaturas e Guias": { en: "Vehicles and Guides", fr: "Vehicules et documents", de: "Fahrzeuge und Nachweise" },
    "Financeiro": { en: "Finance", fr: "Finance", de: "Finanzen" },
    "Pagamentos": { en: "Payments", fr: "Paiements", de: "Zahlungen" },
    "Faturas": { en: "Invoices", fr: "Factures", de: "Rechnungen" },
    "Relatorios": { en: "Reports", fr: "Rapports", de: "Berichte" },
    "Relatórios": { en: "Reports", fr: "Rapports", de: "Berichte" },
    "Comunicacoes": { en: "Communications", fr: "Communications", de: "Kommunikation" },
    "Comunicações": { en: "Communications", fr: "Communications", de: "Kommunikation" },
    "Configuracoes": { en: "Settings", fr: "Parametres", de: "Einstellungen" },
    "Configurações": { en: "Settings", fr: "Parametres", de: "Einstellungen" },
    "Seguranca": { en: "Security", fr: "Securite", de: "Sicherheit" },
    "Segurança": { en: "Security", fr: "Securite", de: "Sicherheit" },
    "Notificacoes": { en: "Notifications", fr: "Notifications", de: "Benachrichtigungen" },
    "Notificações": { en: "Notifications", fr: "Notifications", de: "Benachrichtigungen" },
    "Guardar": { en: "Save", fr: "Enregistrer", de: "Speichern" },
    "Atualizar": { en: "Refresh", fr: "Actualiser", de: "Aktualisieren" },
    "Criar": { en: "Create", fr: "Creer", de: "Erstellen" },
    "Editar": { en: "Edit", fr: "Modifier", de: "Bearbeiten" },
    "Eliminar": { en: "Delete", fr: "Supprimer", de: "Loeschen" },
    "Arquivar": { en: "Archive", fr: "Archiver", de: "Archivieren" },
    "Restaurar": { en: "Restore", fr: "Restaurer", de: "Wiederherstellen" },
    "Pesquisar": { en: "Search", fr: "Rechercher", de: "Suchen" },
    "Limpar": { en: "Clear", fr: "Effacer", de: "Leeren" },
    "Resolver": { en: "Resolve", fr: "Resoudre", de: "Loesen" },
    "Faturar": { en: "Bill", fr: "Facturer", de: "Berechnen" },
    "Entrar": { en: "Sign in", fr: "Entrer", de: "Anmelden" },
    "Sair": { en: "Sign out", fr: "Sortir", de: "Abmelden" },
    "Email": { en: "Email", fr: "Email", de: "E-Mail" },
    "Password": { en: "Password", fr: "Mot de passe", de: "Passwort" },
    "Mostrar": { en: "Show", fr: "Afficher", de: "Anzeigen" },
    "Ocultar": { en: "Hide", fr: "Masquer", de: "Ausblenden" },
    "Acesso reservado": { en: "Restricted access", fr: "Acces reserve", de: "Geschuetzter Zugang" },
    "Entrar no sistema": { en: "Sign in to the system", fr: "Connexion au systeme", de: "Beim System anmelden" },
    "Administrador": { en: "Administrator", fr: "Administrateur", de: "Administrator" },
    "Tecnico": { en: "Technician", fr: "Technicien", de: "Techniker" },
    "Técnico": { en: "Technician", fr: "Technicien", de: "Techniker" },
    "Cliente": { en: "Client", fr: "Client", de: "Kunde" },
    "Seguro": { en: "Secure", fr: "Securise", de: "Sicher" },
    "Auditavel": { en: "Auditable", fr: "Auditable", de: "Pruefbar" },
    "Auditável": { en: "Auditable", fr: "Auditable", de: "Pruefbar" },
    "Mobile": { en: "Mobile", fr: "Mobile", de: "Mobil" },
    "Uso exclusivo de utilizadores autorizados.": { en: "Exclusive use by authorized users.", fr: "Usage reserve aux utilisateurs autorises.", de: "Nur fuer autorisierte Nutzer." },
    "Privacidade e protecao de dados": { en: "Privacy and data protection", fr: "Confidentialite et protection des donnees", de: "Datenschutz und Datensicherheit" },
    "Privacidade e proteção de dados": { en: "Privacy and data protection", fr: "Confidentialite et protection des donnees", de: "Datenschutz und Datensicherheit" },
    "Todos os direitos reservados.": { en: "All rights reserved.", fr: "Tous droits reserves.", de: "Alle Rechte vorbehalten." },
    "Versao Enterprise": { en: "Enterprise version", fr: "Version Enterprise", de: "Enterprise-Version" },
    "Versão Enterprise": { en: "Enterprise version", fr: "Version Enterprise", de: "Enterprise-Version" },
    "Uso interno": { en: "Internal use", fr: "Usage interne", de: "Interne Nutzung" },
    "Ativo": { en: "Active", fr: "Actif", de: "Aktiv" },
    "Inativo": { en: "Inactive", fr: "Inactif", de: "Inaktiv" },
    "Pendente": { en: "Pending", fr: "En attente", de: "Ausstehend" },
    "Pago": { en: "Paid", fr: "Paye", de: "Bezahlt" },
    "Em atraso": { en: "Overdue", fr: "En retard", de: "Ueberfaellig" },
    "Concluido": { en: "Completed", fr: "Termine", de: "Abgeschlossen" },
    "Concluído": { en: "Completed", fr: "Termine", de: "Abgeschlossen" },
    "Planeado": { en: "Planned", fr: "Planifie", de: "Geplant" },
    "A caminho": { en: "On the way", fr: "En route", de: "Unterwegs" },
    "Em curso": { en: "In progress", fr: "En cours", de: "In Arbeit" },
    "Cancelado": { en: "Cancelled", fr: "Annule", de: "Storniert" },
    "Resolvido": { en: "Resolved", fr: "Resolu", de: "Geloest" },
    "Nome": { en: "Name", fr: "Nom", de: "Name" },
    "Telefone": { en: "Phone", fr: "Telephone", de: "Telefon" },
    "Zona": { en: "Zone", fr: "Zone", de: "Zone" },
    "Morada": { en: "Address", fr: "Adresse", de: "Adresse" },
    "Notas": { en: "Notes", fr: "Notes", de: "Notizen" },
    "Pesquisar por cliente, zona, piscina, jacuzzi, local, telefone ou email": {
      en: "Search by client, zone, pool, jacuzzi, location, phone or email",
      fr: "Rechercher par client, zone, piscine, jacuzzi, lieu, telephone ou email",
      de: "Nach Kunde, Zone, Pool, Jacuzzi, Ort, Telefon oder E-Mail suchen",
    },
    "Use as credenciais atribuidas pela Cristal Water. O sistema encaminha automaticamente para a area correta.": {
      en: "Use the credentials assigned by Cristal Water. The system will open the correct area automatically.",
      fr: "Utilisez les identifiants attribues par Cristal Water. Le systeme ouvre automatiquement la bonne zone.",
      de: "Verwenden Sie die von Cristal Water zugewiesenen Zugangsdaten. Das System oeffnet automatisch den richtigen Bereich.",
    },
    "Gestao profissional de piscinas, assistencia e operacao em campo.": {
      en: "Professional pool management, service and field operations.",
      fr: "Gestion professionnelle des piscines, assistance et operations terrain.",
      de: "Professionelles Poolmanagement, Service und Feldeinsatz.",
    },
    "Gestão profissional de piscinas, assistência e operação em campo.": {
      en: "Professional pool management, service and field operations.",
      fr: "Gestion professionnelle des piscines, assistance et operations terrain.",
      de: "Professionelles Poolmanagement, Service und Feldeinsatz.",
    },
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function canonicalText(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[ãÃ]/g, "a")
      .replace(/[õÕ]/g, "o")
      .replace(/[çÇ]/g, "c")
      .replace(/[áàâÁÀÂ]/g, "a")
      .replace(/[éêÉÊ]/g, "e")
      .replace(/[íÍ]/g, "i")
      .replace(/[óôÓÔ]/g, "o")
      .replace(/[úÚ]/g, "u")
      .replace(/[ºª]/g, "")
      .replace(/[·]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  Object.assign(DICT, {
    "Area privada Cristal Water.": {
      en: "Private Cristal Water area.",
      fr: "Espace prive Cristal Water.",
      de: "Privater Bereich von Cristal Water.",
    },
    "Area reservada": {
      en: "Restricted area",
      fr: "Espace reserve",
      de: "Geschuetzter Bereich",
    },
    "Swimming Pools - Area reservada": {
      en: "Swimming Pools - Restricted area",
      fr: "Swimming Pools - Espace reserve",
      de: "Swimming Pools - Geschuetzter Bereich",
    },
    "Plataforma reservada da Cristal Water. Acesso controlado, informacao confidencial e utilizacao exclusiva por pessoas autorizadas.": {
      en: "Reserved Cristal Water platform. Controlled access, confidential information and exclusive use by authorized people.",
      fr: "Plateforme reservee Cristal Water. Acces controle, information confidentielle et usage exclusif par les personnes autorisees.",
      de: "Reservierte Cristal Water Plattform. Kontrollierter Zugang, vertrauliche Informationen und ausschliessliche Nutzung durch autorisierte Personen.",
    },
    "Use apenas as credenciais atribuidas pela Cristal Water.": {
      en: "Use only the credentials assigned by Cristal Water.",
      fr: "Utilisez uniquement les identifiants attribues par Cristal Water.",
      de: "Verwenden Sie nur die von Cristal Water zugewiesenen Zugangsdaten.",
    },
    "O acesso indevido e proibido. As operacoes realizadas no sistema podem ser registadas para seguranca, auditoria e melhoria do servico.": {
      en: "Unauthorized access is prohibited. Actions may be logged for security, audit and service improvement.",
      fr: "L'acces non autorise est interdit. Les actions peuvent etre journalisees pour la securite, l'audit et l'amelioration du service.",
      de: "Unbefugter Zugriff ist verboten. Aktionen koennen fuer Sicherheit, Audit und Serviceverbesserung protokolliert werden.",
    },
    "Os dados sao tratados no ambito da prestacao de servicos da Cristal Water, de acordo com o RGPD e regras internas de confidencialidade.": {
      en: "Data is processed as part of Cristal Water service delivery, in line with GDPR and internal confidentiality rules.",
      fr: "Les donnees sont traitees dans le cadre des services Cristal Water, conformement au RGPD et aux regles internes de confidentialite.",
      de: "Daten werden im Rahmen der Dienstleistungen von Cristal Water gemaess DSGVO und internen Vertraulichkeitsregeln verarbeitet.",
    },
    "Apenas para utilizadores autorizados.": {
      en: "For authorized users only.",
      fr: "Reserve aux utilisateurs autorises.",
      de: "Nur fuer autorisierte Nutzer.",
    },
    "Informacao tratada com confidencialidade.": {
      en: "Information handled confidentially.",
      fr: "Informations traitees de maniere confidentielle.",
      de: "Informationen werden vertraulich behandelt.",
    },
    "Utilizacao sujeita as regras internas.": {
      en: "Use subject to internal rules.",
      fr: "Utilisation soumise aux regles internes.",
      de: "Nutzung gemaess internen Regeln.",
    },
    "Entrada guiada": { en: "Guided entry", fr: "Entree guidee", de: "Gefuehrte Eingabe" },
    "Faturacao Oficial": { en: "Official invoicing", fr: "Facturation officielle", de: "Offizielle Rechnungsstellung" },
    "Lembretes e Agendamentos": { en: "Reminders and schedules", fr: "Rappels et planifications", de: "Erinnerungen und Termine" },
    "Visual": { en: "Visual", fr: "Visuel", de: "Darstellung" },
    "Operacao": { en: "Operations", fr: "Operations", de: "Betrieb" },
    "Clientes e Piscinas": { en: "Clients and pools", fr: "Clients et piscines", de: "Kunden und Pools" },
    "Equipa e Servico": { en: "Team and service", fr: "Equipe et service", de: "Team und Service" },
    "Gestao": { en: "Management", fr: "Gestion", de: "Verwaltung" },
    "Organizacao": { en: "Organization", fr: "Organisation", de: "Organisation" },
    "Sistema": { en: "System", fr: "Systeme", de: "System" },
  });

  const SPANISH_BY_ENGLISH = {
  "← Back": "← Volver",
  "Back": "Volver",
  "🏠 Home": "🏠 Inicio",
  "Home": "Inicio",
  "↶ Recover form": "↶ Recuperar formulario",
  "Recover form": "Recuperar formulario",
  "Cristal Water Ltd": "Cristal Water LDA",
  "Operations Center": "Centro de operaciones",
  "Command Center": "Centro de control",
  "Dashboard": "Panel de control",
  "Today": "Hoy",
  "Live Map": "Mapa en directo",
  "Clients": "Clientes",
  "Pools": "Piscinas",
  "Keys": "Llaves",
  "Client Portal": "Portal del cliente",
  "Alerts": "Alertas",
  "Technicians": "Técnicos",
  "Rounds": "Rondas",
  "Visits": "Visitas",
  "Daily Log": "Registro diario",
  "Technician Portal": "Portal del técnico",
  "Stock": "Existencias",
  "Vehicles and Guides": "Vehículos y documentos de transporte",
  "Finance": "Finanzas",
  "Payments": "Pagos",
  "Invoices": "Facturas",
  "Reports": "Informes",
  "Communications": "Comunicaciones",
  "Settings": "Configuración",
  "Security": "Seguridad",
  "Notifications": "Notificaciones",
  "Save": "Guardar",
  "Refresh": "Actualizar",
  "Create": "Crear",
  "Edit": "Editar",
  "Delete": "Eliminar",
  "Archive": "Archivar",
  "Restore": "Restaurar",
  "Search": "Buscar",
  "Clear": "Limpiar",
  "Resolve": "Resolver",
  "Bill": "Facturar",
  "Sign in": "Iniciar sesión",
  "Sign out": "Cerrar sesión",
  "Email": "Correo electrónico",
  "Password": "Contraseña",
  "Show": "Mostrar",
  "Hide": "Ocultar",
  "Restricted access": "Acceso restringido",
  "Sign in to the system": "Entrar en el sistema",
  "Administrator": "Administrador",
  "Technician": "Técnico",
  "Client": "Cliente",
  "Secure": "Seguro",
  "Auditable": "Auditable",
  "Mobile": "Móvil",
  "Exclusive use by authorized users.": "Uso exclusivo de usuarios autorizados.",
  "Privacy and data protection": "Privacidad y protección de datos",
  "All rights reserved.": "Todos los derechos reservados.",
  "Enterprise version": "Versión Enterprise",
  "Internal use": "Uso interno",
  "Active": "Activo",
  "Inactive": "Inactivo",
  "Pending": "Pendiente",
  "Paid": "Pagado",
  "Overdue": "Vencido",
  "Completed": "Finalizado",
  "Planned": "Programado",
  "On the way": "En camino",
  "In progress": "En curso",
  "Cancelled": "Cancelado",
  "Resolved": "Resuelto",
  "Name": "Nombre",
  "Phone": "Teléfono",
  "Zone": "Zona",
  "Address": "Dirección",
  "Notes": "Notas",
  "Search by client, zone, pool, jacuzzi, location, phone or email": "Buscar por cliente, zona, piscina, jacuzzi, ubicación, teléfono o correo electrónico",
  "Use the credentials assigned by Cristal Water. The system will open the correct area automatically.": "Utilice las credenciales asignadas por Cristal Water. El sistema abrirá automáticamente el área correspondiente.",
  "Professional pool management, service and field operations.": "Gestión profesional de piscinas, asistencia y trabajo en campo.",
  "Private Cristal Water area.": "Área privada de Cristal Water.",
  "Restricted area": "Área restringida",
  "Swimming Pools - Restricted area": "Swimming Pools - Área restringida",
  "Reserved Cristal Water platform. Controlled access, confidential information and exclusive use by authorized people.": "Plataforma privada de Cristal Water. Acceso controlado, información confidencial y uso exclusivo de personas autorizadas.",
  "Use only the credentials assigned by Cristal Water.": "Utilice únicamente las credenciales asignadas por Cristal Water.",
  "Unauthorized access is prohibited. Actions may be logged for security, audit and service improvement.": "Se prohíbe el acceso no autorizado. Las operaciones pueden registrarse para seguridad, auditoría y mejora del servicio.",
  "Data is processed as part of Cristal Water service delivery, in line with GDPR and internal confidentiality rules.": "Los datos se tratan como parte de los servicios de Cristal Water, de acuerdo con el RGPD y las normas internas de confidencialidad.",
  "For authorized users only.": "Solo para usuarios autorizados.",
  "Information handled confidentially.": "Información tratada de forma confidencial.",
  "Use subject to internal rules.": "Uso sujeto a las normas internas.",
  "Guided entry": "Entrada guiada",
  "Official invoicing": "Facturación oficial",
  "Reminders and schedules": "Recordatorios y programación",
  "Visual": "Aspecto visual",
  "Operations": "Operaciones",
  "Clients and pools": "Clientes y piscinas",
  "Team and service": "Equipo y servicio",
  "Management": "Gestión",
  "Organization": "Organización",
  "System": "Sistema"
};
  Object.values(DICT).forEach(entry => { entry.es = SPANISH_BY_ENGLISH[entry.en]; });
  Object.assign(DICT, {
  "Água aberta": {
    "en": "Water running",
    "fr": "Eau ouverte",
    "es": "Agua abierta",
    "de": "Wasser läuft"
  },
  "Fechar água": {
    "en": "Turn off water",
    "fr": "Fermer l’eau",
    "es": "Cerrar el agua",
    "de": "Wasser abstellen"
  },
  "Bomba em manual": {
    "en": "Pump in manual mode",
    "fr": "Pompe en mode manuel",
    "es": "Bomba en modo manual",
    "de": "Pumpe im Handbetrieb"
  },
  "Falta de química": {
    "en": "Chemicals unavailable",
    "fr": "Produits chimiques manquants",
    "es": "Faltan productos químicos",
    "de": "Chemikalien fehlen"
  },
  "Sem rede": {
    "en": "No connection",
    "fr": "Sans connexion",
    "es": "Sin conexión",
    "de": "Keine Verbindung"
  },
  "Sincronização pendente": {
    "en": "Sync pending",
    "fr": "Synchronisation en attente",
    "es": "Sincronización pendiente",
    "de": "Synchronisierung ausstehend"
  },
  "Piscinas do dia": {
    "en": "Today’s pools",
    "fr": "Piscines du jour",
    "es": "Piscinas del día",
    "de": "Heutige Pools"
  },
  "Confirmar": {
    "en": "Confirm",
    "fr": "Confirmer",
    "es": "Confirmar",
    "de": "Bestätigen"
  },
  "Iniciar visita": {
    "en": "Start visit",
    "fr": "Commencer la visite",
    "es": "Iniciar visita",
    "de": "Besuch starten"
  },
  "Concluir visita": {
    "en": "Complete visit",
    "fr": "Terminer la visite",
    "es": "Finalizar visita",
    "de": "Besuch abschließen"
  },
  "Fotografias": {
    "en": "Photos",
    "fr": "Photos",
    "es": "Fotografías",
    "de": "Fotos"
  },
  "Cloro livre": {
    "en": "Free chlorine",
    "fr": "Chlore libre",
    "es": "Cloro libre",
    "de": "Freies Chlor"
  },
  "Cloro total": {
    "en": "Total chlorine",
    "fr": "Chlore total",
    "es": "Cloro total",
    "de": "Gesamtchlor"
  },
  "Alcalinidade": {
    "en": "Alkalinity",
    "fr": "Alcalinité",
    "es": "Alcalinidad",
    "de": "Alkalinität"
  },
  "Dureza": {
    "en": "Hardness",
    "fr": "Dureté",
    "es": "Dureza",
    "de": "Härte"
  },
  "Temperatura": {
    "en": "Temperature",
    "fr": "Température",
    "es": "Temperatura",
    "de": "Temperatur"
  }
});

  Object.assign(DICT,{
  "Falta de produtos químicos": {
    "en": "Chemicals unavailable",
    "fr": "Produits chimiques manquants",
    "es": "Faltan productos químicos",
    "de": "Chemikalien fehlen"
  },
  "Acesso impedido": {
    "en": "Access blocked",
    "fr": "Accès bloqué",
    "es": "Acceso bloqueado",
    "de": "Zugang gesperrt"
  },
  "Chave indisponível ou incorreta": {
    "en": "Key missing or incorrect",
    "fr": "Clé manquante ou incorrecte",
    "es": "Llave no disponible o incorrecta",
    "de": "Schlüssel fehlt oder ist falsch"
  },
  "Cliente impediu o serviço": {
    "en": "Client refused service",
    "fr": "Service refusé par le client",
    "es": "El cliente impidió el servicio",
    "de": "Kunde hat den Service abgelehnt"
  },
  "Falta de material": {
    "en": "Materials unavailable",
    "fr": "Matériel manquant",
    "es": "Falta de material",
    "de": "Material fehlt"
  },
  "Equipamento avariado": {
    "en": "Equipment failure",
    "fr": "Équipement en panne",
    "es": "Equipo averiado",
    "de": "Gerät defekt"
  },
  "Condições meteorológicas": {
    "en": "Weather conditions",
    "fr": "Conditions météorologiques",
    "es": "Condiciones meteorológicas",
    "de": "Wetterbedingungen"
  },
  "Outro motivo": {
    "en": "Other reason",
    "fr": "Autre motif",
    "es": "Otro motivo",
    "de": "Anderer Grund"
  },
  "Escolher motivo": {
    "en": "Choose a reason",
    "fr": "Choisir un motif",
    "es": "Elegir motivo",
    "de": "Grund auswählen"
  },
  "Água aberta ativa": {
    "en": "Water still running",
    "fr": "Eau toujours ouverte",
    "es": "Agua todavía abierta",
    "de": "Wasser läuft noch"
  },
  "P0 - Agua aberta": {
    "en": "P0 - Water running",
    "fr": "P0 - Eau ouverte",
    "es": "P0 - Agua abierta",
    "de": "P0 - Wasser läuft"
  },
  "P0 - Bomba em manual": {
    "en": "P0 - Pump in manual mode",
    "fr": "P0 - Pompe en mode manuel",
    "es": "P0 - Bomba en modo manual",
    "de": "P0 - Pumpe im Handbetrieb"
  },
  "Sincronizar fotografias": {
    "en": "Sync photos",
    "fr": "Synchroniser les photos",
    "es": "Sincronizar fotografías",
    "de": "Fotos synchronisieren"
  },
  "Rede disponível": {
    "en": "Connection available",
    "fr": "Connexion disponible",
    "es": "Conexión disponible",
    "de": "Verbindung verfügbar"
  }
});
  Object.assign(DICT, {
    'Repetir confirmação': { en: 'Retry confirmation', fr: 'Réessayer la confirmation', es: 'Reintentar confirmación', de: 'Bestätigung erneut versuchen' },
    'Corrigir dados': { en: 'Correct details', fr: 'Corriger les données', es: 'Corregir datos', de: 'Angaben korrigieren' },
    'Pedido por confirmar': { en: 'Awaiting confirmation', fr: 'Confirmation en attente', es: 'Pendiente de confirmación', de: 'Bestätigung ausstehend' },
    'Pedido recusado': { en: 'Request rejected', fr: 'Demande refusée', es: 'Solicitud rechazada', de: 'Anfrage abgelehnt' },
    'Pedido pendente recuperado. Usa Repetir confirmação.': { en: 'Pending request recovered. Select Retry confirmation.', fr: 'Demande en attente récupérée. Sélectionnez Réessayer la confirmation.', es: 'Solicitud pendiente recuperada. Selecciona Reintentar confirmación.', de: 'Ausstehende Anfrage wiederhergestellt. Wählen Sie Bestätigung erneut versuchen.' },
    'A confirmar criação do lembrete…': { en: 'Confirming reminder creation…', fr: 'Confirmation de la création du rappel…', es: 'Confirmando la creación del recordatorio…', de: 'Erstellung der Erinnerung wird bestätigt…' },
    'Lembrete criado.': { en: 'Reminder created.', fr: 'Rappel créé.', es: 'Recordatorio creado.', de: 'Erinnerung erstellt.' },
    'Criação confirmada. Foi recuperado o lembrete original.': { en: 'Creation confirmed. The original reminder was recovered.', fr: 'Création confirmée. Le rappel original a été récupéré.', es: 'Creación confirmada. Se ha recuperado el recordatorio original.', de: 'Erstellung bestätigt. Die ursprüngliche Erinnerung wurde wiederhergestellt.' },
    'Ainda não foi possível confirmar a criação. O pedido foi guardado; usa Repetir confirmação, mesmo depois de reabrir a página.': { en: 'Creation could not be confirmed yet. The request was saved; select Retry confirmation, even after reopening the page.', fr: 'La création ne peut pas encore être confirmée. La demande est enregistrée ; sélectionnez Réessayer la confirmation, même après avoir rouvert la page.', es: 'Todavía no se ha podido confirmar la creación. La solicitud se ha guardado; selecciona Reintentar confirmación, incluso después de volver a abrir la página.', de: 'Die Erstellung konnte noch nicht bestätigt werden. Die Anfrage wurde gespeichert. Wählen Sie Bestätigung erneut versuchen, auch nach dem erneuten Öffnen der Seite.' },
    'Lembrete criado. Atualiza a página para consultar a lista.': { en: 'Reminder created. Refresh the page to view the list.', fr: 'Rappel créé. Actualisez la page pour consulter la liste.', es: 'Recordatorio creado. Actualiza la página para consultar la lista.', de: 'Erinnerung erstellt. Aktualisieren Sie die Seite, um die Liste anzuzeigen.' },
  });

  Object.assign(DICT, {
    'Notas da piscina': { en: 'Pool notes', fr: 'Consignes de la piscine', es: 'Notas de la piscina', de: 'Poolhinweise' },
    'Lembrete recorrente atrasado': { en: 'Overdue recurring reminder', fr: 'Rappel récurrent en retard', es: 'Recordatorio recurrente vencido', de: 'Überfällige wiederkehrende Erinnerung' },
    'Lembrete recorrente': { en: 'Recurring reminder', fr: 'Rappel récurrent', es: 'Recordatorio recurrente', de: 'Wiederkehrende Erinnerung' },
    'Lembrete atrasado': { en: 'Overdue reminder', fr: 'Rappel en retard', es: 'Recordatorio vencido', de: 'Überfällige Erinnerung' },
    'Lembrete pontual': { en: 'One-time reminder', fr: 'Rappel ponctuel', es: 'Recordatorio puntual', de: 'Einmalige Erinnerung' },
    'Check-in obrigatório': { en: 'Required check-in', fr: 'Confirmation obligatoire', es: 'Confirmación obligatoria', de: 'Bestätigung erforderlich' },
    'Antes de começar': { en: 'Before you start', fr: 'Avant de commencer', es: 'Antes de empezar', de: 'Bevor Sie beginnen' },
    'Li e vou iniciar a visita': { en: 'I have read this; start visit', fr: 'J’ai lu les consignes ; commencer la visite', es: 'He leído las instrucciones; iniciar visita', de: 'Gelesen; Besuch starten' },
    'Sem código, nota ou lembrete registado': { en: 'No access code, note or reminder recorded', fr: 'Aucun code d’accès, consigne ou rappel enregistré', es: 'No hay códigos, notas ni recordatorios registrados', de: 'Kein Zugangscode, Hinweis oder Erinnerung gespeichert' },
  });
  Object.assign(DICT, {
    'Eliminar lembrete': { en: 'Delete reminder', fr: 'Supprimer le rappel', es: 'Eliminar recordatorio', de: 'Erinnerung löschen' },
    'Eliminar este lembrete? O histórico técnico e as visitas são mantidos.': { en: 'Delete this reminder? Technical history and visits are retained.', fr: 'Supprimer ce rappel ? L’historique technique et les visites sont conservés.', es: '¿Eliminar este recordatorio? Se conservan el historial técnico y las visitas.', de: 'Diese Erinnerung löschen? Technischer Verlauf und Besuche bleiben erhalten.' },
    'Atualiza a página antes de eliminar este lembrete.': { en: 'Refresh the page before deleting this reminder.', fr: 'Actualisez la page avant de supprimer ce rappel.', es: 'Actualiza la página antes de eliminar este recordatorio.', de: 'Aktualisieren Sie die Seite, bevor Sie diese Erinnerung löschen.' },
    'O lembrete mudou. Atualiza a lista e confirma novamente.': { en: 'The reminder changed. Refresh the list and confirm again.', fr: 'Le rappel a changé. Actualisez la liste et confirmez à nouveau.', es: 'El recordatorio ha cambiado. Actualiza la lista y vuelve a confirmar.', de: 'Die Erinnerung wurde geändert. Aktualisieren Sie die Liste und bestätigen Sie erneut.' },
    'A confirmar eliminação…': { en: 'Confirming deletion…', fr: 'Confirmation de la suppression…', es: 'Confirmando eliminación…', de: 'Löschung wird bestätigt…' },
    'O lembrete mudou ou já não está disponível. Atualiza a página e confirma novamente.': { en: 'The reminder changed or is no longer available. Refresh the page and confirm again.', fr: 'Le rappel a changé ou n’est plus disponible. Actualisez la page et confirmez à nouveau.', es: 'El recordatorio ha cambiado o ya no está disponible. Actualiza la página y vuelve a confirmar.', de: 'Die Erinnerung wurde geändert oder ist nicht mehr verfügbar. Aktualisieren Sie die Seite und bestätigen Sie erneut.' },
    'Eliminação confirmada. O lembrete já tinha sido eliminado.': { en: 'Deletion confirmed. The reminder had already been deleted.', fr: 'Suppression confirmée. Le rappel avait déjà été supprimé.', es: 'Eliminación confirmada. El recordatorio ya se había eliminado.', de: 'Löschung bestätigt. Die Erinnerung war bereits gelöscht.' },
    'Lembrete eliminado.': { en: 'Reminder deleted.', fr: 'Rappel supprimé.', es: 'Recordatorio eliminado.', de: 'Erinnerung gelöscht.' },
    'Lembrete eliminado. Atualiza a página para consultar a lista.': { en: 'Reminder deleted. Refresh the page to view the list.', fr: 'Rappel supprimé. Actualisez la page pour consulter la liste.', es: 'Recordatorio eliminado. Actualiza la página para consultar la lista.', de: 'Erinnerung gelöscht. Aktualisieren Sie die Seite, um die Liste anzuzeigen.' },
    'Ainda não foi possível confirmar a eliminação. Podes voltar a eliminar este mesmo lembrete para verificar o resultado.': { en: 'Deletion could not be confirmed yet. Delete this same reminder again to check the result.', fr: 'La suppression n’a pas encore pu être confirmée. Supprimez à nouveau ce même rappel pour vérifier le résultat.', es: 'Aún no se ha podido confirmar la eliminación. Vuelve a eliminar este mismo recordatorio para comprobar el resultado.', de: 'Die Löschung konnte noch nicht bestätigt werden. Löschen Sie dieselbe Erinnerung erneut, um das Ergebnis zu prüfen.' },
    'A sessão mudou. Reabre a página para continuar com a conta atual.': { en: 'The session changed. Reopen the page to continue with the current account.', fr: 'La session a changé. Rouvrez la page pour continuer avec le compte actuel.', es: 'La sesión ha cambiado. Vuelve a abrir la página para continuar con la cuenta actual.', de: 'Die Sitzung wurde geändert. Öffnen Sie die Seite erneut, um mit dem aktuellen Konto fortzufahren.' },
  });

  Object.assign(DICT, {
    'Não foi possível ler os lembretes. Atualiza a página.': { en: 'Could not load reminders. Refresh the page.', fr: 'Impossible de charger les rappels. Actualisez la page.', es: 'No se pudieron cargar los recordatorios. Actualiza la página.', de: 'Erinnerungen konnten nicht geladen werden. Aktualisieren Sie die Seite.' },
    'A confirmar conclusão do lembrete…': { en: 'Confirming reminder completion…', fr: 'Confirmation de la clôture du rappel…', es: 'Confirmando finalización del recordatorio…', de: 'Abschluss der Erinnerung wird bestätigt…' },
    'Lembrete concluído.': { en: 'Reminder completed.', fr: 'Rappel terminé.', es: 'Recordatorio completado.', de: 'Erinnerung abgeschlossen.' },
    'Lembrete concluído. A próxima ocorrência já está na lista.': { en: 'Reminder completed. The next occurrence is now in the list.', fr: 'Rappel terminé. La prochaine occurrence figure dans la liste.', es: 'Recordatorio completado. La próxima ocurrencia ya está en la lista.', de: 'Erinnerung abgeschlossen. Der nächste Termin steht jetzt in der Liste.' },
    'Conclusão confirmada. O lembrete já estava concluído.': { en: 'Completion confirmed. The reminder was already completed.', fr: 'Clôture confirmée. Le rappel était déjà terminé.', es: 'Finalización confirmada. El recordatorio ya estaba completado.', de: 'Abschluss bestätigt. Die Erinnerung war bereits abgeschlossen.' },
    'Lembrete concluído. Atualiza a página para consultar a lista.': { en: 'Reminder completed. Refresh the page to view the list.', fr: 'Rappel terminé. Actualisez la page pour consulter la liste.', es: 'Recordatorio completado. Actualiza la página para consultar la lista.', de: 'Erinnerung abgeschlossen. Aktualisieren Sie die Seite, um die Liste anzuzeigen.' },
    'Ainda não foi possível confirmar a conclusão. Podes repetir sem duplicar a próxima ocorrência.': { en: 'Completion could not be confirmed yet. You can retry without duplicating the next occurrence.', fr: 'La clôture n’a pas encore pu être confirmée. Vous pouvez réessayer sans dupliquer la prochaine occurrence.', es: 'Aún no se ha podido confirmar la finalización. Puedes reintentar sin duplicar la próxima ocurrencia.', de: 'Der Abschluss konnte noch nicht bestätigt werden. Sie können es erneut versuchen, ohne den nächsten Termin zu duplizieren.' },
    'O lembrete já não pode ser concluído. Atualiza a lista antes de tentar novamente.': { en: 'This reminder can no longer be completed. Refresh the list before trying again.', fr: 'Ce rappel ne peut plus être terminé. Actualisez la liste avant de réessayer.', es: 'Este recordatorio ya no se puede completar. Actualiza la lista antes de volver a intentarlo.', de: 'Diese Erinnerung kann nicht mehr abgeschlossen werden. Aktualisieren Sie die Liste vor einem erneuten Versuch.' },
  });

  Object.assign(DICT, {
  "A aprovação regista a decisão. Para alterar valores, reveja e guarde a ficha técnica.": {
    "en": "Approval records the decision. To change values, review and save the technical sheet.",
    "fr": "L’approbation enregistre la décision. Pour modifier les valeurs, vérifiez et enregistrez la fiche technique.",
    "es": "La aprobación registra la decisión. Para cambiar valores, revise y guarde la ficha técnica.",
    "de": "Die Freigabe hält die Entscheidung fest. Um Werte zu ändern, das technische Datenblatt prüfen und speichern."
  },
  "Integridade do histórico": {
    "en": "History integrity",
    "fr": "Intégrité de l’historique",
    "es": "Integridad del historial",
    "de": "Integrität des Verlaufs"
  },
  "Integridade do histórico por carregar.": {
    "en": "History integrity not loaded yet.",
    "fr": "Intégrité de l’historique pas encore chargée.",
    "es": "Integridad del historial pendiente de cargar.",
    "de": "Integrität des Verlaufs noch nicht geladen."
  },
  "A consultar propostas...": {
    "en": "Loading proposals...",
    "fr": "Chargement des propositions...",
    "es": "Cargando propuestas...",
    "de": "Vorschläge werden geladen..."
  },
  "Não foi possível consultar as propostas. Atualize antes de repetir um envio.": {
    "en": "Could not load proposals. Refresh before sending again.",
    "fr": "Impossible de charger les propositions. Actualisez avant un nouvel envoi.",
    "es": "No se pudieron consultar las propuestas. Actualice antes de volver a enviar.",
    "de": "Vorschläge konnten nicht geladen werden. Vor erneutem Senden aktualisieren."
  },
  "Atualize as propostas antes de decidir.": {
    "en": "Refresh proposals before deciding.",
    "fr": "Actualisez les propositions avant de décider.",
    "es": "Actualice las propuestas antes de decidir.",
    "de": "Vorschläge vor der Entscheidung aktualisieren."
  },
  "Sem confirmação completa do lote. Consulte as propostas antes de repetir.": {
    "en": "The batch was not fully confirmed. Check the proposals before retrying.",
    "fr": "Le lot n’a pas été entièrement confirmé. Consultez les propositions avant de réessayer.",
    "es": "El lote no se ha confirmado por completo. Consulte las propuestas antes de reintentar.",
    "de": "Der Stapel wurde nicht vollständig bestätigt. Vorschläge vor einem erneuten Versuch prüfen."
  },
  "Sem confirmação da decisão. Consulte a proposta antes de repetir.": {
    "en": "The decision was not confirmed. Check the proposal before retrying.",
    "fr": "La décision n’a pas été confirmée. Consultez la proposition avant de réessayer.",
    "es": "La decisión no se ha confirmado. Consulte la propuesta antes de reintentar.",
    "de": "Die Entscheidung wurde nicht bestätigt. Vorschlag vor einem erneuten Versuch prüfen."
  },
  "Sem confirmação da proposta. Consulte a lista antes de repetir.": {
    "en": "The proposal was not confirmed. Check the list before retrying.",
    "fr": "La proposition n’a pas été confirmée. Consultez la liste avant de réessayer.",
    "es": "La propuesta no se ha confirmado. Consulte la lista antes de reintentar.",
    "de": "Der Vorschlag wurde nicht bestätigt. Liste vor einem erneuten Versuch prüfen."
  },
  "A sessão ou a piscina mudou. Consulte as propostas da piscina original.": {
    "en": "The session or pool changed. Check the original pool’s proposals.",
    "fr": "La session ou la piscine a changé. Consultez les propositions de la piscine initiale.",
    "es": "La sesión o la piscina ha cambiado. Consulte las propuestas de la piscina original.",
    "de": "Sitzung oder Pool wurde geändert. Vorschläge des ursprünglichen Pools prüfen."
  }
});

  const CANON_DICT = Object.entries(DICT).reduce((acc, [key, value]) => {
    acc[canonicalText(key)] = value;
    return acc;
  }, {});

  function normalizeLanguage(value) {
    const raw = String(value || "pt").trim().toLowerCase();
    if (["pt", "pt-pt", "portugues", "portuguese"].includes(raw)) return "pt";
    if (["en", "en-gb", "en-us", "ing", "ingles", "english"].includes(raw)) return "en";
    if (["fr", "fr-fr", "frances", "french"].includes(raw)) return "fr";
    if (["es", "es-es", "espanhol", "español", "spanish"].includes(raw)) return "es";
    if (["de", "de-de", "alemao", "alemão", "german", "deutsch"].includes(raw)) return "de";
    const short = raw.slice(0, 2);
    return SUPPORTED.includes(short) ? short : "pt";
  }

  function token() {
    return window.CristalAuth?.getToken?.()
      || localStorage.getItem("cristalwater_jwt")
      || localStorage.getItem("token")
      || localStorage.getItem("adminToken")
      || "";
  }

  function parseUser() {
    if (window.CristalAuth?.parseUser) return window.CristalAuth.parseUser() || {};
    try {
      return JSON.parse(localStorage.getItem("cristalwater_user") || localStorage.getItem("user") || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function userLanguageKey(user = parseUser()) {
    const id = user.id || user.clientId || user.technicianId || "";
    const role = String(user.role || user.type || "public").toLowerCase();
    return id ? `cw_language:${role}:${id}` : null;
  }

  function readLanguage() {
    const user = parseUser();
    const userKey = userLanguageKey(user);
    return normalizeLanguage(
      pendingLanguage(userKey)?.language
      || user.language
      || (userKey ? localStorage.getItem(userKey) : "")
      || localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem(CLIENT_STORAGE_KEY)
      || navigator.language
      || "pt"
    );
  }

  function saveUserLanguage(language) {
    const normalized = normalizeLanguage(language);
    localStorage.setItem(STORAGE_KEY, normalized);
    localStorage.setItem(CLIENT_STORAGE_KEY, normalized);

    const user = parseUser();
    const userKey = userLanguageKey(user);
    if (userKey) localStorage.setItem(userKey, normalized);

    if (Object.keys(user || {}).length) {
      const nextUser = { ...user, language: normalized };
      localStorage.setItem("cristalwater_user", JSON.stringify(nextUser));
      localStorage.setItem("user", JSON.stringify(nextUser));
      if (window.CristalAuth) {
        window.CristalAuthState = {
          token: token(),
          user: nextUser,
          hydratedAt: Date.now(),
        };
      }
    }
  }

  function translateValue(original, language) {
    if (language === "pt") return original;
    const clean = normalizeText(original);
    return DICT[clean]?.[language] || CANON_DICT[canonicalText(clean)]?.[language] || original;
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== 1) return false;
    return Boolean(element.closest(
      ".cw-lang-switch, script, style, noscript, textarea, code, pre, svg, canvas, select:not([data-cw-i18n-options]), [data-cw-no-i18n]"
    ));
  }

  function translateTextNodes(language) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!normalizeText(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (shouldSkipElement(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const previous = textMemory.get(node);
      const original = !previous || node.nodeValue !== previous.rendered ? node.nodeValue : previous.original;
      const translated = translateValue(original, language);
      textMemory.set(node, { original, rendered: translated });
      if (node.nodeValue !== translated) node.nodeValue = translated;
    });
  }

  function translateAttributes(language) {
    const nodes = document.querySelectorAll("input[placeholder], textarea[placeholder], button[title], a[title], [aria-label]");
    nodes.forEach((node) => {
      if (shouldSkipElement(node)) return;

      if (node.hasAttribute("placeholder")) {
        const original = node.getAttribute(ATTR_ORIGINAL_PLACEHOLDER) || node.getAttribute("placeholder") || "";
        node.setAttribute(ATTR_ORIGINAL_PLACEHOLDER, original);
        node.setAttribute("placeholder", translateValue(original, language));
      }

      if (node.hasAttribute("title")) {
        const original = node.getAttribute(ATTR_ORIGINAL_TITLE) || node.getAttribute("title") || "";
        node.setAttribute(ATTR_ORIGINAL_TITLE, original);
        node.setAttribute("title", translateValue(original, language));
      }

      if (node.hasAttribute("aria-label")) {
        const original = node.getAttribute(ATTR_ORIGINAL_TEXT) || node.getAttribute("aria-label") || "";
        node.setAttribute(ATTR_ORIGINAL_TEXT, original);
        node.setAttribute("aria-label", translateValue(original, language));
      }
    });
  }

  function applyLanguage(language, options = {}) {
    if (!options.silent) languageRevision++;
    const normalized = normalizeLanguage(language);
    document.documentElement.lang = normalized;
    document.body?.setAttribute("data-cw-language", normalized);
    saveUserLanguage(normalized);
    syncSelector(normalized);
    if (document.body) {
      translateTextNodes(normalized);
      translateAttributes(normalized);
    }
    if (!options.silent) {
      window.dispatchEvent(new CustomEvent("cw-language-change", { detail: { language: normalized } }));
    }
  }

  function pendingLanguage(owner = userLanguageKey()) {
    if (!owner) return null;
    try {
      const record = JSON.parse(localStorage.getItem(`${owner}:pending`) || 'null');
      return record && record.owner === owner && typeof record.id === 'string' && SUPPORTED.includes(record.language) ? record : null;
    } catch { return null; }
  }

  function queueRemoteLanguage(record, credential = token()) {
    if (!record || !credential) return;
    const { owner } = record;
    pendingRemoteWrite = pendingRemoteWrite.catch(() => {}).then(async () => {
      if (token() !== credential || userLanguageKey() !== owner || pendingLanguage(owner)?.id !== record.id) return;
      const response = await fetch('/api/settings/language/me', {
        method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential}`},
        body:JSON.stringify({language:record.language})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true || data.language !== record.language) throw Error('Preferência guardada apenas neste dispositivo.');
      if (token() === credential && userLanguageKey() === owner && pendingLanguage(owner)?.id === record.id) {
        localStorage.removeItem(`${owner}:pending`);
        document.getElementById('cwLanguageSelect')?.removeAttribute('title');
      }
    }).catch(error => {
      if (token() === credential && userLanguageKey() === owner) document.getElementById('cwLanguageSelect')?.setAttribute('title',error.message);
    });
  }

  function syncRemoteLanguage(language) {
    const credential = token(), owner = userLanguageKey();
    if (!credential || !owner) return;
    const record = { owner, language: normalizeLanguage(language), id: window.crypto?.randomUUID?.() || `${Date.now()}:${Math.random()}` };
    try { localStorage.setItem(`${owner}:pending`, JSON.stringify(record)); }
    catch { document.getElementById('cwLanguageSelect')?.setAttribute('title', 'Preferência guardada apenas neste dispositivo.'); return; }
    queueRemoteLanguage(record, credential);
  }

  async function loadRemoteLanguage() {
    const credential = token(), revision = languageRevision;
    if (!credential) return;
    try {
      const response = await fetch('/api/settings/language/me',{headers:{Authorization:`Bearer ${credential}`}});
      const data = await response.json().catch(() => ({}));
      if (token() === credential && revision === languageRevision && !pendingLanguage() && response.ok && data.ok !== false && data.language) applyLanguage(data.language,{silent:true});
    } catch (_) { /* The local preference remains usable offline. */ }
  }

  function buildSelector() {
    if (document.getElementById("cwLanguageSelect")) return;
    const wrapper = document.createElement("label");
    wrapper.className = "cw-lang-switch";
    wrapper.innerHTML = `
      <span>Idioma</span>
      <select id="cwLanguageSelect" aria-label="Idioma">
        ${SUPPORTED.map((lang) => `<option value="${lang}">${LANGUAGE_LABELS[lang]}</option>`).join("")}
      </select>
    `;

    const actions = document.querySelector(".cw-global-actions");
    if (actions) {
      actions.prepend(wrapper);
    } else {
      wrapper.classList.add("cw-lang-floating");
      document.body.appendChild(wrapper);
    }

    wrapper.querySelector("select").addEventListener("change", (event) => {
      const language = normalizeLanguage(event.target.value);
      applyLanguage(language);
      syncRemoteLanguage(language);
    });
  }

  function syncSelector(language) {
    const select = document.getElementById("cwLanguageSelect");
    if (select) select.value = normalizeLanguage(language);
  }

  function injectStyle() {
    if (document.getElementById("cwI18nStyle")) return;
    const style = document.createElement("style");
    style.id = "cwI18nStyle";
    style.textContent = `
      .cw-lang-switch{
        display:inline-flex;
        align-items:center;
        gap:8px;
        min-height:40px;
        border:1px solid rgba(91,213,255,.32);
        border-radius:14px;
        padding:6px 8px;
        background:rgba(6,22,38,.78);
        color:#dff8ff;
        font:800 12px Inter,Arial,sans-serif;
        box-shadow:0 10px 28px rgba(0,0,0,.18);
      }
      .cw-lang-switch select{
        min-height:30px;
        border:0;
        border-radius:10px;
        padding:0 28px 0 10px;
        color:#06101d;
        background:#dff8ff;
        font:900 12px Inter,Arial,sans-serif;
        outline:none;
      }
      .cw-lang-switch.cw-lang-floating{
        position:fixed;
        right:18px;
        top:18px;
        z-index:2147483000;
      }
      @media (max-width:720px){
        .cw-lang-switch span{display:none}
        .cw-lang-switch.cw-lang-floating{right:12px;top:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    buildSelector();
    const language = readLanguage();
    applyLanguage(language, { silent: true });
    const pending = pendingLanguage();
    if (pending) queueRemoteLanguage(pending);
    else loadRemoteLanguage();
    window.addEventListener('online', () => queueRemoteLanguage(pendingLanguage()));

    const observer = new MutationObserver(() => {
      window.clearTimeout(observer._cwTimer);
      observer._cwTimer = window.setTimeout(() => {
        buildSelector();
        applyLanguage(readLanguage(), { silent: true });
      }, 180);
    });
    if (document.body) observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  window.CristalI18n = {
    supported: SUPPORTED.slice(),
    normalizeLanguage,
    readLanguage,
    applyLanguage(language) {
      applyLanguage(language);
      syncRemoteLanguage(language);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
