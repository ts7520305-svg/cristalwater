const API = "/api";
const queryParams = new URLSearchParams(location.search);
const queryClientId = Number(queryParams.get("clientId") || 0);

window.onload = loadPayments;

async function loadPayments() {
  const tableBox = document.getElementById("tableBox");

  try {
    const res = await fetch(`${API}/admin/payments/ledger/all`);
    const data = await res.json();

    let payments = data.payments || [];
    if (queryClientId) {
      payments = payments.filter((p) => Number(p.invoice?.clientId) === queryClientId);
    }

    if (!data.ok || !payments.length) {
      tableBox.innerHTML = `<div class="empty">Sem pagamentos registados.</div>`;
      return;
    }

    let html = `
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
              <button class="mini-btn" onclick="openClient(${clientId})" title="Abrir situação do cliente">
                <span>🔎</span><span>Abrir cliente</span>
              </button>
            ` : "-"}
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    tableBox.innerHTML = html;

  } catch (err) {
    console.error(err);
    tableBox.innerHTML = `<div class="empty">Erro ao carregar pagamentos.</div>`;
  }
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
