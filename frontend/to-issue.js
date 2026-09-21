const API = "/api";
const actionLock = new Set();
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
  prompt: async () => null,
  safeError: (err, fallback) => (err && err.message) || fallback,
};

const state = {
  clients: [],
  summary: {},
  revision: 0,
  requests: new Set(),
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
  node.style.color = tone === "error" ? "#9d2424" : tone === "ok" ? "#126544" : "";
}

function metric(label, value, tone = "") {
  return `<div class="metric ${esc(tone)}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
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
  return Math.max(...[invoice.totalAmount, invoice.total, invoice.amount].map(value => Number(value) || 0));
}

function invoiceLabel(invoice) {
  return invoice.monthRef || invoice.month || `Fatura #${invoice.id}`;
}

function renderPendingInvoice(invoice) {
  const lines = invoice.lines || [];
  return `<form class="invoice-row external-form" data-invoice-id="${invoice.id}" data-cw-no-i18n="true">
    <div class="invoice-main">
      <b>#${invoice.id} — ${esc(invoiceLabel(invoice))}</b>
      <span>${esc(invoice.status)} · total do documento ${money(invoiceTotal(invoice))} · aberto ${money(invoice.amountOpen)}</span>
      ${invoice.externalRegistrationStatus === 'NUMBER_MISSING' ? '<p class="external-warning">Este documento está marcado como emitido, mas falta o número externo. Confirme o histórico.</p>' : ''}
      <fieldset>
        <legend>Serviços e ajustes abrangidos</legend>
        <p>Confirme todas as linhas deste documento. A associação é feita ao documento completo.</p>
        ${lines.length ? lines.map(line => `<label class="external-check"><input type="checkbox" data-line-id="${line.id}"><span>${esc(line.description)}<small>${esc(line.quantity)} × ${money(line.unitPrice)} · total ${money(line.total || line.lineTotal)}${line.serviceDate ? ' · ' + esc(fmtDate(line.serviceDate)) : ''}</small></span></label>`).join('') : '<label class="external-check"><input type="checkbox" data-whole-document><span>Conferi o documento completo, que não tem linhas discriminadas.</span></label>'}
        <label class="external-number">Número da fatura emitida no programa externo<input name="externalInvoiceNo" maxlength="200" autocomplete="off" required aria-label="Número da fatura externa"></label>
        <div class="invoice-actions"><button type="button" data-pdf-id="${invoice.id}">PDF interno</button><button class="ok" type="submit" disabled>Guardar associação</button></div>
      </fieldset>
      <p class="external-result" role="status" aria-live="polite"></p>
    </div>
  </form>`;
}

