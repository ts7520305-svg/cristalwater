// Language repaint touches only privately owned text leaves, never the history producer.
const historyUi = (() => {
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
  "title": [
    "Cristal Water - Historico Tecnico",
    "Cristal Water - Technician History",
    "Cristal Water - Historique du technicien",
    "Cristal Water - Historial del técnico",
    "Cristal Water - Technikerverlauf"
  ],
  "technician": [
    "Tecnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "heading": [
    "Historico de Visitas",
    "Visit History",
    "Historique des visites",
    "Historial de visitas",
    "Besuchsverlauf"
  ],
  "intro": [
    "Consulta rapida das ultimas visitas concluidas, sem escrita.",
    "Quick view of recent completed visits, read only.",
    "Consultation rapide des dernières visites terminées, en lecture seule.",
    "Consulta rápida de las últimas visitas completadas, solo lectura.",
    "Schnellansicht der letzten abgeschlossenen Besuche im Lesemodus."
  ],
  "loading": [
    "A carregar historico.",
    "Loading history.",
    "Chargement de l’historique.",
    "Cargando el historial.",
    "Verlauf wird geladen."
  ],
  "empty": [
    "Sem historico disponivel.",
    "No history available.",
    "Aucun historique disponible.",
    "No hay historial disponible.",
    "Kein Verlauf verfügbar."
  ],
  "noDate": [
    "Sem data",
    "No date",
    "Sans date",
    "Sin fecha",
    "Kein Datum"
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
  "line": [
    "{date} · Estado {status}",
    "{date} · Status {status}",
    "{date} · Statut {status}",
    "{date} · Estado {status}",
    "{date} · Status {status}"
  ],
  "missingTechnician": [
    "Sessao sem tecnico associado.",
    "No technician is associated with this session.",
    "Aucun technicien n’est associé à cette session.",
    "No hay ningún técnico asociado a esta sesión.",
    "Dieser Sitzung ist kein Techniker zugeordnet."
  ],
  "incomplete": [
    "A resposta não confirma a lista completa. Atualize antes de consultar o histórico.",
    "The response does not confirm the complete list. Refresh before viewing history.",
    "La réponse ne confirme pas la liste complète. Actualisez avant de consulter l’historique.",
    "La respuesta no confirma la lista completa. Actualiza antes de consultar el historial.",
    "Die Antwort bestätigt keine vollständige Liste. Aktualisieren Sie, bevor Sie den Verlauf ansehen."
  ],
  "loaded": [
    "Historico carregado com {count} visita(s).",
    "History loaded with {count} visit(s).",
    "Historique chargé avec {count} visite(s).",
    "Historial cargado con {count} visita(s).",
    "Verlauf mit {count} Besuch(en) geladen."
  ],
  "noCompleted": [
    "Sem visitas concluidas para mostrar.",
    "No completed visits to show.",
    "Aucune visite terminée à afficher.",
    "No hay visitas completadas para mostrar.",
    "Keine abgeschlossenen Besuche verfügbar."
  ],
  "loadFailed": [
    "Falha ao carregar historico.",
    "Failed to load history.",
    "Échec du chargement de l’historique.",
    "Error al cargar el historial.",
    "Verlauf konnte nicht geladen werden."
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
    if (entry.key === 'session') return window.CWFieldWriteStore.message('sessionPreserved', language);
    const index = Math.max(0, languages.indexOf(String(language).toLowerCase().split('-')[0]));
    return copy[entry.key][index].replace(/\{(\w+)\}/g, (_, key) => text(entry.params[key], language));
  }
  function clearTree(root) { for (const node of bindings.keys()) if (root.contains(node)) bindings.delete(node); }
  function bind(node, entry) {
    if (!node) return;
    if (!entry || typeof entry !== 'object' || !entries.has(entry)) { bindings.delete(node); return; }
    const rendered = text(entry);
    if (node.textContent !== rendered) {
      if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) node.firstChild.nodeValue = rendered;
      else node.textContent = rendered;
    }
    bindings.set(node, { entry, rendered, textNode: node.firstChild });
  }
  function paint() {
    for (const [node, leaf] of bindings) {
      if (!node.isConnected || node.childNodes.length !== 1 || node.firstChild !== leaf.textNode || node.textContent !== leaf.rendered) { bindings.delete(node); continue; }
      bind(node, leaf.entry);
    }
  }
  window.addEventListener('cw-language-change', paint);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  for (const node of document.querySelectorAll('[data-cw-history-copy]')) bind(node, value(node.dataset.cwHistoryCopy));
  function ownError(key, params) { const entry = value(key, params), error = new Error(text(entry, 'pt')); errors.set(error, entry); return error; }
  const fromError = error => errors.get(error) || error.message;
  return { value, text, bind, clearTree, ownError, fromError };
})();

