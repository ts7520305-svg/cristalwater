#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const {configurationChecks,inspectSchema}=require("./lib/vps-preflight-checks");

const root = path.resolve(__dirname, "..");
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

async function run() {
  checks.push(...configurationChecks(process.env));

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

  ["frontend/admin-master-control.html", "frontend/technician-field-mode.html", "frontend/client-portal.html"].forEach((file) => {
    if (exists(file)) ok(`UI ${file}`);
    else fail(`UI ${file}`, "Pagina critica em falta.");
  });

  const uploadDir = require("../src/config/uploadPath").resolveUploadBaseDir();
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
      try { await prisma.$queryRaw`SELECT 1`; } finally { await prisma.$disconnect(); }
      prismaReady = true;
      ok("Base de dados", "Ligacao PostgreSQL OK.");
    }
  } catch (error) {
    fail("Prisma/Base de dados", "Não foi possível confirmar a ligação. Verifique a configuração e o acesso ao PostgreSQL.");
  }

  if(prismaReady)checks.push(inspectSchema({root}));
  ok("Frontend servido pelo backend", "Páginas em frontend/; não é necessário um frontend/dist separado.");
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

if(require.main===module){
require("../src/loadEnv")();
run().catch((error) => {
  console.error("[FAIL] Não foi possível concluir a verificação do VPS. Verifique a configuração sem partilhar credenciais.");
  process.exit(1);
});

}
