const assert = require('node:assert/strict');
require('../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true') throw new Error('Run only in isolated test/QA mode');
const { prisma } = require('../src/prismaClient');
const { processOverdue } = require('../src/services/waterReminderService');
const BASE = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
const results = [];
async function main() {
  const suffix = Date.now();
  const tech = await prisma.technician.create({ data: { name: `Water QA ${suffix}`, pin: '927418', active: true } });
  const other = await prisma.technician.create({ data: { name: `Water Other ${suffix}`, pin: '927419', active: true } });
  const client = await prisma.client.create({ data: { name: `Water client ${suffix}`, active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Water QA Pool', clientId: client.id } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, date: new Date(), status: 'PLANNED' } });
  async function call(method, path, token, body) {
    const response = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  }
  const login = await call('POST', '/api/technician-auth/login', null, { pin: tech.pin }); assert.equal(login.status, 200);
  const foreignLogin = await call('POST', '/api/technician-auth/login', null, { pin: other.pin }); assert.equal(foreignLogin.status, 200);
  const token = login.body.token, otherToken = foreignLogin.body.token, path = '/api/technician/water-reminders';
  const payload = { localId: `qa-${suffix}`, visitId: visit.id, poolId: pool.id, clientId: client.id, technicianId: tech.id, dueAt: new Date(Date.now()-60000).toISOString() };
  const test = async (name, fn) => { try { await fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false, error: e.message }); console.error('FAIL', name, e.message); } };
  await test('unauthenticated create rejected', async()=>assert.equal((await call('POST', path, null, payload)).status,401));
  await test('foreign visit create rejected', async()=>assert.equal((await call('POST', path, otherToken, payload)).status,403));
  await test('spoofed technician rejected', async()=>assert.equal((await call('POST', path, token, {...payload,technicianId:other.id})).status,400));
  let id;
  await test('concurrent replay creates one reminder', async()=>{ const replies=await Promise.all([call('POST',path,token,payload),call('POST',path,token,payload)]); replies.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.body))); id=replies[0].body.reminder.id;assert.equal(replies[1].body.reminder.id,id);assert.equal(await prisma.operationalReminder.count({where:{sourceKey:`water:${tech.id}:${payload.localId}`}}),1); });
  assert(id,'Creation must succeed to test remaining transitions');
  await test('pump reminder persists, escalates and closes with isolated ownership',async()=>{
    const pumpPath='/api/technician/pump-reminders';
    assert.equal((await call('POST',pumpPath,otherToken,payload)).status,403);
    const created=await call('POST',pumpPath,token,payload);assert.equal(created.status,200,JSON.stringify(created.body));
    const pumpId=created.body.reminder.id;assert.notEqual(pumpId,id);
    assert.equal((await call('POST',pumpPath,token,payload)).body.reminder.id,pumpId);
    await processOverdue();await processOverdue();
    assert.equal(await prisma.notification.count({where:{eventType:'PUMP_MANUAL_OVERDUE',metadata:{path:['reminderId'],equals:pumpId}}}),2);
    assert.equal((await call('POST',`${pumpPath}/${pumpId}/close`,otherToken,{})).status,403);
    assert.equal((await call('POST',`${pumpPath}/${pumpId}/close`,token,{})).status,200);
    assert.equal((await prisma.operationalReminder.findUnique({where:{id:pumpId}})).isCompleted,true);
    assert.equal(await prisma.notification.count({where:{eventType:'PUMP_MANUAL_OVERDUE',status:'PENDING',metadata:{path:['reminderId'],equals:pumpId}}}),0);
    assert(!(await call('GET',path,token)).body.reminders.some(row=>row.id===pumpId));
  });

  await test('foreign close rejected',async()=>assert.equal((await call('POST',`${path}/${id}/close`,otherToken,{})).status,403));
  await test('unknown close returns404',async()=>assert.equal((await call('POST',`${path}/99999999/close`,token,{})).status,404));
  await test('server escalates without browser and repeats safely',async()=>{await processOverdue();await processOverdue();assert.equal(await prisma.technicalAlert.count({where:{poolId:pool.id,type:'AGUA_ABERTA'}}),1);assert.equal(await prisma.notification.count({where:{clientId:client.id,eventType:'WATER_OPEN_OVERDUE'}}),2);});
  await test('foreign list hides reminder',async()=>{const r=await call('GET',path,otherToken);assert.equal(r.status,200);assert(!r.body.reminders.some(x=>x.id===id));});
  await test('close resolves linked alarm only',async()=>{const r=await call('POST',`${path}/${id}/close`,token,{});assert.equal(r.status,200);assert.equal(r.body.reminder.isCompleted,true);assert.equal(await prisma.technicalAlert.count({where:{poolId:pool.id,status:'OPEN'}}),0);});
  await test('late alarm cannot reopen a closed reminder',async()=>{const r=await call('POST',`${path}/${id}/alarm`,token,{});assert.equal(r.status,200);assert.equal(r.body.reminder.isCompleted,true);assert.equal(await prisma.technicalAlert.count({where:{poolId:pool.id,type:'AGUA_ABERTA'}}),1);});
  await test('replayed create preserves closed state',async()=>{const r=await call('POST',path,token,payload);assert.equal(r.body.reminder.id,id);assert.equal(r.body.reminder.isCompleted,true);});
  await test('field reload can retrieve authoritative state',async()=>{const r=await call('GET',path,token);assert(r.body.reminders.some(x=>x.id===id&&x.isCompleted));});
  await test('handover retains owner until acceptance and rejects outsiders/stale requests',async()=>{
    const created=await call('POST',path,token,{...payload,localId:`handover-${suffix}`,dueAt:new Date(Date.now()+3600000).toISOString()});
    const reminderId=created.body.reminder.id,base=`/api/technician/reminder-handovers/${reminderId}`;
    assert.equal((await call('POST',`${base}/request`,otherToken,{technicianId:other.id,reason:'Fim de turno'})).status,403);
    const requested=await call('POST',`${base}/request`,token,{technicianId:other.id,reason:'Fim de turno'});
    assert.equal(requested.status,200,JSON.stringify(requested.body));
    const handoverId=requested.body.reminder.metadata.handover.id;
    assert.equal(requested.body.reminder.assignedToTechnicianId,tech.id);
    assert.equal((await call('POST',`${base}/request`,token,{technicianId:other.id,reason:'Repetido'})).status,409);
    assert((await call('GET','/api/technician/reminder-handovers/incoming',otherToken)).body.reminders.some(row=>row.id===reminderId));
    assert.equal((await call('POST',`${base}/accept`,token,{handoverId})).status,403);
    assert.equal((await call('POST',`${base}/accept`,otherToken,{handoverId:'stale'})).status,409);
    const accepted=await Promise.all([call('POST',`${base}/accept`,otherToken,{handoverId}),call('POST',`${base}/accept`,otherToken,{handoverId})]);
    accepted.forEach(reply=>assert.equal(reply.status,200,JSON.stringify(reply.body)));
    assert.equal((await prisma.operationalReminder.findUnique({where:{id:reminderId}})).assignedToTechnicianId,other.id);
    assert.equal(await prisma.technicalHistory.count({where:{poolId:pool.id,message:{startsWith:'HANDOVER_ACCEPTED'}}}),1);
    assert((await call('GET',path,token)).body.reminders.some(row=>row.id===reminderId&&row.transferredAway));
    assert.equal((await call('POST',`${path}/${reminderId}/close`,token,{})).status,403);
    assert.equal((await call('POST',`${path}/${reminderId}/close`,otherToken,{})).status,200);
  });
  await test('cancelled or physically closed requests cannot be accepted',async()=>{
    for(const close of [false,true]){
      const created=await call('POST',path,token,{...payload,localId:`cancel-${close}-${suffix}`,dueAt:new Date(Date.now()+3600000).toISOString()});
      const reminderId=created.body.reminder.id,base=`/api/technician/reminder-handovers/${reminderId}`;
      const request=await call('POST',`${base}/request`,token,{technicianId:other.id,reason:'Troca de turno'});
      const handoverId=request.body.reminder.metadata.handover.id;
      assert.equal((await call('POST',close?`${path}/${reminderId}/close`:`${base}/cancel`,token,{handoverId})).status,200);
      assert.equal((await call('POST',`${base}/accept`,otherToken,{handoverId})).status,409);
      assert.equal((await prisma.operationalReminder.findUnique({where:{id:reminderId}})).assignedToTechnicianId,tech.id);
    }
  });
  await test('critical reminders repeat every 15 minutes, follow acceptance and stop on closure',async()=>{
    const service=require('../src/services/waterReminderService');
    for(const endpoint of [path,'/api/technician/pump-reminders']){
      const created=await call('POST',endpoint,token,{...payload,localId:`repeat-${endpoint}-${suffix}`});assert.equal(created.status,200);
      const reminderId=created.body.reminder.id;await service.transition({role:'ADMIN'},reminderId,'alarm');
      const row=await prisma.operationalReminder.findUnique({where:{id:reminderId}}),first=Date.parse(row.metadata.alarmedAt);
      assert.equal((await service.repeatOverdue(reminderId,new Date(first+service.REPEAT_INTERVAL_MS-1))).repeated,false);
      const replies=await Promise.all([service.repeatOverdue(reminderId,new Date(first+service.REPEAT_INTERVAL_MS)),service.repeatOverdue(reminderId,new Date(first+service.REPEAT_INTERVAL_MS))]);assert.equal(replies.filter(r=>r.repeated).length,1);
      const filter={eventType:endpoint===path?'WATER_OPEN_OVERDUE':'PUMP_MANUAL_OVERDUE',metadata:{path:['reminderId'],equals:reminderId}};
      assert.equal(await prisma.notification.count({where:{...filter,status:'PENDING'}}),2);assert.equal(await prisma.notification.count({where:{...filter,status:'SUPERSEDED'}}),2);
      await prisma.notification.updateMany({where:{...filter,role:'TECHNICIAN',status:'PENDING'},data:{status:'SENT'}});
      const base=`/api/technician/reminder-handovers/${reminderId}`;
      const requested=await call('POST',`${base}/request`,token,{technicianId:other.id,reason:'Substituição em campo'});
      const accepted=await call('POST',`${base}/accept`,otherToken,{handoverId:requested.body.reminder.metadata.handover.id});assert.equal(accepted.status,200);
      assert.equal(await prisma.notification.count({where:{...filter,role:'TECHNICIAN',status:'SENT'}}),0);
      await service.repeatOverdue(reminderId,new Date(first+2*service.REPEAT_INTERVAL_MS));
      const next=await prisma.notification.findFirst({where:{...filter,role:'TECHNICIAN',status:'PENDING'}});assert.equal(next.metadata.technicianId,other.id);
      assert.equal((await call('POST',`${endpoint}/${reminderId}/close`,otherToken,{})).status,200);
      assert.equal((await service.repeatOverdue(reminderId,new Date(first+3*service.REPEAT_INTERVAL_MS))).repeated,false);
      assert.equal(await prisma.notification.count({where:{...filter,status:{in:['PENDING','SENT']}}}),0);
    }
  });
  await test('incomplete visit preserves work, notifies once and rejects foreign/completed visits',async()=>{
    const incomplete=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,status:'PLANNED',ph:7.4,cleaned:false}});
    const endpoint=`/api/technician/visits/${incomplete.id}/incomplete`;
    const report={requestId:require('node:crypto').randomUUID(),reason:'NO_KEY',nextStep:'Escritório confirmar chave e combinar regresso'};
    assert.equal((await call('POST',endpoint,otherToken,report)).status,403);
    assert.equal((await call('POST',endpoint,token,{...report,nextStep:''})).status,400);
    const replies=await Promise.all([call('POST',endpoint,token,report),call('POST',endpoint,token,report)]);replies.forEach(reply=>assert.equal(reply.status,200,JSON.stringify(reply.body)));
    assert.equal(replies[0].body.reminder.id,replies[1].body.reminder.id);
    const saved=await prisma.serviceVisit.findUnique({where:{id:incomplete.id}});assert.equal(saved.status,'INCOMPLETE');assert.equal(saved.endAt,null);assert.equal(saved.ph,7.4);assert.equal(saved.cleaned,false);
    assert.equal(await prisma.notification.count({where:{eventType:'VISIT_INCOMPLETE',metadata:{path:['visitId'],equals:incomplete.id}}}),1);
    await prisma.serviceVisit.update({where:{id:incomplete.id},data:{status:'DONE',endAt:new Date()}});
    assert.equal((await call('POST',endpoint,token,{...report,requestId:require('node:crypto').randomUUID()})).status,409);
    assert.equal((await call('POST',endpoint,token,report)).status,200);
  });

  await test('start checks live ownership, rejects closed visits and preserves first start on concurrent retry',async()=>{
    const own=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,status:'PLANNED'}}),endpoint=`/api/visits/${own.id}/start`;
    assert.equal((await call('POST',endpoint,otherToken,{})).status,403);
    const replies=await Promise.all([call('POST',endpoint,token,{}),call('POST',endpoint,token,{})]);replies.forEach(reply=>assert.equal(reply.status,200,JSON.stringify(reply.body)));assert.equal(replies[0].body.visit.startAt,replies[1].body.visit.startAt);
    const startedAt=replies[0].body.visit.startAt;assert.equal((await call('POST',endpoint,token,{})).body.visit.startAt,startedAt);
    await prisma.serviceVisit.update({where:{id:own.id},data:{technicianId:other.id}});
    const result=await require('../src/business/technician/TechnicianVisitBusiness').startVisit(own.id,{id:tech.id,technicianId:tech.id,role:'TECHNICIAN'});assert.equal(result.status,403);
    await prisma.serviceVisit.update({where:{id:own.id},data:{status:'DONE',endAt:new Date()}});assert.equal((await call('POST',endpoint,otherToken,{})).status,409);
  });
  await test('transfer receipts require the recipient, survive retries and reject superseded assignments',async()=>{
    const uuid=()=>require('node:crypto').randomUUID(),admin=await call('POST','/api/auth/login',null,{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});assert.equal(admin.status,200);
    const own=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,status:'PLANNED',plannedDate:new Date()}});
    const transfer=async technicianId=>{
      const body={visitIds:[own.id],technicianId,reason:'Apoio por falta de química na viatura'};
      const preview=await call('POST','/api/rounds/transfer-visits',admin.body.token,{...body,preview:true});assert.equal(preview.status,200);
      const done=await call('POST','/api/rounds/transfer-visits',admin.body.token,{...body,expected:preview.body.visits,requestId:uuid()});assert.equal(done.status,200);
      return (await prisma.operationalReminder.findFirst({where:{sourceKey:{startsWith:`visit-receipt:${own.id}:`}},orderBy:{id:'desc'}})).id;
    };
    const first=await transfer(other.id),base='/api/technician/visit-receipts';
    assert(!(await call('GET',base,token)).body.receipts.some(row=>row.id===first));
    assert((await call('GET',base,otherToken)).body.receipts.some(row=>row.id===first));
    assert.equal((await call('POST',`${base}/${first}/acknowledge`,token,{})).status,403);assert.equal((await call('POST',`${base}/${first}/acknowledge`,admin.body.token,{})).status,403);
    const receipt=await prisma.operationalReminder.findUnique({where:{id:first}});
    await prisma.operationalReminder.update({where:{id:first},data:{metadata:{...receipt.metadata,assignedAt:new Date(Date.now()-45*60000).toISOString()}}});
    const alertService=require('../src/services/autoVisitAlertService');
    await Promise.all([alertService.runAutoVisitAlerts(),alertService.runAutoVisitAlerts()]);
    const alertWhere={eventType:'VISIT_RECEIPT_PENDING',metadata:{path:['receiptId'],equals:first}};
    assert.equal(await prisma.notification.count({where:alertWhere}),1);assert.equal((await prisma.notification.findFirst({where:alertWhere})).role,'ADMIN');
    const concurrent=alertService.runAutoVisitAlerts();
    const replies=await Promise.all([call('POST',`${base}/${first}/acknowledge`,otherToken,{}),call('POST',`${base}/${first}/acknowledge`,otherToken,{})]);
    await concurrent;replies.forEach(reply=>assert.equal(reply.status,200));assert.equal(replies[0].body.receivedAt,replies[1].body.receivedAt);
    assert.equal(await prisma.notification.count({where:{...alertWhere,status:'PENDING'}}),0);
    assert.equal(await prisma.technicalHistory.count({where:{poolId:pool.id,type:'VISIT_ASSIGNMENT_RECEIVED'}}),1);assert.equal((await prisma.serviceVisit.findUnique({where:{id:own.id}})).startAt,null);
    await transfer(tech.id);const fresh=await transfer(other.id);assert.equal((await call('POST',`${base}/${first}/acknowledge`,otherToken,{})).status,409);
    const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
    try{
      const context=await browser.newContext({viewport:{width:390,height:844}});
      const seed=({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));};
      await context.addInitScript(seed,{token:otherToken,user:foreignLogin.body.user});
      const page=await context.newPage();await page.goto(BASE+'/technician-field-mode',{waitUntil:'networkidle'});const button=page.locator(`[data-receipt="${fresh}"]`);await button.waitFor();
      await context.setOffline(true);await button.click();assert.match(await page.locator('#receiptStatus').textContent(),/Sem ligação/);assert.equal((await prisma.operationalReminder.findUnique({where:{id:fresh}})).isCompleted,false);
      await context.setOffline(false);await page.locator('#receiptRefresh').click();await button.click();await page.waitForFunction(()=>document.getElementById('receiptStatus').textContent.includes('Receção confirmada'));
      assert.equal((await prisma.operationalReminder.findUnique({where:{id:fresh}})).isCompleted,true);
      if(process.env.CW_CAPTURE_UI==='true'){require('node:fs').mkdirSync('reports/field-ui',{recursive:true});await page.locator('#visitReceiptPanel').screenshot({path:'reports/field-ui/TECHNICIAN_VISIT_RECEIPT.png'});}
      await context.close();
      const office=await browser.newContext({viewport:{width:390,height:844}});await office.addInitScript(seed,{token:admin.body.token,user:admin.body.user});const adminPage=await office.newPage();await adminPage.goto(BASE+'/admin-rounds',{waitUntil:'networkidle'});assert.match(await adminPage.locator(`[data-admin-receipt="${fresh}"]`).textContent(),/Receção confirmada/);await office.close();
    }finally{await browser.close();}
    await transfer(tech.id);const cancelled=await transfer(other.id);
    const future=new Date();future.setDate(future.getDate()+3);await prisma.serviceVisit.update({where:{id:own.id},data:{plannedDate:future}});
    const futureReceipt=await prisma.operationalReminder.findUnique({where:{id:cancelled}});await prisma.operationalReminder.update({where:{id:cancelled},data:{metadata:{...futureReceipt.metadata,assignedAt:new Date(Date.now()-3600000).toISOString()}}});
    await alertService.runAutoVisitAlerts();assert.equal(await prisma.notification.count({where:{eventType:'VISIT_RECEIPT_PENDING',metadata:{path:['receiptId'],equals:cancelled}}}),0);
