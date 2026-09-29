'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const words = {
  pt: { title:'Fichas pendentes de validação', reload:'Atualizar fichas', approve:'Aprovar cadastro', open:'Abrir ficha', phone:'Telefone', absent:'Não indicado', pending:'pendente de revisão', reviewed:'já revisto', pool:'Piscina', empty:'Sem fichas pendentes nos dados consultados.', unknown:'A lista de fichas ainda não está confirmada.', query:'Consulta por confirmar.', queryError:'Não foi possível confirmar as fichas atuais.', ready:'Fichas consultadas.', unconfirmed:'Aprovação por confirmar.', saved:'Confirmar aprovação guardada', rereview:'Rever ficha atual', confirmed:'Aprovação confirmada:', session:'A sessão mudou.', confirm:'Aprovar este cliente e ativar as piscinas pendentes apresentadas?' },
  en: { title:'Records awaiting validation', reload:'Refresh records', approve:'Approve registration', open:'Open record', phone:'Phone', absent:'Not provided', pending:'awaiting review', reviewed:'already reviewed', pool:'Pool', empty:'No pending records in the data checked.', unknown:'The record list is not yet confirmed.', query:'Query awaiting confirmation.', queryError:'Could not confirm the current records.', ready:'Records retrieved.', unconfirmed:'Approval awaiting confirmation.', saved:'Confirm saved approval', rereview:'Review current record', confirmed:'Approval confirmed:', session:'The session has changed.', confirm:'Approve this client and activate the pending pools shown?' },
  fr: { title:'Fiches en attente de validation', reload:'Actualiser les fiches', approve:'Approuver l’inscription', open:'Ouvrir la fiche', phone:'Téléphone', absent:'Non indiqué', pending:'en attente de vérification', reviewed:'déjà vérifié', pool:'Piscine', empty:'Aucune fiche en attente dans les données consultées.', unknown:'La liste des fiches n’est pas encore confirmée.', query:'Consultation à confirmer.', queryError:'Impossible de confirmer les fiches actuelles.', ready:'Fiches consultées.', unconfirmed:'Approbation à confirmer.', saved:'Confirmer l’approbation enregistrée', rereview:'Vérifier la fiche actuelle', confirmed:'Approbation confirmée :', session:'La session a changé.', confirm:'Approuver ce client et activer les piscines en attente affichées ?' },
  es: { title:'Fichas pendientes de validación', reload:'Actualizar fichas', approve:'Aprobar registro', open:'Abrir ficha', phone:'Teléfono', absent:'No indicado', pending:'pendiente de revisión', reviewed:'ya revisado', pool:'Piscina', empty:'No hay fichas pendientes en los datos consultados.', unknown:'La lista de fichas aún no está confirmada.', query:'Consulta por confirmar.', queryError:'No se pudieron confirmar las fichas actuales.', ready:'Fichas consultadas.', unconfirmed:'Aprobación por confirmar.', saved:'Confirmar aprobación guardada', rereview:'Revisar ficha actual', confirmed:'Aprobación confirmada:', session:'La sesión ha cambiado.', confirm:'¿Aprobar este cliente y activar las piscinas pendientes mostradas?' },
  de: { title:'Datensätze zur Prüfung', reload:'Datensätze aktualisieren', approve:'Registrierung genehmigen', open:'Datensatz öffnen', phone:'Telefon', absent:'Nicht angegeben', pending:'Prüfung ausstehend', reviewed:'bereits geprüft', pool:'Pool', empty:'Keine ausstehenden Datensätze in den geprüften Daten.', unknown:'Die Liste der Datensätze ist noch nicht bestätigt.', query:'Abfrage noch nicht bestätigt.', queryError:'Die aktuellen Datensätze konnten nicht bestätigt werden.', ready:'Datensätze abgerufen.', unconfirmed:'Genehmigung noch nicht bestätigt.', saved:'Gespeicherte Genehmigung bestätigen', rereview:'Aktuellen Datensatz prüfen', confirmed:'Genehmigung bestätigt:', session:'Die Sitzung hat sich geändert.', confirm:'Diesen Kunden genehmigen und die angezeigten ausstehenden Pools aktivieren?' }
};
let browser, completed = false;
const releases = [], settings = new Map(), deadline = setTimeout(() => { console.error('Intake review language assertions did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const tech = await prisma.technician.create({ data:{name:'Intake language technician',active:true} });
  const admin = await prisma.user.create({data:{name:'Intake language reviewer',email:'intake-language-owner-'+randomUUID()+'@qa.test',password:'qa-unused',role:'ADMIN',active:true}});
  const other = await prisma.user.create({data:{name:'Other language reviewer',email:'intake-language-'+randomUUID()+'@qa.test',password:'qa-unused',role:'ADMIN',active:true}});
  const sign = (person,role) => jwt.sign({id:person.id,role},getJwtSecret(),{expiresIn:'1h'}), token = sign(admin,'ADMIN');
  for (const [key,value] of Object.entries({TECHNICIANS_CAN_CREATE_CLIENTS_POOLS:'true',TECHNICIAN_CREATED_RECORDS_REQUIRE_ADMIN_REVIEW:'true',TECHNICIAN_CREATED_POOLS_ACTIVE_BY_DEFAULT:'false'})) { settings.set(key,await prisma.systemSetting.findUnique({where:{key}})); await prisma.systemSetting.upsert({where:{key},create:{key,value},update:{value}}); }
  const literal = 'Original <img src=x onerror=window.qaInjected=true> {id}';
  const response = await fetch(base+'/api/technician-intake/client-with-pool',{method:'POST',headers:{Authorization:'Bearer '+sign(tech,'TECHNICIAN'),'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),clientName:literal,phone:'910000000',email:'intake-language@qa.test',address:'Morada <b>literal</b>',zone:'Zona {name}',poolName:literal+' pool',poolType:'Hotel',volumeM3:'45,5',latitude:'0',longitude:'0',notes:'Notas <b>originais</b> {phone}'})});
  assert.equal(response.status,200); const intake = await response.json(), id = intake.client.id;
  const reviewed = await prisma.pool.create({data:{clientId:id,name:'Revista <b>original</b>',active:false,pendingReview:false,reviewStatus:'APPROVED',reviewedAt:new Date('2025-01-01T00:00:00Z'),reviewedByUserId:admin.id}});
  const partial = await prisma.client.create({data:{name:'Cliente parcialmente revisto',active:true,pendingReview:false,reviewStatus:'APPROVED'}});
  const missing = await prisma.pool.create({data:{clientId:partial.id,name:null,active:false,pendingReview:true,reviewStatus:'PENDING'}});
  const emptyClient = await prisma.client.create({data:{name:'Cliente sem piscinas',active:false,pendingReview:true,reviewStatus:'PENDING'}});
  const side = () => Promise.all([prisma.invoice.findMany({orderBy:{id:'asc'}}),prisma.serviceVisit.findMany({orderBy:{id:'asc'}}),prisma.stockMovement.findMany({orderBy:{id:'asc'}})]), sideBefore = await side();
  const originalClient = await prisma.client.findUnique({where:{id}}), originalPool = await prisma.pool.findUnique({where:{id:intake.pool.id}});
  browser = await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context = await browser.newContext({viewport:{width:390,height:900},timezoneId:'Europe/Lisbon'});
  await context.addInitScript(({token,admin,origin}) => {
    if(top!==window||location.origin!==origin)return;
    if(!localStorage.getItem('qaIntakeLanguage')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:admin.id,name:admin.name,role:'ADMIN'}));localStorage.setItem('qaIntakeLanguage','1');}
    window.qaIntakeReads=0; let writeStore;
    Object.defineProperty(window,'CWFieldWriteStore',{configurable:true,get:()=>writeStore,set(value){writeStore=value;window.qaIntakeRecords=value.records;value.records=function(...args){qaIntakeReads++;return qaIntakeRecords.apply(this,args);};}});
    const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,handler,...rest){if(type==='click'&&(this.id==='intakeReviewReload'||this.dataset?.intakeApprove||this.dataset?.intakeRecover)){return add.call(this,type,function(event){window.qaIntakeAction=Promise.resolve(handler.call(this,event));},...rest);}return add.call(this,type,handler,...rest);};
    const interval=setInterval;window.setInterval=(fn,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(fn,delay,...args);
  },{token,admin,origin:new URL(base).origin});
  const page = await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push({path:new URL(r.url()).pathname,method:r.method(),body:r.postData()});});
  const endpoint = '/api/technician-intake/clients/'+id+'/approve', pendingPath = '**/api/technician-intake/pending-review';
  const card = clientId => page.locator('[data-intake-client="'+clientId+'"]'), recover = requestId => page.locator('[data-intake-recover="'+requestId+'"]');
  const records = () => page.evaluate(()=>qaIntakeRecords('FIELD_CLIENT_APPROVAL',CWFieldWriteStore.adminSession(),true));
  const snapshot = () => page.evaluate(async()=>({rows:await qaIntakeRecords('FIELD_CLIENT_APPROVAL',CWFieldWriteStore.adminSession(),true),storage:Object.fromEntries(Object.keys(localStorage).filter(k=>/^cwField/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))}));
  const status = () => page.locator('#intakeReviewStatus').textContent(), locale = language => page.locator('#cwLanguageSelect').selectOption(language);
  async function action(node,accept){if(accept!==undefined)page.once('dialog',d=>accept?d.accept():d.dismiss());await node.click();await page.evaluate(()=>qaIntakeAction);}
  const refresh = () => action(page.locator('#intakeReviewReload'));
  function languageOnly(index){for(const r of requests.slice(index)){assert.equal(r.path,'/api/settings/language/me',JSON.stringify(r));assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);assert(Object.hasOwn(words,JSON.parse(r.body).language));}}
  async function cycle(check,widths=[390],focus='#intakeReviewReload'){
    const before=await snapshot(),index=requests.length,reads=await page.evaluate(()=>qaIntakeReads);
    const otherPanel=await page.locator('#accessControlPanel').textContent();
    await page.evaluate(selector=>{window.qaIntakeNodes=Array.from(document.querySelectorAll('#pendingList,#pendingList *'));document.querySelector(selector)?.focus();window.qaIntakeFocus=document.activeElement;},focus);
    for(const width of widths){await page.setViewportSize({width,height:900});for(const [language,w] of Object.entries(words)){
      // Applying the actual language engine avoids moving focus to the selector.
      await page.evaluate(language=>CristalI18n.applyLanguage(language),language);
      assert.equal(await page.locator('#intakeReviewReload').textContent(),w.reload);await check(language,w);
      assert.deepEqual(await snapshot(),before,'Language must preserve exact operations, hashes, failures and receipts');
      assert.equal(await page.locator('#accessControlPanel').textContent(),otherPanel,'The newly loaded engine must not translate other panels or their literal data');
      assert(await page.evaluate(()=>qaIntakeNodes.every(node=>node.isConnected)&&document.activeElement===qaIntakeFocus),'Language must preserve nodes and focus');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
    }}
    assert.equal(await page.evaluate(()=>qaIntakeReads),reads,'Language must not reread the outbox');languageOnly(index);
  }
  await page.goto(base+'/admin-operational-settings',{waitUntil:'networkidle'});await card(id).waitFor();await locale('en');
  assert.equal(await page.locator('#intakeReviewReload').textContent(),words.en.reload);
  await cycle(async(language,w)=>{
    assert.equal(await page.locator('#pendingList').locator('..').locator('h2').textContent(),w.title);
    assert.equal(await card(id).locator('button').textContent(),w.approve);assert.equal(await card(id).locator('a').textContent(),w.open);assert.equal(await card(id).locator('a').getAttribute('href'),'/client-detail?id='+id);
    const text=await card(id).textContent();for(const value of [literal,'Morada <b>literal</b>','Zona {name}','45.5 m³','0, 0','Notas <b>originais</b> {phone}',w.phone,w.pending])assert(text.includes(value),value);
    assert((await card(partial.id).textContent()).includes(w.reviewed));assert((await card(partial.id).textContent()).includes(w.absent));assert((await card(partial.id).textContent()).includes(w.pool+(language==='fr'?' n°':' #')+missing.id));assert((await status()).startsWith(w.ready));
    assert.equal(await page.locator('#pendingList img,#pendingList b').count(),0);
  },[320,390,1440],'[data-intake-approve="'+id+'"]');
  assert.deepEqual(await prisma.client.findUnique({where:{id}}),originalClient);assert.deepEqual(await prisma.pool.findUnique({where:{id:intake.pool.id}}),originalPool);
  for(const [language,w] of Object.entries(words)){await locale(language);const index=requests.length;let message;page.once('dialog',d=>{message=d.message();return d.dismiss();});await action(card(id).locator('button'));assert.equal(message,w.confirm);assert.equal((await records()).length,0);languageOnly(index);}
  if(process.env.CW_CAPTURE_UI){await page.setViewportSize({width:320,height:900});fs.mkdirSync('reports/field-ui',{recursive:true});await page.locator('#pendingList').locator('..').screenshot({path:'reports/field-ui/INTAKE_REVIEW_DE_320.png'});}
  console.log('PASS five languages/320/390/1440, literal client/pool fields, missing data, pending/reviewed states, links, immutable nodes/focus/records and cancelled confirmation');

  await page.evaluate(()=>{window.qaAdd=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(row,...args){if(row.scope==='FIELD_CLIENT_APPROVAL')throw new DOMException('QA approval quota','QuotaExceededError');return qaAdd.call(this,row,...args);};});
  const posts=()=>requests.filter(r=>r.method==='POST'&&r.path===endpoint);const beforeQuota=posts().length;
  await action(card(id).locator('button'),true);assert.equal(posts().length,beforeQuota);assert.equal((await records()).length,0);
  await cycle(async(language,w)=>assert.equal(await status(),w.unconfirmed+' QA approval quota'));
  await page.evaluate(()=>{IDBObjectStore.prototype.add=qaAdd;});
  const external='A sessão mudou. Reabra com a conta original. <b>Servidor</b> {id}';
  const deny=route=>route.fulfill({status:403,json:{error:external}});await page.route('**'+endpoint,deny);
  await action(card(id).locator('button'),true);const pending=(await records()).find(row=>!row.response);assert(pending);const body=posts().at(-1).body;
  await cycle(async(language,w)=>{assert.equal(await recover(pending.requestId).textContent(),w.saved);assert.equal(await status(),w.unconfirmed+' '+external);assert((await page.locator('[data-intake-pending="'+pending.requestId+'"]').textContent()).includes(external));});await page.unroute('**'+endpoint,deny);
  assert.deepEqual(await prisma.client.findUnique({where:{id}}),originalClient);
  await prisma.pool.update({where:{id:intake.pool.id},data:{notes:'Revisão posterior <b>literal</b>'}});
  await action(recover(pending.requestId));const refused=(await records()).find(row=>row.requestId===pending.requestId);assert.equal(refused.response.code,'INTAKE_APPROVAL_STALE');assert.equal(posts().at(-1).body,body);
  await cycle(async(language,w)=>{assert.equal(await recover(pending.requestId).textContent(),w.rereview);assert((await page.locator('[data-intake-pending="'+pending.requestId+'"]').textContent()).includes(refused.response.message));});
  await action(recover(pending.requestId));await card(id).waitFor();assert((await card(id).textContent()).includes('Revisão posterior <b>literal</b>'));assert((await records()).find(row=>row.requestId===pending.requestId).reviewedAt);
  console.log('PASS quota sends nothing, server error remains literal in all languages, stale refusal preserves UUID/payload and explicit rereview reveals the current record');

  let release,entered;const gate=new Promise(resolve=>{release=resolve;releases.push(resolve);}),started=new Promise(resolve=>{entered=resolve;});
  const lose=async route=>{const response=await route.fetch();assert.equal(response.status(),200);entered();await gate;await route.fulfill({status:503,json:{}});};await page.route('**'+endpoint,lose);
  const sending=action(card(id).locator('button'),true);await started;const held=(await records()).find(row=>!row.response);
  await cycle(async()=>{assert(await page.locator('#intakeReviewReload').isDisabled());for(const node of await page.locator('#intakeReviewList button').all())assert(await node.isDisabled());});
  release();await sending;await page.unroute('**'+endpoint,lose);assert.equal(await card(id).count(),0);const sentBody=posts().at(-1).body;
  const sendUnconfirmed={pt:'Envio por confirmar. Conserve o pedido original.',en:'Submission awaiting confirmation. Keep the original request.',fr:'Envoi en attente de confirmation. Conservez la demande d’origine.',es:'Envío pendiente de confirmación. Conserve la solicitud original.',de:'Sendung wartet auf Bestätigung. Bewahren Sie die ursprüngliche Anfrage auf.'};
  await cycle(async(language,w)=>{assert.equal(await recover(held.requestId).textContent(),w.saved);assert.equal(await status(),w.unconfirmed+' '+sendUnconfirmed[language]);assert((await page.locator('[data-intake-pending="'+held.requestId+'"]').textContent()).includes(sendUnconfirmed.pt));});
  await page.reload({waitUntil:'networkidle'});await recover(held.requestId).waitFor();await action(recover(held.requestId));assert.equal(posts().at(-1).body,sentBody);
  const confirmed=(await records()).find(row=>row.requestId===held.requestId);assert.equal(confirmed.response.applied,true);assert.equal(confirmed.response.approval.reviewedByUserId,admin.id);assert.deepEqual(confirmed.response.approval.poolIds,[intake.pool.id]);
  await cycle(async(language,w)=>{const text=await page.locator('#intakeReviewList').textContent();assert(text.includes(w.confirmed));const expected=await page.evaluate(({date,locale})=>new Date(date).toLocaleString(locale),{date:confirmed.response.approval.reviewedAt,locale:{pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'}[language]});assert(text.includes(expected));});
  assert.equal(await prisma.userAuditLog.count({where:{action:'FIELD_CLIENT_INTAKE_APPROVED',entityId:String(id)}}),1);
  assert.equal(await prisma.fieldWriteRequest.count({where:{scope:'FIELD_CLIENT_APPROVAL',resourceId:id}}),2);
  assert.deepEqual(await prisma.pool.findUnique({where:{id:reviewed.id}}),reviewed);assert.deepEqual(await side(),sideBefore);
  const approvedClient=await prisma.client.findUnique({where:{id}});
  assert.deepEqual(approvedClient,{...originalClient,status:'ACTIVE',active:true,pendingReview:false,reviewStatus:'APPROVED',reviewedAt:new Date(confirmed.response.approval.reviewedAt),reviewedByUserId:admin.id,updatedAt:approvedClient.updatedAt});
  assert(approvedClient.updatedAt>=originalClient.updatedAt);
  console.log('PASS language changes during the held real approval preserve locks; lost response/reload/exact retry gives one approval and original reviewer/date with no billing, visits or stock effects');

  await page.route(pendingPath,route=>route.fulfill({status:503,json:{ok:false,error:'QA list unavailable'}}));await refresh();
  await cycle(async(language,w)=>{assert((await status()).startsWith(w.query));assert((await status()).endsWith(w.queryError));assert((await page.locator('#intakeReviewList').textContent()).includes(w.unknown));});await page.unroute(pendingPath);
  await context.setOffline(true);await refresh();await cycle(async(language,w)=>{assert((await status()).startsWith(w.query));assert((await page.locator('#intakeReviewList').textContent()).includes(w.unknown));});await context.setOffline(false);
  await page.route(pendingPath,route=>route.fulfill({json:{ok:true,clients:[]}}));await refresh();await cycle(async(language,w)=>assert((await page.locator('#intakeReviewList').textContent()).includes(w.empty)));await page.unroute(pendingPath);
  await refresh();await card(partial.id).waitFor();
  assert.equal(await page.evaluate(async()=>{document.documentElement.lang='en';await new Promise(requestAnimationFrame);return document.getElementById('intakeReviewReload').textContent;}),'Refresh records');
  await locale('en');
  const partialBefore=await prisma.client.findUnique({where:{id:partial.id}}),emptyBefore=await prisma.client.findUnique({where:{id:emptyClient.id}});
  await page.evaluate(({other,token})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:other.id,name:other.name,role:'ADMIN'}));dispatchEvent(new StorageEvent('storage'));},{other,token:sign(other,'ADMIN')});
  await page.waitForFunction(()=>document.getElementById('intakeReviewList').textContent==='');
  // The original session guard polls every second; it legitimately rereads its session.
  for(const [language,w] of Object.entries(words)){await locale(language);assert((await status()).startsWith(w.session));assert(await page.locator('#intakeReviewReload').isDisabled());assert.equal(await page.locator('#intakeReviewList').textContent(),'');}
  assert.deepEqual(await prisma.client.findUnique({where:{id:partial.id}}),partialBefore);assert.deepEqual(await prisma.client.findUnique({where:{id:emptyClient.id}}),emptyBefore);
  assert.equal(await page.evaluate(()=>window.qaInjected),undefined);assert.deepEqual(errors,[]);
  console.log('PASS query failure/offline/empty states, attribute-only language change and account change preserve receipts and disable approvals');completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)release();await browser?.close();for(const [key,row] of settings){if(row)await prisma.systemSetting.upsert({where:{key},create:row,update:{value:row.value,notes:row.notes}});else await prisma.systemSetting.deleteMany({where:{key}});}await prisma.$disconnect();clearTimeout(deadline);});
