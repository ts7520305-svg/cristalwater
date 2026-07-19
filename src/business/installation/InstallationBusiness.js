const Kernel = require("../../core/Kernel");
const { roleIn } = require("../../utils/roles");
const repository = require("../../dal/InstallationRepository");
const stockRepository = require("../../dal/EquipmentStockRepository");
const FinanceBusiness = require("../finance/FinanceOsBusiness");
const { EVENT_TYPES, emitInstallationEvent } = require("../../services/installationEventService");
const { EVENT_TYPES: STOCK_EVENT_TYPES, emitEquipmentStockEvent } = require("../../services/equipmentStockEventService");

const WORKFLOW_LOCK_TYPE = "INSTALLATION_WORKFLOW";

const STEP_ROLE_RULES = {
  requestInstallation: ["ADMIN", "TEAM_LEADER", "CLIENT"],
  proposeEquipment: ["ADMIN", "TEAM_LEADER"],
  createQuote: ["ADMIN", "TEAM_LEADER"],
  approveCustomer: ["ADMIN", "TEAM_LEADER", "CLIENT"],
  scheduleInstallation: ["ADMIN", "TEAM_LEADER"],
  assignTechnician: ["ADMIN", "TEAM_LEADER"],
  reserveStock: ["ADMIN", "TEAM_LEADER"],
  generateWorkOrder: ["ADMIN", "TEAM_LEADER"],
  startInstallation: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  gpsCheckIn: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  installEquipment: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  addPhoto: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  registerSerialNumbers: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  registerWarranty: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  submitChecklist: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  signTechnician: ["TECHNICIAN", "TEAM_LEADER", "ADMIN"],
  signCustomer: ["CLIENT", "TEAM_LEADER", "ADMIN"],
  acceptCustomer: ["CLIENT", "TEAM_LEADER", "ADMIN"],
  consumeStock: ["TEAM_LEADER", "ADMIN"],
  generateInvoice: ["ADMIN", "TEAM_LEADER"],
  trackPayment: ["ADMIN", "TEAM_LEADER"],
  completeInstallation: ["ADMIN", "TEAM_LEADER"],
};

function text(value) {
  return String(value || "").trim();
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
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

function workflowPayload(lock) {
  return lock?.payload && typeof lock.payload === "object" ? lock.payload : {};
}

async function logStep(tx, installation, step, actorCtx, eventType, message, metadata = {}) {
  const payload = workflowPayload(installation);
  const mergedTimeline = [...(Array.isArray(payload.timeline) ? payload.timeline : []), {
    step,
    at: nowIso(),
    actor: actorCtx.actor,
    role: actorCtx.role,
  }];

  await repository.updateWorkflow(tx, installation.id, {
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
    poolId: installation.poolId,
    type: eventType,
    component: "Installation",
    message,
    description: JSON.stringify({ installationId: installation.id, actor: actorCtx.actor, step, metadata }),
    status: "OPEN",
    performedAt: new Date(),
  });

  await repository.createAudit(tx, {
    action: eventType,
    eventType,
    entity: "Installation",
    entityId: installation.id,
    poolId: installation.poolId,
    clientId: installation.clientId,
    metadata: { actor: actorCtx.actor, role: actorCtx.role, step, ...metadata },
    message,
  });

  metricIncrement(`installation.${step}`);

  await emitInstallationEvent(eventType, {
    installationId: installation.id,
    poolId: installation.poolId,
    clientId: installation.clientId,
    actor: actorCtx.actor,
    step,
    source: "installation-business",
  });
}

async function requestInstallation(payload = {}, actorCtx = {}) {
  const permission = ensurePermission("requestInstallation", actorCtx.role);
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
      entity: "Installation",
      entityId: null,
      poolId: pool.id,
      clientId: pool.client?.id || null,
      title: "Pedido de instalação",
      message: "Instalação solicitada",
      requestedBy: actorCtx.actor,
      approvedBy: actorCtx.actor,
      approvedAt: new Date(),
      payload: {
        workflow: "INSTALLATION_OS",
        status: "REQUESTED",
        requestedAt: nowIso(),
        request: {
          reason: text(payload.reason || payload.notes || "Pedido de instalação"),
          channel: text(payload.channel || "SYSTEM") || "SYSTEM",
        },
        timeline: [],
      },
    });

    await repository.updateWorkflow(tx, created.id, { entityId: created.id });

    await repository.createNotification(tx, {
      clientId: pool.client?.id || null,
      type: "INSTALLATION_REQUESTED",
      eventType: EVENT_TYPES.INSTALLATION_REQUESTED,
      title: "Pedido de instalação registado",
      message: `Pedido de instalação registado para a piscina #${pool.id}.`,
      role: "ADMIN",
      severity: "INFO",
      status: "PENDING",
      metadata: { installationId: created.id, poolId: pool.id },
    });

    await logStep(tx, created, "REQUESTED", actorCtx, EVENT_TYPES.INSTALLATION_REQUESTED, "Instalação solicitada");
    const final = await repository.getWorkflow(created.id, tx);
    return { ok: true, installation: final };
  });
}