await prisma.serviceVisit.update({where:{id:own.id},data:{status:'CANCELLED'}});assert.equal((await call('POST',`${base}/${cancelled}/acknowledge`,otherToken,{})).status,409);
  });
  await test('chemical shortage requires a product, preserves unknown quantity and never consumes stock',async()=>{
    const own=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,status:'PLANNED',ph:7.4}});
    const endpoint=`/api/technician/visits/${own.id}/incomplete`,payload={requestId:require('node:crypto').randomUUID(),reason:'CHEMICAL_MISSING',nextStep:'Repor produto antes de executar o tratamento'};
    for(const chemicalShortage of [undefined,{productName:'Hipoclorito',quantity:-1,unit:'L'},{productName:'Hipoclorito',quantity:2,unit:'ML'}])assert.equal((await call('POST',endpoint,token,{...payload,chemicalShortage})).status,400);
    const sent={...payload,chemicalShortage:{productName:'Hipoclorito de sódio',quantity:null,unit:'L'}};
    const response=await call('POST',endpoint,token,sent);assert.equal(response.status,200);assert.equal(response.body.reminder.metadata.chemicalShortage.quantity,null);assert.match(response.body.reminder.description,/Quantidade: por confirmar/);
    assert.equal((await call('POST',endpoint,token,sent)).body.reminder.id,response.body.reminder.id);
    for(const changed of [
      {...sent,chemicalShortage:{...sent.chemicalShortage,quantity:5}},
      {...sent,chemicalShortage:{...sent.chemicalShortage,productName:'Outro produto'}},
      {...sent,chemicalShortage:{...sent.chemicalShortage,unit:'KG'}},
      {...sent,nextStep:'Outra ação para o regresso'},
      {...sent,reason:'MATERIAL_MISSING'},
    ])assert.equal((await call('POST',endpoint,token,changed)).status,409);
    for(const quantity of [true,[],{},[5]])assert.equal((await call('POST',endpoint,token,{...sent,chemicalShortage:{...sent.chemicalShortage,quantity}})).status,400);
    assert.equal((await call('POST',endpoint,token,{...sent,reason:'__proto__'})).status,400);
    const retries=await Promise.all([call('POST',endpoint,token,sent),call('POST',endpoint,token,sent)]);
    retries.forEach(r=>{assert.equal(r.status,200);assert.equal(r.body.reminder.id,response.body.reminder.id)});
    assert.equal(await prisma.operationalReminder.count({where:{sourceKey:`incomplete:${own.id}:${sent.requestId}`}}),1);
    const saved=await prisma.serviceVisit.findUnique({where:{id:own.id}});assert.equal(saved.ph,7.4);assert.equal(saved.endAt,null);assert.equal(saved.cleaned,false);assert.equal(await prisma.stockMovement.count({where:{visitId:own.id}}),0);
    const shortagePath='/api/technician/chemical-shortages';
    assert((await call('GET',shortagePath,token)).body.rows.some(row=>row.visitId===own.id&&row.quantity===null));
    assert(!(await call('GET',shortagePath,otherToken)).body.rows.some(row=>row.visitId===own.id));
    const updated={...sent,requestId:require('node:crypto').randomUUID(),chemicalShortage:{productName:'Hipoclorito de sódio',quantity:25,unit:'L'}};
    assert.equal((await call('POST',endpoint,token,updated)).status,200);
    const ownRows=(await call('GET',shortagePath,token)).body.rows.filter(row=>row.visitId===own.id);assert.equal(ownRows.length,1);assert.equal(ownRows[0].quantity,25);
    const admin=await call('POST','/api/auth/login',null,{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});
    const scheduled=await call('POST',`/api/technician/visits/${own.id}/schedule-return`,admin.body.token,{requestId:require('node:crypto').randomUUID(),date:'2034-01-10',technicianId:other.id,instructions:'Levar o produto em falta antes de executar o tratamento'});assert.equal(scheduled.status,200,JSON.stringify(scheduled.body));
    assert(!(await call('GET',shortagePath,token)).body.rows.some(row=>row.reportedVisitId===own.id));
    const receiverRows=(await call('GET',shortagePath,otherToken)).body.rows.filter(row=>row.visitId===scheduled.body.visit.id);assert.equal(receiverRows.length,1);assert.equal(receiverRows[0].quantity,25);
    const repeated=await call('POST',`/api/technician/visits/${scheduled.body.visit.id}/incomplete`,otherToken,{...updated,requestId:require('node:crypto').randomUUID(),chemicalShortage:{productName:'Hipoclorito de sódio',quantity:10,unit:'L'}});assert.equal(repeated.status,200);
    const revised=(await call('GET',shortagePath,otherToken)).body.rows.filter(row=>row.visitId===scheduled.body.visit.id);assert.equal(revised.length,1);assert.equal(revised[0].quantity,10);

  });
  await test('office return is authorized, idempotent, visible on mobile and resolved only by completion',async()=>{
    const uuid=()=>require('node:crypto').randomUUID();
    const admin=await call('POST','/api/auth/login',null,{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});assert.equal(admin.status,200);
    const adminToken=admin.body.token,base='/api/technician/incomplete-followups';
    assert.equal((await call('GET',base,token)).status,403);
    const originalDate=new Date(),original=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,plannedDate:originalDate,ph:7.4,status:'PLANNED'}});
    const report=await call('POST',`/api/technician/visits/${original.id}/incomplete`,token,{requestId:uuid(),reason:'NO_KEY',nextStep:'Confirmar acesso e levar chave correta'});assert.equal(report.status,200);
    const endpoint=`/api/technician/visits/${original.id}/schedule-return`,payload={requestId:uuid(),date:'2035-01-20',technicianId:other.id,instructions:'Chave confirmada com cliente; executar manutenção completa'};
    assert.equal((await call('POST',endpoint,token,payload)).status,403);
    for(const date of ['2020-01-01','2035-02-30'])assert.equal((await call('POST',endpoint,adminToken,{...payload,date})).status,400);
    await prisma.technician.update({where:{id:other.id},data:{active:false}});
    assert.equal((await call('POST',endpoint,adminToken,payload)).status,400);
    await prisma.technician.update({where:{id:other.id},data:{active:true}});
    const conflict=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,plannedDate:new Date('2035-01-20T08:00:00'),status:'PLANNED'}});
    assert.equal((await call('POST',endpoint,adminToken,payload)).status,409);
    await prisma.serviceVisit.update({where:{id:conflict.id},data:{status:'CANCELLED'}});
    const replies=await Promise.all([call('POST',endpoint,adminToken,payload),call('POST',endpoint,adminToken,payload)]);
    replies.forEach(reply=>assert.equal(reply.status,200,JSON.stringify(reply.body)));const returned=replies[0].body.visit;
    assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`visit-receipt:${returned.id}:`}}}),1);
    assert((await call('GET','/api/technician/visit-receipts',otherToken)).body.receipts.some(row=>row.visitId===returned.id));
    assert.equal(replies[1].body.visit.id,returned.id);assert.equal(returned.technicianId,other.id);assert.equal(returned.ph,null);assert.equal(returned.cleaned,false);assert(!returned.notes.includes(payload.instructions));
    assert.equal((await call('POST',endpoint,adminToken,{...payload,requestId:uuid()})).status,409);
    assert.equal((await prisma.serviceVisit.findUnique({where:{id:original.id}})).plannedDate.getTime(),originalDate.getTime());
    const list=await call('GET',base,adminToken);assert(list.body.reminders.some(row=>row.metadata.visitId===original.id&&row.returnVisit.id===returned.id&&!row.isCompleted));
    const {completeServiceVisit}=require('../src/services/serviceVisitCompletionService');
    await assert.rejects(completeServiceVisit(prisma,original.id,{ph:7.4,chlorine:1.5}),error=>error.code==='RETURN_ALREADY_SCHEDULED');
    assert.equal((await call('POST',`/api/technician/visits/${original.id}/incomplete`,token,{requestId:uuid(),reason:'OTHER',nextStep:'Novo impedimento deve ir no regresso'})).status,409);
    // Exercise the real office form on a narrow screen, including duplicate prevention after reload.
    const uiPool=await prisma.pool.create({data:{name:'Regresso móvel QA',clientId:client.id}});
    const uiOriginal=await prisma.serviceVisit.create({data:{poolId:uiPool.id,clientId:client.id,technicianId:tech.id,status:'PLANNED'}});
    await call('POST',`/api/technician/visits/${uiOriginal.id}/incomplete`,token,{requestId:uuid(),reason:'MATERIAL_MISSING',nextStep:'Levar peça de substituição e confirmar acesso'});
    const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
    try{
      const context=await browser.newContext({viewport:{width:390,height:844}});
      await context.addInitScript(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({...user,role:'ADMIN'}));},{token:adminToken,user:admin.body.user});
      const page=await context.newPage();await page.goto(BASE+'/admin-alerts',{waitUntil:'networkidle'});
      const row=page.locator(`[data-followup-visit="${uiOriginal.id}"]`);await row.waitFor();
      await row.locator('[name="technicianId"]').selectOption(String(other.id));await row.locator('[name="instructions"]').fill('Levar peça nova; acesso confirmado com o cliente');
      for(const width of [320,390]){await page.setViewportSize({width,height:844});const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.width+1,JSON.stringify(size));}
      if(process.env.CW_CAPTURE_UI==='true'){require('node:fs').mkdirSync('reports/field-ui',{recursive:true});await row.screenshot({path:'reports/field-ui/ADMIN_RETURN_FORM.png'});}
      await row.getByRole('button',{name:'Agendar regresso'}).click();await page.getByRole('dialog').getByRole('button',{name:'Agendar',exact:true}).click();
      await page.waitForFunction(()=>document.getElementById('followupStatus').textContent.includes('registado'));
      assert.match(await row.textContent(),/O aviso continua aberto/);
      assert.equal(await row.locator('form').count(),0);
      const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.width+1,JSON.stringify(size));
      if(process.env.CW_CAPTURE_UI==='true'){require('node:fs').mkdirSync('reports/field-ui',{recursive:true});await page.locator('#incompleteFollowups').screenshot({path:'reports/field-ui/ADMIN_RETURN_FOLLOWUP.png'});}
      await page.reload({waitUntil:'networkidle'});await row.waitFor();assert.equal(await row.locator('form').count(),0);
      await context.close();
      const assigned=await call('GET','/api/technician/today',otherToken);assert.equal(assigned.status,200);
      const fieldReturn=assigned.body.visits.find(v=>v.pool?.id===uiPool.id);assert(fieldReturn,'Return appears on assigned technician route');assert.equal(fieldReturn.reason,'INCOMPLETE_RETURN');
      const techContext=await browser.newContext({viewport:{width:390,height:844}});
      await techContext.addInitScript(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{token:otherToken,user:foreignLogin.body.user});
      const fieldPage=await techContext.newPage();await fieldPage.goto(BASE+`/technician-field-mode?activeTab=agora&selectedVisitId=${fieldReturn.id}`,{waitUntil:'networkidle'});
      await fieldPage.locator('#visitNoticeStrip').waitFor();assert.match(await fieldPage.locator('#visitNoticeStrip').textContent(),/Levar peça nova; acesso confirmado/);
      await fieldPage.locator('[data-field-tab-button=hoje]').click();await fieldPage.locator('#receiptList details').waitFor();
      const futureReceipt=await prisma.operationalReminder.findFirst({where:{sourceKey:{startsWith:`visit-receipt:${returned.id}:`}}});
      const futureButton=fieldPage.locator(`[data-receipt="${futureReceipt.id}"]`);assert(await futureButton.isHidden());await fieldPage.locator('#receiptList details summary').click();assert(await futureButton.isVisible());
      await fieldPage.locator('[data-field-tab-button=agora]').click();

      if(process.env.CW_CAPTURE_UI==='true'){await fieldPage.locator('#toast.show').waitFor({state:'hidden'});await fieldPage.locator('#visitNoticeStrip').evaluate(node=>node.scrollIntoView({block:'center'}));await fieldPage.locator('#visitNoticeStrip').screenshot({path:'reports/field-ui/TECHNICIAN_RETURN_INSTRUCTIONS.png'});}
      await techContext.close();
    }finally{await browser.close();}
    const secondReport=await call('POST',`/api/technician/visits/${returned.id}/incomplete`,otherToken,{requestId:uuid(),reason:'CLIENT_REFUSED',nextStep:'Cliente pediu outra data; combinar nova deslocação'});assert.equal(secondReport.status,200);
    const nextEndpoint=`/api/technician/visits/${returned.id}/schedule-return`,nextPayload={...payload,requestId:uuid(),date:'2035-01-22',technicianId:tech.id};
    const third=await call('POST',nextEndpoint,adminToken,nextPayload);assert.equal(third.status,200,JSON.stringify(third.body));
    await prisma.serviceVisit.update({where:{id:third.body.visit.id},data:{status:'CANCELLED'}});
    const cancelledReplay=await call('POST',nextEndpoint,adminToken,nextPayload);assert.equal(cancelledReplay.body.visit.id,third.body.visit.id);assert.equal(cancelledReplay.body.visit.status,'CANCELLED');
    const replacement=await call('POST',nextEndpoint,adminToken,{...nextPayload,requestId:uuid()});assert.equal(replacement.status,200);assert.notEqual(replacement.body.visit.id,third.body.visit.id);
    await completeServiceVisit(prisma,replacement.body.visit.id,{ph:7.4,chlorine:1.5,performedByTechnicianId:tech.id});
    assert.equal((await prisma.operationalReminder.findUnique({where:{id:secondReport.body.reminder.id}})).isCompleted,true);

    assert.equal((await prisma.operationalReminder.findUnique({where:{id:report.body.reminder.id}})).isCompleted,true);
    assert.equal(await prisma.notification.count({where:{eventType:'VISIT_INCOMPLETE',status:'PENDING',metadata:{path:['reminderId'],equals:report.body.reminder.id}}}),0);
    const preserved=await prisma.serviceVisit.findUnique({where:{id:original.id}});assert.equal(preserved.status,'INCOMPLETE');assert.equal(preserved.endAt,null);assert.equal(preserved.ph,7.4);
    assert.equal((await call('POST',endpoint,adminToken,payload)).body.visit.id,returned.id);
    await assert.rejects(completeServiceVisit(prisma,original.id,{ph:7.4,chlorine:1.5}),error=>error.code==='RETURN_ALREADY_SCHEDULED');
  });
  console.log(JSON.stringify({results},null,2));
  if(results.some(r=>!r.pass))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
