const { prisma } = require("../../prismaClient");

class PoolBusiness {

  async list(query = {}) {
    const includeInactive = ["true", "1", "yes", "sim"].includes(
      String(query.includeInactive || "").toLowerCase()
    );

    const where = includeInactive
      ? {}
      : {
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
              select: {
                id: true,
                name: true,
                dayOfWeek: true,
                active: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: [
        { active: "desc" },
        { zone: "asc" },
        { id: "asc" },
      ],
    });
  }

  async getById(poolId) {
    return prisma.pool.findUnique({
      where: {
        id: Number(poolId),
      },
      include: {
        client: true,
        equipment: true,
        technicalRoom: true,
        calculationProfile: true,
        technicalSheet: true,
        technicalHistory: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
      },
    });
  }

}

module.exports = new PoolBusiness();