async function getInstallation(installationId) {
  const installation = await repository.getWorkflow(installationId);
  if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) {
    return { ok: false, status: 404, error: "Instalação não encontrada" };
  }
  return { ok: true, installation };
}

async function applyStep(installationId, payload = {}, actorCtx = {}, options = {}) {
  const permission = ensurePermission(options.permissionKey, actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) {
      return { ok: false, status: 404, error: "Instalação não encontrada" };
    }

    const state = workflowPayload(installation);
    const updatedState = {
      ...state,
      status: options.nextStatus || state.status,
      ...(typeof options.transformState === "function" ? options.transformState(state, payload) : {}),
    };

    await logStep(
      tx,
      installation,
      options.step,
      actorCtx,
      options.eventType,
      options.message,
      updatedState
    );

    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final };
  });
}

async function proposeEquipment(installationId, payload = {}, actorCtx = {}) {
  const equipmentProposal = Array.isArray(payload.equipment) ? payload.equipment : [];
  if (!equipmentProposal.length) return { ok: false, status: 400, error: "equipment obrigatório" };

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "proposeEquipment",
    step: "PROPOSAL",
    nextStatus: "PROPOSAL_READY",
    eventType: EVENT_TYPES.INSTALLATION_PROPOSAL_CREATED,
    message: "Proposta de equipamento criada",
    transformState: (state) => ({ proposal: { equipment: equipmentProposal, notes: text(payload.notes) || null, at: nowIso() } }),
  });
}

async function createQuote(installationId, payload = {}, actorCtx = {}) {
  const amount = parseNumber(payload.amount, 0);
  if (amount <= 0) return { ok: false, status: 400, error: "amount inválido" };

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "createQuote",
    step: "QUOTE",
    nextStatus: "QUOTE_READY",
    eventType: EVENT_TYPES.INSTALLATION_QUOTE_CREATED,
    message: "Orçamento de instalação criado",
    transformState: () => ({ quote: { amount, currency: text(payload.currency || "EUR") || "EUR", notes: text(payload.notes) || null, at: nowIso() } }),
  });
}

async function approveCustomer(installationId, payload = {}, actorCtx = {}) {
  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "approveCustomer",
    step: "APPROVED",
    nextStatus: "APPROVED",
    eventType: EVENT_TYPES.INSTALLATION_APPROVED,
    message: "Aprovação do cliente registada",
    transformState: () => ({ customerApproval: { approved: true, at: nowIso(), actor: actorCtx.actor, notes: text(payload.notes) || null } }),
  });
}

async function scheduleInstallation(installationId, payload = {}, actorCtx = {}) {
  const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return { ok: false, status: 400, error: "scheduledAt inválido" };

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "scheduleInstallation",
    step: "SCHEDULED",
    nextStatus: "SCHEDULED",
    eventType: EVENT_TYPES.INSTALLATION_SCHEDULED,
    message: "Instalação agendada",
    transformState: () => ({ schedule: { scheduledAt: scheduledAt.toISOString(), notes: text(payload.notes) || null } }),
  });
}

