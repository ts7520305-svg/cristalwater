const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const plainPassword = String(process.env.ADMIN_PASSWORD || "");
  const name = process.env.ADMIN_NAME || "Administrador";

  if (!email || !plainPassword) {
    throw new Error("Define ADMIN_EMAIL e ADMIN_PASSWORD antes de criar o administrador.");
  }

  const password = await bcrypt.hash(plainPassword, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email,
      name,
      password,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
    },
  });

  console.log(`Administrador garantido: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
