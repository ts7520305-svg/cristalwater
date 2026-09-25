const { writePdfResponse, line, section, paragraph, tableRows } = require("../services/guidePdfService");

const { prisma } = require("../prismaClient");
const { toPublicUploadUrl } = require("../config/uploadPath");

const COMPANY_NAME = "Cristal Water LDA";

function n(v, fallback = null) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}
function arr(v) { return Array.isArray(v) ? v : []; }
function dateOrNull(v) { return v ? new Date(v) : null; }
async function audit(req, action, entity, entityId, metadata = {}) {
  try {
    await prisma.userAuditLog.create({
      data: {
        action,
        entity,
        entityId: entityId == null ? null : String(entityId),
        actor: req.headers["x-user-email"] || req.headers["x-actor"] || "SYSTEM",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        metadata
      }
    });
  } catch (_) {}
}

function transportGuideDocumentKey(guideId) {
  return `transport_guide_at_document_${guideId}`;
}

function parseOfficialDocument(row) {
  if (!row) return null;
  try {
    const document = JSON.parse(row.value);
    if (!document || typeof document.url !== 'string' || !document.url.trim()) throw Error('Invalid document');
    return document;
  } catch (_) {
    throw Error('O registo do documento oficial está ilegível. Confirme-o no escritório.');
  }
}

async function getTransportGuideOfficialDocument(guideId) {
  const row = await prisma.systemSetting.findUnique({
    where: { key: transportGuideDocumentKey(guideId) }
  });
  return parseOfficialDocument(row);
}

async function attachTransportGuideDocuments(guides) {
  const rows = arr(guides).filter(Boolean);
  if (!rows.length) return rows;
  const keys = rows.map((guide) => transportGuideDocumentKey(guide.id));
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } }
  });
  const byKey = new Map(settings.map((setting) => [setting.key, parseOfficialDocument(setting)]));
  return rows.map((guide) => ({
    ...guide,
    officialDocument: byKey.get(transportGuideDocumentKey(guide.id)) || null
  }));
}

