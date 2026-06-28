#!/usr/bin/env node
const { prisma } = require("../src/prismaClient");

async function main() {
  const stamp = Date.now();
  const client = await prisma.client.create({
    data: {
      name: `QA Pool Flow ${stamp}`,
      email: `qa.pool.${stamp}@cliente.test`,
      phone: `930${String(stamp).slice(-6)}`,
      zone: "QA",
      status: "SETUP",
      active: true,
      archiveStatus: "ATIVO",
    },
  });

  const created = await prisma.$transaction(async (tx) => {
    const pool = await tx.pool.create({
      data: {
        clientId: client.id,
        name: `Piscina QA ${stamp}`,
        type: "POOL",
        zone: "QA",
        address: `Rua QA ${stamp}`,
        location: "Jardim",
        monthlyAmount: 120,
        active: true,
        archiveStatus: "ATIVO",
        scheduleMode: "PENDING_ROUND",
      },
    });

    const jacuzzi = await tx.pool.create({
      data: {
        clientId: client.id,
        name: `Jacuzzi QA ${stamp}`,
        type: "JACUZZI",
        zone: "QA",
        address: `Rua QA ${stamp}`,
        location: "Terraco",
        monthlyAmount: 60,
        active: true,
        archiveStatus: "ATIVO",
        scheduleMode: "PENDING_ROUND",
      },
    });

    return { pool, jacuzzi };
  });

  const loaded = await prisma.client.findUnique({
    where: { id: client.id },
    include: { pools: { orderBy: { id: "asc" } } },
  });

  if (!loaded || loaded.pools.length !== 2) {
    throw new Error("Falhou associacao cliente -> piscina/jacuzzi.");
  }
  if (!loaded.pools.every((item) => item.clientId === client.id)) {
    throw new Error("Existe piscina sem cliente correto.");
  }

  await prisma.technicalSheet.deleteMany({ where: { poolId: { in: [created.pool.id, created.jacuzzi.id] } } }).catch(() => {});
  await prisma.pool.deleteMany({ where: { id: { in: [created.pool.id, created.jacuzzi.id] } } });
  await prisma.client.delete({ where: { id: client.id } });

  console.log(`OK pool create flow: cliente ${client.id}, piscina ${created.pool.id}, jacuzzi ${created.jacuzzi.id}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
