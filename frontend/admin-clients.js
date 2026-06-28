const API = `${location.origin}/api/core`;

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[char]));
const val = (id) => document.getElementById(id)?.value?.trim() || "";

let CLIENTS = [];
let showArchived = false;
let clientStatusFilter = localStorage.getItem("cw_client_status_filter") || "active";
let clientInvoiceFilter = localStorage.getItem("cw_client_invoice_filter") || "all";

async function request(path, opts = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro");
  return data;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function paymentReference(clientId) {
  return `CW-${String(Number(clientId || 0)).padStart(6, "0")}`;
}

function statusLabel(client) {
  const status = String(client.status || "").toUpperCase();
  if (client.active === false || status === "ARCHIVED") return '<span class="pill cw-status-archived">Arquivado</span>';
  if (status === "ACTIVE") return '<span class="pill cw-status-active">Ativo</span>';
  return '<span class="pill cw-status-setup">Em configuracao</span>';
}

function isActiveClient(client) {
  const status = String(client.status || "").toUpperCase();
  const archiveStatus = String(client.archiveStatus || "").toUpperCase();
  return client.active !== false
    && status !== "ARCHIVED"
    && archiveStatus !== "ARQUIVADO"
    && !client.deletedAt;
}

function poolText(pool) {
  return [
    pool.name,
    pool.type,
    pool.zone,
    pool.location,
    pool.address,
  ].filter(Boolean).join(" ");
}

function clientSearchText(client) {
  return [
    client.name,
    client.internalName,
    client.email,
    client.phone,
    client.address,
    client.zone,
    client.status,
    client.paymentStatus,
    client.paymentReference || paymentReference(client.id),
    Number(client.creditBalance || 0) > 0 ? "credito positivo saldo a favor cliente" : "",
    client.creditBalance,
    client.requiresInvoice ? "fatura oficial faturacao oficial nif fiscal" : "sem fatura oficial",
    client.fiscalName,
    client.fiscalNif,
    client.fiscalAddress,
    client.fiscalEmail,
    client.externalBillingNotes,
    ...(client.pools || []).map(poolText),
  ].filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function clientSearchTokens(client) {
  return clientSearchText(client).split(/[^a-z0-9]+/).filter(Boolean);
}

function clientTotals(client) {
  const pools = client.pools || [];
  const invoices = client.invoices || [];
  const monthly = pools.reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0);
  const open = invoices.reduce((sum, invoice) => sum + Number(invoice.amountOpen || 0), 0);
  const paid = invoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0);
  const credit = Number(client.creditBalance || 0);
  const netOpen = Math.max(open - credit, 0);
  return { monthly, open, paid, credit, netOpen };
}

