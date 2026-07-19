const API = "/api";
const actionLock = new Set();

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ==========================================================
// HELPERS
// ==========================================================

function formatMoney(value) {
  return `€ ${Number(value || 0).toFixed(2)}`;
}

function getCurrentMonthRef() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function setStatus(message) {
  const el = document.getElementById("status");
  if (el) el.textContent = message;
}

function getStatusBadge(status) {
  const s = String(status || "").toUpperCase();

  if (s === "PAID") return `<span class="badge paid">PAID</span>`;
  if (s === "PARTIAL") return `<span class="badge partial">PARTIAL</span>`;
  return `<span class="badge pending">PENDING</span>`;
}

// ==========================================================
// LOAD PRINCIPAL
// ==========================================================

async function loadBilling() {

  const monthInput = document.getElementById("monthRef");
  const monthRef = monthInput?.value || getCurrentMonthRef();

  const billingList = document.getElementById("billingList");
  billingList.innerHTML = "";

  setStatus("A carregar...");

  try {
    const res = await fetch(`${API}/billing/monthly?monthRef=${monthRef}`, { headers: authHeaders() });
    const data = await res.json();

    const items = data.items || [];

    // =============================
    // RESUMO
    // =============================

    document.getElementById("totalClients").innerText = data.totals.totalClients;
    document.getElementById("totalPools").innerText = data.totals.totalPools;
    document.getElementById("totalAmount").innerText = formatMoney(data.totals.totalAmount);
    document.getElementById("totalPaid").innerText = formatMoney(data.totals.totalPaid);
    document.getElementById("totalOpen").innerText = formatMoney(data.totals.totalOpen);

    const percent = data.totals.totalAmount > 0
      ? Math.round((data.totals.totalPaid / data.totals.totalAmount) * 100)
      : 0;

    document.getElementById("paidPercent").innerText = percent + "%";

    // =============================
    // LISTA
    // =============================

    if (!items.length) {
      billingList.innerHTML = "<div class='card'>Sem dados</div>";
      setStatus("Sem dados");
      return;
    }

    items.forEach(item => {

      const div = document.createElement("div");
      div.className = "card";

      let linesHtml = "";
      let expanded = false;

      if (item.lines && item.lines.length > 0) {
        item.lines.forEach(l => {
          linesHtml += `
            <tr>
              <td>${l.type}</td>
              <td>${l.description}</td>
              <td>${formatMoney(l.total)}</td>
            </tr>
          `;
        });
      }

      div.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <strong>${item.clientName}</strong>
          ${getStatusBadge(item.status)}
        </div>

        <div>
          Crédito: <b>${formatMoney(item.creditBalance || 0)}</b>
        </div>

        <div>
          Total: ${formatMoney(item.total)} |
          Pago: ${formatMoney(item.amountPaid)} |
          Aberto: ${formatMoney(item.amountOpen)}
        </div>

        <div class="actions" style="margin-top:10px;">
          <button class="btn-blue" onclick="addPayment(${item.invoiceId})">Pagamento</button>
          <button class="btn-green" onclick="markPaid(${item.invoiceId})">Marcar pago</button>
          <button class="btn-grey" onclick="addCredit(${item.clientId})">+ Crédito</button>
        </div>

        <button style="margin-top:10px;" onclick="toggleLines(this)">
          Ver linhas
        </button>

        <div class="lines" style="display:none;">
          <table>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Valor</th>
            </tr>
            ${linesHtml}
          </table>
        </div>
      `;

      billingList.appendChild(div);
    });

    setStatus("Atualizado");

  } catch (err) {
    console.error(err);
    setStatus("Erro");
  }
}

// ==========================================================
// AÇÕES
// ==========================================================

async function addCredit(clientId) {
  if (actionLock.has(`credit:${clientId}`)) return;
  const amount = prompt("Valor do crédito (€)");
  if (!amount) return;
  const ok = confirm("Confirmar registo de crédito manual?");
  if (!ok) return;

  actionLock.add(`credit:${clientId}`);
  try {
    await fetch(`${API}/billing/client/${clientId}/credit`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ amount: Number(amount) })
    });
  } finally {
    actionLock.delete(`credit:${clientId}`);
  }

  loadBilling();
}

async function addPayment(invoiceId) {
  if (actionLock.has(`payment:${invoiceId}`)) return;
  const amount = prompt("Valor pago?");
  if (!amount) return;
  const ok = confirm("Confirmar registo de pagamento manual?");
  if (!ok) return;

  actionLock.add(`payment:${invoiceId}`);
  try {
    await fetch(`${API}/billing/invoice/${invoiceId}/payment`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        amount: Number(amount),
        method: "TRANSFER",
        notes: ""
      })
    });
  } finally {
    actionLock.delete(`payment:${invoiceId}`);
  }

  loadBilling();
}

async function markPaid(invoiceId) {
  if (actionLock.has(`paid:${invoiceId}`)) return;
  const ok = confirm("Confirmar alteração de estado para PAID?");
  if (!ok) return;
  actionLock.add(`paid:${invoiceId}`);
  try {
    await fetch(`${API}/billing/invoice/${invoiceId}/status`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status: "PAID" })
    });
  } finally {
    actionLock.delete(`paid:${invoiceId}`);
  }

  loadBilling();
}

function generateMonthly() {
  setStatus("Geração mensal bloqueada nesta fase para evitar escrita em dados reais.");
}

// ==========================================================
// UX
// ==========================================================

function toggleLines(btn) {
  const lines = btn.parentElement.querySelector(".lines");

  if (lines.style.display === "none") {
    lines.style.display = "block";
    btn.innerText = "Esconder linhas";
  } else {
    lines.style.display = "none";
    btn.innerText = "Ver linhas";
  }
}

// ==========================================================
// INIT
// ==========================================================

window.addEventListener("DOMContentLoaded", () => {
  const monthInput = document.getElementById("monthRef");
  if (monthInput) {
    monthInput.value = getCurrentMonthRef();
  }

  loadBilling();
});