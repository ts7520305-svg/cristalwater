'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), {randomUUID} = require('node:crypto'), jwt = require('jsonwebtoken'), {chromium} = require('playwright');
const {prisma} = require('../src/prismaClient'), {getJwtSecret} = require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser;
(async()=>{
  const admin = await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}});
  const adminToken = jwt.sign({id:admin.id,role:'ADMIN'},getJwtSecret(),{expiresIn:'1h'});
  const client = await prisma.client.create({data:{name:'Extra execution client',active:true,status:'ACTIVE',billingActive:true,monthlyFee:0}});
  const pool = await prisma.pool.create({data:{clientId:client.id,name:'Extra execution pool',active:true}});
  const vehicle = await prisma.vehicle.create({data:{plate:'EXTRA-'+Date.now(),active:true}});
  const tech = await prisma.technician.create({data:{name:'Extra execution technician',vehicleId:vehicle.id,active:true}});
  const other = await prisma.technician.create({data:{name:'Extra execution other',active:true}});
  const token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),otherToken=jwt.sign({id:other.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
  const guide=await prisma.transportGuide.create({data:{vehicleId:vehicle.id,codeAT:'EXTRA-'+Date.now(),status:'ACTIVE',validUntil:new Date(Date.now()+86400000),isDraft:false}});
  const work=await prisma.workGuide.create({data:{vehicleId:vehicle.id,technicianId:tech.id,guideId:guide.id,status:'OPEN',isDraft:false}});
  const stock=await prisma.workGuideItem.create({data:{workGuideId:work.id,name:'Extra chlorine',type:'CHEMICAL',unit:'KG',quantity:20,initialQty:20}});
  for(const type of ['INSURANCE','INSPECTION'])await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:vehicle.id,type,title:type,status:'ACTIVE',dueDate:new Date(Date.now()+86400000*30)}});
  const extra=(data={})=>prisma.extraVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,scheduledAt:new Date(),billingMode:'EXTRA',isBillable:true,totalPrice:35,status:'PLANNED',...data}});
  const max=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),shared=Math.max(...max.map(row=>row._max.id||0))+1;
  const visit=await extra({id:shared,notes:'Planner instructions preserved'});
  const regular=await prisma.serviceVisit.create({data:{id:shared,poolId:pool.id,clientId:client.id,technicianId:tech.id,plannedDate:new Date(),notes:'Regular must not change'}});
  for(const name of ['ExtraVisit','ServiceVisit'])await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${name}"','id'), ${shared}, true)`);
  const api=async(method,path,body,credential=token)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};};
  const endpoint=(row,action)=>`/api/field/extra-visits/${row.id}/${action}`;
  const request=(data={})=>({requestId:randomUUID(),visitType:'EXTRA',poolId:pool.id,...data});
  const start=request();
  assert.equal((await api('POST',endpoint(visit,'start'),start,null)).status,401);
  assert.equal((await api('POST',endpoint(visit,'start'),start,otherToken)).status,403);
  assert.equal((await api('POST',endpoint(visit,'start'),{...start,poolId:pool.id+999})).status,409);
  assert.equal((await api('POST',endpoint(visit,'start'),{...start,visitType:'REGULAR'})).status,400);
  const starts=await Promise.all(Array.from({length:8},()=>api('POST',endpoint(visit,'start'),start)));
  assert(starts.every(row=>row.status===200),JSON.stringify(starts));assert(starts.every(row=>row.cache==='private, no-store'));for(const row of starts)assert.deepEqual(row.body,starts[0].body);
  assert.equal(await prisma.auditTrail.count({where:{entity:'ExtraVisit',entityId:visit.id,eventType:'EXTRA_VISIT_STARTED'}}),1);
  const photoId=randomUUID(),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tAAAAABJRU5ErkJggg==','base64');
  const upload=async credential=>{const form=new FormData();form.append('type','AFTER');form.append('poolId',String(pool.id));form.append('requestId',photoId);form.append('photo',new Blob([bytes],{type:'image/png'}),'after.png');const r=await fetch(base+endpoint(visit,'photo'),{method:'POST',headers:{Authorization:'Bearer '+credential},body:form});return {status:r.status,body:await r.json()};};
  assert.equal((await upload(otherToken)).status,403);
  const photos=await Promise.all([upload(token),upload(token)]);assert.equal(photos[0].status,200,JSON.stringify(photos));assert.deepEqual(photos[0],photos[1]);assert.equal(await prisma.extraVisitPhoto.count({where:{extraVisitId:visit.id}}),1);assert.equal(await prisma.visitPhoto.count({where:{visitId:regular.id}}),0);
  for(const [credential,status] of [[null,401],[otherToken,403],[token,200],[adminToken,200]]){const r=await fetch(base+photos[0].body.photo.url,{headers:credential?{Authorization:'Bearer '+credential}:{}});assert.equal(r.status,status);if(status===200)assert.equal(Buffer.from(await r.arrayBuffer()).compare(bytes),0);}
  const completion=request({ph:7.3,chlorine:1.4,cleaned:true,notes:'Extra work performed',products:[{name:'Extra chlorine',quantity:1,unit:'KG'},{name:'Extra chlorine',quantity:1,unit:'KG'}],workGuideId:work.id,vehicleId:vehicle.id});
  const done=await Promise.all(Array.from({length:8},()=>api('POST',endpoint(visit,'complete'),completion)));
  assert(done.every(row=>row.status===200),JSON.stringify(done));for(const row of done)assert.deepEqual(row.body,done[0].body);
  assert.equal(done[0].body.visit.visitType,'EXTRA');assert.equal(done[0].body.visit.ph,7.3);assert.equal(done[0].body.visit.photos.length,1);assert.equal(done[0].body.visit.completionRequestId,completion.requestId);assert(!('totalPrice' in done[0].body.visit));
  assert.deepEqual(await prisma.serviceVisit.findUnique({where:{id:regular.id}}),regular);
  assert.equal((await prisma.workGuideItem.findUnique({where:{id:stock.id}})).quantity,18);
  for(const model of ['stockMovement','vehicleStockMovement']){const rows=await prisma[model].findMany({where:{extraVisitId:visit.id}});assert.equal(rows.length,1);assert.equal(rows[0].quantity,2);assert.equal(rows[0].visitId,null);}
  const saved=await prisma.extraVisit.findUnique({where:{id:visit.id}});assert.equal(saved.notes,'Planner instructions preserved');assert.equal(saved.billed,false);assert.equal(saved.billingStatus,'IN_MONTHLY_REPORT');
  assert.equal((await api('POST',endpoint(visit,'complete'),{...completion,ph:7.4})).status,409);assert.equal((await api('POST',endpoint(visit,'complete'),{...completion,requestId:randomUUID()})).status,409);
  assert.equal((await api('PUT',`/api/extra-visits/${visit.id}`,{totalPrice:999},adminToken)).status,409);
  const adminRepeat=await Promise.all(Array.from({length:4},()=>api('PUT',`/api/extra-visits/${visit.id}/status`,{status:'DONE'},adminToken)));assert(adminRepeat.every(row=>row.status===200),JSON.stringify(adminRepeat));
  const reports=await prisma.monthlyReport.findMany({where:{clientId:client.id,type:'EXTRA_VISITS'}});assert.equal(reports.length,1);assert.equal(reports[0].data.items.length,1);assert.equal(reports[0].data.items[0].amount,35);
  console.log('PASS typed ownership, eight simultaneous starts/completions, private photo replay, immutable receipts, original regular visit and single stock/report effects');
  for(const mode of ['INCLUDED','NO_CHARGE']){const row=await extra({billingMode:mode,totalPrice:999,isBillable:true,includedInPackage:mode==='INCLUDED'});assert.equal((await api('POST',endpoint(row,'complete'),request())).status,200);}
  const zeroExtras=[];
  for(const prices of [{totalPrice:0,unitPrice:25,price:25},{totalPrice:null,unitPrice:0,price:25},{totalPrice:0.001,unitPrice:25,price:25}]){const row=await extra(prices);zeroExtras.push(row);assert.equal((await api('POST',endpoint(row,'complete'),request())).status,200);}
  const pendingPreview=await api('GET','/api/billing/extras',undefined,adminToken);assert.equal(pendingPreview.status,200);assert.equal(pendingPreview.body.data[client.id].total,35);
  for(const path of ['/api/extras/confirm','/api/billing/extras/confirm']){const result=await api('POST',path,{},adminToken);assert.equal(result.status,409);assert.equal(result.body.code,'INVOICE_REQUIRED');assert.equal((await prisma.extraVisit.findUnique({where:{id:visit.id}})).billed,false);}
  const month=new Date().toISOString().slice(0,7),invoice=await api('POST','/api/core/invoices/generate',{clientId:client.id,monthRef:month},adminToken);assert.equal(invoice.status,200,JSON.stringify(invoice));assert.equal(invoice.body.invoice.total,35);assert.equal(invoice.body.invoice.lines.filter(line=>line.type==='EXTRA_VISIT').length,1);
  for(const row of zeroExtras){assert.equal((await prisma.extraVisit.findUnique({where:{id:row.id}})).billed,false,'A zero-priced extra must not be marked invoiced without an invoice line');assert.equal(await prisma.invoiceLine.count({where:{type:'EXTRA_VISIT',referenceId:row.id}}),0);}
  assert.equal((await api('POST',endpoint(visit,'complete'),completion)).status,200);assert.equal((await prisma.extraVisit.findUnique({where:{id:visit.id}})).billingStatus,'IN_INVOICE');
  await prisma.extraVisit.update({where:{id:visit.id},data:{billed:false,date:new Date('2099-02-01T12:00:00Z')}});
  const repeatedMonth=await api('POST','/api/core/invoices/generate',{clientId:client.id,monthRef:'2099-02'},adminToken);assert.equal(repeatedMonth.status,200,JSON.stringify(repeatedMonth));assert.equal(repeatedMonth.body.invoice.lines.filter(line=>line.type==='EXTRA_VISIT').length,0);
  assert.equal(await prisma.invoiceLine.count({where:{type:'EXTRA_VISIT',referenceId:visit.id}}),1);
  const mismatchedClient=await prisma.client.create({data:{name:'Extra mismatched historical client',active:true,status:'ACTIVE',billingActive:true,monthlyFee:0}});
  const mismatched=await extra({clientId:mismatchedClient.id,scheduledAt:new Date('2097-08-10T12:00:00Z'),status:'DONE'});
  for(const clientId of [client.id,mismatchedClient.id]){const result=await api('POST','/api/core/invoices/generate',{clientId,monthRef:'2097-08'},adminToken);assert.equal(result.status,409,JSON.stringify(result));assert.equal(await prisma.invoice.count({where:{clientId,monthRef:'2097-08'}}),0);}
  assert.equal((await prisma.extraVisit.findUnique({where:{id:mismatched.id}})).billed,false);assert.equal(await prisma.invoiceLine.count({where:{type:'EXTRA_VISIT',referenceId:mismatched.id}}),0);
  await prisma.extraVisit.update({where:{id:mismatched.id},data:{clientId:client.id}});
  const corrected=await api('POST','/api/core/invoices/generate',{clientId:client.id,monthRef:'2097-08'},adminToken);assert.equal(corrected.status,200,JSON.stringify(corrected));assert.equal(corrected.body.invoice.total,35);
  console.log('PASS included/free extras never become chargeable and existing invoice sources cannot be charged in another month even with an inconsistent old billing flag');
  const failVisit=await extra({billingMode:'EXTRA',totalPrice:35,isBillable:true}),failBody=request({products:[{name:'Extra chlorine',quantity:2,unit:'KG'}],workGuideId:work.id});
  const stockBefore=await prisma.workGuideItem.findUnique({where:{id:stock.id}}),reportsBefore=await prisma.monthlyReport.findMany({where:{clientId:client.id},orderBy:{id:'asc'}});
  for(const change of [{products:[{name:'Extra chlorine',quantity:100,unit:'KG'}]},{products:[{name:'Extra chlorine',quantity:1,unit:'L'}]},{ph:true},{technicianId:other.id}])assert((await api('POST',endpoint(failVisit,'complete'),{...failBody,...change})).status>=400);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_extra_receipt_failure() RETURNS trigger AS $$ BEGIN IF NEW."scope"='EXTRA_VISIT_COMPLETION' AND NEW."resourceId"=${failVisit.id} THEN RAISE EXCEPTION 'QA extra receipt failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_extra_receipt_failure BEFORE INSERT ON "FieldWriteRequest" FOR EACH ROW EXECUTE FUNCTION qa_extra_receipt_failure()');
  try {assert.equal((await api('POST',endpoint(failVisit,'complete'),failBody)).status,503);} finally {await prisma.$executeRawUnsafe('DROP TRIGGER qa_extra_receipt_failure ON "FieldWriteRequest"');await prisma.$executeRawUnsafe('DROP FUNCTION qa_extra_receipt_failure()');}
  assert.deepEqual(await prisma.monthlyReport.findMany({where:{clientId:client.id},orderBy:{id:'asc'}}),reportsBefore);assert.deepEqual(await prisma.workGuideItem.findUnique({where:{id:stock.id}}),stockBefore);assert.equal((await prisma.extraVisit.findUnique({where:{id:failVisit.id}})).status,'PLANNED');assert.equal(await prisma.stockMovement.count({where:{extraVisitId:failVisit.id}}),0);assert.equal(await prisma.auditTrail.count({where:{entity:'ExtraVisit',entityId:failVisit.id}}),0);
  const parallelRows=await Promise.all([extra({scheduledAt:new Date('2098-03-01T12:00:00Z'),totalPrice:20}),extra({scheduledAt:new Date('2098-03-02T12:00:00Z'),totalPrice:30})]);const parallelDone=await Promise.all(parallelRows.map(row=>api('POST',endpoint(row,'complete'),request())));assert(parallelDone.every(row=>row.status===200),JSON.stringify(parallelDone));const parallelReport=await prisma.monthlyReport.findMany({where:{clientId:client.id,month:'2098-03',type:'EXTRA_VISITS'}});assert.equal(parallelReport.length,1);assert.equal(parallelReport[0].data.items.length,2);assert.equal(parallelReport[0].data.items.reduce((sum,item)=>sum+item.amount,0),50);
  console.log('PASS invalid quantities, units, identity fields and failed receipt persistence roll back completion, both stock ledgers and audit');
  const uiPool=await prisma.pool.create({data:{clientId:client.id,name:'EXTRA UI execution',active:true}}),ui=await extra({poolId:uiPool.id,billingMode:'INCLUDED',isBillable:false,totalPrice:null});
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(({token,tech,origin})=>{if(top!==window||location.origin!==origin||localStorage.getItem('qaExtraAccount'))return;for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,role:'TECHNICIAN',name:tech.name}));localStorage.setItem('qaExtraAccount','1');},{token,tech,origin:new URL(base).origin});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/technician-field-mode',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('fieldDocsValue')?.textContent==='Válidos');
  await page.locator('#visitList [data-visit-index]').filter({hasText:'EXTRA UI execution'}).click();await page.locator('[data-field-tab-button="agora"]').click();
  await page.locator('#startBtn').evaluate(button=>button.onclick());assert.equal((await prisma.extraVisit.findUnique({where:{id:ui.id}})).status,'IN_PROGRESS');
  await page.locator('#notes').fill('Extra draft retained offline');await page.locator('#ph').fill('7.5');await page.locator('#cleaned').check();
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('[data-photo-type="BEFORE"]').click()]);await chooser.setFiles({name:'extra-before.png',mimeType:'image/png',buffer:bytes});
  await page.waitForFunction(()=>document.getElementById('photoFeedback')?.textContent.includes('confirmada pelo servidor'));
  assert.equal(await prisma.extraVisitPhoto.count({where:{extraVisitId:ui.id}}),1);
  await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('nextTitle')?.textContent==='EXTRA UI execution');assert.equal(await page.locator('#notes').inputValue(),'Extra draft retained offline');assert.equal(await page.locator('#ph').inputValue(),'7.5');
  await page.locator('#finishBtn').evaluate(button=>button.onclick());assert.equal((await prisma.extraVisit.findUnique({where:{id:ui.id}})).status,'IN_PROGRESS');
  assert.equal(await page.evaluate(()=>CWFieldWriteStore.records('EXTRA_VISIT_COMPLETION').then(rows=>rows.length)),1);
  let committedResolve;const committed=new Promise(resolve=>{committedResolve=resolve;});
  await page.route('**/api/field/extra-visits/'+ui.id+'/complete',async route=>{try{const response=await route.fetch();const body=await response.json();await route.abort();committedResolve({status:response.status(),body});}catch(error){committedResolve({error:error.message});}});await context.setOffline(false);
  await page.evaluate(()=>CWFieldOffline.flush());const committedResponse=await committed;assert.equal(committedResponse.status,200,JSON.stringify(committedResponse));assert.equal((await prisma.extraVisit.findUnique({where:{id:ui.id}})).status,'DONE');
  await page.unroute('**/api/field/extra-visits/'+ui.id+'/complete');await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>CWFieldOffline.flush());await page.waitForFunction(()=>CWFieldWriteStore.records('EXTRA_VISIT_COMPLETION').then(rows=>rows.length===0));
  const uiSaved=await prisma.extraVisit.findUnique({where:{id:ui.id}});assert.equal(uiSaved.execution.notes,'Extra draft retained offline');assert.equal(uiSaved.execution.ph,7.5);assert.equal(await prisma.auditTrail.count({where:{entity:'ExtraVisit',entityId:ui.id,eventType:'EXTRA_VISIT_COMPLETED'}}),1);
  await page.locator('#poolSegments [data-pool-filter="DONE"]').evaluate(button=>button.click());await page.locator('#visitList [data-visit-index]').filter({hasText:'EXTRA UI execution'}).evaluate(button=>button.click());await page.locator('[data-field-tab-button="agora"]').click();assert(await page.locator('#finishBtn').isEnabled());assert.equal(await page.locator('#finishBtn').textContent(),'Corrigir registo');assert(await page.locator('#notes').isDisabled());assert.equal(await page.locator('#notes').inputValue(),'Extra draft retained offline');await page.waitForFunction(()=>Array.from(document.querySelectorAll('#photoList img')).some(img=>img.complete&&img.naturalWidth>0));
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  if(process.env.CW_CAPTURE_UI){require('node:fs').mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:390,height:844});await page.locator('#notes').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/EXTRA_VISIT_COMPLETED.png'});}
  const adminContext=await browser.newContext({viewport:{width:390,height:844}});
  await adminContext.addInitScript(({token,id})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id,role:'ADMIN'}));},{token:adminToken,id:admin.id});
  const administration=await adminContext.newPage(),writes=[];administration.on('request',request=>{if(['POST','PUT','PATCH','DELETE'].includes(request.method())&&new URL(request.url()).pathname.startsWith('/api/billing'))writes.push(request.url());});
  await administration.goto(base+'/billing-extras',{waitUntil:'networkidle'});await administration.waitForFunction(()=>document.getElementById('extrasStatus')?.textContent.includes('Lista atualizada'));assert.equal(await administration.locator('a.confirm').getAttribute('href'),'/invoices');assert.deepEqual(writes,[]);assert.equal(await administration.locator('[onclick="confirm()"] ').count(),0);await adminContext.close();
  assert.deepEqual(errors,[]);console.log('PASS real mobile start, typed draft/photo, offline reload/completion, lost committed response, recovery, protected image and completed read-only record');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
