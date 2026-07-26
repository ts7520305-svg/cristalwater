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
    throw new Error(data.error || data.message || `Erro HTTP ${res.status}`);
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
  const ids = Array.from(new Set((alerts || []).map(extractVisitId).filter(Boolean)));
  if (!ids.length) return alerts;

  const pairs = await Promise.all(ids.slice(0, 80).map(async (id) => {
    try {
      const data = await fetchJSON(`${API}/visits/${encodeURIComponent(id)}`);
      return [id, data.visit || null];
    } catch (_) {
      return [id, null];
    }
  }));
  const visits = new Map(pairs.filter(([, visit]) => visit?.id));
  if (!visits.size) {
    return alerts.map((alert) => {
      const visitId = extractVisitId(alert);
      return visitId ? { ...alert, visitId, visitHref: `/admin-visits?visitId=${visitId}` } : alert;
    });
  }

  return alerts.map((alert) => {
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

  try {
    const data = await fetchJSON(`${API}/repairs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (resolveAlert && context?.alertId) {
      await fetchJSON(`${API}/alerts/${encodeURIComponent(context.alertId)}/resolve`, { method: "PUT" });
    }

    closeRepairModal();
    await loadAlerts();
    ui.success(`Reparacao #${data.repair?.id || "-"} criada com sucesso.`);
    setStatus("Reparacao criada e fila atualizada.", "ok");
  } catch (err) {
    setRepairModalStatus(err.message || "Erro ao criar reparacao.", "error");
  } finally {
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
  const list = document.getElementById("alertsList");
  const summary = document.getElementById("alertsSummary");
  if (!list) return;

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
          <span class="${alert.technicianName ? "" : "missing"}"><b>Reportado por:</b> ${escapeHtml(alert.technicianName || "Tecnico por identificar")}</span>
          <span><b>Data:</b> ${escapeHtml(formatDate(alert.createdAt))}</span>
          ${alert.visitId ? `<span><b>Visita:</b> #${escapeHtml(alert.visitId)}</span>` : ""}
          ${alert.repairId ? `<span><b>Reparacao:</b> #${escapeHtml(alert.repairId)}</span>` : ""}
        </div>
      </div>
      <div class="alert-actions">
        ${alert.href ? `<a class="btn" href="${escapeHtml(alert.href)}">Abrir ficha</a>` : ""}
        ${alert.visitHref ? `<a class="btn note" href="${escapeHtml(alert.visitHref)}">Abrir visita</a>` : ""}
        ${alert.serviceNote?.href ? `<a class="btn note" href="${escapeHtml(alert.serviceNote.href)}" target="_blank" rel="noopener">Relatorio</a>` : ""}
        <button type="button" data-charge-alert="${escapeHtml(alert.id)}">Faturar</button>
        <button type="button" class="resolve" data-resolve-alert="${escapeHtml(alert.id)}">Resolver</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-resolve-alert]").forEach((btn) => {
    btn.addEventListener("click", () => resolveAlert(btn.dataset.resolveAlert));
  });
  list.querySelectorAll("[data-charge-alert]").forEach((btn) => {
    btn.addEventListener("click", () => chargeAlert(btn.dataset.chargeAlert));
  });
}

async function loadAlerts() {
  try {
    setStatus("A carregar alertas...");
    const data = await fetchJSON(`${API}/alerts`);
    alertsState = await enrichAlertsWithVisits(Array.isArray(data.alerts) ? data.alerts : []);
    renderList();
    setStatus(alertsState.length ? "Alertas carregados." : "Nao existem alertas abertos.", alertsState.length ? "info" : "ok");
  } catch (err) {
    alertsState = [];
    renderList();
    setStatus(err.message || "Erro ao carregar alertas.", "error");
  }
}

async function resolveAlert(id) {
  if (!id) return;
  const ok = await ui.confirm("Marcar este alerta como resolvido?", {
    title: "Confirmar resolucao",
    confirmText: "Resolver",
  });
  if (!ok) return;

  try {
    setStatus("A resolver alerta...");
    await fetchJSON(`${API}/alerts/${encodeURIComponent(id)}/resolve`, { method: "PUT" });
    await loadAlerts();
    setStatus("Alerta resolvido e retirado da lista aberta.", "ok");
  } catch (err) {
    setStatus(err.message || "Erro ao resolver alerta.", "error");
  }
}

async function chargeAlert(id) {
  if (!id) return;
  const price = await ui.prompt("Valor a faturar para este alerta/reparacao (EUR)", {
    title: "Faturar alerta",
    defaultValue: "",
    confirmText: "Continuar",
  });
  if (!price) return;

  const amount = Number(String(price).replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    setStatus("Valor invalido.", "error");
    return;
  }

  try {
    setStatus("A adicionar valor a faturacao...");
    const data = await fetchJSON(`${API}/alerts/${encodeURIComponent(id)}/convert`, {
      method: "POST",
      body: JSON.stringify({ price: amount }),
    });
    setStatus(`Valor adicionado a fatura #${data.invoiceId}.`, "ok");
  } catch (err) {
    setStatus(err.message || "Erro ao faturar alerta.", "error");
  }
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
  loadAlerts();
});
