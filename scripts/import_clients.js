// ==========================================
// CRISTAL WATER - IMPORT CLIENTS (OFICIAL)
// ==========================================

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  try {
    const filePath = path.join(__dirname, "../src/data/clients.json");

    if (!fs.existsSync(filePath)) {
      throw new Error("Ficheiro clients.json NÃO encontrado em: " + filePath);
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const clients = JSON.parse(raw);

    let created = 0;
    let skipped = 0;

    for (const c of clients) {
      const name = c.name || c.nome;
      if (!name || name.trim() === "") {
        skipped++;
        continue;
      }

      const exists = await prisma.client.findFirst({
        where: { name },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await prisma.client.create({
        data: {
          name: name.trim(),
          internalName: c.internalName || null,
          email: c.email || null,
          phone: c.phone || null,
          address: c.address || null,
          zone: c.zone || null,
          notes: c.notes || null,
          status: c.status || "ACTIVE",
        },
      });

      created++;
    }

    console.log("IMPORT CLIENTES FINALIZADO");
    console.log("Criados:", created);
    console.log("Ignorados:", skipped);
  } catch (err) {
    console.error("ERRO IMPORT CLIENTES:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();