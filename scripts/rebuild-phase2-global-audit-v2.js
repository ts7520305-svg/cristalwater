const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const AUDIT_PATH = path.join(ROOT, "docs", "product", "phase2-global-audit-93-pages.json");
const AUDIT_MD_PATH = path.join(ROOT, "docs", "product", "PHASE2_GLOBAL_AUDIT_93_PAGES_20260714.md");
const LOTE_G_VALIDATION_PATH = path.join(ROOT, "docs", "product", "screenshots", "phase2-lote-g", "validation-report.json");
const LOTE_H_VALIDATION_PATH = path.join(ROOT, "docs", "product", "screenshots", "phase2-lote-h", "validation-report.json");
const LOTE_H_REPORT_PATH = path.join(ROOT, "docs", "product", "PHASE2_LOTE_H_REPORT_20260714.md");

const GUARD_EXPECTED_BY_PAGE = {
  "alerts.html": "ADMIN",
  "client-wow.html": "CLIENT",
  "technician-profit-dashboard.html": "TECHNICIAN",
  "technician-profit.html": "TECHNICIAN",
  "settings.html": "CLIENT",
};

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

function bodyTag(html) {
  return (html.match(/<body[^>]*>/i) || [""])[0];
}

function normalizeRole(value) {
  const role = String(value || "").toUpperCase();
  if (role.includes("CLIENT")) return "CLIENT";
  if (role.includes("TECH")) return "TECHNICIAN";
  if (role.includes("ADMIN")) return "ADMIN";
  return "ADMIN";
}

function expectedGuardScript(role) {
  if (role === "CLIENT") return "/client-auth-guard.js";
  if (role === "TECHNICIAN") return "/technician-auth-guard.js";
  return "/admin-auth-guard.js";
}

function inferExpectedRole(entry) {
  if (GUARD_EXPECTED_BY_PAGE[entry.page]) return GUARD_EXPECTED_BY_PAGE[entry.page];
  if (/^technician-/i.test(entry.page)) return "TECHNICIAN";
  if (/^client-/i.test(entry.page) || entry.page === "client.html") return "CLIENT";
  return normalizeRole(entry.profile);
}

function inferGuardCorrect(entry, html) {
  const expected = inferExpectedRole(entry);
  return html.includes(expectedGuardScript(expected));
}

