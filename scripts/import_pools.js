// ==========================================
// CRISTAL WATER - IMPORT POOLS (OFICIAL)
// ==========================================

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  try {
    const filePath = path.join(__dirname, "../src/data/pools.json");

    if (!fs.existsSync(filePath)) {
      throw new Error("Ficheiro pools.json não encontrado");
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const pools = JSON.parse(raw);

    let created = 0;
    let skipped = 0;

    for (const p of pools) {
      if (!p.name || !p.clientName) {
        skipped++;
        continue;
      }

      const client = await prisma.client.findFirst({
        where: { name: p.clientName },
      });

      if (!client) {
        console.log("Cliente não encontrado:", p.clientName);
        skipped++;
        continue;
      }

      const exists = await prisma.pool.findFirst({
        where: {
          name: p.name,
          clientId: client.id,
        },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await prisma.pool.create({
        data: {
          name: p.name,
          location: p.location || null,
          volumeM3: p.volumeM3 || null,
          type: p.type || null,
          notes: p.notes || null,
          clientId: client.id,
          active: true,
        },
      });

      created++;
    }

    console.log("IMPORT POOLS FINALIZADO");
    console.log("Criadas:", created);
    console.log("Ignoradas:", skipped);
  } catch (err) {
    console.error("ERRO IMPORT POOLS:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();