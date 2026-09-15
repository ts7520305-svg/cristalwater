const API = "/api";
const queryParams = new URLSearchParams(location.search);
const queryClientId = Number(queryParams.get("clientId") || 0);
let invoiceStatusFilter = String(queryParams.get("status") || queryParams.get("filter") || "all").toLowerCase();
if (!["all", "draft", "overdue", "pending", "paid"].includes(invoiceStatusFilter)) invoiceStatusFilter = "all";
let paymentModalState = { invoiceId: null, openAmount: 0 };
let invoicesState = [], invoicesLoaded = false, invoicesFresh = false, invoicesRead = 0, invoicePayment = null;
const invoiceAuthorization = authHeaders().Authorization;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

window.onload = () => {
  const topbar = document.querySelector('.cw-v2-shell-topbar');
  if (topbar && window.ResizeObserver) new ResizeObserver(() => {
    document.body.style.setProperty('--invoice-header-height', `${topbar.getBoundingClientRect().height}px`);
  }).observe(topbar);
  invoicePayment = setupInvoicePayment();
  const input = document.getElementById("clientIdInput");
  if (input && queryClientId) input.value = String(queryClientId);
  const statusSelect = document.getElementById("statusFilter");
  if (statusSelect) statusSelect.value = invoiceStatusFilter;
  loadInvoices();
};

function unknownInvoices(message) {
  for (const id of ['sumInvoices', 'sumPending', 'sumAmount', 'sumOpen', 'sumDrafts']) { const box = document.getElementById(id); if (box) box.textContent = '—'; }
  document.getElementById('invoiceList').innerHTML = `<div class="empty-box">${escapeHtml(message)}</div>`;
}

function invoiceSessionCurrent() {
  if (authHeaders().Authorization === invoiceAuthorization) return true;
  invoicesRead++; invoicesState = []; invoicesLoaded = false; invoicesFresh = false;
  closePaymentModal(true); invoicePayment?.hide(); unknownInvoices('A sessao mudou. Reabra esta pagina.');
  showStatus('A sessao mudou. Reabra esta pagina para consultar a faturacao.', 'error');
  return false;
}
window.addEventListener('storage', event => { if (event.key === 'token' || event.key === null) invoiceSessionCurrent(); });

function renderInvoiceView() {
  let rows = queryClientId ? invoicesState.filter(invoice => Number(invoice.clientId || invoice.client?.id) === queryClientId) : invoicesState;
  rows = rows.filter(matchesInvoiceStatusFilter);
  updateSummary(rows); renderInvoices(rows);
  invoicePayment?.render();
  showStatus(`${rows.length} documento(s) apresentado(s).${invoiceStatusFilter === 'draft' ? ' Rascunhos por rever; ainda sem valor a cobrar.' : ''}`, 'ok');
}

async function loadInvoices() {
  if (!invoiceSessionCurrent()) return false;
  invoicesFresh = false; invoicePayment?.render();
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
    invoicesState = data; invoicesLoaded = true; invoicesFresh = true; renderInvoiceView();
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
      <div class="meta"><strong>Pago:</strong> ${paidAmount.toFixed(2)} EUR · <strong>Em aberto:</strong> ${openAmount.toFixed(2)} EUR</div>

      <div class="actions">
        ${isReceivableInvoice(invoice) && openAmount > 0 ? `<button class="btn-green" data-invoice-payment onclick="openPaymentModal(${invoice.id}, ${openAmount.toFixed(2)})">Registar pagamento</button>` : ''}
        ${draft ? '' : `<button class="btn-blue" onclick="openInvoicePdf(${invoice.id})">Abrir PDF</button><button class="btn-gray" onclick="copyInvoiceLink(${invoice.id})">Copiar link PDF</button>`}
      </div>
    `;

    if (openAmount > 0) card.classList.add("overdue");
    list.appendChild(card);
  });
}

function openPaymentModal(invoiceId, openAmount) {
  if (!invoiceSessionCurrent()) return;
  if (!invoicePayment?.canStart()) { showStatus('Atualize a lista ou confirme o pagamento guardado antes de preparar outro.', 'error'); return; }
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

  paymentModalState = { invoiceId: Number(invoiceId), openAmount: openValue, version: paymentSourceVersion(target) };
  meta.textContent = `Fatura #${invoiceId} · Em aberto: ${openValue.toFixed(2)} EUR`;
  amountInput.value = openValue.toFixed(2);
  document.getElementById("paymentMethodInput").value = "TRANSFER";
  document.getElementById("paymentNotesInput").value = "";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  amountInput.focus();
}