const statusBox = document.getElementById("statusBox");
const historyList = document.getElementById("historyList");
const historyStore = window.CWFieldWriteStore, historySession = historyStore?.session();
let historyRead = null, historyRevision = 0, historyBlocked = false, historyExpires = 0;
try {
  const claim = JSON.parse(atob(historySession.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (typeof claim.exp === 'number') historyExpires = claim.exp * 1000;
} catch (_) { /* An unreadable session cannot authorize a history read. */ }

function protectHistory() {
  if (historyBlocked) return false;
  if (historyStore?.same(historySession) && Number.isFinite(historyExpires) && historyExpires > Date.now() && !window.CristalAuth?.isSessionExpired()) return true;
  historyBlocked = true; ++historyRevision; historyRead?.abort();
  historyUi.clearTree(historyList); historyList.replaceChildren();
  setStatus(historyUi.value('session'), 'error');
  return false;
}

function setStatus(message, tone = "") {
  if (!statusBox) return;
  historyUi.clearTree(statusBox);
  statusBox.textContent = historyUi.text(message);
  historyUi.bind(statusBox, message);
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
  if (!response.ok) {
    const message = data.error || data.message;
    throw message ? new Error(message) : historyUi.ownError('http', { status: response.status });
  }
  return data;
}

function render(visits) {
  if (!historyList) return;
  historyUi.clearTree(historyList);
  if (!Array.isArray(visits) || visits.length === 0) {
    const empty = historyUi.value('empty');
    historyList.innerHTML = '<div class="empty">' + escapeHtml(historyUi.text(empty)) + '</div>';
    historyUi.bind(historyList.firstElementChild, empty);
    return;
  }

  const rows = visits.map((visit) => {
    const when = visit.endAt || visit.startAt || visit.plannedDate || visit.date;
    const whenText = when ? new Date(when).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : historyUi.value('noDate');
    const pool = visit.pool?.name || historyUi.value('pool');
    const client = visit.client?.name || historyUi.value('client');
    const status = visit.status || "-";
    return { pool, client, line: historyUi.value('line', { date: whenText, status }) };
  });
  historyList.innerHTML = rows.map(({ pool, client, line }) => `
      <article class="item">
        <b>${escapeHtml(historyUi.text(pool))}</b>
        <small>${escapeHtml(historyUi.text(client))}</small>
        <small>${escapeHtml(historyUi.text(line))}</small>
      </article>
    `).join("");
  [...historyList.children].forEach((node, index) => {
    historyUi.bind(node.querySelector('b'), rows[index].pool);
    historyUi.bind(node.querySelector('small'), rows[index].client);
    historyUi.bind(node.querySelector('small:last-child'), rows[index].line);
  });
}

async function loadHistory() {
  if (!protectHistory()) return;
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  const user = userData();
  const technicianId = Number(user.technicianId || user.id || 0);
  if (!technicianId) {
    setStatus(historyUi.value('missingTechnician'), "error");
    render([]);
    return;
  }

  const revision = ++historyRevision, read = new AbortController();
  historyRead?.abort(); historyRead = read;
  setStatus(historyUi.value('loading'));
  try {
    const response = await fetch(`/api/technician/today?technicianId=${encodeURIComponent(technicianId)}`, { cache: 'no-store', headers: { Authorization: 'Bearer ' + historySession.token }, signal: read.signal });
    if (!protectHistory() || revision !== historyRevision) return;
    const data = await parseResponse(response);
    if (!protectHistory() || revision !== historyRevision) return;
    if(data.complete!==true||data.technicianId!==historySession.technicianId||!Array.isArray(data.visits)||data.total!==data.visits.length)throw historyUi.ownError('incomplete');
    const visits = data.visits.filter((visit) => {
      const status = String(visit.status || "").toUpperCase();
      return Boolean(visit.endAt) || status === "DONE";
    });
    render(visits);
    setStatus(visits.length ? historyUi.value('loaded', { count: visits.length }) : historyUi.value('noCompleted'), visits.length ? "" : "warning");
  } catch (error) {
    if (!protectHistory() || revision !== historyRevision) return;
    render([]);
    setStatus(historyUi.fromError(error) || historyUi.value('loadFailed'), "error");
  } finally { if (historyRead === read) historyRead = null; }
}

for (const event of ['cw:session-change', 'storage', 'focus', 'pageshow']) window.addEventListener(event, protectHistory);
document.addEventListener('visibilitychange', () => { if (!document.hidden) protectHistory(); });
setInterval(protectHistory, 1000);
loadHistory();
