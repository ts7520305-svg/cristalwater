const API = "/api";

let client = null;

window.onload = () => {
  const stored = localStorage.getItem("client");
  if (stored) {
    client = JSON.parse(stored);
    showSession();
    loadReports();
  }
};

async function login() {
  const pin = document.getElementById("pin").value;

  const res = await fetch(`${API}/client-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  client = data.client;
  localStorage.setItem("client", JSON.stringify(client));
  showSession();
  loadReports();
}

function showSession() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("sessionBox").style.display = "block";
  document.getElementById("welcome").textContent = `Bem-vindo ${client.name}`;
}

function logout() {
  localStorage.removeItem("client");
  location.reload();
}

async function loadReports() {
  const res = await fetch(`${API}/client-portal/${client.id}/reports`);
  const data = await res.json();
  const reports = Array.isArray(data?.reports) ? data.reports : [];

  const container = document.getElementById("reports");
  if (!container) return;
  container.innerHTML = "";

  reports.forEach((report) => {
    const info = report?.data || {};
    const pools = Array.isArray(info.pools) ? info.pools : [];

    container.innerHTML += `
      <div class="card">
        <h3>Mês: ${report.month}</h3>
        <p>Estado de pagamento: ${info.paymentStatus || "-"}</p>

        ${pools.map(p => `
          <p><strong>${p.name}</strong> — Visitas: ${p.totalVisits}, Falhas: ${p.notDone}</p>
        `).join("")}

        <button onclick="downloadPDF(${report.id})">📄 Download PDF</button>
      </div>
    `;
  });

  if (!reports.length) {
    container.innerHTML = '<div class="card">Sem relatórios disponíveis.</div>';
  }
}

function downloadPDF(id) {
  window.open(`/api/client/reports/${id}/pdf`, "_blank");
}