const Kernel = require("../../core/Kernel");
const { roleIn } = require("../../utils/roles");
const repository = require("../../dal/ConstructionRepository");
const stockRepository = require("../../dal/EquipmentStockRepository");
const FinanceBusiness = require("../finance/FinanceOsBusiness");
const { EVENT_TYPES, emitConstructionEvent } = require("../../services/constructionEventService");
const { EVENT_TYPES: STOCK_EVENT_TYPES, emitEquipmentStockEvent } = require("../../services/equipmentStockEventService");

const WORKFLOW_LOCK_TYPE = "CONSTRUCTION_WORKFLOW";

const STEP_ROLE_RULES = {
  createProject: ["ADMIN", "TEAM_LEADER"],
  approveCustomer: ["ADMIN", "TEAM_LEADER", "CLIENT"],
  defineBudget: ["ADMIN", "TEAM_LEADER"],
  definePlanning: ["ADMIN", "TEAM_LEADER"],
  updatePhase: ["ADMIN", "TEAM_LEADER"],
  planMaterials: ["ADMIN", "TEAM_LEADER"],
  reserveStock: ["ADMIN", "TEAM_LEADER"],
  assignTeam: ["ADMIN", "TEAM_LEADER"],
  addDailyLog: ["ADMIN", "TEAM_LEADER", "TECHNICIAN"],
  addPhoto: ["ADMIN", "TEAM_LEADER", "TECHNICIAN"],
  trackProgress: ["ADMIN", "TEAM_LEADER", "TECHNICIAN"],
  createVariationOrder: ["ADMIN", "TEAM_LEADER"],
  approveVariationOrder: ["ADMIN", "TEAM_LEADER", "CLIENT"],
  createBillingMilestone: ["ADMIN", "TEAM_LEADER"],
  finalInspection: ["ADMIN", "TEAM_LEADER"],
  finalHandover: ["ADMIN", "TEAM_LEADER", "CLIENT"],
  registerWarranty: ["ADMIN", "TEAM_LEADER"],
  notifyCustomer: ["ADMIN", "TEAM_LEADER"],
  syncDashboard: ["ADMIN", "TEAM_LEADER"],
  completeProject: ["ADMIN", "TEAM_LEADER"],
};

function text(value) {
  return String(value || "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function asMoney(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function workflowPayload(lock) {
  return lock?.payload && typeof lock.payload === "object" ? lock.payload : {};
}

function ensurePermission(step, actorRole) {
  const allowed = STEP_ROLE_RULES[step] || ["ADMIN"];
  if (!roleIn(actorRole || "", allowed)) {
    return { ok: false, status: 403, error: "Sem permissão" };
  }
  return { ok: true };
}

function metricIncrement(name) {
  try {
    if (Kernel?.Metrics?.increment) Kernel.Metrics.increment(name, 1);
  } catch (_) {
    return null;
  }
  return null;
}

async function logStep(tx, project, step, actorCtx, eventType, message, metadata = {}) {
  const payload = workflowPayload(project);
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  const mergedTimeline = [
    ...timeline,
    {
      step,
      at: nowIso(),
      actor: actorCtx.actor,
      role: actorCtx.role,
    },
  ];

  await repository.updateWorkflow(tx, project.id, {
    payload: {
      ...payload,
      currentStep: step,
      timeline: mergedTimeline,
      ...metadata,
    },
    message,
    updatedAt: new Date(),
  });

  await repository.createTechnicalHistory(tx, {
    poolId: project.poolId,
    type: eventType,
    component: "Construction",
    message,
    description: JSON.stringify({ projectId: project.id, actor: actorCtx.actor, step, metadata }),
    status: "OPEN",
    performedAt: new Date(),
  });

  await repository.createAudit(tx, {
    action: eventType,
    eventType,
    entity: "ConstructionProject",
    entityId: project.id,
    poolId: project.poolId,
    clientId: project.clientId,
    metadata: { actor: actorCtx.actor, role: actorCtx.role, step, ...metadata },
    message,
  });

  metricIncrement(`construction.${step}`);

  await emitConstructionEvent(eventType, {
    projectId: project.id,
    poolId: project.poolId,
    clientId: project.clientId,
    actor: actorCtx.actor,
    step,
    source: "construction-business",
  });
}

async function getProject(projectId) {
  const project = await repository.getWorkflow(projectId);
  if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) {
    return { ok: false, status: 404, error: "Projeto de construção não encontrado" };
  }
  return { ok: true, project };
}

