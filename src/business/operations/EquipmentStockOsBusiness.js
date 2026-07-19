const ServiceVisitRepository = require("../../dal/ServiceVisitRepository");
const repository = require("../../dal/EquipmentStockRepository");
const { EVENT_TYPES, emitEquipmentStockEvent } = require("../../services/equipmentStockEventService");

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function s(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  const raw = s(value);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function qrCode(prefix, id, extra) {
  return `${prefix}-${id}${extra ? `-${extra}` : ""}`;
}

function equipmentStatusFromRecord(equipment, pool) {
  const notes = s(equipment?.notes).toUpperCase();
  if (notes.includes("OFFLINE") || notes.includes("AVARI")) return "REPAIR";
  if ((pool?.technicalAlerts || []).some((item) => String(item.status || "").toUpperCase() === "OPEN")) return "ALERT";
  return "ACTIVE";
}

function parseChemicals(productsField, chemicalsField) {
  const fromProducts = toJson(productsField, []);
  if (Array.isArray(fromProducts) && fromProducts.length) {
    return fromProducts
      .map((item) => ({
        name: s(item.name || item.productName),
        quantity: n(item.quantity, 0),
        unit: s(item.unit || "KG") || "KG",
      }))
      .filter((item) => item.name && item.quantity > 0);
  }

  const fromChemicals = Array.isArray(chemicalsField)
    ? chemicalsField
    : toJson(chemicalsField, []);

  return (Array.isArray(fromChemicals) ? fromChemicals : [])
    .map((item) => ({
      name: s(item.name || item.productName),
      quantity: n(item.quantity, 0),
      unit: s(item.unit || "KG") || "KG",
    }))
    .filter((item) => item.name && item.quantity > 0);
}

async function listEquipmentInventory(filters = {}) {
  const where = {};
  if (filters.poolId) where.poolId = Number(filters.poolId);
  const equipment = await repository.listEquipmentInventory(where);
  return equipment.map((item) => ({
    id: item.id,
    poolId: item.poolId,
    clientId: item.pool?.clientId || null,
    poolName: item.pool?.name || null,
    clientName: item.pool?.client?.name || null,
    type: item.type,
    brand: item.brand,
    model: item.model,
    pumpType: item.pumpType,
    filterType: item.filterType,
    hasLights: item.hasLights,
    status: equipmentStatusFromRecord(item, item.pool),
    lifecycleStage: item.createdAt ? "INSTALLED" : "PLANNED",
    qrCode: qrCode("EQ", item.id, item.poolId),
    barcode: qrCode("BAR", item.id, item.poolId),
    maintenanceDueAt: null,
    warrantyUntil: null,
    updatedAt: item.updatedAt,
  }));
}

async function getEquipmentLifecycle(equipmentId) {
  const equipment = await repository.getEquipmentById(equipmentId);
  if (!equipment) {
    return { ok: false, status: 404, error: "Equipamento não encontrado" };
  }

  const [history, repairs, attachments] = await Promise.all([
    repository.listEquipmentHistory(equipment.poolId),
    repository.listEquipmentRepairs(equipment.poolId),
    repository.listEquipmentAttachments(equipment.poolId),
  ]);

  const maintenanceSchedule = history.filter((item) => String(item.type || "").startsWith("EQUIPMENT_MAINTENANCE"));
  const warranty = history
    .filter((item) => item.type === "EQUIPMENT_WARRANTY")
    .map((item) => ({ id: item.id, description: item.description, nextSuggested: item.nextSuggested, status: item.status, createdAt: item.createdAt }));
  const installations = history.filter((item) => item.type === "EQUIPMENT_INSTALLATION");
  const repairHistory = repairs.map((item) => ({
    id: item.id,
    status: item.status,
    problem: item.problem,
    notes: item.notes,
    doneAt: item.doneAt,
    createdAt: item.createdAt,
  }));
  const photos = attachments
    .filter((item) => String(item.mimeType || "").startsWith("image/"))
    .map((item) => ({ id: item.id, fileName: item.fileName, fileUrl: item.fileUrl, createdAt: item.createdAt }));
  const documents = attachments
    .filter((item) => !String(item.mimeType || "").startsWith("image/"))
    .map((item) => ({ id: item.id, fileName: item.fileName, fileUrl: item.fileUrl, createdAt: item.createdAt }));

  return {
    ok: true,
    lifecycle: {
      equipmentId: equipment.id,
      poolId: equipment.poolId,
      status: equipmentStatusFromRecord(equipment, { technicalAlerts: [] }),
      maintenanceSchedule,
      warranty,
      installationHistory: installations,
      repairHistory,
      photos,
      documents,
      qrCode: qrCode("EQ", equipment.id, equipment.poolId),
      barcode: qrCode("BAR", equipment.id, equipment.poolId),
    },
  };
}

async function createEquipmentMaintenance(equipmentId, payload = {}, actor = "system") {
  const equipment = await repository.getEquipmentById(equipmentId);
  if (!equipment) return { ok: false, status: 404, error: "Equipamento não encontrado" };

  const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
  const history = await repository.createEquipmentHistory({
    poolId: equipment.poolId,
    type: "EQUIPMENT_MAINTENANCE_SCHEDULED",
    component: s(payload.component || equipment.type || "EQUIPMENT") || "EQUIPMENT",
    message: s(payload.message || "Manutenção agendada"),
    description: s(payload.description || payload.notes || ""),
    status: "SCHEDULED",
    performedAt: new Date(),
    nextSuggested: dueAt,
  });

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_MAINTENANCE_SCHEDULED, {
    equipmentId: equipment.id,
    poolId: equipment.poolId,
    dueAt: dueAt ? dueAt.toISOString() : null,
    actor,
  });

  return { ok: true, maintenance: history };
}

