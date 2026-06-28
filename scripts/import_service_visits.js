const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  try {
    const filePath = path.join(__dirname, "../src/data/service_visits.json");
    if (!fs.existsSync(filePath)) {
      throw new Error("Ficheiro service_visits.json não encontrado");
    }

    const visits = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    let created = 0;
    let skipped = 0;

    for (const v of visits) {
      const pool = await prisma.pool.findFirst({ where: { name: v.poolName } });
      const tech = await prisma.technician.findFirst({ where: { name: v.technicianName } });
      const round = v.roundName
        ? await prisma.round.findFirst({ where: { name: v.roundName } })
        : null;

      if (!pool || !tech || !v.date || !v.status) {
        skipped++;
        continue;
      }

      await prisma.serviceVisit.create({
        data: {
          date: new Date(v.date),
          status: v.status,
          reason: v.reason || null,
          notes: v.notes || null,
          alerts: v.alerts || null,
          poolId: pool.id,
          technicianId: tech.id,
          roundId: round ? round.id : null,
  },
});

      created++;
    }

    console.log("IMPORT SERVICE VISITS FINALIZADO");
    console.log("Criados:", created);
    console.log("Ignorados:", skipped);
  } catch (err) {
    console.error("ERRO IMPORT SERVICE VISITS:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();