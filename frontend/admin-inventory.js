function el(id) { return document.getElementById(id); }
function money(v) { return Number(v || 0).toFixed(2); }
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
  prompt: async () => null,
  safeError: (err, fallback) => (err && err.message) || fallback,
};

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function setStatus(message, tone = "info") {
  const node = el("inventoryStatus");
  if (!node) return;
  node.textContent = message;
  node.className = `status ${tone === "info" ? "" : tone}`.trim();
}

function showFormError(form,message){
  let node=form.querySelector('[data-inventory-feedback]');if(!node){node=document.createElement('div');node.dataset.inventoryFeedback='true';node.className='status error';node.setAttribute('role','alert');form.appendChild(node);}node.textContent=message;
}
function clearFormError(form){form.querySelector('[data-inventory-feedback]')?.remove();}
function userError(error, fallback) {
  if(/failed to fetch|networkerror|load failed/i.test(error?.message||''))return 'Ligação interrompida. Repita o pedido com os mesmos dados; o sistema evita duplicações.';
  return ui.safeError(error, fallback || "Nao foi possivel concluir a operacao.");
}

function itemHtml(balance) {
  return `<div class="item"><b>${esc(balance.productName)}</b> · ${esc(balance.quantity)} ${esc(balance.unit)} <span class="muted">${esc(balance.scope)}${balance.vehicleId ? ` · viatura ${esc(balance.vehicleId)}` : ""}</span></div>`;
}

let PRODUCTS = [];

function addRow() {
  const d = document.createElement("div");
  d.className = "row";
  d.innerHTML = `
    <input placeholder="Produto" aria-label="Produto" data-k="productName">
    <input placeholder="Qtd" aria-label="Quantidade" type="number" step="0.01" data-k="quantity">
    <input placeholder="Un" aria-label="Unidade" value="KG" data-k="unit">
    <input placeholder="Custo/un" aria-label="Custo por unidade" type="number" step="0.01" data-k="unitCost">
  `;
  el("items")?.appendChild(d);
}

function collectRows() {
  return [...document.querySelectorAll("#items .row")]
    .map((r) => {
      const o = {};
      r.querySelectorAll("input").forEach((i) => { o[i.dataset.k] = i.value; });
      return o;
    })
    .filter((x) => x.productName || x.quantity || x.unitCost);
}

async function api(url, opt) {
  const res = await fetch(url, {
    headers: authHeaders({ "Content-Type": "application/json" }),
    ...opt,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.message || `Erro HTTP ${res.status}`);
  }
  return data;
}

async function refreshProducts() {
  const data = await api("/api/inventory/products?includeInactive=true");
  PRODUCTS = data.products || [];

  let target = el("products");
  if (!target) {
    const s = document.createElement("section");
    s.className = "card section-gap";
    s.innerHTML = '<h2>Produtos</h2><div id="products" class="list"></div>';
    document.querySelector("main.page")?.appendChild(s);
    target = el("products");
  }

  target.innerHTML = PRODUCTS.length
    ? PRODUCTS.map((p) => `
      <div class="item">
        <b>${esc(p.name)}</b>
        ${p.active === false ? '<span class="ds-badge is-muted">Arquivado</span>' : '<span class="ds-badge">Ativo</span>'}
        <div class="muted">SKU: ${esc(p.sku || "-")} · Categoria: ${esc(p.category || "-")} · Unidade: ${esc(p.unit || "-")} · Custo: EUR ${money(p.defaultCost)}</div>
        <div class="actions">
          <button class="cw-v2-btn" onclick="editProduct(${p.id})">Editar</button>
          ${p.active === false ? `<button class="cw-v2-btn" onclick="restoreProduct(${p.id})">Restaurar</button>` : `<button class="cw-v2-btn" onclick="archiveProduct(${p.id})">Arquivar</button>`}
          <button class="cw-v2-btn danger" onclick="deleteProduct(${p.id})">Eliminar</button>
        </div>
      </div>
    `).join("")
    : '<p class="muted">Sem produtos registados. Proxima acao: criar um produto para começar o stock.</p>';
}

