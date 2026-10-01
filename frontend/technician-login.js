(function () {
  const pinInput = document.getElementById("pin");
  const loginError = document.getElementById("loginError");
  const loginBox = document.getElementById("loginBox");
  const sessionBox = document.getElementById("sessionBox");
  const welcome = document.getElementById("welcome");

  // Private copy descriptors distinguish our messages from literal server/user data.
  const languages = ["pt", "en", "fr", "es", "de"];
  const copy = {
    title: ["Técnico - Cristal Water", "Technician - Cristal Water", "Technicien - Cristal Water", "Técnico - Cristal Water", "Techniker - Cristal Water"],
    heading: ["Login Técnico", "Technician login", "Connexion du technicien", "Acceso del técnico", "Techniker-Anmeldung"],
    pin: ["PIN do técnico", "Technician PIN", "PIN du technicien", "PIN del técnico", "Techniker-PIN"],
    enter: ["Entrar", "Sign in", "Se connecter", "Entrar", "Anmelden"],
    leave: ["Sair", "Sign out", "Se déconnecter", "Salir", "Abmelden"],
    authError: ["Erro de autenticação.", "Authentication error.", "Erreur d’authentification.", "Error de autenticación.", "Authentifizierungsfehler."],
    pinRequired: ["Introduza o PIN do técnico.", "Enter the technician PIN.", "Saisissez le PIN du technicien.", "Introduce el PIN del técnico.", "Geben Sie die Techniker-PIN ein."],
    pending: ["A entrar...", "Signing in...", "Connexion en cours...", "Iniciando sesión...", "Anmeldung läuft..."],
    invalidPin: ["PIN inválido.", "Invalid PIN.", "PIN incorrect.", "PIN no válido.", "Ungültige PIN."],
    connection: ["Erro de ligação ao servidor.", "Could not connect to the server.", "Impossible de se connecter au serveur.", "No se ha podido conectar con el servidor.", "Verbindung zum Server fehlgeschlagen."],
    welcome: ["Bem-vindo {name}", "Welcome {name}", "Bienvenue {name}", "Bienvenido {name}", "Willkommen {name}"],
    technician: ["Técnico", "Technician", "Technicien", "Técnico", "Techniker"],
  };
  const entries = new WeakSet(), leaves = new Map(), placeholders = new Map();
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
    if (entry && typeof entry === "object" && entries.has(entry)) leaves.set(node, { entry, rendered, textNode: node.firstChild });
    else leaves.delete(node);
  }
  function paint() {
    for (const [node, leaf] of leaves) {
      if (!node.isConnected || node.childNodes.length !== 1 || node.firstChild !== leaf.textNode || node.textContent !== leaf.rendered) { leaves.delete(node); continue; }
      bind(node, leaf.entry);
    }
    for (const [node, entry] of placeholders) {
      const rendered = text(entry);
      if (node.getAttribute("placeholder") !== rendered) node.setAttribute("placeholder", rendered);
      if (node.getAttribute("aria-label") !== rendered) node.setAttribute("aria-label", rendered);
    }
  }
  for (const node of document.querySelectorAll("[data-cw-login-copy]")) bind(node, value(node.dataset.cwLoginCopy));
  for (const node of document.querySelectorAll("[data-cw-login-placeholder]")) placeholders.set(node, value(node.dataset.cwLoginPlaceholder));
  window.addEventListener("cw-language-change", paint);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  paint();

  function showError(message) {
    bind(loginError, message || value("authError"));
  }

  function persistSession(token,user){return window.CristalAuth.persistSession(token,user);}

  let loginPending = false;
  const loginButton = loginBox?.querySelector("button");
  window.login = async function login() {
    if(loginPending) return;
    const pin = String(pinInput?.value || "").trim();
    if (!pin) {
      showError(value("pinRequired"));
      return;
    }

    showError("");
    loginPending = true;
    if(loginButton){loginButton.disabled = true; bind(loginButton, value("pending"));}

    try {
      const response = await fetch("/api/technician-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok || !data.token || !data.user || !["TECHNICIAN", "TEAM_LEADER"].includes(data.user.role)) {
        showError(data.message || value("invalidPin"));
        return;
      }

      await persistSession(data.token, data.user);

      bind(welcome, value("welcome", { name: data.user.name || value("technician") }));
      if (loginBox) loginBox.style.display = "none";
      if (sessionBox) sessionBox.style.display = "block";

      window.location.href = "/technician-field-mode";
    } catch (_) {
      showError(value("connection"));
    } finally {
      loginPending = false;
      if(loginButton){loginButton.disabled = false; bind(loginButton, value("enter"));}
    }
  };

  pinInput?.addEventListener("keydown", event=>{
    if(event.key === "Enter"){event.preventDefault();void window.login();}
  });

  window.logout = async function logout() {
    await window.CristalAuth.clearSession();
    if(!window.CristalAuth.getToken())window.location.href = "/technician-login";
  };
})();