async function registerEquipmentWarranty(equipmentId, payload = {}, actor = "system") {
  const equipment = await repository.getEquipmentById(equipmentId);
  if (!equipment) return { ok: false, status: 404, error: "Equipamento não encontrado" };

  const validUntil = payload.validUntil ? new Date(payload.validUntil) : null;
  const history = await repository.createEquipmentHistory({
    poolId: equipment.poolId,
    type: "EQUIPMENT_WARRANTY",
    component: s(payload.component || equipment.type || "EQUIPMENT") || "EQUIPMENT",
    message: s(payload.provider || "Warranty"),
    description: s(payload.description || payload.notes || ""),
    status: s(payload.status || "ACTIVE") || "ACTIVE",
    performedAt: new Date(),
    nextSuggested: validUntil,
  });

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_WARRANTY_UPDATED, {
    equipmentId: equipment.id,
    poolId: equipment.poolId,
    validUntil: validUntil ? validUntil.toISOString() : null,
    actor,
  });

  return { ok: true, warranty: history };
}

async function updateEquipmentStatus(equipmentId, payload = {}, actor = "system") {
  const equipment = await repository.getEquipmentById(equipmentId);
  if (!equipment) return { ok: false, status: 404, error: "Equipamento não encontrado" };

  const status = s(payload.status || "ACTIVE") || "ACTIVE";
  const notes = [s(equipment.notes), `[STATUS:${status}]`, s(payload.notes)].filter(Boolean).join(" | ");
  const updated = await repository.updateEquipment(equipmentId, { notes });
  const history = await repository.createEquipmentHistory({
    poolId: equipment.poolId,
    type: "EQUIPMENT_STATUS",
    component: s(payload.component || equipment.type || "EQUIPMENT") || "EQUIPMENT",
    message: status,
    description: s(payload.notes || ""),
    status,
    performedAt: new Date(),
  });

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_STATUS_CHANGED, {
    equipmentId: equipment.id,
    poolId: equipment.poolId,
    status,
    actor,
  });

  return { ok: true, equipment: updated, history };
}

async function listStockProducts(filters = {}) {
  const where = {};
  if (filters.active !== "all") where.active = true;
  const [products, balances] = await Promise.all([
    repository.listProducts(where),
    repository.listBalances({}),
  ]);

  return products.map((product) => {
    const name = s(product.name).toUpperCase();
    const unit = s(product.unit || "KG") || "KG";
    const central = balances
      .filter((item) => String(item.scope || "").toUpperCase() === "CENTRAL" && String(item.productName || "").toUpperCase() === name && s(item.unit || "KG") === unit)
      .reduce((acc, item) => acc + n(item.quantity, 0), 0);
    const vehicle = balances
      .filter((item) => String(item.scope || "").toUpperCase() === "VEHICLE" && String(item.productName || "").toUpperCase() === name && s(item.unit || "KG") === unit)
      .reduce((acc, item) => acc + n(item.quantity, 0), 0);

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit,
      category: product.category,
      centralStock: central,
      vehicleStock: vehicle,
      minStockCentral: n(product.minStockCentral, 0),
      minStockVehicle: n(product.minStockVehicle, 0),
      qrCode: qrCode("PRD", product.id, product.sku || "NO-SKU"),
      barcode: s(product.sku || qrCode("BAR", product.id, "STOCK")),
    };
  });
}

