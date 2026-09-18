const API = "/api";
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
  prompt: async () => null,
  safeError: (err, fallback) => (err && err.message) || fallback,
};

let alertsState = [];
let alertsLoaded = false;
let alertsRead = 0;
const alertsAuthorization = authHeaders().Authorization;
const alertResolutions = new Set();
let alertBilling;
let alertReportSelection = null;
const alertReports = window.CristalReportDownloads?.create({
  context: () => ({ read: alertsRead, selection: alertReportSelection }),
  state: (kind, message) => {
    const status = document.getElementById('alertReportStatus');
    if (status) { status.textContent = message; status.dataset.state = kind; }
    if (kind === 'session') document.querySelectorAll('[data-report-alert]').forEach(button => button.disabled = true);
  },
});
function invalidateAlertReport() {
  if (alertReportSelection) { alertReportSelection = null; alertReports?.cancel(); }
}
function reportForAlert(alert) {
  const report = alert?.report;
  return ['REGULAR', 'EXTRA'].includes(report?.type) && report.type === alert.visitType && Number.isSafeInteger(report.visitId) && report.visitId > 0 &&
    Number.isSafeInteger(report.clientId) && report.clientId > 0 && report.clientId === alert.clientId && report.visitId === alert.visitId ? report : null;
}
function openAlertReport(reference) {
  if (!alertsSessionCurrent() || !alertsLoaded || !alertReports) return;
  const alert = filteredAlerts().find(row => row.id === reference), report = reportForAlert(alert);
  if (!report) return;
  alertReportSelection = { reference, visitType: report.type, visitId: report.visitId, clientId: report.clientId };
  alertReports.open(`/api/report-visit/visit/${report.visitId}?${report.type === 'EXTRA' ? 'visitType=EXTRA&' : ''}view=admin&clientId=${report.clientId}`,
    { type: 'application/pdf', headers: { 'X-CW-Report-Type': report.type === 'EXTRA' ? 'extra-visit-pdf' : 'visit-pdf', 'X-CW-Visit-Type': report.type, 'X-CW-Visit-Id': report.visitId,
      'X-CW-Client-Id': report.clientId, 'X-CW-Report-View': 'admin' } });
}

let repairContextData = {
  clients: [],
  pools: [],
  contexts: [],
};

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalise(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw Object.assign(new Error(data.error || data.message || `Erro HTTP ${res.status}`), { status: res.status });
  }
  return data;
}

function extractVisitId(alert) {
  const direct = Number(alert?.visitId || alert?.serviceNote?.visitId || 0);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const text = [alert?.message, alert?.detailText, alert?.title].filter(Boolean).join(" ");
  const match = /\bvisita\s*#?\s*(\d+)\b/i.exec(text) || /\bvisit\s*#?\s*(\d+)\b/i.exec(text);
  const parsed = match ? Number(match[1]) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function productSummary(visit) {
  if (visit?.products) {
    const raw = String(visit.products);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item?.name)
          .map((item) => `${item.name} ${item.quantity ?? ""} ${item.unit || ""}`.trim())
          .join(", ");
      }
    } catch (_) {
      return raw;
    }
  }
  return (visit?.chemicals || [])
    .filter((item) => item?.name)
    .map((item) => `${item.name} ${item.quantity ?? ""} ${item.unit || ""}`.trim())
    .join(", ");
}

function mapVisitMedia(visit) {
  const photos = (visit?.photos || []).map((photo) => ({
    id: photo.id,
    url: photo.url,
    name: photo.type || "Foto da visita",
    isImage: true,
  }));
  const attachments = (visit?.attachments || []).map((file) => ({
    id: file.id,
    url: file.fileUrl,
    name: file.fileName || "Anexo",
    mimeType: file.mimeType || "",
    isImage: /^image\//i.test(file.mimeType || "") || /\.(png|jpe?g|webp|gif)$/i.test(file.fileUrl || ""),
  }));
  return [...photos, ...attachments].filter((item) => item.url);
}

function buildServiceNoteFromVisit(visit) {
  if (!visit?.id) return null;
  const readings = [
    ["pH", visit.ph],
    ["Cloro", visit.chlorine],
    ["Alcalinidade", visit.alkalinity],
    ["ORP", visit.orpMv],
    ["Sal", visit.salt],
    ["Temperatura", visit.temperature],
  ]
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => ({ label, value }));

  return {
    visitId: visit.id,
    href: `/api/reports/visit/${visit.id}`,
    status: visit.status || null,
    date: visit.endAt || visit.startAt || visit.plannedDate || visit.date || visit.updatedAt || visit.createdAt,
    reason: visit.reason || "",
    alerts: visit.alerts || "",
    notes: visit.notes || "",
    internalNotes: visit.internalNotes || "",
    products: productSummary(visit),
    readings,
    photos: mapVisitMedia(visit).filter((item) => item.isImage),
    attachments: mapVisitMedia(visit).filter((item) => !item.isImage),
  };
}

function mergeAlertVisit(alert, visit) {
  if (!visit?.id) return alert;
  const serviceNote = alert.serviceNote || buildServiceNoteFromVisit(visit);
  const media = alert.media?.length ? alert.media : mapVisitMedia(visit);
  return {
    ...alert,
    visitId: alert.visitId || visit.id,
    visitHref: alert.visitHref || `/admin-visits?visitId=${visit.id}`,
    technicianId: alert.technicianId || visit.technicianId || null,
    technicianName: alert.technicianName || visit.technician?.name || visit.technicianName || "",
    clientId: alert.clientId || visit.clientId || visit.pool?.clientId || visit.pool?.client?.id || null,
    clientName: alert.clientName || visit.client?.name || visit.pool?.client?.name || "",
    poolId: alert.poolId || visit.poolId || visit.pool?.id || null,
    poolName: alert.poolName || visit.pool?.name || "",
    serviceNote,
    media,
    hasServiceNote: true,
    detailText: [
      alert.detailText,
      alert.message,
      serviceNote?.alerts,
      serviceNote?.reason,
      serviceNote?.notes,
      serviceNote?.products,
    ].filter(Boolean).join("\n"),
  };
}

