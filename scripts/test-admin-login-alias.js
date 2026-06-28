require("dotenv").config();

const bcrypt = require("bcryptjs");
const { prisma } = require("../src/prismaClient");
const { login } = require("../src/controllers/authController");
const { loginAdmin } = require("../src/services/adminAuthService");
const {
  canonicalAdminEmail,
  configuredAdminEmails,
  isConfiguredAdminEmail,
} = require("../src/utils/adminIdentity");

function simulateLogin(email, password) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      },
    };
    login({ body: { email, password } }, res);
  });
}

async function main() {
  const canonical = canonicalAdminEmail();
  const password = String(process.env.ADMIN_PASSWORD || "");
  const aliases = configuredAdminEmails();

  if (!canonical) throw new Error("ADMIN_EMAIL nao configurado.");
  if (!password) throw new Error("ADMIN_PASSWORD nao configurada.");
  if (!isConfiguredAdminEmail(canonical)) throw new Error("Email admin principal nao reconhecido.");

  const admin = await prisma.user.findUnique({ where: { email: canonical } });
  if (!admin) throw new Error(`Administrador principal nao existe: ${canonical}`);
  if (admin.active === false) throw new Error("Administrador principal esta inativo.");

  const matches = await bcrypt.compare(password, admin.password || "");
  if (!matches) throw new Error("A password do .env nao corresponde a password gravada no administrador.");

  for (const email of aliases) {
    if (!isConfiguredAdminEmail(email)) {
      throw new Error(`Alias admin nao reconhecido: ${email}`);
    }
    const result = await simulateLogin(email, password);
    if (result.statusCode !== 200 || result.payload?.ok !== true) {
      throw new Error(`Login admin falhou para: ${email}`);
    }
    if (result.payload?.user?.role !== "ADMIN") {
      throw new Error(`Login admin sem perfil ADMIN para: ${email}`);
    }
    const legacyToken = loginAdmin(email, password);
    if (!legacyToken) {
      throw new Error(`Login admin legado falhou para: ${email}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    canonical,
    aliases,
    adminId: admin.id,
    adminActive: admin.active !== false,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
