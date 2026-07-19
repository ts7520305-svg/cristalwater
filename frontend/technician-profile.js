const statusBox = document.getElementById("statusBox");
const profileGrid = document.getElementById("profileGrid");

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

function field(label, value) {
  return `<div class="field"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || "-")}</b></div>`;
}

function renderProfile(user) {
  if (!profileGrid) return;
  const role = String(user.role || "").toUpperCase() || "TECHNICIAN";
  profileGrid.innerHTML = [
    field("Nome", user.name || "Tecnico"),
    field("Perfil", role),
    field("ID tecnico", user.technicianId || user.id || "-"),
    field("Sessao", "Ativa"),
    field("Zona", user.zone || "Nao definida"),
    field("Telefone", user.phone ? "Disponivel no sistema" : "Nao definido"),
  ].join("");
}

function loadProfile() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;
  const user = userData();
  renderProfile(user);
  setStatus("Perfil carregado em modo leitura.");
}

loadProfile();