function renderClient(client) {
  const pools = client.pools || [];
  const totals = clientTotals(client);
  const firstPools = pools.slice(0, 4);
  const hasDebt = totals.netOpen > 0;
  const activeClient = isActiveClient(client);
  const contractActive = String(client.status || "").toUpperCase() === "ACTIVE";
  const lifecycleActions = client.active === false
    ? `<button onclick="restoreClient(${client.id})" class="cw-action-ok">Restaurar</button>`
    : `${contractActive
      ? `<span class="pill cw-status-active">Contrato ativo</span>`
      : `<label class="activation-inline">
          <span>1o pagamento</span>
          <input id="activationAmount-${client.id}" inputmode="decimal" placeholder="Opcional EUR">
        </label>
        <button data-activate-client="${client.id}" onclick="activateClient(${client.id})" class="cw-action-ok">Ativar contrato</button>`}
      <button onclick="archiveClient(${client.id})" class="cw-action-warn">Arquivar</button>`;
  return `
    <article class="client ${hasDebt ? "cw-card-warn" : ""} ${activeClient ? "cw-client-active" : "cw-client-inactive"}">
      <div class="client-main">
        <h3>${esc(client.name)}</h3>
        <div class="client-meta-line">
          ${statusLabel(client)}
          ${client.requiresInvoice ? '<span class="pill">Fatura oficial</span>' : '<span class="pill">Sem fatura oficial</span>'}
          ${hasDebt ? '<span class="pill cw-status-warn">Valores em aberto</span>' : '<span class="pill cw-status-active">Financeiro em dia</span>'}
          ${totals.credit > 0 ? '<span class="pill cw-status-active">Credito positivo</span>' : ""}
        </div>
        <div class="client-kv">
          <div>ID ${esc(client.id)} - ${esc(client.zone || "sem zona")}</div>
          <div><strong>${esc(client.paymentReference || paymentReference(client.id))}</strong></div>
          <div><strong>${esc(client.phone || "-")}</strong>${client.email ? `<br>${esc(client.email)}` : ""}</div>
        </div>
      </div>
      <div class="client-finance">
        <div class="client-section-label">Valores</div>
        <div class="client-kv">
          <div><strong>${money(totals.monthly)}</strong> / mes</div>
          <div>Aberto: ${money(totals.open)}</div>
          ${totals.credit > 0 ? `<div>Credito: ${money(totals.credit)}</div>` : ""}
          ${totals.credit > 0 ? `<div>Saldo a pagar: ${money(totals.netOpen)}</div>` : ""}
          <div>Pago: ${money(totals.paid)}</div>
        </div>
      </div>
      <div class="client-pools-wrap">
        <div class="client-section-label">Piscinas / Jacuzzis (${pools.length})</div>
        <div class="client-pools">
          ${firstPools.map((pool) => `<a class="pill" href="/admin-pool-technical?poolId=${esc(pool.id)}">${esc(pool.name || pool.type || "Piscina")} - ${esc(pool.zone || pool.location || "-")}</a>`).join("")}
          ${pools.length > firstPools.length ? `<span class="pill">+${pools.length - firstPools.length}</span>` : ""}
        </div>
      </div>
      <div class="client-actions-wrap">
        <div class="client-section-label">Acoes</div>
        <div class="client-actions">
          <button onclick="editClient(${client.id})">Editar</button>
          ${lifecycleActions}
          <button onclick="deleteClient(${client.id})" class="cw-action-danger">Eliminar</button>
          <a class="btn" href="/admin-pools?clientId=${client.id}">Piscinas</a>
          <a class="btn" href="/invoices?clientId=${client.id}">Conta corrente</a>
          <a class="btn" href="/admin-payments?clientId=${client.id}">Pagamentos</a>
          <a class="btn" href="/client-portal?clientId=${client.id}" target="_blank">Portal cliente</a>
        </div>
      </div>
    </article>
  `;
}

