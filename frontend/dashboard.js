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

function getMonthRef() {
  return document.getElementById("monthRef")?.value || "";
}

// 🔥 NOVO — TOKEN
function getHeaders() {
  return {
    "Authorization": "Bearer " + localStorage.token,
    "Content-Type": "application/json"
  };
}

// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboard() {
  try {

    setText("dashboardStatus", "A carregar...");

    const monthRef = getMonthRef();

    const res = await fetch(`${API}/dashboard/admin?monthRef=${monthRef}`, {
      headers: getHeaders()
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert("Erro ao carregar dashboard");
      return;
    }

    const s = data.summary || {};

    // =========================
    // KPIs
    // =========================

    setText("totalClients", s.totalClients);
    setText("clientsSub", `${s.clientsRequiresInvoice} com fatura · ${s.clientsWithCredit} com crédito`);

    setText("totalPools", s.totalPools);
    setText("monthlyPotential", `Potencial: ${formatMoney(s.monthlyPotential)}`);

    setText("monthBilled", formatMoney(s.monthBilled));
    setText("monthPaid", formatMoney(s.monthPaid));
    setText("monthOpen", formatMoney(s.monthOpen));
    setText("receivedPercent", `${s.receivedPercent}%`);

    setText("creditBalance", formatMoney(s.totalCreditBalance));
    setText("clientsWithCredit", `${s.clientsWithCredit} clientes`);

    setText("openAlerts", s.openAlerts);

    setText("visitsThisMonth", s.visitsThisMonth);
    setText("visitsSub",
      `${s.visitsDoneThisMonth} feitas · ${s.visitsPlannedThisMonth} planeadas`
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
    alert("Erro ligação ao servidor");
  }
}

// ======================================================
// GRÁFICOS
// ======================================================

function renderCharts(data) {

  const evolution = data.monthlyEvolution || [];

  const labels = evolution.map(e => e.month);
  const billed = evolution.map(e => e.billed);
  const paid = evolution.map(e => e.paid);

  const ctx1 = document.getElementById("monthlyChart");
  const ctx2 = document.getElementById("summaryChart");

  if (!ctx1 || !ctx2) return;

  new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Faturado",
          data: billed,
          borderColor: "#1e88e5",
          tension: 0.3
        },
        {
          label: "Recebido",
          data: paid,
          borderColor: "#16a34a",
          tension: 0.3
        }
      ]
    }
  });

  new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: ["Recebido", "Em aberto"],
      datasets: [{
        data: [
          data.summary.monthPaid,
          data.summary.monthOpen
        ]
      }]
    }
  });
}

// ======================================================
// DEVEDORES
// ======================================================

function renderTopDebtors(rows = []) {

  const container = document.getElementById("topDebtorsTable");

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
        <td>${r.clientName}</td>
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

  if (!rows.length) {
    container.innerHTML = "<div class='empty'>Sem pagamentos</div>";
    return;
  }

  let html = "";

  rows.forEach(p => {
    html += `
      <div class="small-card">
        <b>${p.clientName}</b><br>
        ${formatMoney(p.amount)} - ${p.method}<br>
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

  if (!rows.length) {
    container.innerHTML = "<div class='empty'>Sem zonas</div>";
    return;
  }

  let html = "";

  rows.forEach(z => {
    html += `
      <div class="small-card">
        <b>${z.zone}</b><br>
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

  if (!rows.length) {
    container.innerHTML = "<div class='empty'>Sem alertas</div>";
    return;
  }

  let html = "";

  rows.forEach(a => {
    html += `
      <div class="small-card" onclick="openClient(${a.clientId})" style="cursor:pointer;">
        <b>${a.type}</b><br>
        ${a.message}<br>
        <small>${a.clientName}</small>
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
  window.location.href = `/frontend/client.html?id=${id}`;
}