const statusBox = document.getElementById("statusBox");
const historyList = document.getElementById("historyList");

function setStatus(message, tone = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (tone) statusBox.dataset.tone = tone;
  else statusBox.removeAttribute("data-tone");
}

function userData() {
  try {
    return JSON.parse(localStorage.getItem("cristalwater_user") || localStorage.getItem("user") || "{}") || {};
  } catch (_) {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(data.error || data.message || `Falha HTTP ${response.status}`);
  return data;
}

function render(visits) {
  if (!historyList) return;
  if (!Array.isArray(visits) || visits.length === 0) {
    historyList.innerHTML = '<div class="empty">Sem historico disponivel.</div>';
    return;
  }

  historyList.innerHTML = visits.map((visit) => {
    const when = visit.endAt || visit.startAt || visit.plannedDate || visit.date;
    const whenText = when ? new Date(when).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "Sem data";
    const pool = visit.pool?.name || "Piscina";
    const client = visit.client?.name || "Cliente";
    const status = visit.status || "-";
    return `
      <article class="item">
        <b>${escapeHtml(pool)}</b>
        <small>${escapeHtml(client)}</small>
        <small>${escapeHtml(whenText)} · Estado ${escapeHtml(status)}</small>
      </article>
    `;
  }).join("");
}

async function loadHistory() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  const user = userData();
  const technicianId = Number(user.technicianId || user.id || 0);
  if (!technicianId) {
    setStatus("Sessao sem tecnico associado.", "error");
    render([]);
    return;
  }

  setStatus("A carregar historico.");
  try {
    const data = await parseResponse(await fetch(`/api/technician/today?technicianId=${encodeURIComponent(technicianId)}`));
    const visits = (Array.isArray(data.visits) ? data.visits : []).filter((visit) => {
      const status = String(visit.status || "").toUpperCase();
      return Boolean(visit.endAt) || status === "DONE";
    });
    render(visits);
    setStatus(visits.length ? `Historico carregado com ${visits.length} visita(s).` : "Sem visitas concluidas para mostrar.", visits.length ? "" : "warning");
  } catch (error) {
    render([]);
    setStatus(error.message || "Falha ao carregar historico.", "error");
  }
}

loadHistory();