async function enrichAlertsWithVisits(alerts) {
  const legacy = alert => !Object.prototype.hasOwnProperty.call(alert, 'serviceNote') && (!alert.visitType || alert.visitType === 'REGULAR');
  const ids = Array.from(new Set((alerts || []).filter(legacy).map(extractVisitId).filter(Boolean)));
  if (!ids.length) return alerts;

  const pairs = await Promise.all(ids.slice(0, 80).map(async (id) => {
    try {
      const data = await fetchJSON(`${API}/visits/${encodeURIComponent(id)}`, { headers: { Authorization: alertsAuthorization } });
      return [id, data.visit || null];
    } catch (_) {
      return [id, null];
    }
  }));
  const visits = new Map(pairs.filter(([, visit]) => visit?.id));
  if (!visits.size) {
    return alerts.map((alert) => {
      if (!legacy(alert)) return alert;
      const visitId = extractVisitId(alert);
      return visitId ? { ...alert, visitId, visitHref: `/admin-visits?visitId=${visitId}` } : alert;
    });
  }

  return alerts.map((alert) => {
    if (!legacy(alert)) return alert;
    const visitId = extractVisitId(alert);
    return visitId && visits.has(visitId) ? mergeAlertVisit(alert, visits.get(visitId)) : alert;
  });
}

