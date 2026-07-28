const API = "/api";

const adminToken = localStorage.getItem("token");
const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
const adminSocket = window.io ? window.io() : { on() {} };

const ALGARVE_BOUNDS = {
  minLat: 36.86,
  maxLat: 37.48,
  minLng: -9.12,
  maxLng: -7.35,
};

let liveMap = null;
let mapMode = "fallback";
let markers = [];
let alertMarkers = [];
let technicianMarkerById = new Map();
let alertMarkerById = new Map();
let clusterGroup = null;
let heatLayer = null;
let fallbackMarkerLayer = null;
let fallbackEmptyState = null;
let allTechnicians = [];
let liveAlerts = [];
let activePanel = null;
let selectedEntityKey = null;

function adminLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${adminToken}`,
  };
}

window.addEventListener("load", () => {
  if (!adminToken || !adminUser || String(adminUser.role).toUpperCase() !== "ADMIN") {
    adminLogout();
    return;
  }

  bindInspectorControls();
  initLiveMap();
});

function initLiveMap() {
  ensureFallbackStyles();

  if (window.L) {
    initLeafletMap();
  } else {
    initFallbackMap();
  }

  loadLiveMap();
  loadCriticalAlerts();

  setInterval(() => {
    loadLiveMap();
    loadCriticalAlerts();
  }, 10000);
}

function bindInspectorControls() {
  const badges = Array.from(document.querySelectorAll(".topbar .badge"));
  const panelTypes = ["technicians", "gps", "alerts"];
  badges.forEach((badge, index) => {
    const panel = badge.dataset.livePanel || panelTypes[index];
    if (!panel) return;
    badge.dataset.livePanel = panel;
    badge.setAttribute("role", "button");
    badge.setAttribute("tabindex", "0");
    badge.addEventListener("click", () => openInspector(panel));
    badge.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openInspector(panel);
      }
    });
  });

  document.getElementById("liveInspectorClose")?.addEventListener("click", closeInspector);
}

function openInspector(panel) {
  activePanel = panel;
  document.querySelectorAll(".topbar .badge").forEach((badge) => {
    badge.classList.toggle("active", badge.dataset.livePanel === panel);
  });
  const inspector = document.getElementById("liveInspector");
  if (inspector) inspector.hidden = false;
  renderInspector();
}

function closeInspector() {
  activePanel = null;
  selectedEntityKey = null;
  document.querySelectorAll(".topbar .badge").forEach((badge) => badge.classList.remove("active"));
  const inspector = document.getElementById("liveInspector");
  if (inspector) inspector.hidden = true;
}

function initLeafletMap() {
  try {
    mapMode = "leaflet";
    liveMap = L.map("map").setView([37.136, -8.67], 10);

    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OpenStreetMap",
    });

    tileLayer.on("tileerror", () => {
      if (mapMode === "leaflet") switchToFallbackMap();
    });

    tileLayer.addTo(liveMap);

    clusterGroup = window.L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup();
    liveMap.addLayer(clusterGroup);
  } catch (error) {
    console.warn("Mapa externo indisponivel, a usar mapa operacional interno.", error);
    switchToFallbackMap();
  }
}

function switchToFallbackMap() {
  try {
    if (liveMap && liveMap.remove) liveMap.remove();
  } catch (_) {}
  liveMap = null;
  initFallbackMap();
}

function initFallbackMap() {
  mapMode = "fallback";
  const map = document.getElementById("map");
  if (!map) return;

  map.classList.add("cw-static-map");
  map.innerHTML = `
    <div class="cw-map-sky"></div>
    <svg class="cw-map-base" viewBox="0 0 1000 640" aria-hidden="true">
      <defs>
        <linearGradient id="cwLand" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#123557"/>
          <stop offset=".56" stop-color="#0e2b49"/>
          <stop offset="1" stop-color="#0a223c"/>
        </linearGradient>
        <linearGradient id="cwWater" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#0c4773"/>
          <stop offset="1" stop-color="#05223c"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="640" fill="url(#cwWater)"/>
      <path d="M0 128 C120 92 223 116 342 86 C474 53 595 80 730 53 C835 34 924 48 1000 30 L1000 640 L0 640 Z" fill="url(#cwLand)" opacity=".96"/>
      <path d="M0 176 C106 142 219 164 338 132 C480 94 579 124 728 92 C836 70 936 81 1000 62" fill="none" stroke="#51d7ff" stroke-width="8" opacity=".42"/>
      <path d="M108 330 C242 274 377 292 502 244 C648 188 792 183 931 138" fill="none" stroke="#9ee8ff" stroke-width="3" opacity=".28"/>
      <path d="M52 480 C208 414 356 410 514 356 C674 301 811 264 956 212" fill="none" stroke="#4da6d8" stroke-width="3" opacity=".24"/>
      <path d="M188 88 L280 202 L408 253 L553 348 L726 424 L880 554" fill="none" stroke="#f6d365" stroke-width="4" opacity=".34"/>
      <path d="M130 236 L296 252 L455 318 L638 335 L852 412" fill="none" stroke="#d8ecff" stroke-width="3" opacity=".24"/>
    </svg>
    <div class="cw-map-grid"></div>
    <div class="cw-map-label" style="left:8%;top:22%">Lagos</div>
    <div class="cw-map-label" style="left:25%;top:31%">Portimao</div>
    <div class="cw-map-label" style="left:44%;top:39%">Albufeira</div>
    <div class="cw-map-label" style="left:64%;top:32%">Faro</div>
    <div class="cw-map-label" style="left:82%;top:43%">Tavira</div>
    <div class="cw-map-marker-layer" id="fallbackMarkerLayer"></div>
    <div class="cw-map-empty" id="fallbackEmptyState">
      <strong>Mapa operacional ativo</strong>
      <span>Sem GPS ativo neste momento. Quando um tecnico iniciar o dia e enviar localizacao, aparece aqui.</span>
    </div>
  `;

  fallbackMarkerLayer = document.getElementById("fallbackMarkerLayer");
  fallbackEmptyState = document.getElementById("fallbackEmptyState");
}

async function loadLiveMap() {
  try {
    clearMarkers();

    if (heatLayer && mapMode === "leaflet") {
      liveMap.removeLayer(heatLayer);
      heatLayer = null;
    }

    const res = await fetch(`${API}/gps/live`, {
      headers: getAuthHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      adminLogout();
      return;
    }

    const technicians = await res.json();
    allTechnicians = Array.isArray(technicians) ? technicians : [];
    const validTechnicians = allTechnicians.filter((tech) =>
      hasCoordinate(tech.latitude, tech.longitude) && (tech.gpsActive !== false)
    );

    setText("techCount", allTechnicians.length || 0);
    setText("gpsCount", validTechnicians.length);
    renderSidebar(validTechnicians);
    renderInspector();

    if (fallbackEmptyState) {
      fallbackEmptyState.hidden = validTechnicians.length > 0;
    }

    if (!validTechnicians.length) return;

    if (mapMode === "leaflet") {
      renderLeafletTechnicians(validTechnicians);
    } else {
      renderFallbackTechnicians(validTechnicians);
    }
  } catch (err) {
    console.error(err);
    if (mapMode !== "fallback") switchToFallbackMap();
    showFallbackMessage("Nao foi possivel carregar GPS agora. O mapa continua pronto para receber localizacoes.");
  }
}

function renderLeafletTechnicians(technicians) {
  const bounds = [];
  const heatPoints = [];

  technicians.forEach((tech) => {
    const lat = Number(tech.latitude);
    const lng = Number(tech.longitude);
    const color = technicianColor(tech);

    const marker = L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: color,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 1,
    }).bindPopup(technicianPopupHtml(tech));

    clusterGroup.addLayer(marker);
    markers.push(marker);
    technicianMarkerById.set(String(tech.id), marker);
    bounds.push([lat, lng]);
    heatPoints.push([lat, lng, 1]);
  });

  if (window.L.heatLayer && heatPoints.length) {
    heatLayer = L.heatLayer(heatPoints, { radius: 35, blur: 25, maxZoom: 17 }).addTo(liveMap);
  }

  if (bounds.length) liveMap.fitBounds(bounds, { padding: [40, 40] });
}

function renderFallbackTechnicians(technicians) {
  if (!fallbackMarkerLayer) return;

  technicians.forEach((tech) => {
    const marker = createFallbackMarker({
      type: "technician",
      color: technicianColor(tech),
      latitude: tech.latitude,
      longitude: tech.longitude,
      title: tech.name || "Tecnico",
      subtitle: tech.actionText || `GPS ${formatCoord(tech.latitude)}, ${formatCoord(tech.longitude)}`,
      onClick: () => selectTechnician(tech.id),
    });

    fallbackMarkerLayer.appendChild(marker);
    markers.push(marker);
    technicianMarkerById.set(String(tech.id), marker);
  });
}

async function loadCriticalAlerts() {
  try {
    clearAlertMarkers();

    const res = await fetch(`${API}/alerts`, {
      headers: getAuthHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      adminLogout();
      return;
    }

    const data = await res.json();
    const alerts = data.alerts || [];
    liveAlerts = Array.isArray(alerts) ? alerts : [];
    setText("alertCount", alerts.length);
    renderInspector();

    alerts.forEach((alert) => {
      const coords = alertCoordinates(alert);
      const lat = coords?.latitude;
      const lng = coords?.longitude;
      if (!hasCoordinate(lat, lng)) return;

      if (mapMode === "leaflet") {
        const marker = L.circleMarker([Number(lat), Number(lng)], {
          radius: 12,
          fillColor: "#c62828",
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 1,
        }).addTo(liveMap).bindPopup(alertPopupHtml(alert));

        alertMarkers.push(marker);
        alertMarkerById.set(String(alert.id), marker);
      } else if (fallbackMarkerLayer) {
        const marker = createFallbackMarker({
          type: "alert",
          color: "#c62828",
          latitude: lat,
          longitude: lng,
          title: alert.title || alert.type || "Alerta",
          subtitle: alertLocationText(alert) || alert.message || "Alerta tecnico",
          onClick: () => selectAlert(alert.id),
        });

        fallbackMarkerLayer.appendChild(marker);
        alertMarkers.push(marker);
        alertMarkerById.set(String(alert.id), marker);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

function createFallbackMarker({ type, color, latitude, longitude, title, subtitle, onClick }) {
  const pos = projectToMap(latitude, longitude);
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = `cw-map-pin ${type === "alert" ? "cw-map-pin-alert" : ""}`;
  marker.style.left = `${pos.x}%`;
  marker.style.top = `${pos.y}%`;
  marker.style.setProperty("--pin", color);
  marker.setAttribute("aria-label", title);
  marker.innerHTML = `<span></span><b>${escapeHtml(title)}</b><small>${escapeHtml(subtitle)}</small>`;
  marker.addEventListener("click", () => {
    marker.classList.toggle("is-open");
    if (typeof onClick === "function") onClick();
  });
  return marker;
}

function projectToMap(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const x = ((lng - ALGARVE_BOUNDS.minLng) / (ALGARVE_BOUNDS.maxLng - ALGARVE_BOUNDS.minLng)) * 100;
  const y = ((ALGARVE_BOUNDS.maxLat - lat) / (ALGARVE_BOUNDS.maxLat - ALGARVE_BOUNDS.minLat)) * 100;
  return {
    x: Math.max(4, Math.min(96, x)),
    y: Math.max(7, Math.min(92, y)),
  };
}

function renderInspector() {
  if (!activePanel) return;

  const title = document.getElementById("liveInspectorTitle");
  const hint = document.getElementById("liveInspectorHint");
  const list = document.getElementById("liveInspectorList");
  if (!title || !hint || !list) return;

  if (activePanel === "technicians") {
    title.textContent = "Tecnicos em operacao";
    hint.textContent = "Seleciona um tecnico para ver localizacao, viatura e servico atual/proximo.";
    renderInspectorList(list, allTechnicians, technicianCardHtml);
    return;
  }

  if (activePanel === "gps") {
    const gpsRows = allTechnicians.filter((tech) =>
      hasCoordinate(tech.latitude, tech.longitude) && tech.gpsActive !== false
    );
    title.textContent = "GPS ativos";
    hint.textContent = "Tecnicos com posicao valida e recente no terreno.";
    renderInspectorList(list, gpsRows, technicianCardHtml);
    return;
  }

  title.textContent = "Alertas no mapa";
  hint.textContent = "Seleciona um alerta para focar a piscina/local associado.";
  renderInspectorList(list, liveAlerts, alertCardHtml);
}

function renderInspectorList(list, rows, renderCard) {
  if (!rows.length) {
    list.innerHTML = '<div class="live-empty">Sem registos para mostrar neste momento.</div>';
    return;
  }

  list.innerHTML = rows.map(renderCard).join("");
  list.querySelectorAll("[data-tech-id]").forEach((button) => {
    button.addEventListener("click", () => selectTechnician(button.dataset.techId));
  });
  list.querySelectorAll("[data-alert-id]").forEach((button) => {
    button.addEventListener("click", () => selectAlert(button.dataset.alertId));
  });
}

function technicianCardHtml(tech) {
  const key = `tech-${tech.id}`;
  const tone = tech.status === "BUSY" ? "warn" : tech.gpsActive ? "ok" : "bad";
  const label = tech.status === "BUSY" ? "Em servico" : tech.gpsActive ? "GPS ativo" : "Sem GPS";
  const vehicle = tech.vehicle?.plate ? `Viatura ${tech.vehicle.plate}` : "Sem viatura indicada";
  const lastGps = tech.updatedAt ? `GPS: ${formatDateTime(tech.updatedAt)}` : "Sem ultima posicao";
  const location = hasCoordinate(tech.latitude, tech.longitude)
    ? `${formatCoord(tech.latitude)}, ${formatCoord(tech.longitude)}`
    : serviceLocationText(tech.currentVisit || tech.nextVisit) || "Localizacao indisponivel";

  return `
    <button class="live-card ${selectedEntityKey === key ? "active" : ""}" type="button" data-tech-id="${escapeHtml(tech.id)}">
      <div class="live-card-top">
        <b>${escapeHtml(tech.name || "Tecnico")}</b>
        <span class="live-pill ${tone}">${label}</span>
      </div>
      <small>${escapeHtml(tech.actionText || "Sem atividade em curso")}</small>
      <small>${escapeHtml(vehicle)} · ${escapeHtml(lastGps)}</small>
      <small>${escapeHtml(location)}</small>
    </button>
  `;
}

function alertCardHtml(alert) {
  const key = `alert-${alert.id}`;
  const priority = String(alert.priority || alert.severity || "").toUpperCase();
  const tone = priority === "CRITICAL" || priority === "HIGH" ? "bad" : "warn";
  const label = priority === "CRITICAL" || priority === "HIGH" ? "Critico" : "Alerta";
  const location = alertLocationText(alert) || "Sem coordenadas associadas";

  return `
    <button class="live-card ${selectedEntityKey === key ? "active" : ""}" type="button" data-alert-id="${escapeHtml(alert.id)}">
      <div class="live-card-top">
        <b>${escapeHtml(alert.title || alert.type || "Alerta")}</b>
        <span class="live-pill ${tone}">${label}</span>
      </div>
      <small>${escapeHtml(alert.message || "Alerta operacional")}</small>
      <small>${escapeHtml(location)}</small>
    </button>
  `;
}

function selectTechnician(id) {
  const tech = allTechnicians.find((item) => String(item.id) === String(id));
  if (!tech) return;
  selectedEntityKey = `tech-${tech.id}`;

  const marker = technicianMarkerById.get(String(tech.id));
  if (hasCoordinate(tech.latitude, tech.longitude)) {
    focusMapPoint(tech.latitude, tech.longitude, marker, 16);
  } else {
    const visit = tech.currentVisit || tech.nextVisit;
    const pool = visit?.pool || null;
    if (hasCoordinate(pool?.latitude, pool?.longitude)) {
      focusMapPoint(pool.latitude, pool.longitude, null, 15);
    }
  }

  renderInspector();
}

function selectAlert(id) {
  const alert = liveAlerts.find((item) => String(item.id) === String(id));
  if (!alert) return;
  selectedEntityKey = `alert-${alert.id}`;
  const coords = alertCoordinates(alert);
  const marker = alertMarkerById.get(String(alert.id));

  if (coords && hasCoordinate(coords.latitude, coords.longitude)) {
    focusMapPoint(coords.latitude, coords.longitude, marker, 16);
  } else if (alert.href) {
    window.location.href = alert.href;
  }

  renderInspector();
}

function focusMapPoint(latitude, longitude, marker, zoom = 15) {
  if (mapMode === "leaflet" && liveMap) {
    liveMap.setView([Number(latitude), Number(longitude)], zoom);
    if (marker) {
      try {
        if (clusterGroup?.hasLayer?.(marker) && clusterGroup?.zoomToShowLayer) {
          clusterGroup.zoomToShowLayer(marker, () => marker.openPopup && marker.openPopup());
        } else if (marker.openPopup) {
          marker.openPopup();
        }
      } catch (_) {
        if (marker.openPopup) marker.openPopup();
      }
    }
    return;
  }

  if (marker?.classList) {
    marker.classList.add("is-open");
    marker.scrollIntoView({ block: "center", inline: "center" });
  }
}

function technicianPopupHtml(tech) {
  return `
    <div>
      <b>${escapeHtml(tech.name || "Tecnico")}</b><br>
      Estado: ${escapeHtml(tech.status || "OFFLINE")}<br>
      Agora: ${escapeHtml(tech.actionText || "Sem atividade")}<br>
      Viatura: ${escapeHtml(tech.vehicle?.plate || "nao indicada")}<br>
      Ultimo GPS: ${escapeHtml(tech.updatedAt ? formatDateTime(tech.updatedAt) : "sem registo")}<br>
      Coordenadas: ${formatCoord(tech.latitude)}, ${formatCoord(tech.longitude)}
    </div>
  `;
}

function alertPopupHtml(alert) {
  return `
    <div>
      <b>${escapeHtml(alert.title || alert.type || "Alerta")}</b><br>
      ${escapeHtml(alert.message || "Alerta operacional")}<br>
      Local: ${escapeHtml(alertLocationText(alert) || "sem localizacao")}<br>
      <a href="${escapeHtml(alert.href || "/admin-alerts")}">Abrir detalhe</a>
    </div>
  `;
}

function alertCoordinates(alert) {
  const pool = alert?.pool || {};
  const latitude = pool.latitude ?? alert.latitude ?? alert.metadata?.latitude;
  const longitude = pool.longitude ?? alert.longitude ?? alert.metadata?.longitude;
  if (!hasCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function alertLocationText(alert) {
  const pool = alert?.pool || {};
  return [
    pool.name || alert.poolName,
    alert.clientName || pool.client?.name,
    pool.address || pool.zone,
  ].filter(Boolean).join(" - ");
}

function serviceLocationText(visit) {
  const pool = visit?.pool || {};
  return [
    pool.name,
    visit?.client?.name,
    pool.address || pool.zone,
  ].filter(Boolean).join(" - ");
}

function renderSidebar(technicians) {
  const box = document.getElementById("techList");
  if (!box) return;

  box.innerHTML = "";

  if (!technicians.length) {
    box.innerHTML = `<div class="empty">Sem tecnicos ativos</div>`;
    return;
  }

  technicians.forEach((tech) => {
    const div = document.createElement("div");
    div.className = "tech-card";
    div.innerHTML = `
      <div class="name">${escapeHtml(tech.name || "Tecnico")}</div>
      <div>ID: ${escapeHtml(tech.id)}</div>
      <div class="muted">Lat: ${formatCoord(tech.latitude)}</div>
      <div class="muted">Lng: ${formatCoord(tech.longitude)}</div>
    `;

    div.addEventListener("click", () => {
      if (mapMode === "leaflet" && liveMap) {
        liveMap.setView([Number(tech.latitude), Number(tech.longitude)], 16);
      }
    });

    box.appendChild(div);
  });
}

function clearMarkers() {
  if (mapMode === "leaflet" && clusterGroup) {
    markers.forEach((m) => clusterGroup.removeLayer(m));
  } else {
    markers.forEach((m) => m.remove());
  }
  markers = [];
  technicianMarkerById.clear();
}

function clearAlertMarkers() {
  if (mapMode === "leaflet" && liveMap) {
    alertMarkers.forEach((m) => liveMap.removeLayer(m));
  } else {
    alertMarkers.forEach((m) => m.remove());
  }
  alertMarkers = [];
  alertMarkerById.clear();
}

adminSocket.on("gps-update", () => {
  loadLiveMap();
});

adminSocket.on("new-notification", () => {
  loadCriticalAlerts();
});

function ensureFallbackStyles() {
  if (document.getElementById("cw-live-map-fallback-style")) return;

  const style = document.createElement("style");
  style.id = "cw-live-map-fallback-style";
  style.textContent = `
    #map.cw-static-map{
      position:relative;
      min-height:620px;
      overflow:hidden;
      background:#083352;
      border-top:3px solid #1da2ff;
      isolation:isolate;
    }
    .cw-map-sky{
      position:absolute;
      inset:0;
      background:
        radial-gradient(circle at 14% 18%,rgba(53,217,255,.20),transparent 28%),
        radial-gradient(circle at 82% 18%,rgba(64,230,160,.12),transparent 24%),
        linear-gradient(180deg,#0c4672,#08253f 68%,#061c31);
      z-index:0;
    }
    .cw-map-base,.cw-map-grid,.cw-map-marker-layer,.cw-map-empty,.cw-map-label{position:absolute}
    .cw-map-base{inset:0;width:100%;height:100%;z-index:1}
    .cw-map-grid{
      inset:0;
      z-index:2;
      pointer-events:none;
      background-image:
        linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);
      background-size:64px 64px;
      mask-image:linear-gradient(to bottom,rgba(0,0,0,.72),rgba(0,0,0,.12));
    }
    .cw-map-label{
      z-index:3;
      color:#dff7ff;
      font-size:12px;
      font-weight:900;
      text-shadow:0 2px 8px rgba(0,0,0,.8);
      letter-spacing:.02em;
      pointer-events:none;
    }
    .cw-map-marker-layer{inset:0;z-index:5}
    .cw-map-empty{
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      z-index:4;
      width:min(360px,calc(100% - 42px));
      padding:16px;
      border-radius:18px;
      background:rgba(5,18,32,.76);
      border:1px solid rgba(125,211,252,.28);
      box-shadow:0 24px 70px rgba(0,0,0,.38);
      backdrop-filter:blur(10px);
      text-align:center;
    }
    .cw-map-empty[hidden]{display:none}
    .cw-map-empty strong{display:block;font-size:17px;margin-bottom:7px;color:#eaf7ff}
    .cw-map-empty span{display:block;color:#9fc3dc;font-size:13px;line-height:1.4}
    .cw-map-pin{
      position:absolute;
      transform:translate(-50%,-50%);
      z-index:8;
      border:0;
      background:transparent!important;
      color:#eaf7ff!important;
      padding:0!important;
      box-shadow:none!important;
      cursor:pointer;
      min-height:0!important;
    }
    .cw-map-pin span{
      display:block;
      width:22px;
      height:22px;
      border-radius:999px;
      background:var(--pin,#40e6a0);
      border:3px solid #fff;
      box-shadow:0 0 0 7px color-mix(in srgb,var(--pin,#40e6a0) 22%,transparent),0 10px 30px rgba(0,0,0,.38);
    }
    .cw-map-pin-alert span{animation:cwMapPulse 1.4s infinite}
    .cw-map-pin b,.cw-map-pin small{
      display:none;
      position:absolute;
      left:50%;
      transform:translateX(-50%);
      width:max-content;
      max-width:230px;
      background:rgba(5,18,32,.96);
      border:1px solid rgba(125,211,252,.32);
      box-shadow:0 18px 48px rgba(0,0,0,.42);
    }
    .cw-map-pin b{
      bottom:30px;
      padding:9px 10px 4px;
      border-radius:13px 13px 0 0;
      font-size:13px;
      color:#fff;
    }
    .cw-map-pin small{
      top:-3px;
      padding:4px 10px 9px;
      border-top:0;
      border-radius:0 0 13px 13px;
      color:#a9cbe1;
      font-size:12px;
      white-space:normal;
    }
    .cw-map-pin:hover b,.cw-map-pin:hover small,.cw-map-pin.is-open b,.cw-map-pin.is-open small{display:block}
    @keyframes cwMapPulse{
      0%{box-shadow:0 0 0 4px rgba(255,107,107,.30),0 10px 30px rgba(0,0,0,.38)}
      70%{box-shadow:0 0 0 18px rgba(255,107,107,0),0 10px 30px rgba(0,0,0,.38)}
      100%{box-shadow:0 0 0 4px rgba(255,107,107,0),0 10px 30px rgba(0,0,0,.38)}
    }
    @media(max-width:700px){
      #map.cw-static-map{min-height:560px}
      .cw-map-label{font-size:11px}
      .cw-map-empty{top:44%}
    }
  `;

  document.head.appendChild(style);
}

function showFallbackMessage(message) {
  if (!fallbackEmptyState) return;
  fallbackEmptyState.hidden = false;
  fallbackEmptyState.innerHTML = `<strong>Mapa operacional ativo</strong><span>${escapeHtml(message)}</span>`;
}

function technicianColor(tech) {
  if (tech.status === "ALERT") return "#c62828";
  if (tech.status === "BUSY") return "#ef6c00";
  return "#2e7d32";
}

function hasCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001;
}

function formatCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(5) : "--";
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
