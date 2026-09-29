'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs'),jwt=require('jsonwebtoken'),{chromium}=require('playwright'),wait=require('./fixtures/wait-browser-state');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const words={
 pt:{regular:'Visita #{id} — rascunho de impedimento guardado.',extra:'Visita extra #{id} — rascunho de impedimento guardado.',pending:'impedimento por confirmar no escritório.',legacy:'Impedimentos antigos por reconciliar com o escritório.'},
 en:{regular:'Visit #{id} — impediment draft saved.',extra:'Extra visit #{id} — impediment draft saved.',pending:'impediment awaiting confirmation by the office.',legacy:'Old impediments awaiting reconciliation with the office.'},
 fr:{regular:'Visite n°{id} — brouillon d’empêchement enregistré.',extra:'Visite supplémentaire n°{id} — brouillon d’empêchement enregistré.',pending:'empêchement à confirmer par le bureau.',legacy:'Anciens empêchements à rapprocher avec le bureau.'},
 es:{regular:'Visita #{id} — borrador de impedimento guardado.',extra:'Visita extra #{id} — borrador de impedimento guardado.',pending:'impedimento pendiente de confirmación por la oficina.',legacy:'Impedimentos antiguos pendientes de conciliación con la oficina.'},
 de:{regular:'Besuch #{id} — Entwurf einer Besuchshinderung gespeichert.',extra:'Zusatzbesuch #{id} — Entwurf einer Besuchshinderung gespeichert.',pending:'Besuchshinderung wartet auf Bestätigung durch das Büro.',legacy:'Alte Besuchshinderungen müssen mit dem Büro abgeglichen werden.'}
};
let browser,completed=false;const releases=[];
const deadline=setTimeout(()=>{console.error('Impediment summary language assertions did not finish');process.exit(1);},90000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const tech=await prisma.technician.create({data:{name:'Impediment summary technician',active:true}}),client=await prisma.client.create({data:{name:'Impediment summary client',active:true}}),pool=await prisma.pool.create({data:{clientId:client.id,name:'Literal pool <img src=x onerror=window.qaInjected=true> {id}',active:true}});
 const maxima=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),id=Math.max(...maxima.map(row=>row._max.id||0))+1;
 const regular=await prisma.serviceVisit.create({data:{id,clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'IN_PROGRESS',startAt:new Date(),date:new Date(),plannedDate:new Date()}});
 const extra=await prisma.extraVisit.create({data:{id,clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'IN_PROGRESS',startAt:new Date(),scheduledAt:new Date(),internalNote:'Keep the original instructions'}});
 for(const name of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe("SELECT setval(pg_get_serial_sequence('\""+name+"\"','id'),"+id+",true)");
 const token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),owner='TECH:'+tech.id;
 const key=type=>'cwIncompleteV2:'+owner+':VISIT_INCOMPLETE:'+type+':'+id,legacyKey='cwIncompleteVisits:'+tech.id;
 const notes='Conservar <b>texto original</b> {id} 17,25 — confirmar chave e acesso';
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900}});
 await context.addInitScript(({token,tech,origin})=>{
  if(top!==window||location.origin!==origin)return;
  if(!localStorage.getItem('qaImpedimentSummaries')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('qaImpedimentSummaries','1');}
  const interval=setInterval;window.setInterval=(callback,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(callback,delay,...args);
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=()=>{};
 },{token,tech,origin:new URL(base).origin});
 const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/settings/language/me')requests.push({path:url.pathname,method:request.method(),body:request.postData()});});
 const snapshot=()=>page.evaluate(async()=>({storage:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('cwIncomplete')).sort().map(key=>[key,localStorage.getItem(key)])),rows:await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)}));
 const ready=()=>page.waitForFunction(()=>document.getElementById('dayReviewResult').getAttribute('aria-busy')==='false'&&!document.getElementById('dayReviewBtn').disabled);
 const review=async()=>{await page.locator('[data-field-tab-button="hoje"]').click();await page.locator('#dayReviewBtn').click();await ready();};
 const result=()=>page.locator('#dayReviewResult').textContent();
 const setup=async()=>{
  await page.waitForFunction(()=>window.CWFieldIncomplete&&window.CWFieldStockRequest&&window.CWFieldVisitContext?.());
  await page.evaluate(()=>{window.qaSummaryCalls=0;const original=CWFieldIncomplete.pendingSummary;CWFieldIncomplete.pendingSummary=async function(...args){qaSummaryCalls++;window.qaCapturedImpediments=await original.apply(this,args);return qaCapturedImpediments;};});
 };
 for(const type of ['REGULAR','EXTRA']){
  await page.goto(base+'/technician-field-mode?selectedVisitId='+id+'&selectedVisitType='+type,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(({id,type})=>CWFieldVisitContext?.()?.id===id&&CWFieldVisitContext().visitType===type&&!document.getElementById('incompleteSave').disabled,{id,type});
  await page.locator('[data-field-tab-button="agora"]').click();await page.locator('#incompleteVisitCard summary').click();
  await page.locator('#incompleteReason').selectOption('ACCESS_BLOCKED');await page.locator('#incompleteNextStep').fill(type+' '+notes);
  await page.waitForFunction(({key,notes})=>{const value=JSON.parse(localStorage.getItem(key)||'null');return value?.values.incompleteReason==='ACCESS_BLOCKED'&&value.values.incompleteNextStep===notes;},{key:key(type),notes:type+' '+notes});
 }
 await setup();await page.locator('#cwLanguageSelect').selectOption('pt');await review();
 async function cycle({pending=false,legacy=false,receipt='',widths=[320,390,1440]}={}){
  const before=await snapshot(),count=requests.length,calls=await page.evaluate(()=>qaSummaryCalls);
  await page.locator('#cwLanguageSelect').selectOption('pt');const stamp=await page.locator('#dayReviewResult small').textContent();
  await page.evaluate(()=>{window.qaReviewNodes=[...document.querySelectorAll('#dayReviewResult *')];window.qaReviewButton=document.getElementById('dayReviewBtn');});
  for(const width of widths){await page.setViewportSize({width,height:900});await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();for(const [language,w] of Object.entries(words)){
   await page.locator('#cwLanguageSelect').selectOption(language);const actual=await result();
   for(const fragment of [w.regular.replace('{id}',id),w.extra.replace('{id}',id),...(pending?[w.pending]:[]),...(legacy?[w.legacy]:[]),...(receipt?[receipt]:[])])assert(actual.includes(fragment),language+': missing '+fragment+' in '+actual);
   assert.deepEqual(await snapshot(),before,'Language must preserve exact drafts, snapshots, UUID/payload/hash, receipt and failure');
   assert.equal(await page.evaluate(()=>qaSummaryCalls),calls,'Language must not read the producer again');
   const state=await page.evaluate(()=>{qaReviewButton.focus();return {same:qaReviewNodes.every(node=>node.isConnected),busy:document.getElementById('dayReviewResult').getAttribute('aria-busy'),disabled:qaReviewButton.disabled,overflow:document.documentElement.scrollWidth>innerWidth+1};});
   assert(state.same&&state.busy==='false'&&!state.disabled&&!state.overflow,JSON.stringify(state));
   await page.evaluate(language=>CristalI18n.applyLanguage(language),language);assert(await page.evaluate(()=>document.activeElement===qaReviewButton));
  }}
  await page.locator('#cwLanguageSelect').selectOption('pt');assert.equal(await page.locator('#dayReviewResult small').textContent(),stamp);assert.equal(requests.length,count,'Language must not issue operational requests');
  const contract=await page.evaluate(()=>qaCapturedImpediments.map(item=>({keys:Object.keys(item),serialized:JSON.stringify(item),plain:JSON.stringify({kind:item.kind,text:item.text}),frozen:Object.isFrozen(item.reviewText),languages:Object.keys(item.reviewText||{}),strings:Object.values(item.reviewText||{}).every(value=>typeof value==='string'),descriptor:Object.getOwnPropertyDescriptor(item,'reviewText'),text:item.text,pt:item.reviewText?.pt})));
  for(const item of contract){assert.deepEqual(item.keys,['kind','text']);assert.equal(item.serialized,item.plain);assert.equal(item.text,item.pt);assert(item.frozen&&item.strings);assert.deepEqual(item.languages,['pt','en','fr','es','de']);assert.equal(item.descriptor.enumerable,false);assert.equal(item.descriptor.writable,false);assert.equal(item.descriptor.configurable,false);}
 }
 await cycle();
 assert.deepEqual(await prisma.serviceVisit.findUnique({where:{id}}),regular);assert.deepEqual(await prisma.extraVisit.findUnique({where:{id}}),extra);
 console.log('PASS real REGULAR/EXTRA equal-ID drafts at five languages and320/390/1440; original JSON, frozen copy, bytes, nodes/focus/stamp and no producer reads or operational requests');

 // Preserve a real rejected receipt and an unconfirmed request at the same typed ID.
 await page.route('**/api/technician/visits/*/incomplete',route=>route.request().method()==='POST'&&route.request().postDataJSON().visitType==='EXTRA'?route.fulfill({status:503,json:{error:'Falha literal <b>Guardar</b> {id}'}}):route.continue());
 await page.locator('[data-field-tab-button="agora"]').click();await page.locator('#incompleteSave').click();
 await wait(page,()=>CWFieldWriteStore.records('VISIT_INCOMPLETE').then(rows=>rows.some(row=>row.payload.visitType==='EXTRA'&&row.failure?.status===503)));
 await prisma.serviceVisit.update({where:{id},data:{status:'DONE',endAt:new Date()}});
 const receipt=await page.evaluate(async key=>{
  const captured=CWFieldWriteStore.session(),saved=JSON.parse(localStorage.getItem(key));
  const row=await CWIncompleteWorkflow.prepare('VISIT_INCOMPLETE',saved.context,{reason:saved.values.incompleteReason,nextStep:saved.values.incompleteNextStep},saved.snapshot,captured);
  return CWFieldWriteStore.send(row.requestId,captured);
 },key('REGULAR'));
 assert.equal(receipt.applied,false);assert.equal(typeof receipt.message,'string');
 const legacyRaw=JSON.stringify({[id]:{visitId:id,nextStep:notes}});await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:legacyKey,value:legacyRaw});
 await review();await cycle({pending:true,legacy:true,receipt:receipt.message,widths:[320,390]});
 const saved=await snapshot();assert.equal(saved.rows.length,2);assert(saved.rows.every(row=>row.requestId&&row.payload.baseVersion));assert(saved.rows.some(row=>row.response?.applied===false));assert(saved.rows.some(row=>row.failure?.status===503));
 assert.equal(await prisma.fieldWriteRequest.count({where:{requestId:{in:saved.rows.map(row=>row.requestId)}}}),1);
 console.log('PASS real pending request, frozen stale refusal, typed same-ID drafts and legacy warning relocalize without changing stored requests or server state');

 // Literal labels and server details stay literal; resolved/reviewed receipts stay excluded.
 const literal='Original <img src=x onerror=window.qaInjected=true> {id} — Guardar',detail='Servidor <b>Não substituir</b> {label}';
 const projected=await page.evaluate(async({literal,detail})=>{
  const original=CWFieldWriteStore.records;
  CWFieldWriteStore.records=async()=>[
   {label:literal,response:{applied:false,message:detail}},
   {label:'resolved marker',response:{applied:true}},
   {label:'reviewed marker',response:{applied:false},reviewedAt:'2026-09-29T00:00:00Z'}];
  try {return (await CWFieldIncomplete.pendingSummary()).map(item=>({kind:item.kind,text:item.text,reviewText:item.reviewText}));}
  finally {CWFieldWriteStore.records=original;}
 },{literal,detail});
 assert.equal(projected[0].text,literal+' — '+detail+'.');assert(Object.values(projected[0].reviewText).every(value=>value===projected[0].text));assert(!JSON.stringify(projected).includes('resolved marker'));assert(!JSON.stringify(projected).includes('reviewed marker'));assert.deepEqual(await snapshot(),saved);

 async function hold(){
  await page.evaluate(()=>{window.qaSummaryHeld=false;window.qaSummaryOriginal=CWFieldIncomplete.pendingSummary;const gate=new Promise(resolve=>window.qaReleaseSummary=resolve);CWFieldIncomplete.pendingSummary=async function(...args){const rows=await qaSummaryOriginal.apply(this,args);qaSummaryHeld=true;await gate;return rows;};});
  releases.push(()=>page.evaluate(()=>window.qaReleaseSummary?.()).catch(()=>{}));
  await page.locator('#dayReviewBtn').click();await page.waitForFunction(()=>qaSummaryHeld);
 }
 const release=()=>page.evaluate(()=>{CWFieldIncomplete.pendingSummary=qaSummaryOriginal;qaReleaseSummary();});
 await hold();for(const language of Object.keys(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert(await page.locator('#dayReviewBtn').isDisabled());assert.equal(await page.locator('#dayReviewResult').getAttribute('aria-busy'),'true');}
 await release();await ready();assert((await result()).includes(words.de.pending));await cycle({pending:true,legacy:true,receipt:receipt.message,widths:[320]});
 await page.evaluate(()=>CristalI18n.applyLanguage('fr',{silent:true}));await page.waitForFunction(fragment=>document.getElementById('dayReviewResult').textContent.includes(fragment),words.fr.pending);
 console.log('PASS literal source details/filtering, captured response released in current language and silent locale change');

 if(process.env.CW_CAPTURE_UI){fs.mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:320,height:900});await page.locator('#cwLanguageSelect').selectOption('de');await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/REVIEW_IMPEDIMENTS_DE_320.png'});}
 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await setup();await review();await cycle({pending:true,legacy:true,receipt:receipt.message,widths:[320]});
 assert.deepEqual(await snapshot(),saved);
 const cacheName=fs.readFileSync('frontend/sw.js','utf8').match(/const CACHE = '([^']+)'/)[1];assert(await page.evaluate(name=>caches.keys().then(keys=>keys.includes(name)),cacheName));
 const broken=key('REGULAR');await page.evaluate(key=>localStorage.setItem(key,'{'),broken);await review();assert.equal(await page.locator('#dayReviewResult .day-review-group').count(),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),broken),'{');await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:broken,value:saved.storage[broken]});
 assert.deepEqual(await snapshot(),saved);assert.equal(await page.evaluate(()=>window.qaInjected),undefined);assert.deepEqual(errors,[]);
 assert.equal(await prisma.fieldWriteRequest.count({where:{requestId:{in:saved.rows.map(row=>row.requestId)}}}),1);
 assert.deepEqual(await prisma.extraVisit.findUnique({where:{id}}),extra);
 // An account change permanently closes other producers until the page is reopened.
 // Exercise it last; restoring a token must not bypass their existing protection.
 await hold();await page.evaluate(()=>{window.qaGetToken=CristalAuth.getToken;CristalAuth.getToken=()=>null;});await release();await ready();
 assert.equal(await page.locator('#dayReviewResult .day-review-group').count(),0);assert(!(await result()).includes(receipt.message));await page.evaluate(()=>{CristalAuth.getToken=qaGetToken;});
 assert.match(await page.evaluate(()=>CWFieldEquipment.pendingSummary().then(()=>'',error=>error.message)),/A sessão mudou/);assert.deepEqual(await snapshot(),saved);
 console.log('PASS account change refuses captured summaries and keeps the equipment producer closed after token restoration');
 console.log('PASS offline reload/current cache, corrupt draft preserved with incomplete review, unchanged records and no markup execution or page errors');completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)await release();await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
