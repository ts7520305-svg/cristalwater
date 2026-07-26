(function(){
  "use strict";

  const API = "/api/suppliers";
  let suppliersCache = [];
  let searchTimer = null;

  const els = {
    supplierForm: document.getElementById("supplierForm"),
    linkForm: document.getElementById("linkForm"),
    suppliers: document.getElementById("suppliers"),
    links: document.getElementById("links"),
    status: document.getElementById("supplierStatus"),
    search: document.getElementById("supplierSearch"),
    active: document.getElementById("activeFilter"),
    clear: document.getElementById("clearSearch"),
    refresh: document.getElementById("refreshBtn"),
    linkSupplier: document.getElementById("linkSupplier")
  };

  function token(){
    return localStorage.getItem("token") || localStorage.getItem("adminToken") || "";
  }

  function headers(extra = {}){
    const authToken = token();
    return {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...extra
    };
  }

  async function api(path, options = {}){
    const res = await fetch(API + path, { ...options, headers: headers(options.headers || {}) });
    const data = await res.json().catch(() => ({ ok:false, error:"Resposta inválida do servidor." }));
    if(!res.ok || data.ok === false){
      throw new Error(data.error || data.message || `Erro ${res.status}`);
    }
    return data;
  }

  function formData(form){
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      data[input.name] = input.checked;
    });
    Object.keys(data).forEach((key) => {
      if(typeof data[key] === "string") data[key] = data[key].trim();
      if(data[key] === "") delete data[key];
    });
    return data;
  }

  function esc(value){
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, type = ""){
    els.status.textContent = message || "";
    els.status.className = `status ${type}`.trim();
  }

  function validHref(url){
    const raw = String(url || "").trim();
    if(!raw) return "";
    try{
      const parsed = new URL(raw, window.location.origin);
      if(!["http:", "https:"].includes(parsed.protocol)) return "";
      return parsed.href;
    }catch(_){
      return "";
    }
  }

  async function copyText(text, label){
    const value = String(text || "");
    if(!value){
      setStatus(`${label} não definido.`, "err");
      return;
    }
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(value);
      }else{
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setStatus(`${label} copiado.`, "ok");
    }catch(err){
      setStatus(`Não foi possível copiar ${label.toLowerCase()}: ${err.message}`, "err");
    }
  }

  function renderSupplierOptions(){
    const options = ['<option value="">Sem fornecedor</option>'].concat(
      suppliersCache.map((supplier) => `<option value="${supplier.id}">${esc(supplier.name)}</option>`)
    );
    els.linkSupplier.innerHTML = options.join("");
  }

  function renderSuppliers(list){
    if(!Array.isArray(list) || !list.length){
      els.suppliers.innerHTML = '<p class="muted">Sem fornecedores registados.</p>';
      return;
    }

    els.suppliers.innerHTML = list.map((supplier) => {
      const href = validHref(supplier.loginUrl || supplier.website);
      const category = supplier.category || "Fornecedor";
      const password = supplier.password ? "********" : "Sem password";
      const lastAccess = supplier.lastAccessAt ? new Date(supplier.lastAccessAt).toLocaleString("pt-PT") : "Nunca";
      return `
        <article class="card supplier-card" data-supplier-id="${supplier.id}">
          <div class="card-head">
            <div>
              <span class="badge ${supplier.favorite ? "favorite" : ""}">${esc(category)}</span>
              <h3>${esc(supplier.name)}</h3>
            </div>
            <span class="muted small">ID ${esc(supplier.id)}</span>
          </div>
          <div>
            <div class="muted small">Utilizador</div>
            <strong>${esc(supplier.username || "Não definido")}</strong>
          </div>
          <div>
            <div class="muted small">Password</div>
            <span class="secret">${esc(password)}</span>
            ${supplier.passwordHint ? `<div class="muted small">Dica: ${esc(supplier.passwordHint)}</div>` : ""}
          </div>
          ${supplier.notes ? `<p class="muted">${esc(supplier.notes)}</p>` : ""}
          <div class="muted small">Último acesso: ${esc(lastAccess)}</div>
          <div class="row">
            ${href ? `<a class="btn primary" href="${esc(href)}" target="_blank" rel="noopener">Abrir portal</a>` : ""}
            <button class="btn" data-copy-user="${supplier.id}">Copiar user</button>
            <button class="btn warn" data-copy-password="${supplier.id}">Copiar password</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderLinks(list){
    if(!Array.isArray(list) || !list.length){
      els.links.innerHTML = '<p class="muted">Sem links rápidos.</p>';
      return;
    }

    els.links.innerHTML = list.map((link) => {
      const href = validHref(link.url);
      return `
        <article class="card">
          <div class="card-head">
            <div>
              <span class="badge ${link.favorite ? "favorite" : ""}">${esc(link.category || "Link")}</span>
              <h3>${esc(link.title)}</h3>
            </div>
            <span class="muted small">ID ${esc(link.id)}</span>
          </div>
          ${link.supplier?.name ? `<p class="muted">Fornecedor: ${esc(link.supplier.name)}</p>` : ""}
          ${link.notes ? `<p class="muted">${esc(link.notes)}</p>` : ""}
          <div class="row">
            ${href ? `<a class="btn primary" href="${esc(href)}" target="_blank" rel="noopener">Abrir</a>` : ""}
            <button class="btn" data-copy-url="${esc(href || link.url)}">Copiar link</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function supplierById(id){
    return suppliersCache.find((supplier) => Number(supplier.id) === Number(id));
  }

  async function copyPassword(id){
    try{
      setStatus("A pedir password cifrada ao servidor...");
      const data = await api(`/suppliers/${id}/reveal`, { method:"POST", body: JSON.stringify({}) });
      await copyText(data.password || "", "Password");
    }catch(err){
      setStatus(`Erro ao copiar password: ${err.message}`, "err");
    }
  }

  async function loadAll(){
    try{
      setStatus("A carregar fornecedores...");
      const q = els.search.value.trim();
      const active = els.active.value;
      const params = new URLSearchParams();
      if(q) params.set("q", q);
      if(active !== "all") params.set("active", active);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const [supplierData, linkData] = await Promise.all([
        api(`/suppliers${suffix}`),
        api("/links")
      ]);
      suppliersCache = supplierData.suppliers || [];
      renderSupplierOptions();
      renderSuppliers(suppliersCache);
      renderLinks(linkData.links || []);
      setStatus(`${suppliersCache.length} fornecedor(es) carregado(s).`, "ok");
    }catch(err){
      setStatus(err.message, "err");
      els.suppliers.innerHTML = '<p class="muted">Não foi possível carregar fornecedores.</p>';
      els.links.innerHTML = '<p class="muted">Não foi possível carregar links.</p>';
    }
  }

  function scheduleLoad(){
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadAll, 250);
  }

  els.supplierForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try{
      await api("/suppliers", { method:"POST", body: JSON.stringify(formData(event.currentTarget)) });
      event.currentTarget.reset();
      setStatus("Fornecedor guardado.", "ok");
      await loadAll();
    }catch(err){
      setStatus(`Erro ao guardar fornecedor: ${err.message}`, "err");
    }
  });

  els.linkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try{
      await api("/links", { method:"POST", body: JSON.stringify(formData(event.currentTarget)) });
      event.currentTarget.reset();
      setStatus("Atalho guardado.", "ok");
      await loadAll();
    }catch(err){
      setStatus(`Erro ao guardar atalho: ${err.message}`, "err");
    }
  });

  els.suppliers.addEventListener("click", (event) => {
    const userId = event.target?.dataset?.copyUser;
    const passwordId = event.target?.dataset?.copyPassword;
    if(userId){
      const supplier = supplierById(userId);
      copyText(supplier?.username || "", "Utilizador");
    }
    if(passwordId) copyPassword(passwordId);
  });

  els.links.addEventListener("click", (event) => {
    const url = event.target?.dataset?.copyUrl;
    if(url) copyText(url, "Link");
  });

  els.refresh.addEventListener("click", loadAll);
  els.search.addEventListener("input", scheduleLoad);
  els.active.addEventListener("change", loadAll);
  els.clear.addEventListener("click", () => {
    els.search.value = "";
    els.active.value = "true";
    loadAll();
  });

  window.loadAll = loadAll;
  loadAll();
})();