async function createProject(payload = {}, actorCtx = {}) {
  const permission = ensurePermission("createProject", actorCtx.role);
  if (!permission.ok) return permission;

  const poolId = repository.asNumber(payload.poolId, 0);
  if (!poolId) return { ok: false, status: 400, error: "poolId obrigatório" };

  const pool = await repository.getPoolContext(poolId);
  if (!pool) return { ok: false, status: 404, error: "Piscina não encontrada" };

  return repository.transaction(async (tx) => {
    const created = await repository.createWorkflow(tx, {
      lockType: WORKFLOW_LOCK_TYPE,
      severity: "WARNING",
      status: "APPROVED",
      entity: "ConstructionProject",
      entityId: null,
      poolId: pool.id,
      clientId: pool.client?.id || null,
      title: text(payload.title || `Projeto de construção piscina #${pool.id}`) || `Projeto de construção piscina #${pool.id}`,
      message: "Projeto criado",
      requestedBy: actorCtx.actor,
      approvedBy: actorCtx.actor,
      approvedAt: new Date(),
      payload: {
        workflow: "CONSTRUCTION_OS",
        status: "PROJECT_CREATED",
        name: text(payload.name || `Construction ${pool.id}`) || `Construction ${pool.id}`,
        objective: text(payload.objective || "Projeto de construção"),
        createdAt: nowIso(),
        timeline: [],
      },
    });

    await repository.updateWorkflow(tx, created.id, { entityId: created.id });
    await logStep(tx, created, "PROJECT_CREATED", actorCtx, EVENT_TYPES.CONSTRUCTION_PROJECT_CREATED, "Projeto de construção criado");

    const final = await repository.getWorkflow(created.id, tx);
    return { ok: true, project: final };
  });
}

async function applyStep(projectId, payload = {}, actorCtx = {}, options = {}) {
  const permission = ensurePermission(options.permissionKey, actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const project = await repository.getWorkflow(projectId, tx);
    if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Projeto de construção não encontrado" };
    }

    const state = workflowPayload(project);
    const nextState = {
      ...state,
      status: options.nextStatus || state.status,
      ...(typeof options.transformState === "function" ? options.transformState(state, payload) : {}),
    };

    await logStep(tx, project, options.step, actorCtx, options.eventType, options.message, nextState);

    const final = await repository.getWorkflow(project.id, tx);
    return { ok: true, project: final };
  });
}

async function approveCustomer(projectId, payload = {}, actorCtx = {}) {
  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "approveCustomer",
    step: "CUSTOMER_APPROVED",
    nextStatus: "CUSTOMER_APPROVED",
    eventType: EVENT_TYPES.CONSTRUCTION_CUSTOMER_APPROVED,
    message: "Aprovação do cliente registada",
    transformState: () => ({ customerApproval: { approved: true, at: nowIso(), notes: text(payload.notes) || null } }),
  });
}

async function defineBudget(projectId, payload = {}, actorCtx = {}) {
  const total = asMoney(payload.total);
  if (total <= 0) return { ok: false, status: 400, error: "total inválido" };

  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "defineBudget",
    step: "BUDGET",
    nextStatus: "BUDGET_DEFINED",
    eventType: EVENT_TYPES.CONSTRUCTION_BUDGET_DEFINED,
    message: "Orçamento definido",
    transformState: () => ({ budget: { total, currency: text(payload.currency || "EUR") || "EUR", notes: text(payload.notes) || null, at: nowIso() } }),
  });
}

async function definePlanning(projectId, payload = {}, actorCtx = {}) {
  const startDate = parseDate(payload.startDate);
  const endDate = parseDate(payload.endDate);
  if (!startDate || !endDate) return { ok: false, status: 400, error: "startDate/endDate inválidos" };

  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "definePlanning",
    step: "PLANNING",
    nextStatus: "PLANNING_DEFINED",
    eventType: EVENT_TYPES.CONSTRUCTION_PLANNED,
    message: "Planeamento definido",
    transformState: () => ({ planning: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), notes: text(payload.notes) || null } }),
  });
}

