(function () {
  "use strict";

  function authToken() {
    return localStorage.getItem("cristalwater_jwt")
      || localStorage.getItem("token")
      || localStorage.getItem("adminToken")
      || "";
  }

  async function open(href) {
    const url = new URL(href, window.location.href);
    const allowed = url.pathname.startsWith("/api/guides/")
      || /^\/api\/invoice-pdf\/(?:extras\/)?[1-9]\d*$/.test(url.pathname);
    if (url.origin !== window.location.origin || !allowed) {
      throw new Error("Documento fora da aplicação.");
    }
    const popup = window.open("", "_blank");
    if (!popup) throw new Error("Permite a abertura de uma nova janela para consultar o documento.");
    popup.opener = null;
    try {
      const token = authToken();
      const response = await fetch(url.pathname + url.search, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (authToken() !== token) throw new Error("A sessão mudou. Entra novamente para abrir o documento.");
      if (!response.ok) throw new Error(response.status === 401
        ? "A sessão expirou. Entra novamente para abrir o documento."
        : "Não foi possível abrir o documento. Tenta novamente.");

      const blob = await response.blob();
      if (authToken() !== token) throw new Error("A sessão mudou. Entra novamente para abrir o documento.");
      const objectUrl = URL.createObjectURL(blob);
      popup.location.href = objectUrl;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      if (popup) popup.close();
      throw error;
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("a[data-auth-download]");
    if (!link) return;
    event.preventDefault();
    open(link.href).catch((error) => {
      if (window.CristalAuth?.toast) window.CristalAuth.toast(error.message);
      else window.alert(error.message);
    });
  });

  window.CristalDownloads = { open };
}());
