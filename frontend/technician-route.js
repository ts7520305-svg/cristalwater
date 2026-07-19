const API = "/api";

const routeBox = document.getElementById("route");
const suggestionsBox = document.getElementById("suggestions");
const statusBox = document.getElementById("statusBox");
const refreshBtn = document.getElementById("refreshBtn");

function userData() {
  try {
    return JSON.parse(localStorage.getItem("cristalwater_user") || localStorage.getItem("user") || "{}") || {};
  } catch (_) {
    return {};
  }
}

function todayDateValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function setStatus(message, tone = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (tone) statusBox.dataset.tone = tone;
  else statusBox.removeAttribute("data-tone");
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
  if (!response.ok) {
    throw new Error(data.error || data.message || `Falha HTTP ${response.status}`);
  }
  return data;
}

function renderRoute(visits) {
  if (!routeBox) return;
  if (!Array.isArray(visits) || visits.length === 0) {
    routeBox.innerHTML = '<div class="empty">Sem rota planeada para hoje.</div>';
    return;
  }

  routeBox.innerHTML = visits.map((visit, order) => {
    const clientName = visit.client?.name || `Cliente ${visit.clientId || "-"}`;
    const poolName = visit.pool?.name || "Piscina sem nome";
    const location = visit.pool?.location || visit.pool?.address || "Local por confirmar";
    const plannedAt = visit.plannedDate || visit.startAt || visit.date;
    const when = plannedAt ? new Date(plannedAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "Sem hora";
    return `
      <article class="route-item">
        <small>Paragem ${order + 1}</small>
        <b>${escapeHtml(poolName)}</b>
        <small>${escapeHtml(clientName)}</small>
        <small>${escapeHtml(location)} · ${escapeHtml(when)}</small>
      </article>
    `;
  }).join("");
}

function renderSuggestions(visits) {
  if (!suggestionsBox) return;
  if (!Array.isArray(visits) || visits.length === 0) {
    suggestionsBox.innerHTML = '<div class="empty">Sem sugestoes para mostrar.</div>';
    return;
  }

  const grouped = visits
    .filter((visit) => Boolean(visit.pool?.zone || visit.client?.zone))
    .slice(0, 4)
    .map((visit) => {
      const zone = visit.pool?.zone || visit.client?.zone || "Zona por definir";
      return `
        <article class="route-item">
          <b>${escapeHtml(visit.pool?.name || "Piscina")}</b>
          <small>Zona ${escapeHtml(zone)}</small>
          <small>Verificar transito e acessos antes de sair.</small>
        </article>
      `;
    });

  suggestionsBox.innerHTML = grouped.length
    ? grouped.join("")
    : '<div class="empty">Sem dados suficientes para sugestoes automáticas.</div>';
}

async function loadRoute() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  const technicianId = Number(userData().technicianId || userData().id || 0);
  if (!technicianId) {
    setStatus("Sessao tecnica sem tecnico associado.", "error");
    if (routeBox) routeBox.innerHTML = '<div class="empty">Nao foi possivel determinar o tecnico da sessao.</div>';
    return;
  }

  setStatus("A carregar rota do dia.");
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const query = new URLSearchParams({
      technicianId: String(technicianId),
      date: todayDateValue(),
    });
    const data = await parseResponse(await fetch(`${API}/technician/today?${query.toString()}`));
    const visits = Array.isArray(data.visits) ? data.visits : [];

    renderRoute(visits);
    renderSuggestions(visits);

    if (visits.length) {
      setStatus(`Rota carregada com ${visits.length} paragem(ns).`);
    } else {
      setStatus("Sem paragens para hoje.", "warning");
    }
  } catch (error) {
    renderRoute([]);
    renderSuggestions([]);
    setStatus(error.message || "Falha ao carregar rota.", "error");
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

if (refreshBtn) refreshBtn.addEventListener("click", loadRoute);

loadRoute();