async function assignTechnician(installationId, payload = {}, actorCtx = {}) {
  const technicianId = repository.asNumber(payload.technicianId, 0);
  if (!technicianId) return { ok: false, status: 400, error: "technicianId obrigatório" };

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "assignTechnician",
    step: "TECH_ASSIGNED",
    nextStatus: "TECH_ASSIGNED",
    eventType: EVENT_TYPES.INSTALLATION_TECH_ASSIGNED,
    message: "Técnico atribuído",
    transformState: () => ({ technicianId, technicianAssignedAt: nowIso() }),
  });
}

async function reserveStock(installationId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("reserveStock", actorCtx.role);
  if (!permission.ok) return permission;

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { ok: false, status: 400, error: "items obrigatórios" };

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Instalação não encontrada" };

    const balances = await stockRepository.listBalances({});
    const shortages = [];
    for (const item of items) {
      const productName = text(item.productName || item.name).toUpperCase();
      const unit = text(item.unit || "UN").toUpperCase() || "UN";
      const required = parseNumber(item.quantity, 0);
      const available = (balances || [])
        .filter((row) => text(row.scope).toUpperCase() === text(item.scope || "CENTRAL").toUpperCase() && text(row.productName).toUpperCase() === productName && text(row.unit).toUpperCase() === unit)
        .reduce((sum, row) => sum + parseNumber(row.quantity, 0), 0);
      if (available < required) shortages.push({ productName, unit, required, available });
    }

    if (shortages.length) return { ok: false, status: 409, error: "Stock insuficiente", shortages };

    const reservation = await repository.createStockReservation(tx, {
      lockType: "INSTALLATION_STOCK_RESERVATION",
      severity: "WARNING",
      status: "APPROVED",
      entity: "Installation",
      entityId: installation.id,
      poolId: installation.poolId,
      clientId: installation.clientId,
      title: "Stock reservado para instalação",
      message: `Reserva de stock para instalação #${installation.id}`,
      requestedBy: actorCtx.actor,
      approvedBy: actorCtx.actor,
      approvedAt: new Date(),
      payload: { items, reservedAt: nowIso(), actor: actorCtx.actor },
    });

    await logStep(tx, installation, "STOCK_RESERVED", actorCtx, EVENT_TYPES.INSTALLATION_STOCK_RESERVED, "Stock reservado", { stockReservationId: reservation.id });

    await emitEquipmentStockEvent(STOCK_EVENT_TYPES.STOCK_RESERVED, {
      installationId: installation.id,
      poolId: installation.poolId,
      items,
      actor: actorCtx.actor,
      source: "installation-stock-reservation",
    });

    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final, reservation };
  });
}

async function generateWorkOrder(installationId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("generateWorkOrder", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Instalação não encontrada" };

    const state = workflowPayload(installation);
    const task = await repository.createTask(tx, {
      title: `Ordem de instalação #${installation.id}`,
      description: text(payload.description || "Instalação de equipamento"),
      priority: text(payload.priority || "NORMAL") || "NORMAL",
      status: "PENDENTE",
      technicianId: repository.asNumber(state.technicianId, 0) || null,
      clientId: installation.clientId || null,
      poolId: installation.poolId || null,
    });

    await logStep(tx, installation, "WORK_ORDER", actorCtx, EVENT_TYPES.INSTALLATION_WORK_ORDER_CREATED, "Ordem de trabalho gerada", { workOrderId: task?.id || null });
    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final, workOrder: task };
  });
}

async function startInstallation(installationId, payload = {}, actorCtx = {}) {
  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "startInstallation",
    step: "STARTED",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_STARTED,
    message: "Instalação iniciada",
    transformState: () => ({ startedAt: nowIso() }),
  });
}

