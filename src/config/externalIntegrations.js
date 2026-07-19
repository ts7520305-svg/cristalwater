"use strict";

function isTrue(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function currentEnv() {
  return String(process.env.NODE_ENV || "production").trim().toLowerCase();
}

function isQaOrTestRuntime() {
  const env = currentEnv();
  return env === "qa" || env === "test";
}

function isQaMode() {
  return isTrue(process.env.QA_MODE);
}

function resolveFeatureFlag(envVarName, defaultInProd = true) {
  const envValue = process.env[envVarName];

  if (isQaMode()) return false;

  if (isQaOrTestRuntime()) {
    return String(envValue || "").trim().toLowerCase() === "true";
  }

  if (envValue === undefined) return defaultInProd;
  return String(envValue).trim().toLowerCase() === "true";
}

function isWhatsAppEnabled() {
  return resolveFeatureFlag("WHATSAPP_ENABLED", true);
}

function isEmailEnabled() {
  return resolveFeatureFlag("EMAIL_ENABLED", true);
}

function isFiscalIssuingEnabled() {
  return resolveFeatureFlag("FISCAL_ISSUING_ENABLED", true);
}

function areWebhooksEnabled() {
  return resolveFeatureFlag("WEBHOOKS_ENABLED", true);
}

function areExternalNotificationsEnabled() {
  return resolveFeatureFlag("EXTERNAL_NOTIFICATIONS_ENABLED", true);
}

function integrationByType(type) {
  const key = String(type || "").trim().toLowerCase();
  switch (key) {
    case "whatsapp":
      return { enabled: isWhatsAppEnabled(), name: "whatsapp" };
    case "email":
      return { enabled: isEmailEnabled(), name: "email" };
    case "fiscal":
    case "fiscal_issuing":
      return { enabled: isFiscalIssuingEnabled(), name: "fiscal_issuing" };
    case "webhook":
    case "webhooks":
      return { enabled: areWebhooksEnabled(), name: "webhooks" };
    case "external_notifications":
      return { enabled: areExternalNotificationsEnabled(), name: "external_notifications" };
    default:
      return { enabled: false, name: key || "unknown" };
  }
}

function buildBlockedState(type) {
  const normalized = integrationByType(type).name;
  return {
    ok: false,
    allowed: false,
    type: normalized,
    code: "disabled_in_qa",
    reason: "disabled_in_qa",
    statusCode: 503,
  };
}

function assertExternalOperationAllowed(type) {
  const state = integrationByType(type);
  if (state.enabled) {
    return {
      ok: true,
      allowed: true,
      type: state.name,
      code: "enabled",
    };
  }

  const blocked = buildBlockedState(type);
  const err = new Error(blocked.reason);
  err.code = blocked.code;
  err.statusCode = blocked.statusCode;
  err.integration = blocked.type;
  throw err;
}

module.exports = {
  isWhatsAppEnabled,
  isEmailEnabled,
  isFiscalIssuingEnabled,
  areWebhooksEnabled,
  areExternalNotificationsEnabled,
  assertExternalOperationAllowed,
  buildBlockedState,
};
