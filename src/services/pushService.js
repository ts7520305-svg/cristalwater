// ==========================================
// CRISTAL WATER - PUSH SERVICE (FCM)
// src/services/pushService.js
// ==========================================
// Segurança v3:
// - Não carrega chaves Firebase reais no arranque.
// - Se a chave não existir, o backend continua a funcionar.
// - A chave real deve ficar fora do ZIP/repositório e ser indicada por
//   FIREBASE_SERVICE_ACCOUNT_PATH no .env.

const fs = require("fs");
const path = require("path");

let admin = null;
let initialized = false;
let warnedMissingConfig = false;

function getServiceAccountPath() {
  return process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.join(__dirname, "../../config/firebase-service-account.json");
}

function initFirebase() {
  if (initialized) return true;

  const serviceAccountPath = getServiceAccountPath();

  if (!fs.existsSync(serviceAccountPath)) {
    if (!warnedMissingConfig) {
      console.warn(
        `[pushService] Firebase não configurado. Ficheiro não encontrado: ${serviceAccountPath}. Push notifications serão ignoradas.`
      );
      warnedMissingConfig = true;
    }
    return false;
  }

  // Import lazy: evita crash no arranque quando push não está configurado.
  admin = require("firebase-admin");

  if (!admin.apps.length) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  initialized = true;
  return true;
}

/**
 * Envia uma push notification.
 * Retorna sempre um resultado estruturado para não rebentar controllers/jobs.
 */
async function sendPush(token, title, body, data = {}) {
  if (!token) {
    return { ok: false, skipped: true, reason: "MISSING_TOKEN" };
  }

  if (!initFirebase()) {
    return { ok: false, skipped: true, reason: "FCM_NOT_CONFIGURED" };
  }

  const message = {
    token,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([key, value]) => [key, String(value ?? "")])
    ),
  };

  try {
    const id = await admin.messaging().send(message);
    return { ok: true, id };
  } catch (error) {
    console.error("[pushService] Erro ao enviar push:", error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  sendPush,
  initFirebase,
};
