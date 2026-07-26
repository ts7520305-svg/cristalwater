const API = "/api";
const statusCard = document.getElementById("paymentStatus");
const rows = document.getElementById("rows");
const queryClientId = new URLSearchParams(location.search).get("clientId");
const CLIENT_ID = Number(queryClientId || localStorage.getItem("cw_client_id") || localStorage.getItem("clientId") || 0);

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-PT");
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusText(value) {
  const status = String(value || "").toUpperCase();
  if (status === "PAID" || status === "PAGO") return "Pago";
  if (status === "PARTIAL") return "Parcial";
  if (status === "OVERDUE") return "Em atraso";
  return "Pendente";
}

async function loadPayments() {
  try {
    if (!CLIENT_ID) throw new Error("Cliente nao identificado.");
    const res = await fetch(`${API}/client-portal/${CLIENT_ID}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || "Nao foi possivel carregar pagamentos.");

    const reference = data.paymentInstructions?.paymentReference || data.client?.paymentReference || `CW-${String(CLIENT_ID).padStart(6, "0")}`;
    const totalOpen = Number(data.summary?.totalOpen || 0);
    const totalPaid = Number(data.summary?.totalPaid || 0);

    statusCard.classList.toggle("status-ok", totalOpen <= 0);
    statusCard.classList.toggle("status-warning", totalOpen > 0);
    statusCard.querySelector(".status-text").innerHTML = `
      <strong>Referencia fixa:</strong> ${esc(reference)}<br>
      ${totalOpen > 0 ? `Valor em aberto: <strong>${money(totalOpen)}</strong>` : "Sem valores pendentes registados."}<br>
      Pago registado: ${money(totalPaid)}<br>
      Ao pagar, envie uma mensagem no portal ou por WhatsApp com a referencia ${esc(reference)}.
    `;

    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    if (!invoices.length) {
      rows.innerHTML = `<tr><td colspan="4">Ainda nao existem faturas ou pagamentos registados.</td></tr>`;
      return;
    }

    rows.innerHTML = invoices.map((invoice) => `
      <tr>
        <td>${esc(fmtDate(invoice.issueDate || invoice.dueDate))}</td>
        <td>${esc(invoice.invoiceNumber || invoice.monthRef || `Conta ${invoice.id}`)}<br><small>Ref. ${esc(reference)}</small></td>
        <td>${esc(money(invoice.total || invoice.amountOpen || 0))}</td>
        <td>${esc(statusText(invoice.status))}</td>
      </tr>
    `).join("");
  } catch (e) {
    statusCard.querySelector(".status-text").innerText = e.message || "Nao foi possivel carregar os dados de pagamento.";
    rows.innerHTML = "";
  }
}

loadPayments();
