const prismaClient = require("../../prismaClient");
const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

async function getHistoryForPool(poolId) {
  return prisma.technicalHistory.findMany({
    where: { poolId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function listAllTechnicalHistory() {
  return prisma.technicalHistory.findMany({
    orderBy: { performedAt: "desc" },
    include: {
      pool: {
        include: {
          client: true,
        },
      },
    },
  });
}

async function listTechnicalHistoryByPool(poolId) {
  return prisma.technicalHistory.findMany({
    where: { poolId },
    orderBy: { performedAt: "desc" },
  });
}

async function getTechnicalHistoryById(id) {
  return prisma.technicalHistory.findUnique({
    where: { id },
    include: {
      pool: {
        include: { client: true },
      },
    },
  });
}

async function createTechnicalHistory(payload) {
  const { poolId, component, description, performedAt, nextSuggested } = payload;

  const data = {
    poolId: Number(poolId),
    component: String(component).trim(),
    description: String(description).trim(),
    performedAt: performedAt ? new Date(performedAt) : null,
    nextSuggested: nextSuggested ? new Date(nextSuggested) : null,
  };

  return prisma.technicalHistory.create({ data });
}

async function updateTechnicalHistory(id, payload) {
  const existing = await prisma.technicalHistory.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  const { component, description, performedAt, nextSuggested } = payload;
  const data = {
    component:
      component !== undefined && component !== null
        ? String(component).trim()
        : existing.component,
    description:
      description !== undefined && description !== null
        ? String(description).trim()
        : existing.description,
    performedAt:
      performedAt !== undefined && performedAt !== null
        ? performedAt
          ? new Date(performedAt)
          : null
        : existing.performedAt,
    nextSuggested:
      nextSuggested !== undefined && nextSuggested !== null
        ? nextSuggested
          ? new Date(nextSuggested)
          : null
        : existing.nextSuggested,
  };

  return prisma.technicalHistory.update({
    where: { id },
    data,
  });
}

async function removeTechnicalHistory(id) {
  const existing = await prisma.technicalHistory.findUnique({
    where: { id },
  });

  if (!existing) {
    return false;
  }

  await prisma.technicalHistory.delete({ where: { id } });
  return true;
}

module.exports = {
  getHistoryForPool,
  listAllTechnicalHistory,
  listTechnicalHistoryByPool,
  getTechnicalHistoryById,
  createTechnicalHistory,
  updateTechnicalHistory,
  removeTechnicalHistory,
};
