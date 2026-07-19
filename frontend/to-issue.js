const API = "/api";
const actionLock = new Set();

const state = {
  clients: [],
  summary: {},
};

const el = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[char]));

function money(value) {
  return Number(value || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function status(message, tone = "") {
  const node = el("status");
  if (!node) return;
  node.textContent = message;
  node.style.color = tone === "error" ? "#ffb3b3" : tone === "ok" ? "#a9ffd9" : "";
}

function metric(label, value, tone = "") {
  return `<div class="metric ${esc(tone)}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function renderMetrics(summary = {}) {
  el("metrics").innerHTML = [
    metric("Clientes com fatura", summary.clients || 0),
    metric("Pendentes oficiais", summary.pendingInvoices || 0, Number(summary.pendingInvoices || 0) ? "warn" : ""),
    metric("Valor pendente", money(summary.pendingTotal || 0), Number(summary.pendingTotal || 0) ? "warn" : ""),
    metric("Ja emitidas", summary.issuedInvoices || 0),
    metric("Dados incompletos", summary.missingFiscalData || 0, Number(summary.missingFiscalData || 0) ? "warn" : ""),
  ].join("");
}

function invoiceTotal(invoice) {
  return Number(invoice.totalAmount || invoice.total || invoice.amount || 0);
}

function invoiceLabel(invoice) {
  return invoice.monthRef || invoice.month || `Fatura #${invoice.id}`;
}

function renderPendingInvoice(invoice, client) {
  return `
    <div class="invoice-row">
      <div class="invoice-main">
        <b>#${esc(invoice.id)} - ${esc(invoiceLabel(invoice))}</b>
        <span>${esc(invoice.status || "PENDING")} - ${money(invoiceTotal(invoice))} - aberto ${money(invoice.amountOpen || 0)}</span>
      </div>
      <div class="invoice-actions">
        <button type="button" onclick="openPdf(${Number(invoice.id)})">PDF interno</button>
        <button class="ok" type="button" onclick="markIssued(${Number(invoice.id)}, '${esc(client.name).replace(/'/g, "\\'")}')">Marcar emitida</button>
      </div>
    </div>
  `;
}

function renderIssuedInvoice(invoice) {
  return `
    <div class="invoice-row issued">
      <div class="invoice-main">
        <b>#${esc(invoice.id)} - ${esc(invoice.externalInvoiceNo || "Sem numero externo")}</b>
        <span>${esc(invoiceLabel(invoice))} - ${money(invoiceTotal(invoice))} - marcada em ${esc(fmtDate(invoice.updatedAt || invoice.issueDate))}</span>
      </div>
      <div class="invoice-actions">
        <button type="button" onclick="openPdf(${Number(invoice.id)})">PDF interno</button>
      </div>
    </div>
  `;
}

function renderClient(client) {
  const missing = !client.fiscalDataComplete;
  const pending = client.pendingInvoices || [];
  const issued = client.issuedInvoices || [];

  return `
    <article class="client-card ${missing ? "missing-data" : ""}">
      <div>
        <div class="client-title">
          <h2>${esc(client.name || "Cliente")}</h2>
          <span class="pill ${missing ? "warn" : "ok"}">${missing ? "Dados fiscais incompletos" : "Dados fiscais OK"}</span>
        </div>
        <div class="meta">
          <div><strong>Referencia:</strong> ${esc(client.paymentReference || "-")}</div>
          <div><strong>Contacto:</strong> ${esc(client.phone || "-")} ${client.email ? `- ${esc(client.email)}` : ""}</div>
          <div><strong>Zona:</strong> ${esc(client.zone || "-")} - ${Number(client.poolsCount || 0)} piscina(s)/jacuzzi(s)</div>
        </div>
        <div class="invoice-actions" style="margin-top:12px;justify-content:flex-start">
          <a class="btn" href="/admin-clients?search=${encodeURIComponent(client.name || "")}">Abrir cliente</a>
          <a class="btn" href="/invoices?clientId=${Number(client.id)}">Conta corrente</a>
        </div>
      </div>
      <div>
        <div class="section-label">Dados fiscais</div>
        <div class="meta">
          <div><strong>Nome fiscal:</strong> ${esc(client.fiscalName || "-")}</div>
          <div><strong>NIF:</strong> ${esc(client.fiscalNif || "-")}</div>
          <div><strong>Morada:</strong> ${esc(client.fiscalAddress || "-")}</div>
          <div><strong>Email fiscal:</strong> ${esc(client.fiscalEmail || "-")}</div>
          <div><strong>Notas:</strong> ${esc(client.externalBillingNotes || "-")}</div>
        </div>
      </div>
      <div>
        <div class="section-label">Faturas oficiais</div>
        <div class="invoice-block">
          ${pending.length ? pending.map((invoice) => renderPendingInvoice(invoice, client)).join("") : '<div class="empty">Sem faturas oficiais pendentes.</div>'}
          ${issued.length ? `<div class="section-label" style="margin-top:8px">Historico ja emitido</div>${issued.slice(0, 5).map(renderIssuedInvoice).join("")}` : ""}
        </div>
      </div>
    </article>
  `;
}

function render() {
  renderMetrics(state.summary);
  const list = el("list");
  if (!state.clients.length) {
    list.innerHTML = '<div class="empty">Nada encontrado para estes filtros.</div>';
    return;
  }
  list.innerHTML = state.clients.map(renderClient).join("");
}

async function load() {
  const query = el("search")?.value?.trim() || "";
  const filter = el("statusFilter")?.value || "pending";
  status("A carregar faturacao oficial...");
  try {
    const response = await fetch(`${API}/invoices/to-issue?status=${encodeURIComponent(filter)}&q=${encodeURIComponent(query)}`, {
      headers: authHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Erro ao carregar");

    state.clients = Array.isArray(data.clients) ? data.clients : [];
    state.summary = data.summary || {};
    render();
    status(`${state.clients.length} cliente(s) visiveis. Atualizado ${fmtDate(data.generatedAt)}.`, "ok");
  } catch (error) {
    console.error(error);
    el("list").innerHTML = `<div class="empty">${esc(error.message || "Erro de ligacao")}</div>`;
    status(error.message || "Erro de ligacao", "error");
  }
}

function openPdf(id) {
  window.open(`${API}/invoice-pdf/${id}`, "_blank");
}

async function markIssued(id, clientName) {
  if (actionLock.has(`issued:${id}`)) return;
  const allow = confirm(`Confirmar marcação da fatura #${id} como emitida externamente para ${clientName || "cliente"}?`);
  if (!allow) return;
  const externalInvoiceNo = prompt(`Numero da fatura oficial externa para ${clientName || "cliente"}`, "");
  if (!externalInvoiceNo) return;

  try {
    actionLock.add(`issued:${id}`);
    status("A marcar fatura como emitida externamente...");
    const response = await fetch(`${API}/invoices/${id}/mark-issued`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ externalInvoiceNo }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Erro ao marcar fatura");
    status(`Fatura #${id} marcada com numero externo ${externalInvoiceNo}.`, "ok");
    await load();
  } catch (error) {
    console.error(error);
    alert(error.message || "Erro ao marcar fatura");
    status(error.message || "Erro ao marcar fatura", "error");
  } finally {
    actionLock.delete(`issued:${id}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const statusParam = String(params.get("status") || "").toLowerCase();
  const allowedStatus = ["pending", "issued", "missing-data", "all"];
  if (allowedStatus.includes(statusParam) && el("statusFilter")) {
    el("statusFilter").value = statusParam;
  }
  const queryParam = String(params.get("q") || params.get("search") || "").trim();
  if (queryParam && el("search")) el("search").value = queryParam;
  el("refreshBtn")?.addEventListener("click", load);
  el("searchBtn")?.addEventListener("click", load);
  el("search")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") load();
  });
  el("statusFilter")?.addEventListener("change", load);
  load();
});

window.load = load;
window.openPdf = openPdf;
window.markIssued = markIssued;
