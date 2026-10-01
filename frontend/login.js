// Translate original text leaves without replacing embedded form fields.
const entryLoginCopy = (function () {
  const languages = ["pt", "en", "fr", "es", "de"];
  const copy = {
  "title": [
    "Cristal Water - Login",
    "Cristal Water - Sign in",
    "Cristal Water - Connexion",
    "Cristal Water - Acceso",
    "Cristal Water - Anmeldung"
  ],
  "mainLabel": [
    "Login Cristal Water",
    "Cristal Water sign in",
    "Connexion Cristal Water",
    "Acceso a Cristal Water",
    "Cristal Water Anmeldung"
  ],
  "access": [
    "Acesso reservado aos perfis autorizados da Cristal Water.",
    "Access is reserved for authorised Cristal Water profiles.",
    "Accès réservé aux profils autorisés de Cristal Water.",
    "Acceso reservado a los perfiles autorizados de Cristal Water.",
    "Der Zugang ist autorisierten Cristal Water Profilen vorbehalten."
  ],
  "security": [
    "Segurança",
    "Security",
    "Sécurité",
    "Seguridad",
    "Sicherheit"
  ],
  "trustData": [
    "Dados sensíveis protegidos para operação diária.",
    "Sensitive data protected for daily operations.",
    "Données sensibles protégées pour les opérations quotidiennes.",
    "Datos sensibles protegidos para las operaciones diarias.",
    "Sensible Daten für den täglichen Betrieb geschützt."
  ],
  "trustSession": [
    "Sessões autenticadas com controlo por perfil.",
    "Authenticated sessions with access control by profile.",
    "Sessions authentifiées avec contrôle d’accès par profil.",
    "Sesiones autenticadas con control de acceso por perfil.",
    "Authentifizierte Sitzungen mit Zugangskontrolle je Profil."
  ],
  "trustAudit": [
    "Registos de atividade para auditoria e suporte.",
    "Activity records for auditing and support.",
    "Historique d’activité pour l’audit et l’assistance.",
    "Registros de actividad para auditoría y soporte.",
    "Aktivitätsprotokolle für Prüfung und Support."
  ],
  "heading": [
    "Entrar no sistema",
    "Sign in to the system",
    "Se connecter au système",
    "Entrar en el sistema",
    "Beim System anmelden"
  ],
  "credentials": [
    "Use as credenciais atribuídas para aceder ao seu espaço de trabalho.",
    "Use your assigned credentials to access your workspace.",
    "Utilisez les identifiants qui vous ont été attribués pour accéder à votre espace de travail.",
    "Utiliza las credenciales asignadas para acceder a tu espacio de trabajo.",
    "Verwenden Sie Ihre zugewiesenen Zugangsdaten, um Ihren Arbeitsbereich zu öffnen."
  ],
  "email": [
    "Email",
    "Email",
    "E-mail",
    "Correo electrónico",
    "E-Mail"
  ],
  "password": [
    "Password",
    "Password",
    "Mot de passe",
    "Contraseña",
    "Passwort"
  ],
  "enter": [
    "Entrar",
    "Sign in",
    "Se connecter",
    "Entrar",
    "Anmelden"
  ],
  "required": [
    "Preencha email e password.",
    "Enter email and password.",
    "Saisissez votre e-mail et votre mot de passe.",
    "Introduce el correo electrónico y la contraseña.",
    "Geben Sie E-Mail und Passwort ein."
  ],
  "pending": [
    "A entrar...",
    "Signing in...",
    "Connexion en cours...",
    "Iniciando sesión...",
    "Anmeldung läuft..."
  ],
  "invalid": [
    "Erro login",
    "Login error",
    "Erreur de connexion",
    "Error de inicio de sesión",
    "Anmeldefehler"
  ],
  "connection": [
    "Erro ligação servidor.",
    "Could not connect to the server.",
    "Impossible de se connecter au serveur.",
    "No se ha podido conectar con el servidor.",
    "Verbindung zum Server fehlgeschlagen."
  ],
  "passwordPlaceholder": [
    "A sua password",
    "Your password",
    "Votre mot de passe",
    "Tu contraseña",
    "Ihr Passwort"
  ],
  "show": [
    "Mostrar",
    "Show",
    "Afficher",
    "Mostrar",
    "Anzeigen"
  ],
  "hide": [
    "Ocultar",
    "Hide",
    "Masquer",
    "Ocultar",
    "Ausblenden"
  ],
  "invalidResponse": [
    "Resposta de autenticação inválida.",
    "Invalid authentication response.",
    "Réponse d’authentification non valide.",
    "Respuesta de autenticación no válida.",
    "Ungültige Authentifizierungsantwort."
  ],
  "invalidRole": [
    "Tipo inválido: {role}",
    "Invalid type: {role}",
    "Type non valide : {role}",
    "Tipo no válido: {role}",
    "Ungültiger Typ: {role}"
  ]
};
  const entries = new WeakSet(), leaves = new Map(), attributes = new Set();
  const value = (key, params = {}) => { const entry = Object.freeze({ key, params }); entries.add(entry); return entry; };
  function text(entry) {
    if (!entry || typeof entry !== "object" || !entries.has(entry)) return String(entry ?? "");
    const language = String(document.documentElement.lang || "pt").toLowerCase().split("-")[0];
    return copy[entry.key][Math.max(0, languages.indexOf(language))].replace(/\{(\w+)\}/g, (_, key) => text(entry.params[key]));
  }
  function bind(node, entry) {
    if (!node) return;
    const rendered = text(entry);
    if (node.textContent !== rendered) {
      if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) node.firstChild.nodeValue = rendered;
      else node.textContent = rendered;
    }
    if (entry && typeof entry === "object" && entries.has(entry)) leaves.set(node, { entry, rendered, textNode: node.firstChild, partial: false });
    else leaves.delete(node);
  }
  function bindLeaf(node, entry) {
    const textNode = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.nodeValue.trim());
    if (!textNode) return;
    const rendered = text(entry);
    textNode.nodeValue = rendered;
    leaves.set(node, { entry, rendered, textNode, partial: true });
  }
  function paint() {
    for (const [node, leaf] of leaves) {
      if (!node.isConnected || leaf.textNode?.parentNode !== node || leaf.textNode.nodeValue !== leaf.rendered || !leaf.partial && node.childNodes.length !== 1) { leaves.delete(node); continue; }
      if (leaf.partial) { const rendered = text(leaf.entry); if (leaf.rendered !== rendered) leaf.textNode.nodeValue = rendered; leaf.rendered = rendered; }
      else bind(node, leaf.entry);
    }
    for (const attribute of attributes) {
      const { node, name, entry } = attribute;
      if (!node.isConnected || node.getAttribute(name) !== attribute.rendered) { attributes.delete(attribute); continue; }
      const rendered = text(entry);
      if (attribute.rendered !== rendered) node.setAttribute(name, rendered);
      attribute.rendered = rendered;
    }
  }
  for (const node of document.querySelectorAll("[data-cw-entry-copy]")) bindLeaf(node, value(node.dataset.cwEntryCopy));
  for (const node of document.querySelectorAll("[data-cw-entry-placeholder], [data-cw-entry-aria]")) {
    for (const [name, key] of [["placeholder", node.dataset.cwEntryPlaceholder], ["aria-label", node.dataset.cwEntryAria]]) {
      if (!key) continue;
      const entry = value(key), rendered = text(entry);
      node.setAttribute(name, rendered); attributes.add({ node, name, entry, rendered });
    }
  }
  // Observe the existing control; its handler, input type and aria state stay native.
  const toggle = document.getElementById("togglePassword");
  if (toggle) {
    const paintToggle = () => { if (toggle.isConnected) bind(toggle, value(toggle.getAttribute("aria-pressed") === "true" ? "hide" : "show")); };
    new MutationObserver(paintToggle).observe(toggle, { attributes: true, attributeFilter: ["aria-pressed"] });
    paintToggle();
  }
  window.addEventListener("cw-language-change", paint);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return Object.freeze({ bind, value });
})();

