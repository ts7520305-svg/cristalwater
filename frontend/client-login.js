// Only owned login text is translated; server messages remain literal.
const clientLoginCopy = (function () {
  const languages = ["pt", "en", "fr", "es", "de"];
  const copy = {
    title: ["Cristal Water - Login Cliente", "Cristal Water - Client login", "Cristal Water - Connexion client", "Cristal Water - Acceso del cliente", "Cristal Water - Kundenanmeldung"],
    heading: ["Área do Cliente", "Client area", "Espace client", "Área del cliente", "Kundenbereich"],
    email: ["Email", "Email", "E-mail", "Correo electrónico", "E-Mail"],
    password: ["Password", "Password", "Mot de passe", "Contraseña", "Passwort"],
    enter: ["Entrar", "Sign in", "Se connecter", "Entrar", "Anmelden"],
    pending: ["A entrar...", "Signing in...", "Connexion en cours...", "Iniciando sesión...", "Anmeldung läuft..."],
    required: ["Preencha todos os campos.", "Complete all fields.", "Remplissez tous les champs.", "Completa todos los campos.", "Füllen Sie alle Felder aus."],
    invalid: ["Login inválido", "Invalid login", "Connexion non valide", "Inicio de sesión no válido", "Ungültige Anmeldung"],
    notClient: ["Conta não é cliente.", "This is not a client account.", "Ce compte n’est pas un compte client.", "Esta cuenta no es de cliente.", "Dies ist kein Kundenkonto."],
    connection: ["Erro ligação servidor.", "Could not connect to the server.", "Impossible de se connecter au serveur.", "No se ha podido conectar con el servidor.", "Verbindung zum Server fehlgeschlagen."],
  };
  const entries = new WeakSet(), leaves = new Map(), attributes = new Set();
  function value(key) {
    const entry = Object.freeze({ key });
    entries.add(entry);
    return entry;
  }
  function text(entry) {
    if (!entry || typeof entry !== "object" || !entries.has(entry)) return String(entry ?? "");
    const language = String(document.documentElement.lang || "pt").toLowerCase().split("-")[0];
    return copy[entry.key][Math.max(0, languages.indexOf(language))];
  }
  function bind(node, entry) {
    if (!node) return;
    const rendered = text(entry);
    if (node.textContent !== rendered) {
      if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) node.firstChild.nodeValue = rendered;
      else node.textContent = rendered;
    }
    if (entry && typeof entry === "object" && entries.has(entry)) leaves.set(node, { entry, rendered, textNode: node.firstChild });
    else leaves.delete(node);
  }
  function paint() {
    for (const [node, leaf] of leaves) {
      if (!node.isConnected || node.childNodes.length !== 1 || node.firstChild !== leaf.textNode || node.textContent !== leaf.rendered) { leaves.delete(node); continue; }
      bind(node, leaf.entry);
    }
    for (const attribute of attributes) {
      const { node, name, entry } = attribute;
      if (!node.isConnected || node.getAttribute(name) !== attribute.rendered) { attributes.delete(attribute); continue; }
      const rendered = text(entry);
      if (attribute.rendered !== rendered) node.setAttribute(name, rendered);
      attribute.rendered = rendered;
    }
  }
  for (const node of document.querySelectorAll("[data-cw-client-login-copy]")) bind(node, value(node.dataset.cwClientLoginCopy));
  for (const node of document.querySelectorAll("[data-cw-client-login-placeholder]")) {
    const entry = value(node.dataset.cwClientLoginPlaceholder), rendered = text(entry);
    for (const name of ["placeholder", "aria-label"]) {
      node.setAttribute(name, rendered);
      attributes.add({ node, name, entry, rendered });
    }
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
// LOGIN CLIENTE
// ======================================================

let loginPending = false;
async function login(){
  if(loginPending) return;

  clientLoginCopy.bind(errorBox, "");

  const email =
    document.getElementById("email")
      .value
      .trim();

  const password =
    document.getElementById("password")
      .value;

  if(!email || !password){

    clientLoginCopy.bind(errorBox, clientLoginCopy.value("required"));

    return;
  }

  loginPending = true;
  try {

    loginBtn.disabled = true;

    clientLoginCopy.bind(loginBtn, clientLoginCopy.value("pending"));

    const res =
      await fetch(
        `${API}/client-auth/login`,
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

    if(!res.ok || !data.ok){

      clientLoginCopy.bind(errorBox, data.error || clientLoginCopy.value("invalid"));

      loginBtn.disabled = false;

      clientLoginCopy.bind(loginBtn, clientLoginCopy.value("enter"));

      return;
    }

    // ==================================================
    // VALIDAR CLIENT
    // ==================================================

    const baseUser = data.user || data.client || null;
    const sessionUser = baseUser ? {
      ...baseUser,
      role: "CLIENT",
      clientId: Number(baseUser.clientId || baseUser.id || data.client?.id || 0) || undefined,
    } : null;

    if(!sessionUser || (baseUser.role && baseUser.role !== "CLIENT") || !data.token || !Number.isSafeInteger(sessionUser.clientId) || sessionUser.clientId <= 0){

      clientLoginCopy.bind(errorBox, clientLoginCopy.value("notClient"));

      loginBtn.disabled = false;

      clientLoginCopy.bind(loginBtn, clientLoginCopy.value("enter"));

      return;
    }

    // ==================================================
    // SAVE SESSION
    // ==================================================

    if (window.CristalAuth) {
      await window.CristalAuth.persistSession(data.token, sessionUser);
    } else {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(sessionUser));
      localStorage.setItem("cristalwater_jwt", data.token);
      localStorage.setItem("cristalwater_user", JSON.stringify(sessionUser));
    }

    const clientId = Number(sessionUser.clientId || sessionUser.id || 0);
    localStorage.setItem("cw_client_id", String(clientId));
    localStorage.setItem("clientId", String(clientId));

    // ==================================================
    // REDIRECT
    // ==================================================

    window.location.href = window.CristalAuth?.invoiceReturnPath?.() || "/client-portal";

  } catch(err){

    console.error(err);

    clientLoginCopy.bind(errorBox, clientLoginCopy.value("connection"));

  } finally {

    loginPending = false;

    loginBtn.disabled = false;

    clientLoginCopy.bind(loginBtn, clientLoginCopy.value("enter"));
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
