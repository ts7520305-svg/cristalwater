#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const {
  isWhatsAppEnabled,
  isEmailEnabled,
  isFiscalIssuingEnabled,
  areWebhooksEnabled,
  areExternalNotificationsEnabled,
} = require("../src/config/externalIntegrations");

const projectRoot = path.resolve(__dirname, "..");

function asBool(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function maskUser(user) {
  const text = String(user || "");
  if (!text) return "(missing)";
  if (text.length <= 2) return "*".repeat(text.length);
  return `${"*".repeat(text.length - 2)}${text.slice(-2)}`;
}

function parseDb(urlText) {
  if (!urlText) return { ok: false, error: "DATABASE_URL ausente" };
  try {
    const u = new URL(urlText);
    return {
      ok: true,
      host: u.hostname || "",
      port: Number(u.port || 5432),
      dbName: (u.pathname || "/").replace(/^\//, ""),
      user: u.username || "",
      schema: u.searchParams.get("schema") || "public",
    };
  } catch {
    return { ok: false, error: "DATABASE_URL inválida" };
  }
}

function pushFail(issues, message) {
  issues.push(message);
}

function parseKnownSet(value, fallback) {
  return new Set(
    String(value || fallback)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeSlashes(text) {
  return String(text || "").replace(/\\/g, "/");
}

function validateUploadDir(uploadDirRaw, issues) {
  const uploadDir = normalizeSlashes(uploadDirRaw).replace(/\/+$/, "");
  if (!uploadDir) {
    pushFail(issues, "UPLOAD_DIR ausente");
    return { uploadDir: "", uploadAbs: "" };
  }

  if (uploadDir === "uploads" || uploadDir.startsWith("uploads/production")) {
    pushFail(issues, "uploads apontam para diretório produtivo");
  }

  if (!/\/qa\//i.test(`/${uploadDir}/`) && !/^uploads\/qa\//i.test(uploadDir)) {
    pushFail(issues, "UPLOAD_DIR deve conter namespace QA");
  }

  const relative = uploadDir.replace(/^\/+/, "");
  const segments = relative.split("/").filter(Boolean);
  const qaIndex = segments.findIndex((seg) => seg.toLowerCase() === "qa");
  if (qaIndex < 0 || qaIndex >= segments.length - 1) {
    pushFail(issues, "UPLOAD_DIR deve conter run-id após qa");
  }

  const uploadAbs = path.resolve(projectRoot, relative);
  const prodAbs = path.resolve(projectRoot, "uploads");
  if (uploadAbs === prodAbs) {
    pushFail(issues, "UPLOAD_DIR resolve para diretório produtivo");
  }

  if (fs.existsSync(uploadAbs)) {
    const st = fs.lstatSync(uploadAbs);
    if (st.isSymbolicLink()) {
      pushFail(issues, "Diretório QA de upload não pode ser symlink");
    }
  }

  return { uploadDir, uploadAbs };
}

function checkQaEnvFile(env, issues) {
  const envPath = path.resolve(projectRoot, ".env.qa");
  if (!fs.existsSync(envPath)) {
    pushFail(issues, ".env.qa ausente");
    return { envFileExists: false };
  }

  const mode = fs.statSync(envPath).mode & 0o777;
  if (mode !== 0o600) {
    pushFail(issues, ".env.qa deve ter permissão 600");
  }

  try {
    const out = cp.execSync("git ls-files -- .env.qa", {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (out) {
      pushFail(issues, ".env.qa não pode estar tracked no Git");
    }
  } catch {
    // git pode retornar exit code != 0 quando sem match; ignora
  }

  if (String(env.ENV_FILE_LOADED || "") !== ".env.qa") {
    pushFail(issues, "ENV_FILE_LOADED deve ser .env.qa");
  }

  if (String(env.ENV_SOURCE || "").toLowerCase() !== "qa") {
    pushFail(issues, "ENV_SOURCE deve ser qa");
  }

  return { envFileExists: true };
}

function checkIntegrationEffectiveStates(issues) {
  if (asBool(process.env.WHATSAPP_ENABLED)) pushFail(issues, "WHATSAPP_ENABLED deve ser false em QA");
  if (asBool(process.env.EMAIL_ENABLED)) pushFail(issues, "EMAIL_ENABLED deve ser false em QA");
  if (asBool(process.env.FISCAL_ISSUING_ENABLED)) pushFail(issues, "FISCAL_ISSUING_ENABLED deve ser false em QA");
  if (asBool(process.env.WEBHOOKS_ENABLED)) pushFail(issues, "WEBHOOKS_ENABLED deve ser false em QA");
  if (asBool(process.env.EXTERNAL_NOTIFICATIONS_ENABLED)) pushFail(issues, "EXTERNAL_NOTIFICATIONS_ENABLED deve ser false em QA");

  if (isWhatsAppEnabled()) pushFail(issues, "WhatsApp efetivo deve estar OFF");
  if (isEmailEnabled()) pushFail(issues, "Email efetivo deve estar OFF");
  if (isFiscalIssuingEnabled()) pushFail(issues, "Fiscal efetivo deve estar OFF");
  if (areWebhooksEnabled()) pushFail(issues, "Webhooks efetivo deve estar OFF");
  if (areExternalNotificationsEnabled()) pushFail(issues, "External notifications efetivo deve estar OFF");
}

function printSummary({ db, env, issues, uploadInfo }) {
  const storageId = env.STORAGE_ID || env.STORAGE_BUCKET || env.STORAGE_NAMESPACE || "(missing)";

  console.log(`DB_NAME=${db.dbName || "(missing)"}`);
  console.log(`DB_HOST=${db.host || "(missing)"}`);
  console.log(`DB_PORT=${db.port || "(missing)"}`);
  console.log(`DB_USER=${maskUser(db.user)}`);
  console.log(`DB_SCHEMA=${db.schema || "(missing)"}`);
  console.log(`WHATSAPP_EFFECTIVE=${isWhatsAppEnabled()}`);
  console.log(`EMAIL_EFFECTIVE=${isEmailEnabled()}`);
  console.log(`FISCAL_EFFECTIVE=${isFiscalIssuingEnabled()}`);
  console.log(`WEBHOOKS_EFFECTIVE=${areWebhooksEnabled()}`);
  console.log(`EXTERNAL_NOTIFICATIONS_EFFECTIVE=${areExternalNotificationsEnabled()}`);
  console.log(`UPLOAD_DIR=${uploadInfo.uploadDir || "(missing)"}`);
  console.log(`STORAGE_ID=${storageId}`);

  if (issues.length) {
    console.log("QA_ENVIRONMENT_SAFE=false");
    for (const issue of issues) console.log(`FAIL=${issue}`);
  } else {
    console.log("QA_ENVIRONMENT_SAFE=true");
    console.log("RESULT=SAFE");
  }
}

(function main() {
  const env = process.env;
  const issues = [];

  const db = parseDb(env.DATABASE_URL);
  if (!db.ok) pushFail(issues, db.error);

  if (Number(env.PORT || 0) !== 3102) pushFail(issues, "PORT deve ser 3102");

  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  if (!["qa", "test"].includes(nodeEnv)) pushFail(issues, "NODE_ENV deve ser qa ou test");

  if (!asBool(env.QA_MODE)) pushFail(issues, "QA_MODE deve ser true");

  if (db.ok) {
    if (db.dbName !== "cristal_qa") pushFail(issues, "database name deve ser exatamente cristal_qa");

    const knownProdHosts = parseKnownSet(env.KNOWN_PROD_DB_HOSTS, "aws-0-eu-west-1.pooler.supabase.com");
    const knownProdDbNames = parseKnownSet(env.KNOWN_PROD_DB_NAMES, "cristalwater_production_20260707");
    const knownProdUsers = parseKnownSet(env.KNOWN_PROD_DB_USERS, "postgres.pwgagxzojdftqxkwwbsy");

    if (knownProdHosts.has(db.host)) pushFail(issues, "host coincide com produção conhecida");
    if (knownProdDbNames.has(db.dbName) || /prod|production/i.test(db.dbName)) pushFail(issues, "base coincide com produção conhecida");
    if (knownProdUsers.has(db.user)) pushFail(issues, "username coincide com username de produção");
  }

  const storageId = String(env.STORAGE_ID || env.STORAGE_BUCKET || env.STORAGE_NAMESPACE || "").trim().toLowerCase();
  if (!storageId || !storageId.includes("qa")) {
    pushFail(issues, "storage deve conter identificação QA");
  }

  const uploadInfo = validateUploadDir(env.UPLOAD_DIR, issues);
  checkQaEnvFile(env, issues);
  checkIntegrationEffectiveStates(issues);

  printSummary({ db: db.ok ? db : {}, env, issues, uploadInfo });
  process.exit(issues.length ? 1 : 0);
})();
