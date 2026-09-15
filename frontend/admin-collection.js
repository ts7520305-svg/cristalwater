const collectionList = document.getElementById("collectionList");
let currentClients = [], collectionFresh = false, collectionLoaded = false, collectionRead = 0, collectionMonth = null, clientReceipt = null;
const collectionAuthorization = authHeaders().Authorization;
let previewMessageValue = "";
const actionLock = new Set();
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
  prompt: async () => null,
  safeError: (err, fallback) => (err && err.message) || fallback,
};

function userError(error, fallback) {
  return ui.safeError(error, fallback || "Nao foi possivel concluir a operacao.");
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function getCurrentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function initMonthFilter() {
  const input = document.getElementById("monthFilter");
  if (input && !input.value) {
    input.value = getCurrentMonthValue();
  }
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2)} €`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-PT");
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-PT");
}

function paymentReference(clientId) {
  return `CW-${String(Number(clientId || 0)).padStart(6, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isAlreadyReminded(client, month) {
  return client.lastReminderMonth === month;
}

function normalizeClient(client) {
  return {
    ...client,
    monthlyFee: Number(client.monthlyFee || 0),
    repairsTotal: Number(client.repairsTotal || 0),
    extraVisitsTotal: Number(client.extraVisitsTotal || 0),
    creditBalance: Number(client.creditBalance || 0),
    totalBeforeCredit: Number(client.totalBeforeCredit || 0),
    totalDue: Number(client.totalDue || 0),
    daysOverdue: Number(client.daysOverdue || 0),
    paymentReference: client.paymentReference || paymentReference(client.id),
  };
}

function buildReminderMessage(client) {
  const reference = client.paymentReference || paymentReference(client.id);

  return `Olá ${client.name},

Verificámos que existe um valor em aberto nas suas faturas emitidas.

Resumo:
- Referencia fixa do cliente: ${reference}
- Crédito disponível por aplicar: ${formatMoney(client.creditBalance)}
- Total em dívida: ${formatMoney(client.totalDue)}

Ao efetuar o pagamento, indique sempre a referencia ${reference}.
Depois de pagar, envie uma mensagem pelo portal Cristal Water ou por WhatsApp com essa referencia.

Se o pagamento ja foi efetuado recentemente, pode ignorar esta mensagem.

Cumprimentos,
Cristal Water`;
}

function getWhatsappNumber(client) {
  return String(client.finalPhone || "").replace(/\s+/g, "");
}

function getEmailAddress(client) {
  return client.finalEmail || "";
}

function comparePriority(a, b) {
  const statusRank = { OVERDUE: 0, PENDING: 1, PAID: 2 };
  const statusDiff = (statusRank[a.paymentStatus] ?? 99) - (statusRank[b.paymentStatus] ?? 99);
  if (statusDiff !== 0) return statusDiff;

  if ((b.daysOverdue || 0) !== (a.daysOverdue || 0)) {
    return (b.daysOverdue || 0) - (a.daysOverdue || 0);
  }

  if ((b.totalDue || 0) !== (a.totalDue || 0)) {
    return (b.totalDue || 0) - (a.totalDue || 0);
  }

  return String(a.name || "").localeCompare(String(b.name || ""), "pt");
}

function applyFilters(clients) {
  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const search = (document.getElementById("searchFilter")?.value || "").trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter")?.value || "ALL";
  const reminderFilter = document.getElementById("reminderFilter")?.value || "ALL";
  const contactFilter = document.getElementById("contactFilter")?.value || "ALL";

  return clients
    .filter((c) => c.paymentStatus === "OVERDUE" || c.paymentStatus === "PENDING")
    .filter((client) => {
      const nameMatch = !search || String(client.name || "").toLowerCase().includes(search);

      let statusMatch = true;
      if (statusFilter === "OVERDUE") statusMatch = client.paymentStatus === "OVERDUE";
      if (statusFilter === "PENDING") statusMatch = client.paymentStatus === "PENDING";

      const reminded = isAlreadyReminded(client, month);
      let reminderMatch = true;
      if (reminderFilter === "TO_REMIND") reminderMatch = !reminded;
      if (reminderFilter === "ALREADY_REMINDED") reminderMatch = reminded;

      let contactMatch = true;
      if (contactFilter === "MISSING_CONTACT") contactMatch = Boolean(client.missingContact);
      if (contactFilter === "HAS_CONTACT") contactMatch = !client.missingContact;

      return nameMatch && statusMatch && reminderMatch && contactMatch;
    })
    .sort(comparePriority);
}

function renderSummary(clients) {
  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();

  const debt = clients.reduce((sum, c) => sum + Number(c.totalDue || 0), 0);
  const credit = clients.reduce((sum, c) => sum + Number(c.creditBalance || 0), 0);
  const overdue = clients.filter((c) => c.paymentStatus === "OVERDUE").length;
  const pending = clients.filter((c) => c.paymentStatus === "PENDING").length;
  const reminded = clients.filter((c) => isAlreadyReminded(c, month)).length;
  const toRemind = clients.filter((c) => !isAlreadyReminded(c, month)).length;
  const missingContact = clients.filter((c) => c.missingContact).length;

  document.getElementById("sumDebt").textContent = formatMoney(debt);
  const creditBox = document.getElementById("sumCredit");
  if (creditBox) creditBox.textContent = formatMoney(credit);
  document.getElementById("sumOverdue").textContent = overdue;
  document.getElementById("sumPending").textContent = pending;
  document.getElementById("sumReminded").textContent = reminded;
  document.getElementById("sumToRemind").textContent = toRemind;
  document.getElementById("sumMissingContact").textContent = missingContact;
}

function openWhatsApp(clientId) {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  const client = currentClients.find((c) => c.id === clientId);
  if (!client) return;

  const number = getWhatsappNumber(client);
  if (!number) {
    ui.error("Este cliente nao tem numero configurado. Proxima acao: atualizar telefone do cliente.");
    return;
  }

  const url = `https://wa.me/${encodeURIComponent(number.replace("+", ""))}?text=${encodeURIComponent(buildReminderMessage(client))}`;
  window.open(url, "_blank");
}

function openEmail(clientId) {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  const client = currentClients.find((c) => c.id === clientId);
  if (!client) return;

  const email = getEmailAddress(client);
  if (!email) {
    ui.error("Este cliente nao tem email configurado. Proxima acao: atualizar email do cliente.");
    return;
  }

  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const subject = `Aviso de pagamento - ${month}`;
  const body = buildReminderMessage(client);

  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copyMessage(clientId) {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  const client = currentClients.find((c) => c.id === clientId);
  if (!client) return;

  try {
    await navigator.clipboard.writeText(buildReminderMessage(client));
    ui.success("Mensagem copiada.");
  } catch {
    ui.error("Nao foi possivel copiar a mensagem.");
  }
}

async function markReminded(clientId) {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  if (actionLock.has(`reminded:${clientId}`)) return;
  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  actionLock.add(`reminded:${clientId}`);
  try {
    const res = await fetch(`/api/admin/payments/${clientId}/mark-reminded?month=${encodeURIComponent(month)}`, {
      method: "POST",
      headers: { Authorization: collectionAuthorization },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      ui.error(userError(data, "Nao foi possivel marcar como avisado."));
      return;
    }

    ui.success("Cliente marcado como avisado.");
    loadCollection();
  } finally {
    actionLock.delete(`reminded:${clientId}`);
  }
}

function registerManualPayment(clientId) { clientReceipt?.open(clientId); }

async function markVisibleAsReminded() {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  const visible = applyFilters(currentClients);

  if (!visible.length) {
    ui.info("Nao ha clientes visiveis com os filtros atuais.");
    return;
  }

  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const ok = await ui.confirm(`Marcar ${visible.length} cliente(s) visivel(eis) como avisados?`, {
    title: "Confirmacao em lote",
    confirmText: "Confirmar",
  });
  if (!ok || !collectionSessionCurrent() || !collectionFresh || month !== selectedCollectionMonth()) return;

  for (const client of visible) {
    if (!collectionSessionCurrent() || month !== selectedCollectionMonth()) return;
    await fetch(`/api/admin/payments/${client.id}/mark-reminded?month=${encodeURIComponent(month)}`, {
      method: "POST",
      headers: { Authorization: collectionAuthorization },
    });
  }

  ui.success("Lote de avisos concluido.");
  loadCollection();
}

async function copyVisibleContacts() {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  const visible = applyFilters(currentClients);

  if (!visible.length) {
    ui.info("Nao ha clientes visiveis com os filtros atuais.");
    return;
  }

  const text = visible.map((client) => {
    return [
      `Cliente: ${client.name}`,
      `Referencia: ${client.paymentReference || paymentReference(client.id)}`,
      `Telefone: ${client.finalPhone || "-"}`,
      `Email: ${client.finalEmail || "-"}`,
      `Estado: ${client.paymentStatus || "-"}`,
      `Total: ${formatMoney(client.totalDue)}`,
      `Dias atraso: ${client.daysOverdue || 0}`,
    ].join(" | ");
  }).join("\n");

  try {
    await navigator.clipboard.writeText(text);
    ui.success("Contactos visiveis copiados.");
  } catch {
    ui.error("Nao foi possivel copiar os contactos.");
  }
}

function openPreview(clientId) {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  const client = currentClients.find((c) => c.id === clientId);
  if (!client) return;

  previewMessageValue = buildReminderMessage(client);
  document.getElementById("previewTitle").textContent = `Pré-visualização - ${client.name}`;
  document.getElementById("previewText").value = previewMessageValue;
  document.getElementById("previewModal").style.display = "flex";
}

function closePreview() {
  document.getElementById("previewModal").style.display = "none";
}

async function copyPreviewMessage() {
  if (!collectionSessionCurrent() || !collectionFresh) return;
  try {
    await navigator.clipboard.writeText(previewMessageValue || "");
    ui.success("Texto copiado.");
  } catch {
    ui.error("Nao foi possivel copiar o texto.");
  }
}

function renderCollection(clients) {
  if (!collectionSessionCurrent()) return;
  if (!collectionLoaded) { unknownCollection('As cobranças ainda não foram consultadas. Use Atualizar.'); clientReceipt?.render(); return; }
  collectionList.innerHTML = "";

  if (!clients.length) {
    renderSummary([]);
    collectionList.innerHTML = `<div class="empty-box">Sem clientes para os filtros atuais. Proxima acao: limpar filtros, ajustar mes ou validar dados de cobranca.</div>`;
    clientReceipt?.render();
    return;
  }

  renderSummary(clients);

  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();

  clients.forEach((client) => {
    const reminded = isAlreadyReminded(client, month);

    const card = document.createElement("div");
    card.dataset.clientId = String(client.id);
    card.className = `client-card ${client.paymentStatus === "OVERDUE" ? "overdue" : "pending"} ${client.missingContact ? "missing-contact" : ""}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="block">
          <div class="client-name">${escapeHtml(client.name || "-")}</div>
          <div class="line"><strong>Referencia fixa:</strong> ${escapeHtml(client.paymentReference || paymentReference(client.id))}</div>
          <div class="line"><strong>Total em dívida:</strong> ${formatMoney(client.totalDue)}</div>
          ${client.creditBalance > 0 ? `<div class="line"><strong>Crédito positivo:</strong> ${formatMoney(client.creditBalance)}</div>` : ""}
          <div class="line"><strong>Estado:</strong> <span class="${client.paymentStatus === "OVERDUE" ? "strong-red" : "strong-orange"}">${client.paymentStatus === "OVERDUE" ? "Em atraso" : "Por pagar"}</span></div>
          <div class="line"><strong>Dias em atraso:</strong> ${client.daysOverdue || 0}</div>
          <div class="line"><strong>Último pagamento:</strong> ${formatDate(client.lastPaymentAt)}</div>

          <div class="pills">
            <span class="pill ${client.paymentStatus === "OVERDUE" ? "pill-overdue" : "pill-pending"}">${client.paymentStatus === "OVERDUE" ? "EM ATRASO" : "POR PAGAR"}</span>
            <span class="pill ${reminded ? "pill-reminded" : "pill-not-reminded"}">${reminded ? "AVISADO" : "POR AVISAR"}</span>
            ${client.missingContact ? `<span class="pill pill-missing">SEM CONTACTO</span>` : ""}
          </div>
        </div>

        <div class="block">
          <div class="detail-title">Informação do mês (não soma da dívida)</div>
          <div class="line"><strong>Mensalidade:</strong> ${formatMoney(client.monthlyFee)}</div>
          <div class="line"><strong>Reparações:</strong> ${formatMoney(client.repairsTotal)}</div>
          <div class="line"><strong>Visitas extra:</strong> ${formatMoney(client.extraVisitsTotal)}</div>
          ${client.creditBalance > 0 ? `<div class="line"><strong>Crédito por aplicar:</strong> ${formatMoney(client.creditBalance)}</div>` : ""}
          <div class="line"><strong>Último aviso:</strong> ${formatDateTime(client.lastReminderAt)}</div>
        </div>

        <div class="block">
          <div class="detail-title">Contactos</div>
          <div class="line"><strong>Telefone:</strong> ${escapeHtml(client.finalPhone || "-")}</div>
          <div class="line"><strong>Email:</strong> ${escapeHtml(client.finalEmail || "-")}</div>
          <div class="line"><strong>Contacto em falta:</strong> ${client.missingContact ? "Sim" : "Não"}</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-whatsapp" onclick="openWhatsApp(${client.id})">WhatsApp</button>
        <button class="btn btn-email" onclick="openEmail(${client.id})">Email</button>
        <button class="btn btn-copy" onclick="copyMessage(${client.id})">Copiar mensagem</button>
        <button class="btn btn-preview" onclick="openPreview(${client.id})">Pré-visualizar</button>
        <button class="btn btn-muted" onclick="markReminded(${client.id})">Marcar avisado</button>
        <button class="btn btn-primary" data-client-receipt onclick="registerManualPayment(${client.id})">Registar recebido</button>
      </div>
    `;

    collectionList.appendChild(card);
  });
  clientReceipt?.render();
}

function selectedCollectionMonth() { return document.getElementById('monthFilter').value || getCurrentMonthValue(); }
function collectionStatus(message, error = false) {
  const box = document.getElementById('collectionStatus'); box.textContent = message; box.dataset.error = String(error);
}
function unknownCollection(message) {
  for (const id of ['sumDebt', 'sumOverdue', 'sumPending', 'sumReminded', 'sumToRemind', 'sumMissingContact']) document.getElementById(id).textContent = '—';
  collectionList.textContent = message;
}
function collectionSessionCurrent() {
  if (authHeaders().Authorization === collectionAuthorization) return true;
  collectionRead++; currentClients = []; collectionFresh = false; collectionLoaded = false;
  closePreview(); previewMessageValue = ''; document.getElementById('previewText').value = '';
  document.getElementById('previewTitle').textContent = 'Pré-visualização';
  clientReceipt?.close(true); clientReceipt?.render(); unknownCollection('A sessão mudou. Reabra esta página.');
  collectionStatus('A sessão mudou. Reabra esta página para consultar as cobranças.', true); return false;
}
window.addEventListener('storage', event => { if (['token', 'cristalwater_jwt', null].includes(event.key)) collectionSessionCurrent(); });

async function loadCollection() {
  if (!collectionSessionCurrent()) return false;
  const month = selectedCollectionMonth(), own = ++collectionRead;
  const current = () => own === collectionRead && month === selectedCollectionMonth() && collectionSessionCurrent();
  collectionFresh = false; clientReceipt?.render();
  collectionStatus('A consultar cobranças...');
  if (!collectionLoaded) unknownCollection('A consultar cobranças...');
  try {
    const res = await fetch(`/api/admin/payments?month=${encodeURIComponent(month)}`, { headers: { Authorization: collectionAuthorization }, cache: 'no-store' });
    const data = await res.json();
    if (!current()) return false;
    if (!res.ok || data.month !== month || !Array.isArray(data.clients) || data.clients.some(row => !row || !Number.isSafeInteger(row.id) || row.id <= 0 ||
      typeof row.name !== 'string' || !['PAID', 'PENDING', 'OVERDUE'].includes(row.paymentStatus) || !Number.isFinite(row.totalDue) || row.totalDue < 0 ||
      !Number.isFinite(row.creditBalance) || row.creditBalance < 0 || !Number.isSafeInteger(row.openInvoicesCount) || row.openInvoicesCount < 0)) throw Error('Resposta de cobranças inválida.');
    currentClients = data.clients.map(normalizeClient); collectionLoaded = true; collectionFresh = true; collectionMonth = month;
    renderCollection(applyFilters(currentClients));
    collectionStatus('Dívida atual de todas as faturas emitidas. O mês seleciona a informação de serviços e avisos.');
    return true;
  } catch (_) {
    if (!current()) return false;
    collectionFresh = false;
    if (!collectionLoaded) unknownCollection('Não foi possível consultar as cobranças. Use Atualizar.');
    collectionStatus(`Não foi possível atualizar as cobranças.${collectionLoaded ? ` Mantida a última consulta (${collectionMonth}).` : ''} Atualize antes de registar um recebimento.`, true);
    clientReceipt?.render(); return false;
  }
}

initMonthFilter();
clientReceipt = setupClientReceipt();
window.addEventListener('load', () => {
  const topbar = document.querySelector('.cw-v2-shell-topbar');
  if (topbar && window.ResizeObserver) new ResizeObserver(() => document.body.style.setProperty('--collection-header-height', `${topbar.getBoundingClientRect().height}px`)).observe(topbar);
});

document.getElementById("searchFilter").addEventListener("input", () => {
  renderCollection(applyFilters(currentClients));
});

document.getElementById("statusFilter").addEventListener("change", () => {
  renderCollection(applyFilters(currentClients));
});

document.getElementById("reminderFilter").addEventListener("change", () => {
  renderCollection(applyFilters(currentClients));
});

document.getElementById("contactFilter").addEventListener("change", () => {
  renderCollection(applyFilters(currentClients));
});

document.getElementById("monthFilter").addEventListener("change", () => {
  loadCollection();
});

document.getElementById("previewModal").addEventListener("click", (e) => {
  if (e.target.id === "previewModal") closePreview();
});

loadCollection();