function setStatus(message, tone = "info") {
  const el = document.getElementById("alertsStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `alerts-status ${tone}`;
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("pt-PT") : "-";
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function priorityLabel(priority) {
  const value = String(priority || "NORMAL").toUpperCase();
  if (value === "CRITICAL") return "Critico";
  if (value === "WARNING") return "Atencao";
  if (value === "LOW") return "Baixo";
  return "Normal";
}

function sourceLabel(source) {
  return {
    notification: "Notificacao",
    technical: "Tecnico",
    visit: "Visita",
    generic: "Sistema",
  }[source] || "Sistema";
}

function getFilters() {
  return {
    query: document.getElementById("alertSearch")?.value || "",
    priority: document.getElementById("alertPriorityFilter")?.value || "",
    source: document.getElementById("alertSourceFilter")?.value || "",
  };
}

function setFilterFromQuery(id, value) {
  const el = document.getElementById(id);
  if (!el || !value) return;
  const hasOption = Array.from(el.options || []).some((option) => option.value === value);
  if (hasOption) el.value = value;
}

function applyQueryFilters() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || params.get("query") || "";
  const priority = (params.get("priority") || "").toUpperCase();
  const source = (params.get("source") || "").toLowerCase();

  const search = document.getElementById("alertSearch");
  if (search && query) search.value = query;

  setFilterFromQuery("alertPriorityFilter", priority);
  setFilterFromQuery("alertSourceFilter", source);
}

function alertSearchText(alert) {
  const note = alert.serviceNote || {};
  const repair = alert.repair || {};
  return [
    alert.title,
    alert.message,
    alert.detailText,
    alert.clientName,
    alert.poolName,
    alert.technicianName,
    alert.type,
    alert.eventType,
    alert.status,
    note.alerts,
    note.reason,
    note.notes,
    note.internalNotes,
    note.products,
    repair.problem,
    repair.notes,
    alert.problemText,
  ].join(" ");
}

function filteredAlerts() {
  const filters = getFilters();
  const query = normalise(filters.query);
  return alertsState.filter((alert) => {
    if (filters.priority && alert.priority !== filters.priority) return false;
    if (filters.source && alert.source !== filters.source) return false;
    if (query) {
      const haystack = normalise(alertSearchText(alert));
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function renderReadings(readings = []) {
  if (!readings.length) return "";
  return `
    <div class="alert-readings">
      ${readings.map((item) => `
        <span><b>${escapeHtml(item.label)}:</b> ${escapeHtml(item.value)}</span>
      `).join("")}
    </div>
  `;
}

function renderMedia(media = []) {
  if (!media.length) return "";
  return `
    <div class="alert-media">
      ${media.slice(0, 6).map((item) => item.isImage ? `
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" title="${escapeHtml(item.name || "Imagem")}">
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || "Imagem do alerta")}">
        </a>
      ` : `
        <a class="attachment-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.name || "Anexo")}</a>
      `).join("")}
    </div>
  `;
}

function hasGenericVisitProblemText(alert) {
  const text = String(alert.problemText || alert.message || "").trim();
  return /^Problema tecnico reportado na visita\s+\d+$/i.test(text);
}

function renderAlertDetails(alert) {
  const note = alert.serviceNote || null;
  const repair = alert.repair || null;
  const detailRows = [];

  if (alert.problemText || alert.message) detailRows.push(["Problema reportado", alert.problemText || alert.message]);
  if (hasGenericVisitProblemText(alert) && !note?.alerts && !repair?.problem) {
    detailRows.push(["Descricao tecnica", "Este alerta antigo nao gravou a descricao detalhada do problema. A visita associada fica aberta para consulta/correcao."]);
  }
  if (note?.alerts) detailRows.push(["Problema registado", note.alerts]);
  if (note?.reason) detailRows.push(["Motivo", note.reason]);
  if (note?.notes) detailRows.push(["Nota do tecnico", note.notes]);
  if (note?.planningNotes) detailRows.push(["Indicações de planeamento", note.planningNotes]);
  if (note?.internalNotes) detailRows.push(["Nota interna", note.internalNotes]);
  if (note?.products) detailRows.push(["Produtos", note.products]);
  if (repair?.problem) detailRows.push(["Reparacao", repair.problem]);
  if (repair?.notes) detailRows.push(["Nota da reparacao", repair.notes]);

  const repairMeta = repair ? [
    repair.status ? `Estado: ${repair.status}` : null,
    repair.priority ? `Prioridade: ${repair.priority}` : null,
    repair.totalPrice != null ? `Valor: ${formatMoney(repair.totalPrice)}` : null,
  ].filter(Boolean).join(" · ") : "";

  if (!detailRows.length && !note?.readings?.length && !alert.media?.length) {
    return `
      <div class="alert-detail empty">
        Este alerta ainda nao tem nota tecnica, foto ou relatorio associado. Se veio de uma visita, abre a ficha para completar a descricao do problema.
      </div>
    `;
  }

  return `
    <div class="alert-detail">
      ${detailRows.map(([label, value]) => `
        <div class="detail-row">
          <b>${escapeHtml(label)}</b>
          <span>${escapeHtml(value)}</span>
        </div>
      `).join("")}
      ${repairMeta ? `<div class="detail-row compact"><b>Reparacao</b><span>${escapeHtml(repairMeta)}</span></div>` : ""}
      ${renderReadings(note?.readings || [])}
      ${renderMedia(alert.media || [])}
    </div>
  `;
}

function renderMetrics(alerts) {
  const critical = alerts.filter((alert) => alert.priority === "CRITICAL").length;
  const technical = alerts.filter((alert) => alert.source === "technical").length;
  const visits = alerts.filter((alert) => alert.source === "visit").length;
  const notifications = alerts.filter((alert) => alert.source === "notification").length;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set("alertsTotal", alerts.length);
  set("alertsCritical", critical);
  set("alertsTechnical", technical);
  set("alertsVisits", visits);
  set("alertsNotifications", notifications);
}

function setRepairModalStatus(message, tone = "info") {
  const el = document.getElementById("repairModalStatus");
  if (!el) return;
  el.hidden = !message;
  if (!message) {
    el.textContent = "";
    el.className = "alerts-status";
    return;
  }
  el.textContent = message;
  el.className = `alerts-status ${tone}`;
}

function setSelectOptions(id, options, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  const previous = el.value;
  const rows = [`<option value="">${escapeHtml(placeholder)}</option>`]
    .concat((options || []).map((option) => `<option value="${escapeHtml(String(option.value))}">${escapeHtml(option.label)}</option>`));
  el.innerHTML = rows.join("");
  if ((options || []).some((option) => String(option.value) === String(previous))) {
    el.value = previous;
  }
}

function isActiveClient(client) {
  return client && client.active !== false && String(client.status || "").toUpperCase() !== "ARCHIVED";
}

function isActivePool(pool) {
  return pool && pool.active !== false && String(pool.status || "").toUpperCase() !== "ARCHIVED";
}

async function loadRepairReferenceData() {
  const [clientsData, poolsData] = await Promise.all([
    fetchJSON(`${API}/core/clients`).catch(() => ({ clients: [] })),
    fetchJSON(`${API}/core/pools`).catch(() => ({ pools: [] })),
  ]);

  const clients = Array.isArray(clientsData.clients)
    ? clientsData.clients.filter((client) => isActiveClient(client))
    : [];
  const pools = Array.isArray(poolsData.pools)
    ? poolsData.pools.filter((pool) => isActivePool(pool) && Number(pool.id) > 0)
    : [];

  repairContextData.clients = clients;
  repairContextData.pools = pools;
}

function buildRepairContextsFromAlerts() {
  const seen = new Set();
  const contexts = [];

  alertsState.forEach((alert) => {
    const poolId = Number(alert.poolId || 0);
    if (!poolId || alert.repairId) return;
    const key = `${alert.id || "unknown"}:${poolId}`;
    if (seen.has(key)) return;
    seen.add(key);

    const clientId = Number(alert.clientId || 0) || null;
    const visitId = Number(alert.visitId || 0) || null;
    const poolName = alert.poolName || `Piscina #${poolId}`;
    const clientName = alert.clientName || "Sem cliente";
    const problemFromAlert = [alert.problemText, alert.message, alert.serviceNote?.alerts].find((item) => String(item || "").trim()) || "";
    const sourceText = visitId ? `Visita #${visitId}` : `Alerta #${alert.id || "-"}`;

    contexts.push({
      contextId: `alert:${alert.id || key}`,
      alertId: alert.id || null,
      visitId,
      poolId,
      clientId,
      poolName,
      clientName,
      problemFromAlert,
      label: `${sourceText} - ${clientName} - ${poolName}`,
    });
  });

  repairContextData.contexts = contexts;
}

function poolLabel(pool) {
  const clientName = pool.client?.name || "Sem cliente";
  const type = pool.type ? String(pool.type).toUpperCase() : "POOL";
  return `${pool.name || `Piscina #${pool.id}`} - ${clientName} - ${type}`;
}

function renderClientOptions() {
  setSelectOptions(
    "repairClientSelect",
    repairContextData.clients.map((client) => ({ value: client.id, label: client.name || `Cliente #${client.id}` })),
    "Selecionar cliente"
  );
}

function renderContextOptions() {
  setSelectOptions(
    "repairContextSelect",
    repairContextData.contexts.map((context) => ({ value: context.contextId, label: context.label })),
    "Selecionar contexto manualmente"
  );
}

function renderPoolOptions(clientId = null) {
  const parsedClientId = Number(clientId || 0) || null;
  const pools = repairContextData.pools.filter((pool) => {
    if (!parsedClientId) return true;
    return Number(pool.client?.id || pool.clientId || 0) === parsedClientId;
  });
  setSelectOptions(
    "repairPoolSelect",
    pools.map((pool) => ({ value: pool.id, label: poolLabel(pool) })),
    parsedClientId ? "Selecionar piscina/jacuzzi do cliente" : "Selecionar piscina/jacuzzi"
  );
}

function openRepairModal() {
  document.getElementById("repairModal")?.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
  setRepairModalStatus("");
  document.getElementById("repairProblemInput")?.focus();
}

function closeRepairModal() {
  document.getElementById("repairModal")?.setAttribute("hidden", "hidden");
  document.body.style.overflow = "";
  const form = document.getElementById("repairCreateForm");
  if (form) form.reset();
  renderPoolOptions(null);
  setRepairModalStatus("");
}

function selectedRepairContext() {
  const contextId = document.getElementById("repairContextSelect")?.value || "";
  return repairContextData.contexts.find((context) => context.contextId === contextId) || null;
}

function applyContextToForm(context) {
  if (!context) return;
  const clientSelect = document.getElementById("repairClientSelect");
  const poolSelect = document.getElementById("repairPoolSelect");
  const problemInput = document.getElementById("repairProblemInput");

  if (clientSelect && context.clientId) {
    clientSelect.value = String(context.clientId);
  }

  renderPoolOptions(context.clientId || null);

  if (poolSelect && context.poolId) {
    poolSelect.value = String(context.poolId);
  }

  if (problemInput && !String(problemInput.value || "").trim() && context.problemFromAlert) {
    problemInput.value = context.problemFromAlert;
  }
}

function getSelectedPoolClientId(poolId) {
  const pool = repairContextData.pools.find((item) => Number(item.id) === Number(poolId));
  return Number(pool?.client?.id || pool?.clientId || 0) || null;
}

async function createRepairFromModal(event) {
  event.preventDefault();

  const context = selectedRepairContext();
  const clientId = Number(document.getElementById("repairClientSelect")?.value || 0) || null;
  const poolId = Number(document.getElementById("repairPoolSelect")?.value || 0) || null;
  const problem = String(document.getElementById("repairProblemInput")?.value || "").trim();
  const priority = String(document.getElementById("repairPrioritySelect")?.value || "").trim();
  const notesInput = String(document.getElementById("repairNotesInput")?.value || "").trim();
  const resolveAlert = Boolean(document.getElementById("repairResolveAlert")?.checked);
  const resolutionTarget = resolveAlert && context?.alertId ? alertsState.find(row => row.id === context.alertId) : null;
  if (resolveAlert && context?.alertId && (!resolutionTarget?.resolutionVersion || alertResolutions.size)) {
    setRepairModalStatus("Atualize os alertas antes de criar e resolver a reparacao.", "error");
    return;
  }
  if (resolutionTarget?.resolutionRequirement) {
    setRepairModalStatus(resolutionTarget.resolutionRequirement.message, "error");
    return;
  }

  if (!poolId) {
    setRepairModalStatus("Seleciona a piscina/jacuzzi para garantir contexto operacional.", "error");
    return;
  }

  const inferredClientId = clientId || getSelectedPoolClientId(poolId) || context?.clientId || null;
  if (!context && !inferredClientId) {
    setRepairModalStatus("Seleciona cliente e piscina, ou escolhe um contexto de alerta/visita.", "error");
    return;
  }

  if (!problem) {
    setRepairModalStatus("Descreve o problema tecnico antes de criar a reparacao.", "error");
    return;
  }

  const contextNotes = [
    context?.alertId ? `Origem: alerta #${context.alertId}` : null,
    context?.visitId ? `Visita: #${context.visitId}` : null,
    notesInput || null,
  ].filter(Boolean).join(" | ");

  const payload = {
    poolId,
    problem,
    notes: contextNotes || null,
  };

  if (priority) payload.priority = priority;

  const submitBtn = document.getElementById("repairSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;
  setRepairModalStatus("A criar reparacao...", "info");
  if (resolutionTarget) { alertResolutions.add(resolutionTarget.id); updateResolutionButtons(); }

  try {
    const data = await fetchJSON(`${API}/repairs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    closeRepairModal();
    if (resolutionTarget) {
      try { await requestAlertResolution(resolutionTarget); }
      catch (_) {
        if (alertsSessionCurrent()) setStatus(`Reparacao #${data.repair?.id || "-"} criada. A resolucao do alerta nao foi confirmada; atualize os alertas e trate o aviso.`, "error");
        return;
      }
    }
    const refreshed = await loadAlerts();
    ui.success(`Reparacao #${data.repair?.id || "-"} criada com sucesso.`);
    if (refreshed) setStatus("Reparacao criada e fila atualizada.", "ok");
  } catch (err) {
    setRepairModalStatus(err.message || "Erro ao criar reparacao.", "error");
  } finally {
    if (resolutionTarget) { alertResolutions.delete(resolutionTarget.id); updateResolutionButtons(); }
    if (submitBtn) submitBtn.disabled = false;
  }
}

function setupRepairModal() {
  const openBtn = document.getElementById("openRepairModal");
  const cancelBtn = document.getElementById("repairCancelBtn");
  const form = document.getElementById("repairCreateForm");
  const clientSelect = document.getElementById("repairClientSelect");
  const contextSelect = document.getElementById("repairContextSelect");
  const modal = document.getElementById("repairModal");

  openBtn?.addEventListener("click", async () => {
    try {
      setStatus("A preparar contexto para nova reparacao...");
      await loadRepairReferenceData();
      buildRepairContextsFromAlerts();
      renderClientOptions();
      renderPoolOptions(null);
      renderContextOptions();
      openRepairModal();
      setStatus("Contexto carregado.", "ok");
    } catch (err) {
      setStatus(err.message || "Erro ao preparar contexto da reparacao.", "error");
    }
  });

  cancelBtn?.addEventListener("click", closeRepairModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeRepairModal();
  });

  contextSelect?.addEventListener("change", () => {
    const context = selectedRepairContext();
    applyContextToForm(context);
    setRepairModalStatus("");
  });

  clientSelect?.addEventListener("change", () => {
    const selectedClientId = Number(clientSelect.value || 0) || null;
    renderPoolOptions(selectedClientId);
    setRepairModalStatus("");
  });

  form?.addEventListener("submit", createRepairFromModal);
}

function renderList() {
  invalidateAlertReport();
  const list = document.getElementById("alertsList");
  const summary = document.getElementById("alertsSummary");
  if (!list) return;

  if (!alertsLoaded) {
    for (const id of ["alertsTotal", "alertsCritical", "alertsTechnical", "alertsVisits", "alertsNotifications"]) {
      const metric = document.getElementById(id);
      if (metric) metric.textContent = "—";
    }
    if (summary) summary.textContent = "Alertas por confirmar";
    list.innerHTML = '<div class="empty-alerts"><strong>Atualize para consultar os alertas.</strong></div>';
    return;
  }

  const alerts = filteredAlerts();
  renderMetrics(alerts);

  if (summary) {
    summary.textContent = `${alerts.length} de ${alertsState.length} alerta(s) visiveis`;
  }

  if (!alertsState.length) {
    list.innerHTML = `
      <div class="empty-alerts">
        <strong>Sem alertas abertos.</strong>
        <span>Quando um tecnico reportar um problema, uma visita falhar, houver stock critico ou notificacao critica, aparece aqui.</span>
      </div>
    `;
    return;
  }

  if (!alerts.length) {
    list.innerHTML = `<div class="empty-alerts"><strong>Nenhum alerta corresponde aos filtros.</strong></div>`;
    return;
  }

  list.innerHTML = alerts.map((alert) => `
    <article class="card" data-alert-priority="${escapeHtml(String(alert.priority || "NORMAL").toLowerCase())}">
      <div class="alert-main">
        <div class="alert-topline">
          <span class="alert-source">${escapeHtml(sourceLabel(alert.source))}</span>
          <span class="alert-priority">${escapeHtml(priorityLabel(alert.priority))}</span>
          <span class="alert-status">${escapeHtml(alert.status || "OPEN")}</span>
        </div>
        <h3>${escapeHtml(alert.title || "Alerta")}</h3>
        <p>${escapeHtml(alert.message || "")}</p>
        ${renderAlertDetails(alert)}
        <div class="alert-meta">
          <span><b>Cliente:</b> ${escapeHtml(alert.clientName || "Sem cliente")}</span>
          <span><b>Piscina/Jacuzzi:</b> ${escapeHtml(alert.poolName || "Nao associado")}</span>
          <span class="${alert.technicianName ? "" : "missing"}"><b>${alert.visitType === "EXTRA" ? "Técnico associado" : "Reportado por"}:</b> ${escapeHtml(alert.technicianName || "Tecnico por identificar")}</span>
          <span><b>Data:</b> ${escapeHtml(formatDate(alert.createdAt))}</span>
          ${alert.visitId ? `<span><b>Visita${alert.visitType === "EXTRA" ? " extra" : ""}:</b> #${escapeHtml(alert.visitId)}</span>` : ""}
          ${alert.repairId ? `<span><b>Reparacao:</b> #${escapeHtml(alert.repairId)}</span>` : ""}
        </div>
      </div>
      <div class="alert-actions">
        ${alert.href ? `<a class="btn" href="${escapeHtml(alert.href)}">Abrir ficha</a>` : ""}
        ${alert.visitHref ? `<a class="btn note" href="${escapeHtml(alert.visitHref)}">Abrir visita</a>` : ""}
        ${reportForAlert(alert) ? `<button class="btn" type="button" data-report-alert="${escapeHtml(alert.id)}" ${alertReports ? "" : "disabled"}>Abrir relatório${alert.report.type === "EXTRA" ? " extra" : ""}</button>` : alert.serviceNote || alert.visitId ? `<p>Relatório por confirmar: reveja a associação da visita.</p>` : ""}
        <button type="button" data-charge-alert="${escapeHtml(alert.id)}">Preparar rascunho</button>
        ${alert.resolutionRequirement ? `<p>${escapeHtml(alert.resolutionRequirement.message)}</p>` : ''}
        <button type="button" class="resolve" data-resolve-alert="${escapeHtml(alert.id)}" ${alertResolutions.size ? 'disabled' : ''}>${alert.resolutionRequirement ? 'Verificar resolucao' : 'Resolver'}</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-resolve-alert]").forEach((btn) => {
    btn.addEventListener("click", () => resolveAlert(btn.dataset.resolveAlert));
  });
  list.querySelectorAll("[data-charge-alert]").forEach((btn) => {
    btn.addEventListener("click", () => chargeAlert(btn.dataset.chargeAlert));
  });
  list.querySelectorAll("[data-report-alert]").forEach(button => button.addEventListener("click", () => openAlertReport(button.dataset.reportAlert)));
  updateResolutionButtons();
}

