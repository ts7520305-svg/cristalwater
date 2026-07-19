const API = "/api";
const queryParams = new URLSearchParams(location.search);
const queryClientId = Number(queryParams.get("clientId") || 0);
let invoiceStatusFilter = String(queryParams.get("status") || queryParams.get("filter") || "all").toLowerCase();
if (!["all", "overdue", "pending", "paid"].includes(invoiceStatusFilter)) invoiceStatusFilter = "all";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

window.onload = () => {
  const input = document.getElementById("clientIdInput");
  if (input && queryClientId) input.value = String(queryClientId);
  const statusSelect = document.getElementById("statusFilter");
  if (statusSelect) statusSelect.value = invoiceStatusFilter;
  loadInvoices();
};

async function loadInvoices() {
  const list = document.getElementById("invoiceList");
  list.innerHTML = `<div class="empty-box">A carregar faturas...</div>`;
  showStatus("A carregar faturas...", "info");

  try {
    const res = await fetch(`${API}/invoices`, { headers: authHeaders() });
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      list.innerHTML = `<div class="empty-box">Erro ao carregar faturas.</div>`;
      updateSummary([]);
      showStatus(`Erro ao carregar faturas (HTTP ${res.status}).`, "error");
      return;
    }

    const invoices = Array.isArray(data) ? data : [];
    let filteredInvoices = queryClientId
      ? invoices.filter((invoice) => Number(invoice.clientId || invoice.client?.id) === queryClientId)
      : invoices;
    filteredInvoices = filteredInvoices.filter(matchesInvoiceStatusFilter);

    const statusMessages = [];
    if (queryClientId) {
      statusMessages.push(`Conta corrente filtrada para o cliente ID ${queryClientId}.`);
    }
    if (invoiceStatusFilter === "overdue") statusMessages.push("A mostrar apenas clientes/faturas com valor em aberto.");
    if (invoiceStatusFilter === "pending") statusMessages.push("A mostrar apenas faturas pendentes.");
    if (invoiceStatusFilter === "paid") statusMessages.push("A mostrar apenas faturas pagas.");
    if (statusMessages.length) showStatus(statusMessages.join("\n"));
    else showStatus(`${filteredInvoices.length} fatura(s) carregada(s).`, "ok");

    updateSummary(filteredInvoices);
    renderInvoices(filteredInvoices);
  } catch (error) {
    console.error("Erro ao carregar faturas:", error);
    list.innerHTML = `<div class="empty-box">Erro de ligação ao servidor.</div>`;
    updateSummary([]);
    showStatus("Erro de ligacao ao servidor de faturas.", "error");
  }
}

function updateSummary(invoices) {
  const totalInvoices = invoices.length;
  const pending = invoices.filter((i) => isPendingStatus(i.status)).length;
  const amount = invoices.reduce((sum, i) => sum + invoiceTotalAmount(i), 0);
  const open = invoices.reduce((sum, i) => sum + invoiceOpenAmount(i), 0);

  document.getElementById("sumInvoices").textContent = totalInvoices;
  document.getElementById("sumPending").textContent = pending;
  document.getElementById("sumAmount").textContent = `${amount.toFixed(2)} €`;
  const openBox = document.getElementById("sumOpen");
  if (openBox) openBox.textContent = `${open.toFixed(2)} EUR`;
}

function paymentReference(clientId) {
  return clientId ? `CW-${String(Number(clientId)).padStart(6, "0")}` : "-";
}

function renderInvoices(invoices) {
  const list = document.getElementById("invoiceList");

  if (!invoices.length) {
    const emptyText = invoiceStatusFilter === "overdue"
      ? "Sem faturas em atraso ou valores em aberto."
      : "Ainda nao existem faturas para este filtro.";
    list.innerHTML = `<div class="empty-box">${escapeHtml(emptyText)}</div>`;
    showStatus(emptyText, "ok");
    return;
  }

  list.innerHTML = "";

  invoices.forEach((invoice) => {
    const card = document.createElement("div");
    card.className = "invoice-card";

    const status = normalizeStatus(invoice.status);
    const statusLabel = statusLabelText(status);
    const statusClass = statusClassName(status);
    const totalAmount = invoiceTotalAmount(invoice);
    const openAmount = invoiceOpenAmount(invoice);
    const paidAmount = invoicePaidAmount(invoice);
    const creditLedger = isCreditLedgerInvoice(invoice);
    const clientCredit = Number(invoice.client?.creditBalance || 0);

    card.innerHTML = `
      <div class="invoice-header">
        <div>
          <div class="invoice-title">${creditLedger ? "Credito positivo" : "Fatura"} #${escapeHtml(invoice.id)}</div>
          <div>
            <span class="invoice-badge month">${escapeHtml(formatMonth(invoice.month, invoice.year))}</span>
            <span class="invoice-badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span>
            ${creditLedger ? '<span class="invoice-badge paid">SALDO A FAVOR</span>' : ""}
          </div>
        </div>

        <div class="invoice-amount">${creditLedger ? paidAmount.toFixed(2) : totalAmount.toFixed(2)} EUR</div>
      </div>

      <div class="meta"><strong>Cliente:</strong> ${escapeHtml(invoice.client?.name || "-")}</div>
      <div class="meta"><strong>Referencia pagamento:</strong> ${escapeHtml(paymentReference(invoice.clientId || invoice.client?.id))}</div>
      <div class="meta"><strong>Email:</strong> ${escapeHtml(invoice.client?.email || "-")}</div>
      <div class="meta"><strong>Telefone:</strong> ${escapeHtml(invoice.client?.phone || "-")}</div>
      <div class="meta"><strong>Morada:</strong> ${escapeHtml(invoice.client?.address || "-")}</div>
      <div class="meta"><strong>Forma de pagamento:</strong> ${escapeHtml(invoice.paymentMethod || "-")}</div>
      ${clientCredit > 0 ? `<div class="meta"><strong>Credito atual do cliente:</strong> ${clientCredit.toFixed(2)} EUR</div>` : ""}
      <div class="meta"><strong>Pago:</strong> ${paidAmount.toFixed(2)} EUR · <strong>Em aberto:</strong> ${openAmount.toFixed(2)} EUR</div>

      <div class="actions">
        <button class="btn-blue" onclick="openInvoicePdf(${invoice.id})">Abrir PDF</button>
        <button class="btn-gray" onclick="copyInvoiceLink(${invoice.id})">Copiar link PDF</button>
      </div>
    `;

    if (openAmount > 0) card.classList.add("overdue");
    list.appendChild(card);
  });
}

