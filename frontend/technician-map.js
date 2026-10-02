// Presentation entries belong only to this map producer; received data stays literal.
const mapUi = (() => {
  const languages = ['pt','en','fr','es','de'];
  const copy = {
  "title": [
    "Cristal Water - Mapa Tecnico",
    "Cristal Water - Technician Map",
    "Cristal Water - Carte du technicien",
    "Cristal Water - Mapa del técnico",
    "Cristal Water - Technikerkarte"
  ],
  "round": [
    "Ronda tecnica",
    "Technician round",
    "Tournée du technicien",
    "Ronda técnica",
    "Technikerrunde"
  ],
  "heading": [
    "Mapa do Dia",
    "Today’s Map",
    "Carte du jour",
    "Mapa del día",
    "Tageskarte"
  ],
  "intro": [
    "Navegacao simples com foco em leitura rapida e orientacao no terreno.",
    "Simple navigation for quick reading and guidance in the field.",
    "Navigation simple pour une lecture rapide et une orientation sur le terrain.",
    "Navegación sencilla para una lectura rápida y orientación en el terreno.",
    "Einfache Navigation für einen schnellen Überblick und Orientierung vor Ort."
  ],
  "preparing": [
    "A preparar mapa.",
    "Preparing map.",
    "Préparation de la carte.",
    "Preparando el mapa.",
    "Karte wird vorbereitet."
  ],
  "mapAria": [
    "Mapa tecnico",
    "Technician map",
    "Carte du technicien",
    "Mapa del técnico",
    "Technikerkarte"
  ],
  "return": [
    "Voltar ao Centro",
    "Back to Field Centre",
    "Retour au centre terrain",
    "Volver al centro de campo",
    "Zurück zur Außendienstzentrale"
  ],
  "reload": [
    "Carregar ronda",
    "Load round",
    "Charger la tournée",
    "Cargar ronda",
    "Runde laden"
  ],
  "next": [
    "Proxima piscina",
    "Next pool",
    "Piscine suivante",
    "Siguiente piscina",
    "Nächster Pool"
  ],
  "empty": [
    "Sem visitas para hoje.",
    "No visits for today.",
    "Aucune visite aujourd’hui.",
    "No hay visitas para hoy.",
    "Keine Besuche für heute."
  ],
  "noSelected": [
    "Sem piscina selecionada.",
    "No pool selected.",
    "Aucune piscine sélectionnée.",
    "No hay piscina seleccionada.",
    "Kein Pool ausgewählt."
  ],
  "pool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ],
  "client": [
    "Cliente",
    "Client",
    "Client",
    "Cliente",
    "Kunde"
  ],
  "location": [
    "Local por confirmar",
    "Location to confirm",
    "Lieu à confirmer",
    "Ubicación por confirmar",
    "Ort noch zu bestätigen"
  ],
  "noTime": [
    "Sem hora",
    "No time",
    "Sans heure",
    "Sin hora",
    "Keine Uhrzeit"
  ],
  "removed": [
    "Retirada da ronda",
    "Removed from the round",
    "Retirée de la tournée",
    "Retirada de la ronda",
    "Aus der Runde entfernt"
  ],
  "done": [
    "Concluída",
    "Completed",
    "Terminée",
    "Completada",
    "Abgeschlossen"
  ],
  "incomplete": [
    "Por terminar",
    "Unfinished",
    "À terminer",
    "Por terminar",
    "Noch offen"
  ],
  "inProgress": [
    "Em intervenção",
    "In progress",
    "En cours",
    "En curso",
    "In Arbeit"
  ],
  "todo": [
    "Por fazer",
    "To do",
    "À faire",
    "Por hacer",
    "Zu erledigen"
  ],
  "gpsMissing": [
    " · GPS por confirmar",
    " · GPS to confirm",
    " · GPS à confirmer",
    " · GPS por confirmar",
    " · GPS noch zu bestätigen"
  ],
  "numberedPool": [
    "{number}. {pool}",
    "{number}. {pool}",
    "{number}. {pool}",
    "{number}. {pool}",
    "{number}. {pool}"
  ],
  "stateGps": [
    "{state}{gps}",
    "{state}{gps}",
    "{state}{gps}",
    "{state}{gps}",
    "{state}{gps}"
  ],
  "clientLine": [
    "Cliente: {client}",
    "Client: {client}",
    "Client : {client}",
    "Cliente: {client}",
    "Kunde: {client}"
  ],
  "locationLine": [
    "Local: {location}",
    "Location: {location}",
    "Lieu : {location}",
    "Ubicación: {location}",
    "Ort: {location}"
  ],
  "timeLine": [
    "Hora: {time}",
    "Time: {time}",
    "Heure : {time}",
    "Hora: {time}",
    "Uhrzeit: {time}"
  ],
  "statusLine": [
    "Estado: {state}",
    "Status: {state}",
    "Statut : {state}",
    "Estado: {state}",
    "Status: {state}"
  ],
  "noOther": [
    "Não há outra visita pendente nesta ronda.",
    "There is no other pending visit in this round.",
    "Il n’y a pas d’autre visite en attente dans cette tournée.",
    "No hay otra visita pendiente en esta ronda.",
    "Es gibt keinen weiteren offenen Besuch in dieser Runde."
  ],
  "missingTech": [
    "Sessao tecnica sem tecnico associado.",
    "No technician is associated with this session.",
    "Aucun technicien n’est associé à cette session.",
    "No hay ningún técnico asociado a esta sesión.",
    "Dieser Sitzung ist kein Techniker zugeordnet."
  ],
  "loading": [
    "A carregar ronda do dia.",
    "Loading today’s round.",
    "Chargement de la tournée du jour.",
    "Cargando la ronda del día.",
    "Tagesrunde wird geladen."
  ],
  "summary": [
    "{pending} por terminar · {closed} concluídas ou retiradas.{provider}",
    "{pending} unfinished · {closed} completed or removed.{provider}",
    "{pending} à terminer · {closed} terminées ou retirées.{provider}",
    "{pending} por terminar · {closed} completadas o retiradas.{provider}",
    "{pending} offen · {closed} abgeschlossen oder aus der Runde entfernt.{provider}"
  ],
  "providerUnavailable": [
    " Mapa indisponível; use a lista e a navegação.",
    " Map unavailable; use the list and navigation.",
    " Carte indisponible ; utilisez la liste et la navigation.",
    " Mapa no disponible; usa la lista y la navegación.",
    " Karte nicht verfügbar; nutzen Sie die Liste und die Navigation."
  ],
  "failed": [
    "Não foi possível atualizar a ronda. Verifique a ligação e tente novamente.",
    "Could not refresh the round. Check your connection and try again.",
    "Impossible d’actualiser la tournée. Vérifiez votre connexion et réessayez.",
    "No se pudo actualizar la ronda. Comprueba la conexión e inténtalo de nuevo.",
    "Runde konnte nicht aktualisiert werden. Prüfen Sie die Verbindung und versuchen Sie es erneut."
  ],
  "accountChanged": [
    "A sessão mudou. Atualize a ronda com a conta atual.",
    "The session changed. Refresh the round with the current account.",
    "La session a changé. Actualisez la tournée avec le compte actuel.",
    "La sesión ha cambiado. Actualiza la ronda con la cuenta actual.",
    "Die Sitzung hat sich geändert. Aktualisieren Sie die Runde mit dem aktuellen Konto."
  ],
  "unavailable": [
    "Não foi possível carregar a ronda. Atualize para tentar novamente.",
    "Could not load the round. Refresh to try again.",
    "Impossible de charger la tournée. Actualisez pour réessayer.",
    "No se pudo cargar la ronda. Actualiza para volver a intentarlo.",
    "Runde konnte nicht geladen werden. Aktualisieren Sie, um es erneut zu versuchen."
  ]
};
  const entries=new WeakSet(),bindings=new Map(),attributes=new Map(),popupRoots=new WeakSet();
  const value=(key,params={})=>{const entry=Object.freeze({key,params:Object.freeze({...params})});entries.add(entry);return entry;};
  function text(entry,language=document.documentElement.lang||'pt') {
    if (!entry || typeof entry!=='object' || !entries.has(entry)) return String(entry??'');
    const index=Math.max(0,languages.indexOf(String(language).toLowerCase().split('-')[0]));
    return copy[entry.key][index].replace(/\{(\w+)\}/g,(_,key)=>text(entry.params[key],language));
  }
  function clearTree(root) { if(root)for(const node of bindings.keys())if(root.contains(node))bindings.delete(node); }
  function bind(node,entry,popup=null) {
    if(!node)return;
    if(!entry||typeof entry!=='object'||!entries.has(entry)){bindings.delete(node);return;}
    const rendered=text(entry);
    if(node.textContent!==rendered){if(node.childNodes.length===1&&node.firstChild.nodeType===Node.TEXT_NODE)node.firstChild.nodeValue=rendered;else node.textContent=rendered;}
    bindings.set(node,{entry,rendered,textNode:node.firstChild,parent:node.parentNode,popup});
  }
  function bindAttribute(node,name,entry) {
    if(!node)return;const rendered=text(entry);node.setAttribute(name,rendered);
    attributes.set(node,{name,entry,rendered,parent:node.parentNode});
  }
  function paint() {
    for(const [node,leaf] of bindings){
      const ownedPopup=leaf.popup&&popupRoots.has(leaf.popup)&&leaf.popup.contains(node);
      if((!node.isConnected&&!ownedPopup)||node.parentNode!==leaf.parent||node.childNodes.length!==1||node.firstChild!==leaf.textNode||leaf.textNode.nodeValue!==leaf.rendered){bindings.delete(node);continue;}
      const rendered=text(leaf.entry);if(rendered!==leaf.rendered)leaf.textNode.nodeValue=rendered;leaf.rendered=rendered;
    }
    for(const [node,leaf] of attributes){
      if(!node.isConnected||node.parentNode!==leaf.parent||node.getAttribute(leaf.name)!==leaf.rendered){attributes.delete(node);continue;}
      const rendered=text(leaf.entry);if(rendered!==leaf.rendered)node.setAttribute(leaf.name,rendered);leaf.rendered=rendered;
    }
  }
  const shell=document.querySelector('main.map-shell');if(shell){shell.dataset.cwNoI18n='';shell.dataset.cwStateManaged='manual';}
  const labels=[['title','Cristal Water - Mapa Tecnico','title'],['.map-top .map-muted','Ronda tecnica','round'],['.map-title','Mapa do Dia','heading'],['.map-top .map-muted:nth-of-type(2)','Navegacao simples com foco em leitura rapida e orientacao no terreno.','intro'],['#statusBox','A preparar mapa.','preparing'],['#returnFieldBtn','Voltar ao Centro','return'],['#loadBtn','Carregar ronda','reload'],['#nextBtn','Proxima piscina','next'],['#infoBox','Sem piscina selecionada.','noSelected']];
  for(const [selector,original,key] of labels){const node=document.querySelector(selector);if(!node||node.childNodes.length!==1||node.firstChild.nodeType!==Node.TEXT_NODE||node.textContent!==original)continue;node.dataset.cwNoI18n='';bind(node,value(key));}
  const mapNode=document.getElementById('map');if(mapNode?.getAttribute('aria-label')==='Mapa tecnico')bindAttribute(mapNode,'aria-label',value('mapAria'));
  for(const selector of ['#statusBox','#infoBox']){const node=document.querySelector(selector);if(node){node.style.minWidth='0';node.style.overflowWrap='anywhere';}}
  const errorStyle=document.createElement('style');errorStyle.textContent='main.map-shell #visitList > .empty[data-cw-state="error"]::before{content:none;display:none;}';document.head.appendChild(errorStyle);
  window.addEventListener('cw-language-change',paint);
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  function languageReady(){const language=new URLSearchParams(location.search).get('lang');if(languages.includes(language))window.CristalI18n?.applyLanguage(language);paint();}
  if(window.CristalI18n)languageReady();else{
    let script=document.querySelector('script[src="/cw-i18n.js"]');
    if(!script){script=document.createElement('script');script.src='/cw-i18n.js';script.defer=true;script.addEventListener('load',languageReady,{once:true});document.head.appendChild(script);}
    else script.addEventListener('load',languageReady,{once:true});
  }
  return {value,text,bind,clearTree,isKey:(entry,key)=>!!entry&&typeof entry==='object'&&entries.has(entry)&&entry.key===key,ownPopup:root=>popupRoots.add(root),releasePopup:root=>{clearTree(root);popupRoots.delete(root);}};
})();

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
let popupCopies = [];

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
  mapUi.clearTree(statusBox);
  statusBox.textContent = mapUi.text(message);
  mapUi.bind(statusBox,message);
  statusBox.setAttribute('role',tone==='error'?'alert':'status');
  statusBox.setAttribute('aria-live',tone==='error'?'assertive':'polite');
  statusBox.dataset.cwState=tone==='error'?'error':mapUi.isKey(message,'loading')?'loading':mapUi.isKey(message,'empty')?'empty':tone==='warning'?'warning':'success';
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
  popupCopies.forEach(root=>mapUi.releasePopup(root));popupCopies=[];
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
    const popup=document.createElement('div'),poolEntry=mapUi.value('numberedPool',{number:index+1,pool:visit.pool?.name||mapUi.value('pool')}),stateEntry=visitStateEntry(visit);
    popup.style.overflowWrap='anywhere';popup.innerHTML=`<b>${escapeHtml(mapUi.text(poolEntry))}</b><br><span>${escapeHtml(mapUi.text(stateEntry))}</span>`;
    mapUi.ownPopup(popup);mapUi.bind(popup.querySelector('b'),poolEntry,popup);mapUi.bind(popup.querySelector('span'),stateEntry,popup);popupCopies.push(popup);
    marker.bindPopup(popup);
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
function visitStateEntry(visit) {
  const keys={'Retirada da ronda':'removed','Concluída':'done','Por terminar':'incomplete','Em intervenção':'inProgress','Por fazer':'todo'};
  return mapUi.value(keys[visitState(visit)]);
}
function renderList(unavailable = false) {
  if (!visitList) return;
  mapUi.clearTree(visitList);
  if (!route.length) {
    const entry=mapUi.value(unavailable?'unavailable':'empty');
    visitList.innerHTML=`<div class="empty" role="status" aria-live="polite" data-cw-state="${unavailable?'error':'empty'}">${escapeHtml(mapUi.text(entry))}</div>`;
    mapUi.bind(visitList.firstElementChild,entry);
    return;
  }
  const entries=route.map((visit,index)=>({pool:mapUi.value('numberedPool',{number:index+1,pool:visit.pool?.name||mapUi.value('pool')}),state:mapUi.value('stateGps',{state:visitStateEntry(visit),gps:visitCoordinates(visit).lat==null||visitCoordinates(visit).lng==null?mapUi.value('gpsMissing'):''}),client:visit.client?.name||mapUi.value('client'),location:visit.pool?.location||visit.pool?.address||mapUi.value('location')}));
  visitList.innerHTML = route.map((visit, index) => {
    const cls = index === currentIndex ? "visit-item active" : "visit-item";
    const entry=entries[index];
    return `
      <button type="button" class="${cls}" data-index="${index}" style="color:#102620;">
        <b>${escapeHtml(mapUi.text(entry.pool))}</b>
        <small>${escapeHtml(mapUi.text(entry.state))}</small>
        <small>${escapeHtml(mapUi.text(entry.client))}</small>
        <small>${escapeHtml(mapUi.text(entry.location))}</small>
      </button>
    `;
  }).join("");
  visitList.querySelectorAll("button[data-index]").forEach((button,index) => {
    const entry=entries[index],small=button.querySelectorAll('small');
    mapUi.bind(button.querySelector('b'),entry.pool);mapUi.bind(small[0],entry.state);mapUi.bind(small[1],entry.client);mapUi.bind(small[2],entry.location);
    button.addEventListener("click", () => {
      setCurrent(Number(button.dataset.index || 0));
    });
  });
}

