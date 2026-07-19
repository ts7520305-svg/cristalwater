const repository = require("../../dal/RepairRepository");
const stockRepository = require("../../dal/EquipmentStockRepository");
const FinanceBusiness = require("../finance/FinanceOsBusiness");
const { EVENT_TYPES, emitRepairEvent } = require("../../services/repairEventService");
const { EVENT_TYPES: FINANCE_EVENT_TYPES, emitFinanceEvent } = require("../../services/financeOsEventService");
const { EVENT_TYPES: STOCK_EVENT_TYPES, emitEquipmentStockEvent } = require("../../services/equipmentStockEventService");
const { toPublicUploadUrl } = require("../../config/uploadPath");

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function calculatePriority(problem, explicitPriority) {
  const current = normalizeText(explicitPriority).toUpperCase();
  if (current) return current;

  const text = normalizeText(problem).toLowerCase();
  if (/(fuga|urgente|quebra|avaria grave|sem funcionamento|inund|bloqueio)/.test(text)) return "HIGH";
  if (/(bomba|motor|filtro|luz|elétr|eletr|electr|painel|temporizador|sensor)/.test(text)) return "MEDIUM";
  return "NORMAL";
}

function estimatePricing(problem, quantity) {
  const qty = Math.max(1, asNumber(quantity, 1));
  const text = normalizeText(problem).toLowerCase();

  let unitPrice = 100;
  if (text.includes("luz")) {
    unitPrice = 120;
  } else if (text.includes("bomba")) {
    unitPrice = 350;
  }

  return {
    quantity: qty,
    unitPrice,
    totalPrice: unitPrice * qty,
  };
}

function buildRepairNotes(baseNotes, contextNotes) {
  return [baseNotes, contextNotes].filter(Boolean).join("\n").trim() || null;
}

function buildRepairInvoiceLine(repair, payload = {}) {
  const quantity = Math.max(1, asNumber(repair.quantity, 1));
  const fallbackAmount = asNumber(repair.totalPrice, estimatePricing(repair.problem, quantity).totalPrice);
  const amount = asNumber(payload.amount, fallbackAmount);
  const unitPrice = quantity > 0 ? amount / quantity : amount;

  return {
    type: "REPAIR",
    lineType: "REPAIR",
    description: `Reparação #${repair.id}: ${repair.problem}`,
    quantity,
    unitPrice,
    total: amount,
    lineTotal: amount,
    referenceId: repair.id,
    notes: normalizeText(payload.notes || repair.notes || "") || null,
  };
}

function normalizeRepairStatus(status) {
  return normalizeText(status).toUpperCase();
}

const TERMINAL_REPAIR_STATUSES = new Set(["DONE", "CLOSED", "CANCELLED", "CANCELED"]);

const REPAIR_TRANSITIONS = {
  QUOTE: new Set(["PENDING", "DIAGNOSED", "QUOTE_REQUESTED", "QUOTED"]),
  APPROVE: new Set(["QUOTED", "QUOTE_REQUESTED", "SCHEDULED", "APPROVED"]),
  SCHEDULE: new Set(["APPROVED", "QUOTED", "SCHEDULED"]),
  INVOICE: new Set(["DONE", "CLOSED", "APPROVED", "INVOICED"]),
  REGISTER_PAYMENT: new Set(["INVOICED", "DONE", "CLOSED", "APPROVED"]),
  COMPLETE: new Set(["SCHEDULED", "APPROVED", "INVOICED", "DONE"]),
  CLOSE: new Set(["DONE", "INVOICED", "CLOSED"]),
  CANCEL: new Set(["PENDING", "DIAGNOSED", "QUOTE_REQUESTED", "QUOTED", "APPROVED", "SCHEDULED", "INVOICED", "CANCELLED"]),
};

function ensureRepairTransition(repair, action) {
  const status = normalizeRepairStatus(repair?.status);
  if (!status) {
    return { ok: false, status: 409, error: "Estado atual da reparação inválido" };
  }
  if (action === "CANCEL" && ["CANCELLED", "CANCELED"].includes(status)) {
    return { ok: true, already: true };
  }
  if (TERMINAL_REPAIR_STATUSES.has(status) && !["INVOICE", "REGISTER_PAYMENT", "CLOSE", "CANCEL"].includes(action)) {
    return { ok: false, status: 409, error: `Não é possível executar ${action} para reparação ${status}` };
  }
  const allowed = REPAIR_TRANSITIONS[action];
  if (!allowed || allowed.has(status)) {
    return { ok: true };
  }
  return { ok: false, status: 409, error: `Transição inválida: ${status} -> ${action}` };
}

const RESERVATION_LOCK_TYPE = "REPAIR_STOCK_RESERVATION";
const ACTIVE_RESERVATION_STATUSES = new Set(["APPROVED"]);

function normalizeStockScope(value) {
  const scope = normalizeText(value || "CENTRAL").toUpperCase();
  return scope || "CENTRAL";
}

function normalizeRepairStockItem(item, fallbackScope = "CENTRAL", fallbackVehicleId = null) {
  return {
    scope: normalizeStockScope(item?.scope || fallbackScope),
    vehicleId: item?.vehicleId == null ? fallbackVehicleId : asNumber(item.vehicleId, 0) || null,
    productName: normalizeText(item?.productName || item?.name).toUpperCase(),
    unit: normalizeText(item?.unit || "KG").toUpperCase() || "KG",
    quantity: Math.max(1, asNumber(item?.quantity, 1)),
    category: normalizeText(item?.category || "CHEMICAL").toUpperCase() || "CHEMICAL",
  };
}

