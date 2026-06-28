const { prisma } = require("../../prismaClient");

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrDefault(value, fallback) {
  const n = numberOrNull(value);
  return n === null ? fallback : n;
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

  const tsData = technicalSheetData({
    ...body,
    volumeM3: body.volumeM3 ?? pool.volumeM3,
    type: body.type ?? pool.type,
  });

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

class PoolBusiness {
  async list(query = {}) {
    const includeInactive = ["true", "1", "yes", "sim"].includes(
      String(query.includeInactive || "").toLowerCase()
    );

    const where = includeInactive ? {} : {
      active: true,
      deletedAt: null,
      archiveStatus: "ATIVO",
    };

    return prisma.pool.findMany({
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
  }

  async getById(poolId) {
    return prisma.pool.findUnique({
      where: { id: Number(poolId) },
      include: {
        client: true,
        equipment: true,
        technicalRoom: true,
        calculationProfile: true,
        technicalSheet: true,
        technicalHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  }

  async create(data, body = {}) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });

    if (!client || client.archiveStatus === "ARQUIVADO" || client.deletedAt) {
      const error = new Error("Cliente inexistente ou arquivado");
      error.statusCode = 400;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const pool = await tx.pool.create({
        data: {
          ...data,
          active: true,
          archiveStatus: "ATIVO",
          deletedAt: null,
          scheduleMode: data.scheduleMode || "PENDING_ROUND",
        },
      });

      const technicalSheet = await ensureTechnicalSheet(tx, pool, body);

      return { pool, technicalSheet };
    });
  }
  async archive(poolId) {
    const id = Number(poolId);

    return prisma.pool.update({
      where: { id },
      data: {
        active: false,
        archiveStatus: "ARQUIVADO",
        deletedAt: new Date(),
        scheduleMode: "ARCHIVED",
      },
    });
  }

  async restore(poolId) {
    const id = Number(poolId);

    const pool = await prisma.pool.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!pool) {
      const error = new Error("Piscina não encontrada");
      error.statusCode = 404;
      throw error;
    }

    if (pool.client?.archiveStatus === "ARQUIVADO" || pool.client?.deletedAt) {
      const error = new Error("Ative primeiro o cliente antes de restaurar esta piscina.");
      error.statusCode = 400;
      throw error;
    }

    return prisma.pool.update({
      where: { id },
      data: {
        active: true,
        archiveStatus: "ATIVO",
        deletedAt: null,
        scheduleMode: "PENDING_ROUND",
      },
    });
  }

  async delete(poolId) {
    const id = Number(poolId);

    const [visits, alerts, repairs] = await Promise.all([
      prisma.serviceVisit.count({ where: { poolId: id } }).catch(() => 0),
      prisma.technicalAlert.count({ where: { poolId: id } }).catch(() => 0),
      prisma.repair.count({ where: { poolId: id } }).catch(() => 0),
    ]);

    if (visits > 0 || alerts > 0 || repairs > 0) {
      const pool = await this.archive(id);
      return { ok: true, archived: true, pool };
    }

    await prisma.$transaction(async (tx) => {
      await tx.roundPool.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.technicalSheet.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.poolCalculationProfile.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.poolEquipment.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.technicalRoom.deleteMany({ where: { poolId: id } }).catch(() => null);
      await tx.pool.delete({ where: { id } });
    });

    return { ok: true, deleted: true };
  }
}

module.exports = new PoolBusiness();
