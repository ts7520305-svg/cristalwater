'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const words={
 pt:{title:'Antes de sair',button:'Rever pendências do dia',water:'água aberta.',pump:'bomba em manual.',work:'trabalho por concluir.',critical:'Atenção imediata (2)',checking:'A verificar pendências neste telemóvel…',changed:'O estado pode ter mudado.',failed:'Não considere o dia conferido.',partial:'Água aberta: não foi possível confirmar',unknown:'Ronda sem confirmação atual.',session:'Sessão alterada.',empty:'Não foram encontradas pendências nos dados verificados.'},
 en:{title:'Before leaving',button:'Review outstanding items today',water:'water left on.',pump:'pump in manual mode.',work:'unfinished work.',critical:'Immediate attention (2)',checking:'Checking outstanding items on this phone…',changed:'The state may have changed.',failed:'Do not consider the day checked.',partial:'Water left on: could not confirm',unknown:'Route not currently confirmed.',session:'Session changed.',empty:'No outstanding items were found in the checked data.'},
 fr:{title:'Avant de partir',button:'Vérifier les éléments en attente du jour',water:'eau ouverte.',pump:'pompe en mode manuel.',work:'travail à terminer.',critical:'Attention immédiate (2)',checking:'Vérification des éléments en attente sur ce téléphone…',changed:'L’état peut avoir changé.',failed:'Ne considérez pas la journée comme vérifiée.',partial:'Eau ouverte : impossible de confirmer',unknown:'Tournée sans confirmation à jour.',session:'Session modifiée.',empty:'Aucun élément en attente dans les données vérifiées.'},
 es:{title:'Antes de salir',button:'Revisar pendientes del día',water:'agua abierta.',pump:'bomba en modo manual.',work:'trabajo sin terminar.',critical:'Atención inmediata (2)',checking:'Comprobando pendientes en este teléfono…',changed:'El estado puede haber cambiado.',failed:'No considere el día revisado.',partial:'Agua abierta: no se pudieron confirmar',unknown:'Ruta sin confirmación actual.',session:'Sesión cambiada.',empty:'No se encontraron pendientes en los datos verificados.'},
 de:{title:'Vor dem Verlassen',button:'Offene Punkte des Tages prüfen',water:'Wasser läuft.',pump:'Pumpe im manuellen Modus.',work:'unerledigte Arbeit.',critical:'Sofortige Aufmerksamkeit (2)',checking:'Offene Punkte auf diesem Telefon werden geprüft…',changed:'Der Zustand könnte sich geändert haben.',failed:'Betrachten Sie den Tag nicht als geprüft.',partial:'Laufendes Wasser: Die Serverdaten konnten nicht bestätigt werden.',unknown:'Route derzeit nicht bestätigt.',session:'Sitzung geändert.',empty:'In den geprüften Daten wurden keine offenen Punkte gefunden.'}
};
let browser,completed=false;const releases=[];
const deadline=setTimeout(()=>{console.error('Day review language assertions did not finish');process.exit(1);},90000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const catalogue=JSON.parse(fs.readFileSync('frontend/cw-field-day-review.js','utf8').match(/const messages = (\{[\s\S]*?\n  \});/)[1]);
 const cacheName=fs.readFileSync('frontend/sw.js','utf8').match(/const CACHE = '([^']+)'/)[1];
 for(const values of Object.values(catalogue)){assert.equal(values.length,5);for(const value of values){assert(value.trim());assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(values[0].match(/\{\w+\}/g)||[]).sort());}}
 const tech=await prisma.technician.create({data:{name:'Day review language owner',active:true}});
 const literal='Guardar <img src=x onerror=window.qaInjected=true> — routeUnknown {name}';
 const client=await prisma.client.create({data:{name:'Day review language client',active:true}}),pool=await prisma.pool.create({data:{name:literal,clientId:client.id,active:true}});
 const visit=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,date:new Date(),plannedDate:new Date(),status:'PLANNED'}});
 for(const kind of ['water','pump'])await prisma.operationalReminder.create({data:{title:kind+' language review',sourceKey:kind+':'+tech.id+':review-language',assignedToTechnicianId:tech.id,poolId:pool.id,clientId:client.id,dueDate:new Date(Date.now()+3600000),metadata:{localId:kind+'-review-language',visitId:visit.id,poolName:literal}}});
 const token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900}});
 await context.addInitScript(({token,tech,origin})=>{
  if(top!==window||location.origin!==origin)return;
  if(!localStorage.getItem('qaDayReviewLanguages')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('qaDayReviewLanguages','1');}
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=()=>{};
 },{token,tech,origin:new URL(base).origin});
 const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\/api\/technician\/(today\?|water-reminders$|pump-reminders$)/.test(request.url()))requests.push({url:request.url(),method:request.method()});});
 const status=()=>page.locator('#dayReviewResult').textContent();
 const ready=()=>page.waitForFunction(()=>document.getElementById('dayReviewResult').getAttribute('aria-busy')==='false'&&!document.getElementById('dayReviewBtn').disabled);
 const run=async()=>{await page.locator('#dayReviewBtn').click();await ready();};
 const bytes=()=>page.evaluate(async()=>({storage:Object.fromEntries(Object.keys(localStorage).filter(key=>/^(cwField|cwWater|cwPump)/.test(key)).sort().map(key=>[key,localStorage.getItem(key)])),records:await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)}));
 await page.goto(base+'/technician-field-mode?selectedVisitId='+visit.id+'&selectedVisitType=REGULAR',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(id=>window.CWFieldVisitContext?.()?.id===id&&window.CWFieldEquipment&&window.CristalI18n&&window.CWFieldReminders,visit.id);
 await page.evaluate(()=>CWFieldReminders.sync());await page.locator('[data-field-tab-button="hoje"]').click();
 // External summaries are opaque in this batch: capture their current text once, without rerunning producers on locale changes.
 await page.evaluate(literal=>{window.qaSummaryCalls=0;window.qaSummaryOriginal=CWFieldEquipment.pendingSummary;CWFieldEquipment.pendingSummary=async()=>{qaSummaryCalls++;return[{kind:'pending',text:literal}];};},literal);
 await page.locator('#cwLanguageSelect').selectOption('pt');await run();
 assert.equal(await page.locator('#dayReviewResult .day-review-critical li').count(),2);
 const before=await bytes(),beforeRequests=requests.length,stamp=await page.locator('#dayReviewResult small').textContent();
 await page.evaluate(()=>{window.qaReviewNodes=Array.from(document.querySelectorAll('#dayReviewCard,#dayReviewCard *'));window.qaReviewButton=document.getElementById('dayReviewBtn');});
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();for(const [language,w] of Object.entries(words)){
  // Exercise the real selector: it dispatches input before change, which must not invalidate the review.
  await page.locator('#cwLanguageSelect').selectOption(language);
  const actual=await status();for(const fragment of [w.water,w.pump,w.work,literal])assert(actual.includes(fragment),language+': '+fragment+' in '+actual);
  assert.equal(await page.locator('#dayReviewCard h2').textContent(),w.title);assert.equal(await page.locator('#dayReviewBtn').textContent(),w.button);assert.equal(await page.locator('.day-review-critical h3').textContent(),w.critical);
  const state=await page.evaluate(()=>({same:qaReviewNodes.every(node=>node.isConnected),busy:document.getElementById('dayReviewResult').getAttribute('aria-busy'),disabled:qaReviewButton.disabled,calls:qaSummaryCalls,overflow:document.documentElement.scrollWidth>innerWidth+1,groups:Array.from(document.querySelectorAll('#dayReviewResult .day-review-group'),node=>{const r=node.getBoundingClientRect();return{width:r.width,left:r.left,right:r.right};})}));
  assert(state.same&&!state.disabled&&state.busy==='false'&&state.calls===1&&!state.overflow&&state.groups.every(r=>r.width>=220&&r.left>=-1&&r.right<=width+1),width+'/'+language+': '+JSON.stringify(state));
  await page.evaluate(language=>{qaReviewButton.focus();CristalI18n.applyLanguage(language);},language);assert(await page.evaluate(()=>document.activeElement===qaReviewButton));
  assert.deepEqual(await bytes(),before,'Language must preserve all operational storage bytes and records');
 }}
 assert.equal(requests.length,beforeRequests,'Language must not query or mutate the review sources');
 await page.evaluate(()=>{const Original=Date;try{window.Date=class extends Original{constructor(...args){super(...(args.length?args:[Original.now()+3600000]));}static now(){return Original.now()+3600000;}};CristalI18n.applyLanguage('pt');}finally{window.Date=Original;}});
 assert.equal(await page.locator('#dayReviewResult small').textContent(),stamp,'Locale changes must retain the original review and route timestamps');
 await page.evaluate(()=>CristalI18n.applyLanguage('fr',{silent:true}));await page.waitForFunction(title=>document.querySelector('#dayReviewCard h2').textContent===title,words.fr.title);
 if(process.env.CW_CAPTURE_UI){fs.mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:320,height:900});await page.locator('#cwLanguageSelect').selectOption('de');await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/DAY_REVIEW_DE_320.png'});}
 console.log('PASS five languages at320/390/1440, real picker and silent preference, critical/unfinished warnings, literal foreign summary and markup, stable nodes/focus/timestamps/bytes, no source requests');

 async function holdReview(){let release,entered,request;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);releases.push(release);const handler=async route=>{request=route.request();entered();await gate;await route.continue();};await page.route('**/api/technician/water-reminders',handler);await page.locator('#dayReviewBtn').click();await started;return async()=>{release();const response=await request.response();assert(response);await response.finished();await page.unroute('**/api/technician/water-reminders',handler);};}
 let release=await holdReview();const busyRequests=requests.length;
 for(const [language,w] of Object.entries(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert.equal(await status(),w.checking);assert(await page.locator('#dayReviewBtn').isDisabled());assert.equal(await page.locator('#dayReviewResult').getAttribute('aria-busy'),'true');}
 assert.equal(requests.length,busyRequests);await release();await ready();assert((await status()).includes(words.de.water));assert.equal(await page.evaluate(()=>qaSummaryCalls),2);
 release=await holdReview();await page.evaluate(()=>{const input=document.createElement('input');input.id='qaOperationalInput';document.getElementById('dayReviewCard').append(input);input.dispatchEvent(new Event('input',{bubbles:true}));});await ready();await release();
 // Wait for the old request to finish; its response must not replace the invalidation warning.
 for(const [language,w] of Object.entries(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert((await status()).startsWith(w.changed));}
 await page.locator('#qaOperationalInput').evaluate(node=>node.remove());await run();assert((await status()).includes(words.de.water));
 await page.evaluate(()=>{window.qaReads={photos:false,rejections:false};for(const [source,method,key] of [[CWFieldPhotos,'pendingSummary','photos'],[CWFieldOffline,'rejections','rejections']]){const original=source[method];source[method]=async function(...args){try{return await original.apply(this,args);}finally{qaReads[key]=true;}};}});
 release=await holdReview();await page.waitForFunction(()=>qaReads.photos&&qaReads.rejections);await page.evaluate(()=>{window.qaToken=CristalAuth.getToken;CristalAuth.getToken=()=>null;});await release();await ready();assert((await status()).startsWith(words.de.session),await status());await page.evaluate(()=>{CristalAuth.getToken=qaToken;});
 console.log('PASS language during real server response preserves busy state; operational input invalidates stale response and session change refuses it');

 const unavailable=route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"literal server error"}'});await page.route('**/api/technician/water-reminders',unavailable);await run();
 for(const [language,w] of Object.entries(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert((await status()).includes(w.partial));}await page.unroute('**/api/technician/water-reminders',unavailable);
 const draftKey='cwFieldVisitDrafts:'+tech.id;await page.evaluate(key=>localStorage.setItem(key,'{invalid'),draftKey);await run();for(const [language,w] of Object.entries(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert((await status()).includes(w.failed));assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),'{invalid');}await page.evaluate(key=>localStorage.removeItem(key),draftKey);
 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await run();
 for(const [language,w] of Object.entries(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert((await status()).includes(w.unknown));}
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.CWFieldReminders&&window.CristalI18n&&window.CWFieldPhotos);await page.locator('[data-field-tab-button="hoje"]').click();await run();assert((await status()).includes(words.de.unknown));assert.equal(await page.locator('#dayReviewCard h2').textContent(),words.de.title);
 assert(await page.evaluate(cacheName=>caches.keys().then(keys=>keys.includes(cacheName)),cacheName));
 await context.setOffline(false);await page.evaluate(()=>CWFieldReminders.sync());
 // Explicit empty data fixture checks the guard text; integration warnings above used the real route/reminder APIs.
 await page.evaluate(()=>{CWFieldReminders.list=()=>[];CWFieldReminders.legacyWarning=()=>'';CWFieldPhotos.pendingSummary=async()=>[];CWFieldOffline.entries=async()=>[];CWFieldOffline.rejections=async()=>[];for(const source of [CWFieldIncomplete,CWFieldEquipment,CWFieldStockRequest,CWFieldProblemReport])source.pendingSummary=async()=>[];CWFieldDraftSummary=async()=>[];CWExtraVisitCorrection.pendingDrafts=async()=>[];});
 await page.route('**/api/technician/today?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,complete:true,total:0,visits:[]})}));for(const kind of ['water','pump'])await page.route('**/api/technician/'+kind+'-reminders',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,reminders:[]})}));await run();
 for(const [language,w] of Object.entries(words)){await page.locator('#cwLanguageSelect').selectOption(language);assert((await status()).startsWith(w.empty));assert.equal(await page.locator('#dayReviewResult .day-review-group').count(),0);}
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.qaInjected),undefined);
 console.log('PASS partial server failure, corrupt data preserved, offline/cache reload, five-language incomplete and empty states; no page errors');completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)release();await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