function renderList() {
  const container = document.getElementById("clients");
  const query = val("search").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  let searchedClients = CLIENTS;
  if (terms.length) searchedClients = searchedClients.filter((client) => {
    const haystack = clientSearchText(client);
    const tokens = clientSearchTokens(client);
    return terms.every((term) => {
      if (/^\d{1,3}$/.test(term) && terms.length > 1) {
        return tokens.includes(term);
      }
      return haystack.includes(term);
    });
  });

  const activeCount = searchedClients.filter(isActiveClient).length;
  const inactiveCount = searchedClients.length - activeCount;
  const allCount = searchedClients.length;
  let clients = searchedClients;
  if (clientStatusFilter === "active") clients = searchedClients.filter(isActiveClient);
  if (clientStatusFilter === "inactive") clients = searchedClients.filter((client) => !isActiveClient(client));
  if (clientInvoiceFilter === "official") clients = clients.filter((client) => client.requiresInvoice);
  if (clientInvoiceFilter === "no-official") clients = clients.filter((client) => !client.requiresInvoice);
  const totalPools = clients.reduce((sum, client) => sum + (client.pools || []).length, 0);
  const totalOpen = clients.reduce((sum, client) => sum + clientTotals(client).netOpen, 0);
  const totalCredit = clients.reduce((sum, client) => sum + clientTotals(client).credit, 0);
  const officialCount = searchedClients.filter((client) => client.requiresInvoice).length;
  const noOfficialCount = searchedClients.length - officialCount;
  const header = `
    <div class="client-list-summary">
      <div class="client-summary-stats">
        <strong>${clients.length} cliente(s) encontrados</strong>
        <span>${totalPools} piscina(s)/jacuzzi(s)</span>
        <span>Aberto ${money(totalOpen)}</span>
        <span>Credito ${money(totalCredit)}</span>
        <a class="btn primary" href="/to-issue">Faturacao oficial</a>
      </div>
      <div class="client-status-filters" role="group" aria-label="Filtrar clientes por estado">
        <button type="button" class="${clientStatusFilter === "active" ? "is-active" : ""}" onclick="setClientStatusFilter('active')">Ativos ${activeCount}</button>
        <button type="button" class="${clientStatusFilter === "inactive" ? "is-active" : ""}" onclick="setClientStatusFilter('inactive')">Não ativos ${inactiveCount}</button>
        <button type="button" class="${clientStatusFilter === "all" ? "is-active" : ""}" onclick="setClientStatusFilter('all')">Todos ${allCount}</button>
      </div>
      <div class="client-status-filters" role="group" aria-label="Filtrar clientes por faturacao oficial">
        <button type="button" class="${clientInvoiceFilter === "all" ? "is-active" : ""}" onclick="setClientInvoiceFilter('all')">Todas ${allCount}</button>
        <button type="button" class="${clientInvoiceFilter === "official" ? "is-active" : ""}" onclick="setClientInvoiceFilter('official')">Com fatura oficial ${officialCount}</button>
        <button type="button" class="${clientInvoiceFilter === "no-official" ? "is-active" : ""}" onclick="setClientInvoiceFilter('no-official')">Sem fatura oficial ${noOfficialCount}</button>
      </div>
      <span class="client-search-hint">Pesquisa por nome, telefone, email, referencia, NIF, dados fiscais, zona, morada, piscina, jacuzzi ou local.</span>
    </div>
  `;
  container.innerHTML = clients.length
    ? header + clients.map(renderClient).join("")
    : '<div class="cw-empty">Nenhum cliente encontrado para esta pesquisa.</div>';
}

async function loadClients() {
  const container = document.getElementById("clients");
  container.textContent = "A carregar...";
  try {
    const data = await request("/clients?includeInactive=1");
    CLIENTS = data.clients || [];
    renderList();
  } catch (error) {
    container.innerHTML = `<div class="cw-empty">${esc(error.message)}</div>`;
  }
}

function setClientStatusFilter(filter) {
  clientStatusFilter = ["active", "inactive", "all"].includes(filter) ? filter : "active";
  localStorage.setItem("cw_client_status_filter", clientStatusFilter);
  renderList();
}

function setClientInvoiceFilter(filter) {
  clientInvoiceFilter = ["all", "official", "no-official"].includes(filter) ? filter : "all";
  localStorage.setItem("cw_client_invoice_filter", clientInvoiceFilter);
  renderList();
}

function clientPayloadFromPrompts(client) {
  const name = prompt("Nome do cliente", client.name || "");
  if (name === null) return null;
  const phone = prompt("Telefone", client.phone || "");
  if (phone === null) return null;
  const email = prompt("Email", client.email || "");
  if (email === null) return null;
  const zone = prompt("Zona", client.zone || "");
  if (zone === null) return null;
  const notes = prompt("Notas internas", client.notes || "");
  if (notes === null) return null;
  const requiresInvoice = confirm("Este cliente necessita de fatura oficial externa?");
  let fiscalName = client.fiscalName || "";
  let fiscalNif = client.fiscalNif || "";
  let fiscalAddress = client.fiscalAddress || "";
  let fiscalEmail = client.fiscalEmail || "";
  let externalBillingNotes = client.externalBillingNotes || "";
  if (requiresInvoice) {
    fiscalName = prompt("Nome fiscal", fiscalName) || "";
    fiscalNif = prompt("NIF", fiscalNif) || "";
    fiscalAddress = prompt("Morada fiscal", fiscalAddress) || "";
    fiscalEmail = prompt("Email fiscal", fiscalEmail || email) || "";
    externalBillingNotes = prompt("Notas para contabilidade", externalBillingNotes) || "";
  }
  return { name, phone, email, zone, notes, requiresInvoice, fiscalName, fiscalNif, fiscalAddress, fiscalEmail, externalBillingNotes };
}

