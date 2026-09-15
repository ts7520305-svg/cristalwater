const API = "/api";
const queryParams = new URLSearchParams(location.search);
const queryClientId = Number(queryParams.get("clientId") || 0);
let invoiceStatusFilter = String(queryParams.get("status") || queryParams.get("filter") || "all").toLowerCase();
if (!["all", "draft", "overdue", "pending", "paid"].includes(invoiceStatusFilter)) invoiceStatusFilter = "all";
let paymentModalState = { invoiceId: null, openAmount: 0 };
let invoicesState = [], invoicesLoaded = false, invoicesRead = 0;
const invoiceAuthorization = authHeaders().Authorization;

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

function unknownInvoices(message) {
  for (const id of ['sumInvoices', 'sumPending', 'sumAmount', 'sumOpen']) document.getElementById(id).textContent = '—';
  document.getElementById('invoiceList').innerHTML = `<div class="empty-box">${escapeHtml(message)}</div>`;
}

function invoiceSessionCurrent() {
  if (authHeaders().Authorization === invoiceAuthorization) return true;
  invoicesRead++; invoicesState = []; invoicesLoaded = false;
  closePaymentModal(); unknownInvoices('A sessao mudou. Reabra esta pagina.');
  showStatus('A sessao mudou. Reabra esta pagina para consultar a faturacao.', 'error');
  return false;
}
window.addEventListener('storage', event => { if (event.key === 'token' || event.key === null) invoiceSessionCurrent(); });

function renderInvoiceView() {
  let rows = queryClientId ? invoicesState.filter(invoice => Number(invoice.clientId || invoice.client?.id) === queryClientId) : invoicesState;
  rows = rows.filter(matchesInvoiceStatusFilter);
  updateSummary(rows); renderInvoices(rows);
  showStatus(`${rows.length} documento(s) apresentado(s).${invoiceStatusFilter === 'draft' ? ' Rascunhos por rever; ainda sem valor a cobrar.' : ''}`, 'ok');
}

async function loadInvoices() {
  if (!invoiceSessionCurrent()) return false;
  const own = ++invoicesRead;
  const current = () => own === invoicesRead && invoiceSessionCurrent();
  if (!invoicesLoaded) unknownInvoices('A consultar documentos...');
  showStatus('A carregar faturas...', 'info');
  try {
    const response = await fetch(`${API}/invoices`, { headers: { Authorization: invoiceAuthorization }, cache: 'no-store' });
    const data = await response.json();
    if (!current()) return false;
    if (!response.ok || !Array.isArray(data) || data.some(row => !row || !Number.isInteger(row.id) || row.id <= 0 || typeof row.status !== 'string' ||
      !row.status.trim() || ['total', 'amount', 'totalAmount', 'amountPaid', 'amountOpen'].some(key => row[key] != null && !Number.isFinite(Number(row[key])))) ||
      new Set(data.map(row => row.id)).size !== data.length) throw Error('Resposta de faturas invalida');
    invoicesState = data; invoicesLoaded = true; renderInvoiceView();
    return true;
  } catch (error) {
    if (!current()) return false;
    if (invoicesLoaded) renderInvoiceView(); else unknownInvoices('Nao foi possivel consultar os documentos. Atualize para tentar novamente.');
    showStatus(invoicesLoaded ? 'Nao foi possivel atualizar. Os valores apresentados sao da ultima consulta; volte a atualizar.' : 'Nao foi possivel consultar a faturacao. Volte a atualizar.', 'error');
    return false;
  }
}

