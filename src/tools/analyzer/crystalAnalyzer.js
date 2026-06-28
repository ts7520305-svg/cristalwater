const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function walk(dir, ext = ".js") {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, ext);
    return full.endsWith(ext) ? [full] : [];
  });
}

function lines(file) {
  return fs.readFileSync(file, "utf8").split("\n").length;
}

function countPrismaModels() {
  const schema = path.join(ROOT, "prisma/schema.prisma");
  if (!fs.existsSync(schema)) return 0;
  const text = fs.readFileSync(schema, "utf8");
  return (text.match(/^model\s+/gm) || []).length;
}

function analyze() {
  const controllers = walk("src/controllers");
  const routes = walk("src/routes");
  const services = walk("src/services");
  const business = walk("src/business");
  const dal = walk("src/dal");
  const system = walk("src/system");
  const frontendJs = walk("frontend");
  const frontendHtml = walk("frontend", ".html");

  const largeFiles = [
    ...controllers,
    ...routes,
    ...services,
    ...business,
    ...dal,
    ...system,
    ...frontendJs,
  ]
    .map((file) => ({ file, lines: lines(file) }))
    .filter((x) => x.lines > 500)
    .sort((a, b) => b.lines - a.lines);

  const report = {
    ok: true,
    project: "Cristal Water / Crystal Platform",
    checkedAt: new Date().toISOString(),
    counts: {
      controllers: controllers.length,
      routes: routes.length,
      services: services.length,
      business: business.length,
      dal: dal.length,
      system: system.length,
      frontendHtml: frontendHtml.length,
      frontendJs: frontendJs.length,
      prismaModels: countPrismaModels(),
    },
    largeFiles,
  };

  return report;
}

const report = analyze();

fs.writeFileSync(
  "reports/crystal-analyzer-report.json",
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
