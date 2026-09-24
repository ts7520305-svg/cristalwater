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
    const financial=/^\/api\/invoice-pdf\/(extras\/)?([1-9]\d*)$/.exec(url.pathname);
    const fingerprint=()=>JSON.stringify(['cristalwater_jwt','token','adminToken','user','cristalwater_user'].map(key=>localStorage.getItem(key)));
    if(financial&&(url.search||url.hash||url.username||url.password||Number(financial[2])>2147483647))throw Error('Documento inválido.');
    const allowed = url.pathname.startsWith("/api/guides/")
      || /^\/api\/invoice-pdf\/(?:extras\/)?[1-9]\d*$/.test(url.pathname)
      || /^\/api\/client-messages\/attachments\/[1-9]\d*$/.test(url.pathname);
    if (url.origin !== window.location.origin || !allowed) {
      throw new Error("Documento fora da aplicação.");
    }
    const popup = window.open("", "_blank");
    if (!popup) throw new Error("Permite a abertura de uma nova janela para consultar o documento.");
    popup.opener = null;
    const identity=financial?fingerprint():null,controller=financial?new AbortController():null,timer=financial?setTimeout(()=>controller.abort(),20000):null;
    const current=token=>{if(authToken()!==token||financial&&fingerprint()!==identity)throw Error('A sessão mudou. Entra novamente para abrir o documento.');};
    try {
      const token = authToken();
      const response = await fetch(url.pathname + url.search, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        ...(financial?{cache:'no-store',redirect:'error',signal:controller.signal}:{}),
      });
      current(token);
      if (!response.ok) throw new Error(response.status === 401
        ? "A sessão expirou. Entra novamente para abrir o documento."
        : "Não foi possível abrir o documento. Tenta novamente.");

      const blob = await response.blob();
      current(token);
      if(financial){
        const clientId=response.headers.get('X-CW-Client-Id'),type=financial[1]?'extra-billing-pdf':'invoice-pdf';
        let claims;try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw Error('A sessão não confirma este documento.');}
        if(response.status!==200||blob.type!=='application/pdf'||response.headers.get('X-CW-Document-Type')!==type||!/^[1-9]\d*$/.test(clientId||'')||Number(clientId)>2147483647||(financial[1]?clientId!==financial[2]:response.headers.get('X-CW-Invoice-Id')!==financial[2])||claims.role==='CLIENT'&&Number(clientId)!==Number(claims.clientId||claims.id))throw Error('A resposta não confirma o documento selecionado.');
        const prefix=await blob.slice(0,5).text(),tail=await blob.slice(-1024).text();current(token);if(prefix!=='%PDF-'||!/%%EOF\s*$/.test(tail))throw Error('O PDF recebido está incompleto. Tente novamente.');
      }
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
      if(financial&&error.name==='AbortError')throw Error('O documento demorou demasiado. Tente novamente.');
      throw error;
    }finally{if(timer)clearTimeout(timer);}
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