async function updatePhase(projectId, payload = {}, actorCtx = {}) {
  const phaseName = text(payload.phaseName || payload.phase);
  if (!phaseName) return { ok: false, status: 400, error: "phaseName obrigatório" };

  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "updatePhase",
    step: "PHASE",
    nextStatus: "PHASE_IN_PROGRESS",
    eventType: EVENT_TYPES.CONSTRUCTION_PHASE_UPDATED,
    message: `Fase atualizada: ${phaseName}`,
    transformState: (state) => ({
      phases: [
        ...(Array.isArray(state.phases) ? state.phases : []),
        {
          phaseName,
          status: text(payload.status || "IN_PROGRESS") || "IN_PROGRESS",
          notes: text(payload.notes) || null,
          at: nowIso(),
        },
      ],
      currentPhase: phaseName,
    }),
  });
}

async function planMaterials(projectId, payload = {}, actorCtx = {}) {
  const materials = Array.isArray(payload.materials) ? payload.materials : [];
  if (!materials.length) return { ok: false, status: 400, error: "materials obrigatórios" };

  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "planMaterials",
    step: "MATERIAL_PLANNING",
    nextStatus: "MATERIAL_PLANNED",
    eventType: EVENT_TYPES.CONSTRUCTION_MATERIALS_PLANNED,
    message: "Planeamento de materiais registado",
    transformState: () => ({ materialPlan: { materials, plannedAt: nowIso() } }),
  });
}

async function reserveStock(projectId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("reserveStock", actorCtx.role);
  if (!permission.ok) return permission;

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { ok: false, status: 400, error: "items obrigatórios" };

  return repository.transaction(async (tx) => {
    const project = await repository.getWorkflow(projectId, tx);
    if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Projeto de construção não encontrado" };

    const balances = await stockRepository.listBalances({});
    const shortages = [];
    for (const item of items) {
      const required = asMoney(item.quantity);
      const productName = text(item.productName || item.name).toUpperCase();
      const unit = text(item.unit || "UN").toUpperCase() || "UN";
      const scope = text(item.scope || "CENTRAL").toUpperCase() || "CENTRAL";
      const available = (balances || [])
        .filter((row) => text(row.scope).toUpperCase() === scope && text(row.productName).toUpperCase() === productName && text(row.unit).toUpperCase() === unit)
        .reduce((sum, row) => sum + asMoney(row.quantity), 0);

      if (available < required) shortages.push({ productName, unit, scope, required, available });
    }

    if (shortages.length) return { ok: false, status: 409, error: "Stock insuficiente", shortages };

    const reservation = await repository.createStockReservation(tx, {
      lockType: "CONSTRUCTION_STOCK_RESERVATION",
      severity: "WARNING",
      status: "APPROVED",
      entity: "ConstructionProject",
      entityId: project.id,
      poolId: project.poolId,
      clientId: project.clientId,
      title: "Stock reservado para construção",
      message: `Reserva de stock para projeto #${project.id}`,
      requestedBy: actorCtx.actor,
      approvedBy: actorCtx.actor,
      approvedAt: new Date(),
      payload: { items, reservedAt: nowIso(), actor: actorCtx.actor },
    });

    await logStep(tx, project, "STOCK_RESERVED", actorCtx, EVENT_TYPES.CONSTRUCTION_STOCK_RESERVED, "Stock reservado para construção", { stockReservationId: reservation.id });

    await emitEquipmentStockEvent(STOCK_EVENT_TYPES.STOCK_RESERVED, {
      projectId: project.id,
      poolId: project.poolId,
      items,
      actor: actorCtx.actor,
      source: "construction-stock-reservation",
    });

    const final = await repository.getWorkflow(project.id, tx);
    return { ok: true, project: final, reservation };
  });
}

async function assignTeam(projectId, payload = {}, actorCtx = {}) {
  const technicians = Array.isArray(payload.technicianIds) ? payload.technicianIds.map((id) => repository.asNumber(id, 0)).filter(Boolean) : [];
  if (!technicians.length) return { ok: false, status: 400, error: "technicianIds obrigatórios" };

  return repository.transaction(async (tx) => {
    const project = await repository.getWorkflow(projectId, tx);
    if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Projeto de construção não encontrado" };

    for (const technicianId of technicians) {
      await repository.createTask(tx, {
        title: `Projeto construção #${project.id}`,
        description: text(payload.description || "Execução de obra"),
        priority: text(payload.priority || "NORMAL") || "NORMAL",
        status: "PENDENTE",
        technicianId,
        clientId: project.clientId,
        poolId: project.poolId,
      });
    }

    await logStep(tx, project, "TEAM_ASSIGNED", actorCtx, EVENT_TYPES.CONSTRUCTION_TEAM_ASSIGNED, "Equipa atribuída", {
      technicianIds: technicians,
    });

    const final = await repository.getWorkflow(project.id, tx);
    return { ok: true, project: final };
  });
}

