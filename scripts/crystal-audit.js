const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports", "crystal-os");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full.replace(ROOT + path.sep, ""));
  }
  return out.sort();
}

function read(file) {
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function grepFiles(files, terms) {
  return files.filter((file) => {
    const content = read(path.join(ROOT, file)).toLowerCase();
    return terms.some((term) => content.includes(term.toLowerCase()));
  });
}

function moduleSummary(name, terms, allFiles) {
  const files = allFiles.filter((file) => {
    const lower = file.toLowerCase();
    return terms.some((term) => lower.includes(term.toLowerCase()));
  });

  const prismaUsage = grepFiles(allFiles, terms.map((t) => `prisma.${t}`));

  return {
    name,
    files: files.length,
    filesList: files,
    prismaUsage: prismaUsage.length,
    status:
      files.length >= 10 ? "EXISTS_HEAVY" :
      files.length >= 3 ? "EXISTS" :
      files.length > 0 ? "PARTIAL" :
      "MISSING",
  };
}

function extractPrismaModels() {
  const schema = read(path.join(ROOT, "prisma", "schema.prisma"));
  return schema
    .split("\n")
    .filter((line) => line.trim().startsWith("model "))
    .map((line) => line.trim().replace("model ", "").split(" ")[0]);
}

function detectRouteControllerPairs(routes, controllers) {
  const routeNames = routes.map((r) => path.basename(r).replace("Routes.js", "").replace("Route.js", ""));
  const controllerNames = controllers.map((c) => path.basename(c).replace("Controller.js", ""));
  return {
    routesWithoutObviousController: routeNames.filter((r) => !controllerNames.some((c) => c.toLowerCase().includes(r.toLowerCase()))),
    controllersWithoutObviousRoute: controllerNames.filter((c) => !routeNames.some((r) => r.toLowerCase().includes(c.toLowerCase()))),
  };
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const srcFiles = walk(path.join(ROOT, "src"));
  const frontendFiles = walk(path.join(ROOT, "frontend"));
  const prismaFiles = walk(path.join(ROOT, "prisma"));
  const routes = srcFiles.filter((f) => f.includes("src/routes/"));
  const controllers = srcFiles.filter((f) => f.includes("src/controllers/"));
  const services = srcFiles.filter((f) => f.includes("src/services/"));
  const business = srcFiles.filter((f) => f.includes("src/business/"));
  const core = srcFiles.filter((f) => f.includes("src/core/"));

  const modules = [
    moduleSummary("Core", ["core", "kernel", "event", "workflow", "state", "permission"], srcFiles),
    moduleSummary("Clientes", ["client", "customer"], srcFiles.concat(frontendFiles)),
    moduleSummary("Piscinas", ["pool"], srcFiles.concat(frontendFiles)),
    moduleSummary("Técnicos", ["technician"], srcFiles.concat(frontendFiles)),
    moduleSummary("Visitas", ["visit", "serviceVisit"], srcFiles.concat(frontendFiles)),
    moduleSummary("Rotas", ["route", "round"], srcFiles.concat(frontendFiles)),
    moduleSummary("Equipamentos", ["equipment"], srcFiles.concat(frontendFiles)),
    moduleSummary("Stock", ["stock", "product"], srcFiles.concat(frontendFiles)),
    moduleSummary("Financeiro", ["billing", "invoice", "payment"], srcFiles.concat(frontendFiles)),
    moduleSummary("Portal Cliente", ["portal", "clientPortal"], srcFiles.concat(frontendFiles)),
    moduleSummary("Dashboard", ["dashboard", "stats"], srcFiles.concat(frontendFiles)),
    moduleSummary("IA", ["ai", "brain", "agent"], srcFiles.concat(frontendFiles)),
  ];

  const pairs = detectRouteControllerPairs(routes, controllers);

  const audit = {
    generatedAt: new Date().toISOString(),
    totals: {
      srcFiles: srcFiles.length,
      frontendFiles: frontendFiles.length,
      prismaFiles: prismaFiles.length,
      routes: routes.length,
      controllers: controllers.length,
      services: services.length,
      business: business.length,
      core: core.length,
      prismaModels: extractPrismaModels().length,
    },
    prismaModels: extractPrismaModels(),
    modules,
    risks: {
      routesWithoutObviousController: pairs.routesWithoutObviousController,
      controllersWithoutObviousRoute: pairs.controllersWithoutObviousRoute,
    },
    nextSprints: [
      "Technician OS",
      "Visit OS",
      "Route OS",
      "Equipment OS",
      "Stock OS",
      "Finance OS",
      "Customer OS",
      "Dashboard OS",
      "Crystal Brain",
    ],
  };

  fs.writeFileSync(
    path.join(REPORT_DIR, "crystal-audit.json"),
    JSON.stringify(audit, null, 2)
  );

  const md = [];
  md.push("# Crystal OS Audit");
  md.push("");
  md.push(`Gerado em: ${audit.generatedAt}`);
  md.push("");
  md.push("## Totais");
  md.push("");
  for (const [key, value] of Object.entries(audit.totals)) {
    md.push(`- ${key}: ${value}`);
  }
  md.push("");
  md.push("## Módulos");
  md.push("");
  md.push("| Módulo | Ficheiros | Prisma Usage | Estado |");
  md.push("|---|---:|---:|---|");
  for (const mod of modules) {
    md.push(`| ${mod.name} | ${mod.files} | ${mod.prismaUsage} | ${mod.status} |`);
  }
  md.push("");
  md.push("## Próximas Sprints");
  md.push("");
  audit.nextSprints.forEach((sprint, index) => md.push(`${index + 1}. ${sprint}`));
  md.push("");
  md.push("## Riscos Detectados");
  md.push("");
  md.push(`- Rotas sem controller óbvio: ${pairs.routesWithoutObviousController.length}`);
  md.push(`- Controllers sem rota óbvia: ${pairs.controllersWithoutObviousRoute.length}`);
  md.push("");

  fs.writeFileSync(path.join(REPORT_DIR, "CRYSTAL_OS_AUDIT.md"), md.join("\n"));

  console.log("Crystal OS Audit gerado com sucesso.");
  console.log(`JSON: reports/crystal-os/crystal-audit.json`);
  console.log(`Markdown: reports/crystal-os/CRYSTAL_OS_AUDIT.md`);
}

main();