async function listWarehouseStock() {
  const balances = await repository.listBalances({ scope: "CENTRAL" });
  return { ok: true, stock: balances };
}

async function listVehicleStock(vehicleId) {
  const id = Number(vehicleId);
  if (!id) return { ok: false, status: 400, error: "vehicleId inválido" };
  const balances = await repository.listBalances({ scope: "VEHICLE", vehicleId: id });
  return { ok: true, stock: balances };
}

async function transferStock(payload = {}, actor = "admin") {
  const vehicleId = Number(payload.vehicleId || 0);
  const direction = s(payload.direction || "CENTRAL_TO_VEHICLE") || "CENTRAL_TO_VEHICLE";
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!vehicleId || !items.length) {
    return { ok: false, status: 400, error: "vehicleId e items são obrigatórios" };
  }

  const isOutbound = direction === "CENTRAL_TO_VEHICLE";

  const movements = await repository.prisma.$transaction(async (tx) => {
    const out = [];
    for (const item of items) {
      const productName = s(item.productName || item.name).toUpperCase();
      const unit = s(item.unit || "KG") || "KG";
      const category = s(item.category || "CHEMICAL") || "CHEMICAL";
      const quantity = n(item.quantity, 0);
      if (!productName || quantity <= 0) continue;

      if (isOutbound) {
        await repository.adjustBalance(tx, { scope: "CENTRAL", productName, unit, category, delta: -quantity });
        await repository.adjustBalance(tx, { scope: "VEHICLE", vehicleId, productName, unit, category, delta: quantity });
      } else {
        await repository.adjustBalance(tx, { scope: "VEHICLE", vehicleId, productName, unit, category, delta: -quantity });
        await repository.adjustBalance(tx, { scope: "CENTRAL", productName, unit, category, delta: quantity });
      }

      const movement = await repository.createMovement(tx, {
        movementType: isOutbound ? "TRANSFER_TO_VEHICLE" : "RETURN_TO_WAREHOUSE",
        scopeFrom: isOutbound ? "CENTRAL" : "VEHICLE",
        scopeTo: isOutbound ? "VEHICLE" : "CENTRAL",
        vehicleId,
        productName,
        category,
        unit,
        quantity,
        notes: s(payload.notes || ""),
        createdBy: actor,
      });

      await repository.createAuditTrail(tx, {
        action: "STOCK_TRANSFER",
        entity: "StockMovement",
        entityId: movement.id,
        userId: Number(payload.userId || 0) || null,
        metadata: {
          direction,
          vehicleId,
          productName,
          unit,
          quantity,
        },
      });

      out.push(movement);
    }
    return out;
  });

  await emitEquipmentStockEvent(EVENT_TYPES.STOCK_TRANSFERRED, {
    vehicleId,
    direction,
    movementCount: movements.length,
    actor,
  });

  return { ok: true, movements };
}

async function listStockAlerts() {
  const [products, balances] = await Promise.all([
    repository.listProducts({ active: true }),
    repository.listBalances({}),
  ]);

  const alerts = [];
  for (const product of products) {
    const keyName = s(product.name).toUpperCase();
    const keyUnit = s(product.unit || "KG") || "KG";
    const centralQty = balances
      .filter((item) => String(item.scope || "").toUpperCase() === "CENTRAL" && String(item.productName || "").toUpperCase() === keyName && s(item.unit || "KG") === keyUnit)
      .reduce((acc, item) => acc + n(item.quantity, 0), 0);
    if (centralQty <= n(product.minStockCentral, 0)) {
      alerts.push({
        type: "WAREHOUSE_MIN_STOCK",
        severity: centralQty <= 0 ? "CRITICAL" : "WARNING",
        productId: product.id,
        productName: product.name,
        scope: "CENTRAL",
        quantity: centralQty,
        minimum: n(product.minStockCentral, 0),
        suggestedPurchaseQty: Math.max(0, n(product.minStockCentral, 0) * 2 - centralQty),
      });
    }

    const perVehicle = balances.filter((item) => String(item.scope || "").toUpperCase() === "VEHICLE" && String(item.productName || "").toUpperCase() === keyName && s(item.unit || "KG") === keyUnit);
    for (const row of perVehicle) {
      const minimum = n(product.minStockVehicle, 0);
      if (n(row.quantity, 0) <= minimum) {
        alerts.push({
          type: "VEHICLE_MIN_STOCK",
          severity: n(row.quantity, 0) <= 0 ? "CRITICAL" : "WARNING",
          productId: product.id,
          productName: product.name,
          scope: "VEHICLE",
          vehicleId: row.vehicleId,
          quantity: n(row.quantity, 0),
          minimum,
          suggestedTransferQty: Math.max(0, minimum * 2 - n(row.quantity, 0)),
        });
      }
    }
  }

  return { ok: true, alerts };
}