async function refresh() {
  const token=localStorage.getItem("token");
  setStatus("A atualizar stock e movimentos...");
  const report = await api("/api/inventory/report");
  if(token!==localStorage.getItem("token"))return;
  el("stock").innerHTML = (report.balances || []).map(itemHtml).join("") || '<p class="muted">Sem stock. Proxima acao: registar uma entrada de stock por fatura.</p>';
  el("movements").innerHTML = (report.lastMovements || []).map((m) => `
    <div class="item">
      <b>${esc(m.movementType)}</b> · ${esc(m.productName)} · ${esc(m.quantity)} ${esc(m.unit)}
      <br><span class="muted">${new Date(m.createdAt).toLocaleString("pt-PT")}</span>
    </div>
  `).join("") || '<p class="muted">Sem movimentos. Proxima acao: efetuar uma entrada, transferencia ou consumo.</p>';
  await refreshProducts();
  const vehiclesData=await api('/api/guides/vehicles');if(token!==localStorage.getItem('token'))return;
  const vehicles=Array.isArray(vehiclesData)?vehiclesData:vehiclesData.vehicles||vehiclesData.data||[];
  const vehicleSelection=el('transferVehicleId').value;el('transferVehicleId').innerHTML='<option value="">Selecionar viatura</option>'+vehicles.filter(v=>v.active!==false&&!v.deletedAt&&(!v.archiveStatus||v.archiveStatus==='ATIVO')).map(v=>`<option value="${v.id}">${esc(v.plate||v.name||'Viatura '+v.id)}</option>`).join('');el('transferVehicleId').value=vehicleSelection;
  const productSelection=el('transferProductName').value;el('transferProductName').innerHTML='<option value="">Selecionar produto do armazém</option>'+(report.balances||[]).filter(b=>b.scope==='CENTRAL'&&Number(b.quantity)>0).map(b=>`<option value="${esc(b.productName)}" data-unit="${esc(b.unit)}" data-quantity="${Number(b.quantity)}">${esc(b.productName)} · ${esc(b.quantity+' '+b.unit)}</option>`).join('');el('transferProductName').value=productSelection;
  const updateTransferProduct=()=>{const option=el('transferProductName').selectedOptions[0];el('transferUnit').value=option?.dataset.unit||'';el('transferQuantity').max=option?.dataset.quantity||'';el('transferAvailability').textContent=option?.dataset.quantity?'Saldo consultado: '+option.dataset.quantity+' '+option.dataset.unit+'. A disponibilidade volta a ser verificada ao guardar.':'';};el('transferProductName').onchange=updateTransferProduct;updateTransferProduct();
  const consumeVehicle=el('consumeVehicleId'),oldVehicle=consumeVehicle.value;
  consumeVehicle.innerHTML=el('transferVehicleId').innerHTML;consumeVehicle.value=oldVehicle;
  const updateConsumptionUnit=()=>{const option=el('consumeProductName').selectedOptions[0];el('consumeUnit').value=option?.dataset.unit||'';el('consumeQuantity').max=option?.dataset.quantity||'';};
  const updateConsumptionProducts=()=>{const select=el('consumeProductName'),oldProduct=select.value;select.innerHTML='<option value="">Selecionar produto da viatura</option>'+(report.balances||[]).filter(b=>b.scope==='VEHICLE'&&String(b.vehicleId)===consumeVehicle.value&&Number(b.quantity)>0).map(b=>`<option value="${esc(JSON.stringify([b.productName,b.unit]))}" data-product-name="${esc(b.productName)}" data-unit="${esc(b.unit)}" data-quantity="${Number(b.quantity)}">${esc(b.productName+' · '+b.quantity+' '+b.unit)}</option>`).join('');select.value=oldProduct;updateConsumptionUnit();};
  consumeVehicle.onchange=updateConsumptionProducts;el('consumeProductName').onchange=updateConsumptionUnit;updateConsumptionProducts();
  setStatus("Inventario atualizado.", "ok");
}