async function gpsCheckIn(installationId, payload = {}, actorCtx = {}) {
  const latitude = parseNumber(payload.latitude, NaN);
  const longitude = parseNumber(payload.longitude, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, status: 400, error: "latitude/longitude obrigatórios" };
  }

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "gpsCheckIn",
    step: "GPS_CHECKIN",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_GPS_CHECKIN,
    message: "GPS check-in registado",
    transformState: () => ({ gpsCheckIn: { latitude, longitude, at: nowIso() } }),
  });
}

async function installEquipment(installationId, payload = {}, actorCtx = {}) {
  const equipment = payload.equipment || {};
  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "installEquipment",
    step: "EQUIPMENT_INSTALLED",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_EQUIPMENT_INSTALLED,
    message: "Equipamento instalado",
    transformState: (state) => ({ installedEquipment: [...(Array.isArray(state.installedEquipment) ? state.installedEquipment : []), { ...equipment, at: nowIso(), actor: actorCtx.actor }] }),
  });
}

async function addPhoto(installationId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("addPhoto", actorCtx.role);
  if (!permission.ok) return permission;

  const phase = text(payload.phase || "AFTER").toUpperCase();
  const fileUrl = text(payload.fileUrl);
  if (!fileUrl) return { ok: false, status: 400, error: "fileUrl obrigatório" };

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Instalação não encontrada" };

    const attachment = await repository.createAttachment(tx, {
      fileName: text(payload.fileName || `${phase.toLowerCase()}-${installation.id}.jpg`) || `${phase.toLowerCase()}-${installation.id}.jpg`,
      fileUrl,
      mimeType: text(payload.mimeType || "image/jpeg") || "image/jpeg",
      fileSize: parseNumber(payload.fileSize, 0),
      clientId: installation.clientId || null,
      poolId: installation.poolId || null,
    });

    const state = workflowPayload(installation);
    const photoField = phase === "BEFORE" ? "photosBefore" : "photosAfter";
    const next = {
      [photoField]: [...(Array.isArray(state[photoField]) ? state[photoField] : []), {
        attachmentId: attachment?.id || null,
        fileUrl,
        at: nowIso(),
      }],
    };

    await logStep(tx, installation, `PHOTO_${phase}`, actorCtx, EVENT_TYPES.INSTALLATION_PHOTO_ADDED, `Foto ${phase} registada`, next);
    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final, photo: attachment };
  });
}

async function registerSerialNumbers(installationId, payload = {}, actorCtx = {}) {
  const serials = Array.isArray(payload.serials) ? payload.serials : [];
  if (!serials.length) return { ok: false, status: 400, error: "serials obrigatórios" };

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "registerSerialNumbers",
    step: "SERIALS",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_SERIALS_REGISTERED,
    message: "Números de série registados",
    transformState: () => ({ serials, serialsAt: nowIso() }),
  });
}

async function registerWarranty(installationId, payload = {}, actorCtx = {}) {
  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "registerWarranty",
    step: "WARRANTY",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_WARRANTY_REGISTERED,
    message: "Garantia registada",
    transformState: () => ({ warranty: { ...payload, at: nowIso() } }),
  });
}

async function submitChecklist(installationId, payload = {}, actorCtx = {}) {
  const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "submitChecklist",
    step: "CHECKLIST",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_CHECKLIST_SUBMITTED,
    message: "Checklist da instalação submetida",
    transformState: () => ({ checklist, checklistAt: nowIso() }),
  });
}

async function signTechnician(installationId, payload = {}, actorCtx = {}) {
  const signature = text(payload.signature);
  if (!signature) return { ok: false, status: 400, error: "signature obrigatória" };

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "signTechnician",
    step: "TECH_SIGNATURE",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_TECH_SIGNATURE,
    message: "Assinatura do técnico registada",
    transformState: () => ({ technicianSignature: { signature, at: nowIso(), actor: actorCtx.actor } }),
  });
}

async function signCustomer(installationId, payload = {}, actorCtx = {}) {
  const signature = text(payload.signature);
  if (!signature) return { ok: false, status: 400, error: "signature obrigatória" };

  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "signCustomer",
    step: "CUSTOMER_SIGNATURE",
    nextStatus: "IN_PROGRESS",
    eventType: EVENT_TYPES.INSTALLATION_CUSTOMER_SIGNATURE,
    message: "Assinatura do cliente registada",
    transformState: () => ({ customerSignature: { signature, at: nowIso(), actor: actorCtx.actor } }),
  });
}

