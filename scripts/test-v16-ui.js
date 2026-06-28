const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const fe = path.join(root, 'frontend');
const mustExist = [
  'frontend/cristal-assist.js',
  'frontend/cristal-assist.css',
  'frontend/cw-enterprise-sidebar.js',
  'frontend/admin-operational-flow.html',
  'frontend/admin-operational-flow.js',
  'frontend/admin-notifications.html',
  'frontend/admin-notifications.js',
  'frontend/admin-operational-settings.html'
];
let errors = [];
for(const rel of mustExist){ if(!fs.existsSync(path.join(root, rel))) errors.push('Falta ficheiro: '+rel); }
function read(rel){ return fs.readFileSync(path.join(root, rel),'utf8'); }
const assist = read('frontend/cristal-assist.js');
if(!assist.includes('LOGIN_PATHS')) errors.push('Assistente não protege páginas de login.');
if(!assist.includes('cw_help_enabled')) errors.push('Assistente não tem modo discreto persistente.');
if(!assist.includes('3000')) errors.push('Long press 3s não encontrado.');
const css = read('frontend/cristal-assist.css');
if(!css.includes('.cw-side')) errors.push('CSS da sidebar não encontrado.');
if(!css.includes('billing-card')) errors.push('Correção de contraste billing não encontrada.');
const side = read('frontend/cw-enterprise-sidebar.js');
for(const href of ['/admin-operational-flow','/admin-dashboard','/admin-clients','/admin-pools','/admin-rounds','/billing','/admin-inventory','/admin-operational-settings']){
  if(!side.includes(href)) errors.push('Sidebar sem link '+href);
}
const notif = read('frontend/admin-notifications.js');
if(!notif.includes('/admin-dashboard')) errors.push('Fallback de notificações não aponta para admin-dashboard.');
if(notif.includes('http://localhost:4000/api')) errors.push('Notificações ainda usam API hardcoded.');
if(errors.length){ console.error('V16 UI QA falhou:\n- '+errors.join('\n- ')); process.exit(1); }
console.log('V16 UI/UX QA OK: ajuda discreta, sidebar, notificações e contraste base validados.');