// ==========================================================
// VEHICLES / FROTA
// ==========================================================
async function listVehicles(req, res) {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(req.query.active === "all" ? {} : { active: true, archiveStatus: "ATIVO", deletedAt: null }),
        ...(req.fieldVehicleId ? {id:req.fieldVehicleId} : {}),
      },
      orderBy: [{ active: "desc" }, { plate: "asc" }],
      include: {
        workGuides: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { items: true }
        },
        transportGuides: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { items: true }
        }
      }
    });

    const vehicleIds = vehicles.map(v => v.id);

    const technicians = await prisma.technician.findMany({
      where: { vehicleId: { in: vehicleIds } },
      select: { id: true, name: true, email: true, active: true, vehicleId: true }
    });

    const vehiclesWithTechnicians = vehicles.map(v => ({
      ...v,
      assignedTechnicians: technicians.filter(t => t.vehicleId === v.id)
    }));

    res.json({ ok: true, vehicles: vehiclesWithTechnicians });
  } catch (err) {
    console.error("listVehicles error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function createVehicle(req,res) { return require('./fleetManagementController').legacy(req,res); }

async function updateVehicle(req,res) { return require('./fleetManagementController').legacy(req,res); }

async function assignTechnicianVehicle(req, res) {
  try {
    const { technicianId, vehicleId, startKm, notes } = req.body;
    const techId = n(technicianId); const vehId = n(vehicleId);
    if (!techId || !vehId) return res.status(400).json({ ok: false, error: "technicianId e vehicleId obrigatórios" });
    await prisma.technician.update({ where: { id: techId }, data: { vehicleId: vehId } }).catch(()=>null);
    const log = await prisma.technicianVehicleLog.create({ data: { technicianId: techId, vehicleId: vehId } });
    if (startKm != null) await prisma.vehicle.update({ where: { id: vehId }, data: { currentKm: n(startKm) } }).catch(()=>null);
    await audit(req, "VEHICLE_ASSIGN_TECHNICIAN", "TechnicianVehicleLog", log.id, { technicianId: techId, vehicleId: vehId, notes });
    res.json({ ok: true, log });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}


async function deleteVehicle(req,res) { return require('./fleetManagementController').legacy(req,res); }

async function restoreVehicle(req,res) { return require('./fleetManagementController').legacy(req,res); }

async function getVehiclePreset(vehicleId) {
  const row = await prisma.systemSetting.findUnique({ where: { key: `vehicle_preset_${vehicleId}` } }).catch(() => null);
  if (!row?.value) return [];
  try { const parsed = JSON.parse(row.value); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; }
}
async function setVehiclePreset(vehicleId, items) {
  const value = JSON.stringify(arr(items).map(i => ({ name: String(i.name || i.productName || 'Item'), type: i.type || i.category || 'MATERIAL', unit: i.unit || 'UN', quantity: n(i.quantity, 0) || 0 })));
  return prisma.systemSetting.upsert({
    where: { key: `vehicle_preset_${vehicleId}` },
    update: { value, notes: 'Preset de stock base da viatura para novas guias AT.' },
    create: { key: `vehicle_preset_${vehicleId}`, value, notes: 'Preset de stock base da viatura para novas guias AT.' }
  });
}
async function latestTransportGuide(vehicleId, excludeId = null) {
  const where = { vehicleId: n(vehicleId) };
  if (excludeId) where.id = { not: n(excludeId) };
  return prisma.transportGuide.findFirst({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: { items: true, vehicle: true }
  });
}
async function latestActiveTransportGuide(vehicleId) {
  const active = await prisma.transportGuide.findFirst({
    where: { vehicleId: n(vehicleId), status: "ACTIVE" },
    orderBy: [{ createdAt: "desc" }],
    include: { items: true, vehicle: true }
  });
  return active || latestTransportGuide(vehicleId);
}
async function strictActiveTransportGuide(vehicleId) {
  return prisma.transportGuide.findFirst({
    where: { vehicleId: n(vehicleId), status: "ACTIVE" },
    orderBy: [{ createdAt: "desc" }],
    include: { items: true, vehicle: true }
  });
}
function normalizeGuideItems(items) {
  return arr(items).filter(i => i && (i.name || i.productName)).map(i => ({
    name: String(i.name || i.productName || 'Item'),
    type: i.type || i.category || 'MATERIAL',
    unit: i.unit || 'UN',
    quantity: n(i.quantity, 0) || 0
  }));
}
function text(v, fallback = "-") {
  const s = String(v ?? "").trim();
  return s || fallback;
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" });
}
function normalize(v) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function isChemicalItem(item) {
  const raw = normalize(`${item?.type || ""} ${item?.name || item?.itemName || ""}`);
  return /chemical|quim|cloro|ph|sal|bromo|alcal|floc|algic|estabil|redutor|aumentador/.test(raw);
}
function isInsuranceRecord(record) {
  const raw = normalize(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`);
  return /insurance|seguro|apolice|apol/.test(raw);
}
function totalByUnit(items, field = "quantity", filter = () => true) {
  const totals = new Map();
  for (const item of arr(items).filter(filter)) {
    const unit = text(item.unit, "UN").toUpperCase();
    totals.set(unit, (totals.get(unit) || 0) + (n(item[field], 0) || 0));
  }
  return Array.from(totals.entries()).map(([unit, quantity]) => `${quantity} ${unit}`).join(", ") || "-";
}
function pdfName(prefix, id) {
  return `${prefix}-${String(id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "")}.pdf`;
}
function itemKey(item) {
  return `${normalize(item?.name || item?.productName || item?.itemName)}|${normalize(item?.unit || "UN")}`;
}
function combineNotes(current, addition) {
  const parts = [current, addition].map((part) => String(part || "").trim()).filter(Boolean);
  return parts.length ? Array.from(new Set(parts)).join(" | ") : null;
}
async function syncWorkGuideItemsWithTransportGuide(workGuideId, guideItems) {
  const existing = await prisma.workGuideItem.findMany({ where: { workGuideId: n(workGuideId) } });
  const existingByKey = new Map(existing.map((item) => [itemKey(item), item]));
  const seen = new Set();

  for (const source of arr(guideItems)) {
    const key = itemKey(source);
    seen.add(key);
    const target = existingByKey.get(key);
    const initialQty = n(source.quantity, 0) || 0;
    if (target) {
      await prisma.$executeRaw`UPDATE "WorkGuideItem"
        SET "name" = ${source.name}, "type" = ${source.type}, "unit" = ${source.unit || 'UN'},
            "initialQty" = ${initialQty}, "quantity" = GREATEST(0, ${initialQty} - "usedQty")
        WHERE "id" = ${target.id}`;
    } else {
      await prisma.workGuideItem.create({
        data: {
          workGuideId: n(workGuideId),
          name: source.name,
          type: source.type,
          unit: source.unit || "UN",
          initialQty,
          quantity: initialQty,
          usedQty: 0
        }
      }).catch(() => null);
    }
  }

  for (const item of existing) {
    if (!seen.has(itemKey(item)) && (n(item.usedQty, 0) || 0) <= 0) {
      await prisma.workGuideItem.delete({ where: { id: item.id } }).catch(() => null);
    }
  }
}
async function notifyMissingTransportGuide({ req, vehicleId, technicianId, workGuideId, reason }) {
  const vehId = n(vehicleId);
  const guideId = n(workGuideId);
  const vehicle = vehId ? await prisma.vehicle.findUnique({ where: { id: vehId } }).catch(() => null) : null;
  const plate = vehicle?.plate || `Viatura ${vehId || ""}`.trim();
  const title = "Guia de transporte AT em falta";
  const message = `${plate} iniciou uma guia de obra provisoria sem guia AT ativa. Associar a guia de transporte assim que a AT permitir.`;
  const metadata = { vehicleId: vehId, technicianId: n(technicianId), workGuideId: guideId, reason: reason || "AT_UNAVAILABLE" };

  const lock = guideId ? await prisma.operationalLock.findFirst({
    where: {
      lockType: "MISSING_TRANSPORT_GUIDE",
      entity: "WorkGuide",
      entityId: guideId,
      status: "PENDING"
    }
  }).catch(() => null) : null;

  if (!lock && guideId) {
    await prisma.operationalLock.create({
      data: {
        lockType: "MISSING_TRANSPORT_GUIDE",
        severity: "WARNING",
        status: "PENDING",
        entity: "WorkGuide",
        entityId: guideId,
        technicianId: n(technicianId),
        vehicleId: vehId,
        title,
        message,
        payload: metadata,
        requestedBy: req?.headers?.["x-user-email"] || req?.headers?.["x-actor"] || "SYSTEM"
      }
    }).catch(() => null);
  }

  const notification = await prisma.notification.create({
    data: {
      type: "WARNING",
      eventType: "TRANSPORT_GUIDE_MISSING",
      title,
      message,
      role: "ADMIN",
      severity: "WARNING",
      metadata
    }
  }).catch(() => null);

  if (global.io && notification) {
    global.io.emit("new-notification", {
      id: notification.id,
      type: notification.type,
      eventType: notification.eventType,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt
    });
  }
}
async function resolveMissingTransportGuide({ req, vehicleId, workGuideId, transportGuideId, codeAT }) {
  const guideId = n(workGuideId);
  if (!guideId) return;

  await prisma.operationalLock.updateMany({
    where: {
      lockType: "MISSING_TRANSPORT_GUIDE",
      entity: "WorkGuide",
      entityId: guideId,
      status: "PENDING"
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      approvedBy: req?.headers?.["x-user-email"] || req?.headers?.["x-actor"] || "SYSTEM"
    }
  }).catch(() => null);

  const vehicle = vehicleId ? await prisma.vehicle.findUnique({ where: { id: n(vehicleId) } }).catch(() => null) : null;
  await prisma.notification.create({
    data: {
      type: "INFO",
      eventType: "TRANSPORT_GUIDE_ASSOCIATED",
      title: "Guia AT associada",
      message: `Guia de obra #${guideId} associada a guia AT ${codeAT || transportGuideId || ""} ${vehicle?.plate ? `(${vehicle.plate})` : ""}.`.trim(),
      role: "ADMIN",
      severity: "INFO",
      metadata: { vehicleId: n(vehicleId), workGuideId: guideId, transportGuideId: n(transportGuideId), codeAT: codeAT || null }
    }
  }).catch(() => null);
}
function movementMetadataFromNotes(notes) {
  const raw = String(notes || "").trim();
  if (!raw) return { userNotes: "", location: "", readings: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.cwGuideMovement === true) return parsed;
  } catch (_) {}
  return { userNotes: raw, location: "", readings: null };
}
function movementNotesPayload(body, visit, notes) {
  const pool = visit?.pool || null;
  const client = visit?.client || pool?.client || null;
  const location = text(body.location || body.local || body.address || pool?.address || pool?.location || pool?.zone || client?.address || "");
  const poolName = text(body.poolName || pool?.name || "");
  const clientName = text(body.clientName || client?.name || "");
  const readings = {
    ph: n(body.ph),
    chlorine: n(body.chlorine),
    alkalinity: n(body.alkalinity),
    orp: n(body.orp ?? body.orpMv),
    salt: n(body.salt),
    temperature: n(body.temperature)
  };
  Object.keys(readings).forEach((key) => readings[key] == null && delete readings[key]);
  return JSON.stringify({
    cwGuideMovement: true,
    userNotes: notes || body.message || "",
    location: location === "-" ? "" : location,
    poolId: n(body.poolId) || visit?.poolId || pool?.id || null,
    poolName: poolName === "-" ? "" : poolName,
    clientId: n(body.clientId) || visit?.clientId || client?.id || null,
    clientName: clientName === "-" ? "" : clientName,
    latitude: n(body.latitude ?? body.lat ?? pool?.latitude),
    longitude: n(body.longitude ?? body.lng ?? pool?.longitude),
    readings: Object.keys(readings).length ? readings : null
  });
}
async function enrichMovementsWithVisitContext(movements) {
  const rows = arr(movements);
  const visitIds = Array.from(new Set(rows.map((movement) => n(movement.visitId)).filter(Boolean)));
  const visits = visitIds.length
    ? await prisma.serviceVisit.findMany({
        where: { id: { in: visitIds } },
        include: { pool: { include: { client: true } }, client: true, technician: true }
      })
    : [];
  const byVisit = new Map(visits.map((visit) => [visit.id, visit]));

  return rows.map((movement) => {
    const meta = movementMetadataFromNotes(movement.notes);
    const visit = byVisit.get(n(movement.visitId));
    const pool = visit?.pool || null;
    const client = visit?.client || pool?.client || null;
    const poolName = meta.poolName || pool?.name || "";
    const clientName = meta.clientName || client?.name || "";
    const location = meta.location || pool?.address || pool?.location || pool?.zone || client?.address || "";
    const label = [poolName, clientName, location].filter(Boolean).join(" - ") || (movement.visitId ? `Visita ${movement.visitId}` : "Movimento manual");
    return {
      ...movement,
      guideMeta: meta,
      locationLabel: label,
      poolName,
      clientName,
      location,
      readings: meta.readings || null,
      userNotes: meta.userNotes || ""
    };
  });
}
function groupMovementTotals(movements, keyFn) {
  const totals = new Map();
  for (const movement of arr(movements)) {
    const key = keyFn(movement) || "-";
    const unit = text(movement.unit, "UN").toUpperCase();
    const mapKey = `${key}|${movement.itemName}|${unit}`;
    const current = totals.get(mapKey) || { key, itemName: movement.itemName, unit, quantity: 0 };
    current.quantity += n(movement.quantity, 0) || 0;
    totals.set(mapKey, current);
  }
  return Array.from(totals.values());
}
async function findVehicleInsurance(vehicleId) {
  const records = await prisma.vehicleMaintenanceRecord.findMany({
    where: { vehicleId: n(vehicleId) },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    take: 60
  }).catch(() => []);
  return records.find(isInsuranceRecord) || null;
}
async function vehicleInsurancePayload(vehicleId) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: n(vehicleId) } });
  const records = vehicle ? await prisma.vehicleMaintenanceRecord.findMany({where:{vehicleId:vehicle.id},orderBy:[{dueDate:'desc'},{createdAt:'desc'}]}) : [];
  const insurance = records.find(isInsuranceRecord) || null;
  const inspection = records.find(record => /INSPE|IPO/i.test(`${record.type} ${record.title}`)) || null;
  return { vehicle: vehicle ? {...vehicle, inspection, inspectionDueDate:inspection?.dueDate || null, inspectionStatus:inspection?.status || null} : null, insurance };
}