function updateSummary(invoices) {
  const financial = invoices.filter(isReceivableInvoice);
  const totalInvoices = financial.length;
  const pending = invoices.filter((i) => isPendingStatus(i.status)).length;
  const amount = financial.reduce((sum, i) => sum + invoiceTotalAmount(i), 0);
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
      : "Sem documentos para este filtro.";
    list.innerHTML = `<div class="empty-box">${escapeHtml(emptyText)}</div>`;
    showStatus(emptyText, "ok");
    return;
  }

  list.innerHTML = "";

  invoices.forEach((invoice) => {
    const card = document.createElement("div");
    card.className = "invoice-card";
    card.dataset.invoiceId = invoice.id;

    const status = normalizeStatus(invoice.status);
    const statusLabel = statusLabelText(status);
    const statusClass = statusClassName(status);
    const totalAmount = invoiceTotalAmount(invoice);
    const openAmount = invoiceOpenAmount(invoice);
    const paidAmount = invoicePaidAmount(invoice);
    const creditLedger = isCreditLedgerInvoice(invoice);
    const draft = isDraftInvoice(invoice);
    const clientCredit = Number(invoice.client?.creditBalance || 0);

    const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
    const subtotal = lines.reduce((sum, line) => sum + Number(line.total || line.lineTotal || 0), 0);
    const taxAmount = Number(invoice.taxAmount || 0);
    const hasTaxRate = Number(invoice.taxRate || 0) > 0;

    card.innerHTML = `
      <div class="invoice-header">
        <div>
          <div class="invoice-title">${draft ? "Rascunho" : creditLedger ? "Credito positivo" : "Fatura"} #${escapeHtml(invoice.id)}</div>
          <div>
            <span class="invoice-badge month">${escapeHtml(formatMonth(invoice.month, invoice.year))}</span>
            <span class="invoice-badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span>
            ${creditLedger ? '<span class="invoice-badge paid">SALDO A FAVOR</span>' : ""}
          </div>
        </div>

        <div class="invoice-amount">${creditLedger ? paidAmount.toFixed(2) : totalAmount.toFixed(2)} EUR</div>
      </div>

      <div class="meta"><strong>Cliente:</strong> ${escapeHtml(invoice.client?.name || "-")}</div>
      ${isReceivableInvoice(invoice) ? `<div class="meta"><strong>Referencia pagamento:</strong> ${escapeHtml(paymentReference(invoice.clientId || invoice.client?.id))}</div>` : ""}
      <div class="meta"><strong>Email:</strong> ${escapeHtml(invoice.client?.email || "-")}</div>
      <div class="meta"><strong>Telefone:</strong> ${escapeHtml(invoice.client?.phone || "-")}</div>
      <div class="meta"><strong>Morada:</strong> ${escapeHtml(invoice.client?.address || "-")}</div>
      <div class="meta"><strong>Forma de pagamento:</strong> ${escapeHtml(invoice.paymentMethod || "-")}</div>
      ${clientCredit > 0 ? `<div class="meta"><strong>Credito atual do cliente:</strong> ${clientCredit.toFixed(2)} EUR</div>` : ""}
      <div class="meta"><strong>Linhas:</strong> ${lines.length} · <strong>Subtotal:</strong> ${subtotal.toFixed(2)} EUR · <strong>IVA:</strong> ${taxAmount.toFixed(2)} EUR${hasTaxRate ? ` (${Number(invoice.taxRate).toFixed(2)}%)` : ""} · <strong>Total:</strong> ${totalAmount.toFixed(2)} EUR</div>
      ${draft ? '<p class="meta">Rascunho por rever. O valor preparado ainda nao representa uma cobranca.</p>' : `<div class="meta"><strong>Pago:</strong> ${paidAmount.toFixed(2)} EUR · <strong>Em aberto:</strong> ${openAmount.toFixed(2)} EUR</div>`}

      <div class="actions">
        ${isReceivableInvoice(invoice) && openAmount > 0 ? `<button class="btn-green" onclick="openPaymentModal(${invoice.id}, ${openAmount.toFixed(2)})">Registar pagamento</button>` : ''}
        ${draft ? '' : `<button class="btn-blue" onclick="openInvoicePdf(${invoice.id})">Abrir PDF</button><button class="btn-gray" onclick="copyInvoiceLink(${invoice.id})">Copiar link PDF</button>`}
      </div>
    `;

    if (openAmount > 0) card.classList.add("overdue");
    list.appendChild(card);
  });
}

function openPaymentModal(invoiceId, openAmount) {
  if (!invoiceSessionCurrent()) return;
  const target = invoicesState.find(row => row.id === Number(invoiceId));
  if (!target || !isReceivableInvoice(target)) { showStatus('Este documento nao esta disponivel para pagamento. Reveja o seu estado.', 'error'); return; }
  const modal = document.getElementById("paymentModal");
  const meta = document.getElementById("paymentModalMeta");
  const amountInput = document.getElementById("paymentAmountInput");
  if (!modal || !meta || !amountInput) return;

  const openValue = invoiceOpenAmount(target);
  if (openValue <= 0) {
    showStatus("Esta fatura já está liquidada. Não é permitido registar pagamento duplicado.", "error");
    return;
  }

  paymentModalState = { invoiceId: Number(invoiceId), openAmount: openValue };
  meta.textContent = `Fatura #${invoiceId} · Em aberto: ${openValue.toFixed(2)} EUR`;
  amountInput.value = openValue.toFixed(2);
  document.getElementById("paymentMethodInput").value = "TRANSFER";
  document.getElementById("paymentNotesInput").value = "";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  amountInput.focus();
}

