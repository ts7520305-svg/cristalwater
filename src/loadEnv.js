const fs = require("fs");
const path = require("path");

function currentNodeEnv() {
  return String(process.env.NODE_ENV || "production").trim().toLowerCase();
}

function unique(items) {
  return items.filter((item, index) => items.indexOf(item) === index);
}

function resolveEnvPolicy() {
  const env = currentNodeEnv();

  if (env === "qa") {
    return {
      env,
      source: "qa",
      fileName: ".env.qa",
      required: true,
      allowFallback: false,
    };
  }

  if (env === "test") {
    return {
      env,
      source: "test",
      fileName: ".env.test",
      required: false,
      allowFallback: false,
    };
  }

  return {
    env,
    source: "production",
    fileName: ".env",
    required: false,
    allowFallback: true,
  };
}

function resolveEnvFile(policy) {
  const preferred = unique([
    path.resolve(process.cwd(), policy.fileName),
    path.resolve(__dirname, "..", policy.fileName),
  ]);

  const preferredFile = preferred.find((candidate) => fs.existsSync(candidate));
  if (preferredFile) return preferredFile;

  if (policy.required) {
    throw new Error(`Missing required environment file for ${policy.source.toUpperCase()}: ${policy.fileName}`);
  }

  if (!policy.allowFallback) return null;

  const fallback = unique([
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env"),
  ]);

  return fallback.find((candidate) => fs.existsSync(candidate)) || null;
}

function parseEnvFile(file) {
  if (!file) return { parsed: {} };

  const parsed = {};
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
    parsed[key] = value;
  }
  return { parsed };
}

function loadEnv() {
  const policy = resolveEnvPolicy();
  const file = resolveEnvFile(policy);

  try {
    const dotenv = require("dotenv");
    const result = file
      ? dotenv.config({ path: file })
      : { parsed: {} };

    process.env.ENV_SOURCE = policy.source;
    process.env.ENV_FILE_LOADED = file ? path.basename(file) : "none";
    return result;
  } catch (error) {
    if (error?.code !== "MODULE_NOT_FOUND" || !String(error.message || "").includes("dotenv")) {
      throw error;
    }

    const result = parseEnvFile(file);
    process.env.ENV_SOURCE = policy.source;
    process.env.ENV_FILE_LOADED = file ? path.basename(file) : "none";
    return result;
  }
}

module.exports = loadEnv;
module.exports.loadEnv = loadEnv;
