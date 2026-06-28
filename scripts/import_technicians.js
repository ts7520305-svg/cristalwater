const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  try {
    const filePath = path.join(
      __dirname,
      "../src/data/technicians.json"
    );

    const raw = fs.readFileSync(filePath, "utf-8");
    const technicians = JSON.parse(raw);

    let created = 0;
    let skipped = 0;

    for (const t of technicians) {
      const name = t.name || t.nome;
      if (!name) {
        skipped++;
        continue;
      }

      const exists = await prisma.technician.findFirst({
        where: { name },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await prisma.technician.create({
        data: {
          name,
          phone: t.phone || null,
          email: t.email || null,
          notes: t.notes || null,
          active: t.active !== undefined ? t.active : true,
        },
      });

      created++;
    }

    console.log("IMPORT TECNICOS FINALIZADO");
    console.log("Criados:", created);
    console.log("Ignorados:", skipped);
  } catch (err) {
    console.error("ERRO:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();