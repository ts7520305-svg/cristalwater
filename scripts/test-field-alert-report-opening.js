'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),fs=require('node:fs/promises'),path=require('node:path');
const pdfText = require('./lib/reportPdfText');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret'),{chromium}=require('playwright');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));let browser;
(async()=>{
 const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),user={id:admin.id,userId:admin.id,role:'ADMIN'},token=jwt.sign(user,getJwtSecret(),{expiresIn:'1h'});
 const client=await prisma.client.create({data:{name:'QA alert report '+Date.now()}}),other=await prisma.client.create({data:{name:'QA unrelated report'}});
 const pool=await prisma.pool.create({data:{clientId:client.id,name:'QA report pool'}});
 const ids=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),id=Math.max(...ids.map(x=>x._max.id||0))+101;
 const visit=await prisma.serviceVisit.create({data:{id,clientId:client.id,poolId:pool.id,status:'DONE',alerts:'QA report opening',notes:'REGULAR_ORIGINAL_ONLY'}});
 const extraPool=await prisma.pool.create({data:{clientId:other.id,name:'QA extra report pool'}});
 const extraVisit=await prisma.extraVisit.create({data:{id,clientId:other.id,poolId:extraPool.id,status:'DONE',notes:'EXTRA_PLANNING_ONLY',internalNote:'EXTRA_INTERNAL_ONLY',execution:{notes:'EXTRA_EXECUTION_ONLY',ph:7.3,problem:'EXTRA_PROBLEM_ONLY',chemicalsJson:[]}}});
 const makeNotice=(metadata,clientId=client.id)=>prisma.notification.create({data:{clientId,type:'ALERT',message:'QA typed report opening',metadata}});
 const regular=await makeNotice({visitId:id,visitType:'REGULAR',poolId:pool.id});
 const extra=await makeNotice({visitId:id,visitType:'EXTRA',poolId:extraPool.id},other.id);
 const alias=await makeNotice({extraVisitId:id,poolId:extraPool.id},other.id);
 const minimal=await makeNotice({visitId:id,visitType:'EXTRA'},null);
 const conflict=await makeNotice({visitId:id,visitType:'REGULAR',poolId:pool.id},other.id);
 const ambiguous=await prisma.technicalAlert.create({data:{poolId:pool.id,type:'QA_REPORT',message:'Problema tecnico reportado na visita '+id}});
 const technical=await prisma.technicalAlert.create({data:{poolId:extraPool.id,type:'QA_EXTRA',message:'Visita extra requer revisão'}});
 await makeNotice({visitId:id,visitType:'EXTRA',poolId:extraPool.id,alertId:technical.id},other.id);
 const mixed=await prisma.technicalAlert.create({data:{poolId:extraPool.id,type:'QA_MIXED',message:'Associação contraditória'}});
 await makeNotice({visitId:id,visitType:'EXTRA',poolId:extraPool.id,alertId:mixed.id},other.id);
 await makeNotice({visitId:id,visitType:'REGULAR',poolId:extraPool.id,alertId:mixed.id},other.id);
 const regularOnly=await prisma.serviceVisit.create({data:{id:id+1,clientId:client.id,poolId:pool.id,notes:'MUST_NOT_ENRICH_MISSING_EXTRA'}});
 const missing=await makeNotice({visitId:regularOnly.id,visitType:'EXTRA',poolId:pool.id});
 const invalid=[];
 for(const metadata of [{visitId:id,visitType:'EXTRA',poolId:pool.id},{visitId:id,visitType:'EXTRA',clientId:client.id,poolId:extraPool.id},{visitId:id,visitType:'extra'},{visitId:[id],visitType:'EXTRA'},{visitId:id,extraVisitId:id+1,visitType:'EXTRA'},{visitId:id,extraVisitId:id,visitType:'REGULAR'}])invalid.push(await makeNotice(metadata,other.id));
 const counters=()=>Promise.all(['invoice','payment','stockMovement','vehicleStockMovement','fieldWriteRequest','auditTrail','notification','technicalAlert'].map(model=>prisma[model].count()));
 const beforeReads=await counters();
 const response=await fetch(base+'/api/alerts',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);const data=await response.json();
 const find=id=>data.alerts.find(a=>a.id===id);
 for(const ref of ['visit-'+id,'notification-'+regular.id])assert.deepEqual(find(ref).report,{type:'REGULAR',visitId:id,clientId:client.id});
 for(const ref of ['notification-'+extra.id,'notification-'+alias.id,'notification-'+minimal.id,'technical-'+technical.id]){
  const row=find(ref);assert.deepEqual(row.report,{type:'EXTRA',visitId:id,clientId:other.id});assert.equal(row.visitType,'EXTRA');assert.equal(row.visitHref,null);assert.equal(row.href,'/admin-pool-technical?poolId='+extraPool.id);
  assert.equal(row.serviceNote.notes,'EXTRA_EXECUTION_ONLY');assert.equal(row.serviceNote.planningNotes,'EXTRA_PLANNING_ONLY');assert.equal(row.serviceNote.internalNotes,'EXTRA_INTERNAL_ONLY');assert.equal(row.serviceNote.readings.find(r=>r.label==='pH').value,7.3);assert(row.serviceNote.href.endsWith('?visitType=EXTRA'));assert(!JSON.stringify(row).includes('REGULAR_ORIGINAL_ONLY'));
 }
 const blocked=['notification-'+conflict.id,'technical-'+ambiguous.id,'technical-'+mixed.id,'notification-'+missing.id,...invalid.map(n=>'notification-'+n.id)];
 for(const ref of blocked)assert.equal(find(ref).report,null,ref);
 for(const ref of blocked.filter(ref=>ref!=='technical-'+ambiguous.id))assert.equal(find(ref).serviceNote,null,ref);
 assert.deepEqual(await counters(),beforeReads);
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:900}}),errors=[],requests=[];
 await c.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await c.addInitScript(({user,token})=>{
  for(const k of ['token','adminToken','cristalwater_jwt'])localStorage.setItem(k,token);
  for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify(user));
  localStorage.setItem('cw_language','pt');window.qaPopups=[];window.qaCreated=[];window.qaRevoked=[];
  window.open=()=>{if(window.qaBlocked)return null;const p={location:{},closed:false,close(){this.closed=true;}};qaPopups.push(p);return p;};
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=b=>{const u=create(b);qaCreated.push(u);return u;};URL.revokeObjectURL=u=>{qaRevoked.push(u);revoke(u);};
 },{user,token});
 const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
 p.on('request',r=>{if(r.url().includes('/api/report-visit/'))requests.push({url:r.url(),authorization:r.headers().authorization});});
 await p.goto(base+'/admin-alerts',{waitUntil:'networkidle'});
 const button=p.locator('[data-report-alert="visit-'+visit.id+'"]'),state=kind=>p.waitForFunction(kind=>document.getElementById('alertReportStatus').dataset.state===kind,kind);
 await button.waitFor();assert.equal(await p.locator('a[href^="/api/reports/visit/"]').count(),0);
 for(const ref of blocked)assert.equal(await p.locator('[data-report-alert="'+ref+'"]').count(),0);
 assert(!(await p.locator('#alertsList').textContent()).includes('MUST_NOT_ENRICH_MISSING_EXTRA'));
 const extraButton=p.locator('[data-report-alert="notification-'+extra.id+'"]');
 assert.equal(await extraButton.textContent(),'Abrir relatório extra');
 const evidence=path.join(process.cwd(),'reports/field-visual/extra-alert-report-'+Date.now());await fs.mkdir(evidence,{recursive:true});
 await p.locator('#alertSearch').fill('EXTRA_EXECUTION_ONLY');
 for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await extraButton.locator('xpath=ancestor::article').screenshot({path:path.join(evidence,'extra-alert-'+width+'.png')});}
 const colors=await extraButton.evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,background:s.backgroundColor,image:s.backgroundImage};});const lum=color=>color.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const contrast=(Math.max(lum(colors.color),lum(colors.background))+.05)/(Math.min(lum(colors.color),lum(colors.background))+.05);assert(contrast>=4.5,JSON.stringify(colors));console.log('REPORT_BUTTON_CONTRAST '+contrast.toFixed(2));
 await p.locator('#alertSearch').fill('');
 await p.evaluate(()=>window.qaBlocked=true);await extraButton.click();await state('error');assert.equal(requests.length,0);await p.evaluate(()=>window.qaBlocked=false);
 await extraButton.click();await state('opened');assert.equal(new URL(requests.at(-1).url).searchParams.get('visitType'),'EXTRA');
 const opened=async()=>Buffer.from(await p.evaluate(async()=>Array.from(new Uint8Array(await(await fetch(qaCreated.at(-1))).arrayBuffer()))));
 assert(pdfText(await opened()).includes('EXTRA_EXECUTION_ONLY'));assert(!pdfText(await opened()).includes('REGULAR_ORIGINAL_ONLY'));
 await button.click();await state('opened');assert.equal(await p.evaluate(()=>qaPopups.at(-2).closed),true);assert(pdfText(await opened()).includes('REGULAR_ORIGINAL_ONLY'));assert.equal(new URL(requests.at(-1).url).searchParams.get('visitType'),null);
 assert(requests.every(r=>r.authorization==='Bearer '+token&&!r.url.includes(token)));
 await p.locator('#alertSearch').fill('no matching result');await state('idle');assert.equal(await p.evaluate(()=>qaPopups.at(-1).closed),true);assert.equal(await p.evaluate(()=>qaRevoked.length),2);await p.locator('#alertSearch').fill('');
 const language=p.locator('#alertReportLanguage');assert.equal(await language.inputValue(),'pt');
 const titles={pt:'Relatório técnico completo',en:'Full technical report',fr:'Rapport technique complet',es:'Informe técnico completo'};
 for(const lang of ['en','fr','es','pt']){
  await language.selectOption(lang);
  for(const [target,type,marker] of [[button,'REGULAR','REGULAR_ORIGINAL_ONLY'],[extraButton,'EXTRA','EXTRA_EXECUTION_ONLY']]){
   await target.click();await state('opened');
   const url=new URL(requests.at(-1).url);assert.equal(url.searchParams.get('lang'),lang);assert.equal(url.searchParams.get('visitType')||'REGULAR',type);
   const content=pdfText(await opened());assert(content.includes(titles[lang]));assert(content.includes(marker));
   if(type==='EXTRA')assert(content.includes('EXTRA_INTERNAL_ONLY'));
  }
 }
 await language.selectOption('en');await state('idle');assert(await p.evaluate(()=>qaPopups.at(-1).closed));
 // Returning to the same language still retires an older in-flight request.
 let languageEnter,languageRelease;const languageArrived=new Promise(r=>languageEnter=r),languageGate=new Promise(r=>languageRelease=r);
 const languageEndpoint='**/api/report-visit/visit/*';
 await p.route(languageEndpoint,async route=>{const response=await route.fetch();languageEnter();await languageGate;await route.fulfill({response}).catch(()=>{});});
 const beforeLanguage=await p.evaluate(()=>qaCreated.length);await extraButton.click();await languageArrived;await language.selectOption('fr');await state('idle');await language.selectOption('en');languageRelease();await p.unroute(languageEndpoint);assert.equal(await p.evaluate(()=>qaCreated.length),beforeLanguage);
 await language.evaluate(el=>{el.add(new Option('Invalid','EN'));el.value='EN';el.dispatchEvent(new Event('change',{bubbles:true}));});
 const beforeInvalid=requests.length;await button.click();await state('error');assert.equal(requests.length,beforeInvalid);await language.selectOption('pt');
 for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});await language.scrollIntoViewIfNeeded();assert(await language.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=44;}));await p.locator('#alertReportLanguage').locator('xpath=..').screenshot({path:path.join(evidence,'language-'+width+'.png')});}
 console.log('PASS alert REGULAR/EXTRA PT/EN/FR/ES, source notes retained, explicit request language, language-change cancellation including A-B-A and invalid selection refusal');
 const endpoint='**/api/report-visit/visit/*';
 for(const mutation of [{headers:{'content-language':'en'}},{headers:{'content-language':''}},{headers:{'x-cw-client-id':String(other.id)}},{headers:{'x-cw-visit-type':'EXTRA'}},{headers:{'x-cw-report-type':'extra-visit-pdf'}},{headers:{'x-cw-visit-id':String(visit.id+1)}},{headers:{'x-cw-report-view':'client'}},{body:'%PDF-truncated'},{status:503}]){
  await p.route(endpoint,async route=>{const r=await route.fetch();await route.fulfill({response:r,...mutation,headers:{...r.headers(),...mutation.headers}});});
  const before=await p.evaluate(()=>qaCreated.length);await button.click();await state('error');assert.equal(await p.evaluate(()=>qaCreated.length),before);assert.equal(await p.evaluate(()=>qaPopups.at(-1).closed),true);await p.unroute(endpoint);
 }
 await p.route(endpoint,async route=>{const url=new URL(route.request().url());url.searchParams.delete('visitType');url.searchParams.set('clientId',String(client.id));const r=await route.fetch({url:url.toString()});await route.fulfill({response:r});});
 const beforeWrongType=await p.evaluate(()=>qaCreated.length);await extraButton.click();await state('error');assert.equal(await p.evaluate(()=>qaCreated.length),beforeWrongType);await p.unroute(endpoint);
 let enter,release;const arrived=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 await p.route(endpoint,async route=>{const r=await route.fetch();enter();await gate;await route.fulfill({response:r}).catch(()=>{});});
 const before=await p.evaluate(()=>qaCreated.length);await extraButton.click();await arrived;await p.locator('#refreshAlerts').click();await state('idle');release();await p.unroute(endpoint);assert.equal(await p.evaluate(()=>qaCreated.length),before);
 await p.waitForFunction(()=>document.getElementById('alertsStatus').textContent==='Alertas carregados.');
 await c.setOffline(true);await extraButton.click();await state('error');await c.setOffline(false);const count=requests.length;await p.waitForTimeout(300);assert.equal(requests.length,count);
 await extraButton.click();await state('opened');await p.evaluate(()=>localStorage.setItem('user',JSON.stringify({id:999999,role:'ADMIN'})));await state('session');assert.equal(await p.evaluate(()=>qaPopups.at(-1).closed),true);assert(await button.isDisabled());assert(await extraButton.isDisabled());assert(await language.isDisabled());
 assert.deepEqual(errors,[]);assert.deepEqual(await counters(),beforeReads);console.log('PASS typed REGULAR/EXTRA alerts and technical links, colliding IDs, execution-only provenance, ambiguous/conflicting/missing sources blocked, no fallback to regular, authenticated PDFs, popup retry, response identity/truncation, filter/reload cancellation, offline and changed session');console.log('EXTRA_ALERT_REPORT_EVIDENCE '+evidence);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
