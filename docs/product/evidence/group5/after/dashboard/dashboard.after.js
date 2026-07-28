const API = "/api";

// ======================================================
// INIT
// ======================================================

window.addEventListener("DOMContentLoaded", () => {
  const monthInput = document.getElementById("monthRef");

  if (monthInput) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  loadDashboard();
});

// ======================================================
// HELPERS
// ======================================================

function formatMoney(v) {
  return `${Number(v || 0).toFixed(2)} €`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "-";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function getMonthRef() {
  return document.getElementById("monthRef")?.value || "";
}

function getHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("cwAdminToken") || "";
  const headers = {
    "Content-Type": "application/json"
  };
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

function renderSimpleSeries(containerId, rows, valueKey, suffix = "") {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!Array.isArray(rows) || !rows.length) {
    container.innerHTML = "<div class='empty'>Sem dados</div>";
    return;
  }
  container.innerHTML = rows.map((row) => `
    <div class="small-card">
      <b>${esc(row.month || row.label || "-")}</b><br>
      ${esc(row[valueKey] ?? 0)}${suffix}
    </div>
  `).join("");
}

function setError(message) {
  setText("dashboardStatus", message || "Erro");
  const targets = ["topDebtorsTable", "latestPayments", "poolsByZone", "alertsList", "monthlyEvolution", "financialDistribution"];
  targets.forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.innerHTML) el.innerHTML = `<div class='empty'>${esc(message || "Erro ao carregar")}</div>`;
  });
}

function renderFinancialDistribution(summary = {}) {
  const container = document.getElementById("financialDistribution");
  if (!container) return;
  const total = Number(summary.monthBilled || 0);
  const paid = Number(summary.monthPaid || 0);
  const open = Number(summary.monthOpen || 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  container.innerHTML = `
    <div class="small-card"><b>Recebido</b><br>${formatMoney(paid)} (${pct}%)</div>
    <div class="small-card"><b>Em aberto</b><br>${formatMoney(open)}</div>
    <div class="small-card"><b>Faturado</b><br>${formatMoney(total)}</div>
  `;
}

function loadDashboard() {
  return loadDashboardImpl();
}

// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboardImpl() {
  try {

    setText("dashboardStatus", "A carregar...");

    const monthRef = getMonthRef();

    const res = await fetch(`${API}/dashboard/admin?monthRef=${monthRef}`, {
      headers: getHeaders()
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      const msg = data.error || data.message || "Erro ao carregar dashboard";
      setError(msg);
      return;
    }

    const s = data.summary || {};
    const safe = {
      totalClients: Number(s.totalClients ?? 0),
      clientsRequiresInvoice: Number(s.clientsRequiresInvoice ?? 0),
      clientsWithCredit: Number(s.clientsWithCredit ?? 0),
      totalPools: Number(s.totalPools ?? 0),
      monthlyPotential: Number(s.monthlyPotential ?? 0),
      monthBilled: Number(s.monthBilled ?? 0),
      monthPaid: Number(s.monthPaid ?? 0),
      monthOpen: Number(s.monthOpen ?? 0),
      receivedPercent: Number(s.receivedPercent ?? 0),
      totalCreditBalance: Number(s.totalCreditBalance ?? 0),
      openAlerts: Number(s.openAlerts ?? 0),
      visitsThisMonth: Number(s.visitsThisMonth ?? 0),
      visitsDoneThisMonth: Number(s.visitsDoneThisMonth ?? 0),
      visitsPlannedThisMonth: Number(s.visitsPlannedThisMonth ?? 0),
    };

    // =========================
    // KPIs
    // =========================

    setText("totalClients", safe.totalClients);
    setText("clientsSub", `${safe.clientsRequiresInvoice} com fatura · ${safe.clientsWithCredit} com crédito`);

    setText("totalPools", safe.totalPools);
    setText("monthlyPotential", `Potencial: ${formatMoney(safe.monthlyPotential)}`);

    setText("monthBilled", formatMoney(safe.monthBilled));
    setText("monthPaid", formatMoney(safe.monthPaid));
    setText("monthOpen", formatMoney(safe.monthOpen));
    setText("receivedPercent", `${safe.receivedPercent}%`);

    setText("creditBalance", formatMoney(safe.totalCreditBalance));
    setText("clientsWithCredit", `${safe.clientsWithCredit} clientes`);

    setText("openAlerts", safe.openAlerts);

    setText("visitsThisMonth", safe.visitsThisMonth);
    setText("visitsSub",
      `${safe.visitsDoneThisMonth} feitas · ${safe.visitsPlannedThisMonth} planeadas`
    );

    // =========================
    // COMPONENTES
    // =========================

    renderCharts(data);
    renderTopDebtors(data.topDebtors || []);
    renderPayments(data.latestPayments || []);
    renderZones(data.poolsByZone || []);
    renderAlerts(data.alerts || []);

    setText("dashboardStatus", `Atualizado · ${data.monthRef}`);

  } catch (err) {
    console.error(err);
    setError("Erro de ligação ao servidor");
  }
}

// ======================================================
// GRÁFICOS
// ======================================================

function renderCharts(data) {

  const evolution = data.monthlyEvolution || [];
  renderSimpleSeries("monthlyEvolution", evolution, "billed", " EUR");
  renderFinancialDistribution(data.summary || {});
}

// ======================================================
// DEVEDORES
// ======================================================

function renderTopDebtors(rows = []) {

  const container = document.getElementById("topDebtorsTable");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = "<div class='empty'>Sem devedores</div>";
    return;
  }

  let html = `
    <table class="table">
      <tr>
        <th>Cliente</th>
        <th>Dívida</th>
        <th>Ação</th>
      </tr>
  `;

  rows.forEach(r => {
    html += `
      <tr>
        <td>${esc(r.clientName)}</td>
        <td>${formatMoney(r.amountOpen)}</td>
        <td>
          <button onclick="openClient(${r.clientId})">Cliente</button>
          <button onclick="openBilling()">Cobrança</button>
        </td>
      </tr>
    `;
  });

  html += "</table>";

  container.innerHTML = html;
}

