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
      || /^\/api\/invoice-pdf\/(?:extras\/)?[1-9]\d*$/.test(url.pathname)
      || /^\/api\/client-messages\/attachments\/[1-9]\d*$/.test(url.pathname);
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
      if (url.pathname.startsWith('/api/client-messages/attachments/') && !['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(blob.type)) {
        // Download arbitrary attachments as inert bytes; never execute HTML/SVG in an application-origin blob.
        const fileUrl = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
        const link = document.createElement('a'); link.href = fileUrl;
        const header = response.headers.get('content-disposition') || '';
        const plain = /filename="([^"\r\n]+)"/.exec(header);
        link.download = plain ? plain[1].replace(/[\\/]/g, '_') : 'anexo-' + url.pathname.split('/').pop();
        link.click(); popup.close(); setTimeout(() => URL.revokeObjectURL(fileUrl), 60000); return;
      }
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
