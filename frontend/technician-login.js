(function () {
  const pinInput = document.getElementById("pin");
  const loginError = document.getElementById("loginError");
  const loginBox = document.getElementById("loginBox");
  const sessionBox = document.getElementById("sessionBox");
  const welcome = document.getElementById("welcome");

  function showError(message) {
    if (loginError) loginError.textContent = message || "Erro de autenticação.";
  }

  function persistSession(token,user){return window.CristalAuth.persistSession(token,user);}

  window.login = async function login() {
    const pin = String(pinInput?.value || "").trim();
    if (!pin) {
      showError("Introduza o PIN do técnico.");
      return;
    }

    showError("");

    try {
      const response = await fetch("/api/technician-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok || !data.token || !data.user) {
        showError(data.message || "PIN inválido.");
        return;
      }

      await persistSession(data.token, data.user);

      if (welcome) welcome.textContent = `Bem-vindo ${data.user.name || "Técnico"}`;
      if (loginBox) loginBox.style.display = "none";
      if (sessionBox) sessionBox.style.display = "block";

      window.location.href = "/technician-field-mode";
    } catch (_) {
      showError("Erro de ligação ao servidor.");
    }
  };

  window.logout = async function logout() {
    await window.CristalAuth.clearSession();
    if(!window.CristalAuth.getToken())window.location.href = "/technician-login";
  };
})();
