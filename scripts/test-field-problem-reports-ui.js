'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret'),wait=require('./fixtures/wait-browser-state');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser;const releases=[];
(async()=>{
  const tech=await prisma.technician.create({data:{name:'Problem UI owner',active:true}}),other=await prisma.technician.create({data:{name:'Problem UI other',active:true}});
  const client=await prisma.client.create({data:{name:'Problem UI client',active:true}}),pool=await prisma.pool.create({data:{name:'Problem UI pool',clientId:client.id,active:true}});
  const visit=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,date:new Date(),plannedDate:new Date(),status:'PLANNED'}});
  const secondPool=await prisma.pool.create({data:{name:'Another problem UI pool',clientId:client.id,active:true}}),secondVisit=await prisma.serviceVisit.create({data:{poolId:secondPool.id,clientId:client.id,technicianId:tech.id,date:new Date(),plannedDate:new Date(),status:'PLANNED'}});
  const token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),otherToken=jwt.sign({id:other.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
  const historic=JSON.stringify(Array.from({length:51},(_,i)=>({message:'Unattributed old request '+i,technicianId:other.id})));
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(({token,tech,origin,historic})=>{
    if(location.origin!==origin||top!==window)return;
    if(!localStorage.getItem('qaProblemSession')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('qaProblemSession','1');localStorage.setItem('cwFieldProblems',historic);}
    Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=message=>{window.qaAlertMessage=message;};
  },{token,tech,origin:new URL(base).origin,historic});
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const open=async()=>{await page.goto(base+'/technician-field-mode?selectedVisitId='+visit.id+'&selectedVisitType=REGULAR',{waitUntil:'networkidle'});await page.waitForFunction(id=>CWFieldVisitContext?.()?.id===id,visit.id);await page.locator('[data-field-tab-button="more"]').click();await page.locator('#problemBtn').click();};
  const records=()=>page.evaluate(()=>CWFieldWriteStore.records('FIELD_PROBLEM_REPORT'));
  const status=()=>page.locator('#problemReportStatus').textContent();
  const retry=()=>page.locator('#recoverProblemReportBtn').click();
  let requests=0;page.on('request',request=>{if(request.url().endsWith('/problem')&&request.method()==='POST')requests++;});
  await open();await page.waitForFunction(()=>!document.getElementById('problemText').readOnly);
  await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('cwFieldProblemDraft:'))throw new DOMException('QA draft quota','QuotaExceededError');return qaSetItem.call(this,key,value);};});
  await page.locator('#problemText').fill('Sem espaço');await page.locator('#saveProblemBtn').click();await page.waitForFunction(()=>document.getElementById('problemReportStatus').textContent.includes('não foi enviado'));assert.equal(requests,0);assert.equal(await page.locator('#problemText').inputValue(),'Sem espaço');assert.match(await status(),/não foi enviado/);
  await page.evaluate(()=>{Storage.prototype.setItem=qaSetItem;delete window.qaSetItem;});
  const message='Ocorrência original <img src=x onerror=window.qaExecuted=true>';
  await page.locator('#problemText').fill(message);await page.locator('#problemCategory').selectOption('Extra / reparacao');await page.locator('#problemType').selectOption('Equipamento');await page.locator('#problemSeverity').selectOption('Urgente');
  await page.locator('[data-field-tab-button="agora"]').click();await page.locator('#notes').fill('Notas de trabalho originais');await page.locator('[data-field-tab-button="more"]').click();
  await open();assert.equal(await page.locator('#problemText').inputValue(),message);assert.equal(await page.locator('#problemType').inputValue(),'Equipamento');assert.equal(await page.locator('#notes').inputValue(),'Notas de trabalho originais');
  await page.locator('#visitList [data-visit-index]').filter({hasText:secondPool.name}).evaluate(button=>button.click());await page.waitForFunction(id=>CWFieldVisitContext().id===id,secondVisit.id);assert.match(await page.locator('#problemReportContext').textContent(),new RegExp('visita '+visit.id+' ·'));assert(await page.locator('#saveProblemBtn').isHidden());assert.equal(await page.locator('#recoverProblemReportBtn').textContent(),'Enviar ocorrência da visita '+visit.id);
  await open();
  await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.locator('#saveProblemBtn').click();await wait(page,()=>CWFieldWriteStore.records('FIELD_PROBLEM_REPORT').then(rows=>rows.length===1));
  const original=(await records())[0];assert.deepEqual(original.payload,{visitType:'REGULAR',visitId:visit.id,poolId:pool.id,category:'Extra / reparacao',type:'Equipamento',severity:'Urgente',message});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('recoverProblemReportBtn')?.textContent==='Confirmar ocorrência guardada');await page.locator('[data-field-tab-button="more"]').click();
  assert.equal(await page.locator('#problemText').inputValue(),message);assert(await page.locator('#problemText').evaluate(node=>node.readOnly));assert.equal((await records())[0].requestId,original.requestId);
  assert.equal(await page.evaluate(()=>localStorage.getItem('cwFieldProblems')),historic);assert.match(await page.locator('#problemReportLegacyStatus').textContent(),/sem conta confirmada/);
  await page.locator('[data-field-tab-button="hoje"]').click();await page.locator('#dayReviewBtn').click();await page.waitForFunction(()=>document.getElementById('dayReviewResult').textContent.includes('ocorrência por confirmar'));assert.match(await page.locator('#dayReviewResult').textContent(),/registos antigos de ocorrências sem conta confirmada/);await page.locator('[data-field-tab-button="more"]').click();
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.setViewportSize({width:390,height:844});await page.locator('#problemReportStatus').evaluate(node=>node.scrollIntoView({block:'center'}));
  assert(await page.locator('#problemReportStatus').evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.left+8,r.top+8));}),'Problem recovery covered by navigation');
  await page.locator('#recoverProblemReportBtn').evaluate(node=>node.scrollIntoView({block:'center'}));assert(await page.locator('#recoverProblemReportBtn').evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),'Recovery action covered by navigation');
  if(process.env.CW_CAPTURE_UI){require('node:fs').mkdirSync('reports/field-ui',{recursive:true});await page.screenshot({path:'reports/field-ui/PROBLEM_REPORT_RECOVERY.png'});}
  console.log('PASS actual problem form: quota prevents sending; four fields and typed visit survive offline reload; 51 old requests remain byte-identical; recovery visible at 320/390/1440');

  const endpoint=base+'/api/core/visits/'+visit.id+'/problem';let bodies=[];
  await page.route(endpoint,async route=>{bodies.push(route.request().postDataJSON());const response=await route.fetch(),data=await response.json();await route.fulfill({status:200,json:{...data,problemReport:{...data.problemReport,type:'Outro'}}});});
  await context.setOffline(false);await retry();await page.waitForFunction(()=>document.getElementById('problemReportStatus').textContent.includes('não corresponde'));await page.unroute(endpoint);
  assert.equal(await page.locator('#problemText').inputValue(),message);assert.equal((await records())[0].requestId,original.requestId);
  const where={eventType:'FIELD_PROBLEM_REPORTED',metadata:{path:['requestId'],equals:original.requestId}};assert.equal(await prisma.notification.count({where}),1);
  await page.evaluate(()=>{window.qaPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(row,...args){if(this.name==='requests'&&row.scope==='FIELD_PROBLEM_REPORT'&&row.response)throw new DOMException('QA receipt quota','QuotaExceededError');return qaPut.call(this,row,...args);};});
  await retry();await page.waitForFunction(()=>document.getElementById('problemReportStatus').textContent.includes('receipt quota'));assert.equal((await records()).length,1);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=qaPut;delete window.qaPut;window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,raw){if(key.startsWith('cwFieldProblemDraft:')&&JSON.parse(raw).message==='')throw new DOMException('QA confirmed draft quota','QuotaExceededError');return qaSetItem.call(this,key,raw);};});
  await retry();await page.waitForFunction(()=>document.getElementById('recoverProblemReportBtn').textContent==='Limpar rascunho confirmado');assert.equal((await records()).length,0);assert.equal(await page.locator('#problemText').inputValue(),message);
  const beforeClear=requests;await page.evaluate(()=>{Storage.prototype.setItem=qaSetItem;delete window.qaSetItem;});await retry();await page.waitForFunction(()=>document.getElementById('problemText').value===''&&!document.getElementById('problemText').readOnly);
  assert.equal(requests,beforeClear);assert.equal(await prisma.notification.count({where}),1);assert.equal(await prisma.auditTrail.count({where:{eventType:'FIELD_PROBLEM_REPORTED',metadata:{path:['requestId'],equals:original.requestId}}}),1);const repair=await prisma.repair.findFirstOrThrow({where:{poolId:pool.id}});assert.equal(repair.unitPrice,null);assert.equal(repair.totalPrice,null);assert.equal(await page.locator('#notes').inputValue(),'Notas de trabalho originais');assert.match(await status(),/não confirma leitura, orçamento ou reparação/);
  assert.deepEqual(bodies[0],{...original.payload,requestId:original.requestId});
  console.log('PASS altered receipt and local receipt/cleanup failures retain the original; explicit retry yields one occurrence/notification and clears only after exact confirmation');

  const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),adminToken=jwt.sign({id:admin.id,role:'ADMIN'},getJwtSecret(),{expiresIn:'1h'});
  const adminContext=await browser.newContext({viewport:{width:1440,height:1000}});await adminContext.addInitScript(({token,user,origin})=>{if(location.origin!==origin||top!==window)return;for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{token:adminToken,user:{id:admin.id,role:'ADMIN'},origin:new URL(base).origin});
  const adminPage=await adminContext.newPage();await adminPage.goto(base+'/admin-alerts',{waitUntil:'networkidle'});const notice=await prisma.notification.findFirstOrThrow({where});const alert=adminPage.locator('#alertsList article').filter({has:adminPage.locator('[data-resolve-alert="notification-'+notice.id+'"]')});assert.equal(await alert.count(),1);assert.match(await alert.textContent(),new RegExp(tech.name));assert.equal(await adminPage.locator('img[onerror]').count(),0);assert.equal(await adminPage.evaluate(()=>window.qaExecuted),undefined);await adminContext.close();
  console.log('PASS real ADMIN alert panel receives the authenticated author and original text without executing submitted markup');

  await page.locator('#problemBtn').click();await page.locator('#problemText').fill('Ocorrência com resposta tardia');
  let entered,release;const started=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;releases.push(resolve);});
  await page.route(endpoint,async route=>{const response=await route.fetch();entered();await gate;await route.fulfill({response}).catch(()=>{});});
  await page.locator('#saveProblemBtn').click();await started;const late=(await records())[0];
  const change=(token,person)=>page.evaluate(({token,person})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:person.id,name:person.name,role:'TECHNICIAN'}));},{token,person});
  await change(otherToken,other);release();await page.unroute(endpoint);await page.waitForFunction(()=>document.getElementById('problemText').value==='');assert.equal((await records()).length,0);
  await change(token,tech);await open();await page.waitForFunction(()=>!document.getElementById('recoverProblemReportBtn').hidden);assert.equal((await records())[0].requestId,late.requestId);await retry();await wait(page,()=>CWFieldWriteStore.records('FIELD_PROBLEM_REPORT').then(rows=>!rows.length));assert.equal(await prisma.notification.count({where:{metadata:{path:['requestId'],equals:late.requestId}}}),1);
  console.log('PASS late account change preserves the original owner report; return and retry recover one server operation');

  await page.waitForFunction(()=>!document.getElementById('problemText').readOnly);await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await page.waitForFunction(()=>!document.getElementById('saveProblemBtn').disabled);
  const second=await context.newPage();await second.goto(base+'/technician-field-mode',{waitUntil:'networkidle'});await second.waitForFunction(()=>!document.getElementById('problemText').readOnly);
  await page.locator('#problemBtn').click();await page.locator('#problemText').fill('Rascunho preservado entre janelas');await second.waitForFunction(()=>document.getElementById('problemReportStatus').textContent.includes('noutra janela'));assert(await second.locator('#saveProblemBtn').isDisabled());await second.close();
  const oldProblem={type:'Equipamento',severity:'Urgente',message:'Ocorrência antiga com resposta desconhecida',synced:false};
  const visitDraftKey='cwFieldVisitDrafts:v2:TECH:'+tech.id,visitKey='visit-REGULAR-'+visit.id;
  await page.evaluate(({key,visitKey,oldProblem})=>{const envelope=JSON.parse(localStorage.getItem(key));if(!envelope?.drafts?.[visitKey]?._draft)throw Error('Expected persisted visit draft');envelope.drafts[visitKey].pendingProblems=[oldProblem];localStorage.setItem(key,JSON.stringify(envelope));},{key:visitDraftKey,visitKey,oldProblem});
  await open();const beforeLegacy=requests;await page.locator('#finishBtn').evaluate(button=>button.onclick());
  await page.waitForFunction(()=>document.body.textContent.includes('Há ocorrências antigas sem confirmação.'));
  assert.equal(requests,beforeLegacy);assert.equal((await page.evaluate(()=>CWFieldWriteStore.records('VISIT_COMPLETION'))).length,0);assert.equal(await page.locator('#notes').inputValue(),'Notas de trabalho originais');
  assert.deepEqual(await page.evaluate(({key,visitKey})=>JSON.parse(localStorage.getItem(key)).drafts[visitKey].pendingProblems,{key:visitDraftKey,visitKey}),[oldProblem]);
  assert.equal((await prisma.serviceVisit.findUniqueOrThrow({where:{id:visit.id}})).endAt,null);
  console.log('PASS finishing a visit preserves old unconfirmed occurrences and notes without automatically reporting or completing the visit');
  const key='cwFieldProblemDraft:TECH:'+tech.id;await page.evaluate(key=>localStorage.setItem(key,'{interrupted'),key);await open();await page.waitForFunction(()=>document.getElementById('problemReportStatus').textContent.includes('ilegível'));assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'{interrupted');assert(await page.locator('#saveProblemBtn').isDisabled());assert.equal(await page.evaluate(()=>localStorage.getItem('cwFieldProblems')),historic);assert.deepEqual(errors,[]);
  console.log('PASS BFCache, cross-tab conflict and corrupt draft preserve storage and prevent false confirmation');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)release();await browser?.close();await prisma.$disconnect();});