function setInvoiceStatusFilter(filter) {
  invoiceStatusFilter = ["all", "overdue", "pending", "paid"].includes(filter) ? filter : "all";
  const params = new URLSearchParams(location.search);
  if (invoiceStatusFilter === "all") params.delete("status");
  else params.set("status", invoiceStatusFilter);
  const nextQuery = params.toString();
  history.replaceState(null, "", `${location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
  loadInvoices();
}

async function generateInvoiceForClient() {
  const input = document.getElementById("clientIdInput");
  const clientId = Number(input.value);

  if (!clientId || Number.isNaN(clientId)) {
    showStatus("Indica um Client ID válido.");
    return;
  }

  showStatus("A gerar fatura...");

  try {
    const res = await fetch(`${API}/invoices/generate-for-client/${clientId}`, {
      method: "POST",
      headers: authHeaders(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showStatus(data.error || "Erro ao gerar fatura.");
      return;
    }

    showStatus(data.message || "Operação concluída.");
    await loadInvoices();
  } catch (error) {
    console.error("Erro ao gerar fatura:", error);
    showStatus("Erro de ligação ao servidor.");
  }
}

function openInvoicePdf(invoiceId) {
  window.open(`${API}/invoice-pdf/${invoiceId}`, "_blank");
}

async function copyInvoiceLink(invoiceId) {
  const link = `${API}/invoice-pdf/${invoiceId}`;

  try {
    await navigator.clipboard.writeText(link);
    showStatus(`Link copiado:\n${link}`);
  } catch (error) {
    console.error("Erro ao copiar link:", error);
    showStatus("Não foi possível copiar o link.");
  }
}

function showStatus(message, tone = "info") {
  const box = document.getElementById("statusBox");
  box.style.display = "block";
  box.textContent = message;
  box.className = `status-box ${tone === "info" ? "" : tone}`.trim();
}

function formatMonth(month, year) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function invoiceTotalAmount(invoice) {
  return Number(invoice.totalAmount || invoice.total || invoice.amount || 0);
}

function invoicePaidAmount(invoice) {
  const direct = Number(invoice.amountPaid || 0);
  if (direct > 0) return direct;
  return (invoice.payments || []).reduce((sum, payment) => {
    const amount = Number(payment.amount || 0);
    if (amount > 0) return sum + amount;
    return sum + Number(payment.amountCents || 0) / 100;
  }, 0);
}

function invoiceOpenAmount(invoice) {
  const direct = Number(invoice.amountOpen || 0);
  if (direct > 0) return direct;
  return Math.max(invoiceTotalAmount(invoice) - invoicePaidAmount(invoice), 0);
}

function isCreditLedgerInvoice(invoice) {
  const text = [
    invoice.notes,
    invoice.monthRef,
    ...(invoice.lines || []).map((line) => `${line.type || ""} ${line.description || ""} ${line.notes || ""}`),
  ].filter(Boolean).join(" ").toUpperCase();
  return text.includes("CREDIT_DEPOSIT") || text.includes("CREDITO POSITIVO") || text.includes("CRÉDITO POSITIVO");
}

function matchesInvoiceStatusFilter(invoice) {
  const status = normalizeStatus(invoice.status);
  if (invoiceStatusFilter === "overdue") {
    return invoiceOpenAmount(invoice) > 0 && !["CANCELLED", "CANCELED", "CANCELADO"].includes(status);
  }
  if (invoiceStatusFilter === "pending") return isPendingStatus(status) && invoiceOpenAmount(invoice) > 0;
  if (invoiceStatusFilter === "paid") return ["PAID", "PAGO"].includes(status) || invoiceOpenAmount(invoice) <= 0;
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeStatus(status) {
  return String(status || "PENDING").trim().toUpperCase();
}

function isPendingStatus(status) {
  return ["PENDING", "PENDENTE", "OPEN", "VENCIDA", "OVERDUE", "PARTIAL", "PARCIAL"].includes(normalizeStatus(status));
}

function statusLabelText(status) {
  const value = normalizeStatus(status);
  if (["PAID", "PAGO"].includes(value)) return "PAGO";
  if (["PARTIAL", "PARCIAL"].includes(value)) return "PARCIAL";
  if (["CANCELLED", "CANCELED", "CANCELADO"].includes(value)) return "CANCELADO";
  if (["OVERDUE", "VENCIDA"].includes(value)) return "VENCIDA";
  return "PENDENTE";
}

function statusClassName(status) {
  const value = normalizeStatus(status);
  if (["PAID", "PAGO"].includes(value)) return "paid";
  if (["PARTIAL", "PARCIAL"].includes(value)) return "partial";
  if (["CANCELLED", "CANCELED", "CANCELADO"].includes(value)) return "cancelled";
  if (["OVERDUE", "VENCIDA"].includes(value)) return "overdue";
  return "pending";
}
