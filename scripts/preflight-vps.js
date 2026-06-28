#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

require("../src/loadEnv")();

const root = path.resolve(__dirname, "..");
const projectRoot = path.resolve(root, "..");
const checks = [];

function ok(name, detail = "") {
  checks.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  checks.push({ name, ok: false, detail });
}

function warn(name, detail = "") {
  checks.push({ name, ok: true, warning: true, detail });
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function isWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.cw-write-${Date.now()}.tmp`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch (_) {
    return false;
  }
}

function requireEnv(name, options = {}) {
  const value = process.env[name];
  if (!value) return fail(`ENV ${name}`, "Obrigatorio em VPS/producao.");
  if (options.notDefault && options.notDefault.includes(value)) {
    return fail(`ENV ${name}`, "Valor de exemplo/default nao pode ser usado em producao.");
  }
  if (options.minLength && String(value).length < options.minLength) {
    return fail(`ENV ${name}`, `Deve ter pelo menos ${options.minLength} caracteres.`);
  }
  return ok(`ENV ${name}`);
}

async function run() {
  requireEnv("DATABASE_URL");
  requireEnv("JWT_SECRET", { minLength: 32, notDefault: ["cristalwater_secret", "trocar_esta_chave_em_producao"] });
  requireEnv("PORT");

  if (process.env.NODE_ENV !== "production") {
    warn("NODE_ENV", "Recomendado: NODE_ENV=production no VPS.");
  } else {
    ok("NODE_ENV", "production");
  }

  if (String(process.env.ALLOW_LEGACY_PLAIN_PASSWORDS || "false").toLowerCase() === "true") {
    fail("ALLOW_LEGACY_PLAIN_PASSWORDS", "Nao pode ficar true em producao.");
  } else {
    ok("ALLOW_LEGACY_PLAIN_PASSWORDS", "Passwords antigas em texto simples bloqueadas.");
  }

  if (process.env.ADMIN_PASSWORD && ["admin", "password", "trocar_esta_password"].includes(process.env.ADMIN_PASSWORD)) {
    fail("ADMIN_PASSWORD", "Password de exemplo nao pode ficar ativa.");
  } else if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    ok("ADMIN fallback", "Configurado por ENV.");
  } else {
    warn("ADMIN fallback", "Sem ADMIN_EMAIL/ADMIN_PASSWORD; garante admin real na base de dados.");
  }

  ["package.json", "src/server.js", "prisma/schema.prisma", ".env.example"].forEach((file) => {
    if (exists(file)) ok(`Ficheiro ${file}`);
    else fail(`Ficheiro ${file}`, "Em falta.");
  });

  if (exists("src/.env")) {
    fail("src/.env", "Nao deve existir. Mantem apenas o .env na raiz do backend.");
  } else {
    ok("src/.env ausente");
  }

  if (process.env.NODE_ENV === "production" && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*")) {
    warn("CORS_ORIGIN", "Em producao recomenda-se definir o dominio publico, por exemplo https://app.cristalwater.pt.");
  }

  ["frontend/admin-master-control.html", "frontend/technician-field-mode.html", "frontend/client-portal.html"].forEach((file) => {
    if (exists(file)) ok(`UI ${file}`);
    else fail(`UI ${file}`, "Pagina critica em falta.");
  });

  const uploadDir = path.resolve(root, process.env.UPLOAD_DIR || "uploads");
  if (isWritable(uploadDir)) ok("UPLOAD_DIR gravavel", uploadDir);
  else fail("UPLOAD_DIR gravavel", uploadDir);

  const logDir = path.resolve(root, "logs");
  if (isWritable(logDir)) ok("logs gravavel", logDir);
  else fail("logs gravavel", logDir);

  try {
    require.resolve("express");
    require.resolve("jsonwebtoken");
    require.resolve("@prisma/client");
    ok("Dependencias Node", "express/jsonwebtoken/@prisma/client resolvidos.");
  } catch (error) {
    fail("Dependencias Node", error.message);
  }

  let prismaReady = false;
  try {
    const { PrismaClient, Prisma } = require("@prisma/client");
    const models = Prisma?.dmmf?.datamodel?.models || [];
    if (!models.length) {
      fail("Prisma Client gerado", "Sem modelos DMMF. Executa: npx prisma generate");
    } else {
      ok("Prisma Client gerado", `${models.length} modelos.`);
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      prismaReady = true;
      ok("Base de dados", "Ligacao PostgreSQL OK.");
    }
  } catch (error) {
    fail("Prisma/Base de dados", error.message);
  }

  const frontendDist = path.join(projectRoot, "frontend", "dist", "index.html");
  if (fs.existsSync(frontendDist)) ok("Frontend build", frontendDist);
  else warn("Frontend build", "Nao encontrado. Executa no projeto frontend: npm run build");

  if (process.env.ENABLE_BACKGROUND_JOBS === "true" && !prismaReady) {
    fail("Background jobs", "Nao ativar jobs sem Prisma/Base de dados OK.");
  }

  const failures = checks.filter((check) => !check.ok);
  const warnings = checks.filter((check) => check.warning);
  for (const check of checks) {
    const marker = check.ok ? (check.warning ? "WARN" : "OK") : "FAIL";
    console.log(`[${marker}] ${check.name}${check.detail ? ` - ${check.detail}` : ""}`);
  }
  console.log(`\nResumo VPS: ${checks.length - failures.length} OK/WARN, ${failures.length} falha(s), ${warnings.length} aviso(s).`);
  if (failures.length) process.exit(1);
}

run().catch((error) => {
  console.error("[FAIL] Preflight VPS inesperado:", error);
  process.exit(1);
});