async function loadAlerts() {
  invalidateAlertReport();
  const own = ++alertsRead;
  const current = () => own === alertsRead && alertsSessionCurrent();
  if (!alertsSessionCurrent()) return false;
  try {
    setStatus("A carregar alertas...");
    const data = await fetchJSON(`${API}/alerts`, { headers: { Authorization: alertsAuthorization } });
    if (!current()) return false;
    if (data.ok !== true || !Array.isArray(data.alerts) || data.count !== data.alerts.length ||
      data.alerts.some(row => !row || !/^(notification|technical|visit|generic)-[1-9]\d*$/.test(row.id) ||
        row.id !== `${row.source}-${row.numericId}` || !["CRITICAL", "WARNING", "NORMAL", "LOW"].includes(row.priority)) ||
      new Set(data.alerts.map(row => row.id)).size !== data.alerts.length) throw Error("Resposta de alertas invalida");
    const rows = await enrichAlertsWithVisits(data.alerts);
    if (!current()) return false;
    alertsState = rows;
    alertsLoaded = true;
    renderList();
    setStatus(alertsState.length ? "Alertas carregados." : "Nao existem alertas abertos.", alertsState.length ? "info" : "ok");
    return true;
  } catch (err) {
    if (!current()) return false;
    renderList();
    setStatus(alertsLoaded ? "Nao foi possivel atualizar. Os alertas apresentados sao da ultima consulta; volte a atualizar." : "Nao foi possivel consultar os alertas. Volte a atualizar.", "error");
    return false;
  }
}