function updateInfo() {
  const visit = route[currentIndex];
  if(nextBtn)nextBtn.disabled=!route.some((item,index)=>index!==currentIndex&&!isClosed(item));
  mapUi.clearTree(infoBox);
  if (!visit) {
    const entry=mapUi.value('noSelected');infoBox.textContent=mapUi.text(entry);mapUi.bind(infoBox,entry);
    setNavigationLinks(null);
    return;
  }
  const when = visit.plannedDate || visit.startAt || visit.date;
  const whenLabel = when ? new Date(when).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : mapUi.value('noTime');
  const location = visit.pool?.location || visit.pool?.address || mapUi.value('location');
  const pool=visit.pool?.name||mapUi.value('pool'),entries=[mapUi.value('clientLine',{client:visit.client?.name||mapUi.value('client')}),mapUi.value('locationLine',{location}),mapUi.value('timeLine',{time:whenLabel}),mapUi.value('statusLine',{state:visitStateEntry(visit)})];
  infoBox.innerHTML=`<b>${escapeHtml(mapUi.text(pool))}</b><br>`+entries.map(entry=>`<span>${escapeHtml(mapUi.text(entry))}</span>`).join('<br>');
  mapUi.bind(infoBox.querySelector('b'),pool);infoBox.querySelectorAll('span').forEach((node,index)=>mapUi.bind(node,entries[index]));
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
  setStatus(mapUi.value('noOther'));
}