function closePaymentModal(force = false) {
  if (!force && invoicePayment?.busy()) return;
  const modal = document.getElementById("paymentModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  paymentModalState = { invoiceId: null, openAmount: 0 };
}

async function submitPaymentModal() {
  return invoicePayment?.submit(true);
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

function paymentSourceVersion(invoice) {
  return JSON.stringify([invoice.id, invoice.clientId, invoice.updatedAt, invoice.status, invoiceTotalAmount(invoice), invoicePaidAmount(invoice), invoiceOpenAmount(invoice)]);
}

function setupInvoicePayment() {
  let owner, actorId, key, pending = null, blocked = false, working = false, issue = '';
  const panel = document.createElement('div'), summary = document.createElement('p');
  const retry = document.createElement('button'), review = document.createElement('button');
  panel.id = 'invoicePaymentPending'; panel.hidden = true; panel.setAttribute('data-cw-no-i18n', 'true');
  panel.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #9aabbb;border-radius:10px;overflow-wrap:anywhere';
  summary.style.whiteSpace = 'pre-line';
  retry.type = review.type = 'button'; retry.className = 'btn-blue'; review.className = 'btn-gray';
  retry.textContent = 'Confirmar pagamento guardado'; review.textContent = 'Rever pagamento';
  panel.append(summary, retry, review); document.getElementById('statusBox').after(panel);
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
  const sameSession = () => authHeaders().Authorization === invoiceAuthorization;
  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      const record = JSON.parse(raw);
      if (record?.schema !== 1 || record.owner !== owner || !uuid(record.requestId) || !positive(record.invoiceId) || !positive(record.clientId) || !positive(record.amountCents) ||
        !['TRANSFER', 'MBWAY', 'CASH', 'CARD', 'MANUAL'].includes(record.method) || typeof record.notes !== 'string' || record.notes.length > 2000 || record.notes !== record.notes.trim() ||
        typeof record.details !== 'string' || record.details.length > 2000 ||
        (record.rejection && (![400, 404, 409].includes(record.rejection.status) || typeof record.rejection.message !== 'string'))) throw Error();
      return record;
    } catch (_) {
      blocked = true; issue = 'O pagamento guardado não pode ser lido. Foi conservado para revisão; nenhum novo pedido será enviado.';
      throw Error(issue);
    }
  }
  function render() {
    const same = sameSession(), disabled = !same || working || blocked || Boolean(pending) || !invoicesFresh;
    panel.hidden = !same || (!pending && !blocked);
    if (same && pending) summary.textContent = `${pending.rejection ? pending.rejection.message : 'Pagamento por confirmar'}\n${pending.details}\n${(pending.amountCents / 100).toFixed(2)} EUR · ${pending.method}${pending.notes ? '\n' + pending.notes : ''}`;
    if (same && blocked) summary.textContent = issue;
    retry.hidden = blocked || !pending; retry.disabled = working || Boolean(pending?.rejection);
    review.hidden = !pending?.rejection || blocked; review.disabled = working;
    document.querySelectorAll('[data-invoice-payment]').forEach(button => { button.disabled = disabled; });
    for (const id of ['paymentAmountInput', 'paymentMethodInput', 'paymentNotesInput', 'paymentConfirm']) {
      const element = document.getElementById(id); if (element) element.disabled = disabled;
    }
    const cancel = document.getElementById('paymentCancel'); if (cancel) cancel.disabled = working;
  }
  function forget(record) {
    if (JSON.stringify(read()) !== JSON.stringify(record)) throw Error('O pagamento mudou noutra janela. Atualize a página.');
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) throw Error('Não foi possível concluir a confirmação neste navegador. Repita a confirmação guardada.');
    pending = null;
  }
  function validReceipt(data, record) {
    const receipt = data?.requestReceipt;
    return data?.ok === true && data.invoice?.id === record.invoiceId && data.invoice?.clientId === record.clientId && receipt?.version === 1 &&
      receipt.requestId === record.requestId && receipt.invoiceId === record.invoiceId && receipt.actorId === actorId && receipt.actorRole === 'ADMIN' &&
      receipt.amountCents === record.amountCents && receipt.method === record.method && receipt.notes === record.notes &&
      Number.isSafeInteger(receipt.appliedCents) && receipt.appliedCents >= 0 && Number.isSafeInteger(receipt.creditCents) && receipt.creditCents >= 0 &&
      receipt.appliedCents + receipt.creditCents === record.amountCents && Number.isFinite(data.appliedAmount) && Number.isFinite(data.creditAdded) &&
      Math.round(data.appliedAmount * 100) === receipt.appliedCents && Math.round(data.creditAdded * 100) === receipt.creditCents;
  }
  async function submit(fresh = false, discard = false) {
    if (blocked || working || !invoiceSessionCurrent()) return;
    if (!navigator.locks?.request || !crypto.randomUUID) { showStatus('Abra esta página num navegador atualizado para proteger pagamentos entre janelas.', 'error'); return; }
    const form = fresh ? { ...paymentModalState, amount: document.getElementById('paymentAmountInput').value,
      method: document.getElementById('paymentMethodInput').value, notes: document.getElementById('paymentNotesInput').value.trim() } : null;
    working = true; render();
    try {
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!invoiceSessionCurrent()) return;
        if (!lock) { showStatus('Existe um pagamento em curso noutra janela. Aguarde e atualize a lista.', 'error'); return; }
        pending = read();
        if (discard) {
          if (pending?.rejection && await loadInvoices() && invoiceSessionCurrent()) {
            forget(pending); closePaymentModal(true); showStatus('Reveja o saldo atualizado antes de registar outro pagamento.', 'info');
          }
          return;
        }
        if (pending && (fresh || pending.rejection)) { closePaymentModal(true); showStatus('Reveja o pagamento guardado antes de preparar outro.', 'error'); return; }
        if (!pending) {
          if (!fresh) { await loadInvoices(); showStatus('O pedido já foi confirmado noutra janela. Consulte o saldo atualizado.', 'info'); return; }
          if (!positive(form.invoiceId) || !/^\d+(\.\d{1,2})?$/.test(form.amount) || !positive(Math.round(Number(form.amount) * 100))) throw Error('Indica um valor positivo, com até dois decimais.');
          if (!['TRANSFER', 'MBWAY', 'CASH', 'CARD', 'MANUAL'].includes(form.method) || form.notes.length > 2000) throw Error('Método ou notas inválidos.');
          if (!await loadInvoices() || !invoiceSessionCurrent()) return;
          const target = invoicesState.find(row => row.id === form.invoiceId);
          if (!target || !isReceivableInvoice(target) || invoiceOpenAmount(target) <= 0 || paymentSourceVersion(target) !== form.version) {
            closePaymentModal(true); showStatus('O documento ou saldo mudou. Um rascunho não aceita pagamentos. Reveja a lista e confirme novamente.', 'error'); return;
          }
          const record = { schema: 1, owner, requestId: crypto.randomUUID(), invoiceId: target.id, clientId: Number(target.clientId || target.client?.id),
            amountCents: Math.round(Number(form.amount) * 100), method: form.method, notes: form.notes,
            details: `Fatura #${target.id} · ${String(target.client?.name || 'Cliente').slice(0, 1800)}` };
          try { localStorage.setItem(key, JSON.stringify(record)); }
          catch (_) { throw Error('Não foi possível guardar o pagamento neste navegador. Nenhum pedido foi enviado.'); }
          pending = read();
          if (JSON.stringify(pending) !== JSON.stringify(record)) throw Error('Não foi possível verificar o pedido guardado. Nenhum pedido foi enviado.');
        }
        const record = pending;
        closePaymentModal(true); render(); showStatus('A confirmar pagamento...', 'info');
        try {
          const response = await fetch(`${API}/payments/invoice/${record.invoiceId}`, {
            method: 'POST', headers: { Authorization: invoiceAuthorization, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ requestId: record.requestId, amount: (record.amountCents / 100).toFixed(2), method: record.method, notes: record.notes }),
          });
          const data = await response.json().catch(() => null);
          if (!invoiceSessionCurrent()) return;
          if (!response.ok) {
            if ([400, 404, 409].includes(response.status) && data?.ok === false && typeof data.error === 'string') {
              pending = { ...record, rejection: { status: response.status, message: data.error } };
              localStorage.setItem(key, JSON.stringify(pending));
              showStatus(`${data.error} Use Rever pagamento.`, 'error'); return;
            }
            throw Error('Não foi possível obter a confirmação.');
          }
          if (!validReceipt(data, record)) throw Error('Confirmação inválida.');
          forget(record);
          const refreshed = await loadInvoices();
          if (!invoiceSessionCurrent()) return;
          showStatus(`Pagamento confirmado. Aplicado: ${(data.requestReceipt.appliedCents / 100).toFixed(2)} EUR.${data.requestReceipt.creditCents ? ` Crédito: ${(data.requestReceipt.creditCents / 100).toFixed(2)} EUR.` : ''}${refreshed ? '' : ' Não foi possível atualizar o saldo. Atualize a lista antes de outro pagamento.'}`, refreshed ? 'ok' : 'error');
        } catch (_) {
          if (invoiceSessionCurrent()) showStatus('Ainda não foi possível confirmar o pagamento. O pedido foi guardado; use Confirmar pagamento guardado, mesmo depois de reabrir a página.', 'error');
        }
      });
    } catch (error) { if (invoiceSessionCurrent()) showStatus(error.message, 'error'); }
    finally { working = false; render(); }
  }
  retry.onclick = () => submit(); review.onclick = () => submit(false, true);
  try {
    const payload = JSON.parse(atob(invoiceAuthorization.split(' ')[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    actorId = Number(payload.id);
    if (payload.role !== 'ADMIN' || !positive(actorId)) throw Error('Sessão administrativa por confirmar.');
    owner = `ADMIN:${actorId}`; key = `cwInvoicePayment:v1:${owner}`; pending = read();
  } catch (error) { blocked = true; issue = error.message; }
  window.addEventListener('storage', event => {
    if (!invoiceSessionCurrent()) return;
    if ((event.key === key || event.key === null) && !working) {
      try { pending = read(); if (pending) closePaymentModal(true); } catch (_) {}
      render();
    }
  });
  render();
  return { submit, render, busy: () => working, canStart: () => !blocked && !working && !pending && invoicesFresh && sameSession(), hide: () => { panel.hidden = true; render(); } };
}
