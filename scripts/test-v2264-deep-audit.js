const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const frontend = path.join(root, 'frontend');
function fail(msg){ console.error('❌', msg); process.exitCode = 1; }
function ok(msg){ console.log('✅', msg); }
function read(file){ return fs.readFileSync(file, 'utf8'); }
function walk(dir, files=[]){ for(const f of fs.readdirSync(dir)){ const p=path.join(dir,f); const st=fs.statSync(p); if(st.isDirectory()) walk(p, files); else files.push(p); } return files; }

// 1. No visible demo/test/WOW strings in production frontend/src/prisma.
const banned = [/Cliente Demo/i,/Piscina Demo/i,/Técnico Demo/i,/Tecnico Demo/i,/Portal WOW/i,/Cliente WOW/i,/Test Center/i,/Testar flow/i,/Flow Harmonizado/i,/Core Flow/i,/Intelligence Layer/i,/preo/i,/DEMO_FULL_FLOW/i,/demo-full-flow/i,/simulate-full-flow/i];
const scanned = [...walk(frontend), ...walk(path.join(src,'routes')), ...walk(path.join(src,'controllers')), path.join(root,'prisma','seed.js')].filter(f=>/\.(js|html|css|prisma)$/.test(f));
let bannedHits=[];
for(const file of scanned){ const txt=read(file); for(const rx of banned){ if(rx.test(txt)) bannedHits.push(`${path.relative(root,file)} -> ${rx}`); } }
if(bannedHits.length) fail('Texto demo/teste proibido encontrado:\n' + bannedHits.slice(0,40).join('\n')); else ok('Sem Demo/WOW/Flow/Test visível proibido');

// 2. Route imports do not throw with mocked Prisma.
const modelHandler={get(t,p){ if(p==='then') return undefined; if(p==='count') return async()=>0; if(p==='findMany') return async()=>[]; if(p==='findUnique'||p==='findFirst') return async()=>null; if(['create','update','upsert','delete','deleteMany','createMany','updateMany','aggregate','groupBy'].includes(p)) return async()=>({id:1}); return new Proxy({},modelHandler); }};
const prisma=new Proxy({$queryRaw:async()=>1,$transaction:async(cb)=>cb(prisma)}, {get(t,p){ if(p in t) return t[p]; return new Proxy({},modelHandler); }});
const orig=Module._load;
Module._load=function(request,parent,isMain){
  if(String(request).includes('prismaClient')) return prisma;
  if(request==='@prisma/client') return {PrismaClient:function(){return prisma}, Prisma:{dmmf:{datamodel:{models:[]}},TransactionIsolationLevel:{Serializable:'Serializable'}}};
  return orig.apply(this,arguments);
};
let routeErrors=[];
for(const file of fs.readdirSync(path.join(src,'routes')).filter(f=>f.endsWith('.js'))){ try{ require(path.join(src,'routes',file)); } catch(e){ routeErrors.push(`${file}: ${e.message}`); } }
if(routeErrors.length) fail('Rotas não importam:\n' + routeErrors.join('\n')); else ok('Todas as rotas importam sem callbacks undefined');

// 3. Frontend links point to existing pages/assets or API/socket.
const pages = new Set(fs.readdirSync(frontend).filter(f=>f.endsWith('.html')).map(f=>'/'+f.replace(/\.html$/,'')));
const assets = new Set(fs.readdirSync(frontend).map(f=>'/'+f));
let badLinks=[];
for(const file of fs.readdirSync(frontend).filter(f=>f.endsWith('.html'))){
  const txt=read(path.join(frontend,file));
  const re=/(href|src|action)=["']([^"']+)["']/g; let m;
  while((m=re.exec(txt))){
    const val=m[2].trim();
    if(!val || /^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(val)) continue;
    if(val.startsWith('/api/') || val.startsWith('/uploads/') || val==='/socket.io/socket.io.js') continue;
    const clean=val.split('?')[0].split('#')[0]; if(clean==='/' || pages.has(clean) || assets.has(clean) || fs.existsSync(path.join(frontend, clean.replace(/^\//,'')))) continue;
    if(val.includes('${')) continue;
    badLinks.push(`${file}: ${m[1]}=${val}`);
  }
}
if(badLinks.length) fail('Links frontend inválidos:\n' + badLinks.slice(0,80).join('\n')); else ok('Links principais frontend válidos');

// 4. Required CRUD/lifecycle endpoints exist.
const core = read(path.join(src,'routes','coreFlowRoutes.js'));
const guide = read(path.join(src,'routes','guideRoutes.js'));
const inv = read(path.join(src,'routes','inventoryRoutes.js'));
const required = [
  [core, "router.post('/clients'"], [core, "router.put('/clients/:id'"], [core, "router.delete('/clients/:id'"], [core, "router.post('/clients/:id/activate-contract'"],
  [core, "router.post('/clients/:clientId/pools'"], [core, "router.put('/pools/:id'"], [core, "router.delete('/pools/:id'"], [core, "router.get('/pools/:id/technical-sheet'"], [core, "router.put('/pools/:id/technical-sheet'"],
  [core, "router.post('/technicians'"], [core, "router.put('/technicians/:id'"], [core, "router.delete('/technicians/:id'"],
  [guide, 'router.post("/vehicles"'], [guide, 'router.put("/vehicles/:id"'], [guide, 'router.delete("/vehicles/:id"'], [guide, 'router.post("/vehicles/:id/restore"'],
  [inv, "router.put('/products/:id'"], [inv, "router.delete('/products/:id'"], [inv, "router.post('/products/:id/restore'"],
];
const missing = required.filter(([txt,needle])=>!txt.includes(needle)).map(x=>x[1]);
if(missing.length) fail('Endpoints CRUD/lifecycle em falta: '+missing.join(', ')); else ok('CRUD/lifecycle essencial presente');

// 5. Billing activation guards present in all monthly invoice paths.
const invoiceRoutes = read(path.join(src,'routes','invoiceRoutes.js'));
const billingController = read(path.join(src,'controllers','billingController.js'));
const opFlow = read(path.join(src,'routes','operationalFlowRoutes.js'));
if(!invoiceRoutes.includes('billingActive') || !invoiceRoutes.includes('blockedBillingResponse')) fail('invoiceRoutes sem guarda billingActive'); else ok('invoiceRoutes bloqueia faturação antes da ativação');
if(!billingController.includes('BILLING_DISABLED') || !billingController.includes('billingActive')) fail('billingController sem guarda billingActive'); else ok('billingController bloqueia faturação antes da ativação');
if(!opFlow.includes('billingActive') || !opFlow.includes('canBillClient')) fail('operationalFlowRoutes sem guarda billingActive'); else ok('operationalFlowRoutes bloqueia faturação antes da ativação');

// 6. Vehicle/guide endpoints wired and frontend calls match.
const adminVehicles = read(path.join(frontend,'admin-vehicles.js'));
['/vehicles','/transport','/work/start','/consume','/maintenance'].forEach(endpoint=>{ if(!adminVehicles.includes(endpoint)) fail('admin-vehicles.js sem chamada '+endpoint); });
ok('Viaturas/guias chamadas principais presentes');

// 7. Service worker no longer caches obsolete experimental pages.
const sw = read(path.join(frontend,'sw.js'));
if(sw.includes('/admin-core-flow') || sw.includes('/admin-menu')) fail('Service worker ainda guarda páginas antigas'); else ok('Service worker sem páginas antigas no cache');

if(process.exitCode){ process.exit(process.exitCode); }
console.log('✅ V22.6.4 deep enterprise audit OK');