async function addDailyLog(projectId, payload = {}, actorCtx = {}) {
  const logText = text(payload.log || payload.notes);
  if (!logText) return { ok: false, status: 400, error: "log obrigatório" };

  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "addDailyLog",
    step: "DAILY_LOG",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.CONSTRUCTION_DAILY_LOG_ADDED,
    message: "Registo diário adicionado",
    transformState: (state) => ({
      dailyLogs: [
        ...(Array.isArray(state.dailyLogs) ? state.dailyLogs : []),
        { log: logText, at: nowIso(), actor: actorCtx.actor },
      ],
    }),
  });
}

async function addPhoto(projectId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("addPhoto", actorCtx.role);
  if (!permission.ok) return permission;

  const fileUrl = text(payload.fileUrl);
  if (!fileUrl) return { ok: false, status: 400, error: "fileUrl obrigatório" };

  return repository.transaction(async (tx) => {
    const project = await repository.getWorkflow(projectId, tx);
    if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Projeto de construção não encontrado" };

    const attachment = await repository.createAttachment(tx, {
      fileName: text(payload.fileName || `construction-${project.id}.jpg`) || `construction-${project.id}.jpg`,
      fileUrl,
      mimeType: text(payload.mimeType || "image/jpeg") || "image/jpeg",
      fileSize: Number(payload.fileSize || 0),
      clientId: project.clientId,
      poolId: project.poolId,
    });

    const state = workflowPayload(project);
    const photos = Array.isArray(state.photos) ? state.photos : [];

    await logStep(tx, project, "PHOTO", actorCtx, EVENT_TYPES.CONSTRUCTION_PHOTO_ADDED, "Foto de obra adicionada", {
      photos: [
        ...photos,
        {
          attachmentId: attachment?.id || null,
          fileUrl,
          at: nowIso(),
        },
      ],
    });

    const final = await repository.getWorkflow(project.id, tx);
    return { ok: true, project: final, photo: attachment };
  });
}

async function trackProgress(projectId, payload = {}, actorCtx = {}) {
  const progress = asPercent(payload.progress);
  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "trackProgress",
    step: "PROGRESS",
    nextStatus: progress >= 100 ? "READY_FOR_INSPECTION" : "IN_PROGRESS",
    eventType: EVENT_TYPES.CONSTRUCTION_PROGRESS_UPDATED,
    message: `Progresso atualizado para ${progress}%`,
    transformState: () => ({
      progress,
      progressAt: nowIso(),
      progressNotes: text(payload.notes) || null,
    }),
  });
}

async function createVariationOrder(projectId, payload = {}, actorCtx = {}) {
  const amount = asMoney(payload.amount);
  if (amount <= 0) return { ok: false, status: 400, error: "amount inválido" };

  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "createVariationOrder",
    step: "VARIATION_ORDER",
    nextStatus: "VARIATION_PENDING_APPROVAL",
    eventType: EVENT_TYPES.CONSTRUCTION_VARIATION_CREATED,
    message: "Ordem de variação criada",
    transformState: (state) => ({
      variationOrders: [
        ...(Array.isArray(state.variationOrders) ? state.variationOrders : []),
        {
          id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: text(payload.title || "Variação") || "Variação",
          amount,
          reason: text(payload.reason) || null,
          approved: false,
          at: nowIso(),
        },
      ],
    }),
  });
}

async function approveVariationOrder(projectId, payload = {}, actorCtx = {}) {
  const variationId = text(payload.variationId);
  if (!variationId) return { ok: false, status: 400, error: "variationId obrigatório" };

  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "approveVariationOrder",
    step: "VARIATION_APPROVED",
    nextStatus: "VARIATION_APPROVED",
    eventType: EVENT_TYPES.CONSTRUCTION_VARIATION_APPROVED,
    message: "Ordem de variação aprovada",
    transformState: (state) => ({
      variationOrders: (Array.isArray(state.variationOrders) ? state.variationOrders : []).map((order) => {
        if (String(order.id) !== variationId) return order;
        return { ...order, approved: true, approvedAt: nowIso(), approvedBy: actorCtx.actor };
      }),
    }),
  });
}

