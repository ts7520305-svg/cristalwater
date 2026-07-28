const API = `${location.origin}/api/core`;
const poolId = new URLSearchParams(location.search).get("poolId");
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
};
let proposalSelection = new Set();

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
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt") || "";
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader, ...(options.headers || {}) },
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

function renderTechnicalProposalSummary(proposals = []) {
  const node = document.getElementById("technicalProposalSummary");
  if (!node) return;
  const counts = proposals.reduce((acc, item) => {
    const risk = String(item.riskLevel || "MEDIUM").toUpperCase();
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, { LOW: 0, MEDIUM: 0, HIGH: 0 });
  const workflowCounts = proposals.reduce((acc, item) => {
    const state = String(item.status || "SUBMITTED").toUpperCase();
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});
  node.textContent = `Baixo: ${counts.LOW || 0} · Médio: ${counts.MEDIUM || 0} · Alto: ${counts.HIGH || 0} · Draft: ${workflowCounts.DRAFT || 0} · Submetida: ${workflowCounts.SUBMITTED || 0} · Em revisão: ${workflowCounts.IN_REVIEW || 0} · Pedida info: ${workflowCounts.NEEDS_INFO || 0} · Aprovada: ${workflowCounts.APPROVED || 0} · Rejeitada: ${workflowCounts.REJECTED || 0}`;
}

function proposalWorkflowActions(proposal) {
  const state = String(proposal?.status || "SUBMITTED").toUpperCase();
  if (state === "DRAFT") return [{ to: "SUBMITTED", label: "Submeter" }];
  if (state === "SUBMITTED") return [
    { to: "IN_REVIEW", label: "Iniciar revisão" },
    { to: "NEEDS_INFO", label: "Pedir informação" },
    { to: "REJECTED", label: "Rejeitar" },
  ];
  if (state === "IN_REVIEW") return [
    { to: "APPROVED", label: "Aprovar" },
    { to: "NEEDS_INFO", label: "Pedir informação" },
    { to: "REJECTED", label: "Rejeitar" },
  ];
  if (state === "NEEDS_INFO") return [{ to: "IN_REVIEW", label: "Retomar revisão" }];
  return [];
}

function renderTechnicalProposalList(proposals = []) {
  const list = document.getElementById("technicalProposalAdminList");
  if (!list) return;
  if (!proposals.length) {
    list.innerHTML = '<div class="muted">Sem propostas submetidas para esta piscina.</div>';
    return;
  }

  list.innerHTML = proposals.map((proposal) => {
    const when = formatDate(proposal.submittedAt || proposal.createdAt);
    const changes = Array.isArray(proposal.changes) ? proposal.changes : [];
    const photos = Array.isArray(proposal.photos) ? proposal.photos : [];
    const changeLines = changes.slice(0, 4).map((change) => `<li>${esc(change.field)}: ${esc(change.before ?? "-")} -> ${esc(change.after ?? "-")}</li>`).join("");
    const photoLines = photos.length
      ? `<ul>${photos.slice(0, 4).map((url) => `<li><a class="btn" href="${esc(url)}" target="_blank" rel="noreferrer noopener">Foto</a></li>`).join("")}</ul>`
      : '<span class="muted">Sem fotos</span>';
    const diffRows = Array.isArray(proposal.diff) ? proposal.diff : [];
    const diffHtml = diffRows.length
      ? `<table style="width:100%;border-collapse:collapse;margin:6px 0"><thead><tr><th style="text-align:left">Campo</th><th style="text-align:left">Antes</th><th style="text-align:left">Atual</th><th style="text-align:left">Depois</th></tr></thead><tbody>${diffRows.map((item) => `<tr><td>${esc(item.field || "-")}</td><td>${esc(item.effectiveBefore ?? "-")}</td><td>${esc(item.current ?? "-")}${item.hasDrift ? ' ⚠' : ''}</td><td>${esc(item.after ?? "-")}</td></tr>`).join("")}</tbody></table>`
      : '<div class="muted">Sem alterações para diff.</div>';
    const immutableBadge = proposal.immutable
      ? `<div class="muted">Histórico imutável: ${proposal.immutable.chainValid ? "válido" : "inválido"} · eventos ${proposal.immutable.totalEvents || 0}</div>`
      : '<div class="muted">Histórico imutável por carregar.</div>';
    const checked = proposalSelection.has(Number(proposal.id)) ? "checked" : "";
    const actions = proposalWorkflowActions(proposal)
      .map((item) => `<button type="button" class="btn" data-proposal-transition="${esc(item.to)}" data-proposal-id="${esc(proposal.id)}">${esc(item.label)}</button>`)
      .join(" ");
    return `
      <div class="timeline-item" data-technical-proposal-id="${esc(proposal.id)}">
        <label style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><input type="checkbox" data-proposal-select="${esc(proposal.id)}" ${checked}>Selecionar</label>
        <strong>${esc(proposal.riskLevel || "MEDIUM")} · ${esc(proposal.status || "SUBMITTED")}</strong>
        <span>${when}</span>
        <p><b>Motivo:</b> ${esc(proposal.reason || "-")}</p>
        <p><b>Técnico:</b> ${esc(proposal.actor || "-")}</p>
        ${proposal.reviewedBy ? `<p><b>Revisor:</b> ${esc(proposal.reviewedBy)} (${esc(formatDate(proposal.reviewedAt))})</p>` : ""}
        ${proposal.reviewNote ? `<p><b>Nota workflow:</b> ${esc(proposal.reviewNote)}</p>` : ""}
        <p><b>Alterações:</b></p>
        <ul>${changeLines || "<li>Sem detalhe</li>"}</ul>
        <details style="margin:8px 0"><summary>Diff visual</summary>${diffHtml}</details>
        <details style="margin:8px 0"><summary>Histórico imutável</summary>${immutableBadge}<div class="muted" data-proposal-immutable-container="${esc(proposal.id)}"></div><button type="button" class="btn" data-proposal-load-history="${esc(proposal.id)}">Carregar histórico</button></details>
        <p><b>Fotos:</b> ${photoLines}</p>
        ${actions ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${actions}</div>` : '<span class="muted">Workflow finalizado</span>'}
      </div>
    `;
  }).join("");
}

function selectedProposalIds() {
  return Array.from(proposalSelection.values()).filter((value) => Number(value) > 0);
}

function setBatchStatus(message) {
  const node = document.getElementById("proposalBatchStatus");
  if (node) node.textContent = String(message || "");
}

async function runBatchTransition(nextStatus) {
  const ids = selectedProposalIds();
  if (!ids.length) {
    setBatchStatus("Seleciona pelo menos uma proposta para ação em lote.");
    return;
  }
  const needsNote = ["NEEDS_INFO", "REJECTED"].includes(String(nextStatus).toUpperCase());
  let note = "";
  if (needsNote) {
    note = String(window.prompt("Nota obrigatória para ação em lote:", "") || "").trim();
    if (!note) {
      setBatchStatus("Ação em lote cancelada: nota obrigatória.");
      return;
    }
  }
  const data = await req(`/pools/${poolId}/technical-change-proposals/workflow/batch`, {
    method: "POST",
    body: JSON.stringify({ nextStatus, note, proposalIds: ids }),
  });
  setBatchStatus(`Lote ${data.batchId || ""}: ${data.updatedCount || 0} atualizada(s), ${data.failedCount || 0} falha(s).`);
  proposalSelection = new Set();
  await loadTechnicalProposals();
}

async function loadProposalImmutableHistory(proposalId) {
  if (!poolId || !proposalId) return;
  const data = await req(`/pools/${poolId}/technical-change-proposals/${encodeURIComponent(proposalId)}/history`);
  const container = document.querySelector(`[data-proposal-immutable-container="${String(proposalId)}"]`);
  if (!container) return;
  const immutable = data.immutable || { events: [], chainValid: false };
  const rows = Array.isArray(immutable.events) ? immutable.events : [];
  container.innerHTML = `
    <div>Estado da cadeia: <b>${immutable.chainValid ? "válida" : "inválida"}</b> · eventos: ${rows.length}</div>
    <ul>${rows.map((item) => `<li>${esc(item.fromState || "INIT")} -> ${esc(item.toState || "-")} · ${esc(item.actor || "-")} · ${esc(formatDate(item.transitionedAt))} · hash ${esc((item.eventHash || "").slice(0, 12))}${item.valid ? "" : " ⚠"}</li>`).join("")}</ul>
  `;
}

async function transitionTechnicalProposal(proposalId, nextStatus) {
  if (!poolId || !proposalId || !nextStatus) return;
  const requireNote = ["NEEDS_INFO", "REJECTED"].includes(String(nextStatus).toUpperCase());
  let note = "";
  if (requireNote) {
    note = String(window.prompt("Nota obrigatória para esta transição:", "") || "").trim();
    if (!note) {
      ui.info("Transição cancelada: nota obrigatória.");
      return;
    }
  }
  await req(`/pools/${poolId}/technical-change-proposals/${encodeURIComponent(proposalId)}/workflow`, {
    method: "POST",
    body: JSON.stringify({ nextStatus, note }),
  });
  ui.success(`Proposta atualizada para ${nextStatus}.`);
  await loadTechnicalProposals();
}

async function loadTechnicalProposals() {
  if (!poolId) return;
  const data = await req(`/pools/${poolId}/technical-change-proposals`);
  const proposals = Array.isArray(data.proposals) ? data.proposals : [];
  const validIds = new Set(proposals.map((item) => Number(item.id)));
  proposalSelection = new Set(Array.from(proposalSelection).filter((item) => validIds.has(Number(item))));
  renderTechnicalProposalSummary(proposals);
  renderTechnicalProposalList(proposals);
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
  await loadTechnicalProposals();
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
  const ok = await ui.confirm("Eliminar este lembrete de servico? Esta acao nao remove historico tecnico nem visitas.", {
    title: "Confirmar eliminacao",
    confirmText: "Eliminar",
    danger: true,
  });
  if (!ok) return;
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
  document.getElementById("proposalSelectPendingBtn")?.addEventListener("click", async () => {
    const data = await req(`/pools/${poolId}/technical-change-proposals?onlyPending=true`);
    const proposals = Array.isArray(data.proposals) ? data.proposals : [];
    proposalSelection = new Set(proposals.map((item) => Number(item.id)));
    setBatchStatus(`${proposalSelection.size} proposta(s) pendente(s) selecionada(s).`);
    await loadTechnicalProposals();
  });
  document.getElementById("proposalBatchApproveBtn")?.addEventListener("click", () => runBatchTransition("APPROVED").catch((error) => setBatchStatus(error.message)));
  document.getElementById("proposalBatchReviewBtn")?.addEventListener("click", () => runBatchTransition("IN_REVIEW").catch((error) => setBatchStatus(error.message)));
  document.getElementById("proposalBatchNeedsInfoBtn")?.addEventListener("click", () => runBatchTransition("NEEDS_INFO").catch((error) => setBatchStatus(error.message)));
  document.getElementById("proposalBatchRejectBtn")?.addEventListener("click", () => runBatchTransition("REJECTED").catch((error) => setBatchStatus(error.message)));
  toggleCustomRepeat();

  document.addEventListener("click", (event) => {
    const selectionInput = event.target.closest("[data-proposal-select]");
    if (selectionInput) {
      const proposalId = Number(selectionInput.dataset.proposalSelect);
      if (selectionInput.checked) proposalSelection.add(proposalId);
      else proposalSelection.delete(proposalId);
      return;
    }

    const loadHistoryButton = event.target.closest("[data-proposal-load-history]");
    if (loadHistoryButton) {
      loadProposalImmutableHistory(loadHistoryButton.dataset.proposalLoadHistory).catch((error) => {
        setBatchStatus(error.message);
      });
      return;
    }

    const transitionButton = event.target.closest("[data-proposal-transition][data-proposal-id]");
    if (transitionButton) {
      transitionTechnicalProposal(transitionButton.dataset.proposalId, transitionButton.dataset.proposalTransition).catch((error) => {
        document.getElementById("status").textContent = error.message;
      });
      return;
    }

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
