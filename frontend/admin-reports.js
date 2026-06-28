const API = "/api";

window.onload = load;

async function readJson(path, fallback = {}) {
  try {
    const res = await fetch(path);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return fallback;
    const data = await res.json();
    return res.ok ? data : fallback;
  } catch (_) {
    return fallback;
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

async function load() {
  const dash = await readJson(API + "/core/dashboard", { financial: {} });
  const comm = await readJson(API + "/communications", { logs: [] });

  const financial = dash.financial || dash.finance || {};
  const debt = financial.totalDebt || financial.openAmount || financial.pendingTotal || 0;
  const paid = financial.totalPaid || financial.totalPaidAll || financial.paidTotal || 0;

  document.getElementById("financial").innerHTML = `
    <strong>Total em aberto:</strong> ${money(debt)}<br>
    <strong>Total pago:</strong> ${money(paid)}
  `;

  document.getElementById("communications").innerHTML = `
    <strong>Total mensagens/comunicacoes:</strong> ${Array.isArray(comm.logs) ? comm.logs.length : 0}
  `;
}