// ======================================================
// PAGAMENTOS
// ======================================================

function renderPayments(rows = []) {

  const container = document.getElementById("latestPayments");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = "<div class='empty'>Sem pagamentos</div>";
    return;
  }

  let html = "";

  rows.forEach(p => {
    html += `
      <div class="small-card">
        <b>${esc(p.clientName)}</b><br>
        ${formatMoney(p.amount)} - ${esc(p.method)}<br>
        <small>${new Date(p.paidAt).toLocaleString()}</small>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ======================================================
// ZONAS
// ======================================================

function renderZones(rows = []) {

  const container = document.getElementById("poolsByZone");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = "<div class='empty'>Sem zonas</div>";
    return;
  }

  let html = "";

  rows.forEach(z => {
    html += `
      <div class="small-card">
        <b>${esc(z.zone)}</b><br>
        ${z.count} piscinas · ${formatMoney(z.monthlyAmount)}
      </div>
    `;
  });

  container.innerHTML = html;
}

// ======================================================
// ALERTAS
// ======================================================

function renderAlerts(rows = []) {

  const container = document.getElementById("alertsList");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = "<div class='empty'>Sem alertas</div>";
    return;
  }

  let html = "";

  rows.forEach(a => {
    html += `
      <div class="small-card" onclick="openClient(${a.clientId})" style="cursor:pointer;">
        <b>${esc(a.type)}</b><br>
        ${esc(a.message)}<br>
        <small>${esc(a.clientName)}</small>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ======================================================
// AÇÕES
// ======================================================

function openBilling() {
  window.location.href = "/billing";
}

function openClient(id) {
  window.location.href = `/admin-clients?clientId=${id}`;
}