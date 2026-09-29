'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs'),jwt=require('jsonwebtoken'),{chromium}=require('playwright'),wait=require('./fixtures/wait-browser-state');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const words={
 pt:{regular:'Visita ',extra:'Visita extra ',pending:'revisão por confirmar no servidor',blocked:'; precisa de apoio do escritório',rejected:'revisão não aplicada: ',draft:'rascunho de revisão guardado, ainda não enviado.'},
 en:{regular:'Visit ',extra:'Extra visit ',pending:'maintenance awaiting server confirmation',blocked:'; office support needed',rejected:'maintenance not applied: ',draft:'maintenance draft saved, not sent yet.'},
 fr:{regular:'Visite ',extra:'Visite supplémentaire ',pending:'entretien à confirmer sur le serveur',blocked:'; aide du bureau nécessaire',rejected:'entretien non appliqué : ',draft:'brouillon d’entretien enregistré, pas encore envoyé.'},
 es:{regular:'Visita ',extra:'Visita extra ',pending:'revisión pendiente de confirmación en el servidor',blocked:'; necesita apoyo de la oficina',rejected:'revisión no aplicada: ',draft:'borrador de revisión guardado, aún no enviado.'},
 de:{regular:'Besuch ',extra:'Zusatzbesuch ',pending:'Wartung wartet auf Serverbestätigung',blocked:'; Unterstützung durch das Büro erforderlich',rejected:'Wartung nicht übernommen: ',draft:'Wartungsentwurf gespeichert, noch nicht gesendet.'}
};
let browser,completed=false;const releases=[];
const deadline=setTimeout(()=>{console.error('Equipment summary language assertions did not finish');process.exit(1);},90000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const tech=await prisma.technician.create({data:{name:'Equipment summary technician',active:true}}),client=await prisma.client.create({data:{name:'Equipment summary client',active:true}}),pool=await prisma.pool.create({data:{clientId:client.id,name:'Equipment summary pool',active:true}});
 const title='Filtro <img src=x onerror=window.qaInjected=true> {visit} — Conservar';
 const plan=await prisma.equipmentMaintenancePlan.create({data:{poolId:pool.id,component:'FILTER',title,instructions:'Verificar vedação e conservar instruções originais.',intervalUnit:'MONTHS',intervalCount:1,nextDue:new Date('2020-01-01')}});
 const maxima=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),id=Math.max(...maxima.map(row=>row._max.id||0))+1;
 const regular=await prisma.serviceVisit.create({data:{id,clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'IN_PROGRESS',startAt:new Date(),date:new Date(),plannedDate:new Date()}});
 const extra=await prisma.extraVisit.create({data:{id,clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'IN_PROGRESS',startAt:new Date(),scheduledAt:new Date(),internalNote:'Original extra instructions'}});
 for(const name of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe("SELECT setval(pg_get_serial_sequence('\""+name+"\"','id'),"+id+",true)");
 const token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),owner='TECH:'+tech.id,key=type=>'cwEquipmentDraft:v1:'+owner+':'+type+':'+id+':'+plan.id;
 const notes='Observação original <b>Guardar</b> {title} 17,25';
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900}});
 await context.addInitScript(({token,tech,origin})=>{
  if(top!==window||location.origin!==origin)return;
  if(!localStorage.getItem('qaEquipmentSummaries')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('qaEquipmentSummaries','1');}
  const interval=setInterval;window.setInterval=(callback,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(callback,delay,...args);
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=()=>{};
 },{token,tech,origin:new URL(base).origin});
 const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/settings/language/me')requests.push({path:url.pathname,method:request.method(),body:request.postData()});});
 const snapshot=()=>page.evaluate(async()=>({storage:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('cwEquipment')).sort().map(key=>[key,localStorage.getItem(key)])),rows:await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)}));
 const ready=()=>page.waitForFunction(()=>document.getElementById('dayReviewResult').getAttribute('aria-busy')==='false'&&!document.getElementById('dayReviewBtn').disabled);
 const review=async()=>{await page.locator('[data-field-tab-button="hoje"]').click();await page.locator('#dayReviewBtn').click();await ready();};
 const result=()=>page.locator('#dayReviewResult').textContent();
 const setup=async()=>{await page.waitForFunction(()=>window.CWFieldEquipment&&window.CWFieldStockRequest&&window.CWFieldVisitContext?.());await page.evaluate(()=>{window.qaEquipmentCalls=0;const original=CWFieldEquipment.pendingSummary;CWFieldEquipment.pendingSummary=async function(...args){qaEquipmentCalls++;window.qaEquipmentItems=await original.apply(this,args);return qaEquipmentItems;};});};
 for(const type of ['REGULAR','EXTRA']){
  await page.goto(base+'/technician-field-mode?selectedVisitId='+id+'&selectedVisitType='+type,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(({id,type})=>CWFieldVisitContext?.()?.id===id&&CWFieldVisitContext().visitType===type&&!document.getElementById('fieldEquipmentRefresh').disabled,{id,type});
  await page.locator('[data-field-tab-button="agora"]').click();
  const card=page.locator('#fieldEquipmentList .field-equipment-plan').filter({hasText:title});await card.waitFor();await card.locator('textarea').fill(type+' '+notes);
  await card.getByRole('button',{name:'Marcar início',exact:true}).click();
  await page.waitForFunction(key=>!!JSON.parse(localStorage.getItem(key)||'null')?.workTime,key(type));
  await card.getByRole('button',{name:'Marcar fim',exact:true}).click();
  await card.locator('.field-equipment-materials select').selectOption('DECLARED');
  for(const [field,value]of Object.entries({productName:'Vedante literal {title}',quantity:'1.25',unit:'UN'}))await card.locator('[data-material-field="'+field+'"]').fill(value);
  await page.waitForFunction(({key,notes})=>{const d=JSON.parse(localStorage.getItem(key)||'null'),t=d?.workTime;return d?.notes===notes&&(t?.intervals?.at(-1)?.endAt||t?.endAt)&&d.materials?.items[0]?.productName==='Vedante literal {title}'&&d.materials.items[0].quantity==='1.25'&&d.materials.items[0].unit==='UN';},{key:key(type),notes:type+' '+notes});
 }
 await setup();await page.locator('#cwLanguageSelect').selectOption('pt');await review();
 async function cycle({pending=false,receipt='',widths=[320,390,1440]}={}){
  const before=await snapshot(),count=requests.length,calls=await page.evaluate(()=>qaEquipmentCalls);
  await page.locator('#cwLanguageSelect').selectOption('pt');const stamp=await page.locator('#dayReviewResult small').textContent();
  await page.evaluate(()=>{window.qaReviewNodes=[...document.querySelectorAll('#dayReviewResult *')];window.qaReviewButton=document.getElementById('dayReviewBtn');});
  for(const width of widths){await page.setViewportSize({width,height:900});await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();for(const [language,w]of Object.entries(words)){
   await page.locator('#cwLanguageSelect').selectOption(language);const actual=await result();
   const fragments=[w.regular+id+' — '+title+': '+w.draft,pending?w.extra+id+' — '+title+': '+w.pending+w.blocked+'.':w.extra+id+' — '+title+': '+w.draft,...(receipt?[w.regular+id+' — '+w.rejected+receipt]:[])];
   for(const fragment of fragments)assert(actual.includes(fragment),language+': missing '+fragment+' in '+actual);
   assert.deepEqual(await snapshot(),before,'Language must preserve draft/cache bytes, notes/time/materials, UUID/payload/hash, failure and receipt');
   assert.equal(await page.evaluate(()=>qaEquipmentCalls),calls,'Language must not read the equipment producer again');
   const state=await page.evaluate(()=>{qaReviewButton.focus();return{same:qaReviewNodes.every(node=>node.isConnected),busy:document.getElementById('dayReviewResult').getAttribute('aria-busy'),disabled:qaReviewButton.disabled,overflow:document.documentElement.scrollWidth>innerWidth+1};});
   assert(state.same&&state.busy==='false'&&!state.disabled&&!state.overflow,JSON.stringify(state));await page.evaluate(language=>CristalI18n.applyLanguage(language),language);assert(await page.evaluate(()=>document.activeElement===qaReviewButton));
  }}
  await page.locator('#cwLanguageSelect').selectOption('pt');assert.equal(await page.locator('#dayReviewResult small').textContent(),stamp);assert.equal(requests.length,count,'Language must not issue operational requests');
  const contract=await page.evaluate(()=>qaEquipmentItems.map(item=>({keys:Object.keys(item),serialized:JSON.stringify(item),plain:JSON.stringify({kind:item.kind,text:item.text}),frozen:Object.isFrozen(item.reviewText),languages:Object.keys(item.reviewText||{}),strings:Object.values(item.reviewText||{}).every(value=>typeof value==='string'),descriptor:Object.getOwnPropertyDescriptor(item,'reviewText'),text:item.text,pt:item.reviewText?.pt})));
  assert.equal(contract.length,pending?3:2);
  for(const item of contract){assert.deepEqual(item.keys,['kind','text']);assert.equal(item.serialized,item.plain);assert.equal(item.text,item.pt);assert(item.frozen&&item.strings);assert.deepEqual(item.languages,['pt','en','fr','es','de']);assert.equal(item.descriptor.enumerable,false);assert.equal(item.descriptor.writable,false);assert.equal(item.descriptor.configurable,false);}
 }
 await cycle();assert.deepEqual(await prisma.equipmentMaintenancePlan.findUnique({where:{id:plan.id}}),plan);assert.equal(await prisma.equipmentMaintenanceCompletion.count({where:{planId:plan.id}}),0);
 console.log('PASS real REGULAR/EXTRA equal-ID equipment drafts in five languages at320/390/1440; notes, time, materials, original JSON, immutable copy, nodes/focus/stamp and no producer reads or requests');

 await page.route('**/api/equipment-maintenance/plans/*/complete',route=>route.request().postDataJSON().visitType==='EXTRA'?route.fulfill({status:403,json:{error:'Recusa literal <b>Guardar</b> {title}'}}):route.continue());
 await page.locator('[data-field-tab-button="agora"]').click();const card=page.locator('#fieldEquipmentList .field-equipment-plan').filter({hasText:title});await card.locator('input[type=checkbox]').check();
 const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/equipment-maintenance/visits/'+id&&new URL(r.url()).searchParams.get('visitType')==='EXTRA');
 await card.getByRole('button',{name:'Registar revisão realizada',exact:true}).click();
 await wait(page,()=>CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE').then(rows=>rows.some(row=>row.payload.visitType==='EXTRA'&&row.failure?.blocked)));
 await refreshed;await page.waitForFunction(()=>!document.getElementById('fieldEquipmentRefresh').disabled);
 const updatedPlan=await prisma.equipmentMaintenancePlan.update({where:{id:plan.id},data:{version:{increment:1}}});
 const receipt=await page.evaluate(async key=>{
  const captured=CWFieldWriteStore.session(),d=JSON.parse(localStorage.getItem(key));
  const row=await CWFieldWriteStore.prepare('EQUIPMENT_MAINTENANCE',d.planId,{visitType:d.visitType,visitId:d.visitId,poolId:d.poolId,expectedVersion:d.expectedVersion,notes:d.notes,confirmed:true,workTime:d.workTime,materials:CWFieldWriteStore.equipmentMaterials(d.materials)},{label:d.title},captured);
  return CWFieldWriteStore.send(row.requestId,captured);
 },key('REGULAR'));
 assert.equal(receipt.applied,false);assert.equal(receipt.code,'EQUIPMENT_STALE');await review();await cycle({pending:true,receipt:receipt.message,widths:[320,390]});
 const saved=await snapshot();assert.equal(saved.rows.length,2);assert(saved.rows.every(row=>row.requestId&&row.payloadHash&&row.payload.workTime&&row.payload.materials));assert.equal(await prisma.equipmentMaintenanceCompletion.count({where:{planId:plan.id}}),0);
 console.log('PASS blocked EXTRA request and real stale REGULAR receipt retain typed identities, time/materials and unsent regular draft across locale changes');

 // Matching acknowledgements hide only the matching draft; server text remains literal.
 const detail='Mensagem original <img src=x onerror=window.qaInjected=true> {visit} {title}';
 const projected=await page.evaluate(async({detail,key})=>{
  const original=CWFieldWriteStore.records,rows=await original('EQUIPMENT_MAINTENANCE',CWFieldWriteStore.session(),true),regular=rows.find(row=>row.payload.visitType==='REGULAR'),extra=rows.find(row=>row.payload.visitType==='EXTRA');
  let changed=false,reviewed=false;
  CWFieldWriteStore.records=async()=>[{...regular,payload:{...regular.payload,notes:regular.payload.notes+(changed?' changed':'')},response:{applied:true}},{...extra,response:{applied:false,message:detail},reviewedAt:reviewed?'2026-09-29T00:00:00Z':null}];
  const read=async()=> (await CWFieldEquipment.pendingSummary()).map(item=>({kind:item.kind,text:item.text,reviewText:item.reviewText}));
  try{const matching=await read();changed=true;const differing=await read();reviewed=true;return{matching,differing,reviewed:await read()};}finally{CWFieldWriteStore.records=original;}
 },{detail,key:key('REGULAR')});
 assert.equal(projected.matching.length,2);assert.equal(projected.differing.length,3);assert.equal(projected.reviewed.length,2);
 const refusal=projected.matching.find(row=>row.text.includes(detail));assert(refusal);assert(Object.values(refusal.reviewText).every(value=>value.endsWith(detail)));assert.deepEqual(await snapshot(),saved);

 async function hold(){
  await page.evaluate(()=>{window.qaEquipmentHeld=false;window.qaEquipmentOriginal=CWFieldEquipment.pendingSummary;const gate=new Promise(resolve=>window.qaReleaseEquipment=resolve);CWFieldEquipment.pendingSummary=async function(...args){const rows=await qaEquipmentOriginal.apply(this,args);qaEquipmentHeld=true;await gate;return rows;};});
  releases.push(()=>page.evaluate(()=>window.qaReleaseEquipment?.()).catch(()=>{}));await page.locator('#dayReviewBtn').click();await page.waitForFunction(()=>qaEquipmentHeld);
 }
 const release=()=>page.evaluate(()=>{CWFieldEquipment.pendingSummary=qaEquipmentOriginal;qaReleaseEquipment();});
 await hold();for(const language of Object.keys(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert(await page.locator('#dayReviewBtn').isDisabled());assert.equal(await page.locator('#dayReviewResult').getAttribute('aria-busy'),'true');}
 await release();await ready();assert((await result()).includes(words.de.pending));await cycle({pending:true,receipt:receipt.message,widths:[320]});
 await page.evaluate(()=>CristalI18n.applyLanguage('fr',{silent:true}));await page.waitForFunction(fragment=>document.getElementById('dayReviewResult').textContent.includes(fragment),words.fr.pending);
 console.log('PASS exact acknowledgement/draft matching, reviewed-refusal filtering, literal server details and held/silent locale changes');
 if(process.env.CW_CAPTURE_UI){fs.mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:320,height:900});await page.locator('#cwLanguageSelect').selectOption('de');await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/REVIEW_EQUIPMENT_DE_320.png'});}

 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await setup();await page.waitForFunction(()=>!document.getElementById('fieldEquipmentRefresh').disabled);await review();await cycle({pending:true,receipt:receipt.message,widths:[320]});assert.deepEqual(await snapshot(),saved);
 const cacheName=fs.readFileSync('frontend/sw.js','utf8').match(/const CACHE = '([^']+)'/)[1];assert(await page.evaluate(name=>caches.keys().then(keys=>keys.includes(name)),cacheName));
 const broken=key('REGULAR');await page.evaluate(key=>localStorage.setItem(key,'{'),broken);await review();assert.equal(await page.locator('#dayReviewResult .day-review-group').count(),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),broken),'{');await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:broken,value:saved.storage[broken]});assert.deepEqual(await snapshot(),saved);
 await hold();await page.evaluate(()=>{window.qaGetToken=CristalAuth.getToken;CristalAuth.getToken=()=>null;});await release();await ready();assert.equal(await page.locator('#dayReviewResult .day-review-group').count(),0);assert(!(await result()).includes(title));
 // A real summary call after the account change must keep this producer closed.
 assert.match(await page.evaluate(()=>CWFieldEquipment.pendingSummary().then(()=>'',error=>error.message)),/A sessão mudou/);await page.evaluate(()=>{CristalAuth.getToken=qaGetToken;});
 assert.match(await page.evaluate(()=>CWFieldEquipment.pendingSummary().then(()=>'',error=>error.message)),/A sessão mudou/);assert.deepEqual(await snapshot(),saved);
 assert.equal(await page.evaluate(()=>window.qaInjected),undefined);assert.deepEqual(errors,[]);
 assert.deepEqual(await prisma.equipmentMaintenancePlan.findUnique({where:{id:plan.id}}),updatedPlan);assert.deepEqual(await prisma.serviceVisit.findUnique({where:{id}}),regular);assert.deepEqual(await prisma.extraVisit.findUnique({where:{id}}),extra);
 assert.equal(await prisma.equipmentMaintenanceCompletion.count({where:{planId:plan.id}}),0);assert.equal(await prisma.fieldWriteRequest.count({where:{requestId:{in:saved.rows.map(row=>row.requestId)}}}),1);
 console.log('PASS offline reload/current cache, corrupt draft preservation, account refusal/closed producer, unchanged visits/plan and zero applied completions');completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)await release();await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