async function listPurchaseSuggestions() {
  const { alerts } = await listStockAlerts();
  const grouped = new Map();

  for (const item of alerts.filter((alert) => alert.scope === "CENTRAL" || alert.type === "WAREHOUSE_MIN_STOCK")) {
    const key = `${item.productId}`;
    const current = grouped.get(key) || {
      productId: item.productId,
      productName: item.productName,
      severity: item.severity,
      suggestedQty: 0,
      reason: "Reposição automática por stock mínimo",
    };
    current.suggestedQty += n(item.suggestedPurchaseQty, 0);
    if (item.severity === "CRITICAL") current.severity = "CRITICAL";
    grouped.set(key, current);
  }

  const suggestions = [...grouped.values()].filter((item) => item.suggestedQty > 0);

  if (suggestions.length) {
    await emitEquipmentStockEvent(EVENT_TYPES.STOCK_PURCHASE_SUGGESTION, {
      count: suggestions.length,
      source: "equipment-stock-os",
    });
  }

  return { ok: true, suggestions };
}

async function suggestProductsForVisit(visitId) {
  const visit = await ServiceVisitRepository.findById(visitId);
  if (!visit) return { ok: false, status: 404, error: "Visita não encontrada" };

  const pastVisits = await repository.prisma.serviceVisit.findMany({
    where: {
      poolId: visit.poolId,
      status: { in: ["DONE", "CONCLUIDA"] },
      id: { not: Number(visitId) },
    },
    orderBy: { plannedDate: "desc" },
    take: 8,
    include: { chemicals: true },
  });

  const aggregate = new Map();
  for (const item of pastVisits) {
    const chemicals = parseChemicals(item.products, item.chemicals);
    for (const chemical of chemicals) {
      const key = `${s(chemical.name).toUpperCase()}|${s(chemical.unit || "KG")}`;
      const current = aggregate.get(key) || { name: chemical.name, unit: chemical.unit || "KG", quantity: 0, occurrences: 0 };
      current.quantity += n(chemical.quantity, 0);
      current.occurrences += 1;
      aggregate.set(key, current);
    }
  }

  const suggestedProducts = [...aggregate.values()]
    .map((item) => ({
      name: item.name,
      unit: item.unit,
      averageQuantity: item.occurrences ? Number((item.quantity / item.occurrences).toFixed(2)) : 0,
      occurrences: item.occurrences,
    }))
    .filter((item) => item.averageQuantity > 0)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  return { ok: true, visitId: Number(visitId), suggestedProducts };
}