// ==========================================================
// TRANSPORT GUIDE / GUIA AT
// ==========================================================
async function listTransportGuides(req, res) {
  try {
    const where = {};
    if (req.query.vehicleId) where.vehicleId = n(req.query.vehicleId);
    if (req.query.status) where.status = req.query.status;
    const guides = await prisma.transportGuide.findMany({ where, orderBy: { createdAt: "desc" }, include: { vehicle: true, items: true, workGuides: true } });
    res.json({ ok: true, guides: await attachTransportGuideDocuments(guides) });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

const createTransportGuide = require('./transportGuideCreationController').legacy;

async function updateTransportGuide(req, res) {
  try {
    const id = n(req.params.id);
    const { status, codeAT, validFrom, validUntil, origin, destination, notes, isDraft } = req.body;
    const guide = await prisma.transportGuide.update({
      where: { id },
      data: { status, codeAT, validFrom: dateOrNull(validFrom) || undefined, validUntil: dateOrNull(validUntil), origin, destination, notes, isDraft: isDraft === undefined ? undefined : Boolean(isDraft), closedAt: status === "CLOSED" ? new Date() : undefined },
      include: { vehicle: true, items: true, workGuides: true }
    });
    const linkedWorkGuide = await prisma.workGuide.findFirst({
      where: { guideId: id },
      orderBy: { createdAt: "desc" }
    }).catch(() => null);
    if (linkedWorkGuide && (codeAT || status === "ACTIVE")) {
      await resolveMissingTransportGuide({
        req,
        vehicleId: guide.vehicleId,
        workGuideId: linkedWorkGuide.id,
        transportGuideId: guide.id,
        codeAT: guide.codeAT
      });
    }
    await audit(req, "TRANSPORT_GUIDE_UPDATE", "TransportGuide", id, req.body);
    res.json({ ok: true, guide });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}


async function getLatestTransportGuide(req, res) {
  try {
    const vehicleId = n(req.params.vehicleId || req.query.vehicleId);
    if (!vehicleId) return res.status(400).json({ ok: false, error: 'vehicleId obrigatório.' });
    const guide = await strictActiveTransportGuide(vehicleId);
    const [guideWithDocument] = guide ? await attachTransportGuideDocuments([guide]) : [null];
    res.json({
      ok: true,
      guide: guideWithDocument,
      items: guideWithDocument?.items || [],
      officialDocument: guideWithDocument?.officialDocument || null
    });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function uploadTransportGuideDocument(req, res) {
  try {
    const id = n(req.params.id);
    const guide = await prisma.transportGuide.findUnique({ where: { id }, include: { vehicle: true } });
    if (!guide) return res.status(404).json({ ok: false, error: "Guia AT nao encontrada." });
    if (!req.file) return res.status(400).json({ ok: false, error: "Ficheiro da AT obrigatorio." });

    const document = {
      guideId: id,
      codeAT: guide.codeAT || null,
      vehicleId: guide.vehicleId || null,
      vehiclePlate: guide.vehicle?.plate || null,
      url: toPublicUploadUrl("guides", req.file.filename),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.headers["x-user-email"] || req.headers["x-actor"] || "SYSTEM"
    };

    await prisma.systemSetting.upsert({
      where: { key: transportGuideDocumentKey(id) },
      update: {
        value: JSON.stringify(document),
        notes: "Ficheiro oficial da guia de transporte AT anexado pelo administrador."
      },
      create: {
        key: transportGuideDocumentKey(id),
        value: JSON.stringify(document),
        notes: "Ficheiro oficial da guia de transporte AT anexado pelo administrador."
      }
    });

    await audit(req, "TRANSPORT_GUIDE_AT_DOCUMENT_UPLOAD", "TransportGuide", id, {
      codeAT: guide.codeAT,
      vehicleId: guide.vehicleId,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });

    res.json({ ok: true, document, message: "Ficheiro oficial da AT anexado a guia." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getTransportGuideDocument(req, res) {
  try {
    const id = n(req.params.id);
    const document = await getTransportGuideOfficialDocument(id);
    res.json({ ok: true, document });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function downloadTransportGuidePdf(req, res) {
  try {
    const id = n(req.params.id);
    const guide = await prisma.transportGuide.findUnique({ where: { id }, include: { vehicle: true, items: true } });
    if (!guide) return res.status(404).json({ ok: false, error: "Guia AT nao encontrada." });

    await writePdfResponse(res, pdfName("guia-at", guide.codeAT || guide.id), "Guia de Transporte AT", (doc) => {
      line(doc, "Empresa", COMPANY_NAME);
      line(doc, "Numero guia AT", guide.codeAT || `Guia #${guide.id}`);
      line(doc, "Matricula", guide.vehicle?.plate || guide.vehicleId);
      line(doc, "Viatura", `${text(guide.vehicle?.name)} ${text(guide.vehicle?.brand, "")} ${text(guide.vehicle?.model, "")}`.trim());
      line(doc, "Origem", guide.origin || "Armazem Cristal Water");
      line(doc, "Destino", guide.destination || "Clientes em rota");
      line(doc, "Validade", `${fmtDate(guide.validFrom)} - ${fmtDate(guide.validUntil)}`);
      line(doc, "Estado", guide.status);
      section(doc, "Material transportado");
      tableRows(doc, arr(guide.items).map(item => ({
        title: item.name,
        meta: `${text(item.type, "MATERIAL")} | ${n(item.quantity, 0) || 0} ${text(item.unit, "UN")}`
      })), "Sem material registado nesta guia.");
    }, { identity: { 'X-CW-Document-Type': 'transport-guide', 'X-CW-Document-Id': guide.id, 'X-CW-Vehicle-Id': guide.vehicleId ?? 'unassigned' } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function downloadLatestTransportGuidePdf(req, res) {
  try {
    const vehicleId = n(req.params.vehicleId);
    if (!vehicleId) return res.status(400).json({ ok: false, error: "vehicleId obrigatorio." });
    const guide = await strictActiveTransportGuide(vehicleId);
    if (!guide) return res.status(404).json({ ok: false, error: "Sem guia AT ativa para esta viatura." });
    req.params.id = String(guide.id);
    return downloadTransportGuidePdf(req, res);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function updateTransportGuideItems(req, res) {
  try {
    const id = n(req.params.id);
    const guide = await prisma.transportGuide.findUnique({ where: { id }, include: { items: true } });
    if (!guide) return res.status(404).json({ ok: false, error: 'Guia não encontrada.' });
    const items = normalizeGuideItems(req.body.items);
    await prisma.transportGuideItem.deleteMany({ where: { guideId: id } });
    if (items.length) await prisma.transportGuideItem.createMany({ data: items.map(i => ({ ...i, guideId: id })) });
    const updated = await prisma.transportGuide.findUnique({ where: { id }, include: { vehicle: true, items: true } });
    const workGuide = await prisma.workGuide.findFirst({ where: { guideId: id }, orderBy: { createdAt: 'desc' } }).catch(() => null);
    if (workGuide) await syncWorkGuideItemsWithTransportGuide(workGuide.id, updated.items || []);
    await audit(req, 'TRANSPORT_GUIDE_ITEMS_UPDATE', 'TransportGuide', id, { oldCount: guide.items.length, newCount: items.length });
    res.json({ ok: true, guide: updated, message: 'Stock da guia atualizado. Alteração registada em auditoria.' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function getVehicleStockPreset(req, res) {
  try {
    const vehicleId = n(req.params.vehicleId);
    res.json({ ok: true, vehicleId, items: await getVehiclePreset(vehicleId) });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function saveVehicleStockPreset(req, res) {
  try {
    const vehicleId = n(req.params.vehicleId);
    if (!vehicleId) return res.status(400).json({ ok: false, error: 'vehicleId obrigatório.' });
    await setVehiclePreset(vehicleId, req.body.items || []);
    await audit(req, 'VEHICLE_STOCK_PRESET_SAVE', 'Vehicle', vehicleId, { items: normalizeGuideItems(req.body.items || []) });
    res.json({ ok: true, vehicleId, items: await getVehiclePreset(vehicleId) });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

// ==========================================================
// WORK GUIDE / GUIA DE OBRA
// ==========================================================
async function listWorkGuides(req, res) {
  try {
    const where = {};
    if (req.query.vehicleId) where.vehicleId = n(req.query.vehicleId);
    if (req.query.technicianId) where.technicianId = n(req.query.technicianId);
    if (req.query.status) where.status = req.query.status;
    const workGuides = await prisma.workGuide.findMany({ where, orderBy: { createdAt: "desc" }, include: { vehicle: true, technician: true, guide: { include: { items: true, vehicle: true } }, items: true } });
    res.json({ ok: true, workGuides });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function startWorkGuide(req,res) {
  try {
    const result=await require('../services/workGuideOpeningService').start(req.user,req.body);
    if(result.missingTransportGuide&&!result.reused)await notifyMissingTransportGuide({req,vehicleId:result.workGuide.vehicleId,technicianId:result.workGuide.technicianId,workGuideId:result.workGuide.id,reason:'AT_UNAVAILABLE_START_DAY'});
    res.json({ok:true,...result,message:result.reused?'Guia existente conservada, sem reiniciar saldos.':result.missingTransportGuide?'Obra provisória criada; reveja a associação AT na administração.':'Guia de obra criada.'});
  } catch(e) { res.status(e.statusCode||503).json({ok:false,error:e.statusCode?e.message:'Não foi possível confirmar a abertura da obra.'}); }
}

const consumeMaterial = require('./vehicleConsumptionController').legacy;

async function closeWorkGuide(req, res) {
  try {
    const id = n(req.params.id);
    const { endKm, notes } = req.body;
    const wg = await prisma.workGuide.update({ where: { id }, data: { status: "CLOSED", endKm: n(endKm), notes, closedAt: new Date() }, include: { items: true, vehicle: true, technician: true } });
    if (endKm != null && wg.vehicleId) await prisma.vehicle.update({ where: { id: wg.vehicleId }, data: { currentKm: n(endKm) } }).catch(()=>null);
    await audit(req, "WORK_GUIDE_CLOSE", "WorkGuide", id, { endKm, notes });
    res.json({ ok: true, workGuide: wg });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function getVehicleStock(req, res) {
  try {
    const vehicleId = n(req.params.vehicleId);
    res.set('Cache-Control','private, no-store');
    const candidates=await prisma.workGuide.findMany({where:{vehicleId,status:'OPEN',...(req.fieldVehicleId?{technicianId:Number(req.user.technicianId||req.user.id)}:{})},orderBy:{createdAt:'desc'},take:2,include:{items:true,technician:true,guide:{include:{items:true,vehicle:true}},vehicle:true}});
    if(candidates.length>1)return res.status(409).json({ok:false,error:'Existem várias guias abertas. Reveja-as na administração.'});
    const workGuide=candidates[0]||null;
    const transportGuideDocument = workGuide?.guideId
      ? await getTransportGuideOfficialDocument(workGuide.guideId)
      : null;
    if (workGuide?.guide) workGuide.guide.officialDocument = transportGuideDocument;
    const movements = workGuide
      ? await enrichMovementsWithVisitContext(await prisma.vehicleStockMovement.findMany({
          where: { workGuideId: workGuide.id, movementType: "CONSUMPTION" },
          orderBy: { createdAt: "asc" }
        }))
      : [];
    res.json({
      ok: true,
      workGuide,
      stock: workGuide?.items || [],
      movements,
      transportGuideDocument,
      missingTransportGuide: Boolean(workGuide && !workGuide.guideId)
    });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function getVehicleInsurance(req, res) {
  try {
    const vehicleId = n(req.params.id || req.params.vehicleId);
    if (!vehicleId) return res.status(400).json({ ok: false, error: "vehicleId obrigatorio." });
    const payload = await vehicleInsurancePayload(vehicleId);
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function downloadVehicleInsurancePdf(req, res) {
  try {
    const vehicleId = n(req.params.id || req.params.vehicleId);
    if (!vehicleId) return res.status(400).json({ ok: false, error: "vehicleId obrigatorio." });
    const { vehicle, insurance } = await vehicleInsurancePayload(vehicleId);
    if (!vehicle) return res.status(404).json({ ok: false, error: "Viatura nao encontrada." });

    await writePdfResponse(res, pdfName("seguro-viatura", vehicle.plate || vehicle.id), "Ficha de Seguro da Viatura", (doc) => {
      line(doc, "Empresa", COMPANY_NAME);
      line(doc, "Matricula", vehicle.plate);
      line(doc, "Viatura", `${text(vehicle.name)} ${text(vehicle.brand, "")} ${text(vehicle.model, "")}`.trim());
      line(doc, "Estado da viatura", vehicle.status);
      section(doc, "Seguro");
      if (insurance) {
        line(doc, "Documento/apolice", insurance.title);
        line(doc, "Tipo", insurance.type);
        line(doc, "Validade", insurance.dueDate ? fmtDate(insurance.dueDate) : "Sem validade definida");
        line(doc, "Estado", insurance.status);
        line(doc, "Notas", insurance.notes || "-");
      } else {
        paragraph(doc, "Seguro não registado no sistema.");
        paragraph(doc, "O administrador deve inserir o seguro como manutenção/documento da viatura para aparecer aqui automaticamente.");
      }
    }, { identity: { 'X-CW-Document-Type': 'vehicle-insurance', 'X-CW-Vehicle-Id': vehicle.id } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function downloadWorkGuidePdf(req, res) {
  try {
    const id = n(req.params.id);
    const workGuide = await prisma.workGuide.findUnique({
      where: { id },
      include: { vehicle: true, technician: true, guide: { include: { items: true, vehicle: true } }, items: true }
    });
    if (!workGuide) return res.status(404).json({ ok: false, error: "Guia de obra nao encontrada." });

    const movements = await enrichMovementsWithVisitContext(await prisma.vehicleStockMovement.findMany({
      where: { workGuideId: id, movementType: "CONSUMPTION" },
      orderBy: { createdAt: "asc" }
    }));
    const productTotals = groupMovementTotals(movements, (move) => move.itemName);
    const locationTotals = groupMovementTotals(movements, (move) => move.locationLabel);

    await writePdfResponse(res, pdfName("guia-obra", workGuide.id), "Guia de Obra / Saida de Material", (doc) => {
      const atReference = workGuide.guide?.codeAT || workGuide.guideId || "AT EM FALTA - GUIA PROVISORIA";
      line(doc, "Empresa", COMPANY_NAME);
      line(doc, "Guia de obra", `#${workGuide.id}`);
      line(doc, "Numero guia AT", atReference);
      line(doc, "Matricula", workGuide.vehicle?.plate || workGuide.vehicleId || "-");
      line(doc, "Tecnico", workGuide.technician?.name || workGuide.technicianId || "-");
      line(doc, "Inicio", fmtDate(workGuide.createdAt));
      line(doc, "Fecho", fmtDate(workGuide.closedAt));
      line(doc, "Km", `${text(workGuide.startKm)} -> ${text(workGuide.endKm)}`);

      section(doc, "Referencia e totais da guia de transporte");
      line(doc, "Referencia guia AT", atReference);
      if (!workGuide.guideId) {
        line(doc, "Estado AT", "Guia de obra provisoria. A guia de transporte AT deve ser associada assim que estiver disponivel.");
      }
      line(doc, "Origem", workGuide.guide?.origin || "Armazem Cristal Water");
      line(doc, "Destino", workGuide.guide?.destination || "Clientes em rota");
      tableRows(doc, arr(workGuide.guide?.items).map(item => ({
        title: item.name,
        meta: `Total AT: ${n(item.quantity, 0) || 0} ${text(item.unit, "UN")} | ${text(item.type, "MATERIAL")}`
      })), "Sem totais de transporte registados nesta guia AT.");

      section(doc, "Registos de saida de material");
      tableRows(doc, movements.map(move => ({
        title: move.itemName,
        meta: `${fmtDate(move.createdAt)} | ${n(move.quantity, 0) || 0} ${text(move.unit, "UN")} | ${text(move.locationLabel)} | visita ${text(move.visitId)}`,
        notes: [
          move.userNotes,
          move.readings ? `Leituras: ${Object.entries(move.readings).map(([key, value]) => `${key} ${value}`).join(" | ")}` : null
        ].filter(Boolean).join(" | ")
      })), "Ainda nao existem saidas de material registadas.");

      section(doc, "Deducoes por quimico/material");
      tableRows(doc, productTotals.map(row => ({
        title: row.itemName,
        meta: `Deduzido: ${row.quantity} ${row.unit}`
      })), "Sem deducoes por produto.");

      section(doc, "Deducoes por local");
      tableRows(doc, locationTotals.map(row => ({
        title: row.key,
        meta: `${row.itemName}: ${row.quantity} ${row.unit}`
      })), "Sem deducoes por local.");

      section(doc, "Leitura final do stock da viatura");
      tableRows(doc, arr(workGuide.items).map(item => ({
        title: item.name,
        meta: `Inicial: ${n(item.initialQty, 0) || 0} ${text(item.unit, "UN")} | Usado: ${n(item.usedQty, 0) || 0} ${text(item.unit, "UN")} | Final: ${n(item.quantity, 0) || 0} ${text(item.unit, "UN")}`,
        notes: item.type || "MATERIAL"
      })), "Sem stock final registado.");

      section(doc, "Totais de quimicos no carro");
      line(doc, "Stock final de quimicos", totalByUnit(workGuide.items, "quantity", isChemicalItem));
      line(doc, "Quimicos usados", totalByUnit(workGuide.items, "usedQty", isChemicalItem));

      section(doc, "Assinaturas");
      paragraph(doc, "Técnico: ________________________________");
      paragraph(doc, "Responsável: ________________________________");
    }, { identity: { 'X-CW-Document-Type': 'work-guide', 'X-CW-Document-Id': workGuide.id, 'X-CW-Vehicle-Id': workGuide.vehicleId ?? 'unassigned' } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function listMovements(req, res) {
  try {
    const where = {};
    if (req.query.vehicleId) where.vehicleId = n(req.query.vehicleId);
    if (req.query.workGuideId) where.workGuideId = n(req.query.workGuideId);
    const movements = await prisma.vehicleStockMovement.findMany({ where, orderBy: { createdAt: "desc" }, take: n(req.query.limit, 200) || 200 });
    res.json({ ok: true, movements });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function createMaintenance(req, res) {
  try {
    const { vehicleId, type, title, dueDate, km, cost, notes, status } = req.body;
    const record = await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: n(vehicleId), type: type || "GENERAL", title, dueDate: dateOrNull(dueDate), km: n(km), cost: n(cost), notes, status: status || "PENDING" } });
    res.json({ ok: true, record });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function listMaintenance(req, res) {
  try {
    const where = {};
    if (req.query.vehicleId) where.vehicleId = n(req.query.vehicleId);
    if (req.query.status) where.status = req.query.status;
    const records = await prisma.vehicleMaintenanceRecord.findMany({ where, orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }] });
    res.json({ ok: true, records });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function completeMaintenance(req, res) {
  try {
    const id = n(req.params.id);
    const record = await prisma.vehicleMaintenanceRecord.update({ where: { id }, data: { status: "DONE", completedAt: new Date(), ...req.body } });
    res.json({ ok: true, record });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

module.exports = {
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  restoreVehicle,
  assignTechnicianVehicle,
  listTransportGuides,
  createTransportGuide,
  updateTransportGuide,
  getLatestTransportGuide,
  uploadTransportGuideDocument,
  getTransportGuideDocument,
  downloadTransportGuidePdf,
  downloadLatestTransportGuidePdf,
  updateTransportGuideItems,
  getVehicleStockPreset,
  saveVehicleStockPreset,
  listWorkGuides,
  startWorkGuide,
  consumeMaterial,
  closeWorkGuide,
  getVehicleStock,
  getVehicleInsurance,
  downloadVehicleInsurancePdf,
  downloadWorkGuidePdf,
  listMovements,
  createMaintenance,
  listMaintenance,
  completeMaintenance
};