async function acceptCustomer(installationId, payload = {}, actorCtx = {}) {
  return applyStep(installationId, payload, actorCtx, {
    permissionKey: "acceptCustomer",
    step: "CUSTOMER_ACCEPTED",
    nextStatus: "CUSTOMER_ACCEPTED",
    eventType: EVENT_TYPES.INSTALLATION_CUSTOMER_ACCEPTED,
    message: "Aceitação do cliente registada",
    transformState: () => ({ customerAcceptance: { accepted: true, at: nowIso(), notes: text(payload.notes) || null } }),
  });
}

async function consumeStock(installationId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("consumeStock", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Instalação não encontrada" };

    const reservation = await repository.getStockReservation(installation.id, tx);
    if (!reservation) return { ok: false, status: 409, error: "Reserva de stock não encontrada" };

    const reservePayload = reservation.payload && typeof reservation.payload === "object" ? reservation.payload : {};
    const items = Array.isArray(reservePayload.items) ? reservePayload.items : [];
    if (!items.length) return { ok: false, status: 409, error: "Reserva sem items" };

    for (const item of items) {
      const quantity = parseNumber(item.quantity, 0);
      if (quantity <= 0) continue;
      const normalized = {
        scope: text(item.scope || "CENTRAL").toUpperCase() || "CENTRAL",
        vehicleId: item.vehicleId == null ? null : parseNumber(item.vehicleId, 0) || null,
        productName: text(item.productName || item.name).toUpperCase(),
        unit: text(item.unit || "UN").toUpperCase() || "UN",
        category: text(item.category || "EQUIPMENT").toUpperCase() || "EQUIPMENT",
      };

      await stockRepository.adjustBalance(tx, {
        ...normalized,
        delta: -quantity,
      });

      await stockRepository.createMovement(tx, {
        movementType: "CONSUMPTION",
        scopeFrom: normalized.scope,
        scopeTo: "INSTALLATION",
        vehicleId: normalized.vehicleId,
        productName: normalized.productName,
        category: normalized.category,
        unit: normalized.unit,
        quantity,
        poolId: installation.poolId,
        clientId: installation.clientId,
        notes: `Consumo de instalação #${installation.id}`,
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

    await logStep(tx, installation, "STOCK_CONSUMED", actorCtx, EVENT_TYPES.INSTALLATION_STOCK_CONSUMED, "Stock consumido", { stockConsumed: true });

    await emitEquipmentStockEvent(STOCK_EVENT_TYPES.STOCK_CONSUMED, {
      installationId: installation.id,
      poolId: installation.poolId,
      items,
      actor: actorCtx.actor,
      source: "installation-stock-consume",
    });

    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final };
  });
}

async function generateInvoice(installationId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("generateInvoice", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Instalação não encontrada" };

    const state = workflowPayload(installation);
    const amount = parseNumber(payload.amount, parseNumber(state.quote?.amount, 0));
    if (amount <= 0) return { ok: false, status: 400, error: "amount inválido" };

    const monthRef = text(payload.monthRef) || new Date().toISOString().slice(0, 7);
    const draft = await FinanceBusiness.createDraftInvoice({
      clientId: installation.clientId,
      monthRef,
      notes: `Fatura de instalação #${installation.id}`,
      lines: [{
        type: "INSTALLATION",
        lineType: "INSTALLATION",
        description: `Instalação #${installation.id}`,
        quantity: 1,
        unitPrice: amount,
        total: amount,
        lineTotal: amount,
      }],
    }, actorCtx.actor);

    if (!draft.ok) return draft;

    const issued = await FinanceBusiness.issueInvoice(draft.invoice.id, { notes: `Emitida para instalação #${installation.id}` }, actorCtx.actor);
    if (!issued.ok) return issued;

    await logStep(tx, installation, "INVOICE", actorCtx, EVENT_TYPES.INSTALLATION_INVOICE_GENERATED, "Fatura da instalação gerada", { invoiceId: issued.invoice.id });

    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final, invoice: issued.invoice };
  });
}