async function editProduct(id) {
  const p = PRODUCTS.find((x) => Number(x.id) === Number(id));
  if (!p) return;
  const name = await ui.prompt("Indica o nome do produto.", { title: "Editar produto", defaultValue: p.name || "", confirmText: "Seguinte" });
  if (name === null) return;
  const sku = await ui.prompt("Indica o SKU (opcional).", { title: "Editar produto", defaultValue: p.sku || "", confirmText: "Seguinte" });
  if (sku === null) return;
  const category = await ui.prompt("Indica a categoria.", { title: "Editar produto", defaultValue: p.category || "CHEMICAL", confirmText: "Seguinte" });
  if (category === null) return;
  const unit = await ui.prompt("Indica a unidade.", { title: "Editar produto", defaultValue: p.unit || "KG", confirmText: "Seguinte" });
  if (unit === null) return;
  const defaultCost = await ui.prompt("Indica o custo padrao em EUR.", { title: "Editar produto", defaultValue: String(p.defaultCost || 0), confirmText: "Seguinte" });
  if (defaultCost === null) return;
  const notes = await ui.prompt("Notas internas (opcional).", { title: "Editar produto", defaultValue: p.notes || "", confirmText: "Guardar" });
  if (notes === null) return;
  await api(`/api/inventory/products/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, sku: sku || null, category, unit, defaultCost, notes }),
  });
  ui.success("Produto atualizado com sucesso.");
  await refresh();
}

async function archiveProduct(id) {
  await api(`/api/inventory/products/${id}`, { method: "PUT", body: JSON.stringify({ active: false }) });
  await refresh();
}

async function restoreProduct(id) {
  await api(`/api/inventory/products/${id}/restore`, { method: "POST" });
  await refresh();
}

async function deleteProduct(id) {
  const approved = await ui.confirm("O produto sera eliminado apenas se nao existir historico. Caso contrario, sera arquivado. Queres continuar?", {
    title: "Confirmar eliminacao",
    confirmText: "Continuar",
    danger: true,
  });
  if (!approved) return;
  await api(`/api/inventory/products/${id}`, { method: "DELETE" });
  ui.success("Operacao concluida no produto.");
  await refresh();
}

async function inventoryRequest(kind,payload,token){
  const user=JSON.parse(localStorage.getItem('user')||localStorage.getItem('cristalwater_user')||'null');
  if(!user?.id)throw new Error('Confirme a sessão antes de guardar');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([user.role,user.id,payload])));
  if(token!==localStorage.getItem('token'))throw new Error('A sessão mudou. Confirme a conta antes de guardar');
  const key='cwInventoryWrite:'+kind+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const requestId=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,requestId);return {key,requestId};
}
el("purchaseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();const form=e.target,button=form.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;clearFormError(form);const token=localStorage.getItem('token');
  try {
    setStatus("A guardar entrada de stock...");
    const fd=new FormData(form),items=collectRows();fd.append('items',JSON.stringify(items));
    const file=fd.get('document');let documentHash=null;
    if(file?.size){const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());documentHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
    const payload={...Object.fromEntries(fd),document:file?.size?{name:file.name,documentHash}:null};
    const pending=await inventoryRequest('purchase',payload,token);fd.append('requestId',pending.requestId);
    const res=await fetch('/api/inventory/purchases',{method:'POST',headers:authHeaders(),body:fd});
    const data=await res.json().catch(()=>({}));if(!res.ok||data.ok===false)throw new Error(data.error||data.message||`Erro HTTP ${res.status}`);
    if(token!==localStorage.getItem('token'))return;localStorage.removeItem(pending.key);
    form.reset();el('items').innerHTML='';addRow();setStatus('Entrada de stock guardada.','ok');await refresh();
  }catch(error){
    if(token!==localStorage.getItem('token'))return;
    setStatus(userError(error,'Falha ao guardar entrada. Os dados foram mantidos para repetir.'),'error');showFormError(form,userError(error,'Falha ao guardar entrada.'));
  }finally{button.disabled=false;}
});

el("transferForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();const form=e.target,button=form.querySelector('button[type=submit],button');if(button?.disabled)return;clearFormError(form);const token=localStorage.getItem('token');let key;
  try {
    setStatus("A transferir stock para viatura...");
    const f = Object.fromEntries(new FormData(e.target));
    const body = {
      vehicleId: f.vehicleId,
      items: [{ productName: f.productName, quantity: f.quantity, unit: f.unit || "KG" }],
    };
    const user=JSON.parse(localStorage.getItem('user')||localStorage.getItem('cristalwater_user')||'null');if(!user?.id)throw new Error('Confirme a sessão antes de transferir');
    key='cwInventoryTransfer:'+JSON.stringify([user.id,body]);body.requestId=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,body.requestId);if(button)button.disabled=true;
    await api("/api/inventory/transfer-to-vehicle", { method: "POST", body: JSON.stringify(body) });
    if(token!==localStorage.getItem('token'))return;localStorage.removeItem(key);
    e.target.reset();
    setStatus("Transferencia registada.", "ok");
    await refresh();
  } catch (error) {
    if(token!==localStorage.getItem('token'))return;
    console.error(error);
    setStatus(userError(error, "Falha na transferencia. Confirma a viatura, o produto e a quantidade."), "error");
    showFormError(form,userError(error, "Falha na transferencia. Confirma a viatura, o produto e a quantidade."));
  }finally{if(button)button.disabled=false;}
});

el("consumeForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();const form=e.target,button=form.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;clearFormError(form);const token=localStorage.getItem('token');
  try {
    setStatus('A registar consumo...');const body=Object.fromEntries(new FormData(form));body.productName=el('consumeProductName').selectedOptions[0]?.dataset.productName||'';
    const pending=await inventoryRequest('consume',body,token);body.requestId=pending.requestId;
    await api('/api/inventory/consume',{method:'POST',body:JSON.stringify(body)});
    if(token!==localStorage.getItem('token'))return;localStorage.removeItem(pending.key);form.reset();setStatus('Consumo registado.','ok');await refresh();
  }catch(error){
    if(token!==localStorage.getItem('token'))return;
    setStatus(userError(error,'Falha no consumo. Os dados foram mantidos para repetir.'),'error');showFormError(form,userError(error,'Falha no consumo.'));
  }finally{button.disabled=false;}
});

window.addRow = addRow;
window.editProduct = editProduct;
window.archiveProduct = archiveProduct;
window.restoreProduct = restoreProduct;
window.deleteProduct = deleteProduct;

addRow();
refresh().catch((e) => {
  console.error(e);
  setStatus(userError(e, "Nao foi possivel carregar o inventario. Atualiza a pagina e tenta novamente."), "error");
  ui.error(userError(e, "Nao foi possivel carregar o inventario. Atualiza a pagina e tenta novamente."));
});
