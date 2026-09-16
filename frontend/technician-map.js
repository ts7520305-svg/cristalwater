const API = "/api";

const loadBtn = document.getElementById("loadBtn");
const nextBtn = document.getElementById("nextBtn");
const returnFieldBtn = document.getElementById("returnFieldBtn");
const statusBox = document.getElementById("statusBox");
const infoBox = document.getElementById("infoBox");
const visitList = document.getElementById("visitList");
const googleLink = document.getElementById("googleLink");
const wazeLink = document.getElementById("wazeLink");

const RETURN_FALLBACK = "/technician-field-mode";

let route = [];
let currentIndex = 0;
let map = null;
let markers = new Map();
let loadVersion = 0;
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

function normalizeTab(value) {
  const safe = String(value || "").toLowerCase();
  return ["hoje", "agora", "docs", "more"].includes(safe) ? safe : "hoje";
}

function normalizeFilter(value) {
  const safe = String(value || "").toUpperCase();
  return ["TODO", "IN_PROGRESS", "DONE"].includes(safe) ? safe : "TODO";
}

function sanitizeReturnTo(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("/")) return RETURN_FALLBACK;
  if (!text.startsWith("/technician-field-mode")) return RETURN_FALLBACK;
  return text;
}

function returnContextFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    returnTo: sanitizeReturnTo(params.get("returnTo") || RETURN_FALLBACK),
    activeTab: normalizeTab(params.get("activeTab")),
    activeFilter: normalizeFilter(params.get("activeFilter")),
    selectedVisitId: String(params.get("selectedVisitId") || ""),
    selectedVisitType: String(params.get('selectedVisitType') || ''),
    scrollY: Number.isFinite(Number(params.get("scrollY"))) ? Math.max(0, Number(params.get("scrollY"))) : 0,
  };
}

function returnUrlWithContext() {
  const context = returnContextFromUrl();
  const target = new URL(context.returnTo, window.location.origin);
  target.searchParams.set("activeTab", context.activeTab);
  target.searchParams.set("activeFilter", context.activeFilter);
  const selected=route[currentIndex]?.id||context.selectedVisitId;
  if (selected) target.searchParams.set("selectedVisitId", selected);
  const type=route[currentIndex]?.visitType || (route[currentIndex] ? 'REGULAR' : context.selectedVisitType);
  if(type)target.searchParams.set('selectedVisitType',type);
  if (context.scrollY > 0) target.searchParams.set("scrollY", String(context.scrollY));
  return `${target.pathname}${target.search}${target.hash}`;
}

function setupReturnButton() {
  if (!returnFieldBtn) return;
  returnFieldBtn.addEventListener("click", () => {
    window.location.href = returnUrlWithContext();
  });
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
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (type === "lat" && (number < -90 || number > 90)) return null;
  if (type === "lng" && (number < -180 || number > 180)) return null;
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
  markers.forEach((marker) => marker.remove());
  markers = new Map();
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
    marker.bindPopup(`<b>${index+1}. ${escapeHtml(visit.pool?.name || "Piscina")}</b><br>${escapeHtml(visitState(visit))}`);
    marker.bindTooltip(String(index+1), {permanent:true, direction:'top'});
    marker.on("click", () => setCurrent(index));
    markers.set(index, marker);
    bounds.push([lat, lng]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [24, 24] });
  }
}

function setNavigationLinks(visit) {
  const { lat, lng } = visitCoordinates(visit || {});
  if (lat == null || lng == null) {
    for (const link of [googleLink,wazeLink]) { link.removeAttribute('href');link.setAttribute('aria-disabled','true'); }
    const address=visit?.pool?.address||visit?.pool?.location;
    if(address){googleLink.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;googleLink.removeAttribute('aria-disabled');}
    return;
  }

  for (const link of [googleLink,wazeLink]) link.removeAttribute('aria-disabled');
  googleLink.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  wazeLink.href = `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`;
}

