// Translate original text leaves without replacing embedded form fields.
const entryLoginCopy = (function () {
  const languages = ["pt", "en", "fr", "es", "de"];
  const copy = {
  "title": [
    "Login Administração",
    "Administration login",
    "Connexion administration",
    "Acceso de administración",
    "Anmeldung zur Administration"
  ],
  "heading": [
    "Administração",
    "Administration",
    "Administration",
    "Administración",
    "Administration"
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
  "restricted": [
    "Acesso reservado ao administrador.",
    "Access is reserved for the administrator.",
    "Accès réservé à l’administrateur.",
    "Acceso reservado al administrador.",
    "Der Zugang ist dem Administrator vorbehalten."
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

const loginBtn =
  document.getElementById("loginBtn");

const errorBox =
  document.getElementById("error");

// ======================================================
// LOGIN ADMIN
// ======================================================

let loginPending = false;
async function login() {
  if(loginPending) return;

  entryLoginCopy.bind(errorBox, "");

  const email =
    document.getElementById("email")
      .value
      .trim();

  const password =
    document.getElementById("password")
      .value;

  if (!email || !password) {

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
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            email,
            password
          })
        }
      );

    const data =
      await res.json();

    if (!res.ok || !data.ok) {

      entryLoginCopy.bind(errorBox, data.error || entryLoginCopy.value("invalid"));

      loginBtn.disabled = false;

      entryLoginCopy.bind(loginBtn, entryLoginCopy.value("enter"));

      return;
    }

    // ==================================================
    // VALIDAR ADMIN
    // ==================================================

    if (!data.token || data.user?.role !== "ADMIN") {

      entryLoginCopy.bind(errorBox, entryLoginCopy.value("restricted"));

      loginBtn.disabled = false;

      entryLoginCopy.bind(loginBtn, entryLoginCopy.value("enter"));

      return;
    }

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

    // ==================================================
    // REDIRECT
    // ==================================================

    window.location.href =
      "/admin-menu";

  } catch (err) {

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