const prismaClient = require("../../prismaClient");
const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

async function listMaintenanceForPool(poolId) {
  return prisma.technicalAlert.findMany({
    where: { poolId },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  listMaintenanceForPool,
};
