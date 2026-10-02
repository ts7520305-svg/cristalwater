// Only the route producer owns these entries; received data is always literal.
const routeUi = (() => {
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
  "title": [
    "Cristal Water - Rota Tecnica",
    "Cristal Water - Technician Route",
    "Cristal Water - Itinéraire du technicien",
    "Cristal Water - Ruta del técnico",
    "Cristal Water - Technikerroute"
  ],
  "shift": [
    "Turno tecnico",
    "Technician shift",
    "Service du technicien",
    "Turno del técnico",
    "Technikerschicht"
  ],
  "heading": [
    "Rota do Dia",
    "Today’s Route",
    "Itinéraire du jour",
    "Ruta del día",
    "Tagesroute"
  ],
  "intro": [
    "Consulte a sequência de piscinas planeadas para hoje.",
    "View the sequence of pools planned for today.",
    "Consultez la liste des piscines prévues pour aujourd’hui.",
    "Consulta la secuencia de piscinas previstas para hoy.",
    "Sehen Sie die Reihenfolge der heute geplanten Pools."
  ],
  "back": [
    "Voltar",
    "Back",
    "Retour",
    "Volver",
    "Zurück"
  ],
  "refresh": [
    "Atualizar rota",
    "Refresh route",
    "Actualiser l’itinéraire",
    "Actualizar ruta",
    "Route aktualisieren"
  ],
  "field": [
    "Modo campo",
    "Field mode",
    "Mode terrain",
    "Modo de campo",
    "Außendienst"
  ],
  "planned": [
    "Piscinas planeadas",
    "Planned pools",
    "Piscines prévues",
    "Piscinas previstas",
    "Geplante Pools"
  ],
  "suggestions": [
    "Sugestoes",
    "Suggestions",
    "Suggestions",
    "Sugerencias",
    "Hinweise"
  ],
  "preparing": [
    "A preparar rota tecnica.",
    "Preparing technician route.",
    "Préparation de l’itinéraire du technicien.",
    "Preparando la ruta del técnico.",
    "Technikerroute wird vorbereitet."
  ],
  "emptyRoute": [
    "Sem rota planeada para hoje.",
    "No route planned for today.",
    "Aucun itinéraire prévu pour aujourd’hui.",
    "No hay ruta prevista para hoy.",
    "Für heute ist keine Route geplant."
  ],
  "client": [
    "Cliente {id}",
    "Client {id}",
    "Client {id}",
    "Cliente {id}",
    "Kunde {id}"
  ],
  "unnamedPool": [
    "Piscina sem nome",
    "Unnamed pool",
    "Piscine sans nom",
    "Piscina sin nombre",
    "Unbenannter Pool"
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
  "stop": [
    "Paragem {number}",
    "Stop {number}",
    "Étape {number}",
    "Parada {number}",
    "Stopp {number}"
  ],
  "locationTime": [
    "{location} · {time}",
    "{location} · {time}",
    "{location} · {time}",
    "{location} · {time}",
    "{location} · {time}"
  ],
  "emptySuggestions": [
    "Sem sugestoes para mostrar.",
    "No suggestions to show.",
    "Aucune suggestion à afficher.",
    "No hay sugerencias para mostrar.",
    "Keine Hinweise verfügbar."
  ],
  "pool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ],
  "zone": [
    "Zona {zone}",
    "Zone {zone}",
    "Zone {zone}",
    "Zona {zone}",
    "Gebiet {zone}"
  ],
  "zoneUnset": [
    "Zona por definir",
    "Zone to define",
    "Zone à définir",
    "Zona por definir",
    "Gebiet noch festzulegen"
  ],
  "traffic": [
    "Verificar transito e acessos antes de sair.",
    "Check traffic and access before leaving.",
    "Vérifiez la circulation et les accès avant de partir.",
    "Comprueba el tráfico y los accesos antes de salir.",
    "Prüfen Sie Verkehr und Zufahrt vor der Abfahrt."
  ],
  "noSuggestions": [
    "Sem dados suficientes para sugestoes automáticas.",
    "Not enough data for automatic suggestions.",
    "Données insuffisantes pour proposer des suggestions automatiques.",
    "No hay datos suficientes para sugerencias automáticas.",
    "Nicht genügend Daten für automatische Hinweise."
  ],
  "missingTech": [
    "Sessao tecnica sem tecnico associado.",
    "No technician is associated with this session.",
    "Aucun technicien n’est associé à cette session.",
    "No hay ningún técnico asociado a esta sesión.",
    "Dieser Sitzung ist kein Techniker zugeordnet."
  ],
  "missingSession": [
    "Nao foi possivel determinar o tecnico da sessao.",
    "Could not identify the session’s technician.",
    "Impossible d’identifier le technicien de la session.",
    "No se pudo identificar al técnico de la sesión.",
    "Der Techniker dieser Sitzung konnte nicht ermittelt werden."
  ],
  "loading": [
    "A carregar rota do dia.",
    "Loading today’s route.",
    "Chargement de l’itinéraire du jour.",
    "Cargando la ruta del día.",
    "Tagesroute wird geladen."
  ],
  "incomplete": [
    "A resposta não confirma a rota completa. Atualize antes de navegar.",
    "The response does not confirm the complete route. Refresh before navigating.",
    "La réponse ne confirme pas l’itinéraire complet. Actualisez avant de naviguer.",
    "La respuesta no confirma la ruta completa. Actualiza antes de navegar.",
    "Die Antwort bestätigt keine vollständige Route. Aktualisieren Sie vor der Navigation."
  ],
  "loaded": [
    "Rota carregada com {count} paragem(ns).",
    "Route loaded with {count} stop(s).",
    "Itinéraire chargé avec {count} étape(s).",
    "Ruta cargada con {count} parada(s).",
    "Route mit {count} Stopp(s) geladen."
  ],
  "noStops": [
    "Sem paragens para hoje.",
    "No stops for today.",
    "Aucune étape pour aujourd’hui.",
    "No hay paradas para hoy.",
    "Keine Stopps für heute."
  ],
  "failed": [
    "Falha ao carregar rota.",
    "Failed to load route.",
    "Échec du chargement de l’itinéraire.",
    "Error al cargar la ruta.",
    "Route konnte nicht geladen werden."
  ],
  "http": [
    "Falha HTTP {status}",
    "HTTP failure {status}",
    "Échec HTTP {status}",
    "Error HTTP {status}",
    "HTTP-Fehler {status}"
  ]
};
  const entries = new WeakSet(), bindings = new Map(), errors = new WeakMap();
  const value = (key, params = {}) => { const entry = Object.freeze({ key, params: Object.freeze({ ...params }) }); entries.add(entry); return entry; };
  function text(entry, language = document.documentElement.lang || 'pt') {
    if (!entry || typeof entry !== 'object' || !entries.has(entry)) return String(entry ?? '');
    const index = Math.max(0, languages.indexOf(String(language).toLowerCase().split('-')[0]));
    return copy[entry.key][index].replace(/\{(\w+)\}/g, (_, key) => text(entry.params[key], language));
  }
  function clearTree(root) { if (root) for (const node of bindings.keys()) if (root.contains(node)) bindings.delete(node); }
  function bind(node, entry) {
    if (!node) return;
    if (!entry || typeof entry !== 'object' || !entries.has(entry)) { bindings.delete(node); return; }
    const rendered = text(entry);
    if (node.textContent !== rendered) {
      if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) node.firstChild.nodeValue = rendered;
      else node.textContent = rendered;
    }
    bindings.set(node, { entry, rendered, textNode: node.firstChild, parent: node.parentNode });
  }
  function paint() {
    for (const [node, leaf] of bindings) {
      if (!node.isConnected || node.parentNode !== leaf.parent || node.childNodes.length !== 1 || node.firstChild !== leaf.textNode || leaf.textNode.nodeValue !== leaf.rendered) { bindings.delete(node); continue; }
      const rendered = text(leaf.entry); if (rendered !== leaf.rendered) leaf.textNode.nodeValue = rendered; leaf.rendered = rendered;
    }
  }
  // Capture each original static label once, before the first API request.
  const shell = document.querySelector('main.route-shell');
  if (shell) { shell.dataset.cwNoI18n = ''; shell.dataset.cwStateManaged = 'manual'; }
  const staticLabels = [
    ['title','Cristal Water - Rota Tecnica','title'],
    ['.route-header .route-muted','Turno tecnico','shift'],
    ['.route-title','Rota do Dia','heading'],
    ['.route-header .route-muted:nth-of-type(2)','Vista rapida da sequencia de piscinas e estado de leitura, sem escrita nesta validacao.','intro'],
    ['.route-actions [data-cw-back]','Voltar','back'],
    ['#refreshBtn','Atualizar rota','refresh'],
    ['.route-actions a[href="/technician-field-mode"]','Modo campo','field'],
    ['main > section:nth-of-type(1) h2','Piscinas planeadas','planned'],
    ['main > section:nth-of-type(2) h2','Sugestoes','suggestions'],
    ['#statusBox','A preparar rota tecnica.','preparing']
  ];
  for (const [selector, original, key] of staticLabels) {
    const node = document.querySelector(selector);
    if (!node || node.childNodes.length !== 1 || node.firstChild.nodeType !== Node.TEXT_NODE || node.textContent !== original) continue;
    node.dataset.cwNoI18n = ''; bind(node, value(key));
  }
  window.addEventListener('cw-language-change', paint);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  function ownError(key, params) { const entry = value(key, params), error = new Error(text(entry, 'pt')); errors.set(error, entry); return error; }
  function languageReady() { const language = new URLSearchParams(location.search).get('lang'); if (languages.includes(language)) window.CristalI18n?.applyLanguage(language); paint(); }
  if (window.CristalI18n) languageReady();
  else {
    let script = document.querySelector('script[src="/cw-i18n.js"]');
    if (!script) { script = document.createElement('script'); script.src = '/cw-i18n.js'; script.defer = true; script.addEventListener('load', languageReady, { once: true }); document.head.appendChild(script); }
    else script.addEventListener('load', languageReady, { once: true });
  }
  return { value, text, bind, clearTree, ownError, fromError: error => errors.get(error) || error.message || value('failed') };
})();

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
  statusBox.style.overflowWrap = 'anywhere';
  routeUi.clearTree(statusBox);
  statusBox.textContent = routeUi.text(message);
  routeUi.bind(statusBox, message);
  statusBox.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  statusBox.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  statusBox.dataset.cwState = tone === 'error' ? 'error' : tone === 'warning' ? 'empty' : ['loading','preparing'].includes(message?.key) ? 'loading' : 'ready';
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
    const message = data.error || data.message;
    throw message ? new Error(message) : routeUi.ownError('http', { status: response.status });
  }
  return data;
}