async function createBillingMilestone(projectId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("createBillingMilestone", actorCtx.role);
  if (!permission.ok) return permission;

  const amount = asMoney(payload.amount);
  if (amount <= 0) return { ok: false, status: 400, error: "amount inválido" };

  return repository.transaction(async (tx) => {
    const project = await repository.getWorkflow(projectId, tx);
    if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Projeto de construção não encontrado" };

    const monthRef = text(payload.monthRef) || new Date().toISOString().slice(0, 7);
    const draft = await FinanceBusiness.createDraftInvoice({
      clientId: project.clientId,
      monthRef,
      notes: `Milestone de construção #${project.id}`,
      lines: [
        {
          type: "CONSTRUCTION",
          lineType: "CONSTRUCTION",
          description: text(payload.title || `Milestone construção #${project.id}`) || `Milestone construção #${project.id}`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
          lineTotal: amount,
        },
      ],
    }, actorCtx.actor);

    if (!draft.ok) return draft;

    const issued = await FinanceBusiness.issueInvoice(draft.invoice.id, { notes: `Milestone emitida para projeto #${project.id}` }, actorCtx.actor);
    if (!issued.ok) return issued;

    await logStep(tx, project, "BILLING_MILESTONE", actorCtx, EVENT_TYPES.CONSTRUCTION_BILLING_MILESTONE, "Milestone de faturação registada", {
      billingMilestones: [
        ...((Array.isArray(workflowPayload(project).billingMilestones) ? workflowPayload(project).billingMilestones : [])),
        {
          title: text(payload.title || "Milestone") || "Milestone",
          amount,
          invoiceId: issued.invoice.id,
          at: nowIso(),
        },
      ],
    });

    const final = await repository.getWorkflow(project.id, tx);
    return { ok: true, project: final, invoice: issued.invoice };
  });
}

async function finalInspection(projectId, payload = {}, actorCtx = {}) {
  const passed = Boolean(payload.passed);
  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "finalInspection",
    step: "FINAL_INSPECTION",
    nextStatus: passed ? "INSPECTION_APPROVED" : "INSPECTION_FAILED",
    eventType: EVENT_TYPES.CONSTRUCTION_FINAL_INSPECTION,
    message: passed ? "Inspeção final aprovada" : "Inspeção final reprovada",
    transformState: () => ({ finalInspection: { passed, notes: text(payload.notes) || null, at: nowIso() } }),
  });
}

async function finalHandover(projectId, payload = {}, actorCtx = {}) {
  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "finalHandover",
    step: "FINAL_HANDOVER",
    nextStatus: "HANDED_OVER",
    eventType: EVENT_TYPES.CONSTRUCTION_FINAL_HANDOVER,
    message: "Entrega final concluída",
    transformState: () => ({ finalHandover: { accepted: true, notes: text(payload.notes) || null, at: nowIso() } }),
  });
}

async function registerWarranty(projectId, payload = {}, actorCtx = {}) {
  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "registerWarranty",
    step: "WARRANTY",
    nextStatus: "WARRANTY_REGISTERED",
    eventType: EVENT_TYPES.CONSTRUCTION_WARRANTY_REGISTERED,
    message: "Garantia registada",
    transformState: () => ({ warranty: { provider: text(payload.provider) || null, validUntil: text(payload.validUntil) || null, notes: text(payload.notes) || null, at: nowIso() } }),
  });
}

async function notifyCustomer(projectId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("notifyCustomer", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const project = await repository.getWorkflow(projectId, tx);
    if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Projeto de construção não encontrado" };

    const message = text(payload.message || `Projeto de construção #${project.id} atualizado`) || `Projeto de construção #${project.id} atualizado`;

    await repository.createNotification(tx, {
      clientId: project.clientId,
      type: "CONSTRUCTION_UPDATE",
      eventType: EVENT_TYPES.CONSTRUCTION_CUSTOMER_NOTIFIED,
      title: "Atualização de obra",
      message,
      role: "CLIENT",
      severity: "INFO",
      status: "PENDING",
      metadata: { projectId: project.id },
    });

    await repository.createClientMessage(tx, {
      clientId: project.clientId,
      message,
      text: message,
      sender: actorCtx.actor,
      senderType: "SYSTEM",
      messageType: "SYSTEM",
    });

    await logStep(tx, project, "CUSTOMER_NOTIFICATION", actorCtx, EVENT_TYPES.CONSTRUCTION_CUSTOMER_NOTIFIED, "Cliente notificado", {
      customerNotifiedAt: nowIso(),
      customerMessage: message,
    });

    const final = await repository.getWorkflow(project.id, tx);
    return { ok: true, project: final };
  });
}