function closePaymentModal() {
  const modal = document.getElementById("paymentModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  paymentModalState = { invoiceId: null, openAmount: 0 };
}

async function submitPaymentModal() {
  if (!invoiceSessionCurrent()) return;
  const target = invoicesState.find(row => row.id === paymentModalState.invoiceId);
  if (!target || !isReceivableInvoice(target)) { closePaymentModal(); showStatus('O documento mudou. Atualize e reveja o seu estado.', 'error'); return; }
  const invoiceId = Number(paymentModalState.invoiceId || 0);
  const openAmount = Number(paymentModalState.openAmount || 0);
  const amount = Number(document.getElementById("paymentAmountInput")?.value || 0);
  const method = String(document.getElementById("paymentMethodInput")?.value || "TRANSFER");
  const notes = String(document.getElementById("paymentNotesInput")?.value || "").trim();

  if (!invoiceId) return;
  if (!Number.isFinite(amount) || amount <= 0) {
    showStatus("Indica um valor de pagamento válido.", "error");
    return;
  }

  // Evita criar crédito indevido por clique repetido numa fatura já liquidada.
  if (openAmount <= 0) {
    showStatus("Esta fatura já está liquidada. Pagamento duplicado bloqueado.", "error");
    closePaymentModal();
    return;
  }

  try {
    showStatus("A registar pagamento...", "info");
    const response = await fetch(`${API}/payments/invoice/${invoiceId}`, {
      method: "POST",
      headers: { Authorization: invoiceAuthorization, "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, notes }),
    });
    const data = await response.json().catch(() => ({}));
    if (!invoiceSessionCurrent()) return;

    if (!response.ok || data.ok === false) {
      showStatus(data.error || "Falha ao registar pagamento.", "error");
      return;
    }

    closePaymentModal();
    showStatus(`Pagamento registado. Aplicado: ${Number(data.appliedAmount || amount).toFixed(2)} EUR.`, "ok");
    await loadInvoices();
  } catch (error) {
    if (!invoiceSessionCurrent()) return;
    console.error("Erro ao registar pagamento:", error);
    showStatus("Erro de ligação ao registar pagamento.", "error");
  }
}

function setInvoiceStatusFilter(filter) {
  invoiceStatusFilter = ["all", "draft", "overdue", "pending", "paid"].includes(filter) ? filter : "all";
  const params = new URLSearchParams(location.search);
  if (invoiceStatusFilter === "all") params.delete("status");
  else params.set("status", invoiceStatusFilter);
  const nextQuery = params.toString();
  history.replaceState(null, "", `${location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
  loadInvoices();
}

async function generateInvoiceForClient() {
  if (!invoiceSessionCurrent()) return;
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
      headers: { Authorization: invoiceAuthorization },
    });

    const data = await res.json().catch(() => ({}));
    if (!invoiceSessionCurrent()) return;

    if (!res.ok) {
      showStatus(data.error || "Erro ao gerar fatura.");
      return;
    }

    showStatus(data.message || "Operação concluída.");
    await loadInvoices();
  } catch (error) {
    if (!invoiceSessionCurrent()) return;
    console.error("Erro ao gerar fatura:", error);
    showStatus("Erro de ligação ao servidor.");
  }
}

function invoiceDocumentAvailable(invoiceId) {
  if (!invoiceSessionCurrent()) return false;
  const invoice = invoicesState.find(row => row.id === Number(invoiceId));
  if (!invoice || isDraftInvoice(invoice)) { showStatus('Reveja o rascunho antes de usar um documento de cobranca.', 'error'); return false; }
  return true;
}

function openInvoicePdf(invoiceId) {
  if (!invoiceDocumentAvailable(invoiceId)) return;
  window.open(`${API}/invoice-pdf/${invoiceId}`, "_blank");
}

async function copyInvoiceLink(invoiceId) {
  if (!invoiceDocumentAvailable(invoiceId)) return;
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
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (match) return `${match[2]}/${match[1]}`;
  return month && year ? `${String(month).padStart(2, "0")}/${year}` : 'Periodo por confirmar';
}

function isDraftInvoice(invoice) {
  return ['DRAFT', 'RASCUNHO'].includes(normalizeStatus(invoice.status));
}
function isReceivableInvoice(invoice) {
  return !['DRAFT', 'RASCUNHO', 'CANCELLED', 'CANCELED', 'CANCELADO', 'VOID', 'ARCHIVED', 'SUPERSEDED'].includes(normalizeStatus(invoice.status));
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
  if (!isReceivableInvoice(invoice)) return 0;
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
  if (invoiceStatusFilter === "draft") return isDraftInvoice(invoice);
  if (invoiceStatusFilter !== 'all' && !isReceivableInvoice(invoice)) return false;
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
  return ["PENDING", "PENDENTE", "OPEN", "ISSUED", "SENT", "VENCIDA", "OVERDUE", "PARTIAL", "PARCIAL"].includes(normalizeStatus(status));
}

function statusLabelText(status) {
  const value = normalizeStatus(status);
  if (['DRAFT', 'RASCUNHO'].includes(value)) return 'RASCUNHO';
  if (value === 'ISSUED') return 'EMITIDA';
  if (value === 'SENT') return 'ENVIADA';
  if (value === 'ARCHIVED') return 'ARQUIVADA';
  if (value === 'SUPERSEDED') return 'SUBSTITUIDA';
  if (value === 'VOID') return 'ANULADA';
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

window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.submitPaymentModal = submitPaymentModal;
