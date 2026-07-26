const fs = require('fs');
const path = require('path');

const { checkPageEvidence } = require('./verify-page-evidence-completeness');

const ROOT = path.join(__dirname, '..');
const PLAN_PATH = path.join(ROOT, 'docs', 'product', 'GROUP4_EXECUTION_PLAN.md');
const MIGRATION_PATH = path.join(ROOT, 'docs', 'product', 'GROUP4_MIGRATION_REPORT.md');
const AUDIT_PATH = path.join(ROOT, 'docs', 'product', 'GROUP4_ACCEPTANCE_AUDIT.md');
const OUT_PATH = path.join(ROOT, 'docs', 'product', 'GROUP4_PROGRESS_MATRIX.md');
const EVIDENCE_ROOT = path.join(ROOT, 'docs', 'product', 'evidence', 'group4');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);

    if (key === 'pages') {
      const values = [];
      let j = i + 1;
      while (j < argv.length && !argv[j].startsWith('--')) {
        values.push(argv[j]);
        j += 1;
      }
      args[key] = values;
      i = j - 1;
      continue;
    }

    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
    args[key] = value;
    if (value !== 'true') i += 1;
  }
  return args;
}

function parsePagesArg(args) {
  const raw = Array.isArray(args.pages) ? args.pages : (typeof args.pages === 'string' ? args.pages.split(',') : []);
  const pages = raw.map((p) => String(p || '').trim()).filter(Boolean);
  if (pages.length > 3) {
    throw new Error('Limite excedido: use no maximo 3 paginas por lote.');
  }
  return pages;
}

function parsePages(planText) {
  const pages = [];
  const re = /^\d+\.\s+([a-z0-9-]+)\.html\b/gim;
  let m;
  while ((m = re.exec(planText))) {
    pages.push(m[1]);
  }
  return [...new Set(pages)];
}

function hasPageSection(auditText, page) {
  const re = new RegExp(`##\\s+Ciclo\\s+\\d+\\s+-\\s+${page}\\.html([\\s\\S]*?)(?=\\n##\\s+Ciclo|\\n##\\s+Evidencias|\\n##\\s+Pendencias|$)`, 'i');
  const match = auditText.match(re);
  return match ? match[1] : '';
}

function yesNo(value) {
  return value ? 'YES' : 'NO';
}

function statusFor(row) {
  if (row.evidence && row.tests && row.playwright && row.documentation) return 'CERTIFIED';
  if (row.evidence) return 'COMPLETED';
  return row.started ? 'IN_PROGRESS' : 'PENDING';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const focusPages = parsePagesArg(args);
  const planText = fs.readFileSync(PLAN_PATH, 'utf8');
  const migrationText = fs.existsSync(MIGRATION_PATH) ? fs.readFileSync(MIGRATION_PATH, 'utf8') : '';
  const auditText = fs.existsSync(AUDIT_PATH) ? fs.readFileSync(AUDIT_PATH, 'utf8') : '';

  const pages = parsePages(planText);
  const rows = [];

  for (const page of pages) {
    const evidence = checkPageEvidence(page);
    const cycleSection = hasPageSection(auditText, page);
    const inMigrationDoc = migrationText.includes(`${page}.html`) || migrationText.includes(page);
    const inAuditDoc = auditText.includes(`${page}.html`) || auditText.includes(page);

    const testsPass = /Gates de regressao[\s\S]*PASS/i.test(cycleSection);
    const docsUpdated = inMigrationDoc && inAuditDoc;
    const beforeDir = path.join(EVIDENCE_ROOT, 'before', page);
    const beforePlaywright = path.join(beforeDir, 'playwright-before.json');
    const started = fs.existsSync(beforeDir) || fs.existsSync(beforePlaywright);

    const row = {
      page,
      started,
      evidence: evidence.evidenceComplete,
      tests: testsPass,
      playwright: evidence.playwrightPass,
      documentation: docsUpdated,
    };

    row.status = statusFor(row);
    row.certified = row.status === 'CERTIFIED';
    rows.push(row);
  }

  const certifiedCount = rows.filter((r) => r.certified).length;
  const completedCount = rows.filter((r) => r.status === 'COMPLETED').length;
  const inProgressCount = rows.filter((r) => r.status === 'IN_PROGRESS').length;
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length;

  const lines = [];
  lines.push('# GROUP4_PROGRESS_MATRIX');
  lines.push('');
  lines.push(`UpdatedAt: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- totalPages: ${rows.length}`);
  lines.push(`- certified: ${certifiedCount}`);
  lines.push(`- completed: ${completedCount}`);
  lines.push(`- inProgress: ${inProgressCount}`);
  lines.push(`- pending: ${pendingCount}`);
  lines.push('');
  lines.push('## Matrix');
  lines.push('| Page | Status | Evidence | Tests | Playwright | Documentation | Certified |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const row of rows) {
    lines.push(`| ${row.page} | ${row.status} | ${yesNo(row.evidence)} | ${yesNo(row.tests)} | ${yesNo(row.playwright)} | ${yesNo(row.documentation)} | ${yesNo(row.certified)} |`);
  }

  fs.writeFileSync(OUT_PATH, `${lines.join('\n')}\n`);
  console.log(`GROUP4 progress matrix updated: ${path.relative(ROOT, OUT_PATH)}`);

  if (focusPages.length > 0) {
    const focusRows = rows.filter((r) => focusPages.includes(r.page));
    if (focusRows.length === 0) {
      console.log('BATCH_FOCUS: nenhuma pagina encontrada no plano para --pages informado.');
      return;
    }
    console.log('BATCH_FOCUS:');
    for (const row of focusRows) {
      console.log(`- ${row.page}: status=${row.status}, evidence=${yesNo(row.evidence)}, tests=${yesNo(row.tests)}, playwright=${yesNo(row.playwright)}, documentation=${yesNo(row.documentation)}, certified=${yesNo(row.certified)}`);
    }
  }
}

main();