async function trackPayment(installationId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("trackPayment", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Instalação não encontrada" };

    const state = workflowPayload(installation);
    const invoiceId = parseNumber(payload.invoiceId, parseNumber(state.invoiceId, 0));
    if (!invoiceId) return { ok: false, status: 400, error: "invoiceId obrigatório" };

    const payment = await FinanceBusiness.registerPayment(invoiceId, {
      amount: parseNumber(payload.amount, 0),
      method: payload.method,
      notes: text(payload.notes || `Pagamento instalação #${installation.id}`),
    }, actorCtx.actor);

    if (!payment.ok) return payment;

    await logStep(tx, installation, "PAYMENT", actorCtx, EVENT_TYPES.INSTALLATION_PAYMENT_TRACKED, "Pagamento da instalação registado", {
      invoiceId,
      paymentStatus: payment.invoice?.status || null,
      paid: payment.invoice?.status === "PAID",
    });

    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final, payment };
  });
}

async function completeInstallation(installationId, payload = {}, actorCtx = {}) {
  const permission = ensurePermission("completeInstallation", actorCtx.role);
  if (!permission.ok) return permission;

  return repository.transaction(async (tx) => {
    const installation = await repository.getWorkflow(installationId, tx);
    if (!installation || installation.lockType !== WORKFLOW_LOCK_TYPE) return { ok: false, status: 404, error: "Instalação não encontrada" };

    const state = workflowPayload(installation);
    const hasAcceptance = Boolean(state.customerAcceptance?.accepted);
    const paid = Boolean(state.paid || state.paymentStatus === "PAID" || payload.force);

    if (!hasAcceptance && !payload.force) return { ok: false, status: 409, error: "Aceitação do cliente em falta" };
    if (!paid && !payload.force) return { ok: false, status: 409, error: "Pagamento em falta" };

    await repository.updateWorkflow(tx, installation.id, {
      status: "RESOLVED",
      resolvedAt: new Date(),
      message: "Instalação concluída",
      payload: {
        ...state,
        status: "COMPLETED",
        completedAt: nowIso(),
        paid: paid,
      },
    });

    const completedState = await repository.getWorkflow(installation.id, tx);

    await repository.createNotification(tx, {
      clientId: installation.clientId,
      type: "INSTALLATION_COMPLETED",
      eventType: EVENT_TYPES.INSTALLATION_COMPLETED,
      title: "Instalação concluída",
      message: `A instalação #${installation.id} foi concluída com sucesso.`,
      role: "CLIENT",
      severity: "INFO",
      status: "PENDING",
      metadata: { installationId: installation.id },
    });

    await repository.createClientMessage(tx, {
      clientId: installation.clientId,
      text: `Instalação #${installation.id} concluída. Obrigado por escolher a Cristal Water.`,
      messageType: "SYSTEM",
    });

    await logStep(tx, completedState, "COMPLETED", actorCtx, EVENT_TYPES.INSTALLATION_COMPLETED, "Instalação concluída", {
      status: "COMPLETED",
      paid: paid,
      completedAt: nowIso(),
      force: Boolean(payload.force),
    });

    const final = await repository.getWorkflow(installation.id, tx);
    return { ok: true, installation: final };
  });
}

module.exports = {
  requestInstallation,
  getInstallation,
  proposeEquipment,
  createQuote,
  approveCustomer,
  scheduleInstallation,
  assignTechnician,
  reserveStock,
  generateWorkOrder,
  startInstallation,
  gpsCheckIn,
  installEquipment,
  addPhoto,
  registerSerialNumbers,
  registerWarranty,
  submitChecklist,
  signTechnician,
  signCustomer,
  acceptCustomer,
  consumeStock,
  generateInvoice,
  trackPayment,
  completeInstallation,
};
