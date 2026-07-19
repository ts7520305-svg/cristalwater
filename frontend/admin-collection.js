const collectionList = document.getElementById("collectionList");
let currentClients = [];
let previewMessageValue = "";
const actionLock = new Set();

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
  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const reference = client.paymentReference || paymentReference(client.id);

  return `Olá ${client.name},

Verificámos que existe um valor em aberto referente ao mês ${month}.

Resumo:
- Referencia fixa do cliente: ${reference}
- Mensalidade: ${formatMoney(client.monthlyFee)}
- Reparações: ${formatMoney(client.repairsTotal)}
- Visitas extra: ${formatMoney(client.extraVisitsTotal)}
- Crédito positivo disponível: ${formatMoney(client.creditBalance)}
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
  const client = currentClients.find((c) => c.id === clientId);
  if (!client) return;

  const number = getWhatsappNumber(client);
  if (!number) {
    alert("Este cliente não tem número configurado.");
    return;
  }

  const url = `https://wa.me/${encodeURIComponent(number.replace("+", ""))}?text=${encodeURIComponent(buildReminderMessage(client))}`;
  window.open(url, "_blank");
}

function openEmail(clientId) {
  const client = currentClients.find((c) => c.id === clientId);
  if (!client) return;

  const email = getEmailAddress(client);
  if (!email) {
    alert("Este cliente não tem email configurado.");
    return;
  }

  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const subject = `Aviso de pagamento - ${month}`;
  const body = buildReminderMessage(client);

  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copyMessage(clientId) {
  const client = currentClients.find((c) => c.id === clientId);
  if (!client) return;

  try {
    await navigator.clipboard.writeText(buildReminderMessage(client));
    alert("Mensagem copiada.");
  } catch {
    alert("Não foi possível copiar a mensagem.");
  }
}

async function markReminded(clientId) {
  if (actionLock.has(`reminded:${clientId}`)) return;
  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  actionLock.add(`reminded:${clientId}`);
  try {
    const res = await fetch(`/api/admin/payments/${clientId}/mark-reminded?month=${encodeURIComponent(month)}`, {
      method: "POST",
      headers: authHeaders(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      alert(data.message || "Erro ao marcar como avisado.");
      return;
    }

    loadCollection();
  } finally {
    actionLock.delete(`reminded:${clientId}`);
  }
}

async function markPaid(clientId) {
  if (actionLock.has(`paid:${clientId}`)) return;
  const ok = confirm("Confirmar marcação de cliente como pago neste mês?");
  if (!ok) return;
  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  actionLock.add(`paid:${clientId}`);
  try {
    const res = await fetch(`/api/admin/payments/${clientId}/mark-paid?month=${encodeURIComponent(month)}`, {
      method: "POST",
      headers: authHeaders(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      alert(data.message || "Erro ao marcar como pago.");
      return;
    }

    loadCollection();
  } finally {
    actionLock.delete(`paid:${clientId}`);
  }
}

async function registerManualPayment(clientId) {
  if (actionLock.has(`manual:${clientId}`)) return;
  const client = currentClients.find((c) => c.id === clientId);
  const reference = client?.paymentReference || paymentReference(clientId);
  const suggested = client?.totalDue > 0 ? client.totalDue.toFixed(2) : "";
  const amountText = prompt(`Valor recebido para ${client?.name || "cliente"} (${reference})`, suggested);
  if (!amountText) return;

  const amount = Number(String(amountText).replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Indica um valor valido.");
    return;
  }

  const method = prompt("Metodo de pagamento (Transferencia, MBWay, Dinheiro, Multibanco...)", "Transferencia") || "Manual";
  const notes = prompt("Nota interna ou referencia do comprovativo", reference) || "";
  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const ok = confirm("Confirmar registo manual do pagamento recebido?");
  if (!ok) return;
  actionLock.add(`manual:${clientId}`);
  try {
    const res = await fetch(`/api/admin/payments/${clientId}/manual-received?month=${encodeURIComponent(month)}`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ amount, method, notes }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      alert(data.message || "Erro ao registar pagamento recebido.");
      return;
    }

    alert(data.message || "Pagamento registado.");
    loadCollection();
  } finally {
    actionLock.delete(`manual:${clientId}`);
  }
}

async function markVisibleAsReminded() {
  const visible = applyFilters(currentClients);

  if (!visible.length) {
    alert("Não há clientes visíveis.");
    return;
  }

  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const ok = confirm(`Marcar ${visible.length} cliente(s) visível(eis) como avisados?`);
  if (!ok) return;

  for (const client of visible) {
    await fetch(`/api/admin/payments/${client.id}/mark-reminded?month=${encodeURIComponent(month)}`, {
      method: "POST",
      headers: authHeaders(),
    });
  }

  loadCollection();
}

async function markVisibleAsPaid() {
  const visible = applyFilters(currentClients);

  if (!visible.length) {
    alert("Não há clientes visíveis.");
    return;
  }

  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();
  const ok = confirm(`Marcar ${visible.length} cliente(s) visível(eis) como pagos?`);
  if (!ok) return;

  for (const client of visible) {
    await fetch(`/api/admin/payments/${client.id}/mark-paid?month=${encodeURIComponent(month)}`, {
      method: "POST",
      headers: authHeaders(),
    });
  }

  loadCollection();
}

async function copyVisibleContacts() {
  const visible = applyFilters(currentClients);

  if (!visible.length) {
    alert("Não há clientes visíveis.");
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
    alert("Contactos visíveis copiados.");
  } catch {
    alert("Não foi possível copiar os contactos.");
  }
}

function openPreview(clientId) {
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
  try {
    await navigator.clipboard.writeText(previewMessageValue || "");
    alert("Texto copiado.");
  } catch {
    alert("Não foi possível copiar o texto.");
  }
}

function renderCollection(clients) {
  collectionList.innerHTML = "";

  if (!clients.length) {
    renderSummary([]);
    collectionList.innerHTML = `<div class="empty-box">Sem clientes para os filtros atuais.</div>`;
    return;
  }

  renderSummary(clients);

  const month = document.getElementById("monthFilter")?.value || getCurrentMonthValue();

  clients.forEach((client) => {
    const reminded = isAlreadyReminded(client, month);

    const card = document.createElement("div");
    card.className = `client-card ${client.paymentStatus === "OVERDUE" ? "overdue" : "pending"} ${client.missingContact ? "missing-contact" : ""}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="block">
          <div class="client-name">${escapeHtml(client.name || "-")}</div>
          <div class="line"><strong>Referencia fixa:</strong> ${escapeHtml(client.paymentReference || paymentReference(client.id))}</div>
          <div class="line"><strong>Total em dívida:</strong> ${formatMoney(client.totalDue)}</div>
          ${client.creditBalance > 0 ? `<div class="line"><strong>Crédito positivo:</strong> ${formatMoney(client.creditBalance)}</div>` : ""}
          <div class="line"><strong>Status:</strong> <span class="${client.paymentStatus === "OVERDUE" ? "strong-red" : "strong-orange"}">${escapeHtml(client.paymentStatus)}</span></div>
          <div class="line"><strong>Dias em atraso:</strong> ${client.daysOverdue || 0}</div>
          <div class="line"><strong>Último pagamento:</strong> ${formatDate(client.lastPaymentAt)}</div>

          <div class="pills">
            <span class="pill ${client.paymentStatus === "OVERDUE" ? "pill-overdue" : "pill-pending"}">${escapeHtml(client.paymentStatus)}</span>
            <span class="pill ${reminded ? "pill-reminded" : "pill-not-reminded"}">${reminded ? "AVISADO" : "POR AVISAR"}</span>
            ${client.missingContact ? `<span class="pill pill-missing">SEM CONTACTO</span>` : ""}
          </div>
        </div>

        <div class="block">
          <div class="detail-title">Resumo cobrança</div>
          <div class="line"><strong>Mensalidade:</strong> ${formatMoney(client.monthlyFee)}</div>
          <div class="line"><strong>Reparações:</strong> ${formatMoney(client.repairsTotal)}</div>
          <div class="line"><strong>Visitas extra:</strong> ${formatMoney(client.extraVisitsTotal)}</div>
          ${client.creditBalance > 0 ? `<div class="line"><strong>Abatido por crédito:</strong> ${formatMoney(Math.min(client.creditBalance, client.totalBeforeCredit || client.totalDue))}</div>` : ""}
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
        <button class="btn btn-primary" onclick="registerManualPayment(${client.id})">Registar recebido</button>
        <button class="btn btn-success" onclick="markPaid(${client.id})">Marcar pago</button>
      </div>
    `;

    collectionList.appendChild(card);
  });
}

async function loadCollection() {
  try {
    const month = document.getElementById("monthFilter")?.value || "";
    const url = month
      ? `/api/admin/payments?month=${encodeURIComponent(month)}`
      : "/api/admin/payments";

    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();

    if (!data.clients || !data.clients.length) {
      currentClients = [];
      renderCollection([]);
      return;
    }

    currentClients = data.clients.map(normalizeClient);
    renderCollection(applyFilters(currentClients));
  } catch (error) {
    console.error(error);
    currentClients = [];
    renderCollection([]);
  }
}

initMonthFilter();

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