function alertsSessionCurrent() {
  if (authHeaders().Authorization === alertsAuthorization) return true;
  alertsRead++;
  alertsState = [];
  alertsLoaded = false;
  alertBilling?.hide();
  renderList();
  setStatus("A sessao mudou. Reabra esta pagina para consultar os alertas.", "error");
  return false;
}
window.addEventListener("storage", event => {
  if (event.key === "token" || event.key === null) alertsSessionCurrent();
});

async function resolveAlert(id) {
  if (alertResolutions.size || !alertsSessionCurrent()) return;
  const target = alertsState.find(row => row.id === id);
  if (!target || !/^[a-f0-9]{64}$/.test(target.resolutionVersion || '')) {
    setStatus("Atualize os alertas antes de confirmar a resolucao.", "error"); return;
  }
  alertResolutions.add(id);
  updateResolutionButtons();
  try {
    const ok = await ui.confirm("Marcar este alerta como resolvido?", {
      title: "Confirmar resolucao", confirmText: "Resolver",
      details: [target.resolutionRequirement?.message, target.title, target.poolName, target.message].filter(Boolean).join('\n'),
    });
    if (!ok || !alertsSessionCurrent()) return;
    if (alertsState.find(row => row.id === id)?.resolutionVersion !== target.resolutionVersion) {
      setStatus("O alerta foi alterado. Atualize a lista e confirme novamente.", "error"); return;
    }
    setStatus("A resolver alerta...");
    await requestAlertResolution(target);
    if (await loadAlerts()) setStatus("Alerta resolvido e retirado da lista aberta.", "ok");
    else if (alertsSessionCurrent()) setStatus("Alerta resolvido. Nao foi possivel atualizar os restantes alertas; volte a atualizar.", "error");
  } catch (err) {
    if (!alertsSessionCurrent()) return;
    if ([400, 404, 409].includes(err.status)) {
      await loadAlerts();
      if (alertsSessionCurrent()) setStatus(err.message, "error");
    } else setStatus("Nao foi possivel confirmar a resolucao. Volte a tentar neste mesmo alerta.", "error");
  } finally {
    alertResolutions.delete(id);
    updateResolutionButtons();
  }
}

function updateResolutionButtons() {
  document.querySelectorAll('[data-resolve-alert]').forEach(button => {
    button.disabled = alertResolutions.size > 0;
  });
  alertBilling?.render();
}

async function requestAlertResolution(target) {
  if (!alertsSessionCurrent()) throw Error('Sessao alterada');
  alertsRead++;
  const result = await fetchJSON(`${API}/alerts/${encodeURIComponent(target.id)}/resolve`, {
    method: "PUT", headers: { Authorization: alertsAuthorization }, body: JSON.stringify({ expectedVersion: target.resolutionVersion }),
  });
  if (!alertsSessionCurrent()) throw Error('Sessao alterada');
  if (result.ok !== true || result.resolved !== true || result.reference !== target.id || result.source !== target.source ||
    result.numericId !== target.numericId || result.sourceVersion !== target.resolutionVersion ||
    !/^[a-f0-9]{64}$/.test(result.resolvedVersion || '') || typeof result.resolvedAt !== 'string' ||
    !Number.isFinite(Date.parse(result.resolvedAt)) || new Date(result.resolvedAt).toISOString() !== result.resolvedAt) throw Error('Confirmacao invalida');
  alertsRead++;
  alertsState = alertsState.filter(row => row.id !== target.id || row.resolutionVersion !== target.resolutionVersion);
  renderList();
  return result;
}