function summarizeRepairStockItems(items = []) {
  return items.map((item) => `${item.productName} ${item.quantity} ${item.unit}${item.scope ? ` @ ${item.scope}` : ""}`).join(", ");
}

function repairReservationFilter(repairId) {
  return {
    lockType: RESERVATION_LOCK_TYPE,
    entity: "Repair",
    entityId: asNumber(repairId, 0),
  };
}

async function listActiveRepairReservations(db, repairId = null) {
  if (!db?.operationalLock?.findMany) return [];
  const where = {
    lockType: RESERVATION_LOCK_TYPE,
    status: { in: [...ACTIVE_RESERVATION_STATUSES] },
  };

  if (repairId !== null && repairId !== undefined) {
    where.NOT = repairReservationFilter(repairId);
  }

  return db.operationalLock.findMany({ where });
}

function reservationItemsFromLock(lock) {
  const payload = lock?.payload && typeof lock.payload === "object" ? lock.payload : {};
  return Array.isArray(payload.items) ? payload.items : [];
}

async function buildReservedStockMap(db, repairId = null) {
  const activeReservations = await listActiveRepairReservations(db, repairId);
  const reservedMap = new Map();

  for (const reservation of activeReservations) {
    for (const item of reservationItemsFromLock(reservation)) {
      const normalized = normalizeRepairStockItem(item, item?.scope || reservation?.payload?.scope || "CENTRAL", item?.vehicleId ?? reservation?.payload?.vehicleId ?? null);
      const key = `${normalized.scope}|${normalized.vehicleId || ""}|${normalized.productName}|${normalized.unit}`;
      reservedMap.set(key, (reservedMap.get(key) || 0) + normalized.quantity);
    }
  }

  return reservedMap;
}

async function getRepairReservation(repairId, db = repository.prisma) {
  if (!db?.operationalLock?.findFirst) return null;
  return db.operationalLock.findFirst({
    where: repairReservationFilter(repairId),
    orderBy: { createdAt: "desc" },
  });
}

async function syncRepairReservationStatus(tx, repair, items, actor, status, reason) {
  const existing = await getRepairReservation(repair.id, tx);
  const payload = {
    repairId: repair.id,
    poolId: repair.poolId,
    clientId: repair.pool?.client?.id || null,
    scope: items[0]?.scope || "CENTRAL",
    vehicleId: items[0]?.vehicleId || null,
    items,
    actor,
    reason: reason || null,
    reservedAt: new Date().toISOString(),
  };

  const data = {
    lockType: RESERVATION_LOCK_TYPE,
    severity: "WARNING",
    status,
    entity: "Repair",
    entityId: repair.id,
    poolId: repair.poolId,
    clientId: repair.pool?.client?.id || null,
    title: "Stock reservado para reparação",
    message: `Stock ${status === "APPROVED" ? "reservado" : status === "CANCELLED" ? "libertado" : "processado"} para reparação #${repair.id}`,
    payload,
    approvedBy: status === "APPROVED" ? actor : existing?.approvedBy || actor,
    approvedAt: status === "APPROVED" ? new Date() : existing?.approvedAt || null,
    resolvedAt: status === "APPROVED" ? null : new Date(),
    rejectedAt: status === "CANCELLED" ? new Date() : existing?.rejectedAt || null,
  };

  return existing
    ? tx.operationalLock.update({ where: { id: existing.id }, data })
    : tx.operationalLock.create({ data });
}

function inferRepairParts(problem, explicitParts = []) {
  const text = normalizeText(problem).toLowerCase();
  const normalized = Array.isArray(explicitParts)
    ? explicitParts
        .map((item) => ({
          name: normalizeText(item?.name || item?.productName),
          unit: normalizeText(item?.unit || "KG") || "KG",
          quantity: Math.max(1, asNumber(item?.quantity, 1)),
          category: normalizeText(item?.category || "CHEMICAL") || "CHEMICAL",
        }))
        .filter((item) => item.name)
    : [];

  if (normalized.length) return normalized;

  if (text.includes("bomba")) {
    return [{ name: "BOMBA", unit: "UN", quantity: 1, category: "EQUIPMENT" }];
  }

  if (text.includes("luz")) {
    return [{ name: "LAMPADA", unit: "UN", quantity: 1, category: "ELECTRICAL" }];
  }

  if (text.includes("filtro")) {
    return [{ name: "FILTRO", unit: "UN", quantity: 1, category: "EQUIPMENT" }];
  }

  return [{ name: "MATERIAL GENERICO", unit: "UN", quantity: 1, category: "MISC" }];
}