async function createClient() {
  const body = {
    name: val("name"),
    phone: val("phone"),
    email: val("email"),
    zone: val("zone"),
    notes: val("notes"),
    requiresInvoice: document.getElementById("requiresInvoice")?.checked || false,
    fiscalName: val("fiscalName"),
    fiscalNif: val("fiscalNif"),
    fiscalAddress: val("fiscalAddress"),
    fiscalEmail: val("fiscalEmail"),
    externalBillingNotes: val("externalBillingNotes"),
  };
  if (!body.name) return alert("Nome obrigatorio");
  try {
    await request("/clients", { method: "POST", body: JSON.stringify(body) });
    document.getElementById("clientForm").reset();
    await loadClients();
    alert("Cliente criado em configuracao. A faturacao fica desligada ate ativar o contrato.");
  } catch (error) {
    alert(error.message);
  }
}

async function editClient(id) {
  const client = CLIENTS.find((item) => Number(item.id) === Number(id));
  if (!client) return alert("Cliente nao encontrado na lista.");
  const body = clientPayloadFromPrompts(client);
  if (!body) return;
  try {
    await request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(body) });
    await loadClients();
    alert("Cliente atualizado.");
  } catch (error) {
    alert(error.message);
  }
}

async function activateClient(id) {
  const amountInput = document.getElementById(`activationAmount-${id}`);
  const amount = amountInput ? amountInput.value.trim() : "";
  const button = document.querySelector(`[data-activate-client="${id}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = "A ativar...";
  }
  try {
    await request(`/clients/${id}/activate`, { method: "POST", body: JSON.stringify({ amount }) });
    await loadClients();
    alert("Contrato ativado. A partir de agora comeca a faturacao.");
  } catch (error) {
    alert(error.message);
  } finally {
    if (button && button.isConnected) {
      button.disabled = false;
      button.textContent = "Ativar contrato";
    }
  }
}

async function archiveClient(id) {
  if (!confirm("Arquivar este cliente? Ele sai da operacao diaria mas mantem historico.")) return;
  try {
    await request(`/clients/${id}/archive`, { method: "POST" });
    loadClients();
  } catch (error) {
    alert(error.message);
  }
}

async function restoreClient(id) {
  try {
    await request(`/clients/${id}/restore`, { method: "POST" });
    loadClients();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteClient(id) {
  if (!confirm("Eliminar definitivamente apenas se nao houver historico critico. Se houver, sera arquivado. Continuar?")) return;
  try {
    await request(`/clients/${id}`, { method: "DELETE" });
    loadClients();
  } catch (error) {
    alert(error.message);
  }
}

function toggleArchived() {
  showArchived = !showArchived;
  document.getElementById("toggleArchived").textContent = showArchived ? "Ocultar arquivados" : "Ver arquivados";
  loadClients();
}

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const invoiceFilter = String(params.get("invoice") || params.get("fatura") || "").toLowerCase();
  const financialFilter = String(params.get("financial") || params.get("financeiro") || "").toLowerCase();
  if (["official", "real", "fatura-real", "fatura_oficial"].includes(invoiceFilter)) {
    clientInvoiceFilter = "official";
    clientStatusFilter = params.get("status") || "all";
  }
  if (["overdue", "debt", "atraso", "devedores"].includes(financialFilter)) {
    clientStatusFilter = params.get("status") || "all";
  }
  const search = document.getElementById("search");
  if (search) {
    const querySearch = params.get("search");
    if (querySearch) search.value = querySearch;
    search.placeholder = "Pesquisar por cliente, referencia, NIF, dados fiscais, zona, piscina, jacuzzi, local, telefone ou email";
    search.addEventListener("input", renderList);
  }
  loadClients();
});
