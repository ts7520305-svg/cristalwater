const API = "/api";
const ADMIN_PAYMENTS_API = "/api/admin/payments";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

const actionLock = new Set();

function setStatus(message, tone = "info") {
  const box = document.getElementById("billingStatus");
  if (!box) return;
  box.textContent = message;
  box.className = `status ${tone === "info" ? "" : tone}`.trim();
}

window.onload = () => {
  document.getElementById("search").addEventListener("input", renderTable);
  document.getElementById("statusFilter").addEventListener("change", renderTable);
  loadBillingCenter();
};

let billingData = [];
let allRows = [];

async function parseJsonSafely(response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: text ? "Resposta invalida do servidor" : "Resposta vazia do servidor" };
  }
  return response.json().catch(() => ({ ok: false, error: "Resposta JSON invalida" }));
}

async function loadBillingCenter() {
  setStatus("A carregar dados de cobranca...");
  try {
    const res = await fetch(ADMIN_PAYMENTS_API, { headers: authHeaders() });
    const data = await parseJsonSafely(res);

    if (!res.ok || !Array.isArray(data.clients)) {
      setStatus(data.error || `Erro ao carregar centro de cobrancas (HTTP ${res.status})`, "error");
      return;
    }

    allRows = data.clients;
    billingData = data.clients
      .filter((client) => Number(client.totalDue || 0) > 0)
      .map((client) => ({
        clientId: client.id,
        clientName: client.name,
        zone: "-",
        status: client.paymentStatus === "PAID" ? "ACTIVE" : "PAUSED",
        overdueInvoices: Number(client.totalDue || 0) > 0 ? 1 : 0,
        totalOpen: Number(client.totalDue || 0),
        phone: client.finalPhone || client.phone || "-",
        email: client.finalEmail || client.email || "-",
        lastReminderAt: client.lastReminderAt || null,
      }));

    const totalOpen = billingData.reduce((sum, row) => sum + Number(row.totalOpen || 0), 0);
    document.getElementById("sumDebtors").innerText = billingData.length;
    document.getElementById("sumOpen").innerText = `${Number(totalOpen).toFixed(2)} €`;

    const invoicesCount = billingData.reduce((sum, row) => sum + Number(row.overdueInvoices || 0), 0);
    document.getElementById("sumInvoices").innerText = invoicesCount;

    renderTable();
    setStatus(`${billingData.length} cliente(s) em acompanhamento de cobranca.`, "ok");
  } catch (err) {
    console.error(err);
    setStatus("Erro de ligacao ao carregar cobrancas", "error");
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
    setStatus("Sem resultados para os filtros atuais.", "ok");
    return;
  }

  let html = `
    <div class="table-wrap">
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

  html += `</tbody></table></div>`;
  tableBox.innerHTML = html;
}

async function remindNow(clientId) {
  if (actionLock.has(`remind:${clientId}`)) return;
  const ok = confirm("Confirmar envio de lembrete interno para este cliente?");
  if (!ok) return;
  try {
    actionLock.add(`remind:${clientId}`);
    const res = await fetch(`${API}/billing/remind-now/${clientId}`, {
      method: "POST",
      headers: authHeaders(),
    });

    const data = await parseJsonSafely(res);

    if (!res.ok || !data.ok) {
      setStatus(data.error || "Erro ao enviar lembrete no chat", "error");
      return;
    }

    setStatus(data.message || "Mensagem enviada no chat", "ok");
    loadBillingCenter();
  } catch (err) {
    console.error(err);
    setStatus("Erro de ligacao ao enviar lembrete", "error");
  } finally {
    actionLock.delete(`remind:${clientId}`);
  }
}

async function sendWhatsBrowser(clientId) {
  try {
    const res = await fetch(`${API}/billing/whatsapp/browser/${clientId}`, { headers: authHeaders() });
    const data = await parseJsonSafely(res);

    if (!res.ok || !data.ok) {
      setStatus(data.error || "Erro ao preparar WhatsApp", "error");
      return;
    }

    if (data.skipped) {
      setStatus(data.message || "Sem divida", "ok");
      return;
    }

    if (!data.link) {
      setStatus("Cliente sem telefone valido", "error");
      return;
    }

    window.open(data.link, "_blank");
    setStatus("WhatsApp Browser aberto com mensagem pronta.", "ok");
    loadBillingCenter();
  } catch (err) {
    console.error(err);
    setStatus("Erro de ligacao ao preparar WhatsApp Browser", "error");
  }
}

async function sendWhatsApi(clientId) {
  if (actionLock.has(`waapi:${clientId}`)) return;
  const ok = confirm("Confirmar envio via WhatsApp API para este cliente?");
  if (!ok) return;
  try {
    actionLock.add(`waapi:${clientId}`);
    const res = await fetch(`${API}/billing/whatsapp/api/${clientId}`, {
      method: "POST",
      headers: authHeaders(),
    });

    const data = await parseJsonSafely(res);

    if (!res.ok || !data.ok) {
      setStatus(data.error || "Erro ao enviar WhatsApp API", "error");
      return;
    }

    if (data.skipped) {
      setStatus(data.message || "Sem divida", "ok");
      return;
    }

    setStatus(data.message || "WhatsApp enviado via API", "ok");
    loadBillingCenter();
  } catch (err) {
    console.error(err);
    setStatus("Erro de ligacao ao enviar WhatsApp API", "error");
  } finally {
    actionLock.delete(`waapi:${clientId}`);
  }
}

function openClientChat(clientId) {
  window.location.href = `/chat?mode=client&clientId=${clientId}&senderId=1`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}