async function checkRepairStockAvailability(parts = [], options = {}) {
  const db = options.db || repository.prisma;
  const balances = await stockRepository.listBalances({});
  const reservedMap = await buildReservedStockMap(db, options.repairId || null);
  const balanceMap = new Map(
    (balances || []).map((item) => [
      `${normalizeText(item.productName).toUpperCase()}|${normalizeText(item.unit).toUpperCase()}`,
      item,
    ])
  );

  return parts.map((part) => {
    const productName = normalizeText(part.productName || part.name).toUpperCase();
    const unit = normalizeText(part.unit).toUpperCase() || "KG";
    const key = `${productName}|${unit}`;
    const available = balanceMap.get(key);
    const availableQty = asNumber(available?.quantity, 0);
    const reservedQty = [...reservedMap.entries()]
      .filter(([reservedKey]) => reservedKey.endsWith(`|${productName}|${unit}`))
      .reduce((sum, [, value]) => sum + asNumber(value, 0), 0);
    const effectiveAvailable = Math.max(availableQty - reservedQty, 0);
    return {
      ...part,
      available: availableQty,
      reserved: reservedQty,
      effectiveAvailable,
      shortage: Math.max(part.quantity - effectiveAvailable, 0),
      inStock: effectiveAvailable >= part.quantity,
    };
  });
}

