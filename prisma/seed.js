const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const enableDemoSeed = String(process.env.ENABLE_DEMO_SEED || "false").toLowerCase() === "true";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@cristalwater.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const password = await bcrypt.hash(String(adminPassword), 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password, role: "ADMIN", active: true, mustChangePassword: false, passwordChangedAt: new Date() },
    create: {
      email: adminEmail,
      password,
      role: "ADMIN",
      name: "Administrador",
      active: true,
      mustChangePassword: false,
    },
  }).catch(() => null);

  if (!enableDemoSeed) {
    console.log("Seed concluído: utilizador admin garantido. Dados de demonstração não foram criados.");
    return;
  }

  console.log("ENABLE_DEMO_SEED=true ativo: podes adaptar este ficheiro para criar dados de teste temporários.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
