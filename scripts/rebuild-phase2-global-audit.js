const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const AUDIT_PATH = path.join(ROOT, "docs", "product", "phase2-global-audit-93-pages.json");
const MD_PATH = path.join(ROOT, "docs", "product", "PHASE2_GLOBAL_AUDIT_93_PAGES_20260714.md");
const LOTE_G_REPORT_PATH = path.join(ROOT, "docs", "product", "PHASE2_LOTE_G_REPORT_20260714.md");
const LOTE_G_VALIDATION_PATH = path.join(ROOT, "docs", "product", "screenshots", "phase2-lote-g", "validation-report.json");

const TARGET_PAGES = [
  "billing-extras.html",
  "settings.html",
  "admin-dashboard.html",
  "admin-map.html",
  "admin-live-map.html",
  "admin-priority.html",
  "admin-alerts.html",
  "incident-center.html",
  "operational-dashboard.html",
  "route-map.html",
  "dashboard.html",
  "map.html",
  "multi-map.html",
  "profit-map.html",
  "client-history.html",
  "client-menu.html",
  "client-notifications.html",
  "client-payments.html",
  "client-wow.html",
  "client.html",
  "client_chat.html",
  "client_tech.html",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function pageFile(page) {
  return path.join(ROOT, "frontend", page);
}

function normalizePageState(page, auditEntry) {
  const text = readText(pageFile(page));
  const foundationCss = text.includes("/ui/foundation.css");
  const backNavigationPresent = text.includes("data-cw-back");
  const contextPreservationPresent = text.includes("/ui/core/navigation-context.js");
  const guardCorrect = Boolean(auditEntry.guardCorrect);
  const legacyCssImported = Array.isArray(auditEntry.legacyCssImported) ? auditEntry.legacyCssImported : [];
  const inlineCssExisting = Boolean(auditEntry.inlineCssExisting);

  return {
    ...auditEntry,
    foundationCss,
    backNavigationPresent,
    contextPreservationPresent,
    guardCorrect,
    legacyCssImported,
    inlineCssExisting,
  };
}

function buildMarkdown(audit, validation) {
  const pages = audit.pages;
  const summary = audit.summary;
  const p0Remaining = summary.p0Pages.filter((page) => {
    const item = pages.find((entry) => entry.page === page);
    return !item || !item.foundationCss || !item.backNavigationPresent || !item.contextPreservationPresent || !item.guardCorrect;
  });

  const lines = [];
  lines.push("# Fase 2 - Auditoria Global das 93 Páginas");
  lines.push("");
  lines.push("Data: 2026-07-14");
  lines.push("");
  lines.push("## Resumo");
  lines.push(`- Total de páginas: ${summary.totalPages}`);
  lines.push(`- Total que usa foundation.css: ${summary.totalUsesFoundationCss}`);
  lines.push(`- Total ainda sem foundation.css: ${summary.totalWithoutFoundationCss}`);
  lines.push(`- Total com CSS legado: ${summary.totalWithLegacyCss}`);
  lines.push(`- Total com CSS inline: ${summary.totalWithInlineCss}`);
  lines.push(`- Total sem guard correto: ${summary.totalWithoutCorrectGuard}`);
  lines.push(`- Total sem Voltar: ${summary.totalWithoutBack}`);
  lines.push(`- Total sem preservação de contexto: ${summary.totalWithoutContextPreservation}`);
  lines.push(`- Total com ações de escrita: ${summary.totalWithWriteActions}`);
  lines.push("");
  lines.push("## Lote G");
  lines.push(`- Screenshots geradas: ${validation?.totals?.totalScreenshots ?? 0}`);
  lines.push(`- Checks executados: ${validation?.totals?.totalChecks ?? 0}`);
  lines.push(`- Foundation em falta no lote G: ${validation?.totals?.foundationMissing ?? 0}`);
  lines.push(`- Guard incorreto no lote G: ${validation?.totals?.guardMismatch ?? 0}`);
  lines.push(`- Voltar em falta no lote G: ${validation?.totals?.backMissing ?? 0}`);
  lines.push(`- Contexto em falta no lote G: ${validation?.totals?.contextMissing ?? 0}`);
  lines.push("");
  lines.push("## Páginas P0");
  lines.push(summary.p0Pages.join(", ") || "-");
  lines.push("");
  lines.push("## Páginas P0 restantes");
  lines.push(p0Remaining.join(", ") || "-");
  lines.push("");
  lines.push("## Páginas sem foundation.css");
  lines.push(pages.filter((page) => !page.foundationCss).map((page) => page.page).join(", ") || "-");
  lines.push("");
  lines.push("## Páginas sem Voltar");
  lines.push(pages.filter((page) => !page.backNavigationPresent).map((page) => page.page).join(", ") || "-");
  lines.push("");
  lines.push("## Páginas sem preservação de contexto");
  lines.push(pages.filter((page) => !page.contextPreservationPresent).map((page) => page.page).join(", ") || "-");
  lines.push("");
  lines.push("## Páginas sem guard correto");
  lines.push(pages.filter((page) => !page.guardCorrect).map((page) => page.page).join(", ") || "-");
  lines.push("");
  lines.push("## Observação");
  lines.push("Auditoria global concluída; pronta a definir os lotes finais de migração.");
  return lines.join("\n");
}

function main() {
  const audit = readJson(AUDIT_PATH);
  const validation = fs.existsSync(LOTE_G_VALIDATION_PATH) ? readJson(LOTE_G_VALIDATION_PATH) : null;

  audit.pages = audit.pages.map((entry) => {
    if (!TARGET_PAGES.includes(entry.page)) return entry;
    return normalizePageState(entry.page, entry);
  });

  audit.summary.totalPages = audit.pages.length;
  audit.summary.totalUsesFoundationCss = audit.pages.filter((page) => page.foundationCss).length;
  audit.summary.totalWithoutFoundationCss = audit.pages.filter((page) => !page.foundationCss).length;
  audit.summary.totalWithLegacyCss = audit.pages.filter((page) => Array.isArray(page.legacyCssImported) && page.legacyCssImported.length > 0).length;
  audit.summary.totalWithInlineCss = audit.pages.filter((page) => Boolean(page.inlineCssExisting)).length;
  audit.summary.totalWithoutCorrectGuard = audit.pages.filter((page) => !page.guardCorrect).length;
  audit.summary.totalWithoutBack = audit.pages.filter((page) => !page.backNavigationPresent).length;
  audit.summary.totalWithoutContextPreservation = audit.pages.filter((page) => !page.contextPreservationPresent).length;
  audit.summary.totalWithWriteActions = audit.pages.filter((page) => Boolean(page.writeActionsExisting)).length;

  audit.summary.pagesStillToMigrate = audit.pages
    .filter((page) => !page.foundationCss || !page.guardCorrect || !page.backNavigationPresent || !page.contextPreservationPresent)
    .map((page) => page.page)
    .sort();

  writeJson(AUDIT_PATH, audit);
  fs.writeFileSync(MD_PATH, buildMarkdown(audit, validation));

  const loteGReport = [
    "# Lote G - Relatório de Prova",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "## Resumo",
    `- Screenshots esperadas: 88`,
    `- Screenshots geradas: ${validation?.totals?.totalScreenshots ?? 0}`,
    `- Checks executados: ${validation?.totals?.totalChecks ?? 0}`,
    `- Foundation em falta no lote: ${validation?.totals?.foundationMissing ?? 0}`,
    `- Guard incorreto no lote: ${validation?.totals?.guardMismatch ?? 0}`,
    `- Voltar em falta no lote: ${validation?.totals?.backMissing ?? 0}`,
    `- Contexto em falta no lote: ${validation?.totals?.contextMissing ?? 0}`,
    `- Scroll horizontal: ${validation?.totals?.horizontalScroll ?? 0}`,
    `- Texto cortado: ${validation?.totals?.clippedText ?? 0}`,
    `- Cabeçalhos truncados: ${validation?.totals?.truncatedHeading ?? 0}`,
    `- Navegação duplicada: ${validation?.totals?.duplicateNavigation ?? 0}`,
    `- Segredos visíveis: ${validation?.totals?.visibleSecrets ?? 0}`,
    `- Erros de navegação: ${validation?.totals?.navigationErrors ?? 0}`,
    `- Erros reais de consola: ${validation?.totals?.consoleErrors ?? 0}`,
    `- Failed requests: ${validation?.totals?.failedRequests ?? 0}`,
    `- API sem Authorization: ${validation?.totals?.apiWithoutAuthorization ?? 0}`,
    "",
    "## Páginas P0 restantes",
    audit.summary.p0Pages.filter((page) => audit.pages.find((entry) => entry.page === page && (!entry.foundationCss || !entry.backNavigationPresent || !entry.contextPreservationPresent || !entry.guardCorrect))).join(", ") || "-",
    "",
    "## Lista exacta sem foundation.css",
    audit.pages.filter((page) => !page.foundationCss).map((page) => page.page).join(", ") || "-",
    "",
    "## Lista exacta sem Voltar",
    audit.pages.filter((page) => !page.backNavigationPresent).map((page) => page.page).join(", ") || "-",
    "",
    "## Lista exacta sem preservação de contexto",
    audit.pages.filter((page) => !page.contextPreservationPresent).map((page) => page.page).join(", ") || "-",
    "",
    "## Lista exacta sem guard correto",
    audit.pages.filter((page) => !page.guardCorrect).map((page) => page.page).join(", ") || "-",
    "",
    "Frase final obrigatória:",
    "Lote G migrado para a fundação visual comum; refinamento premium final pendente.",
  ].join("\n");

  fs.writeFileSync(LOTE_G_REPORT_PATH, loteGReport);
  console.log("Auditoria global e relatório do Lote G regenerados.");
}

main();