async function syncDashboard(projectId, payload = {}, actorCtx = {}) {
  return applyStep(projectId, payload, actorCtx, {
    permissionKey: "syncDashboard",
    step: "DASHBOARD",
    nextStatus: "DASHBOARD_SYNCED",
    eventType: EVENT_TYPES.CONSTRUCTION_DASHBOARD_SYNCED,
    message: "Dashboard sincronizado",
    transformState: () => ({ dashboard: { syncedAt: nowIso(), metadata: payload || {} } }),
  });
}

async function completeProject(projectId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("completeProject", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const project = await repository.getWorkflow(projectId, tx);
    if (!project || project.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Projeto de construção não encontrado" };

    const state = workflowPayload(project);
    const passedInspection = Boolean(state.finalInspection?.passed);
    const handedOver = Boolean(state.finalHandover?.accepted);
    const warrantyRegistered = Boolean(state.warranty?.at || state.warranty?.validUntil);

    if (!passedInspection && !payload.force) return { ok: false, status: 409, error: "Inspeção final pendente" };
    if (!handedOver && !payload.force) return { ok: false, status: 409, error: "Entrega final pendente" };
    if (!warrantyRegistered && !payload.force) return { ok: false, status: 409, error: "Garantia pendente" };

    const reservation = await repository.getStockReservation(project.id, tx);
    if (reservation) {
      const reservePayload = reservation.payload && typeof reservation.payload === "object" ? reservation.payload : {};
      const items = Array.isArray(reservePayload.items) ? reservePayload.items : [];

      for (const item of items) {
        const quantity = asMoney(item.quantity);
        if (quantity <= 0) continue;

        const normalized = {
          scope: text(item.scope || "CENTRAL").toUpperCase() || "CENTRAL",
          vehicleId: item.vehicleId == null ? null : repository.asNumber(item.vehicleId, 0) || null,
          productName: text(item.productName || item.name).toUpperCase(),
          unit: text(item.unit || "UN").toUpperCase() || "UN",
          category: text(item.category || "MATERIAL").toUpperCase() || "MATERIAL",
        };

        await stockRepository.adjustBalance(tx, {
          ...normalized,
          delta: -quantity,
        });

        await stockRepository.createMovement(tx, {
          movementType: "CONSUMPTION",
          scopeFrom: normalized.scope,
          scopeTo: "CONSTRUCTION",
          vehicleId: normalized.vehicleId,
          productName: normalized.productName,
          category: normalized.category,
          unit: normalized.unit,
          quantity,
          poolId: project.poolId,
          clientId: project.clientId,
          notes: `Consumo construção #${project.id}`,
          createdBy: actorCtx.actor,
        });
      }

      await repository.updateStockReservation(tx, reservation.id, {
        status: "RESOLVED",
        resolvedAt: new Date(),
        payload: {
          ...reservePayload,
          consumedAt: nowIso(),
          consumedBy: actorCtx.actor,
        },
      });

      await emitEquipmentStockEvent(STOCK_EVENT_TYPES.STOCK_CONSUMED, {
        projectId: project.id,
        poolId: project.poolId,
        items,
        actor: actorCtx.actor,
        source: "construction-stock-consume",
      });
    }

    await repository.updateWorkflow(tx, project.id, {
      status: "RESOLVED",
      resolvedAt: new Date(),
      message: "Projeto de construção concluído",
      payload: {
        ...state,
        status: "COMPLETED",
        completedAt: nowIso(),
      },
    });

    const completedState = await repository.getWorkflow(project.id, tx);

    await logStep(tx, completedState, "COMPLETED", actorCtx, EVENT_TYPES.CONSTRUCTION_COMPLETED, "Projeto de construção concluído", {
      status: "COMPLETED",
      completedAt: nowIso(),
      force: Boolean(payload.force),
    });

    const final = await repository.getWorkflow(project.id, tx);
    return { ok: true, project: final };
  });
}

module.exports = {
  getProject,
  createProject,
  approveCustomer,
  defineBudget,
  definePlanning,
  updatePhase,
  planMaterials,
  reserveStock,
  assignTeam,
  addDailyLog,
  addPhoto,
  trackProgress,
  createVariationOrder,
  approveVariationOrder,
  createBillingMilestone,
  finalInspection,
  finalHandover,
  registerWarranty,
  notifyCustomer,
  syncDashboard,
  completeProject,
};
