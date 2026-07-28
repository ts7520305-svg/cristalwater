const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);

    if (key === 'pages' || key === 'next-pages') {
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

function parsePageList(args, singleKey, listKey) {
  const single = String(args[singleKey] || '').trim();
  if (single) return [single];

  const raw = Array.isArray(args[listKey]) ? args[listKey] : (typeof args[listKey] === 'string' ? args[listKey].split(',') : []);
  const pages = raw.map((p) => String(p || '').trim()).filter(Boolean);
  if (pages.length > 4) {
    throw new Error('Limite excedido: use no maximo 4 paginas por lote.');
  }
  return pages;
}

function runNodeScript(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentPages = parsePageList(args, 'page', 'pages');
  const nextSingle = String(args.next || '').trim();
  const nextPagesRaw = Array.isArray(args['next-pages']) ? args['next-pages'] : (typeof args['next-pages'] === 'string' ? args['next-pages'].split(',') : []);
  const nextPages = nextPagesRaw.map((p) => String(p || '').trim()).filter(Boolean);

  if (currentPages.length === 0) {
    console.error('Uso: node scripts/group5-transition-gate.js --page admin-menu [--next admin-live-map]');
    console.error('Ou: node scripts/group5-transition-gate.js --pages admin-a admin-b admin-c admin-d [--next-pages admin-x admin-y admin-z admin-w]');
    process.exit(1);
  }

  if (nextSingle && Array.isArray(args['next-pages']) && args['next-pages'].length > 0) {
    console.error('Use apenas --next ou --next-pages, nao ambos.');
    process.exit(1);
  }

  if (nextPages.length > 4) {
    console.error('Limite excedido: use no maximo 4 paginas em --next-pages.');
    process.exit(1);
  }

  if (nextPages.length > 0 && nextPages.length !== currentPages.length) {
    console.error(`Quantidade invalida: pages=${currentPages.length} e next-pages=${nextPages.length}.`);
    process.exit(1);
  }

  const verifyArgs = currentPages.length === 1 ? ['--page', currentPages[0]] : ['--pages', ...currentPages];
  const verifier = runNodeScript('scripts/verify-group5-page-evidence-completeness.js', verifyArgs);
  runNodeScript('scripts/update-group5-progress-matrix.js');

  if (verifier.status !== 0) {
    const verb = currentPages.length === 1 ? 'permanece' : 'permanecem';
    console.error(`TRANSITION_BLOCKED: ${currentPages.join(',')} ${verb} IN_PROGRESS (evidence gate FAIL).`);
    console.error('Nao iniciar a pagina seguinte ate EVIDENCE_GATE: PASS.');
    process.exit(2);
  }

  if (currentPages.length === 1) {
    console.log(`TRANSITION_ALLOWED: ${currentPages[0]} pode ser marcado como COMPLETED/CERTIFIED.`);
  } else {
    console.log(`TRANSITION_ALLOWED: ${currentPages.join(',')} podem ser marcadas como COMPLETED/CERTIFIED.`);
  }
  if (nextSingle) {
    console.log(`NEXT_PAGE_ALLOWED: ${nextSingle}`);
  }

  if (nextPages.length > 0) {
    console.log(`NEXT_PAGES_ALLOWED: ${nextPages.join(',')}`);
  }
}

main();
