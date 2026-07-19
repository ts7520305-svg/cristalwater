"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
const defaultUploadRoot = path.join(projectRoot, "uploads");

function normalizeEnv() {
  return String(process.env.NODE_ENV || "production").trim().toLowerCase();
}

function isQaLike() {
  const env = normalizeEnv();
  return env === "qa" || env === "test" || String(process.env.QA_MODE || "").trim().toLowerCase() === "true";
}

function sanitizeRelative(relPath) {
  const normalized = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized) return "";
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((s) => s === "." || s === "..")) {
    throw new Error("UPLOAD_DIR inválido: path traversal não permitido");
  }
  return segments.join("/");
}

function ensureQaUploadPathPolicy(relativePath) {
  if (!relativePath) throw new Error("UPLOAD_DIR obrigatório para QA/test");
  const withSlashes = `/${relativePath.replace(/\\/g, "/")}/`;
  if (!withSlashes.includes("/qa/")) {
    throw new Error("UPLOAD_DIR em QA/test deve conter /qa/");
  }
}

function resolveUploadBaseDir() {
  if (!isQaLike()) {
    return defaultUploadRoot;
  }

  const configured = process.env.UPLOAD_DIR;
  const relativePath = sanitizeRelative(configured);
  ensureQaUploadPathPolicy(relativePath);
  return path.resolve(projectRoot, relativePath);
}

function ensureUploadBaseDirReady() {
  const baseDir = resolveUploadBaseDir();
  if (isQaLike() && String(process.env.QA_ENVIRONMENT_SAFE || "").toLowerCase() !== "true") {
    throw new Error("QA_ENVIRONMENT_SAFE=true obrigatório para criar diretório de upload em QA/test");
  }
  fs.mkdirSync(baseDir, { recursive: true });
  return baseDir;
}

function resolveUploadSubdir(subdir, options = {}) {
  const baseDir = options.ensureBase === false ? resolveUploadBaseDir() : ensureUploadBaseDirReady();
  const cleaned = sanitizeRelative(subdir);
  const target = cleaned ? path.join(baseDir, cleaned) : baseDir;
  if (!target.startsWith(baseDir)) {
    throw new Error("Subdiretório de upload inválido");
  }
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function getUploadsPublicBasePath() {
  return isQaLike() ? "/uploads/qa" : "/uploads";
}

function toPublicUploadUrl(...segments) {
  const base = getUploadsPublicBasePath().replace(/\/+$/, "");
  const safeSegments = segments
    .map((segment) => String(segment || ""))
    .map((segment) => segment.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, ""))
    .filter(Boolean);
  return [base].concat(safeSegments).join("/");
}

module.exports = {
  isQaLike,
  resolveUploadBaseDir,
  ensureUploadBaseDirReady,
  resolveUploadSubdir,
  getUploadsPublicBasePath,
  toPublicUploadUrl,
};
