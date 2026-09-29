'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs'),jwt=require('jsonwebtoken'),{chromium}=require('playwright'),wait=require('./fixtures/wait-browser-state');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const words={
 pt:{stockDraft:'rascunho de pedido de material/nota por enviar',stockPending:'pedido de material/nota por confirmar',blocked:'confirme o contexto com o escritório',work:'rascunho de trabalho guardado, ainda não submetido.',unknown:'rascunho por guardar ou comparar.',legacy:'Há avisos antigos sem conta confirmada'},
 en:{stockDraft:'material request/note draft awaiting sending',stockPending:'material request/note awaiting confirmation',blocked:'confirm the context with the office',work:'work draft saved, not submitted yet.',unknown:'draft needs saving or comparison.',legacy:'There are old alerts with no confirmed account'},
 fr:{stockDraft:'brouillon de demande de matériel/note à envoyer',stockPending:'demande de matériel/note à confirmer',blocked:'confirmez le contexte avec le bureau',work:'brouillon de travail enregistré, pas encore envoyé.',unknown:'brouillon à enregistrer ou à comparer.',legacy:'Cet appareil contient d’anciennes alertes sans compte confirmé'},
 es:{stockDraft:'borrador de solicitud de material/nota pendiente de envío',stockPending:'solicitud de material/nota por confirmar',blocked:'confirme el contexto con la oficina',work:'borrador de trabajo guardado, aún no enviado.',unknown:'borrador pendiente de guardar o comparar.',legacy:'Hay avisos antiguos sin cuenta confirmada'},
 de:{stockDraft:'Entwurf einer Materialanfrage/Notiz wartet unter Mais → Avisos auf den Versand',stockPending:'Materialanfrage/Notiz wartet auf Bestätigung',blocked:'klären Sie den Kontext mit dem Büro',work:'Arbeitsentwurf gespeichert, noch nicht übermittelt.',unknown:'Entwurf muss gespeichert oder verglichen werden.',legacy:'Auf diesem Gerät gibt es alte Meldungen ohne bestätigtes Konto'}
};
let browser,completed=false;const releases=[];
const deadline=setTimeout(()=>{console.error('Captured review summary assertions did not finish');process.exit(1);},90000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const tech=await prisma.technician.create({data:{name:'Captured summary owner',active:true}}),client=await prisma.client.create({data:{name:'Captured summary client',active:true}});
 const literal='Guardar <img src=x onerror=window.qaInjected=true> — summaryPending {name}',notes='Notas originais <b>Conservar</b> 17,25',pool=await prisma.pool.create({data:{clientId:client.id,name:literal,active:true}});
 const visit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'PLANNED',date:new Date(),plannedDate:new Date(),startAt:new Date()}}),token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:390,height:900}});
 await context.addInitScript(({token,tech,origin})=>{
  if(top!==window||location.origin!==origin)return;
  if(!localStorage.getItem('qaReviewSummaries')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('cwPendingAdminAlerts','[{"message":"Original antigo Guardar"}]');localStorage.setItem('qaReviewSummaries','1');}
  let api;Object.defineProperty(window,'CWFieldVisitDrafts',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=function(...args){const manager=create(...args),bind=manager.bind;manager.bind=function(...params){window.qaDraftEntry=bind(...params);return qaDraftEntry;};return manager;};}});
  const interval=setInterval;window.setInterval=(callback,delay,...args)=>[15000,30000].includes(delay)?0:interval(callback,delay,...args);
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=()=>{};
 },{token,tech,origin:new URL(base).origin});
 const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/settings/language/me')requests.push({path:url.pathname,method:request.method(),body:request.postData()});});
 const stockKey='cwFieldStockDraft:TECH:'+tech.id,draftKey='cwFieldVisitDrafts:v2:TECH:'+tech.id;
 const snapshot=()=>page.evaluate(async({stockKey,draftKey})=>({stock:localStorage.getItem(stockKey),draft:localStorage.getItem(draftKey),legacy:localStorage.getItem('cwPendingAdminAlerts'),rows:await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)}),{stockKey,draftKey});
 const ready=()=>page.waitForFunction(()=>document.getElementById('dayReviewResult').getAttribute('aria-busy')==='false'&&!document.getElementById('dayReviewBtn').disabled);
 const review=async()=>{await page.locator('[data-field-tab-button="hoje"]').click();await page.locator('#dayReviewBtn').click();await ready();};
 const result=()=>page.locator('#dayReviewResult').textContent();
 const setup=async()=>{await page.waitForFunction(id=>window.qaDraftEntry?.id===id&&!qaDraftEntry.checking&&!qaDraftEntry.pending&&window.CWFieldStockRequest&&document.getElementById('adminAlertStatus')?.textContent,visit.id);await page.evaluate(literal=>{
  window.qaSummaryCounts={stock:0,drafts:0};window.qaCaptured={};
  const stock=CWFieldStockRequest.pendingSummary,drafts=CWFieldDraftSummary;
  CWFieldStockRequest.pendingSummary=async function(...args){qaSummaryCounts.stock++;qaCaptured.stock=await stock.apply(this,args);return qaCaptured.stock;};
  CWFieldDraftSummary=async function(...args){qaSummaryCounts.drafts++;qaCaptured.drafts=await drafts.apply(this,args);return qaCaptured.drafts;};
  CWFieldEquipment.pendingSummary=async()=>[{kind:'pending',text:literal,reviewText:{pt:'Do not substitute',en:7}}];
 },literal);};
 await page.goto(base+'/technician-field-mode?selectedVisitId='+visit.id+'&selectedVisitType=REGULAR',{waitUntil:'domcontentloaded'});await setup();
 await page.locator('[data-field-tab-button="agora"]').click();await page.locator('#notes').fill(notes);await page.waitForFunction(notes=>!qaDraftEntry.pending&&!qaDraftEntry.checking&&!qaDraftEntry.error&&qaDraftEntry.fields.notes===notes&&document.getElementById('fieldSaveStatus').dataset.state==='saved',notes);
 await page.locator('[data-field-tab-button="more"]').click();await page.locator('#stockProductName').fill('Material original');await page.locator('#adminAlertMessage').fill(notes);await page.locator('#cwLanguageSelect').selectOption('pt');await review();
 async function cycle({pending=false,unknown=false,widths=[320,390,1440]}={}){
  const before=await snapshot(),count=requests.length,summaryCounts=await page.evaluate(()=>({...qaSummaryCounts}));
  await page.locator('#cwLanguageSelect').selectOption('pt');const stamp=await page.locator('#dayReviewResult small').textContent();
  await page.evaluate(()=>{window.qaReviewNodes=Array.from(document.querySelectorAll('#dayReviewResult *'));window.qaReviewButton=document.getElementById('dayReviewBtn');});
  for(const width of widths){await page.setViewportSize({width,height:900});await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();for(const [language,w] of Object.entries(words)){
   await page.locator('#cwLanguageSelect').selectOption(language);const actual=await result();
   for(const fragment of [w[pending?'stockPending':'stockDraft'],w.work,w.legacy,...(pending?[w.blocked]:[]),...(unknown?[w.unknown]:[])])assert(actual.includes(fragment),language+': captured review missing '+fragment+' in '+actual);
   assert(actual.includes(literal));assert(!actual.includes('Do not substitute'));
   assert.deepEqual(await snapshot(),before,'Locale must preserve exact draft bytes, account, UUID, payload, digest and failure');assert.deepEqual(await page.evaluate(()=>qaSummaryCounts),summaryCounts,'Locale must not query summary producers again');
   const state=await page.evaluate(()=>{qaReviewButton.focus();return{same:qaReviewNodes.every(node=>node.isConnected),busy:document.getElementById('dayReviewResult').getAttribute('aria-busy'),disabled:qaReviewButton.disabled,overflow:document.documentElement.scrollWidth>innerWidth+1};});assert(state.same&&state.busy==='false'&&!state.disabled&&!state.overflow,JSON.stringify(state));
   await page.evaluate(language=>CristalI18n.applyLanguage(language),language);assert(await page.evaluate(()=>document.activeElement===qaReviewButton));
  }}
  await page.locator('#cwLanguageSelect').selectOption('pt');assert.equal(await page.locator('#dayReviewResult small').textContent(),stamp);assert.equal(requests.length,count,'Repainting must not make operational requests');
  const contract=await page.evaluate(()=>Object.values(qaCaptured).flat().map(item=>({keys:Object.keys(item),serialized:JSON.stringify(item),plain:JSON.stringify({kind:item.kind,text:item.text}),frozen:Object.isFrozen(item.reviewText),languages:Object.keys(item.reviewText||{}),strings:Object.values(item.reviewText||{}).every(value=>typeof value==='string'),descriptor:Object.getOwnPropertyDescriptor(item,'reviewText')})));
  for(const item of contract){assert.deepEqual(item.keys,['kind','text']);assert.equal(item.serialized,item.plain);assert(item.frozen&&item.strings);assert.deepEqual(item.languages,['pt','en','fr','es','de']);assert.equal(item.descriptor.enumerable,false);assert.equal(item.descriptor.writable,false);}
 }
 await cycle();
 await page.evaluate(()=>CristalI18n.applyLanguage('fr',{silent:true}));await page.waitForFunction(fragment=>document.getElementById('dayReviewResult').textContent.includes(fragment),words.fr.stockDraft);
 if(process.env.CW_CAPTURE_UI){fs.mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:320,height:900});await page.locator('#cwLanguageSelect').selectOption('de');await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/REVIEW_SUMMARIES_DE_320.png'});}
 console.log('PASS captured material/work drafts and legacy warning in five languages at320/390/1440; frozen non-enumerable copy, original shape, literal names, nodes/focus/stamp/bytes and no source reads or requests');

 await page.route('**/api/technician/stock-reminders',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Recusa original <b>Guardar</b>'})}));
 await page.locator('[data-field-tab-button="more"]').click();await page.locator('#sendAdminAlertBtn').click();await wait(page,()=>CWFieldWriteStore.records('FIELD_STOCK_REQUEST').then(rows=>rows.length===1&&rows[0].failure?.blocked));
 await review();await cycle({pending:true,widths:[320]});const queued=await snapshot();assert.equal(queued.rows.length,1);assert(queued.rows[0].requestId);assert.equal(queued.rows[0].payload.message,notes);
 await page.locator('[data-field-tab-button="agora"]').click();await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('cwFieldVisitDrafts:v2:'))throw new DOMException('QA review draft quota','QuotaExceededError');return qaSetItem.call(this,key,value);};});
 await page.locator('#notes').fill('Texto novo ainda por guardar');await page.waitForFunction(()=>!qaDraftEntry.pending&&!!qaDraftEntry.error);await page.evaluate(()=>{Storage.prototype.setItem=qaSetItem;});await review();await cycle({pending:true,unknown:true,widths:[320]});
 assert.equal((await snapshot()).draft,queued.draft,'Failed write must preserve the previous draft');
 console.log('PASS real blocked material outbox and unsaved work warning relocalize while UUID/payload/hash/failure and original saved draft remain unchanged');

 async function holdSummary(){await page.evaluate(()=>{window.qaSummaryHeld=false;window.qaSummaryOriginal=CWFieldStockRequest.pendingSummary;const gate=new Promise(resolve=>window.qaReleaseSummary=resolve);CWFieldStockRequest.pendingSummary=async function(...args){const rows=await qaSummaryOriginal.apply(this,args);qaSummaryHeld=true;await gate;return rows;};});releases.push(()=>page.evaluate(()=>window.qaReleaseSummary?.()).catch(()=>{}));await page.locator('#dayReviewBtn').click();await page.waitForFunction(()=>qaSummaryHeld);}
 const release=()=>page.evaluate(()=>{CWFieldStockRequest.pendingSummary=qaSummaryOriginal;qaReleaseSummary();});
 await page.locator('#cwLanguageSelect').selectOption('pt');await holdSummary();for(const language of Object.keys(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert(await page.locator('#dayReviewBtn').isDisabled());assert.equal(await page.locator('#dayReviewResult').getAttribute('aria-busy'),'true');}await release();await ready();assert((await result()).includes(words.de.stockPending));await cycle({pending:true,unknown:true,widths:[390]});
 // Exercise the real session listener deterministically: a blocked page must be reopened,
 // even when the original credentials become available again before the next timer tick.
 await holdSummary();await page.evaluate(()=>{window.qaGetToken=CristalAuth.getToken;CristalAuth.getToken=()=>null;window.dispatchEvent(new Event('storage'));});
 assert(await page.locator('main.field').evaluate(node=>node.inert&&getComputedStyle(node).display==='none'));
 await release();await ready();assert.equal(await page.locator('#dayReviewResult .day-review-group').count(),0);assert(!(await result()).includes(literal));
 await page.evaluate(()=>{CristalAuth.getToken=qaGetToken;});assert(await page.locator('main.field').evaluate(node=>node.inert&&getComputedStyle(node).display==='none'));
 await page.locator('#fieldRouteSessionChanged a').click();await setup();await review();assert((await result()).includes(words.pt.stockPending));
 assert.deepEqual(await snapshot(),queued,'Reopening after session protection must preserve the saved draft, legacy text and immutable blocked request');
 console.log('PASS captured response uses the current language; session protection refuses captured rows and requires actual reopening with the original saved data');

 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await setup();await review();await cycle({pending:true,widths:[320]});assert.equal((await snapshot()).draft,queued.draft);assert.deepEqual((await snapshot()).rows,queued.rows);
 const cacheName=fs.readFileSync('frontend/sw.js','utf8').match(/const CACHE = '([^']+)'/)[1];assert(await page.evaluate(name=>caches.keys().then(keys=>keys.includes(name)),cacheName));assert.equal(await page.evaluate(()=>window.qaInjected),undefined);assert.deepEqual(errors,[]);
 console.log('PASS offline reload reconstructs translated captured summaries from unchanged account data and current service worker; no markup execution or page errors');completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)await release();await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
