#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const safeDirs = ["logs", "temp", ".tmp", ".tmp-npm", ".tmp-prisma"];
const safeFilePatterns = [/^server-.*\.log$/i, /^preview-.*\.log$/i, /^npm-debug\.log$/i];
let removed = 0;

function removePath(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
  removed += 1;
}

for (const dir of safeDirs) {
  removePath(path.join(root, dir));
}

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith(".tmp-")) {
    removePath(path.join(root, entry.name));
    continue;
  }
  if (entry.isFile() && safeFilePatterns.some((pattern) => pattern.test(entry.name))) {
    removePath(path.join(root, entry.name));
  }
}

fs.mkdirSync(path.join(root, "logs"), { recursive: true });
fs.mkdirSync(path.join(root, "temp"), { recursive: true });
fs.mkdirSync(path.join(root, "uploads"), { recursive: true });

console.log(`Limpeza VPS concluida. Artefactos removidos: ${removed}.`);
console.log("Dados reais, uploads e base de dados nao foram apagados.");