function isClosed(visit) {
  return Boolean(visit?.endAt)||['DONE','COMPLETED','CONCLUIDA','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(String(visit?.status||'').toUpperCase());
}
function visitState(visit) {
  if(['CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(String(visit?.status||'').toUpperCase()))return 'Retirada da ronda';
  if(isClosed(visit))return 'Concluída';
  if(visit?.status==='INCOMPLETE')return 'Por terminar';
  return visit?.startAt||['IN_PROGRESS','STARTED'].includes(visit?.status)?'Em intervenção':'Por fazer';
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
        <b>${index+1}. ${escapeHtml(visit.pool?.name || "Piscina")}</b>
        <small>${escapeHtml(visitState(visit))}${visitCoordinates(visit).lat==null||visitCoordinates(visit).lng==null?' · GPS por confirmar':''}</small>
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
  if(nextBtn)nextBtn.disabled=!route.some((item,index)=>index!==currentIndex&&!isClosed(item));
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
    Hora: ${escapeHtml(whenLabel)}<br>
    Estado: ${escapeHtml(visitState(visit))}
  `;

  setNavigationLinks(visit);
  if (activeMarker) activeMarker.closePopup();
  if (markers.has(currentIndex)) {
    activeMarker = markers.get(currentIndex);
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
  for(let offset=1;offset<route.length;offset++){
    const next=(currentIndex+offset)%route.length;
    if(!isClosed(route[next])){setCurrent(next);return;}
  }
  setStatus('Não há outra visita pendente nesta ronda.');
}

async function loadToday() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  const id = technicianId(), token=window.CristalAuth.getToken(),version=++loadVersion;
  const current=()=>version===loadVersion&&technicianId()===id&&window.CristalAuth.getToken()===token;
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
    const data = await parseResponse(await fetch(`${API}/technician/today?technicianId=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}}));
    if(!current())return;
    const selected=route[currentIndex]?.id||returnContextFromUrl().selectedVisitId;
    const selectedType=route[currentIndex]?.visitType || (route[currentIndex] ? 'REGULAR' : returnContextFromUrl().selectedVisitType);
    if(data.ok===false||!Array.isArray(data.visits))throw Error('A resposta não confirma a ronda. Atualize antes de navegar.');
    route = Array.isArray(data.visits) ? data.visits : [];
    const matches=route.map((visit,index)=>({visit,index})).filter(({visit})=>String(visit.id)===String(selected)&&(!selectedType||(visit.visitType||'REGULAR')===selectedType));
    if(matches.length>1)throw Error('Há visitas de tipos diferentes com este número. Selecione a visita novamente no modo de campo.');
    if(selected&&selectedType&&!matches.length)throw Error('A visita selecionada já não consta desta ronda. Atualize o modo de campo.');
    currentIndex = matches[0]?.index ?? -1;
    if(currentIndex<0)currentIndex=Math.max(0,route.findIndex(visit=>!isClosed(visit)));

    ensureMap();
    renderMarkers();
    renderList();
    updateInfo();

    const pending=route.filter(visit=>!isClosed(visit)).length;
    setStatus(route.length ? `${pending} por terminar · ${route.length-pending} concluídas ou retiradas.${!map?' Mapa indisponível; use a lista e a navegação.':''}` : "Sem visitas para hoje.", route.length ? "" : "warning");
  } catch (error) {
    if(!current())return;
    route = [];
    clearMarkers();
    renderList();
    updateInfo();
    setStatus('Não foi possível atualizar a ronda. Verifique a ligação e tente novamente.', "error");
  } finally {
    if(version===loadVersion&&!current())clearAccountMap();
    if (loadBtn && version===loadVersion) loadBtn.disabled = false;
  }
}

if (loadBtn) loadBtn.addEventListener("click", loadToday);
if (nextBtn) nextBtn.addEventListener("click", nextPool);
setupReturnButton();

function clearAccountMap(){loadVersion++;route=[];clearMarkers();renderList();updateInfo();if(loadBtn)loadBtn.disabled=false;setStatus('A sessão mudou. Atualize a ronda com a conta atual.','warning');}
window.addEventListener('storage',event=>{if(['token','cristalwater_jwt','user','cristalwater_user'].includes(event.key)||event.key===null)clearAccountMap();});
window.addEventListener('cw:session-expired',clearAccountMap);
window.loadToday = loadToday;
window.nextPool = nextPool;

loadToday();
