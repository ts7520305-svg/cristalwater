// ==========================================
// HASH CLIENT PINS (ONE-TIME SCRIPT)
// ==========================================

const bcrypt = require("bcrypt");
const prismaModule = require("../prismaClient");
const prisma = prismaModule.prisma;

async function hashPins() {
  const clients = await prisma.client.findMany({
    where: { pin: { not: null } },
  });

  for (const c of clients) {
    // Se já estiver hashed, ignora
    if (c.pin.startsWith("$2b$")) {
      console.log(`Cliente ${c.id} já tem PIN hashed`);
      continue;
    }

    const hash = await bcrypt.hash(c.pin, 10);

    await prisma.client.update({
      where: { id: c.id },
      data: { pin: hash },
    });

    console.log(`PIN atualizado para cliente ${c.id}`);
  }

  console.log("Conversão de PINs concluída.");
  process.exit(0);
}

hashPins().catch(err => {
  console.error("Erro ao converter PINs:", err);
  process.exit(1);
});