async function consumeProductsForVisit(visitId, payload = {}, actor = "TECHNICIAN_FIELD") {
  const visit = await repository.prisma.serviceVisit.findUnique({
    where: { id: Number(visitId) },
    include: {
      technician: true,
      pool: { include: { client: true } },
    },
  });
  if (!visit) return { ok: false, status: 404, error: "Visita não encontrada" };

  const vehicleId = Number(payload.vehicleId || visit.technician?.vehicleId || 0);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!vehicleId || !items.length) {
    return { ok: false, status: 400, error: "vehicleId e items são obrigatórios" };
  }

  const consumed = await repository.prisma.$transaction(async (tx) => {
    const out = [];
    for (const item of items) {
      const productName = s(item.productName || item.name).toUpperCase();
      const unit = s(item.unit || "KG") || "KG";
      const category = s(item.category || "CHEMICAL") || "CHEMICAL";
      const quantity = n(item.quantity, 0);
      if (!productName || quantity <= 0) continue;

      await repository.adjustBalance(tx, {
        scope: "VEHICLE",
        vehicleId,
        productName,
        unit,
        category,
        delta: -quantity,
      });

      const movement = await repository.createMovement(tx, {
        movementType: "CONSUMPTION",
        scopeFrom: "VEHICLE",
        vehicleId,
        productName,
        category,
        unit,
        quantity,
        visitId: visit.id,
        clientId: visit.clientId,
        poolId: visit.poolId,
        technicianId: visit.technicianId,
        notes: s(payload.notes || "Consumo registado via Equipment & Stock OS"),
        createdBy: actor,
      });

      await repository.createAuditTrail(tx, {
        action: "VISIT_STOCK_CONSUMPTION",
        entity: "ServiceVisit",
        entityId: visit.id,
        userId: Number(payload.userId || visit.technicianId || 0) || null,
        metadata: {
          visitId: visit.id,
          vehicleId,
          productName,
          unit,
          quantity,
        },
      });

      out.push(movement);
    }

    const productsSummary = out.map((item) => `${item.productName} ${item.quantity} ${item.unit}`).join(", ");
    if (productsSummary) {
      await tx.technicalHistory.create({
        data: {
          poolId: visit.poolId,
          type: "EQUIPMENT_STOCK_CONSUMPTION",
          component: "STOCK",
          message: "Consumo em visita",
          description: `Visita #${visit.id}: ${productsSummary}`,
          status: "DONE",
          performedAt: new Date(),
        },
      }).catch(() => null);
    }

    return out;
  });

  const vehicleBalance = await repository.listBalances({ scope: "VEHICLE", vehicleId });
  const lowStockRows = vehicleBalance.filter((row) => n(row.quantity, 0) <= 0);

  if (lowStockRows.length) {
    await repository.prisma.notification.create({
      data: {
        clientId: visit.clientId || null,
        type: "STOCK_CRITICAL",
        eventType: "VISIT_STOCK_LOW",
        title: "Stock crítico após consumo",
        message: `Viatura ${vehicleId} sem stock para ${lowStockRows.map((row) => row.productName).join(", ")}`,
        role: "ADMIN",
        severity: "CRITICAL",
        metadata: {
          visitId: visit.id,
          vehicleId,
          products: lowStockRows.map((row) => row.productName),
        },
      },
    }).catch(() => null);

    await emitEquipmentStockEvent(EVENT_TYPES.STOCK_MIN_ALERT, {
      visitId: visit.id,
      vehicleId,
      products: lowStockRows.map((row) => row.productName),
    });
  }

  await emitEquipmentStockEvent(EVENT_TYPES.STOCK_CONSUMED, {
    visitId: visit.id,
    vehicleId,
    movementCount: consumed.length,
    actor,
  });

  return {
    ok: true,
    visitId: visit.id,
    vehicleId,
    consumed,
  };
}

async function buildOperationalDashboard() {
  const [equipment, balances, movements, alertsData] = await Promise.all([
    listEquipmentInventory({}),
    repository.listBalances({}),
    repository.listMovements({}, 30),
    listStockAlerts(),
  ]);

  const central = balances.filter((item) => String(item.scope || "").toUpperCase() === "CENTRAL");
  const vehicle = balances.filter((item) => String(item.scope || "").toUpperCase() === "VEHICLE");

  return {
    ok: true,
    dashboard: {
      equipmentTotal: equipment.length,
      equipmentInRepair: equipment.filter((item) => item.status === "REPAIR").length,
      equipmentInAlert: equipment.filter((item) => item.status === "ALERT").length,
      stockRowsCentral: central.length,
      stockRowsVehicle: vehicle.length,
      stockAlerts: alertsData.alerts.length,
      lastMovements: movements,
    },
  };
}

async function buildCustomerStockReport(clientId) {
  const id = Number(clientId);
  if (!id) return { ok: false, status: 400, error: "clientId inválido" };

  const visits = await repository.prisma.serviceVisit.findMany({
    where: { clientId: id },
    orderBy: { plannedDate: "desc" },
    take: 50,
    include: { pool: true },
  });

  const visitIds = visits.map((visit) => visit.id);
  const movements = visitIds.length
    ? await repository.listMovements({ visitId: { in: visitIds }, movementType: "CONSUMPTION" }, 400)
    : [];

  const productsUsed = new Map();
  for (const movement of movements) {
    const key = `${movement.productName}|${movement.unit}`;
    const current = productsUsed.get(key) || { productName: movement.productName, unit: movement.unit, quantity: 0 };
    current.quantity += n(movement.quantity, 0);
    productsUsed.set(key, current);
  }

  return {
    ok: true,
    report: {
      clientId: id,
      visits: visits.length,
      productsUsed: [...productsUsed.values()].sort((a, b) => b.quantity - a.quantity),
      lastMovements: movements.slice(0, 20),
    },
  };
}

module.exports = {
  listEquipmentInventory,
  getEquipmentLifecycle,
  createEquipmentMaintenance,
  registerEquipmentWarranty,
  updateEquipmentStatus,
  listStockProducts,
  listWarehouseStock,
  listVehicleStock,
  transferStock,
  listStockAlerts,
  listPurchaseSuggestions,
  suggestProductsForVisit,
  consumeProductsForVisit,
  buildOperationalDashboard,
  buildCustomerStockReport,
};
