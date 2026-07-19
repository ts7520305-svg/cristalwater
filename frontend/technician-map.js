const API = "/api";

const loadBtn = document.getElementById("loadBtn");
const nextBtn = document.getElementById("nextBtn");
const statusBox = document.getElementById("statusBox");
const infoBox = document.getElementById("infoBox");
const visitList = document.getElementById("visitList");
const googleLink = document.getElementById("googleLink");
const wazeLink = document.getElementById("wazeLink");

let route = [];
let currentIndex = 0;
let map = null;
let markers = [];
let activeMarker = null;

function userData() {
  try {
    return JSON.parse(localStorage.getItem("cristalwater_user") || localStorage.getItem("user") || "{}") || {};
  } catch (_) {
    return {};
  }
}

function technicianId() {
  const user = userData();
  return Number(user.technicianId || user.id || 0);
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

function validCoordinate(value, type) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (type === "lat" && (number < -90 || number > 90)) return null;
  if (type === "lng" && (number < -180 || number > 180)) return null;
  if (Math.abs(number) < 0.0001) return null;
  return number;
}

function visitCoordinates(visit) {
  const pool = visit?.pool || {};
  const client = visit?.client || pool.client || {};
  const lat = validCoordinate(pool.latitude ?? client.latitude, "lat");
  const lng = validCoordinate(pool.longitude ?? client.longitude, "lng");
  return { lat, lng };
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

function ensureMap() {
  if (map || typeof window.L === "undefined") return;
  map = window.L.map("map", { zoomControl: true }).setView([38.72, -9.14], 10);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
}

function clearMarkers() {
  if (!map) return;
  markers.forEach((marker) => marker.remove());
  markers = [];
  activeMarker = null;
}

function renderMarkers() {
  if (!map) return;
  clearMarkers();

  const bounds = [];
  route.forEach((visit, index) => {
    const { lat, lng } = visitCoordinates(visit);
    if (lat == null || lng == null) return;
    const marker = window.L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`<b>${escapeHtml(visit.pool?.name || "Piscina")}</b><br>${escapeHtml(visit.client?.name || "Cliente")}`);
    marker.on("click", () => setCurrent(index));
    markers.push(marker);
    bounds.push([lat, lng]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [24, 24] });
  }
}

function setNavigationLinks(visit) {
  const { lat, lng } = visitCoordinates(visit || {});
  if (lat == null || lng == null) {
    googleLink.href = "#";
    wazeLink.href = "#";
    return;
  }

  googleLink.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  wazeLink.href = `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`;
}

function renderList() {
  if (!visitList) return;
  if (!route.length) {
    visitList.innerHTML = '<div class="empty">Sem visitas para hoje.</div>';
    return;
  }

  visitList.innerHTML = route.map((visit, index) => {
    const cls = index === currentIndex ? "visit-item active" : "visit-item";
    const location = visit.pool?.location || visit.pool?.address || "Local por confirmar";
    return `
      <button type="button" class="${cls}" data-index="${index}">
        <b>${escapeHtml(visit.pool?.name || "Piscina")}</b>
        <small>${escapeHtml(visit.client?.name || "Cliente")}</small>
        <small>${escapeHtml(location)}</small>
      </button>
    `;
  }).join("");

  visitList.querySelectorAll("button[data-index]").forEach((button) => {
    button.addEventListener("click", () => {
      setCurrent(Number(button.dataset.index || 0));
    });
  });
}

function updateInfo() {
  const visit = route[currentIndex];
  if (!visit) {
    infoBox.textContent = "Sem piscina selecionada.";
    setNavigationLinks(null);
    return;
  }

  const when = visit.plannedDate || visit.startAt || visit.date;
  const whenLabel = when ? new Date(when).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "Sem hora";
  const location = visit.pool?.location || visit.pool?.address || "Local por confirmar";
  infoBox.innerHTML = `
    <b>${escapeHtml(visit.pool?.name || "Piscina")}</b><br>
    Cliente: ${escapeHtml(visit.client?.name || "Cliente")}<br>
    Local: ${escapeHtml(location)}<br>
    Hora: ${escapeHtml(whenLabel)}
  `;

  setNavigationLinks(visit);
  if (markers[currentIndex]) {
    activeMarker = markers[currentIndex];
    activeMarker.openPopup();
  }
}

function setCurrent(index) {
  if (!route.length) return;
  currentIndex = Math.max(0, Math.min(index, route.length - 1));
  renderList();
  updateInfo();
}

function nextPool() {
  if (!route.length) return;
  const next = currentIndex + 1 >= route.length ? 0 : currentIndex + 1;
  setCurrent(next);
}

async function loadToday() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  const id = technicianId();
  if (!id) {
    setStatus("Sessao tecnica sem tecnico associado.", "error");
    route = [];
    renderList();
    updateInfo();
    return;
  }

  if (loadBtn) loadBtn.disabled = true;
  setStatus("A carregar ronda do dia.");

  try {
    const data = await parseResponse(await fetch(`${API}/visits/today?technicianId=${encodeURIComponent(id)}`));
    route = Array.isArray(data.visits) ? data.visits : [];
    currentIndex = 0;

    ensureMap();
    renderMarkers();
    renderList();
    updateInfo();

    setStatus(route.length ? `Ronda carregada com ${route.length} visita(s).` : "Sem visitas para hoje.", route.length ? "" : "warning");
  } catch (error) {
    route = [];
    renderList();
    updateInfo();
    setStatus(error.message || "Falha ao carregar mapa.", "error");
  } finally {
    if (loadBtn) loadBtn.disabled = false;
  }
}

if (loadBtn) loadBtn.addEventListener("click", loadToday);
if (nextBtn) nextBtn.addEventListener("click", nextPool);

window.loadToday = loadToday;
window.nextPool = nextPool;

loadToday();