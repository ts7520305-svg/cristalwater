const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function formatMoney(value) {
  return `€ ${Number(value || 0).toFixed(2)}`;
}

function getCurrentMonthRef() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function loadOperational() {
  const monthRef = document.getElementById("monthRef").value || getCurrentMonthRef();

  setStatus("A carregar...");

  try {
    const res = await fetch(`${API}/dashboard/admin?monthRef=${encodeURIComponent(monthRef)}`, {
      headers: authHeaders(),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("Erro");
      alert(data.error || "Erro ao carregar");
      return;
    }

    const s = data.summary || {};

    document.getElementById("totalClients").textContent = s.totalClients || 0;
    document.getElementById("totalPools").textContent = s.totalPools || 0;
    document.getElementById("zoneCount").textContent = (data.poolsByZone || []).length;
    document.getElementById("monthlyPotential").textContent = formatMoney(s.totalMonthlyAmount || 0);

    document.getElementById("zonesTable").innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Zona</th>
            <th>Instalações</th>
          </tr>
        </thead>
        <tbody>
          ${(data.poolsByZone || []).map((z) => `
            <tr>
              <td>${escapeHtml(z.zone || "-")}</td>
              <td>${z.count}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    document.getElementById("debtorsTable").innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Aberto</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${(data.topDebtors || []).map((d) => `
            <tr>
              <td>${escapeHtml(d.clientName || "-")}</td>
              <td>${escapeHtml(d.status || "-")}</td>
              <td>${formatMoney(d.amountOpen)}</td>
              <td>${formatMoney(d.total)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    setStatus("Dashboard operacional carregado");
  } catch (err) {
    console.error(err);
    setStatus("Erro de ligação");
    alert("Erro de ligação");
  }
}

document.getElementById("monthRef").value = getCurrentMonthRef();
loadOperational();