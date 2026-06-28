const prisma = require("../../../prismaClient");

async function getPoolById(poolId) {
  return prisma.pool.findUnique({
    where: {
      id: Number(poolId),
    },
    include: {
      client: true,
      equipment: true,
      repairs: {
        take: 10,
        orderBy: { id: "desc" },
      },
      serviceVisits: {
        take: 10,
        orderBy: { id: "desc" },
      },
      technicalHistory: {
        take: 10,
        orderBy: { id: "desc" },
      },
      technicalRoom: true,
      technicalSheet: true,
      visits: {
        take: 10,
        orderBy: { id: "desc" },
      },
    },
  });
}

module.exports = {
  getPoolById,
};