function renderIssuedInvoice(invoice) {
  const snapshot = invoice.externalRegistration?.snapshot;
  return `
    <div class="invoice-row issued">
      <div class="invoice-main">
        <b>#${esc(invoice.id)} - ${esc(invoice.externalInvoiceNo || "Sem numero externo")}</b>
        <span>${esc(invoiceLabel(invoice))} · ${money(invoiceTotal(invoice))}${invoice.externalRegisteredAt ? ' · associado em ' + esc(fmtDate(invoice.externalRegisteredAt)) : ''}</span>
        ${snapshot ? `<details><summary>Serviços associados no registo</summary>${snapshot.lines.map(line => `<p>${esc(line.description)} · ${money(line.total || line.lineTotal)}</p>`).join('') || '<p>Documento sem linhas discriminadas.</p>'}<p>Total interno na associação: ${money(invoiceTotal(snapshot))}</p></details>` : '<span>Registo histórico sem checklist guardada.</span>'}
      </div>
      <div class="invoice-actions">
        <button type="button" data-pdf-id="${Number(invoice.id)}">PDF interno</button>
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
          ${pending.length ? pending.map(renderPendingInvoice).join("") : '<div class="empty">Sem faturas oficiais pendentes.</div>'}
          ${issued.length ? `<details><summary>Histórico de números externos (${issued.length})</summary>${issued.map(renderIssuedInvoice).join("")}</details>` : ""}
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

function token() { return localStorage.getItem('token') || localStorage.getItem('cristalwater_jwt') || ''; }
function sessionValid(value = token()) {
  if (!value) return false;
  try { const claims = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return claims.role === 'ADMIN' && (claims.exp === undefined || claims.exp * 1000 > Date.now()); } catch { return false; }
}
function invalidate() {
  state.revision++;
  for (const request of state.requests) request.abort();
  state.requests.clear();
}
function context() { return { revision: state.revision, token: token() }; }
function current(saved) { return saved.revision === state.revision && saved.token === token() && sessionValid(saved.token); }
async function request(path, saved, body) {
  if (!current(saved)) throw Error('A sessão ou seleção mudou. Atualize a lista.');
  const controller = new AbortController(); state.requests.add(controller);
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API + path, { method: body ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
      headers: { Authorization: 'Bearer ' + saved.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!current(saved)) throw Error('A sessão ou seleção mudou. Atualize a lista.');
    if (response.status !== 200 || data.ok !== true) throw Error(data.error || (response.status === 401 ? 'Sessão expirada. Entre novamente.' : 'Não foi possível concluir o pedido.'));
    return data;
  } finally { clearTimeout(timer); state.requests.delete(controller); }
}
function validList(data) {
  if (!Array.isArray(data.clients) || !data.summary || typeof data.summary !== 'object') return false;
  const ids = new Set(), clients = new Set();
  const validId = id => Number.isInteger(id) && id > 0 && id <= 2147483647;
  return data.clients.every(client => {
    if (!validId(client?.id) || clients.has(client.id) || !Array.isArray(client.pendingInvoices) || !Array.isArray(client.issuedInvoices)) return false;
    clients.add(client.id);
    return [...client.pendingInvoices, ...client.issuedInvoices].every(invoice => {
      if (!validId(invoice?.id) || ids.has(invoice.id) || invoice.clientId !== client.id || !Array.isArray(invoice.lines) || !/^[a-f0-9]{64}$/.test(invoice.externalReviewToken || '')) return false;
      ids.add(invoice.id);
      return invoice.lines.every(line => validId(line?.id)) && new Set(invoice.lines.map(line => line.id)).size === invoice.lines.length;
    }) && client.pendingInvoices.every(invoice => invoice.externalRegistrationAllowed === true && !invoice.externalInvoiceNo?.trim())
      && client.issuedInvoices.every(invoice => typeof invoice.externalInvoiceNo === 'string' && invoice.externalInvoiceNo.trim());
  });
}
async function load(savedMessage = '') {
  invalidate();
  const saved = context(), query = el('search')?.value?.trim() || '', filter = el('statusFilter')?.value || 'pending';
  state.clients = []; state.summary = {}; renderMetrics({}); el('list').textContent = 'A carregar…';
  status('A carregar faturação externa…');
  try {
    const data = await request(`/invoices/to-issue?status=${encodeURIComponent(filter)}&q=${encodeURIComponent(query)}`, saved);
    if (!validList(data)) throw Error('A lista recebida está incompleta. Atualize antes de associar documentos.');
    if (!current(saved)) return;
    state.clients = data.clients; state.summary = data.summary; render();
    status(`${typeof savedMessage === 'string' ? savedMessage : ''} ${state.clients.length} cliente(s) visíveis.`, 'ok');
  } catch (error) {
    if (saved.revision !== state.revision) return;
    const message = !sessionValid() || saved.token !== token() ? 'A sessão mudou ou expirou. Entre novamente e atualize a lista.' : error.message;
    el('list').textContent = message; status(message, 'error');
  }
}
function openPdf(id) { window.open(`/invoice-document?id=${Number(id)}`, '_blank', 'noopener'); }
function formReady(form) {
  const checks = [...form.querySelectorAll('input[type="checkbox"]')], number = form.elements.externalInvoiceNo.value.trim();
  return checks.length > 0 && checks.every(input => input.checked) && number.length > 0 && number.length <= 200 && !/[\u0000-\u001f\u007f]/.test(number);
}
async function markIssued(id) {
  const form = el('list').querySelector(`form[data-invoice-id="${Number(id)}"]`);
  const client = state.clients.find(row => row.pendingInvoices.some(invoice => invoice.id === Number(id)));
  const invoice = client?.pendingInvoices.find(row => row.id === Number(id));
  if (!form || !invoice || actionLock.has(id) || !formReady(form)) return;
  const saved = context(), number = form.elements.externalInvoiceNo.value.trim(), fieldset = form.querySelector('fieldset'), result = form.querySelector('.external-result');
  actionLock.add(id); fieldset.disabled = true; result.textContent = '';
  try {
    if (!current(saved)) throw Error('Sessão expirada. Entre novamente e atualize a lista.');
    const allow = await ui.confirm('Confirma que esta fatura já foi emitida no programa externo e abrange todos os serviços e ajustes deste documento?', {
      title: 'Confirmar associação à fatura externa', confirmText: 'Guardar número confirmado',
      details: `${client.name}\nDocumento interno #${id} · ${money(invoiceTotal(invoice))}\nFatura externa: ${number}\n${invoice.lines.length} linha(s) conferida(s).`,
    });
    if (!allow) return;
    if (!current(saved)) throw Error('A sessão ou seleção mudou. Atualize e confirme novamente.');
    result.textContent = 'A guardar associação…';
    const data = await request(`/invoices/${id}/mark-issued`, saved, { externalInvoiceNo: number, expectedClientId: client.id,
      externalReviewToken: invoice.externalReviewToken, reviewedLineIds: invoice.lines.map(line => line.id) });
    if (data.invoice?.id !== invoice.id || data.invoice.clientId !== client.id || data.invoice.externalInvoiceNo !== number || data.invoice.invoiceIssued !== true) throw Error('A confirmação recebida não corresponde ao documento.');
    if (current(saved)) await load(`Número ${number} associado ao documento #${id}.`);
  } catch (error) {
    if (form.isConnected) {
      result.textContent = `${error.message || 'Falha de ligação.'} Consulte o histórico ou repita com o mesmo número; um registo concluído não será duplicado.`;
      status(result.textContent, 'error');
    }
  } finally { actionLock.delete(id); if (form.isConnected) { fieldset.disabled = false; form.querySelector('[type="submit"]').disabled = !formReady(form); } }
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
  el("refreshBtn")?.addEventListener("click", () => load());
  el('search')?.addEventListener('input', invalidate);
  el('list').addEventListener('input', event => {
    const form = event.target.closest('form[data-invoice-id]');
    if (form) form.querySelector('[type="submit"]').disabled = !formReady(form);
  });
  el('list').addEventListener('submit', event => { event.preventDefault(); const id = Number(event.target.dataset.invoiceId); if (id) markIssued(id); });
  el('list').addEventListener('click', event => { const button = event.target.closest('[data-pdf-id]'); if (button) openPdf(button.dataset.pdfId); });
  window.addEventListener('storage', event => { if (!event.key || ['token', 'cristalwater_jwt', 'user', 'cristalwater_user'].includes(event.key)) { invalidate(); state.clients = []; state.summary = {}; render(); status('A sessão mudou. Atualize a lista.', 'error'); } });
  window.addEventListener('pagehide', invalidate);
  window.addEventListener('pageshow', event => { if (event.persisted) load(); });
  el("searchBtn")?.addEventListener("click", () => load());
  el("search")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") load();
  });
  el("statusFilter")?.addEventListener("change", () => load());
  load();
});

window.load = load;
window.openPdf = openPdf;
window.markIssued = markIssued;