function detectFoundationCss(html) {
  return /href\s*=\s*['\"][^'\"]*\/ui\/foundation\.css(?:\?[^'\"]*)?['\"]/i.test(html);
}

function detectBackNavigation(html) {
  return /data-cw-back\b/i.test(html) || /data-cw-action\s*=\s*['\"]back['\"]/i.test(html);
}

function detectContextPreservation(html) {
  return /src\s*=\s*['\"][^'\"]*\/ui\/core\/navigation-context\.js(?:\?[^'\"]*)?['\"]/i.test(html);
}

function legacyToCanonical(entry) {
  const foundationCss = typeof entry.foundationCss === "boolean"
    ? entry.foundationCss
    : Boolean(entry.foundationCssPresent);

  const backNavigationPresent = typeof entry.backNavigationPresent === "boolean"
    ? entry.backNavigationPresent
    : Boolean(entry.hasVoltarButton || entry.hasBackControl);

  const contextPreservationPresent = typeof entry.contextPreservationPresent === "boolean"
    ? entry.contextPreservationPresent
    : Boolean(entry.hasNavigationContext);

  const guardCorrect = typeof entry.guardCorrect === "boolean"
    ? entry.guardCorrect
    : Boolean(entry.guardScript);

  return {
    foundationCss,
    backNavigationPresent,
    contextPreservationPresent,
    guardCorrect,
  };
}

function formatBooleanCell(value) {
  return value ? "OK" : "MISSING";
}

function normalizeEntry(entry) {
  const filePath = pageFile(entry.page);
  const canonical = legacyToCanonical(entry);
  if (!fs.existsSync(filePath)) {
    return {
      ...entry,
      ...canonical,
      foundationCssPresent: canonical.foundationCss,
      hasBackControl: canonical.backNavigationPresent,
      hasNavigationContext: canonical.contextPreservationPresent,
      hasVoltarButton: canonical.backNavigationPresent,
    };
  }

  const html = readText(filePath);
  const foundationCss = detectFoundationCss(html);
  const backNavigationPresent = detectBackNavigation(html);
  const contextPreservationPresent = detectContextPreservation(html);
  const guardCorrect = inferGuardCorrect(entry, html);
  const expectedRole = inferExpectedRole(entry);

  return {
    ...entry,
    foundationCss,
    backNavigationPresent,
    contextPreservationPresent,
    guardPresent: {
      admin: html.includes("/admin-auth-guard.js"),
      technician: html.includes("/technician-auth-guard.js"),
      client: html.includes("/client-auth-guard.js"),
    },
    guardExpectedRole: expectedRole,
    guardCorrect,
    foundationCssPresent: foundationCss,
    hasBackControl: backNavigationPresent,
    hasNavigationContext: contextPreservationPresent,
    hasVoltarButton: backNavigationPresent,
  };
}

function p0Remaining(audit) {
  const pages = audit.pages;
  return (audit.summary.p0Pages || []).filter((page) => {
    const item = pages.find((entry) => entry.page === page);
    return !item || !item.foundationCss || !item.backNavigationPresent || !item.contextPreservationPresent || !item.guardCorrect;
  });
}

function updateSummary(audit) {
  const pages = audit.pages;
  audit.summary.totalPages = pages.length;
  audit.summary.totalUsesFoundationCss = pages.filter((page) => page.foundationCss).length;
  audit.summary.totalWithoutFoundationCss = pages.filter((page) => !page.foundationCss).length;
  audit.summary.totalWithLegacyCss = pages.filter((page) => Array.isArray(page.legacyCssImported) && page.legacyCssImported.length > 0).length;
  audit.summary.totalWithInlineCss = pages.filter((page) => Boolean(page.inlineCssExisting)).length;
  audit.summary.totalWithoutCorrectGuard = pages.filter((page) => !page.guardCorrect).length;
  audit.summary.totalWithoutBack = pages.filter((page) => !page.backNavigationPresent).length;
  audit.summary.totalWithoutContextPreservation = pages.filter((page) => !page.contextPreservationPresent).length;
  audit.summary.totalWithWriteActions = pages.filter((page) => Boolean(page.writeActionsExisting)).length;

  audit.summary.pagesStillToMigrate = pages
    .filter((page) => !page.foundationCss || !page.guardCorrect || !page.backNavigationPresent || !page.contextPreservationPresent)
    .map((page) => page.page)
    .sort();
}

function buildAuditMarkdown(audit, loteGValidation, loteHValidation) {
  const pages = audit.pages;
  const summary = audit.summary;
  const p0 = p0Remaining(audit);

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
  lines.push(`- Screenshots geradas: ${loteGValidation?.totals?.totalScreenshots ?? 0}`);
  lines.push(`- Checks executados: ${loteGValidation?.totals?.totalChecks ?? 0}`);
  lines.push("");
  lines.push("## Lote H");
  lines.push(`- Screenshots geradas: ${loteHValidation?.totals?.totalScreenshots ?? 0}`);
  lines.push(`- Checks executados: ${loteHValidation?.totals?.totalChecks ?? 0}`);
  lines.push(`- Foundation em falta no lote H: ${loteHValidation?.totals?.foundationMissing ?? 0}`);
  lines.push(`- Guard incorreto no lote H: ${loteHValidation?.totals?.guardMismatch ?? 0}`);
  lines.push(`- Voltar em falta no lote H: ${loteHValidation?.totals?.backMissing ?? 0}`);
  lines.push(`- Contexto em falta no lote H: ${loteHValidation?.totals?.contextMissing ?? 0}`);
  lines.push("");
  lines.push("## Páginas P0");
  lines.push((summary.p0Pages || []).join(", ") || "-");
  lines.push("");
  lines.push("## Páginas P0 restantes");
  lines.push(p0.join(", ") || "-");
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
  lines.push("Auditoria global regenerada com medição por HTML-fonte e propriedades canônicas.");

  return lines.join("\n");
}

function buildLoteHReport(audit, validation) {
  const pages = audit.pages;
  const remainingP0 = p0Remaining(audit);
  const htmlTable = Array.isArray(validation?.htmlComplianceTable) ? validation.htmlComplianceTable : [];

  const matrixLines = [
    "| página | foundation | guard | voltar | contexto |",
    "|---|---|---|---|---|",
  ];
  for (const row of htmlTable) {
    matrixLines.push(
      `| ${row.page} | ${formatBooleanCell(row.foundationCss)} | ${formatBooleanCell(row.guardCorrect)} | ${formatBooleanCell(row.backNavigationPresent)} | ${formatBooleanCell(row.contextPreservationPresent)} |`
    );
  }

  return [
    "# Lote H - Relatório de Prova",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "## Resumo",
    `- Screenshots esperadas: 60`,
    `- Screenshots geradas: ${validation?.totals?.totalScreenshots ?? 0}`,
    `- Checks executados (todos os cenários): ${validation?.totals?.totalChecks ?? 0}`,
    `- Checks visuais (apenas sessão válida): ${validation?.totals?.visualChecks ?? 0}`,
    `- Foundation em falta no lote: ${validation?.totals?.foundationMissing ?? 0}`,
    `- Guard incorreto no lote: ${validation?.totals?.guardMismatch ?? 0}`,
    `- Voltar em falta no lote: ${validation?.totals?.backMissing ?? 0}`,
    `- Contexto em falta no lote: ${validation?.totals?.contextMissing ?? 0}`,
    `- Scroll horizontal: ${validation?.totals?.horizontalScroll ?? 0}`,
    `- Texto cortado: ${validation?.totals?.clippedText ?? 0}`,
    `- Cabeçalhos truncados: ${validation?.totals?.truncatedHeading ?? 0}`,
    `- Navegação duplicada: ${validation?.totals?.duplicateNavigation ?? 0}`,
    `- Erros reais de consola: ${validation?.totals?.consoleErrors ?? 0}`,
    `- Failed requests: ${validation?.totals?.failedRequests ?? 0}`,
    `- API sem Authorization: ${validation?.totals?.apiWithoutAuthorization ?? 0}`,
    "",
    "## Estado Global Após Lote H",
    `- P0 restantes: ${remainingP0.length}`,
    `- Total sem foundation.css: ${audit.summary.totalWithoutFoundationCss}`,
    `- Total sem Voltar: ${audit.summary.totalWithoutBack}`,
    `- Total sem preservação de contexto: ${audit.summary.totalWithoutContextPreservation}`,
    `- Total sem guard correto: ${audit.summary.totalWithoutCorrectGuard}`,
    "",
    "## Matriz HTML Validada (15 páginas do Lote H)",
    ...(matrixLines.length > 2 ? matrixLines : ["- Não disponível"]),
    "",
    "## Cenários Negativos (separados da validação visual)",
    ...((validation?.totals?.negativeScenarios || []).map((item) =>
      `- ${item.scenario}: checks=${item.totalChecks}, redirects=${item.redirects}, redirectsToLogin=${item.redirectsToLogin}, navigationErrors=${item.navigationErrors}`
    )),
    "",
    "## Lista exacta sem foundation.css",
    pages.filter((page) => !page.foundationCss).map((page) => page.page).join(", ") || "-",
    "",
    "## Lista exacta sem Voltar",
    pages.filter((page) => !page.backNavigationPresent).map((page) => page.page).join(", ") || "-",
    "",
    "## Lista exacta sem preservação de contexto",
    pages.filter((page) => !page.contextPreservationPresent).map((page) => page.page).join(", ") || "-",
    "",
    "## Lista exacta sem guard correto",
    pages.filter((page) => !page.guardCorrect).map((page) => page.page).join(", ") || "-",
    "",
    "Frase final obrigatória:",
    "Lote H migrado para a fundação visual comum; refinamento premium final pendente.",
  ].join("\n");
}

function main() {
  const audit = readJson(AUDIT_PATH);
  const loteGValidation = fs.existsSync(LOTE_G_VALIDATION_PATH) ? readJson(LOTE_G_VALIDATION_PATH) : null;
  const loteHValidation = fs.existsSync(LOTE_H_VALIDATION_PATH) ? readJson(LOTE_H_VALIDATION_PATH) : null;

  audit.pages = audit.pages.map((entry) => normalizeEntry(entry));
  updateSummary(audit);

  writeJson(AUDIT_PATH, audit);
  fs.writeFileSync(AUDIT_MD_PATH, buildAuditMarkdown(audit, loteGValidation, loteHValidation));
  fs.writeFileSync(LOTE_H_REPORT_PATH, buildLoteHReport(audit, loteHValidation));

  console.log("Auditoria global e relatório do Lote H regenerados.");
}

main();
