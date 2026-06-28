const { prisma } = require("../prismaClient");

async function run() {

  console.log("🚀 A adicionar coordenadas...");

  const pools = await prisma.pool.findMany();

  for (const p of pools) {

    // 🔥 EXEMPLO (substitui pelas tuas zonas reais)
    const lat = 37.102 + Math.random() * 0.01;
    const lng = -8.675 + Math.random() * 0.01;

    await prisma.pool.update({
      where: { id: p.id },
      data: {
        latitude: lat,
        longitude: lng
      }
    });

    console.log(`✔ ${p.name} atualizado`);
  }

  console.log("✅ Coordenadas inseridas");
}

run().then(() => process.exit());