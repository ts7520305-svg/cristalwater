const API = "/api";

window.onload = () => {
  document.getElementById("search").addEventListener("input", renderTable);
  document.getElementById("statusFilter").addEventListener("change", renderTable);
  loadBillingCenter();
};

let billingData = [];
let allRows = [];

async function loadBillingCenter() {
  try {
    const res = await fetch(`${API}/billing`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Erro ao carregar centro de cobranças");
      return;
    }

    allRows = data.rows || [];
    billingData = data.debtors || [];

    document.getElementById("sumDebtors").innerText = data.totals?.debtors ?? 0;
    document.getElementById("sumOpen").innerText = `${Number(data.totals?.totalOpen || 0).toFixed(2)} €`;

    const invoicesCount = billingData.reduce((sum, row) => sum + Number(row.overdueInvoices || 0), 0);
    document.getElementById("sumInvoices").innerText = invoicesCount;

    renderTable();
  } catch (err) {
    console.error(err);
    alert("Erro de ligação");
  }
}

function renderTable() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;
  const tableBox = document.getElementById("tableBox");

  const rows = billingData.filter((row) => {
    const hay = `${row.clientName} ${row.zone} ${row.phone} ${row.email}`.toLowerCase();
    const matchText = hay.includes(q);
    const matchStatus = !statusFilter || row.status === statusFilter;
    return matchText && matchStatus;
  });

  if (!rows.length) {
    tableBox.innerHTML = `<div class="empty">Sem resultados.</div>`;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Zona</th>
          <th>Estado</th>
          <th>Faturas abertas</th>
          <th>Total em dívida</th>
          <th>Telefone</th>
          <th>Último lembrete</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const row of rows) {
    const statusClass = row.status === "PAUSED" ? "s-paused" : "s-active";

    html += `
      <tr>
        <td>
          <b>${escapeHtml(row.clientName)}</b>
          <div class="small">ID cliente: ${row.clientId}</div>
        </td>
        <td>${escapeHtml(row.zone || "-")}</td>
        <td><span class="status-pill ${statusClass}">${escapeHtml(row.status || "-")}</span></td>
        <td>${row.overdueInvoices}</td>
        <td><b>${Number(row.totalOpen || 0).toFixed(2)} €</b></td>
        <td>${escapeHtml(row.phone || "-")}</td>
        <td>${row.lastReminderAt ? new Date(row.lastReminderAt).toLocaleString("pt-PT") : "-"}</td>
        <td>
          <div class="actions">
            <button class="mini-btn btn-chat" onclick="remindNow(${row.clientId})" title="Enviar lembrete pelo chat interno">
              <span>💬</span><span>Chat</span>
            </button>

            <button class="mini-btn btn-browser" onclick="sendWhatsBrowser(${row.clientId})" title="Abrir WhatsApp Browser com mensagem pronta">
              <span>📲</span><span>Browser</span>
            </button>

            <button class="mini-btn btn-api" onclick="sendWhatsApi(${row.clientId})" title="Enviar diretamente por WhatsApp API">
              <span>⚙️</span><span>API</span>
            </button>

            <button class="mini-btn btn-open" onclick="openClientChat(${row.clientId})" title="Abrir diretamente o chat do cliente">
              <span>🔎</span><span>Abrir</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  tableBox.innerHTML = html;
}

async function remindNow(clientId) {
  try {
    const res = await fetch(`${API}/billing/remind-now/${clientId}`, {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Erro ao enviar lembrete no chat");
      return;
    }

    alert(data.message || "Mensagem enviada no chat");
    loadBillingCenter();
  } catch (err) {
    console.error(err);
    alert("Erro de ligação");
  }
}

async function sendWhatsBrowser(clientId) {
  try {
    const res = await fetch(`${API}/billing/whatsapp/browser/${clientId}`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Erro ao preparar WhatsApp");
      return;
    }

    if (data.skipped) {
      alert(data.message || "Sem dívida");
      return;
    }

    if (!data.link) {
      alert("Cliente sem telefone válido");
      return;
    }

    window.open(data.link, "_blank");
    loadBillingCenter();
  } catch (err) {
    console.error(err);
    alert("Erro de ligação");
  }
}

async function sendWhatsApi(clientId) {
  try {
    const res = await fetch(`${API}/billing/whatsapp/api/${clientId}`, {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Erro ao enviar WhatsApp API");
      return;
    }

    if (data.skipped) {
      alert(data.message || "Sem dívida");
      return;
    }

    alert(data.message || "WhatsApp enviado via API");
    loadBillingCenter();
  } catch (err) {
    console.error(err);
    alert("Erro de ligação");
  }
}

function openClientChat(clientId) {
  window.location.href = `/frontend/chat.html?mode=client&clientId=${clientId}&senderId=1`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}