async function chargeAlert(id) {
  return alertBilling?.submit(id);
}

function setupAlertBilling() {
  let owner, key, pending = null, blocked = false, issue = '';
  const panel = document.createElement('div'), summary = document.createElement('p');
  const retry = document.createElement('button'), review = document.createElement('button');
  panel.id = 'alertBillingPending'; panel.setAttribute('data-cw-no-i18n', 'true');
  panel.style.cssText = 'margin:12px 0;overflow-wrap:anywhere';
  retry.type = review.type = 'button'; retry.textContent = 'Repetir confirmação'; review.textContent = 'Rever alerta';
  panel.append(summary, retry, review); document.getElementById('alertsStatus').after(panel);
  const positive = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
  const reference = value => typeof value === 'string' && /^(technical|notification|visit|generic)-[1-9]\d*$/.test(value) && positive(Number(value.split('-')[1]));
  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      const record = JSON.parse(raw);
      if (record?.schema !== 1 || record.owner !== owner || !/^[a-f0-9-]{36}$/.test(record.requestId || '') ||
        !reference(record.reference) || !positive(record.clientId) || !positive(record.amountCents) ||
        !/^[a-f0-9]{64}$/.test(record.expectedVersion || '') || typeof record.details !== 'string' ||
        (record.rejection && (![400, 404, 409].includes(record.rejection.status) || typeof record.rejection.message !== 'string'))) throw Error();
      return record;
    } catch (_) { blocked = true; issue = 'O pedido guardado nao pode ser lido. Foi conservado para revisao; nenhum novo pedido sera enviado.'; throw Error(issue); }
  }
  function render() {
    const sameSession = authHeaders().Authorization === alertsAuthorization;
    const busy = alertResolutions.size > 0;
    panel.hidden = !sameSession || (!pending && !blocked);
    if (pending && sameSession) summary.textContent = `${pending.rejection ? pending.rejection.message : 'Pedido por confirmar'}\n${pending.details}\n${(pending.amountCents / 100).toFixed(2)} EUR`;
    if (blocked && sameSession) summary.textContent = issue;
    summary.style.whiteSpace = 'pre-line';
    retry.hidden = blocked || !pending;
    retry.disabled = busy || blocked || Boolean(pending?.rejection);
    review.hidden = !pending?.rejection; review.disabled = busy || blocked;
    document.querySelectorAll('[data-charge-alert]').forEach(button => {
      button.disabled = !sameSession || busy || blocked || Boolean(pending);
    });
  }
  function forget(record) {
    if (read()?.requestId !== record.requestId) throw Error('O pedido mudou noutra janela. Atualize a pagina.');
    localStorage.removeItem(key); pending = null;
  }
  async function submit(id, discard = false) {
    if (blocked || alertResolutions.size || !alertsSessionCurrent()) return;
    if (!navigator.locks?.request || !crypto.randomUUID) { setStatus('Abra esta pagina num navegador atualizado para proteger os pedidos entre janelas.', 'error'); return; }
    alertResolutions.add('billing'); updateResolutionButtons();
    try {
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!alertsSessionCurrent()) return;
        if (!lock) { setStatus('Existe um pedido em curso noutra janela. Aguarde e atualize a pagina.', 'error'); return; }
        pending = read();
        if (discard) {
          if (pending?.rejection) { forget(pending); await loadAlerts(); }
          return;
        }
        if (pending && (id || pending.rejection)) { setStatus('Reveja o pedido guardado antes de preparar outro rascunho.', 'error'); return; }
        if (!pending) {
          if (!id) { setStatus('O pedido foi confirmado noutra janela. Consulte a faturacao.', 'info'); return; }
          const target = alertsState.find(row => row.id === id);
          if (!target || !positive(target.clientId) || !/^[a-f0-9]{64}$/.test(target.resolutionVersion || '')) throw Error('Atualize os alertas e confirme o cliente antes de preparar o rascunho.');
          const details = [target.clientName, target.poolName, target.title, target.message].filter(Boolean).join('\n');
          const price = await ui.prompt('Valor do extra a preparar (EUR)', { title: 'Preparar rascunho', confirmText: 'Continuar', defaultValue: '', details });
          if (price === null || price === '') return;
          const value = String(price).trim().replace(',', '.');
          if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw Error('Indique um valor positivo com ate duas casas decimais.');
          const [whole, part = ''] = value.split('.'), amountCents = Number(whole) * 100 + Number(part.padEnd(2, '0'));
          if (!positive(amountCents)) throw Error('Valor fora do intervalo permitido.');
          const confirmed = await ui.confirm(`Preparar um rascunho separado de ${(amountCents / 100).toFixed(2)} EUR para este cliente?`, {
            title: 'Confirmar rascunho', confirmText: 'Preparar rascunho', details,
          });
          if (!confirmed || !alertsSessionCurrent()) return;
          const latest = alertsState.find(row => row.id === id);
          if (latest?.resolutionVersion !== target.resolutionVersion || latest?.clientId !== target.clientId) throw Error('O alerta mudou. Atualize e confirme novamente.');
          const record = { schema: 1, owner, requestId: crypto.randomUUID(), reference: id, clientId: target.clientId,
            expectedVersion: target.resolutionVersion, amountCents, details };
          try { localStorage.setItem(key, JSON.stringify(record)); }
          catch (_) { throw Error('Nao foi possivel guardar o pedido neste navegador. Nenhum pedido foi enviado.'); }
          pending = read();
          if (JSON.stringify(pending) !== JSON.stringify(record)) throw Error('Nao foi possivel verificar o pedido guardado. Nenhum pedido foi enviado.');
        }
        const record = pending;
        render(); setStatus('A confirmar o rascunho...');
        try {
          const result = await fetchJSON(`${API}/alerts/${encodeURIComponent(record.reference)}/convert`, {
            method: 'POST', headers: { Authorization: alertsAuthorization }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ price: (record.amountCents / 100).toFixed(2), expectedClientId: record.clientId, expectedVersion: record.expectedVersion }),
          });
          if (!alertsSessionCurrent()) return;
          if (result.ok !== true || !positive(result.invoiceId) || !positive(result.invoiceLineId) || result.reference !== record.reference ||
            !reference(result.convertedReference) || result.clientId !== record.clientId || result.amountCents !== record.amountCents ||
            result.amount !== record.amountCents / 100 || result.status !== 'DRAFT' || typeof result.preparedAt !== 'string' ||
            !Number.isFinite(Date.parse(result.preparedAt)) || new Date(result.preparedAt).toISOString() !== result.preparedAt) throw Error('Confirmacao invalida');
          forget(record);
          setStatus(result.idempotent ? `Preparacao original confirmada no documento #${result.invoiceId}. Consulte o seu estado na faturacao.` : `Rascunho #${result.invoiceId} preparado. Reveja-o na faturacao antes de emitir.`, 'ok');
        } catch (error) {
          if (!alertsSessionCurrent()) return;
          if ([400, 404, 409].includes(error.status)) {
            pending = { ...record, rejection: { status: error.status, message: error.message } };
            localStorage.setItem(key, JSON.stringify(pending));
            setStatus(`${error.message} Use Rever alerta.`, 'error');
          } else setStatus('Ainda nao foi possivel confirmar o rascunho. O pedido foi guardado; use Repetir confirmação, mesmo depois de reabrir a pagina.', 'error');
        }
      });
    } catch (error) { if (alertsSessionCurrent()) setStatus(error.message, 'error'); }
    finally { alertResolutions.delete('billing'); updateResolutionButtons(); }
  }
  retry.onclick = () => submit(); review.onclick = () => submit(null, true);
  try {
    const payload = JSON.parse(atob(alertsAuthorization.split(' ')[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role !== 'ADMIN' || !positive(Number(payload.id))) throw Error('Sessao administrativa invalida.');
    owner = `ADMIN:${Number(payload.id)}`; key = `cwAlertBilling:v1:${owner}`; pending = read();
  } catch (error) { blocked = true; issue = error.message; setStatus(error.message, 'error'); }
  window.addEventListener('storage', event => {
    if (!alertsSessionCurrent()) return;
    if (event.key === key && !alertResolutions.has('billing')) {
      try { pending = read(); } catch (error) { setStatus(error.message, 'error'); }
      render();
    }
  });
  render();
  return { submit, render, hide: () => { panel.hidden = true; } };
}

function setupFilters() {
  ["alertSearch", "alertPriorityFilter", "alertSourceFilter"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id === "alertSearch" ? "input" : "change", renderList);
  });
  document.getElementById("clearAlertFilters")?.addEventListener("click", () => {
    ["alertSearch", "alertPriorityFilter", "alertSourceFilter"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    window.history?.replaceState?.(null, "", window.location.pathname);
    renderList();
  });
  document.getElementById("refreshAlerts")?.addEventListener("click", loadAlerts);
}

