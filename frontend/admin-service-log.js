const API = `${location.origin}/api`;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

const state = {
  technicians: [],
  vehicles: [],
  log: null,
};

function $(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));
}

function todayIso() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

async function json(path) {
  const response = await fetch(path, { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "Erro de ligacao");
  return data;
}

function asArray(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

async function loadFilters() {
  const [techniciansResult, vehiclesResult] = await Promise.allSettled([
    json(`${API}/technicians`),
    json(`${API}/guides/vehicles`),
  ]);

  state.technicians = techniciansResult.status === "fulfilled"
    ? asArray(techniciansResult.value, "technicians")
    : [];
  state.vehicles = vehiclesResult.status === "fulfilled"
    ? asArray(vehiclesResult.value, "vehicles")
    : [];

  $("technicianFilter").innerHTML = '<option value="">Todos os tecnicos</option>' + state.technicians.map((tech) => `
    <option value="${esc(tech.id)}">${esc(tech.name || tech.email || `Tecnico ${tech.id}`)}</option>
  `).join("");

  $("vehicleFilter").innerHTML = '<option value="">Todas as viaturas</option>' + state.vehicles.map((vehicle) => `
    <option value="${esc(vehicle.id)}">${esc(vehicle.plate || vehicle.name || `Viatura ${vehicle.id}`)}</option>
  `).join("");
}

function renderMetrics(summary = {}) {
  const items = [
    ["Servicos", summary.services || 0],
    ["Concluidos", summary.done || 0],
    ["Tecnicos", summary.technicians || 0],
    ["Viaturas", summary.vehicles || 0],
    ["Pontos GPS", summary.gpsPoints || 0],
  ];
  $("metrics").innerHTML = items.map(([label, value]) => `
    <div class="metric">
      <span class="muted">${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join("");
}

function statusClass(service) {
  return service.status === "DONE" || service.endAt ? "done" : "";
}

function renderServices(services = []) {
  if (!services.length) {
    $("services").innerHTML = '<div class="empty">Sem servicos registados para estes filtros.</div>';
    return;
  }

  $("services").innerHTML = services.map((service) => {
    const movements = service.stockMovements || [];
    const chemicals = service.chemicals || [];
    return `
      <article class="service">
        <div class="service-head">
          <div>
            <div class="service-title">${esc(service.pool?.name || "Piscina")}</div>
            <div class="muted">${esc(service.client?.name || service.pool?.client?.name || "Cliente")} · ${esc(service.pool?.zone || service.pool?.address || "")}</div>
          </div>
          <span class="pill ${statusClass(service)}">${esc(service.status || "PLANNED")}</span>
        </div>
        <div class="service-meta">
          <span><strong>Planeada:</strong> ${esc(formatDateTime(service.plannedAt))}</span>
          <span><strong>Inicio:</strong> ${esc(formatTime(service.startAt))}</span>
          <span><strong>Fim:</strong> ${esc(formatTime(service.endAt))}</span>
          <span><strong>Tecnico:</strong> ${esc(service.technician?.name || service.technicianName || "-")}</span>
          <span><strong>Viatura:</strong> ${esc(service.vehicle?.plate || service.vehicle?.name || "-")}</span>
          <span><strong>Guia:</strong> ${esc(service.workGuide?.codeAT || service.workGuide?.id || "-")}</span>
        </div>
        ${movements.length ? `
          <div class="muted" style="margin-top:10px"><strong>Material:</strong> ${movements.map((item) => `${esc(item.itemName)} ${esc(item.quantity)} ${esc(item.unit || "")}`).join(" · ")}</div>
        ` : ""}
        ${chemicals.length ? `
          <div class="muted" style="margin-top:10px"><strong>Quimicos:</strong> ${chemicals.map((item) => `${esc(item.name)} ${esc(item.quantity)} ${esc(item.unit || "")}`).join(" · ")}</div>
        ` : ""}
      </article>
    `;
  }).join("");
}

function timelineClass(item) {
  if (item.type === "GPS") return "gps";
  if (String(item.type || "").includes("STOCK")) return "stock";
  if (String(item.type || "").includes("DONE")) return "done";
  return "";
}

function renderTimeline(timeline = []) {
  const limited = timeline.slice(-250).reverse();
  if (!limited.length) {
    $("timeline").innerHTML = '<div class="empty">Sem eventos na timeline para estes filtros.</div>';
    return;
  }

  $("timeline").innerHTML = limited.map((item) => {
    const mapLink = item.latitude && item.longitude
      ? `<a class="pill" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.latitude},${item.longitude}`)}">Mapa</a>`
      : "";
    return `
      <div class="timeline-item ${timelineClass(item)}">
        <div class="timeline-time">${esc(formatDateTime(item.at))} · ${esc(item.type || "EVENTO")}</div>
        <div class="line">
          <strong>${esc(item.title || "Evento")}</strong>
          ${mapLink}
        </div>
        <div class="muted">${esc(item.message || "")}</div>
      </div>
    `;
  }).join("");
}

function renderMap(timeline = []) {
  const points = timeline.filter((item) => item.type === "GPS" && item.latitude && item.longitude);
  const latest = points[points.length - 1];
  if (!latest) {
    $("mapBox").innerHTML = '<div class="empty" style="margin:18px">Sem pontos GPS para mostrar.</div>';
    return;
  }
  const lat = Number(latest.latitude);
  const lng = Number(latest.longitude);
  const delta = 0.035;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  $("mapBox").innerHTML = `
    <iframe title="Ultima posicao GPS" src="https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}"></iframe>
  `;
}

function renderLog(data) {
  state.log = data;
  $("dayLabel").textContent = data.day || $("dateFilter").value;
  renderMetrics(data.summary || {});
  renderServices(data.services || []);
  renderTimeline(data.timeline || []);
  renderMap(data.timeline || []);
}

async function loadLog() {
  $("services").innerHTML = '<div class="empty">A carregar registos...</div>';
  $("timeline").innerHTML = '<div class="empty">A carregar timeline...</div>';

  const params = new URLSearchParams();
  params.set("date", $("dateFilter").value || todayIso());
  if ($("technicianFilter").value) params.set("technicianId", $("technicianFilter").value);
  if ($("vehicleFilter").value) params.set("vehicleId", $("vehicleFilter").value);

  const data = await json(`${API}/core/daily-service-log?${params.toString()}`);
  renderLog(data);
}

window.addEventListener("DOMContentLoaded", async () => {
  $("dateFilter").value = todayIso();
  $("refreshBtn").addEventListener("click", () => loadLog().catch((error) => {
    $("services").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }));
  ["dateFilter", "technicianFilter", "vehicleFilter"].forEach((id) => {
    $(id).addEventListener("change", () => loadLog().catch((error) => {
      $("services").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    }));
  });

  await loadFilters().catch(() => null);
  await loadLog().catch((error) => {
    $("services").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    $("timeline").innerHTML = '<div class="empty">Nao foi possivel carregar a timeline.</div>';
  });
});
