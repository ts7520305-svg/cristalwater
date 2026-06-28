// Cristal Water - idioma global PT / EN / FR / DE
(function () {
  "use strict";
  if (window.__CW_I18N__) return;
  window.__CW_I18N__ = true;

  const SUPPORTED = ["pt", "en", "fr", "de"];
  const STORAGE_KEY = "cw_language";
  const CLIENT_STORAGE_KEY = "cw_client_lang";
  const ATTR_ORIGINAL_TEXT = "data-cw-i18n-original";
  const ATTR_ORIGINAL_PLACEHOLDER = "data-cw-i18n-placeholder";
  const ATTR_ORIGINAL_TITLE = "data-cw-i18n-title";
  const textMemory = new WeakMap();

  const LANGUAGE_LABELS = {
    pt: "Portugues",
    en: "English",
    fr: "Francais",
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

  const CANON_DICT = Object.entries(DICT).reduce((acc, [key, value]) => {
    acc[canonicalText(key)] = value;
    return acc;
  }, {});

  function normalizeLanguage(value) {
    const raw = String(value || "pt").trim().toLowerCase();
    if (["pt", "pt-pt", "portugues", "portuguese"].includes(raw)) return "pt";
    if (["en", "en-gb", "en-us", "ing", "ingles", "english"].includes(raw)) return "en";
    if (["fr", "fr-fr", "frances", "french"].includes(raw)) return "fr";
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
      user.language
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
      ".cw-lang-switch, script, style, noscript, textarea, code, pre, svg, canvas, select, [data-cw-no-i18n]"
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
      if (!textMemory.has(node)) textMemory.set(node, node.nodeValue);
      const original = textMemory.get(node);
      const translated = translateValue(original, language);
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

  async function syncRemoteLanguage(language) {
    if (!token()) return;
    try {
      await fetch("/api/settings/language/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: normalizeLanguage(language) }),
      });
    } catch (error) {
      console.warn("Nao foi possivel gravar idioma:", error.message);
    }
  }

  async function loadRemoteLanguage() {
    if (!token()) return;
    try {
      const response = await fetch("/api/settings/language/me");
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok !== false && data.language) applyLanguage(data.language, { silent: true });
    } catch (error) {
      console.warn("Nao foi possivel ler idioma:", error.message);
    }
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
    loadRemoteLanguage();

    const observer = new MutationObserver(() => {
      window.clearTimeout(observer._cwTimer);
      observer._cwTimer = window.setTimeout(() => {
        buildSelector();
        applyLanguage(readLanguage(), { silent: true });
      }, 180);
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
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
