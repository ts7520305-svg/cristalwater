const API = "/api";
const queryParams = new URLSearchParams(location.search);
const queryClientId = Number(queryParams.get("clientId") || 0);
let allPayments = [];

window.onload = () => {
  document.getElementById("refreshPayments")?.addEventListener("click", loadPayments);
  document.getElementById("paymentSearch")?.addEventListener("input", renderPayments);
  document.getElementById("paymentMethodFilter")?.addEventListener("change", renderPayments);
  if (!hasValidJwtPayload()) {
    setStatus("Sessão inválida. A redirecionar para login...", "error");
    location.replace("/login");
    return;
  }
  loadPayments();
};

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function hasValidJwtPayload() {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  if (!token || token.split(".").length !== 3) return false;
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const data = JSON.parse(decoded);
    return typeof data === "object" && data !== null;
  } catch (_) {
    return false;
  }
}

function setStatus(message, tone = "info") {
  const box = document.getElementById("paymentsStatus");
  if (!box) return;
  box.textContent = message;
  box.className = `status ${tone === "info" ? "" : tone}`.trim();
}

async function loadPayments() {
  setStatus("A carregar pagamentos...");

  try {
    const res = await fetch(`${API}/admin/payments/ledger/all`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setStatus(data.error || "Erro ao carregar pagamentos.", "error");
      allPayments = [];
      renderPayments();
      return;
    }

    allPayments = Array.isArray(data.payments) ? data.payments : [];
    renderPayments();
    setStatus(`${allPayments.length} pagamento(s) carregado(s).`, "ok");
  } catch (err) {
    console.error(err);
    allPayments = [];
    renderPayments();
    setStatus("Erro de ligacao ao carregar pagamentos.", "error");
  }
}

function filteredPayments() {
  let payments = [...allPayments];
  if (queryClientId) payments = payments.filter((p) => Number(p.invoice?.clientId) === queryClientId);

  const query = String(document.getElementById("paymentSearch")?.value || "").toLowerCase().trim();
  const method = String(document.getElementById("paymentMethodFilter")?.value || "").toUpperCase();

  return payments.filter((p) => {
    const clientId = p.invoice?.clientId || null;
    const clientName = p.invoice?.client?.name || `Cliente ${clientId ?? "-"}`;
    const reference = clientId ? `CW-${String(Number(clientId)).padStart(6, "0")}` : "-";
    const hay = `${reference} ${clientName} ${p.method || ""}`.toLowerCase();
    const matchText = !query || hay.includes(query);
    const matchMethod = !method || String(p.method || "").toUpperCase() === method;
    return matchText && matchMethod;
  });
}

function renderPayments() {
  const tableBox = document.getElementById("tableBox");
  const payments = filteredPayments();

  if (!payments.length) {
      tableBox.innerHTML = `<div class="empty-state"><h3>Sem pagamentos</h3><p class="text-muted">Sem pagamentos registados para este filtro.</p></div>`;
    if (allPayments.length) setStatus("Sem resultados para os filtros atuais.", "ok");
    return;
  }

  let html = `
        <div class="ds-table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Referencia</th>
            <th>Cliente</th>
            <th>Invoice</th>
            <th>Valor</th>
            <th>Método</th>
            <th>Data</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
    `;

  payments.forEach((p) => {
    const clientId = p.invoice?.clientId || null;
    const clientName = p.invoice?.client?.name || `Cliente ${clientId ?? "-"}`;
    const reference = clientId ? `CW-${String(Number(clientId)).padStart(6, "0")}` : "-";

    html += `
        <tr>
          <td>${p.id}</td>
          <td><strong>${escapeHtml(reference)}</strong></td>
          <td>${escapeHtml(clientName)}</td>
          <td>${p.invoiceId}</td>
          <td>${Number(p.amount || 0).toFixed(2)} €</td>
          <td>${escapeHtml(p.method || "-")}</td>
          <td>${new Date(p.paidAt).toLocaleString("pt-PT")}</td>
          <td>
            ${clientId ? `
              <button class="cw-v2-btn" onclick="openClient(${clientId})" title="Abrir situação do cliente" aria-label="Abrir cliente ${escapeHtml(clientName)}">
                <span aria-hidden="true">🔎</span><span>Abrir cliente</span>
              </button>
            ` : "-"}
          </td>
        </tr>
      `;
  });

  html += `</tbody></table></div>`;
  tableBox.innerHTML = html;
}

function openClient(clientId) {
  window.location.href = `/chat?clientId=${clientId}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
