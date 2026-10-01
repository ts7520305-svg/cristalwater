// Language repaint touches only privately owned text leaves, never the profile producer.
const profileUi = (() => {
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
  "title": [
    "Cristal Water - Perfil Tecnico",
    "Cristal Water - Technician Profile",
    "Cristal Water - Profil du technicien",
    "Cristal Water - Perfil del técnico",
    "Cristal Water - Technikerprofil"
  ],
  "technician": [
    "Tecnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "heading": [
    "Perfil",
    "Profile",
    "Profil",
    "Perfil",
    "Profil"
  ],
  "intro": [
    "Dados operacionais da sessao atual, sem exposicao de contactos proibidos.",
    "Operational data for the current session, without exposing restricted contact details.",
    "Données opérationnelles de la session actuelle, sans divulguer les coordonnées à accès restreint.",
    "Datos operativos de la sesión actual, sin exponer datos de contacto restringidos.",
    "Operative Daten der aktuellen Sitzung; geschützte Kontaktdaten werden nicht angezeigt."
  ],
  "preparing": [
    "A preparar perfil.",
    "Preparing profile.",
    "Préparation du profil.",
    "Preparando el perfil.",
    "Profil wird vorbereitet."
  ],
  "loaded": [
    "Perfil carregado em modo leitura.",
    "Profile loaded in read-only mode.",
    "Profil chargé en lecture seule.",
    "Perfil cargado en modo de lectura.",
    "Profil im Lesemodus geladen."
  ],
  "name": [
    "Nome",
    "Name",
    "Nom",
    "Nombre",
    "Name"
  ],
  "role": [
    "Perfil",
    "Role",
    "Profil",
    "Perfil",
    "Rolle"
  ],
  "id": [
    "ID tecnico",
    "Technician ID",
    "ID du technicien",
    "ID del técnico",
    "Techniker-ID"
  ],
  "session": [
    "Sessao",
    "Session",
    "Session",
    "Sesión",
    "Sitzung"
  ],
  "zone": [
    "Zona",
    "Zone",
    "Zone",
    "Zona",
    "Zone"
  ],
  "phone": [
    "Telefone",
    "Phone",
    "Téléphone",
    "Teléfono",
    "Telefon"
  ],
  "nameMissing": [
    "Tecnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "active": [
    "Ativa",
    "Active",
    "Active",
    "Activa",
    "Aktiv"
  ],
  "zoneMissing": [
    "Nao definida",
    "Not defined",
    "Non définie",
    "No definida",
    "Nicht festgelegt"
  ],
  "phoneAvailable": [
    "Disponivel no sistema",
    "Available in the system",
    "Disponible dans le système",
    "Disponible en el sistema",
    "Im System verfügbar"
  ],
  "phoneMissing": [
    "Nao definido",
    "Not defined",
    "Non défini",
    "No definido",
    "Nicht festgelegt"
  ]
};
  const entries = new WeakSet(), bindings = new Map();
  const value = key => { const entry = Object.freeze({ key }); entries.add(entry); return entry; };
  function text(entry) {
    if (!entry || typeof entry !== 'object' || !entries.has(entry)) return String(entry ?? '');
    const language = String(document.documentElement.lang || 'pt').toLowerCase().split('-')[0];
    return copy[entry.key][Math.max(0, languages.indexOf(language))];
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
  for (const node of document.querySelectorAll('[data-cw-profile-copy]')) bind(node, value(node.dataset.cwProfileCopy));
  return { value, text, bind, clearTree };
})();

const statusBox = document.getElementById("statusBox");
const profileGrid = document.getElementById("profileGrid");

function setStatus(message, tone = "") {
  if (!statusBox) return;
  profileUi.clearTree(statusBox);
  statusBox.textContent = profileUi.text(message);
  profileUi.bind(statusBox, message);
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

function field(label, value) {
  return `<div class="field"><span>${escapeHtml(profileUi.text(label))}</span><b>${escapeHtml(profileUi.text(value || "-"))}</b></div>`;
}

function renderProfile(user) {
  if (!profileGrid) return;
  const role = String(user.role || "").toUpperCase() || "TECHNICIAN";
  const fields = [
    [profileUi.value('name'), user.name || profileUi.value('nameMissing')],
    [profileUi.value('role'), role],
    [profileUi.value('id'), user.technicianId || user.id || "-"],
    [profileUi.value('session'), profileUi.value('active')],
    [profileUi.value('zone'), user.zone || profileUi.value('zoneMissing')],
    [profileUi.value('phone'), user.phone ? profileUi.value('phoneAvailable') : profileUi.value('phoneMissing')],
  ];
  profileUi.clearTree(profileGrid);
  profileGrid.innerHTML = fields.map(([label, value]) => field(label, value)).join("");
  [...profileGrid.querySelectorAll('.field')].forEach((node, index) => {
    profileUi.bind(node.querySelector('span'), fields[index][0]);
    profileUi.bind(node.querySelector('b'), fields[index][1] || "-");
  });
}

function loadProfile() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;
  const user = userData();
  renderProfile(user);
  setStatus(profileUi.value('loaded'));
}

loadProfile();