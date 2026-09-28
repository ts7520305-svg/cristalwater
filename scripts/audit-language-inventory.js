'use strict';
// Static, read-only inventory. No application page or API is executed.
// --write records a versioned snapshot; --check checks the snapshot's source hashes and invariants.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const stem = 'docs/product/LANGUAGE_INVENTORY_20260928';
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => String(value).replace(/\s+/g, ' ').trim();
const property = node => node?.type === 'Identifier' ? node.name : node?.value;
const literal = node => node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
const lineAt = (source, offset) => source.slice(0, offset).split('\n').length;
const tracked = () => execFileSync('git', ['ls-files', '-z', '--', 'frontend', 'src'], { cwd: root, encoding: 'utf8' }).split('\0').filter(file => /\.(js|html)$/.test(file)).sort();
function walk(node, visit, ancestors = []) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, ancestors);
  for (const [key, value] of Object.entries(node)) {
    if (['parent', 'tokens', 'comments'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => { if (child?.type) walk(child, visit, [...ancestors, node]); });
    else if (value?.type) walk(value, visit, [...ancestors, node]);
  }
}
function globalDictionary() {
  const source = read('frontend/cw-i18n.js'), end = source.indexOf('  const CANON_DICT =');
  assert(end > 0, 'Global dictionary boundary changed: review extractor');
  const box = { window: {} };
  // Execute only dictionary declarations/mappings, stopping before storage, network and DOM code.
  vm.runInNewContext(source.slice(0, end) + 'window.audit={dict:DICT,canonicalText};})();', box, { timeout: 2000 });
  const canonical = new Map(Object.entries(box.window.audit.dict).map(([key, values]) => [box.window.audit.canonicalText(key), { key, values }]));
  return { dict: box.window.audit.dict, canonical, canonicalText: box.window.audit.canonicalText };
}
function pageInventory() {
  const box = { require, URL, __dirname: path.join(root, 'scripts'), process: { argv: [] }, console: { log() {} }, module: { exports: {} } };
  vm.runInNewContext(read('scripts/audit-field-page-inventory.js') + ';module.exports=result;', box, { timeout: 15000 });
  return JSON.parse(JSON.stringify(box.module.exports.pages));
}
function ownerFor(file, roles = []) {
  const name = path.basename(file);
  if (/^(dashboard|admin-dashboard|operational-dashboard|incident-center)(\.|-)/i.test(name) || /[\/]js[\/]dashboard[\/]/.test(file)) return 'C07';
  if (/client|customer|report|pdf|document|invoice/i.test(name)) return 'C09';
  if (/technician-profit|technician-management|admin-technician/.test(name)) return 'C08';
  if (/technician|offline|sync|field-|route-|visit|round|geo|gps/i.test(name) || (roles.length && roles.every(role => ['TECHNICIAN', 'TEAM_LEADER'].includes(role)))) return 'C06';
  return 'C08';
}
function leafMap(node, prefix = '', out = new Map()) {
  const value = literal(node);
  if (value !== null) out.set(prefix, { value, start: node.start });
  else if (node?.type === 'ArrayExpression') node.elements.forEach((item, index) => leafMap(item, `${prefix}[${index}]`, out));
  else if (node?.type === 'ObjectExpression') for (const item of node.properties) if (item.type === 'Property' && !item.computed) leafMap(item.value, prefix ? `${prefix}.${property(item.key)}` : String(property(item.key)), out);
  return out;
}
function dictionaryRows(ast, source, file, offset) {
  const rows = [], spans = [];
  const orders = [];
  walk(ast, node => {
    if (node.type === 'ArrayExpression' && node.elements.length >= 4) {
      const values = node.elements.map(literal);
      if (values.every(value => languages.includes(value)) && new Set(values).size === values.length) orders.push(values);
    }
  });
  const order = orders[0];
  walk(ast, (node, parents) => {
    if (node.type === 'ArrayExpression' && parents.at(-1)?.type === 'Property' && node.elements.length >= 4 && node.elements.every(item => literal(item) !== null)) {
      const holder = parents.findLast(item => item.type === 'VariableDeclarator');
      const label = holder ? source.slice(holder.id.start, holder.id.end) : '';
      if ((order && /message|copy|text|row|dict/i.test(label)) || /(?:copy|i18n)\.js$/.test(file)) {
        const values = node.elements.map(literal), knownOrder = order && values.length === order.length;
        spans.push([node.start, node.end]);
        rows.push({ file, line: lineAt(source, node.start) + offset, key: String(property(parents.at(-1).key)), text: values[knownOrder ? order.indexOf('pt') : 0], languages: knownOrder ? order : [], kind: 'indexed-dictionary', status: knownOrder ? 'static-provider-review' : 'index-order-review', values: knownOrder ? Object.fromEntries(order.map((lang, index) => [lang, values[index]])) : {} });
      }
      return;
    }
    if (node.type !== 'ObjectExpression') return;
    const props = node.properties.filter(item => item.type === 'Property' && !item.computed && languages.includes(property(item.key)));
    if (props.length < 2) return;
    const maps = Object.fromEntries(props.map(item => [property(item.key), leafMap(item.value)]));
    const keys = [...new Set(Object.values(maps).flatMap(map => [...map.keys()]))];
    if (!keys.length) return;
    spans.push([node.start, node.end]);
    const parent = parents.at(-1), label = parent?.type === 'Property' ? String(property(parent.key)) : parent?.type === 'VariableDeclarator' ? source.slice(parent.id.start, parent.id.end) : `object@${lineAt(source, node.start)}`;
    for (const key of keys) {
      const values = Object.fromEntries(languages.filter(lang => maps[lang]?.has(key)).map(lang => [lang, maps[lang].get(key).value]));
      const formatting = Object.values(values).every(value => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value));
      const pt = values.pt ?? (key === '' ? label : null);
      rows.push({ file, line: lineAt(source, node.start) + offset, key: key ? `${label}.${key}` : label, text: pt, languages: Object.keys(values), kind: formatting ? 'locale-format-map' : 'dictionary-fragment', status: formatting ? 'formatting-only' : 'static-provider-review', values });
    }
  });
  return { rows, spans };
}
function isHuman(value, explicit = false) {
  const text = normalize(value);
  if (/^(?:use strict|private,? no-store|application\/|text\/|Bearer |Basic |Content-Type)/.test(text)) return false;
  if (!/\p{L}/u.test(text) || text.length > 1200) return false;
  if (/^(?:https?:|\/api\/|data:|#|\.|--|(?:frontend|src)\/)|[{};]\s*(?:$|[.#])/.test(text)) return false;
  if (/^(?:[A-Z\d_]+|[a-z\d_-]+\.(?:js|css|png|jpg|svg|html)|(?:[\w.-]+\/)+[\w.-]+)$/i.test(text) && !explicit) return false;
  if (/\b(?:SELECT|INSERT INTO|UPDATE \w+ SET|DELETE FROM|CREATE TABLE|ORDER BY)\b|(?:color|display|padding|margin|width|height|font-size)\s*:/.test(text)) return false;
  return explicit || /\s|[À-ÿ]/.test(text);
}
function classify(node, parents, source, backend) {
  const near = parents.slice(-5), parent = parents.at(-1);
  if (parent?.type === 'Property' && parent.key === node && !parent.computed) return null;
  if (near.some(item => item.type === 'CallExpression' && /^(?:console\.|logger\.|log\.|require$)/.test(source.slice(item.callee.start, item.callee.end)))) return null;
  const call = [...near].reverse().find(item => ['CallExpression', 'NewExpression'].includes(item.type));
  const callee = call ? source.slice(call.callee.start, call.callee.end) : '';
  if (/^(?:t|tr|translate|copy|text|label|message|msg|i18n\.t)$/.test(callee)) return 'translation-key';
  if (/\b(?:alert|confirm|prompt|toast|showToast|setMessage|setStatus|note|text|drawText)$/.test(callee)) return backend ? 'pdf-or-message-call' : 'ui-message-call';
  if (/Error$/.test(callee)) return 'error-candidate';
  if (near.some(item => item.type === 'AssignmentExpression' && /\.(?:textContent|innerText|innerHTML|outerHTML|title|placeholder)$/.test(source.slice(item.left.start, item.left.end)))) return 'ui-sink';
  if (parent?.type === 'Property' && /^(?:message|error|label|title|placeholder|text|description|reason)$/.test(String(property(parent.key)))) return backend ? 'server-message-candidate' : 'ui-property-candidate';
  if (/setAttribute$/.test(callee) && /^(?:aria-label|title|placeholder|alt)$/.test(literal(call.arguments[0]) || '') && call.arguments[1] === node) return 'ui-attribute';
  return 'source-text-candidate';
}
function parseJS(parseSync, source, file, offset = 0) {
  const parsed = parseSync(file.replace(/\.html$/, '.js'), source, { sourceType: 'unambiguous' });
  assert.equal(parsed.errors.length, 0, `${file}:${offset + 1}: ${JSON.stringify(parsed.errors)}`);
  const dictionaries = dictionaryRows(parsed.program, source, file, offset), entries = [], markup = [], references = new Set();
  walk(parsed.program, (node, parents) => {
    const value = literal(node);
    // Only code-loading expressions create graph edges. Cache lists and links are not executed scripts.
    const parent = parents.at(-1);
    if (value !== null && /\.js(?:[?#].*)?$/.test(value) && (
      parent?.type === 'AssignmentExpression' && /\.src$/.test(source.slice(parent.left.start, parent.left.end)) ||
      parent?.type === 'ImportDeclaration' || parent?.type === 'ImportExpression' ||
      parent?.type === 'CallExpression' && /(?:loadScript|importScript|require)$/.test(source.slice(parent.callee.start, parent.callee.end)) ||
      parent?.type === 'CallExpression' && /setAttribute$/.test(source.slice(parent.callee.start, parent.callee.end)) && literal(parent.arguments[0]) === 'src'
    )) references.add(value);
    if (file === 'frontend/cw-i18n.js' && node.start < source.indexOf('  const CANON_DICT =')) return;
    if (dictionaries.spans.some(([start, end]) => node.start >= start && node.end <= end)) return;
    if (node.type !== 'TemplateLiteral' && value === null) return;
    // Quasis are not AST Literal nodes. Keep one template with explicit dynamic holes.
    const text = value ?? node.quasis.map((q, i) => (q.value.cooked ?? q.value.raw) + (i < node.expressions.length ? '${…}' : '')).join('');
    const kind = classify(node, parents, source, file.startsWith('src/'));
    if (!kind) return;
    const line = lineAt(source, node.start) + offset;
    if (/<(?:div|span|p|button|input|label|option|td|th|h[1-6]|a|section|strong|small|li)\b/i.test(text)) { markup.push({ file, line, text, kind: 'dynamic-markup' }); return; }
    if (!isHuman(text, kind !== 'source-text-candidate')) return;
    entries.push({ file, line, text: normalize(text), kind });
  });
  return { entries, markup, dictionaries: dictionaries.rows, references: [...references] };
}
// Executed in an inert about:blank document; no page scripts, preferences or API calls.
function extractDOM(items) {
  const skip = '.cw-lang-switch,script,style,noscript,textarea,code,pre,svg,canvas,select:not([data-cw-i18n-options]),[data-cw-no-i18n]';
  const result = [];
  for (const item of items) {
    const doc = new DOMParser().parseFromString(item.text, 'text/html');
    const add = (text, node, kind, excluded) => {
      text = text.replace(/\s+/g, ' ').trim();
      if (!text || !/\p{L}/u.test(text) || text === '${…}') return;
      const raw = node.nodeType === 3 ? node.nodeValue : text;
      const at = item.text.indexOf(raw);
      const position = at < 0 ? '' : item.text.slice(0, at);
      result.push({ file: item.file, line: item.line + (position.match(/\n/g) || []).length, text, kind: item.kind === 'static-html' ? kind : `dynamic-${kind}`, excluded, locator: node.nodeType === 3 ? node.parentElement?.tagName.toLowerCase() : node.tagName.toLowerCase(), linePrecision: at < 0 ? 'fragment-start' : 'first-text-match' });
    };
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      const element = node.parentElement;
      if (!element || element.closest('script,style,noscript,svg,canvas,code,pre')) continue;
      add(node.nodeValue, node, 'html-text', !!element.closest(skip));
    }
    for (const node of doc.querySelectorAll('[placeholder],[title],[aria-label],[alt],input[value]')) {
      for (const attr of ['placeholder', 'title', 'aria-label', 'alt', 'value']) {
        if (!node.hasAttribute(attr) || attr === 'value' && !['button', 'submit', 'reset'].includes(node.type)) continue;
        const eligible = attr === 'aria-label' || attr === 'placeholder' && node.matches('input,textarea') || attr === 'title' && node.matches('button,a');
        add(node.getAttribute(attr), node, `html-${attr}`, !eligible || !!node.closest(skip));
      }
    }
    if (doc.title) add(doc.title, doc.querySelector('title'), 'html-document-title', true);
  }
  return result;
}
function assignBatches(sources, pages) {
  const roles = new Map(pages.map(page => [page.file, page.explicitRoleHints]));
  const byOwner = Object.fromEntries(['C06', 'C07', 'C08', 'C09'].map(owner => [owner, []]));
  for (const file of sources) byOwner[ownerFor(file, roles.get(file))].push(file);
  const batches = [];
  for (const [owner, files] of Object.entries(byOwner)) {
    // Four source files leave room for fixtures, runner and continuity within the ten-file gate.
    for (let i = 0; i < files.length; i += 4) batches.push({ id: `${owner}-${String(i / 4 + 1).padStart(3, '0')}`, owner, files: files.slice(i, i + 4), state: 'review-then-implement', maxChangedFiles: 10 });
  }
  return batches;
}
function verify(result) {
  assert.equal(result.pages.length, result.sources.filter(source => source.file.startsWith('frontend/') && source.file.endsWith('.html')).length);
  assert.equal(new Set(result.entries.map(entry => entry.id)).size, result.entries.length);
  const files = new Set(result.sources.map(source => source.file)), batches = new Map(result.batches.map(batch => [batch.id, batch]));
  for (const entry of result.entries) { assert(files.has(entry.file)); assert(batches.get(entry.batch)?.files.includes(entry.file)); }
  for (const source of result.sources) assert.equal(hash(read(source.file)), source.sha256, `Source changed: ${source.file}`);
  for (const [file, expected] of Object.entries(result.toolingHashes)) assert.equal(hash(read(file)), expected, `Inventory tooling changed: ${file}`);
  for (const page of result.pages) { assert(page.batch); assert(Array.isArray(page.roles)); assert(Array.isArray(page.entries)); }
  assert(result.entries.some(entry => entry.file === 'frontend/technician.html' && entry.status === 'no-static-provider'));
  assert(result.entries.some(entry => entry.file === 'frontend/dashboard.html'));
  assert(result.dictionaries.some(row => row.file === 'frontend/cw-client-portal-request.js' && row.languages.length === 5));
  assert(result.dictionaries.some(row => row.file === 'frontend/cw-client-technical-copy.js' && row.key === 'range' && row.languages.length === 5));
  for (const file of ['src/services/visitReportLanguage.js', 'src/services/monthlyReportLanguage.js']) assert(result.reportLanguages.some(item => item.file === file && item.accepted.join(',') === 'pt,en,fr,es' && item.rejected.includes('de')));
}
function markdown(result) {
  const safe = value => String(value).replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
  return [
    '# Inventário de idiomas — C05 / TASK415', '',
    `Base: \`${result.baseCommit}\`. ${result.summary.htmlFiles} HTML frontend (${result.summary.rootPages} entradas de raiz), ${result.summary.serverHTML} HTML servidor, ${result.summary.frontendJS} JS frontend, ${result.summary.backendJS} JS servidor e ${result.summary.inlineScripts} scripts inline (inclui o HTML servidor). Fontes e hashes no JSON adjacente.`, '',
    '**Inventário estático, não aprovação funcional de traduções.** Cada página e fonte tem responsável C06–C09 e lote de até quatro fontes; cada alteração continua limitada a dez ficheiros, incluindo testes/documentação. Os lotes são unidades de revisão: fontes sem texto ou auxiliares podem ser encerradas por evidência, sem editar produto. A atribuição por módulo/nome/perfil é uma fila de trabalho, não prova de que o ficheiro só serve esse perfil; caminhos de servidor partilhados exigem revisão dos consumidores.', '',
    `O dicionário global tem ${result.globalDictionary.keys} chaves com EN/FR/ES/DE disponíveis. Isso só demonstra existência de tradução. O observador não traduz texto protegido, títulos da página, valores de inputs e select sem opt-in. Os módulos próprios são classificados à parte; fragmentos incompletos não são automaticamente falhas.`, '',
    '**Lacuna confirmada no contrato atual dos relatórios:** os módulos de visita e mensal aceitam PT/EN/FR/ES e recusam DE. C09 deve adicionar o idioma e testar HTML/PDF, normalização, formatação e rejeição de idiomas inválidos; conservar nomes, notas e evidência original. Isto não significa que os restantes PDFs estejam traduzidos.', '',
    '## Contagem de entradas', '', '| Estado estático | Entradas |', '|---|---:|',
    ...Object.entries(result.summary.statuses).map(([status, count]) => `| ${status} | ${count} |`), '',
    '`global-key-available`: chave disponível, execução por confirmar. `module-provider-candidate`: texto aparece no PT de um dicionário alcançável, sem prova de ligação ao nó/estado. `engine-excluded-review`: fora do motor genérico; pode estar deliberadamente protegido ou tratado pelo módulo. `no-static-provider`: nenhuma correspondência encontrada; é candidato a revisão, não contagem de erros confirmados. `translation-key-review`: chamada de tradutor; resolver a chave e o estado no módulo. Backend/erros internos e fontes sem entrada observada permanecem candidatos explícitos.', '',
    '## Páginas e perfis', '', '| Página | Perfis declarados/guarda | C | Lote | Textos HTML/inline | Recursos JS alcançáveis | Motor global |', '|---|---|---|---|---:|---:|---|',
    ...result.pages.map(page => `| ${safe(page.route)} | ${safe(page.roles.join(', ') || 'Sem indício explícito')} | ${page.owner} | ${page.batch} | ${page.entries.length} | ${page.assets.length} | ${page.globalEngine ? 'Referenciado' : 'Não encontrado'} |`), '',
    'Perfis vêm do catálogo e guardas existentes; não alargam autorização. Recursos incluem declarações HTML e expressões literais de carregamento de código transitivas, sem considerar listas de cache como scripts executados; carregamentos construídos dinamicamente podem exigir revisão. HTML auxiliar/protótipo está identificado no JSON e não é presumido percurso de produção. Fontes sem página alcançável estão listadas com `no-page-reference`, nunca como ecrãs usados.', '',
    '## Fila finita C06–C09', '', '| Lote | Responsável | Fontes a rever |', '|---|---|---|',
    ...result.batches.map(batch => `| ${batch.id} | ${batch.owner} | ${batch.files.map(file => `\`${file}\``).join(', ')} |`), '',
    'Prioridade: C06 página técnica antiga e fila de sincronização; C07 quatro dashboards/incidentes; C08 percursos ADMIN e componentes comuns; C09 cliente e relatórios, começando pelo DE recusado. O responsável de uma fonte partilhada coordena regressões dos restantes perfis. Não traduzir enums, UUIDs, recibos, notas, nomes ou valores de negócio para resolver uma linha do inventário.', '',
    '## Como reproduzir e aceitar', '',
    'Executar `node scripts/audit-language-inventory.js --check` para validar hashes/atribuições da fotografia publicada; `--write` volta a analisar as fontes e substitui os dois ficheiros. Chromium é necessário para DOMParser inerte; `CW_CHROMIUM_PATH` pode apontar para o executável instalado. Parser ESTree `rolldown/utils` vem do lockfile existente. Nenhum script da aplicação é executado no browser e todas as redes são abortadas.', '',
    'O JSON conserva entrada/chave, origem/linha, tipo, estado, idiomas disponíveis, responsável e lote; dicionários e mapeamentos de formatação ficam separados. Linhas HTML são a primeira correspondência literal ou início do fragmento (identificado), não localização exata de nó. Textos concatenados, chaves calculadas, CSS generated content, emails externos e caminhos raros exigem inspeção de execução; não são alegados como totalmente descobertos. Mensagens do servidor são candidatos de fonte, incluindo erros internos; uma cadeia de execução deve provar quais chegam ao utilizador.', '',
    'Cada lote executará apenas os estados aplicáveis: carregamento, dados, vazio, erro, acesso, offline, envio, conflito e recuperação; PT/EN/FR/ES/DE, preservação dos dados, reload/troca de identidade e 320/390/1440 quando houver UI. PDFs exigem fixtures e renderização. Referências literais em testes não contam como cobertura. C05 fecha o mapa e atribuições; C06–C09 só fecham após evidência dos percursos e resolução dos candidatos.', ''
  ].join('\n');
}
async function main() {
  if (process.argv.includes('--check')) {
    const result = JSON.parse(read(stem + '.json')); verify(result);
    assert.deepEqual(result.sources.map(source => source.file), tracked(), 'Tracked source scope changed');
    assert.equal(read(stem + '.md'), markdown(result), 'Markdown snapshot differs');
    console.log(JSON.stringify({ ok: true, phase: 'snapshot-checked', ...result.summary })); return;
  }
  const { parseSync } = await import('rolldown/utils');
  const { chromium } = require('playwright');
  const global = globalDictionary(), pages = pageInventory(), files = tracked();
  const sources = [], entries = [], dictionaries = [], markup = [], refs = new Map();
  let inlineScripts = 0;
  // Extractor controls catch false positives/incorrect locale alignment before reading project data.
  const control = parseJS(parseSync, 'const copy={pt:["Guardar","Repetir"],en:["Save"],fr:["Enregistrer","Réessayer"]}; node.textContent="Falha no envio"; console.log("Do not count this log");', 'control.js');
  assert.equal(control.dictionaries.length, 2); assert.equal(control.dictionaries[1].languages.join(','), 'pt,fr');
  assert.equal(control.entries.length, 1); assert.equal(control.entries[0].kind, 'ui-sink');
  const indexed = parseJS(parseSync, 'const langs=["pt","en","fr","es","de"], messages={save:["Guardar","Save","Enregistrer","Guardar","Speichern"]}; const cache=["/unused.js"]; script.src="/used.js";', 'control.js');
  assert.equal(indexed.dictionaries[0].languages.join(','), languages.join(',')); assert.deepEqual(indexed.references, ['/used.js']);
  for (const file of files) {
    const source = read(file); sources.push({ file, sha256: hash(source), scope: file.startsWith('src/') ? 'server-source' : file.endsWith('.html') ? 'html-source' : 'browser-source' });
    const units = [];
    if (file.endsWith('.html')) {
      markup.push({ file, line: 1, text: source, kind: 'static-html' });
      for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (/\bsrc\s*=/i.test(match[1])) continue;
        const type = /\btype\s*=\s*["']?([^\s"'>]+)/i.exec(match[1])?.[1]?.toLowerCase();
        if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
        const start = match.index + match[0].indexOf('>') + 1;
        units.push({ source: match[2], offset: lineAt(source, start) - 1 }); inlineScripts++;
      }
    } else units.push({ source, offset: 0 });
    const links = new Set();
    for (const unit of units) {
      const parsed = parseJS(parseSync, unit.source, file, unit.offset);
      entries.push(...parsed.entries); if (file !== 'frontend/cw-i18n.js') dictionaries.push(...parsed.dictionaries); markup.push(...parsed.markup); parsed.references.forEach(ref => links.add(ref));
    }
    refs.set(file, [...links].map(ref => {
      const clean = ref.split(/[?#]/)[0];
      if (/^https?:/.test(clean)) return null;
      return clean.startsWith('/') ? 'frontend' + clean : path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
    }).filter(ref => files.includes(ref)));
  }
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage(); await page.route('**/*', route => route.abort());
    const check = await page.evaluate(extractDOM, [{ file: 'control.html', line: 1, kind: 'static-html', text: '<title>Título</title><p>Guardar</p><p data-cw-no-i18n>Nome livre</p><select><option>Escolher</option></select><select data-cw-i18n-options><option>Repetir</option></select><textarea placeholder="Nota"></textarea><input value="User text"><script>throw Error("never execute")</script>' }]);
    assert.equal(check.find(item => item.text === 'Guardar').excluded, false);
    for (const text of ['Título', 'Nome livre', 'Escolher', 'Nota']) assert.equal(check.find(item => item.text === text).excluded, true);
    assert.equal(check.find(item => item.text === 'Repetir').excluded, false); assert(!check.some(item => item.text === 'User text'));
    for (let i = 0; i < markup.length; i += 80) entries.push(...await page.evaluate(extractDOM, markup.slice(i, i + 80)));
  } finally { await browser.close(); }
  const batches = assignBatches(files, pages), batchFor = new Map(batches.flatMap(batch => batch.files.map(file => [file, batch])));
  const reach = new Map();
  for (const page of pages) {
    const found = new Set([page.file, ...page.localAssets.filter(asset => asset.endsWith('.js')).map(asset => 'frontend' + asset).filter(file => files.includes(file))]);
    const queue = [...found];
    for (let i = 0; i < queue.length; i++) for (const ref of refs.get(queue[i]) || []) if (!found.has(ref)) { found.add(ref); queue.push(ref); }
    for (const file of found) { if (!reach.has(file)) reach.set(file, []); reach.get(file).push(page.route); }
    page.assets = [...found].filter(file => file.endsWith('.js')).sort();
    page.globalEngine = found.has('frontend/cw-i18n.js');
  }
  const providers = new Map();
  for (const row of dictionaries) {
    row.owner = batchFor.get(row.file).owner; row.batch = batchFor.get(row.file).id;
    if (row.text && row.kind !== 'locale-format-map') {
      const key = normalize(row.text); if (!providers.has(key)) providers.set(key, []);
      providers.get(key).push(row);
    }
    delete row.values;
  }
  const globalSource = read('frontend/cw-i18n.js');
  for (const [key, values] of Object.entries(global.dict)) {
    const at = globalSource.indexOf(key);
    dictionaries.push({ file: 'frontend/cw-i18n.js', line: lineAt(globalSource, Math.max(0, at)), linePrecision: at < 0 ? 'generated-key-file-start' : 'first-text-match', key, text: key, languages: languages.filter(lang => lang === 'pt' || values[lang]), kind: 'global-dictionary', status: 'dictionary-evaluated-not-dom-tested', owner: batchFor.get('frontend/cw-i18n.js').owner, batch: batchFor.get('frontend/cw-i18n.js').id });
  }
  const unique = new Map();
  for (const entry of entries) {
    const id = hash([entry.file, entry.line, entry.kind, entry.text].join('\0')).slice(0, 16);
    if (unique.has(id)) continue;
    const routes = reach.get(entry.file) || [], available = global.dict[entry.text] ? { key: entry.text, values: global.dict[entry.text] } : global.canonical.get(global.canonicalText(entry.text));
    const local = (providers.get(entry.text) || []).filter(provider => provider.file === entry.file || routes.some(route => (reach.get(provider.file) || []).includes(route)));
    const engine = !entry.file.startsWith('src/') && pages.some(page => routes.includes(page.route) && page.globalEngine);
    let status = entry.kind === 'translation-key' ? 'translation-key-review' : entry.excluded ? 'engine-excluded-review' : local.length ? 'module-provider-candidate' : engine && available ? 'global-key-available' : 'no-static-provider';
    unique.set(id, { id, ...entry, status, ...(available && engine ? { globalKey: available.key, availableLanguages: languages.filter(lang => lang === 'pt' || available.values[lang]) } : {}), ...(local.length ? { providers: [...new Set(local.map(row => `${row.file}:${row.line}`))] } : {}), owner: batchFor.get(entry.file).owner, batch: batchFor.get(entry.file).id });
  }
  const finalEntries = [...unique.values()].sort((a, b) => a.file.localeCompare(b.file, 'en') || a.line - b.line || a.id.localeCompare(b.id));
  const result = {
    schemaVersion: 1, baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), method: 'Static source inventory; candidate assignment, not execution or translation acceptance.',
    toolingHashes: Object.fromEntries(['scripts/audit-language-inventory.js', 'scripts/audit-field-page-inventory.js', 'CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md', 'package-lock.json'].map(file => [file, hash(read(file))])),
    globalDictionary: { keys: Object.keys(global.dict).length, missingByLanguage: Object.fromEntries(languages.slice(1).map(lang => [lang, Object.keys(global.dict).filter(key => !global.dict[key][lang])])) },
    reportLanguages: ['src/services/visitReportLanguage.js', 'src/services/monthlyReportLanguage.js'].map(file => { const module = require(path.join(root, file)); return { file, accepted: languages.filter(lang => { try { return module.language(lang) === lang; } catch { return false; } }), rejected: languages.filter(lang => { try { module.language(lang); return false; } catch { return true; } }), evidence: 'Called exported language validator locally; no PDF rendering claimed.' }; }),
    sources: sources.map(source => ({ ...source, owner: batchFor.get(source.file).owner, batch: batchFor.get(source.file).id, routes: reach.get(source.file) || [], reachability: source.file.startsWith('src/') ? 'server-call-chain-review' : reach.has(source.file) ? 'literal-page-reference' : 'no-page-reference' })),
    pages: pages.map(page => ({ file: page.file, route: page.route, kind: page.kind, roles: [...new Set([...page.catalogueRoles, ...page.explicitRoleHints])].sort(), conditionalAccess: page.conditionalAccess, owner: batchFor.get(page.file).owner, batch: batchFor.get(page.file).id, globalEngine: page.globalEngine, assets: page.assets, entries: finalEntries.filter(entry => entry.file === page.file).map(entry => entry.id) })),
    dictionaries, entries: finalEntries, batches,
    summary: { htmlFiles: pages.length, rootPages: pages.filter(page => page.kind === 'Entrada raiz').length, serverHTML: files.filter(file => file.startsWith('src/') && file.endsWith('.html')).length, frontendJS: files.filter(file => file.startsWith('frontend/') && file.endsWith('.js')).length, backendJS: files.filter(file => file.startsWith('src/') && file.endsWith('.js')).length, inlineScripts, entries: finalEntries.length, dictionaryRows: dictionaries.length, batches: batches.length, statuses: Object.fromEntries([...new Set(finalEntries.map(entry => entry.status))].sort().map(status => [status, finalEntries.filter(entry => entry.status === status).length])) }
  };
  verify(result);
  if (process.argv.includes('--write')) {
    // One compact record per line keeps the snapshot inspectable without duplicating full source text.
    const json = '{\n' + Object.entries(result).map(([key, value]) => JSON.stringify(key) + ': ' + (Array.isArray(value) ? '[\n' + value.map(item => JSON.stringify(item)).join(',\n') + '\n]' : JSON.stringify(value))).join(',\n') + '\n}';
    fs.writeFileSync(path.join(root, stem + '.json'), json + '\n');
    fs.writeFileSync(path.join(root, stem + '.md'), markdown(result));
  }
  console.log(JSON.stringify({ ok: true, phase: 'inventory-complete', ...result.summary }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