function renderEmpty(box, entry) {
  if (!box) return;
  box.innerHTML = '<div class="empty" role="status" aria-live="polite" data-cw-state="empty">' + escapeHtml(routeUi.text(entry)) + '</div>';
  routeUi.bind(box.firstElementChild, entry);
}

function renderRoute(visits) {
  if (!routeBox) return;
  routeUi.clearTree(routeBox);
  if (!Array.isArray(visits) || visits.length === 0) {
    const entry = routeUi.value('emptyRoute');
    renderEmpty(routeBox, entry);
    return;
  }
  const rows = visits.map((visit, order) => {
    const client = visit.client?.name || routeUi.value('client', { id: visit.clientId || '-' });
    const pool = visit.pool?.name || routeUi.value('unnamedPool');
    const location = visit.pool?.location || visit.pool?.address || routeUi.value('location');
    const plannedAt = visit.plannedDate || visit.startAt || visit.date;
    const when = plannedAt ? new Date(plannedAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : routeUi.value('noTime');
    return { stop: routeUi.value('stop', { number: order + 1 }), pool, client, line: routeUi.value('locationTime', { location, time: when }) };
  });
  routeBox.innerHTML = rows.map(row => `
      <article class="route-item" style="min-width:0;overflow-wrap:anywhere">
        <small>${escapeHtml(routeUi.text(row.stop))}</small>
        <b>${escapeHtml(routeUi.text(row.pool))}</b>
        <small>${escapeHtml(routeUi.text(row.client))}</small>
        <small>${escapeHtml(routeUi.text(row.line))}</small>
      </article>
    `).join('');
  [...routeBox.children].forEach((node, index) => {
    const row = rows[index], leaves = node.querySelectorAll('small');
    routeUi.bind(leaves[0], row.stop); routeUi.bind(node.querySelector('b'), row.pool); routeUi.bind(leaves[1], row.client); routeUi.bind(leaves[2], row.line);
  });
}

function renderSuggestions(visits) {
  if (!suggestionsBox) return;
  routeUi.clearTree(suggestionsBox);
  if (!Array.isArray(visits) || visits.length === 0) {
    const entry = routeUi.value('emptySuggestions');
    renderEmpty(suggestionsBox, entry);
    return;
  }
  const rows = visits.filter(visit => Boolean(visit.pool?.zone || visit.client?.zone)).slice(0, 4).map(visit => ({
    pool: visit.pool?.name || routeUi.value('pool'),
    zone: routeUi.value('zone', { zone: visit.pool?.zone || visit.client?.zone || routeUi.value('zoneUnset') }),
    traffic: routeUi.value('traffic')
  }));
  if (!rows.length) {
    const entry = routeUi.value('noSuggestions'); renderEmpty(suggestionsBox, entry); return;
  }
  suggestionsBox.innerHTML = rows.map(row => `
        <article class="route-item" style="min-width:0;overflow-wrap:anywhere">
          <b>${escapeHtml(routeUi.text(row.pool))}</b>
          <small>${escapeHtml(routeUi.text(row.zone))}</small>
          <small>${escapeHtml(routeUi.text(row.traffic))}</small>
        </article>
      `).join('');
  [...suggestionsBox.children].forEach((node, index) => {
    const row = rows[index], leaves = node.querySelectorAll('small'); routeUi.bind(node.querySelector('b'), row.pool); routeUi.bind(leaves[0], row.zone); routeUi.bind(leaves[1], row.traffic);
  });
}

async function loadRoute() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  const technicianId = Number(userData().technicianId || userData().id || 0);
  if (!technicianId) {
    setStatus(routeUi.value('missingTech'), "error");
    if (routeBox) { const entry = routeUi.value('missingSession'); routeUi.clearTree(routeBox); renderEmpty(routeBox, entry); }
    return;
  }

  setStatus(routeUi.value('loading'));
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const query = new URLSearchParams({
      technicianId: String(technicianId),
      date: todayDateValue(),
    });
    const data = await parseResponse(await fetch(`${API}/technician/today?${query.toString()}`));
    if(data.complete!==true||!Array.isArray(data.visits)||data.total!==data.visits.length)throw routeUi.ownError('incomplete');
    const visits = data.visits;

    renderRoute(visits);
    renderSuggestions(visits);

    if (visits.length) {
      setStatus(routeUi.value('loaded', { count: visits.length }));
    } else {
      setStatus(routeUi.value('noStops'), "warning");
    }
  } catch (error) {
    renderRoute([]);
    renderSuggestions([]);
    setStatus(routeUi.fromError(error), "error");
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

if (refreshBtn) refreshBtn.addEventListener("click", loadRoute);

loadRoute();
