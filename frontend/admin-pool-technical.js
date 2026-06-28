const API = `${location.origin}/api/core`;
const poolId = new URLSearchParams(location.search).get("poolId");

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));
}

function setVal(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? "";
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function numberVal(id) {
  const raw = val(id).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function calculateVolumeFromDimensions() {
  const length = numberVal("lengthM");
  const width = numberVal("widthM");
  const depthMin = numberVal("depthMinM");
  const depthMax = numberVal("depthMaxM");
  let averageDepth = numberVal("averageDepthM");

  if ((!averageDepth || averageDepth <= 0) && depthMin > 0 && depthMax > 0) {
    averageDepth = (depthMin + depthMax) / 2;
    setVal("averageDepthM", Math.round(averageDepth * 100) / 100);
  }

  if (length > 0 && width > 0 && averageDepth > 0) {
    return Math.round(length * width * averageDepth * 10) / 10;
  }

  return null;
}

function updateCalculatedVolume() {
  const volume = calculateVolumeFromDimensions();
  if (volume !== null) setVal("volumeM3", volume);
  return volume;
}

async function req(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "Erro");
  return data;
}

function formatDate(value) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function repeatLabel(rule) {
  const custom = String(rule || "").toUpperCase().match(/^EVERY_(\d+)_(DAYS|MONTHS|YEARS)$/);
  if (custom) {
    const amount = Number(custom[1]);
    const unit = custom[2];
    const labels = {
      DAYS: amount === 1 ? "dia" : "dias",
      MONTHS: amount === 1 ? "mes" : "meses",
      YEARS: amount === 1 ? "ano" : "anos",
    };
    return `A cada ${amount} ${labels[unit] || "dias"}`;
  }
  const labels = {
    NONE: "Sem repeticao",
    EVERY_7_DAYS: "Semanal",
    EVERY_30_DAYS: "Mensal",
    EVERY_90_DAYS: "Trimestral",
    EVERY_180_DAYS: "Semestral",
    EVERY_365_DAYS: "Anual",
  };
  return labels[rule] || "Sem repeticao";
}

function toggleCustomRepeat() {
  const isCustom = val("reminderRepeatRule") === "CUSTOM";
  const box = document.getElementById("customRepeatBox");
  if (box) box.style.display = isCustom ? "grid" : "none";
}

function selectedRepeatRule() {
  const rule = val("reminderRepeatRule") || "NONE";
  if (rule !== "CUSTOM") return rule;

  const amount = Number(val("customRepeatValue"));
  const unit = val("customRepeatUnit") || "DAYS";
  const maxByUnit = { DAYS: 1095, MONTHS: 120, YEARS: 10 };
  const unitLabel = { DAYS: "dias", MONTHS: "meses", YEARS: "anos" }[unit] || "dias";
  const max = maxByUnit[unit] || 1095;
  if (!Number.isInteger(amount) || amount < 1 || amount > max) {
    throw new Error(`Na repeticao personalizada, indica um numero de ${unitLabel} entre 1 e ${max}.`);
  }
  return `EVERY_${amount}_${unit}`;
}

function renderHistory(pool) {
  const history = pool.technicalHistory || [];
  document.getElementById("history").innerHTML = history.length
    ? history.map((item) => `
      <div class="timeline-item">
        <strong>${esc(item.component || item.type || "Intervencao")}</strong>
        <span>${formatDate(item.performedAt || item.createdAt)}</span>
        <p>${esc(item.message || item.description || "Sem descricao")}</p>
        ${item.nextSuggested ? `<small>Proxima sugestao: ${formatDate(item.nextSuggested)}</small>` : ""}
      </div>
    `).join("")
    : '<div class="muted">Sem historico tecnico.</div>';
}

function renderReminders(reminders) {
  const list = document.getElementById("serviceReminders");
  if (!reminders.length) {
    list.innerHTML = '<div class="muted">Sem lembretes de servico nesta piscina.</div>';
    return;
  }

  list.innerHTML = reminders.map((item) => {
    const done = item.status === "DONE";
    return `
      <div class="reminder-item ${done ? "done" : ""}">
        <div>
          <strong>${esc(item.title)}</strong>
          <div class="muted">${formatDate(item.dueAt)} · ${repeatLabel(item.repeatRule)} · ${esc(item.priority || "NORMAL")}</div>
          ${item.description ? `<p>${esc(item.description)}</p>` : ""}
        </div>
        <div>
          ${done
            ? '<span class="tag">Concluido</span>'
            : `<button type="button" data-complete-reminder="${esc(item.id)}">Concluir</button>`}
          <button type="button" class="cw-action-danger" data-delete-reminder="${esc(item.id)}">Eliminar</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderKeyAccesses(pool) {
  const list = document.getElementById("keyAccessList");
  const link = document.getElementById("keyAccessLink");
  if (link && pool?.id) link.href = `/admin-keys?poolId=${encodeURIComponent(pool.id)}`;
  if (!list) return;

  const poolKeys = (pool?.keyAccesses || []).map((key) => ({
    source: "Piscina/Jacuzzi",
    code: key.keyCode,
    title: key.description || "Chave da piscina",
    instructions: key.description,
    required: key.requiredForVisit,
    visible: key.visibleToTechnician,
  }));

  const clientKeys = (pool?.client?.accesses || []).map((key) => ({
    source: "Cliente",
    code: key.codeValue,
    title: key.title || "Chave geral do cliente",
    instructions: key.instructions,
    required: true,
    visible: key.visibleToTechnician,
  }));

  const keys = [...poolKeys, ...clientKeys];
  if (!keys.length) {
    list.innerHTML = '<div class="muted">Sem chaves registadas para esta piscina ou cliente.</div>';
    return;
  }

  list.innerHTML = keys.map((key) => `
    <div class="access-item">
      <strong>${esc(key.code || key.title || "Chave")}</strong>
      <small>${esc(key.source)} - ${esc(key.title || "Acesso")}</small>
      ${key.instructions ? `<small>${esc(key.instructions)}</small>` : ""}
      <small>${key.required ? "Obrigatoria para visita" : "Opcional"} - ${key.visible ? "visivel ao tecnico" : "apenas administracao"}</small>
    </div>
  `).join("");
}

async function loadReminders() {
  if (!poolId) return;
  const data = await req(`/pools/${poolId}/service-reminders`);
  renderReminders(data.reminders || []);
}

async function loadSheet() {
  if (!poolId) {
    document.getElementById("status").textContent = "Falta poolId";
    return;
  }

  const { pool } = await req(`/pools/${poolId}/technical-sheet`);
  document.getElementById("subtitle").textContent = `${pool.client?.name || "Cliente"} - ${pool.name || "Piscina"}`;
  const operationalReminderLink = document.getElementById("poolOperationalReminderLink");
  if (operationalReminderLink) {
    operationalReminderLink.href = `/admin-crm?poolId=${encodeURIComponent(pool.id)}`;
  }

  setVal("name", pool.name);
  setVal("type", pool.type || "POOL");
  setVal("zone", pool.zone);
  setVal("address", pool.address);
  setVal("volumeM3", pool.volumeM3);
  setVal("monthlyAmount", pool.monthlyAmount);
  setVal("notes", pool.notes);

  const calculation = pool.calculationProfile || {};
  ["lengthM", "widthM", "depthMinM", "depthMaxM", "averageDepthM", "pumpFlowM3h", "targetSalinityPpm", "targetChlorinePpm", "currentWaterTempC"]
    .forEach((key) => setVal(key, calculation[key]));
  updateCalculatedVolume();

  const equipment = pool.equipment || {};
  ["pumpType", "pumpPower", "filterType", "filterMedia", "lightsCount", "lightsType"]
    .forEach((key) => setVal(key, equipment[key]));
  setVal("saltSystem", String(Boolean(equipment.saltSystem)));
  setVal("equipmentNotes", equipment.notes);

  const technicalRoom = pool.technicalRoom || {};
  setVal("technicalRoomLocation", technicalRoom.locationNote);
  setVal("technicalRoomCondition", technicalRoom.condition);
  setVal("technicalRoomVentilation", technicalRoom.ventilation);
  setVal("technicalRoomElectrical", technicalRoom.electrical);
  setVal("technicalRoomNotes", technicalRoom.notes);

  renderKeyAccesses(pool);
  renderHistory(pool);
  await loadReminders();
}

async function saveSheet() {
  updateCalculatedVolume();
  const ids = [
    "name", "type", "zone", "address", "volumeM3", "monthlyAmount", "notes",
    "lengthM", "widthM", "depthMinM", "depthMaxM", "averageDepthM", "pumpFlowM3h",
    "targetSalinityPpm", "targetChlorinePpm", "currentWaterTempC", "pumpType",
    "pumpPower", "filterType", "filterMedia", "saltSystem", "lightsCount", "lightsType",
    "equipmentNotes", "technicalRoomLocation", "technicalRoomCondition",
    "technicalRoomVentilation", "technicalRoomElectrical", "technicalRoomNotes", "historyNote",
  ];
  const body = {};
  ids.forEach((id) => { body[id] = val(id); });
  await req(`/pools/${poolId}/technical-sheet`, { method: "PUT", body: JSON.stringify(body) });
  document.getElementById("status").textContent = "Ficha tecnica guardada.";
  document.getElementById("historyNote").value = "";
  await loadSheet();
}

async function createServiceReminder() {
  const title = val("reminderTitle");
  const dueAt = val("reminderDueAt");
  if (!title || !dueAt) {
    document.getElementById("reminderStatus").textContent = "Indica titulo e data.";
    return;
  }
  let repeatRule = "NONE";
  try {
    repeatRule = selectedRepeatRule();
  } catch (error) {
    document.getElementById("reminderStatus").textContent = error.message;
    return;
  }

  await req(`/pools/${poolId}/service-reminders`, {
    method: "POST",
    body: JSON.stringify({
      title,
      dueAt: new Date(dueAt).toISOString(),
      repeatRule,
      priority: val("reminderPriority") || "NORMAL",
      description: val("reminderDescription"),
    }),
  });

  ["reminderTitle", "reminderDueAt", "reminderDescription", "customRepeatValue"].forEach((id) => setVal(id, ""));
  setVal("reminderRepeatRule", "NONE");
  setVal("customRepeatUnit", "DAYS");
  setVal("reminderPriority", "NORMAL");
  toggleCustomRepeat();
  document.getElementById("reminderStatus").textContent = "Lembrete criado.";
  await loadReminders();
}

async function completeServiceReminder(id) {
  await req(`/pools/${poolId}/service-reminders/${encodeURIComponent(id)}/complete`, { method: "POST" });
  document.getElementById("reminderStatus").textContent = "Lembrete concluido.";
  await loadReminders();
}

async function deleteServiceReminder(id) {
  if (!confirm("Eliminar este lembrete de servico? Esta acao nao remove historico tecnico nem visitas.")) return;
  await req(`/pools/${poolId}/service-reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
  document.getElementById("reminderStatus").textContent = "Lembrete eliminado.";
  await loadReminders();
}

window.saveSheet = saveSheet;
window.createServiceReminder = createServiceReminder;

window.addEventListener("DOMContentLoaded", () => {
  ["lengthM", "widthM", "depthMinM", "depthMaxM", "averageDepthM"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateCalculatedVolume);
  });
  document.getElementById("reminderRepeatRule")?.addEventListener("change", toggleCustomRepeat);
  toggleCustomRepeat();

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-complete-reminder]");
    if (button) completeServiceReminder(button.dataset.completeReminder).catch((error) => {
      document.getElementById("reminderStatus").textContent = error.message;
    });

    const deleteButton = event.target.closest("[data-delete-reminder]");
    if (deleteButton) deleteServiceReminder(deleteButton.dataset.deleteReminder).catch((error) => {
      document.getElementById("reminderStatus").textContent = error.message;
    });
  });

  loadSheet().catch((error) => {
    document.getElementById("status").textContent = error.message;
  });
});
