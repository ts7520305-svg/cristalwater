const fs = require("fs");
const path = require("path");

function fallbackLoadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env"),
  ];
  const file = candidates.find((candidate, index) => candidates.indexOf(candidate) === index && fs.existsSync(candidate));
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
  try {
    return require("dotenv").config();
  } catch (error) {
    if (error?.code !== "MODULE_NOT_FOUND" || !String(error.message || "").includes("dotenv")) {
      throw error;
    }
    return fallbackLoadEnv();
  }
}

module.exports = loadEnv;
module.exports.loadEnv = loadEnv;
