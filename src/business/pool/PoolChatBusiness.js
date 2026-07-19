const prismaClient = require("../../prismaClient");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

async function listPoolMessages(poolId) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { client: true },
  });

  if (!pool) {
    return null;
  }

  const messages = await prisma.poolMessage.findMany({
    where: { poolId },
    orderBy: { createdAt: "desc" },
  });

  return { pool, messages };
}

async function sendPoolMessage(poolId, senderType, text) {
  const pool = await prisma.pool.findUnique({ where: { id: poolId } });

  if (!pool) {
    return null;
  }

  return prisma.poolMessage.create({
    data: {
      poolId,
      senderType,
      text: text.trim(),
    },
  });
}

module.exports = {
  listPoolMessages,
  sendPoolMessage,
};