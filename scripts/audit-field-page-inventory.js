'use strict';
// Read-only source inventory; --write saves the report. Literal test references are not proof of coverage.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), frontend = path.join(root, 'frontend');
const read = file => fs.readFileSync(file, 'utf8');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--', 'frontend'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean));
const catalogue = new Map();
for (const line of read(path.join(root, 'CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md')).split('\n')) {
  if (!line.startsWith('| /')) continue;
  const cells = line.split('|').map(value => value.trim()).filter(Boolean);
  catalogue.set(cells[0], { roles: cells[2].split(',').map(role => role.trim()), destination: cells[4] });
}
const suite = read(path.join(root, 'scripts/test-field-suite.js'));
const scripts = new Set([...suite.matchAll(/['"](test-[^'"\s]+\.js)['"]/g)].map(match => match[1]));
for (const match of JSON.parse(read(path.join(root, 'package.json'))).scripts['test:field-browser'].matchAll(/scripts\/(test-[\w-]+\.js)/g)) scripts.add(match[1]);
const testSources = [...scripts].map(name => ({ name, source: read(path.join(root, 'scripts', name)) }));
const guardRoles = { 'admin-auth-guard.js': ['ADMIN'], 'client-auth-guard.js': ['CLIENT'], 'technician-auth-guard.js': ['TECHNICIAN', 'TEAM_LEADER'] };
const pages = walk(frontend).filter(file => file.endsWith('.html')).sort().map(file => {
  const relative = path.relative(frontend, file).split(path.sep).join('/'), topLevel = !relative.includes('/');
  const route = '/' + (topLevel ? relative.slice(0, -5) : relative), html = read(file), assets = [], missingAssets = [], unavailableLocalAssets = [], guards = [], roles = new Set();
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attr = match[0].match(/\b(?:src|href)=["']([^"']+)["']/i); if (!attr) continue;
    const url = new URL(attr[1], 'http://inventory.local/' + relative); if (url.origin !== 'http://inventory.local') continue;
    const pathname = decodeURIComponent(url.pathname), target = path.join(frontend, pathname);
    const served = pathname === '/socket.io/socket.io.js', exists = target.startsWith(frontend + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile();
    assets.push(pathname); if (!served && !exists) {
      if (tracked.has('frontend' + pathname)) unavailableLocalAssets.push(pathname);
      else missingAssets.push(pathname);
    }
    const name = path.basename(pathname); if (guardRoles[name]) { guards.push(name); guardRoles[name].forEach(role => roles.add(role)); }
    if (match[1].toLowerCase() === 'script' && exists && !['cw-auth.js', 'technician-auth-guard.js', 'admin-auth-guard.js', 'client-auth-guard.js'].includes(name)) {
      for (const roleMatch of read(target).matchAll(/requireAuth\(\s*['"](ADMIN|CLIENT|TECHNICIAN|TEAM_LEADER)['"]/g)) roles.add(roleMatch[1]);
    }
  }
  for (const match of html.matchAll(/(?:data-required-role=["']|requireAuth\(\s*['"])(ADMIN|CLIENT|TECHNICIAN|TEAM_LEADER)/g)) roles.add(match[1]);
  const declaredRoles = catalogue.get(route)?.roles || [], conditionalAccess = [], entryRedirects = {};
  if (route === '/vehicle-consumption') { ['ADMIN','TECHNICIAN','TEAM_LEADER'].forEach(role => roles.add(role)); conditionalAccess.push('Sessão coerente verificada no componente; API privada, atribuição atual de viatura e técnico para os perfis de campo.'); }
  if (route === '/invoice-document') { roles.add('PUBLIC'); conditionalAccess.push('Entrada pública sem dados financeiros; abrir PDF exige ADMIN ou CLIENT titular na API'); }
  if (route === '/config-notifications') { for (const role of ['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER']) { roles.add(role); entryRedirects[role] = '/settings'; } conditionalAccess.push('Alias estático; a sessão e titularidade User são verificadas no destino'); }
  if (['/admin-command-center','/admin-core-flow','/admin-operational-flow','/client-wow','/splash'].includes(route) && assets.includes('/cw-admin-legacy-entry.js')) {
    Object.assign(entryRedirects,{ADMIN:'/admin-master-control',CLIENT:'/client-portal',TECHNICIAN:'/technician-field-mode',TEAM_LEADER:'/technician-field-mode'});
    conditionalAccess.push('Entrada neutra: encaminha uma identidade coerente para a área do perfil; identidade inválida abre login. Não concede acesso a dados; guardas e APIs do destino continuam a autenticar.');
  }
  if (guards.includes('client-auth-guard.js')) {
    if (route === '/client-portal') { roles.add('ADMIN'); conditionalAccess.push('ADMIN: pré-visualização existente do portal'); }
    if (route === '/client_chat') entryRedirects.ADMIN = '/chat';
    if (route === '/settings') { ['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].forEach(role => roles.add(role)); conditionalAccess.push('Preferências: a API exige titularidade User; CLIENT/PIN podem receber estado indisponível'); }
    if (route === '/help-center') { ['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].forEach(role => roles.add(role)); conditionalAccess.push('Ajuda e comandos rápidos filtrados pelo perfil autenticado'); }
  }
  const searchRoute = topLevel ? route : '/' + relative;
  const escaped = searchRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped + (topLevel ? '(?:\\.html)?' : '') + '(?=["\x27`?#\\s])');
  const testReferences = testSources.filter(test => pattern.test(test.source)).map(test => test.name);
  return { file: 'frontend/' + relative, route, kind: topLevel ? 'Entrada raiz' : 'Auxiliar/protótipo/teste', title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '', catalogueRoles: declaredRoles, guardFiles: guards, explicitRoleHints: [...roles].sort(), conditionalAccess, entryRedirects, catalogueRolesMissingFromGuard: guards.length ? declaredRoles.filter(role => !roles.has(role) && !entryRedirects[role] && role !== 'PUBLIC') : [], localAssets: [...new Set(assets)], missingAssets, unavailableLocalAssets, languageAssets: assets.filter(asset => /i18n|language|locale/.test(asset)), directPrintAction: /\bwindow\.print\s*\(/.test(html), testReferences, visualReview: 'Não reavaliada por este inventário' };
});
const result = { generatedAt: new Date().toISOString(), baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), method: 'Inventário estático dos HTML, recursos locais, guardas explícitas e referências literais nos scripts ativos. Não executa páginas nem comprova cobertura funcional/visual.', activeScriptsScanned: scripts.size, summary: { htmlFiles: pages.length, rootPages: pages.filter(page => page.kind === 'Entrada raiz').length, nestedPages: pages.filter(page => page.kind !== 'Entrada raiz').length, unavailableLocalAssetReferences: pages.reduce((sum, page) => sum + page.unavailableLocalAssets.length, 0), missingAssetReferences: pages.reduce((sum, page) => sum + page.missingAssets.length, 0), pagesWithLiteralTestReference: pages.filter(page => page.testReferences.length).length, catalogueGuardDifferences: pages.filter(page => page.catalogueRolesMissingFromGuard.length).length }, pages };
const escape = value => String(value || '—').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
const differences = pages.filter(page => page.catalogueRolesMissingFromGuard.length);
const markdown = [
  '# Inventário atual de páginas', '',
  `Base publicada: \`${result.baseCommit}\`. Gerado em ${result.generatedAt}. Inclui o estado dos ficheiros locais no momento da geração.`, '',
  `${result.summary.htmlFiles} ficheiros HTML: ${result.summary.rootPages} entradas de raiz e ${result.summary.nestedPages} ficheiros auxiliares/protótipos/testes. ${result.summary.missingAssetReferences} referências locais a scripts/estilos/recursos sem ficheiro correspondente.`, '',
  `Foram procuradas referências literais em ${scripts.size} scripts de integração/navegador ativos. ${result.summary.pagesWithLiteralTestReference} páginas têm pelo menos uma referência; uma referência não prova execução, validação visual ou cobertura completa. A ausência também não exclui testes com URLs construídos dinamicamente.`, '',
  `${result.summary.unavailableLocalAssetReferences} referências existem no índice Git mas não estão materializadas nesta cópia local; não são classificadas como ficheiros ausentes da aplicação.`, '',
  'As colunas de papéis distinguem o catálogo anterior dos indícios explícitos no HTML/scripts. Não são uma auditoria de autorização: as APIs, a atribuição atual e o comportamento real de cada perfil continuam a determinar o acesso.', '',
  'Exceções revistas: ADMIN conserva a pré-visualização em `/client-portal`; a entrada antiga `/client_chat` encaminha ADMIN para `/chat`, sem abrir a conversa de um cliente. Estas duas situações não são listadas como divergências. A guarda do cliente preserva filas/rascunhos/documentos ao recusar uma sessão; os 24 casos de navegador estão descritos em `CLIENT_ENTRY_PRESERVATION_20260917.md`.', '',
  '## Correção de atalhos administrativos', '',
  '| Ação ADMIN | Destino atual |', '|---|---|',
  '| Guias de obra/trabalho | `/admin-vehicles#works` |', '| Guias de transporte | `/admin-vehicles#guides` |', '| Localização da equipa | `/admin-live-map` |', '',
  'O menu principal, o menu comum e o cabeçalho da frota deixam de encaminhar o administrador para guardas exclusivas de técnicos. As permissões dessas páginas técnicas permanecem iguais.', '',
  '## Diferenças a rever no catálogo', '',
  ...(differences.length ? ['| Página | Papéis do catálogo sem correspondência na guarda declarada |', '|---|---|', ...differences.map(page => `| ${page.route} | ${page.catalogueRolesMissingFromGuard.join(', ')} |`)] : ['Nenhuma diferença detetada nas páginas com ficheiro de guarda explícito.']), '',
  'Estas diferenças são itens de revisão, não autorização para alargar acessos. TASK222 alinhou guias/GPS; TASK224 alinhou outras dezasseis entradas do catálogo com as guardas existentes, sem alterar permissões. TASK225 torna a página de preferências acessível aos quatro perfis autenticados, mantendo a titularidade User na API e um estado indisponível para CLIENT/PIN. TASK226 adapta a ajuda e os comandos rápidos ao perfil. TASK228 encaminha a configuração antiga para as preferências autenticadas; as chaves globais de som deixam de ser consumidas, conservando os bytes. As versões anteriores do catálogo/inventário estão no Git.', '',
  '## Menu por perfil', '',
  'TASK224 escolhe a navegação pela indicação de papel da página, usando a sessão como segunda opção e o nome do URL apenas como último recurso. CLIENT deixa de receber o menu ADMIN nas páginas genéricas; a rentabilidade mantém menu ADMIN apesar do prefixo técnico. O menu técnico deixa de oferecer cinco destinos administrativos recusados e usa os percursos existentes para guias/stock, histórico e perfil. Registos de campo continuam na entrada Rota do dia e Visita; não há acesso novo ao inventário ou à gestão da frota.', '',
  'No menu ADMIN, Configurações gerais continua a abrir a central administrativa. O atalho duplicado para a página de som foi removido. Avisos de manutenção abre os controlos existentes na central; não se apresenta essa capacidade como um editor geral de modelos/regras. TASK225 corrige a consulta/gravação de preferências em `/settings`, com confirmação exata, falhas visíveis, separação da identidade, cinco idiomas e estados de acesso recusado. TASK226 permite ajuda por perfil. TASK228 liga o som dos dois ecrãs administrativos à preferência atual da conta e à ativação explícita da página; a entrada antiga encaminha para /settings.', '',
  '## Inventário', '',
  '| Entrada | Tipo | Papéis no catálogo | Indícios de papel no código | Referências literais em QA |', '|---|---|---|---|---|',
  ...pages.map(page => `| ${escape(page.route)} | ${escape(page.kind)} | ${escape(page.catalogueRoles.join(', '))} | ${escape(page.explicitRoleHints.join(', '))} | ${page.testReferences.length} |`), '',
  '## Fila finita sem referência literal em QA', '',
  ...pages.filter(page => !page.testReferences.length).map(page => `- ${escape(page.route)} — ${escape(page.kind)}; papéis declarados: ${escape(page.explicitRoleHints.join(', ') || page.catalogueRoles.join(', '))}.`), '',
  'Esta fila prioriza pesquisa de evidência; não declara que o percurso esteja sem testes. Os indícios de idioma e impressão direta estão no JSON e também não equivalem a tradução ou impressão aprovadas.', '',
  '## Critérios visuais ainda por fechar', '',
  'Para cada página e perfil permitido: destino correto, carregamento, dados, vazio, erro/repetição, larguras 320/390/1440, teclado/foco, cinco idiomas e PDFs aplicáveis. Consultas existentes de técnico/cliente/ADMIN, entrada TEAM_LEADER e testes por módulo continuam válidos; este inventário não os transforma numa revisão visual universal.', '',
  'Os ficheiros v26, demo e teste são listados separadamente. Não se presume que sejam percursos de produção. O JSON adjacente conserva recursos, guardas e nomes dos scripts referenciados para orientar a próxima verificação.', ''
].join('\n');
if (process.argv.includes('--write')) {
  const option = process.argv.indexOf('--output-stem');
  const stem = option < 0 ? 'docs/product/PAGE_INVENTORY_20260917' : process.argv[option + 1];
  if (!stem || !/^docs\/product\/[A-Z0-9_]+$/.test(stem)) throw Error('Use a docs/product/UPPERCASE_NAME output stem');
  fs.writeFileSync(path.join(root, stem + '.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(root, stem + '.md'), markdown);
}
console.log(JSON.stringify(result.summary));
if (result.summary.missingAssetReferences) console.log(JSON.stringify(pages.filter(page => page.missingAssets.length).map(page => ({ route: page.route, missingAssets: page.missingAssets }))));