window.addEventListener("DOMContentLoaded", () => {
  setupRepairModal();
  setupFilters();
  applyQueryFilters();
  alertBilling = setupAlertBilling();
  loadAlerts();
});

// The office plans a separate return; the original field report remains historical.
(() => {
  let revision=0,shortageRows=[];
  const status=()=>document.getElementById('followupStatus');
  async function refresh(){
    const own=++revision,token=localStorage.getItem('token');
    status().textContent='A consultar visitas por concluir…';
    try{
      const data=await fetchJSON('/api/technician/incomplete-followups',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(own!==revision||token!==localStorage.getItem('token'))return;
      const shortages=data.shortages?.rows||[];shortageRows=shortages;
      document.getElementById('shortagePreparation').innerHTML='<h3>Preparar reposição de química</h3><p>Necessidades reportadas por visita. Confirme produto, quantidade e disponibilidade antes de preparar a viatura. Não representa stock entregue ou uma dose calculada.</p>'+ (shortages.length?shortages.map(row=>`<article class="followup-row" data-preparation-visit="${row.visitId}"><strong>${escapeHtml(row.productName)} · ${row.quantity===null?'Quantidade por confirmar':escapeHtml(row.quantity+' '+row.unit)}</strong><p>${escapeHtml(row.poolName)} · visita ${row.visitType==='EXTRA'?'extra ':''}#${row.visitId} · ${escapeHtml(row.technicianName)}</p><p>Recebido: ${escapeHtml((row.receivedQuantity||0)+' '+row.unit)} · ${row.quantity===null?'Necessidade total por confirmar':'Falta receber: '+escapeHtml(Math.max(0,row.quantity-(row.receivedQuantity||0))+' '+row.unit)}</p><p>Cargas associadas: ${escapeHtml((row.preparedQuantity||0)+' '+row.unit)} · Viatura: ${escapeHtml(row.vehiclePlate||'Por atribuir')}</p>${row.vehicleId&&(row.quantity===null||row.committedQuantity<row.quantity)?`<form class="followup-form chemical-load-form" data-shortage="${row.shortageId}"><label>Quantidade a carregar (${escapeHtml(row.unit)})<input name="quantity" type="number" min="0.001" step="any" inputmode="decimal" required ${row.quantity===null?'':'max="'+Math.max(0,row.quantity-row.committedQuantity)+'"'}></label><button type="submit" class="cw-v2-btn">Registar carga na viatura</button><p class="full" role="status">${row.quantity===null?'Confirme a quantidade necessária com o técnico.':'Por carregar: '+escapeHtml(Math.max(0,row.quantity-row.committedQuantity)+' '+row.unit)}. Só registe depois de carregar fisicamente o produto.</p></form>`:row.vehicleId?'<p>Quantidade já carregada ou recebida. Aguarde a confirmação do técnico.</p>':'<p>Atribua uma viatura ao técnico antes de registar a carga.</p>'}${(row.loads||[]).map(load=>`<p>Carga #${load.id} · viatura #${load.vehicleId} · ${escapeHtml(load.originalQuantity+' '+load.unit)} carregados · ${escapeHtml(load.returnedQuantity+' '+load.unit)} devolvidos</p>${load.quantity>0?`<form class="followup-form chemical-return-form" data-shortage="${row.shortageId}" data-movement="${load.id}"><label>Quantidade devolvida ao armazém (${escapeHtml(load.unit)})<input name="quantity" type="number" min="0.001" step="any" max="${load.quantity}" required inputmode="decimal"></label><button type="submit" class="cw-v2-btn">Registar devolução</button><p class="full" role="status">Confirme a receção física no armazém. Não altera o histórico da visita.</p></form>`:''}`).join('')}${(row.receipts||[]).map(receipt=>`<small>Confirmado por ${escapeHtml(receipt.receivedByName)} · ${escapeHtml(new Date(receipt.receivedAt).toLocaleString('pt-PT'))}${receipt.currentAssignment?'':' · atribuição anterior'}</small>`).join('<br>')}</article>`).join(''):'<p>Sem necessidades de química reportadas por resolver.</p>');
      const rows=[...new Map(data.reminders.map(row=>[(row.metadata.visitType||'REGULAR')+':'+row.metadata.visitId,row])).values()];
      document.getElementById('followupList').innerHTML=rows.map(row=>{
        const id=row.metadata.visitId,visitType=row.metadata.visitType||'REGULAR',returned=row.returnVisit;
        const scheduled=returned&&!['CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(returned.status);
        const originalOpen=row.visit?.status==='INCOMPLETE'&&!row.visit.endAt;
        return `<article class="followup-row" data-followup-visit="${id}" data-visit-type="${visitType}"><h3>${escapeHtml(row.pool?.name||'Piscina')} · visita ${visitType==='EXTRA'?'extra ':''}#${id}</h3>
          <p>${escapeHtml(row.client?.name||'')} · Reportado por ${escapeHtml(row.assignedTechnician?.name||'técnico')}</p>
          <p>${escapeHtml(row.description)}</p>
          ${scheduled?`<p><strong>Regresso #${returned.id} · ${escapeHtml(returned.plannedDate?new Date(returned.plannedDate).toLocaleDateString('pt-PT'):'Data por confirmar')} · ${escapeHtml(returned.technicianName||'Técnico por confirmar')}</strong></p><p>Estado: ${escapeHtml(({PLANNED:'Agendado',IN_PROGRESS:'Em curso',INCOMPLETE:'Por concluir',DONE:'Concluído'})[returned.status]||returned.status)}. ${returned.endAt?'Conclusão registada; atualizar acompanhamento.':'O aviso continua aberto até à conclusão.'}</p><p>${escapeHtml(row.metadata.returnPlan.instructions)}</p>`:!originalOpen?'<p>O estado da visita mudou. Reveja o histórico antes de planear outro serviço.</p>':`<form class="followup-form" data-visit="${id}" data-visit-type="${visitType}" data-pool="${row.poolId}">
          <label>Data do regresso<input name="date" type="date" required></label>
          <label>Técnico responsável<select name="technicianId" required><option value="">Selecionar técnico</option>${data.technicians.map(tech=>`<option value="${tech.id}">${escapeHtml(tech.name)}</option>`).join('')}</select></label>
          <label class="full">Instruções para o técnico<textarea name="instructions" rows="3" minlength="5" maxlength="1000" required placeholder="Acesso confirmado, material necessário e trabalho a executar"></textarea></label>
          <button type="submit" class="cw-v2-btn full">Agendar regresso</button><p class="full" role="status"></p></form>`}</article>`;
      }).join('');
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),part=type=>parts.find(p=>p.type===type).value,today=`${part('year')}-${part('month')}-${part('day')}`;
      document.querySelectorAll('.followup-form input[type="date"]').forEach(input=>{input.min=today;input.value=today;});
      document.querySelectorAll('#followupList form').forEach(form=>{void window.CWAdminIncomplete.mount(form,{id:Number(form.dataset.visit),visitType:form.dataset.visitType,poolId:Number(form.dataset.pool)},{refresh,confirm:(...args)=>ui.confirm(...args)});});
      void window.CWAdminIncomplete.render();
      status().textContent=rows.length?`${rows.length} visita(s) em acompanhamento.`:'Sem visitas por concluir pendentes no servidor.';
    }catch(error){if(own===revision&&token===localStorage.getItem('token'))status().textContent=`Não foi possível atualizar: ${error.message}. A lista anterior pode estar desatualizada.`;}
  }
  document.getElementById('shortagePreparation').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target;if(!form.matches('.chemical-load-form,.chemical-return-form'))return;
    const returning=form.matches('.chemical-return-form');
    const row=shortageRows.find(r=>r.shortageId===Number(form.dataset.shortage)),message=form.querySelector('[role=status]'),token=localStorage.getItem('token');
    if(!navigator.onLine){message.textContent='Sem rede. A carga ainda não foi registada.';return;}
    const quantity=Number(form.elements.quantity.value);
    if(!row||!Number.isFinite(quantity)||quantity<=0)return;
    const load=returning?row.loads.find(m=>m.id===Number(form.dataset.movement)):null;if(returning&&!load)return;
    if(!confirm(returning?`Confirmar a receção no armazém de ${quantity} ${load.unit} de ${load.productName}, da viatura #${load.vehicleId}, carga #${load.id}?`:`Registar ${quantity} ${row.unit} de ${row.productName} na viatura ${row.vehiclePlate}, de ${row.technicianName}? Confirme que a carga física já foi realizada. O técnico confirma a receção separadamente.`))return;
    const body=returning?{vehicleId:load.vehicleId,returnOfMovementId:load.id,direction:'VEHICLE_TO_CENTRAL',items:[{productName:load.productName,unit:load.unit,quantity}]}:{vehicleId:row.vehicleId,shortageId:row.shortageId,direction:'CENTRAL_TO_VEHICLE',items:[{productName:row.productName,unit:row.unit,quantity}]};let key;
    try{const user=JSON.parse(localStorage.getItem('user')||localStorage.getItem('cristalwater_user')||'null');if(!user?.id)throw new Error('Sessão por confirmar');key='cwChemicalLoad:'+JSON.stringify([user.id,body]);body.requestId=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,body.requestId);}catch{message.textContent='Não foi possível guardar o pedido no dispositivo. Confirme a sessão e tente novamente.';return;}
    for(const control of form.elements)control.disabled=true;document.getElementById('refreshFollowups').disabled=true;
    try{const result=await fetchJSON('/api/equipment-stock-os/stock/transfers',{method:'POST',body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
      if(token!==localStorage.getItem('token'))return;localStorage.removeItem(key);await refresh();status().textContent=returning?`Devolução registada (movimento #${result.movements[0].id}). Stock e necessidade atualizados.`:`Carga registada (movimento #${result.movements[0].id}). Aguarda confirmação de receção pelo técnico.`;
    }catch(error){if(token===localStorage.getItem('token'))message.textContent=`Não foi possível confirmar: ${error.message}. Pode repetir com os mesmos dados; não repita a operação física por causa de uma falha de ligação.`;}
    finally{for(const control of form.elements)control.disabled=false;document.getElementById('refreshFollowups').disabled=false;}
  });
  document.getElementById('refreshFollowups').addEventListener('click',refresh);
  refresh();
})();
