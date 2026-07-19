const API = "/api";

const params = new URLSearchParams(window.location.search);
const visitId = params.get("visit");

const infoBox = document.getElementById("info");
const contextBox = document.getElementById("contextBox");
const statusBox = document.getElementById("statusBox");
const photoInput = document.getElementById("photo");
const photoMeta = document.getElementById("photoMeta");
const uploadBtn = document.getElementById("uploadBtn");
const completeBtn = document.getElementById("completeBtn");
const notDoneBtn = document.getElementById("notDoneBtn");
const refreshBtn = document.getElementById("refreshBtn");
const targetRanges = document.getElementById("targetRanges");

function setStatus(message, tone = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (tone) {
    statusBox.dataset.tone = tone;
  } else {
    statusBox.removeAttribute("data-tone");
  }
}

function asNumberOrNull(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function formatDate(value) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return parsed.toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
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

function setBusy(isBusy) {
  [uploadBtn, completeBtn, notDoneBtn, refreshBtn].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
}

function setFormEnabled(isEnabled) {
  [
    'ph',
    'chlorine',
    'alkalinity',
    'salt',
    'temperature',
    'orp',
    'cleaned',
    'brushed',
    'notes',
    'notDoneReason',
    'photo',
  ].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.disabled = !isEnabled;
  });
  if (uploadBtn) uploadBtn.disabled = !isEnabled;
  if (completeBtn) completeBtn.disabled = !isEnabled;
  if (notDoneBtn) notDoneBtn.disabled = !isEnabled;
}

