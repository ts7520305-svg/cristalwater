// ==========================================
// CRISTAL WATER - PROJECT DOCTOR v3
// Valida pontos estruturais sem aceder à base de dados.
// ==========================================

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "src");
const schemaPath = path.join(root, "prisma", "schema.prisma");

function walk(dir, files = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function getPrismaModels() {
  if (!fs.existsSync(schemaPath)) return new Set();
  const schema = read(schemaPath);
  return new Set(
    [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) =>
      m[1].charAt(0).toLowerCase() + m[1].slice(1)
    )
  );
}

function checkLocalRequires() {
  const missing = [];
  for (const file of walk(src).filter((f) => f.endsWith(".js"))) {
    const text = read(file);
    const requires = [...text.matchAll(/require\(["'](\.\.?\/[^"']+)["']\)/g)].map((m) => m[1]);
    for (const req of requires) {
      const base = path.resolve(path.dirname(file), req);
      const candidates = [base, `${base}.js`, path.join(base, "index.js")];
      if (!candidates.some((c) => fs.existsSync(c))) {
        missing.push({ file: path.relative(root, file), require: req });
      }
    }
  }
  return missing;
}

function checkPrismaModels() {
  const models = getPrismaModels();
  const used = new Set();
  for (const file of walk(src).filter((f) => f.endsWith(".js"))) {
    const text = read(file);
    for (const match of text.matchAll(/prisma\.([A-Za-z_]\w*)/g)) {
      const name = match[1];
      if (!name.startsWith("$") && name !== "transaction") used.add(name);
    }
  }
  const missing = [...used].filter((name) => !models.has(name)).sort();
  return { totalModels: models.size, totalUsed: used.size, missing };
}

function main() {
  const missingRequires = checkLocalRequires();
  const prisma = checkPrismaModels();

  console.log("Cristal Water Project Doctor v3");
  console.log("--------------------------------");
  console.log("Local requires em falta:", missingRequires.length);
  missingRequires.forEach((item) => console.log(" -", item.file, "=>", item.require));
  console.log("Modelos Prisma no schema:", prisma.totalModels);
  console.log("Modelos Prisma usados no código:", prisma.totalUsed);
  console.log("Modelos Prisma em falta:", prisma.missing.length);
  prisma.missing.forEach((name) => console.log(" -", name));

  if (missingRequires.length || prisma.missing.length) {
    process.exitCode = 1;
  } else {
    console.log("OK estrutural. Agora validar Prisma e base de dados no ambiente real.");
  }
}

main();
