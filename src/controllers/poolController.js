const { prisma } = require("../prismaClient");

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}
function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function numberOrDefault(value, fallback) {
  const n = numberOrNull(value);
  return n === null ? fallback : n;
}
function boolFrom(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
}
function cleanString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const v = String(value).trim();
  return v || null;
}
function definedOnly(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
function poolUniqueErrorMessage(err) {
  if (err?.code !== "P2002") return null;
  const target = Array.isArray(err.meta?.target) ? err.meta.target.join(",") : String(err.meta?.target || "");
  if (target.includes("serialNumber")) return "Ja existe uma piscina ou jacuzzi com este numero de serie.";
  if (target.includes("address") || target.includes("pool_physical_location_unique")) {
    return "Ja existe uma infraestrutura registada exatamente com este tipo e nesta localizacao/morada.";
  }
  return "Ja existe um registo duplicado para esta piscina ou jacuzzi.";
}
function cleanPoolPayload(body = {}, isCreate = false) {
  return definedOnly({
    clientId: isCreate ? toInt(body.clientId) : undefined,
    name: cleanString(body.name),
    location: cleanString(body.location),
    address: cleanString(body.address),
    serialNumber: cleanString(body.serialNumber),
    zone: cleanString(body.zone),
    zoneId: body.zoneId === undefined ? undefined : numberOrNull(body.zoneId),
    volumeM3: body.volumeM3 === undefined ? undefined : numberOrNull(body.volumeM3),
    type: cleanString(body.type),
    priority: body.priority === undefined ? undefined : numberOrDefault(body.priority, 0),
    active: body.active === undefined ? undefined : boolFrom(body.active),
    notes: cleanString(body.notes),
    latitude: body.latitude === undefined ? undefined : numberOrNull(body.latitude),
    longitude: body.longitude === undefined ? undefined : numberOrNull(body.longitude),
    monthlyAmount: body.monthlyAmount === undefined ? undefined : numberOrDefault(body.monthlyAmount, 0),
    serviceFrequency: body.serviceFrequency === undefined ? undefined : Math.max(1, numberOrDefault(body.serviceFrequency, 1)),
    preferredDays: cleanString(body.preferredDays),
    scheduleMode: cleanString(body.scheduleMode),
    estimatedMinutes: body.estimatedMinutes === undefined ? undefined : Math.max(1, numberOrDefault(body.estimatedMinutes, 30)),
    hasLights: body.hasLights === undefined ? undefined : boolFrom(body.hasLights),
    archiveStatus: body.archiveStatus || undefined,
    deletedAt: body.deletedAt === undefined ? undefined : body.deletedAt,
  });
}
function technicalSheetData(body = {}) {
  const source = body.technicalSheet && typeof body.technicalSheet === "object" ? body.technicalSheet : body;
  return definedOnly({
    volumeM3: source.volumeM3 === undefined ? undefined : numberOrDefault(source.volumeM3, 0),
    disinfectionType: cleanString(source.disinfectionType || source.type) || undefined,
    targetPhMin: source.targetPhMin === undefined ? undefined : numberOrDefault(source.targetPhMin, 7.2),
    targetPhMax: source.targetPhMax === undefined ? undefined : numberOrDefault(source.targetPhMax, 7.6),
    targetChlorineMin: source.targetChlorineMin === undefined ? undefined : numberOrDefault(source.targetChlorineMin, 1),
    targetChlorineMax: source.targetChlorineMax === undefined ? undefined : numberOrDefault(source.targetChlorineMax, 3),
    targetAlkalinityMin: source.targetAlkalinityMin === undefined ? undefined : numberOrDefault(source.targetAlkalinityMin, 80),
    targetAlkalinityMax: source.targetAlkalinityMax === undefined ? undefined : numberOrDefault(source.targetAlkalinityMax, 120),
    targetOrpMinMv: source.targetOrpMinMv === undefined ? undefined : numberOrNull(source.targetOrpMinMv),
    filterBrandModel: cleanString(source.filterBrandModel),
    pumpHorsePower: source.pumpHorsePower === undefined ? undefined : numberOrNull(source.pumpHorsePower),
    chlorinatorModel: cleanString(source.chlorinatorModel),
    technicalRoomLocation: cleanString(source.technicalRoomLocation),
    specialObservations: cleanString(source.specialObservations || source.notes),
  });
}
async function ensureTechnicalSheet(tx, pool, body = {}) {
  if (!tx.technicalSheet) return null;
  const tsData = technicalSheetData({ ...body, volumeM3: body.volumeM3 ?? pool.volumeM3, type: body.type ?? pool.type });
  return tx.technicalSheet.upsert({
    where: { poolId: pool.id },
    update: tsData,
    create: {
      poolId: pool.id,
      volumeM3: numberOrDefault(body.volumeM3 ?? pool.volumeM3, 0),
      disinfectionType: cleanString(body.disinfectionType || body.type || pool.type) || "CLORO",
      ...tsData,
    },
  }).catch(() => null);
}
async function recordTechnicalSheetHistory(poolId, before, after, actor = "SYSTEM") {
  if (!prisma.technicalHistory) return null;
  return prisma.technicalHistory.create({
    data: {
      poolId,
      type: "TECHNICAL_SHEET_CHANGE",
      component: "Ficha Técnica",
      message: "Alteração imutável da ficha técnica",
      description: JSON.stringify({ actor, before: before || null, after: after || null, changedAt: new Date().toISOString() }),
      performedAt: new Date(),
      status: "DONE",
    },
  }).catch(() => null);
}

async function listPools(req, res) {
  try {
    const includeInactive = ["true", "1", "yes", "sim"].includes(String(req.query.includeInactive || "").toLowerCase());
    const where = includeInactive ? {} : { active: true, deletedAt: null, archiveStatus: "ATIVO" };
    const pools = await prisma.pool.findMany({
      where,
      include: {
        client: true,
        equipment: true,
        technicalRoom: true,
        calculationProfile: true,
        technicalSheet: true,
        roundPools: {
          include: {
            round: {
              select: { id: true, name: true, dayOfWeek: true, active: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ active: "desc" }, { zone: "asc" }, { id: "asc" }],
    });
    return res.json({ ok: true, pools });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro listar piscinas" });
  }
}

async function getPoolById(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const pool = await prisma.pool.findUnique({
      where: { id },
      include: {
        client: true,
        equipment: true,
        technicalRoom: true,
        calculationProfile: true,
        technicalSheet: true,
        technicalHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    return res.json({ ok: true, pool });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro obter piscina" });
  }
}

async function createPool(req, res) {
  try {
    const data = cleanPoolPayload(req.body, true);
    if (!data.clientId) return res.status(400).json({ ok: false, error: "clientId obrigatório" });
    if (!data.name) return res.status(400).json({ ok: false, error: "Nome da piscina obrigatório" });

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client || client.archiveStatus === "ARQUIVADO" || client.deletedAt) {
      return res.status(400).json({ ok: false, error: "Cliente inexistente ou arquivado" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.create({
        data: {
          ...data,
          active: true,
          archiveStatus: "ATIVO",
          deletedAt: null,
          scheduleMode: data.scheduleMode || "PENDING_ROUND",
        },
      });
      const technicalSheet = await ensureTechnicalSheet(tx, pool, req.body);
      return { pool, technicalSheet };
    });

    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    const duplicateMessage = poolUniqueErrorMessage(err);
    if (duplicateMessage) return res.status(409).json({ ok: false, error: duplicateMessage });
    return res.status(500).json({ error: "Erro criar piscina" });
  }
}

async function updatePool(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const data = cleanPoolPayload(req.body, false);
    const nextClientId = req.body?.clientId === undefined ? undefined : toInt(req.body.clientId);
    if (req.body?.clientId !== undefined) {
      if (!nextClientId) return res.status(400).json({ ok: false, error: "Cliente invalido para associar piscina" });
      const client = await prisma.client.findUnique({ where: { id: nextClientId } });
      if (!client || client.archiveStatus === "ARQUIVADO" || client.deletedAt) {
        return res.status(400).json({ ok: false, error: "Cliente inexistente ou arquivado" });
      }
      data.clientId = nextClientId;
    }

    const before = await prisma.pool.findUnique({ where: { id }, include: { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true } });
    const result = await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.update({ where: { id }, data });
      const technicalSheet = await ensureTechnicalSheet(tx, pool, req.body);
      return { pool, technicalSheet };
    });
    const after = await prisma.pool.findUnique({ where: { id }, include: { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true } });
    await recordTechnicalSheetHistory(id, before, after, req.headers["x-user-email"] || "ADMIN");
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    const duplicateMessage = poolUniqueErrorMessage(err);
    if (duplicateMessage) return res.status(409).json({ ok: false, error: duplicateMessage });
    return res.status(500).json({ error: "Erro atualizar piscina" });
  }
}

async function archivePool(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const pool = await prisma.pool.update({ where: { id }, data: { active: false, archiveStatus: "ARQUIVADO", deletedAt: new Date(), scheduleMode: "ARCHIVED" } });
    return res.json({ ok: true, archived: true, pool });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro arquivar piscina" });
  }
}

async function restorePool(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const pool = await prisma.pool.findUnique({ where: { id }, include: { client: true } });
    if (!pool) return res.status(404).json({ error: "Piscina não encontrada" });
    if (pool.client?.archiveStatus === "ARQUIVADO" || pool.client?.deletedAt) {
      return res.status(400).json({ error: "Ative primeiro o cliente antes de restaurar esta piscina." });
    }
    const restored = await prisma.pool.update({ where: { id }, data: { active: true, archiveStatus: "ATIVO", deletedAt: null, scheduleMode: "PENDING_ROUND" } });
    return res.json({ ok: true, restored: true, pool: restored });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro restaurar piscina" });
  }
}

async function deletePool(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [visits, alerts, repairs] = await Promise.all([
      prisma.serviceVisit.count({ where: { poolId: id } }).catch(() => 0),
      prisma.technicalAlert.count({ where: { poolId: id } }).catch(() => 0),
      prisma.repair.count({ where: { poolId: id } }).catch(() => 0),
    ]);
    if (visits > 0 || alerts > 0 || repairs > 0) {
      req.params.id = String(id);
      return archivePool(req, res);
    }
    await prisma.$transaction(async (tx) => {
      await tx.roundPool.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.technicalSheet.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.poolCalculationProfile.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.poolEquipment.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.technicalRoom.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.pool.delete({ where: { id } });
    });
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(409).json({ error: err.message || "Piscina protegida por histórico. Arquive em vez de eliminar fisicamente." });
  }
}

module.exports = {
  listPools,
  getPoolById,
  createPool,
  updatePool,
  archivePool,
  restorePool,
  deletePool,
};