function requireVisitAccess() {
  if (!window.CristalAuth) return true;
  const hydrated = window.CristalAuth.hydrate();
  if (!hydrated) {
    window.CristalAuth.logout();
    return false;
  }
  const user = window.CristalAuth.parseUser ? window.CristalAuth.parseUser() : {};
  const role = String(user.role || "").toUpperCase().trim();
  if (!["TECHNICIAN", "ADMIN"].includes(role)) {
    window.CristalAuth.logout();
    return false;
  }
  return true;
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

function getPayload() {
  return {
    visitId: Number(visitId),
    ph: asNumberOrNull(document.getElementById("ph")?.value),
    chlorine: asNumberOrNull(document.getElementById("chlorine")?.value),
    alkalinity: asNumberOrNull(document.getElementById("alkalinity")?.value),
    salt: asNumberOrNull(document.getElementById("salt")?.value),
    temperature: asNumberOrNull(document.getElementById("temperature")?.value),
    orp: asNumberOrNull(document.getElementById("orp")?.value),
    cleaned: Boolean(document.getElementById("cleaned")?.checked),
    brushed: Boolean(document.getElementById("brushed")?.checked),
    notes: String(document.getElementById("notes")?.value || "").trim(),
  };
}

function renderVisit(visit, context = {}) {
  const poolName = visit?.pool?.name || context.pool?.name || "Piscina sem nome";
  const clientName = visit?.client?.name || context.customer?.name || "Cliente por identificar";
  const location = context.pool?.location || context.pool?.address || visit?.pool?.location || visit?.pool?.address || "Local por confirmar";
  const plannedDate = formatDate(visit?.plannedDate || visit?.date || visit?.startAt);
  const status = visit?.status || "Sem estado";
  const photosCount = Array.isArray(visit?.photos) ? visit.photos.length : Number(context.photosCount || 0);
  const alertsCount = Number(context.alertsCount || 0);

  const setValue = (id, value) => {
    const input = document.getElementById(id);
    if (input && value !== undefined && value !== null && input.value === "") input.value = String(value);
  };

  setValue("ph", visit?.ph);
  setValue("chlorine", visit?.chlorine);
  setValue("alkalinity", visit?.alkalinity);
  setValue("salt", visit?.salt);
  setValue("temperature", visit?.temperature);
  setValue("orp", visit?.orpMv);
  const notesInput = document.getElementById("notes");
  if (notesInput && !notesInput.value && visit?.notes) notesInput.value = visit.notes;

  document.getElementById("heroPool").textContent = poolName;
  document.getElementById("heroClient").textContent = clientName;
  document.getElementById("heroAlerts").textContent = String(alertsCount);
  document.getElementById("heroPhotos").textContent = String(photosCount);
  document.getElementById("visitHeroCopy").textContent = `${location} · ${plannedDate} · Estado ${status}`;
  document.getElementById("visitTopMeta").textContent = `Visita #${visit.id || visitId} · ${status}`;

  if (infoBox) {
    infoBox.innerHTML = `
      <div class="visit-meta-item">
        <span>Piscina</span>
        <strong>${escapeHtml(poolName)}</strong>
      </div>
      <div class="visit-meta-item">
        <span>Cliente</span>
        <strong>${escapeHtml(clientName)}</strong>
      </div>
      <div class="visit-meta-item">
        <span>Local</span>
        <strong>${escapeHtml(location)}</strong>
      </div>
      <div class="visit-meta-item">
        <span>Planeada para</span>
        <strong>${escapeHtml(plannedDate)}</strong>
      </div>
    `;
  }

  if (contextBox) {
    const permanentNotes = context.permanentNotes ? `<div class="visit-meta-item"><span>Notas permanentes</span><strong>${escapeHtml(context.permanentNotes)}</strong></div>` : "";
    const temporaryNotes = context.temporaryNotes ? `<div class="visit-meta-item"><span>Notas temporárias</span><strong>${escapeHtml(context.temporaryNotes)}</strong></div>` : "";
    contextBox.innerHTML = `
      <div class="visit-meta-item">
        <span>Alertas abertos</span>
        <strong>${escapeHtml(alertsCount)} alerta(s)</strong>
      </div>
      <div class="visit-meta-item">
        <span>Fotos associadas</span>
        <strong>${escapeHtml(photosCount)} fotografia(s)</strong>
      </div>
      ${permanentNotes}
      ${temporaryNotes}
    `;
  }

  const targets = context.chemistryTargets;
  if (targetRanges && targets) {
    const parts = [];
    if (targets.ph && targets.ph.min != null && targets.ph.max != null) parts.push(`pH ${targets.ph.min}-${targets.ph.max}`);
    if (targets.chlorine && targets.chlorine.min != null && targets.chlorine.max != null) parts.push(`Cloro ${targets.chlorine.min}-${targets.chlorine.max}`);
    if (targets.alkalinity && targets.alkalinity.min != null && targets.alkalinity.max != null) parts.push(`Alcalinidade ${targets.alkalinity.min}-${targets.alkalinity.max}`);
    targetRanges.textContent = parts.length ? `Intervalos recomendados: ${parts.join(" · ")}.` : "Sem ficha técnica com intervalos definidos.";
  }
}

async function loadVisit() {
  if (!requireVisitAccess()) {
    return;
  }

  if (!visitId) {
    setStatus("Sem visita selecionada. Abre esta página a partir da rota do técnico.", "error");
    setFormEnabled(false);
    if (infoBox) infoBox.innerHTML = '<p class="visit-empty">Escolhe uma visita válida para continuar.</p>';
    return;
  }

  setFormEnabled(false);
  setStatus("A carregar dados reais da visita.", "loading");

  try {
    const data = await parseResponse(await fetch(`${API}/visits/${visitId}`));
    const visit = data.visit;
    if (!visit) throw new Error("Visita indisponível.");
    renderVisit(visit, data.context || {});
    setFormEnabled(true);
    setStatus("Ficha da visita pronta para registo de leituras e fecho.", "success");
  } catch (error) {
    if (infoBox) infoBox.innerHTML = '<p class="visit-empty">Não foi possível carregar a visita.</p>';
    if (contextBox) contextBox.innerHTML = '<div class="visit-meta-item"><span>Erro</span><strong>Sem contexto disponível.</strong></div>';
    setFormEnabled(false);
    setStatus(error.message || "Falha ao carregar visita.", "error");
  }
}

async function completeVisit() {
  if (!visitId) return;
  setBusy(true);
  setStatus("A concluir visita e a fechar o relatório técnico.", "loading");

  try {
    await parseResponse(await fetch(`${API}/visits/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getPayload()),
    }));
    setStatus("Visita concluída com sucesso.", "success");
    await loadVisit();
  } catch (error) {
    setStatus(error.message || "Não foi possível concluir a visita.", "error");
  } finally {
    setBusy(false);
  }
}

async function markNotDone() {
  if (!visitId) return;
  const reason = String(document.getElementById("notDoneReason")?.value || "").trim();
  if (!reason) {
    setStatus("Indica primeiro o motivo para marcar a visita como não feita.", "warning");
    return;
  }

  setBusy(true);
  setStatus("A marcar a visita como não realizada.", "loading");

  try {
    await parseResponse(await fetch(`${API}/visits/${visitId}/not-done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: reason, internalNotes: reason }),
    }));
    setStatus("Visita marcada como não feita.", "success");
    await loadVisit();
  } catch (error) {
    setStatus(error.message || "Não foi possível marcar a visita como não feita.", "error");
  } finally {
    setBusy(false);
  }
}

async function uploadPhoto() {
  if (!visitId) return;
  const file = photoInput?.files?.[0];
  if (!file) {
    setStatus("Seleciona primeiro uma fotografia para enviar.", "warning");
    return;
  }

  const form = new FormData();
  form.append("photo", file);

  setBusy(true);
  setStatus("A enviar fotografia da visita.", "loading");

  try {
    await parseResponse(await fetch(`${API}/visits/${visitId}/photo`, {
      method: "POST",
      body: form,
    }));
    setStatus("Fotografia enviada com sucesso.", "success");
    if (photoInput) photoInput.value = "";
    if (photoMeta) photoMeta.textContent = "Fotografia enviada. Podes anexar outra se necessário.";
    await loadVisit();
  } catch (error) {
    setStatus(error.message || "Não foi possível enviar a fotografia.", "error");
  } finally {
    setBusy(false);
  }
}

if (photoInput) {
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    photoMeta.textContent = file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : "Sem ficheiro selecionado.";
  });
}

if (uploadBtn) uploadBtn.addEventListener("click", uploadPhoto);
if (completeBtn) completeBtn.addEventListener("click", completeVisit);
if (notDoneBtn) notDoneBtn.addEventListener("click", markNotDone);
if (refreshBtn) refreshBtn.addEventListener("click", loadVisit);

window.completeVisit = completeVisit;
window.markNotDone = markNotDone;
window.uploadPhoto = uploadPhoto;

loadVisit();