const API =
  "/api";

// ======================================================
// ELEMENTOS
// ======================================================

const loginBtn =
  document.getElementById("loginBtn");

const errorBox =
  document.getElementById("error");

// ======================================================
// LOGIN
// ======================================================

let loginPending = false;
async function login(){
  if(loginPending) return;

  entryLoginCopy.bind(errorBox, "");

  const email =
    document.getElementById("email")
      .value
      .trim();

  const password =
    document.getElementById("password")
      .value;

  if(!email || !password){

    entryLoginCopy.bind(errorBox, entryLoginCopy.value("required"));

    return;
  }

  loginPending = true;
  try {

    loginBtn.disabled = true;

    entryLoginCopy.bind(loginBtn, entryLoginCopy.value("pending"));

    const res =
      await fetch(
        `${API}/auth/login`,
        {

          method:"POST",

          headers:{
            "Content-Type":"application/json"
          },

          body: JSON.stringify({

            email,

            password
          })
        }
      );

    const data =
      await res.json();


    if(!res.ok){

      entryLoginCopy.bind(errorBox, data.error || entryLoginCopy.value("invalid"));

      loginBtn.disabled = false;

      entryLoginCopy.bind(loginBtn, entryLoginCopy.value("enter"));

      return;
    }

    // ==================================================
    // NORMALIZE ROLE
    // ==================================================

    const role =
      String(
        data.user?.role || ""
      )
      .toUpperCase()
      .trim();

    if(!data.token || !["ADMIN", "CLIENT", "TECHNICIAN", "TEAM_LEADER"].includes(role)){
      entryLoginCopy.bind(errorBox, entryLoginCopy.value("invalidResponse"));
      return;
    }
    data.user.role =
      role;

    // ==================================================
    // SAVE SESSION
    // ==================================================

    if (window.CristalAuth) {
      await window.CristalAuth.persistSession(data.token, data.user);
    } else {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("cristalwater_jwt", data.token);
      localStorage.setItem("cristalwater_user", JSON.stringify(data.user));
      localStorage.setItem("adminToken", data.token);
    }


    const documentReturn = window.CristalAuth?.invoiceReturnPath?.();
    if (documentReturn && ["ADMIN", "CLIENT"].includes(role)) {
      window.location.href = documentReturn;
      return;
    }

    // ==================================================
    // ADMIN
    // ==================================================

    if (role === "ADMIN"){

      window.location.href =
        "/admin-menu";

      return;
    }

    // ==================================================
    // CLIENT
    // ==================================================

    if (role === "CLIENT"){

      window.location.href =
        "/client-portal";

      return;
    }

    // ==================================================
    // TECHNICIAN
    // ==================================================

    if (role === "TECHNICIAN" || role === "TEAM_LEADER"){

      window.location.href =
        "/technician";

      return;
    }

    // ==================================================
    // UNKNOWN ROLE
    // ==================================================

    entryLoginCopy.bind(errorBox, entryLoginCopy.value("invalidRole", { role }));

  } catch(err){

    console.error(err);

    entryLoginCopy.bind(errorBox, entryLoginCopy.value("connection"));

  } finally {

    loginPending = false;

    loginBtn.disabled = false;

    entryLoginCopy.bind(loginBtn, entryLoginCopy.value("enter"));
  }
}

// ======================================================
// EVENTS
// ======================================================

loginBtn.addEventListener(
  "click",
  login
);

document.addEventListener(
  "keydown",
  (e)=>{

    if(e.key === "Enter"){
      e.preventDefault();
      login();
    }
  }
);
