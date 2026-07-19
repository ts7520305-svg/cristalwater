const prismaClient = require("../../prismaClient");
const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

async function listVisitsForPool(poolId) {
  return prisma.serviceVisit.findMany({
    where: { poolId },
    orderBy: [{ plannedDate: "asc" }, { createdAt: "asc" }],
  });
}

module.exports = {
  listVisitsForPool,
};
