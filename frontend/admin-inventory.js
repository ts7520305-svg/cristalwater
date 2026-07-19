function el(id) { return document.getElementById(id); }
function money(v) { return Number(v || 0).toFixed(2); }

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

function itemHtml(balance) {
  return `<div class="item"><b>${esc(balance.productName)}</b> · ${esc(balance.quantity)} ${esc(balance.unit)} <span class="muted">${esc(balance.scope)}${balance.vehicleId ? ` · viatura ${esc(balance.vehicleId)}` : ""}</span></div>`;
}

let PRODUCTS = [];

function addRow() {
  const d = document.createElement("div");
  d.className = "row";
  d.innerHTML = `
    <input placeholder="Produto" data-k="productName">
    <input placeholder="Qtd" type="number" step="0.01" data-k="quantity">
    <input placeholder="Un" value="KG" data-k="unit">
    <input placeholder="Custo/un" type="number" step="0.01" data-k="unitCost">
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
    .filter((x) => x.productName && Number(x.quantity) > 0);
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
        ${p.active === false ? '<span class="pill">Arquivado</span>' : '<span class="pill">Ativo</span>'}
        <div class="muted">SKU: ${esc(p.sku || "-")} · Categoria: ${esc(p.category || "-")} · Unidade: ${esc(p.unit || "-")} · Custo: EUR ${money(p.defaultCost)}</div>
        <div class="actions">
          <button onclick="editProduct(${p.id})">Editar</button>
          ${p.active === false ? `<button onclick="restoreProduct(${p.id})">Restaurar</button>` : `<button onclick="archiveProduct(${p.id})">Arquivar</button>`}
          <button onclick="deleteProduct(${p.id})">Eliminar</button>
        </div>
      </div>
    `).join("")
    : '<p class="muted">Sem produtos registados.</p>';
}

async function refresh() {
  setStatus("A atualizar stock e movimentos...");
  const report = await api("/api/inventory/report");
  el("stock").innerHTML = (report.balances || []).map(itemHtml).join("") || '<p class="muted">Sem stock.</p>';
  el("movements").innerHTML = (report.lastMovements || []).map((m) => `
    <div class="item">
      <b>${esc(m.movementType)}</b> · ${esc(m.productName)} · ${esc(m.quantity)} ${esc(m.unit)}
      <br><span class="muted">${new Date(m.createdAt).toLocaleString("pt-PT")}</span>
    </div>
  `).join("") || '<p class="muted">Sem movimentos.</p>';
  await refreshProducts();
  setStatus("Inventario atualizado.", "ok");
}

async function editProduct(id) {
  const p = PRODUCTS.find((x) => Number(x.id) === Number(id));
  if (!p) return;
  const name = prompt("Produto", p.name || ""); if (name === null) return;
  const sku = prompt("SKU", p.sku || ""); if (sku === null) return;
  const category = prompt("Categoria", p.category || "CHEMICAL"); if (category === null) return;
  const unit = prompt("Unidade", p.unit || "KG"); if (unit === null) return;
  const defaultCost = prompt("Custo padrao EUR", p.defaultCost || 0); if (defaultCost === null) return;
  const notes = prompt("Notas", p.notes || ""); if (notes === null) return;
  await api(`/api/inventory/products/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, sku: sku || null, category, unit, defaultCost, notes }),
  });
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
  if (!confirm("Eliminar produto se nao tiver historico; caso tenha, sera arquivado. Continuar?")) return;
  await api(`/api/inventory/products/${id}`, { method: "DELETE" });
  await refresh();
}

el("purchaseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    setStatus("A guardar entrada de stock...");
    const fd = new FormData(e.target);
    fd.append("items", JSON.stringify(collectRows()));
    const res = await fetch("/api/inventory/purchases", {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || `Erro HTTP ${res.status}`);
    e.target.reset();
    el("items").innerHTML = "";
    addRow();
    setStatus("Entrada de stock guardada.", "ok");
    await refresh();
  } catch (error) {
    console.error(error);
    setStatus(`Falha ao guardar entrada: ${error.message}`, "error");
  }
});

el("transferForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    setStatus("A transferir stock para viatura...");
    const f = Object.fromEntries(new FormData(e.target));
    const body = {
      vehicleId: f.vehicleId,
      items: [{ productName: f.productName, quantity: f.quantity, unit: f.unit || "KG" }],
    };
    await api("/api/inventory/transfer-to-vehicle", { method: "POST", body: JSON.stringify(body) });
    e.target.reset();
    setStatus("Transferencia registada.", "ok");
    await refresh();
  } catch (error) {
    console.error(error);
    setStatus(`Falha na transferencia: ${error.message}`, "error");
  }
});

el("consumeForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    setStatus("A registar consumo...");
    const body = Object.fromEntries(new FormData(e.target));
    await api("/api/inventory/consume", { method: "POST", body: JSON.stringify(body) });
    e.target.reset();
    setStatus("Consumo registado.", "ok");
    await refresh();
  } catch (error) {
    console.error(error);
    setStatus(`Falha no consumo: ${error.message}`, "error");
  }
});

window.addRow = addRow;
window.editProduct = editProduct;
window.archiveProduct = archiveProduct;
window.restoreProduct = restoreProduct;
window.deleteProduct = deleteProduct;

addRow();
refresh().catch((e) => {
  console.error(e);
  setStatus(`Erro inicial: ${e.message}`, "error");
});