async function loadToday() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  const id = technicianId(), token=window.CristalAuth.getToken(),version=++loadVersion;
  const current=()=>version===loadVersion&&technicianId()===id&&window.CristalAuth.getToken()===token;
  if (!id) {
    setStatus(mapUi.value("missingTech"), "error");
    route = [];
    renderList(true);
    updateInfo();
    return;
  }

  if (loadBtn) loadBtn.disabled = true;
  setStatus(mapUi.value("loading"));

  try {
    const data = await parseResponse(await fetch(`${API}/technician/today?technicianId=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}}));
    if(!current())return;
    const selected=route[currentIndex]?.id||returnContextFromUrl().selectedVisitId;
    const selectedType=route[currentIndex]?.visitType || (route[currentIndex] ? 'REGULAR' : returnContextFromUrl().selectedVisitType);
    if(data.ok===false||data.complete!==true||!Array.isArray(data.visits)||data.total!==data.visits.length)throw Error('A resposta não confirma a ronda completa. Atualize antes de navegar.');
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
    setStatus(route.length ? mapUi.value("summary",{pending,closed:route.length-pending,provider:!map?mapUi.value("providerUnavailable"):""}) : mapUi.value("empty"), route.length ? "" : "warning");
  } catch (error) {
    if(!current())return;
    route = [];
    clearMarkers();
    renderList(true);
    updateInfo();
    setStatus(mapUi.value("failed"), "error");
  } finally {
    if(version===loadVersion&&!current())clearAccountMap();
    if (loadBtn && version===loadVersion) loadBtn.disabled = false;
  }
}

if (loadBtn) loadBtn.addEventListener("click", loadToday);
if (nextBtn) nextBtn.addEventListener("click", nextPool);
setupReturnButton();

function clearAccountMap(){loadVersion++;route=[];clearMarkers();renderList(true);updateInfo();if(loadBtn)loadBtn.disabled=false;setStatus(mapUi.value('accountChanged'),'warning');}
window.addEventListener('storage',event=>{if(['token','cristalwater_jwt','user','cristalwater_user'].includes(event.key)||event.key===null)clearAccountMap();});
window.addEventListener('cw:session-expired',clearAccountMap);
window.loadToday = loadToday;
window.nextPool = nextPool;

loadToday();
