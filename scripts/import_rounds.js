const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  try {
    const filePath = path.join(__dirname, "../src/data/rounds.json");
    if (!fs.existsSync(filePath)) {
      throw new Error("Ficheiro rounds.json não encontrado");
    }

    const rounds = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    for (const r of rounds) {
      const round = await prisma.round.create({
        data: {
          name: r.name,
          dayOfWeek: r.dayOfWeek,
          active: true,
        },
      });

      // Técnicos da ronda
      for (const techName of r.technicians || []) {
        const tech = await prisma.technician.findFirst({
          where: { name: techName },
        });
        if (!tech) continue;

        await prisma.roundTechnician.create({
          data: {
            roundId: round.id,
            technicianId: tech.id,
          },
        });
      }

      // Piscinas da ronda
      for (const p of r.pools || []) {
        const pool = await prisma.pool.findFirst({
          where: { name: p.name },
        });
        if (!pool) continue;

        await prisma.roundPool.create({
          data: {
            roundId: round.id,
            poolId: pool.id,
            order: p.order,
          },
        });
      }
    }

    console.log("IMPORT RONDAS FINALIZADO");
  } catch (err) {
    console.error("ERRO IMPORT RONDAS:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();