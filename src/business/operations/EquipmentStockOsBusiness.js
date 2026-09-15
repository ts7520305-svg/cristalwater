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

function normalizeStockItems(rawItems){
  if(!Array.isArray(rawItems)||!rawItems.length||rawItems.length>100||rawItems.some(item=>!item||typeof item!=='object'||Array.isArray(item)||typeof (item.productName||item.name)!=='string'||!['number','string'].includes(typeof item.quantity)||(item.unit!==undefined&&typeof item.unit!=='string')))return null;
  const items=rawItems.map(item=>({productName:s(item.productName||item.name).replace(/\s+/g,' ').toUpperCase(),unit:s(item.unit||'KG').toUpperCase(),category:s(item.category||'CHEMICAL'),quantity:Number(item.quantity)}));
  if(items.some(item=>!item.productName||item.productName.length>160||!item.unit||item.unit.length>24||!Number.isFinite(item.quantity)||item.quantity<=0))return null;
  return items.sort((a,b)=>a.productName.localeCompare(b.productName)||a.unit.localeCompare(b.unit));
}
async function transferStock(payload = {}, actor = "admin", user) {
  const vehicleId = Number(payload.vehicleId || 0);
  const direction = s(payload.direction || "CENTRAL_TO_VEHICLE") || "CENTRAL_TO_VEHICLE";
  const items=normalizeStockItems(payload.items);
  if(!Number.isSafeInteger(vehicleId)||vehicleId<=0||!items||!['CENTRAL_TO_VEHICLE','VEHICLE_TO_CENTRAL'].includes(direction))return {ok:false,status:400,error:'Indique viatura, sentido válido e entre 1 e 100 produtos com quantidade positiva'};
  const requestId=payload.requestId;
  if(requestId!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(requestId)))return {ok:false,status:400,error:'Identificador do pedido inválido'};
  const shortageId=payload.shortageId===undefined?null:Number(payload.shortageId);
  if(shortageId!==null&&(!Number.isSafeInteger(shortageId)||shortageId<=0||!requestId||direction!=='CENTRAL_TO_VEHICLE'||items.length!==1))return {ok:false,status:400,error:'Reposição associada requer necessidade, identificador e um produto para a viatura'};
  if(shortageId!==null&&!require('../../utils/roles').roleMatches(user?.role,'ADMIN'))return {ok:false,status:403,error:'A gestão deve registar a carga associada à necessidade'};
  const returnOfMovementId=payload.returnOfMovementId===undefined?null:Number(payload.returnOfMovementId);
  if(returnOfMovementId!==null&&(!Number.isSafeInteger(returnOfMovementId)||returnOfMovementId<=0||!requestId||direction!=='VEHICLE_TO_CENTRAL'||items.length!==1||shortageId!==null))return {ok:false,status:400,error:'Devolução associada requer movimento original, identificador e um produto'};
  if(returnOfMovementId!==null&&!require('../../utils/roles').roleMatches(user?.role,'ADMIN'))return {ok:false,status:403,error:'A gestão deve confirmar a devolução ao armazém'};
  const fingerprint=JSON.stringify({vehicleId,direction,items,actor,...(shortageId!==null?{shortageId}:{}),...(returnOfMovementId!==null?{returnOfMovementId}:{})});

  const isOutbound = direction === "CENTRAL_TO_VEHICLE";

  const result = await repository.prisma.$transaction(async (tx) => {
    const key=`stock-transfer:${requestId}`;
    if(requestId){
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
      const replay=await tx.operationalReminder.findUnique({where:{sourceKey:key}});
      if(replay){if(replay.metadata.fingerprint!==fingerprint)return {ok:false,status:409,error:'Este pedido já foi utilizado com outros dados'};return {ok:true,movements:replay.metadata.movements,idempotent:true};}
    }
    let shortage,returnedLoad;
    if(returnOfMovementId!==null){
      await tx.$queryRaw`SELECT id FROM "StockMovement" WHERE id=${returnOfMovementId} FOR UPDATE`;
      returnedLoad=(await require('../../services/stockPreparationService').forVehicle(tx,vehicleId)).find(m=>m.id===returnOfMovementId);
      if(!returnedLoad||returnedLoad.productName!==items[0].productName||returnedLoad.unit!==items[0].unit||items[0].quantity>returnedLoad.quantity)return {ok:false,status:409,error:'Movimento incompatível ou quantidade superior à carga ainda não devolvida'};
      const reminder=await tx.operationalReminder.findUnique({where:{id:returnedLoad.shortageId}});
      const current=(await require('../technician/IncompleteVisitBusiness').shortages(user,tx)).rows.find(r=>r.shortageId===returnedLoad.shortageId);
      for(const id of [...new Set([reminder?.metadata?.visitId,current?.visitId].filter(Number.isSafeInteger))].sort((a,b)=>a-b))await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
    }
    if(shortageId!==null){
      const findNeed=async()=> (await require('../technician/IncompleteVisitBusiness').shortages(user,tx)).rows.find(row=>row.shortageId===shortageId);
      const initial=await findNeed();
      if(!initial?.technicianId)return {ok:false,status:409,error:'Necessidade encerrada, substituída ou sem técnico'};
      for(const id of [...new Set([initial.reportedVisitId,initial.visitId])].sort((a,b)=>a-b))await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Technician" WHERE id=${initial.technicianId} FOR UPDATE`;
      shortage=await findNeed();
      if(!shortage||shortage.visitId!==initial.visitId||shortage.technicianId!==initial.technicianId||shortage.vehicleId!==vehicleId)return {ok:false,status:409,error:'A atribuição ou viatura mudou. Atualize as necessidades antes de carregar'};
      const technician=await tx.technician.findUnique({where:{id:shortage.technicianId}});
      if(!technician?.active)return {ok:false,status:409,error:'Técnico indisponível'};
      const normalize=value=>String(value||'').trim().replace(/\s+/g,' ').toUpperCase();
      if(normalize(shortage.productName)!==items[0].productName||normalize(shortage.unit)!==items[0].unit)return {ok:false,status:409,error:'Produto ou unidade não corresponde à necessidade'};
      if(shortage.quantity!==null&&items[0].quantity>shortage.quantity-shortage.committedQuantity)return {ok:false,status:409,error:'Quantidade superior à necessidade ainda por carregar. Reveja as cargas já registadas'};
    }
    const vehicle=await tx.vehicle.findUnique({where:{id:vehicleId}});
    if(!vehicle||(!returnedLoad&&(!vehicle.active||vehicle.deletedAt||vehicle.archiveStatus!=='ATIVO')))return {ok:false,status:400,error:'Viatura inexistente ou indisponível'};
    if(user&&!require('../../utils/roles').roleMatches(user.role,'ADMIN')){
      const technician=await tx.technician.findUnique({where:{id:Number(user.technicianId||user.id)}});
      if(!technician?.active||technician.vehicleId!==vehicleId)return {ok:false,status:403,error:'Só pode movimentar stock da sua viatura atribuída'};
    }
    const out = [];
    for (const item of items) {
      const productName = s(item.productName || item.name).toUpperCase();
      const unit = s(item.unit || "KG") || "KG";
      const category = s(item.category || "CHEMICAL") || "CHEMICAL";
      const quantity = n(item.quantity, 0);
      if (!productName || quantity <= 0) continue;

      // Always lock central before vehicle, in a stable product order, including returns.
      await repository.adjustBalance(tx,{scope:'CENTRAL',productName,unit,category,delta:isOutbound?-quantity:quantity});
      await repository.adjustBalance(tx,{scope:'VEHICLE',vehicleId,productName,unit,category,delta:isOutbound?quantity:-quantity});

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
    if(requestId)await tx.operationalReminder.create({data:{sourceKey:key,title:'Transferência de stock registada',dueDate:new Date(),isCompleted:true,metadata:{fingerprint,...(shortage?{shortageId,technicianId:shortage.technicianId,vehicleId}:{}),...(returnedLoad?{shortageId:returnedLoad.shortageId,technicianId:returnedLoad.technicianId,vehicleId,returnOfMovementId,returnQuantity:items[0].quantity}:{}),movements:JSON.parse(JSON.stringify(out))}}});
    return {ok:true,movements:out};
  });
  if(!result.ok||result.idempotent)return result;
  const movements=result.movements;

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

async function consumeProductsForVisit(visitId, payload = {}, actor = "TECHNICIAN_FIELD", user) {
  if(!Number.isSafeInteger(Number(visitId))||Number(visitId)<=0)return {ok:false,status:400,error:'Visita inválida'};
  let visit = await repository.prisma.serviceVisit.findUnique({
    where: { id: Number(visitId) },
    include: {
      technician: true,
      pool: { include: { client: true } },
    },
  });
  if (!visit) return { ok: false, status: 404, error: "Visita não encontrada" };

  const vehicleId = Number(payload.vehicleId || visit.technician?.vehicleId || 0);
  const items = normalizeStockItems(payload.items);
  if (!Number.isSafeInteger(vehicleId)||vehicleId<=0||!items) {
    return { ok: false, status: 400, error: "vehicleId e items são obrigatórios" };
  }

  const requestId=payload.requestId;
  if(requestId!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(requestId)))return {ok:false,status:400,error:'Identificador do consumo inválido'};
  const fingerprint=JSON.stringify({visitId:Number(visitId),vehicleId,items,actor});
  const result = await repository.prisma.$transaction(async (tx) => {
    const sourceKey=`stock-consumption:${requestId}`;
    if(requestId){
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
      const previous=await tx.operationalReminder.findUnique({where:{sourceKey}});
      if(previous){if(previous.metadata.fingerprint!==fingerprint)return {ok:false,status:409,error:'Identificador já utilizado com outros dados'};return {...previous.metadata.result,idempotent:true};}
    }
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${Number(visitId)} FOR UPDATE`;
    visit=await tx.serviceVisit.findUnique({where:{id:Number(visitId)},include:{technician:true,pool:{include:{client:true}}}});
    if(!visit)return {ok:false,status:404,error:'Visita não encontrada'};
    if(user){
      const admin=require('../../utils/roles').roleMatches(user.role,'ADMIN');
      if(!admin&&visit.technicianId!==Number(user.technicianId||user.id))return {ok:false,status:403,error:'Esta visita não está atribuída a si'};
      if(!admin){
        await tx.$queryRaw`SELECT id FROM "Technician" WHERE id=${visit.technicianId} FOR UPDATE`;
        const technician=await tx.technician.findUnique({where:{id:visit.technicianId}});
        if(!technician?.active||technician.vehicleId!==vehicleId)return {ok:false,status:403,error:'Só pode registar consumo da sua viatura atribuída'};
      }
      const vehicle=await tx.vehicle.findUnique({where:{id:vehicleId}});
      if(!vehicle?.active||vehicle.deletedAt||vehicle.archiveStatus!=='ATIVO')return {ok:false,status:409,error:'Viatura indisponível'};
    }
    if(visit.endAt||['DONE','COMPLETED','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(visit.status))return {ok:false,status:409,error:'A visita está encerrada. Utilize o procedimento de correção do registo'};

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

    const result={ok:true,visitId:visit.id,vehicleId,consumed:out};
    if(requestId)await tx.operationalReminder.create({data:{sourceKey,title:'Consumo de stock registado',dueDate:new Date(),isCompleted:true,metadata:{fingerprint,result:JSON.parse(JSON.stringify(result))}}});
    return result;
  });
  if(!result.ok||result.idempotent)return result;
  const consumed=result.consumed;

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