async function reserveRepairStock(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };
    const status = normalizeText(repair.status).toUpperCase();
    if (["DONE", "CANCELLED", "CANCELED"].includes(status)) {
      return { ok: false, status: 409, error: "Reparação já encerrada" };
    }

    const sourceItems = Array.isArray(payload.items) && payload.items.length
      ? payload.items
      : inferRepairParts(repair.problem, payload.partsRequired || payload.parts || []);

    const items = sourceItems
      .map((item) => normalizeRepairStockItem(item, payload.scope || "CENTRAL", payload.vehicleId || null))
      .filter((item) => item.productName && item.quantity > 0);

    if (!items.length) {
      return { ok: false, status: 400, error: "Nenhum item de stock válido para reservar" };
    }

    const availability = await checkRepairStockAvailability(items, { db: tx, repairId: repair.id });
    const shortage = availability.filter((item) => !item.inStock);
    if (shortage.length) {
      return { ok: false, status: 409, error: "Stock insuficiente para reserva", shortage, availability };
    }

    const reservation = await syncRepairReservationStatus(tx, repair, availability, actor, "APPROVED", payload.reason || "RESERVATION");

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_STOCK_RESERVED",
      component: "Repair",
      message: "Stock reservado para reparação",
      description: JSON.stringify({ repairId: repair.id, actor, items: availability, reservationId: reservation.id }),
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_STOCK_RESERVED",
      eventType: "REPAIR_STOCK_RESERVED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, items: availability, reservationId: reservation.id },
      message: `Stock reservado para reparação #${repair.id}`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_STOCK_RESERVED",
      eventType: "REPAIR_STOCK_RESERVED",
      title: "Stock reservado para reparação",
      message: `O stock necessário para a reparação #${repair.id} foi reservado.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, items: availability },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_STOCK_RESERVED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      actor,
      items: availability,
      reservationId: reservation.id,
      source: "repair-stock-reservation",
    });

    await emitEquipmentStockEvent(STOCK_EVENT_TYPES.STOCK_RESERVED, {
      repairId: repair.id,
      poolId: repair.poolId,
      items: availability,
      actor,
      source: "repair-stock-reservation",
    });

    return { ok: true, repair, reservation, items: availability };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function releaseRepairReservation(repairId, payload = {}, db = null, actor = "repair-os", reason = "CANCELLED") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const reservation = await getRepairReservation(repair.id, tx);
    if (!reservation) {
      return { ok: true, released: false, repair };
    }

    const updatedReservation = await tx.operationalLock.update({
      where: { id: reservation.id },
      data: {
        status: "CANCELLED",
        rejectedAt: new Date(),
        resolvedAt: new Date(),
        message: `Reserva libertada para reparação #${repair.id}`,
        payload: {
          ...(reservation.payload && typeof reservation.payload === "object" ? reservation.payload : {}),
          releasedAt: new Date().toISOString(),
          releaseReason: reason,
          releaseNote: normalizeText(payload.reason || payload.notes || "") || null,
        },
      },
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_STOCK_RELEASED",
      component: "Repair",
      message: "Stock libertado após cancelamento",
      description: JSON.stringify({ repairId: repair.id, actor, reason, reservationId: reservation.id }),
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_STOCK_RELEASED",
      eventType: "REPAIR_STOCK_RELEASED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, reason, reservationId: reservation.id },
      message: `Reserva de stock libertada para reparação #${repair.id}`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_STOCK_RELEASED",
      eventType: "REPAIR_STOCK_RELEASED",
      title: "Reserva de stock libertada",
      message: `A reserva de stock da reparação #${repair.id} foi libertada.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, reservationId: reservation.id },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_STOCK_RELEASED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      actor,
      reservationId: reservation.id,
      source: "repair-stock-release",
    });

    await emitEquipmentStockEvent(STOCK_EVENT_TYPES.STOCK_RELEASED, {
      repairId: repair.id,
      poolId: repair.poolId,
      reservationId: reservation.id,
      actor,
      source: "repair-stock-release",
    });

    return { ok: true, repair, reservation: updatedReservation, released: true };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function consumeReservedRepairStock(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const reservation = await getRepairReservation(repair.id, tx);
    if (!reservation) {
      return { ok: false, status: 409, error: "Reserva de stock em falta" };
    }

    const items = reservationItemsFromLock(reservation)
      .map((item) => normalizeRepairStockItem(item, item?.scope || reservation?.payload?.scope || "CENTRAL", item?.vehicleId ?? reservation?.payload?.vehicleId ?? null))
      .filter((item) => item.productName && item.quantity > 0);

    if (!items.length) {
      return { ok: false, status: 409, error: "Reserva de stock sem itens válidos" };
    }

    const consumed = [];
    for (const item of items) {
      const quantity = Math.max(1, asNumber(item.quantity, 1));
      await stockRepository.adjustBalance(tx, {
        scope: item.scope,
        vehicleId: item.vehicleId,
        productName: item.productName,
        unit: item.unit,
        category: item.category,
        delta: -quantity,
      });

      const movement = await stockRepository.createMovement(tx, {
        movementType: "CONSUMPTION",
        scopeFrom: item.scope,
        scopeTo: "REPAIR",
        vehicleId: item.vehicleId,
        productName: item.productName,
        category: item.category,
        unit: item.unit,
        quantity,
        poolId: repair.poolId,
        clientId: repair.pool?.client?.id || null,
        notes: `Consumo de reparação #${repair.id}`,
        createdBy: actor,
      });

      consumed.push(movement);
    }

    const finalizedReservation = await tx.operationalLock.update({
      where: { id: reservation.id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        message: `Reserva consumida para reparação #${repair.id}`,
        payload: {
          ...(reservation.payload && typeof reservation.payload === "object" ? reservation.payload : {}),
          consumedAt: new Date().toISOString(),
          consumedBy: actor,
        },
      },
    });

    const summary = summarizeRepairStockItems(items);

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_STOCK_CONSUMED",
      component: "Repair",
      message: "Stock consumido na conclusão da reparação",
      description: JSON.stringify({ repairId: repair.id, actor, items, reservationId: reservation.id }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_STOCK_CONSUMED",
      eventType: "REPAIR_STOCK_CONSUMED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, items, reservationId: reservation.id },
      message: `Stock consumido para reparação #${repair.id}`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_STOCK_CONSUMED",
      eventType: "REPAIR_STOCK_CONSUMED",
      title: "Stock consumido na reparação",
      message: `O stock reservado para a reparação #${repair.id} foi consumido${summary ? `: ${summary}` : ""}.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, items },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_STOCK_CONSUMED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      actor,
      items,
      reservationId: reservation.id,
      source: "repair-stock-consumption",
    });

    await emitEquipmentStockEvent(STOCK_EVENT_TYPES.STOCK_CONSUMED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      actor,
      items,
      reservationId: reservation.id,
      source: "repair-stock-consumption",
    });

    await emitFinanceEvent(FINANCE_EVENT_TYPES.FINANCE_INVOICE_DRAFT, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      amount: Number(repair.totalPrice || 0),
      source: "repair-stock-consumption",
    });

    return {
      ok: true,
      repair,
      reservation: finalizedReservation,
      consumed,
    };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function buildRepairDiagnostic(tx, repair, payload = {}, actor = "repair-os") {
  const partsRequired = inferRepairParts(repair.problem, payload.partsRequired || payload.parts || []);
  const stockCheck = await checkRepairStockAvailability(partsRequired, { db: tx, repairId: repair.id });
  const equipment = repair.pool?.equipment || null;
  const equipmentHistory = Array.isArray(repair.pool?.technicalHistory)
    ? repair.pool.technicalHistory.slice(0, 10).map((item) => ({
        id: item.id,
        type: item.type,
        component: item.component,
        message: item.message,
        description: item.description,
        status: item.status,
        createdAt: item.createdAt,
      }))
    : [];

  return {
    actor,
    issue: repair.problem,
    equipment: equipment
      ? {
          id: equipment.id,
          type: equipment.type,
          brand: equipment.brand,
          model: equipment.model,
          status: equipment.status || null,
        }
      : null,
    equipmentHistory,
    partsRequired: stockCheck,
    stockOk: stockCheck.every((part) => part.inStock),
    diagnosticNotes: normalizeText(payload.diagnosticNotes || payload.notes || repair.notes),
  };
}

async function createRepairTicket(payload = {}, actor = "repair-os", db = null, options = {}) {
  const executor = db || repository;

  const run = async (tx) => {
    const poolId = asNumber(payload.poolId, 0);
    const problem = normalizeText(payload.problem);
    if (!poolId || !problem) {
      return { ok: false, status: 400, error: "Dados inválidos" };
    }

    let context = options.context || {};
    if (!context.pool && !context.clientId && tx.pool?.findUnique) {
      context = {
        ...context,
        ...(await repository.getPoolRepairContext(poolId, tx).then((pool) => ({ pool, clientId: pool?.client?.id || null })).catch(() => ({}))),
      };
    }
    const priority = calculatePriority(problem, payload.priority || options.priority);
    const pricing = {
      ...estimatePricing(problem, payload.quantity),
      unitPrice: payload.unitPrice !== undefined && Number.isFinite(Number(payload.unitPrice))
        ? Number(payload.unitPrice)
        : estimatePricing(problem, payload.quantity).unitPrice,
    };
    pricing.totalPrice = payload.totalPrice !== undefined && Number.isFinite(Number(payload.totalPrice))
      ? Number(payload.totalPrice)
      : pricing.unitPrice * pricing.quantity;
    const notes = buildRepairNotes(
      normalizeText(payload.notes),
      options.contextNotes || null,
    );

    const repair = await repository.createRepair(tx, {
      poolId,
      problem,
      quantity: pricing.quantity,
      priority,
      notes,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      status: payload.status || "PENDING",
    });

    const clientId = context.clientId || context.pool?.client?.id || null;
    const poolName = context.pool?.name || null;

    await repository.createTechnicalHistory(tx, {
      poolId,
      type: "REPAIR_CREATED",
      component: "Repair",
      message: "Pedido de reparação criado",
      description: JSON.stringify({
        repairId: repair.id,
        actor,
        priority,
        poolName,
      }),
      status: "OPEN",
      performedAt: new Date(),
    });

    if (options.createNotification !== false) {
      await repository.createNotification(tx, {
        clientId,
        type: priority === "HIGH" ? "REPAIR_HIGH_PRIORITY" : "REPAIR_REQUEST",
        eventType: "REPAIR_TICKET_CREATED",
        title: "Pedido de reparação registado",
        message: `Foi registado um pedido de reparação para ${poolName || `a piscina #${poolId}`}.`,
        role: "ADMIN",
        severity: priority,
        status: "PENDING",
        metadata: { repairId: repair.id, poolId, priority, actor },
      });
    }

    await repository.createAudit(tx, {
      action: "REPAIR_TICKET_CREATED",
      eventType: "REPAIR_TICKET_CREATED",
      entity: "Repair",
      entityId: repair.id,
      poolId,
      clientId,
      metadata: {
        priority,
        actor,
        source: options.source || "repair-route",
      },
      message: `Reparação #${repair.id} criada`,
    });

    if (options.emitEvent !== false) {
      await emitRepairEvent(EVENT_TYPES.REPAIR_TICKET_CREATED, {
        repairId: repair.id,
        poolId,
        clientId,
        priority,
        actor,
        source: options.source || "repair-route",
      });
    }

    return {
      ok: true,
      repair,
      priority,
    };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function diagnoseRepair(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const diagnostic = await buildRepairDiagnostic(tx, repair, payload, actor);
    const updated = await repository.updateRepair(tx, repair.id, {
      status: repair.status === "PENDING" ? "DIAGNOSED" : repair.status,
      notes: buildRepairNotes(repair.notes, diagnostic.diagnosticNotes),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_DIAGNOSED",
      component: "Repair",
      message: "Reparação diagnosticada",
      description: JSON.stringify({ repairId: repair.id, diagnostic, actor }),
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_DIAGNOSED",
      eventType: "REPAIR_DIAGNOSED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, stockOk: diagnostic.stockOk },
      message: `Reparação #${repair.id} diagnosticada`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: diagnostic.stockOk ? "REPAIR_DIAGNOSED" : "REPAIR_STOCK_CHECK",
      eventType: "REPAIR_DIAGNOSED",
      title: "Diagnóstico de reparação concluído",
      message: `Diagnóstico concluído para a reparação #${repair.id}${diagnostic.stockOk ? "" : ". Existem faltas de stock para as partes necessárias."}`,
      role: "ADMIN",
      severity: diagnostic.stockOk ? "NORMAL" : "WARNING",
      status: "PENDING",
      metadata: { repairId: repair.id, partsRequired: diagnostic.partsRequired },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_DIAGNOSED, {
      repairId: repair.id,
      poolId: repair.poolId,
      actor,
      diagnostic: true,
      stockOk: diagnostic.stockOk,
      source: "repair-diagnosis",
    });

    return {
      ok: true,
      repair: updated,
      diagnostic,
    };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function quoteRepair(repairId, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "QUOTE");
    if (!transition.ok) return transition;

    const diagnostic = await buildRepairDiagnostic(tx, repair, {}, actor);
    const pricing = estimatePricing(repair.problem, repair.quantity);
    const repairUpdate = await repository.updateRepair(tx, repair.id, {
      status: "QUOTED",
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      notes: buildRepairNotes(repair.notes, `Orçamento gerado. Partes necessárias: ${diagnostic.partsRequired.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(", ")}`),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_QUOTED",
      component: "Repair",
      message: "Reparação orçamentada",
      description: JSON.stringify({ repairId: repair.id, actor, diagnostic }),
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_QUOTED",
      eventType: "REPAIR_QUOTED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      metadata: { actor },
      message: `Reparação #${repair.id} orçamentada`,
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_QUOTED, {
      repairId: repair.id,
      poolId: repair.poolId,
      actor,
      source: "repair-route",
    });

    return { ok: true, repair: repairUpdate, diagnostic };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function approveRepair(repairId, db = null, actor = "repair-os") {
  const executor = db || repository;

  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "APPROVE");
    if (!transition.ok) return transition;

    const updated = await repository.updateRepair(tx, repairId, {
      status: "APPROVED",
      notes: buildRepairNotes(repair.notes, "Aprovação do cliente registada."),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: updated.poolId,
      type: "REPAIR_APPROVED",
      component: "Repair",
      message: "Reparação aprovada",
      description: JSON.stringify({ repairId: updated.id, actor }),
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_APPROVED",
      eventType: "REPAIR_APPROVED",
      entity: "Repair",
      entityId: updated.id,
      poolId: updated.poolId,
      metadata: { actor },
      message: `Reparação #${updated.id} aprovada`,
    });

    await repository.createNotification(tx, {
      clientId: updated.pool?.client?.id || null,
      type: "REPAIR_APPROVED",
      eventType: "REPAIR_APPROVED",
      title: "Aprovação da reparação registada",
      message: `A reparação #${updated.id} recebeu aprovação.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: updated.id },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_APPROVED, {
      repairId: updated.id,
      poolId: updated.poolId,
      actor,
      source: "repair-route",
    });

    return { ok: true, repair: updated };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function invoiceRepair(repairId, db = null, actor = "repair-os") {
  return generateRepairInvoice(repairId, {}, db, actor);
}

async function generateRepairInvoice(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "INVOICE");
    if (!transition.ok) return transition;

    const clientId = repair.pool?.client?.id || null;
    if (!clientId) return { ok: false, status: 409, error: "Reparação sem cliente associado" };

    const monthRef = normalizeText(payload.monthRef) || new Date().toISOString().slice(0, 7);
    const draft = await FinanceBusiness.createDraftInvoice({
      clientId,
      monthRef,
      notes: buildRepairNotes(repair.notes, `Fatura gerada para reparação #${repair.id}.`),
      lines: [buildRepairInvoiceLine(repair, payload)],
    }, actor);

    if (!draft.ok) return draft;

    const issued = await FinanceBusiness.issueInvoice(draft.invoice.id, {
      invoiceNumber: payload.invoiceNumber,
      externalInvoiceNo: payload.externalInvoiceNo,
      notes: buildRepairNotes(payload.notes, `Fatura emitida para reparação #${repair.id}.`),
    }, actor);

    if (!issued.ok) return issued;

    const updatedRepair = await repository.updateRepair(tx, repair.id, {
      status: "INVOICED",
      notes: buildRepairNotes(repair.notes, `Fatura #${issued.invoice.id} emitida.`),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_INVOICE_GENERATED",
      component: "Repair",
      message: "Fatura gerada para a reparação",
      description: JSON.stringify({ repairId: repair.id, invoiceId: issued.invoice.id, actor }),
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_INVOICE_GENERATED",
      eventType: "REPAIR_INVOICE_GENERATED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId,
      metadata: { actor, invoiceId: issued.invoice.id },
      message: `Fatura #${issued.invoice.id} gerada para a reparação #${repair.id}`,
    });

    await repository.createNotification(tx, {
      clientId,
      type: "REPAIR_INVOICE_GENERATED",
      eventType: "REPAIR_INVOICE_GENERATED",
      title: "Fatura de reparação gerada",
      message: `Foi gerada a fatura da reparação #${repair.id}.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, invoiceId: issued.invoice.id },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_INVOICE_GENERATED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId,
      actor,
      invoiceId: issued.invoice.id,
      source: "repair-invoice-generation",
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_INVOICED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId,
      actor,
      invoiceId: issued.invoice.id,
      source: "repair-invoice-generation",
    });

    return { ok: true, repair: updatedRepair, invoice: issued.invoice };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function registerRepairPayment(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "REGISTER_PAYMENT");
    if (!transition.ok) return transition;

    const invoiceId = asNumber(payload.invoiceId, 0);
    if (!invoiceId) return { ok: false, status: 400, error: "invoiceId obrigatório" };

    const payment = await FinanceBusiness.registerPayment(invoiceId, {
      amount: asNumber(payload.amount, 0),
      method: payload.method,
      notes: buildRepairNotes(payload.notes, `Pagamento associado à reparação #${repair.id}.`),
    }, actor);

    if (!payment.ok) return payment;

    const updatedRepair = await repository.updateRepair(tx, repair.id, {
      paid: payment.invoice?.status === "PAID",
      paidAt: payment.invoice?.status === "PAID" ? (payment.invoice?.paidAt || new Date()) : repair.paidAt,
      notes: buildRepairNotes(repair.notes, `Pagamento registado na fatura #${invoiceId}.`),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_PAYMENT_RECORDED",
      component: "Repair",
      message: "Pagamento registado para a reparação",
      description: JSON.stringify({ repairId: repair.id, invoiceId, actor, status: payment.invoice?.status || null }),
      status: payment.invoice?.status === "PAID" ? "DONE" : "OPEN",
      performedAt: new Date(),
      doneAt: payment.invoice?.status === "PAID" ? new Date() : null,
    });

    await repository.createAudit(tx, {
      action: "REPAIR_PAYMENT_RECORDED",
      eventType: "REPAIR_PAYMENT_RECORDED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, invoiceId, paymentStatus: payment.invoice?.status || null },
      message: `Pagamento registado para a reparação #${repair.id}`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_PAYMENT_RECORDED",
      eventType: "REPAIR_PAYMENT_RECORDED",
      title: "Pagamento da reparação registado",
      message: `O pagamento da reparação #${repair.id} foi registado${payment.invoice?.status === "PAID" ? " e a fatura ficou paga." : "."}`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, invoiceId, paymentStatus: payment.invoice?.status || null },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_PAYMENT_RECORDED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      actor,
      invoiceId,
      invoiceStatus: payment.invoice?.status || null,
      source: "repair-payment-tracking",
    });

    return { ok: true, repair: updatedRepair, invoice: payment.invoice, payment };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function closeRepair(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "CLOSE");
    if (!transition.ok) return transition;

    if (!repair.paid && !payload.force) {
      return { ok: false, status: 409, error: "A reparação só pode ser fechada após pagamento" };
    }

    const closed = await repository.updateRepair(tx, repair.id, {
      status: "CLOSED",
      doneAt: repair.doneAt || new Date(),
      notes: buildRepairNotes(repair.notes, normalizeText(payload.notes || "Reparação encerrada")),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_CLOSED",
      component: "Repair",
      message: "Reparação fechada",
      description: JSON.stringify({ repairId: repair.id, actor, force: Boolean(payload.force) }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_CLOSED",
      eventType: "REPAIR_CLOSED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, force: Boolean(payload.force) },
      message: `Reparação #${repair.id} fechada`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_CLOSED",
      eventType: "REPAIR_CLOSED",
      title: "Reparação fechada",
      message: `A reparação #${repair.id} foi encerrada com sucesso.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_CLOSED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      actor,
      source: "repair-closeout",
    });

    return { ok: true, repair: closed };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function markRepairSent(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) {
      return { ok: false, status: 404, error: "Reparação não encontrada" };
    }

    const channel = normalizeText(payload.channel).toUpperCase();
    const message = normalizeText(payload.message);
    const historyMessage =
      channel && message
        ? `Mensagem de reparação enviada ao cliente via ${channel}. Problema: ${repair.problem}. Mensagem: ${message}`
        : channel
          ? `Mensagem de reparação enviada ao cliente via ${channel}. Problema: ${repair.problem}.`
          : `Mensagem de reparação enviada ao cliente. Problema: ${repair.problem}.`;

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "CLIENT_MESSAGE",
      component: "Repair",
      message: historyMessage,
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_MESSAGE",
      eventType: "REPAIR_MESSAGE_SENT",
      title: "Mensagem de reparação enviada",
      message: `Foi enviada uma mensagem ao cliente sobre a reparação #${repair.id}.`,
      role: "CLIENT",
      severity: "INFO",
      status: "PENDING",
      metadata: { repairId: repair.id, actor, channel: channel || null },
    });

    await repository.createAudit(tx, {
      action: "REPAIR_MESSAGE_SENT",
      eventType: "REPAIR_MESSAGE_SENT",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, channel: channel || null },
      message: `Mensagem registada para reparação #${repair.id}`,
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_MESSAGE_SENT, {
      repairId: repair.id,
      poolId: repair.poolId,
      actor,
      channel: channel || null,
      source: "repair-message",
    });

    return { ok: true, message: "Envio ao cliente registado no histórico" };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function scheduleRepair(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "SCHEDULE");
    if (!transition.ok) return transition;

    const reservation = await reserveRepairStock(repair.id, payload, tx, actor);
    if (!reservation.ok) return reservation;

    const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    const technicianId = payload.technicianId ? asNumber(payload.technicianId, 0) : null;
    const notes = buildRepairNotes(
      repair.notes,
      [
        scheduledAt ? `Agendada para ${scheduledAt.toISOString()}` : null,
        technicianId ? `Técnico atribuído: ${technicianId}` : null,
        normalizeText(payload.notes),
      ].filter(Boolean).join(" | ")
    );

    const updated = await repository.updateRepair(tx, repair.id, {
      status: "SCHEDULED",
      notes: buildRepairNotes(notes, technicianId ? `Técnico atribuído: ${technicianId}` : null),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_SCHEDULED",
      component: "Repair",
      message: "Reparação agendada",
      description: JSON.stringify({ repairId: repair.id, scheduledAt, technicianId, actor }),
      status: "OPEN",
      performedAt: new Date(),
      nextSuggested: scheduledAt || null,
    });

    await repository.createAudit(tx, {
      action: "REPAIR_SCHEDULED",
      eventType: "REPAIR_SCHEDULED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, technicianId, scheduledAt: scheduledAt ? scheduledAt.toISOString() : null },
      message: `Reparação #${repair.id} agendada`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_SCHEDULED",
      eventType: "REPAIR_SCHEDULED",
      title: "Reparação agendada",
      message: `A reparação #${repair.id} foi agendada${scheduledAt ? ` para ${scheduledAt.toLocaleString("pt-PT")}` : ""}.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, technicianId, scheduledAt: scheduledAt ? scheduledAt.toISOString() : null, assignedTechnician: Boolean(technicianId) },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_SCHEDULED, {
      repairId: repair.id,
      poolId: repair.poolId,
      actor,
      technicianId,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      reservationId: reservation.reservation.id,
      source: "repair-schedule",
    });

    return { ok: true, repair: updated, reservation: reservation.reservation };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function completeRepair(repairId, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "COMPLETE");
    if (!transition.ok) return transition;

    const consumed = await consumeReservedRepairStock(repair.id, {}, tx, actor);
    if (!consumed.ok) return consumed;

    const updatedRepair = await repository.updateRepair(tx, repairId, {
      status: "DONE",
      doneAt: new Date(),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_COMPLETED",
      component: "Repair",
      message: "Reparação concluída",
      description: JSON.stringify({ repairId: repair.id, actor, stockConsumed: true }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_COMPLETED",
      eventType: "REPAIR_COMPLETED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      metadata: { actor, reservationId: consumed.reservation?.id || null },
      message: `Reparação #${repair.id} concluída com consumo de stock`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_COMPLETED",
      eventType: "REPAIR_COMPLETED",
      title: "Reparação concluída",
      message: `A reparação #${repair.id} foi concluída e o stock foi consumido.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, reservationId: consumed.reservation?.id || null },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_COMPLETED, {
      repairId: repair.id,
      poolId: repair.poolId,
      actor,
      reservationId: consumed.reservation?.id || null,
      stockConsumed: true,
      source: "repair-route",
    });

    return { ok: true, repair: updatedRepair };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function deleteRepair(repairId, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) {
      return { ok: false, status: 404, error: "Reparação não encontrada" };
    }

    await releaseRepairReservation(repair.id, { reason: "DELETE" }, tx, actor, "DELETE");

    await repository.createAudit(tx, {
      action: "REPAIR_DELETED",
      eventType: "REPAIR_DELETED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      metadata: { actor },
      message: `Reparação #${repair.id} eliminada`,
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_DELETED, {
      repairId: repair.id,
      poolId: repair.poolId,
      actor,
      source: "repair-route",
    });

    await repository.deleteRepair(tx, repairId);
    return { ok: true };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function cancelRepair(repairId, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    const transition = ensureRepairTransition(repair, "CANCEL");
    if (!transition.ok) return transition;
    if (transition.already) return { ok: true, repair };

    const release = await releaseRepairReservation(repair.id, payload, tx, actor, "CANCELLED");
    if (!release.ok) return release;

    const updatedRepair = await repository.updateRepair(tx, repair.id, {
      status: "CANCELLED",
      notes: buildRepairNotes(repair.notes, normalizeText(payload.reason || payload.notes || "Reparação cancelada")),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_CANCELLED",
      component: "Repair",
      message: "Reparação cancelada",
      description: JSON.stringify({ repairId: repair.id, actor, reason: normalizeText(payload.reason || payload.notes || "") }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_CANCELLED",
      eventType: "REPAIR_CANCELLED",
      entity: "Repair",
      entityId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: { actor, reason: normalizeText(payload.reason || payload.notes || "") || null },
      message: `Reparação #${repair.id} cancelada`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_CANCELLED",
      eventType: "REPAIR_CANCELLED",
      title: "Reparação cancelada",
      message: `A reparação #${repair.id} foi cancelada e a reserva de stock foi libertada.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_CANCELLED, {
      repairId: repair.id,
      poolId: repair.poolId,
      actor,
      source: "repair-cancel",
    });

    return { ok: true, repair: updatedRepair };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

async function getRepairDetail(repairId) {
  const repair = await repository.getRepair(repairId);
  if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };
  return { ok: true, repair };
}

async function listRepairsByPool(poolId) {
  const repairs = await repository.listRepairsByPool(poolId);
  return { ok: true, repairs };
}

async function recordRepairPhoto(repairId, file, payload = {}, db = null, actor = "repair-os") {
  const run = async (tx) => {
    const repair = await repository.getRepair(repairId, tx);
    if (!repair) return { ok: false, status: 404, error: "Reparação não encontrada" };

    if (!file) {
      return { ok: false, status: 400, error: "Sem ficheiro" };
    }

    const photo = await repository.createAttachment(tx, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      fileName: payload.fileName || file.originalname || file.filename,
      fileUrl: payload.fileUrl || toPublicUploadUrl("repairs", file.filename),
      mimeType: payload.mimeType || file.mimetype || "application/octet-stream",
      fileSize: asNumber(file.size, 0),
    });

    await repository.createTechnicalHistory(tx, {
      poolId: repair.poolId,
      type: "REPAIR_PHOTO_UPLOADED",
      component: "Repair",
      message: "Foto adicionada à reparação",
      description: JSON.stringify({ repairId: repair.id, photoId: photo?.id || null, actor, type: normalizeText(payload.type || "AFTER") || "AFTER" }),
      status: "OPEN",
      performedAt: new Date(),
    });

    await repository.createAudit(tx, {
      action: "REPAIR_PHOTO_UPLOADED",
      eventType: "REPAIR_PHOTO_UPLOADED",
      entity: "Attachment",
      entityId: photo?.id || null,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      metadata: {
        repairId: repair.id,
        actor,
        type: normalizeText(payload.type || "AFTER") || "AFTER",
        url: photo?.fileUrl || null,
      },
      message: `Foto registada para a reparação #${repair.id}`,
    });

    await repository.createNotification(tx, {
      clientId: repair.pool?.client?.id || null,
      type: "REPAIR_PHOTO_UPLOADED",
      eventType: "REPAIR_PHOTO_UPLOADED",
      title: "Foto da reparação adicionada",
      message: `Foi adicionada uma foto à reparação #${repair.id}.`,
      role: "ADMIN",
      severity: "NORMAL",
      status: "PENDING",
      metadata: { repairId: repair.id, photoId: photo?.id || null },
    });

    await emitRepairEvent(EVENT_TYPES.REPAIR_PHOTO_UPLOADED, {
      repairId: repair.id,
      poolId: repair.poolId,
      clientId: repair.pool?.client?.id || null,
      actor,
      photoId: photo?.id || null,
      url: photo?.fileUrl || null,
      source: "repair-photo-upload",
    });

    return { ok: true, photo };
  };

  if (db) return run(db);
  return repository.transaction(run);
}

module.exports = {
  createRepairTicket,
  quoteRepair,
  approveRepair,
  invoiceRepair,
  generateRepairInvoice,
  registerRepairPayment,
  closeRepair,
  markRepairSent,
  completeRepair,
  deleteRepair,
  cancelRepair,
  getRepairDetail,
  listRepairsByPool,
  recordRepairPhoto,
  diagnoseRepair,
  scheduleRepair,
  calculatePriority,
  estimatePricing,
  buildRepairDiagnostic,
  inferRepairParts,
  checkRepairStockAvailability,
};