const API = "/api";

window.onload = () => {
  const month = document.getElementById("reportMonth");
  if (month && !month.value) {
    const now = new Date();
    month.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  document.getElementById("refreshReports")?.addEventListener("click", load);
  document.getElementById("reportMode")?.addEventListener("change", load);
  load();
};

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function setStatus(message, tone = "info") {
  const node = document.getElementById("reportsStatus");
  if (!node) return;
  node.textContent = message;
  node.className = `status ${tone === "info" ? "" : tone}`.trim();
}

async function readJson(path, fallback = {}) {
  try {
    const res = await fetch(path, { headers: authHeaders() });
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
  setStatus("A carregar relatorios...");

  const selectedMonth = document.getElementById("reportMonth")?.value || "";
  const mode = document.getElementById("reportMode")?.value || "overview";

  // Force admin authorization check for this screen before rendering summary panels.
  // If token/session is invalid, fetch wrapper in cw-auth will clear session and redirect.
  const adminReports = await readJson(API + "/admin/reports", { reports: [] });

  const dash = await readJson(API + "/core/dashboard", { financial: {}, payments: [] });
  const comm = await readJson(API + "/communications", { logs: [] });

  const financial = dash.financial || dash.finance || {};
  const debt = financial.totalDebt || financial.openAmount || financial.pendingTotal || 0;
  const paid = financial.totalPaid || financial.totalPaidAll || financial.paidTotal || 0;
  const invoices = Number(dash?.counts?.invoices || 0);
  const payments = Number(dash?.counts?.payments || 0);

  if (mode === "financial" || mode === "overview") {
    document.getElementById("financial").innerHTML = `
      <strong>Total em aberto:</strong> ${money(debt)}<br>
      <strong>Total pago:</strong> ${money(paid)}<br>
      <strong>Faturas:</strong> ${invoices}<br>
      <strong>Pagamentos:</strong> ${payments}<br>
      <strong>Relatorios administrativos:</strong> ${Number((adminReports.reports || []).length)}<br>
      <span class="small">Periodo selecionado: ${selectedMonth || "atual"}</span>
    `;
  } else {
    document.getElementById("financial").innerHTML = `<span class="small">Painel financeiro oculto neste modo.</span>`;
  }

  const totalLogs = Array.isArray(comm.logs) ? comm.logs.length : 0;
  const lastLogs = Array.isArray(comm.logs) ? comm.logs.slice(0, 5) : [];

  if (mode === "communications" || mode === "overview") {
    document.getElementById("communications").innerHTML = `
      <strong>Total mensagens/comunicacoes:</strong> ${totalLogs}<br>
      ${lastLogs.length ? `<strong>Ultimas entradas:</strong><br>${lastLogs.map((log) => `- ${log.type || "evento"} · ${new Date(log.createdAt || Date.now()).toLocaleString("pt-PT")}`).join("<br>")}` : "<span class=\"small\">Sem logs recentes.</span>"}
    `;
  } else {
    document.getElementById("communications").innerHTML = `<span class="small">Painel de comunicacoes oculto neste modo.</span>`;
  }

  setStatus("Relatorios atualizados.", "ok");
}
