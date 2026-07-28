const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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

function parsePages(args) {
  const single = String(args.page || '').trim();
  if (single) return [single];

  const rawPages = Array.isArray(args.pages) ? args.pages : (typeof args.pages === 'string' ? args.pages.split(',') : []);
  const pages = rawPages.map((p) => String(p || '').trim()).filter(Boolean);
  if (pages.length > 3) {
    throw new Error('Limite excedido: use no maximo 3 paginas por lote.');
  }
  return pages;
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_) {
    return false;
  }
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

function requiredFiles(page) {
  return {
    before: [
      `${page}.before.html`,
      `${page}.before.js`,
      'desktop.png',
      'tablet.png',
      'mobile.png',
      'playwright-before.json',
    ],
    after: [
      `${page}.after.html`,
      `${page}.after.js`,
      'desktop.png',
      'tablet.png',
      'mobile.png',
      'playwright-after.json',
    ],
  };
}

function validatePlaywrightTotals(label, jsonPath) {
  const result = [];
  let report;
  try {
    report = readJson(jsonPath);
  } catch (error) {
    result.push(`${label}: JSON invalido (${error.message})`);
    return result;
  }

  const totals = report.totals || {};

  if (label === 'before') {
    if (Number(totals.checks || 0) !== 3) {
      result.push(`${label}: totals.checks deve ser 3 (atual: ${String(totals.checks)})`);
    }
    const beforeNavigationFields = ['statusNot200', 'navigationErrors'];
    for (const field of beforeNavigationFields) {
      const value = Number(totals[field] || 0);
      if (!Number.isFinite(value) || value !== 0) {
        result.push(`${label}: totals.${field} != 0 (atual: ${String(totals[field])})`);
      }
    }
    return result;
  }

  const requiredZeroFields = [
    'statusNot200',
    'navigationErrors',
    'horizontalScroll',
    'unlabeledVisibleFields',
    'smallOperationalTouchTargets',
    'consoleErrors',
    'failedRequests',
    'httpErrors',
  ];

  for (const field of requiredZeroFields) {
    const value = Number(totals[field] || 0);
    if (!Number.isFinite(value) || value !== 0) {
      result.push(`${label}: totals.${field} != 0 (atual: ${String(totals[field])})`);
    }
  }

  if (Number(totals.checks || 0) !== 3) {
    result.push(`${label}: totals.checks deve ser 3 (atual: ${String(totals.checks)})`);
  }

  return result;
}

function checkPageEvidence(page) {
  const req = requiredFiles(page);
  const problems = [];
  const missingArtifacts = [];

  for (const phase of ['before', 'after']) {
    const baseDir = path.join(EVIDENCE_ROOT, phase, page);
    if (!exists(baseDir)) {
      const msg = `${phase}: pasta ausente (${baseDir})`;
      problems.push(msg);
      missingArtifacts.push(msg);
      continue;
    }

    for (const file of req[phase]) {
      const abs = path.join(baseDir, file);
      if (!exists(abs)) {
        const msg = `${phase}: ficheiro em falta (${path.join('docs', 'product', 'evidence', 'group4', phase, page, file)})`;
        problems.push(msg);
        missingArtifacts.push(msg);
      }
    }
  }

  const beforeJson = path.join(EVIDENCE_ROOT, 'before', page, 'playwright-before.json');
  const afterJson = path.join(EVIDENCE_ROOT, 'after', page, 'playwright-after.json');

  const playwrightProblems = [];
  const beforeExists = exists(beforeJson);
  const afterExists = exists(afterJson);
  if (!beforeExists) playwrightProblems.push('before: playwright-before.json em falta');
  if (!afterExists) playwrightProblems.push('after: playwright-after.json em falta');
  if (beforeExists) playwrightProblems.push(...validatePlaywrightTotals('before', beforeJson));
  if (afterExists) playwrightProblems.push(...validatePlaywrightTotals('after', afterJson));
  problems.push(...playwrightProblems);

  const result = {
    page,
    evidenceComplete: missingArtifacts.length === 0,
    playwrightPass: playwrightProblems.length === 0,
    pass: problems.length === 0,
    missingArtifacts,
    playwrightProblems,
    problems,
  };

  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonOutput = String(args.json || 'false') === 'true';
  const pages = parsePages(args);

  if (pages.length === 0) {
    console.error('Uso: node scripts/verify-page-evidence-completeness.js --page admin-menu [--json true]');
    console.error('Ou: node scripts/verify-page-evidence-completeness.js --pages admin-a admin-b admin-c [--json true]');
    process.exit(1);
  }

  const results = pages.map((page) => checkPageEvidence(page));

  if (jsonOutput) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  }

  const failed = results.filter((r) => r.problems.length > 0);

  if (failed.length > 0) {
    console.error('EVIDENCE_GATE: FAIL');
    for (const result of failed) {
      console.error(`page=${result.page}`);
      for (const p of result.problems) console.error(`- ${p}`);
    }
    process.exit(2);
  }

  console.log('EVIDENCE_GATE: PASS');
  if (pages.length === 1) {
    console.log(`page=${pages[0]}`);
  } else {
    console.log(`pages=${pages.join(',')}`);
  }
  console.log('required artifacts present; BEFORE structural/navigation checks validated; AFTER quality totals validated.');
}

if (require.main === module) {
  main();
}

module.exports = {
  checkPageEvidence,
};
