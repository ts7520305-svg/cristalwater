'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{randomUUID}=require('node:crypto');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
const calendar=require('../src/services/clientServicePlan'),scheduler=require('../src/services/clientServiceScheduleService'),rates=require('../src/business/finance/ClientRateBusiness');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
(async()=>{
  const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),actor={id:admin.id,userId:admin.id,role:'ADMIN'},token=jwt.sign(actor,getJwtSecret(),{expiresIn:'1h'});
  const tech=await prisma.technician.create({data:{name:'QA seasonal technician',active:true}}),otherTech=await prisma.technician.create({data:{name:'QA seasonal substitute',active:true}});
  const client=await prisma.client.create({data:{name:'QA seasonal client '+Date.now(),active:true,status:'ACTIVE',billingActive:true,monthlyFee:99}}),other=await prisma.client.create({data:{name:'QA unrelated seasonal client',active:true}});
  const pool=await prisma.pool.create({data:{clientId:client.id,name:'Main seasonal pool',active:true,volumeM3:50,monthlyAmount:80,technicalSheet:{create:{volumeM3:50,disinfectionType:'SALT'}}}});
  const foreign=await prisma.pool.create({data:{clientId:other.id,name:'Foreign pool'}});
  const path='/api/settings/client-services/'+client.id;
  const call=async(url,body,method='POST',auth=token)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.body;};
  const rule=days=>({poolId:pool.id,frequency:'WEEKLY',count:days.length,slots:days.map(day=>({day,at:'08:00'})),technicianId:tech.id});
  const input={baseMonthlyAmount:0,periods:[],expectedVersion:0,monthRef:'2031-01',servicePlan:{startsOn:'2031-01-01',endsOn:'2032-12-31',seasons:[{label:'Inverno QA',services:'Limpeza e análises',fromMonth:9,toMonth:5,monthlyAmount:100,schedules:[rule([1])]},{label:'Verão QA',services:'Mais visitas, preço acordado',fromMonth:6,toMonth:8,monthlyAmount:250,schedules:[rule([1,3,5])]}]}};
  for(const [auth,status] of [[null,401],[jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret()),403],[jwt.sign({id:client.id,clientId:client.id,role:'CLIENT'},getJwtSecret()),403]])for(const [url,body,method] of [[path,null,'GET'],[path+'/preview',input,'POST'],[path,input,'PUT'],[path+'/calendar-preview',input,'POST'],[path+'/calendar',input,'POST']])assert.equal((await call(url,body,method,auth)).status,status);
  const bad=structuredClone(input);bad.servicePlan.seasons[0].schedules[0].poolId=foreign.id;assert.equal((await call(path+'/preview',bad)).status,400);
  let preview=await ok(path+'/preview',input);assert.equal(preview.pricing.amount,100);assert(preview.summary.create>0);assert.equal(await prisma.clientRatePlan.count({where:{clientId:client.id}}),0);
  const initial={...input,reviewToken:preview.reviewToken,requestId:randomUUID()};
  const replies=await Promise.all(Array.from({length:6},()=>ok(path,initial,'PUT')));for(const r of replies)assert.deepEqual(r,replies[0]);assert.equal(await prisma.clientRatePlan.count({where:{clientId:client.id}}),1);
  assert.equal((await call(path,{...initial,monthRef:'2031-02'},'PUT')).status,409);
  const plan=(await rates.latest(client.id)).snapshot.servicePlan;
  for(const year of [2031,2032])for(let m=1;m<=12;m++){
    const monthRef=`${year}-${String(m).padStart(2,'0')}`,body={expectedVersion:1,monthRef};
    preview=await ok(path+'/calendar-preview',body);const request={...body,reviewToken:preview.reviewToken,requestId:randomUUID()};
    const results=await Promise.all([ok(path+'/calendar',request),ok(path+'/calendar',request)]);assert.deepEqual(results[0],results[1]);
    const visits=await prisma.serviceVisit.findMany({where:{clientId:client.id,plannedDate:{gte:calendar.localDate(monthRef+'-01','00:00'),lt:calendar.localDate(calendar.daysOfMonth(monthRef).at(-1),'23:59')},status:{not:'CANCELLED'}},orderBy:{plannedDate:'asc'}});
    const expected=calendar.daysOfMonth(monthRef).flatMap(day=>calendar.due(calendar.onDay(plan,day).schedules[0],day).map(slot=>calendar.localDate(day,slot.at).toISOString()));
    assert.deepEqual(visits.map(v=>v.plannedDate.toISOString()),expected,monthRef);
    for(const v of visits){assert.equal(v.technicianId,tech.id);assert.equal(v.contractService.planVersion,1);assert.equal(v.contractService.billing,'INCLUDED_MONTHLY');assert.equal(v.revenue,0);assert(!JSON.stringify(v.contractService).includes('monthlyCents'));}
  }
  console.log('PASS ADMIN boundaries, foreign pool rejected, version/receipt replay, 24 months with actual weekly dates, leap year, season transitions and concurrent calendar replay');
  const summer=await prisma.serviceVisit.findFirstOrThrow({where:{clientId:client.id,plannedDate:{gte:calendar.localDate('2031-06-01','00:00'),lt:calendar.localDate('2031-07-01','00:00')}}});
  await prisma.serviceVisit.update({where:{id:summer.id},data:{status:'DONE',endAt:summer.plannedDate,revenue:999}});
  const invoice=await ok('/api/core/invoices/generate',{clientId:client.id,monthRef:'2031-06'});assert.equal(invoice.invoice.total,250);assert.equal(invoice.lines.services,0);assert(!invoice.invoice.lines.some(l=>l.type==='SERVICE'));
  const savedInvoice=await prisma.invoice.findUnique({where:{id:invoice.invoice.id},include:{lines:true}});
  const manualInvoice=await require('../src/business/finance/FinanceOsBusiness').createDraftInvoice({clientId:client.id,standalone:true,lines:[{type:'SERVICE',referenceId:summer.id,unitPrice:99,quantity:1}]},'qa-seasonal');assert.equal(manualInvoice.ok,false);assert.equal(manualInvoice.status,409);
  const monthly=require('../src/business/finance/MonthlyBillingBusiness'),page=require('../src/business/finance/InvoicePageGenerationBusiness');
  await monthly.generateForClient(client.id,'2031-07');assert.equal((await prisma.invoice.findUnique({where:{clientId_monthRef:{clientId:client.id,monthRef:'2031-07'}}})).total,250);
  assert.equal((await page.generateForClient(client.id,{monthRef:'2031-08'})).invoice.total,250);
  assert.equal((await call('/api/settings/client-rates/'+client.id,{baseMonthlyAmount:500,periods:[],expectedVersion:1},'PUT')).status,409);
  // A revision must not rewrite started, completed, reassigned or manually planned visits.
  const future=await prisma.serviceVisit.findMany({where:{clientId:client.id,status:'PLANNED'},orderBy:{id:'asc'},take:4});
  await prisma.serviceVisit.update({where:{id:future[0].id},data:{startAt:new Date()}});
  await prisma.serviceVisit.update({where:{id:future[1].id},data:{technicianId:otherTech.id}});
  const manual=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,plannedDate:calendar.localDate('2031-06-03','10:00'),reason:'MANUAL',notes:'Preserve manual work'}});
  const revised=structuredClone(input);revised.expectedVersion=1;revised.monthRef='2031-06';revised.servicePlan.seasons[1].monthlyAmount=300;revised.servicePlan.seasons[1].schedules=[rule([1,2,3,4,5])];
  preview=await ok(path+'/preview',revised);assert(preview.summary.preserve>=3);assert(preview.summary.update>0);
  // A visit starting after preview invalidates the entire mutation.
  await prisma.serviceVisit.update({where:{id:future[2].id},data:{startAt:new Date()}});
  assert.equal((await call(path,{...revised,reviewToken:preview.reviewToken,requestId:randomUUID()},'PUT')).status,409);assert.equal((await rates.latest(client.id)).version,1);
  preview=await ok(path+'/preview',revised);await ok(path,{...revised,reviewToken:preview.reviewToken,requestId:randomUUID()},'PUT');
  for(const [visitId,field,value] of [[summer.id,'status','DONE'],[future[1].id,'technicianId',otherTech.id],[manual.id,'notes','Preserve manual work']])assert.equal((await prisma.serviceVisit.findUnique({where:{id:visitId}}))[field],value);
  assert.deepEqual(await prisma.invoice.findUnique({where:{id:savedInvoice.id},include:{lines:true}}),savedInvoice);assert.equal((await rates.latest(client.id)).version,2);
  assert.equal((await ok(path,initial,'PUT')).planVersion,1,'Lost response recovers original confirmation after later revisions');
  // More than seven visits/week: two distinct visits every day, still one agreed monthly price.
  const dense=structuredClone(revised);dense.expectedVersion=2;dense.monthRef='2032-08';const r=dense.servicePlan.seasons[1].schedules[0];r.count=14;r.slots=Array.from({length:7},(_,day)=>[{day,at:'08:00'},{day,at:'16:00'}]).flat();
  preview=await ok(path+'/preview',dense);await ok(path,{...dense,reviewToken:preview.reviewToken,requestId:randomUUID()},'PUT');
  const august=await prisma.serviceVisit.findMany({where:{clientId:client.id,plannedDate:{gte:calendar.localDate('2032-08-01','00:00'),lt:calendar.localDate('2032-09-01','00:00')},status:{not:'CANCELLED'}}});assert.equal(august.length,62);assert.equal(new Set(august.map(v=>v.plannedDate.toISOString())).size,62);
  assert.equal((await ok(path+'/calendar-preview',{expectedVersion:3,monthRef:'2032-08'})).summary.create,0);
  console.log('PASS contract-included visits excluded from extra billing despite stale revenue, three invoice paths, immutable documents, stale impact protection, preserved execution/manual changes, 14 visits/week');
  const empty=structuredClone(dense);empty.expectedVersion=3;empty.monthRef='2032-05';empty.servicePlan.seasons[0].schedules[0]={...rule([1]),count:5,slots:[],technicianId:null};
  preview=await ok(path+'/preview',empty);assert(preview.summary.pending>0);assert.equal(preview.summary.create,0);await ok(path,{...empty,reviewToken:preview.reviewToken,requestId:randomUUID()},'PUT');
  const noLegacy=await require('../src/business/admin/RoundAssignmentBusiness').generateVisit(null,{pool},calendar.localDate('2032-05-02','08:00'));assert.equal(noLegacy,null);
  assert.equal(await prisma.serviceVisit.count({where:{poolId:foreign.id}}),0);
  // Current seven-day generator also resolves service calendars, independent of round templates.
  const live=await prisma.client.create({data:{name:'QA weekly service client',active:true,status:'ACTIVE'}}),livePool=await prisma.pool.create({data:{clientId:live.id,name:'Weekly service pool',volumeM3:40,technicalSheet:{create:{volumeM3:40,disinfectionType:'CHLORINE'}}}});
  const today=calendar.localDay(new Date()),current={baseMonthlyAmount:0,periods:[],expectedVersion:0,monthRef:today.slice(0,7),servicePlan:{startsOn:today,seasons:[{label:'Todo o ano',services:'Manutenção',fromMonth:1,toMonth:12,monthlyAmount:120,schedules:[{...rule([0,1,2,3,4,5,6]),poolId:livePool.id}]}]}};
  const p=await scheduler.preview(live.id,current,true);await scheduler.write(live.id,{...current,reviewToken:p.reviewToken,requestId:randomUUID()},actor,true);
  await scheduler.generateWeek(new Date());const before=await prisma.serviceVisit.count({where:{clientId:live.id}});await scheduler.generateWeek(new Date());assert.equal(await prisma.serviceVisit.count({where:{clientId:live.id}}),before);
  const noSummer=structuredClone(empty);noSummer.expectedVersion=4;noSummer.monthRef='2032-08';noSummer.servicePlan.seasons[1].schedules=[];
  preview=await ok(path+'/preview',noSummer);assert(preview.summary.cancel>=62);const recordCount=await prisma.serviceVisit.count({where:{clientId:client.id}});
  const cancellation=await ok(path,{...noSummer,reviewToken:preview.reviewToken,requestId:randomUUID()},'PUT');assert.equal(await prisma.serviceVisit.count({where:{clientId:client.id}}),recordCount);
  assert.equal((await prisma.serviceVisit.findUnique({where:{id:summer.id}})).status,'DONE');
  for(const entry of cancellation.applied.filter(a=>a.action==='CANCEL'))assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`visit-receipt:${entry.id}:`},isCompleted:false}}),0);
  // Forced audit failure must roll back the new agreement, calendar and receipt together.
  const atomic=structuredClone(noSummer);atomic.expectedVersion=5;atomic.servicePlan.seasons[1].schedules=[rule([1])];
  preview=await ok(path+'/preview',atomic);const atomicRequest={...atomic,reviewToken:preview.reviewToken,requestId:randomUUID()},beforeAtomic=await prisma.serviceVisit.count({where:{clientId:client.id}});
  const trigger='qa_seasonal_'+client.id;
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger AS $$ BEGIN IF NEW."action"='CLIENT_SERVICE_PLAN_SAVED' AND NEW."metadata"->>'clientId'='${client.id}' THEN RAISE EXCEPTION 'QA seasonal rollback'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "UserAuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
  try{assert.equal((await call(path,atomicRequest,'PUT')).status,500);assert.equal((await rates.latest(client.id)).version,5);assert.equal(await prisma.serviceVisit.count({where:{clientId:client.id}}),beforeAtomic);assert.equal(await prisma.fieldWriteRequest.count({where:{requestId:atomicRequest.requestId}}),0);}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "UserAuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
  console.log('PASS incomplete schedules remain explicit pending, legacy calendar suppressed, unrelated clients unchanged, weekly service generator repeats safely');
  // Additional cadences use an absolute reference, independent of season/year boundaries.
  const cyc=await prisma.client.create({data:{name:'QA anchored cycles',active:true,status:'ACTIVE'}}),cyclePools=[];
  for(const name of ['Fortnightly','Quarterly'])cyclePools.push(await prisma.pool.create({data:{clientId:cyc.id,name,volumeM3:40,technicalSheet:{create:{volumeM3:40,disinfectionType:'SALT'}}}}));
  const cyclePath='/api/settings/client-services/'+cyc.id,cycleInput={baseMonthlyAmount:0,periods:[],expectedVersion:0,monthRef:'2032-01',servicePlan:{startsOn:'2032-01-01',endsOn:'2032-12-31',seasons:[{label:'Cadências próprias',services:'Visitas acordadas',fromMonth:1,toMonth:12,monthlyAmount:180,schedules:[{...rule([1]),poolId:cyclePools[0].id,interval:2,anchorOn:'2032-01-05'},{poolId:cyclePools[1].id,technicianId:tech.id,frequency:'MONTHLY',interval:3,anchorOn:'2031-11-15',count:1,slots:[{day:31,at:'09:00'}]}]}]}};
  const cp=await ok(cyclePath+'/preview',cycleInput),cycleRequest={...cycleInput,reviewToken:cp.reviewToken,requestId:randomUUID()};assert.equal(cp.pricing.amount,180);
  const cycleReplies=await Promise.all([ok(cyclePath,cycleRequest,'PUT'),ok(cyclePath,cycleRequest,'PUT')]);assert.deepEqual(cycleReplies[0],cycleReplies[1]);
  const firstCyclePlan=await rates.latest(cyc.id);
  for(let m=2;m<=12;m++){const body={expectedVersion:1,monthRef:'2032-'+String(m).padStart(2,'0')},p=await ok(cyclePath+'/calendar-preview',body);assert.equal(p.pricing.amount,180);await ok(cyclePath+'/calendar',{...body,reviewToken:p.reviewToken,requestId:randomUUID()});}
  const cycleVisits=await prisma.serviceVisit.findMany({where:{clientId:cyc.id},orderBy:{plannedDate:'asc'}});
  const expectedWeeks=[];for(let d=Date.parse('2032-01-05T12:00:00Z');d<Date.parse('2033-01-01T00:00:00Z');d+=14*86400000)expectedWeeks.push(new Date(d).toISOString().slice(0,10));
  assert.deepEqual(cycleVisits.filter(v=>v.poolId===cyclePools[0].id).map(v=>calendar.localDay(v.plannedDate)),expectedWeeks);
  assert.deepEqual(cycleVisits.filter(v=>v.poolId===cyclePools[1].id).map(v=>calendar.localDay(v.plannedDate)),['2032-02-29','2032-05-31','2032-08-31','2032-11-30']);
  const revisedCycle=structuredClone(cycleInput);revisedCycle.expectedVersion=1;revisedCycle.servicePlan.seasons[0].schedules[0].interval=3;
  const priorVisit=cycleVisits.find(v=>v.poolId===cyclePools[0].id);await prisma.serviceVisit.update({where:{id:priorVisit.id},data:{startAt:priorVisit.plannedDate}});
  const cr=await ok(cyclePath+'/preview',revisedCycle);assert(cr.summary.preserve>0);assert(cr.summary.cancel>0);await ok(cyclePath,{...revisedCycle,reviewToken:cr.reviewToken,requestId:randomUUID()},'PUT');
  assert.deepEqual(await prisma.clientRatePlan.findUnique({where:{id:firstCyclePlan.id}}),firstCyclePlan);assert.equal((await ok(cyclePath,cycleRequest,'PUT')).planVersion,1);
  console.log('PASS anchored two-week and quarterly cadences over twelve real months, leap-day adjustment, concurrent replay, unchanged monthly price and preserved original agreements/execution');
  const dated=structuredClone(revisedCycle);dated.expectedVersion=2;dated.monthRef='2032-02';dated.servicePlan.exceptions=[
    {poolId:cyclePools[0].id,day:'2032-01-05',action:'SKIP',reason:'Pedido posterior ao início da visita',slots:[]},
    {poolId:cyclePools[0].id,day:'2032-02-16',action:'SKIP',reason:'Instalação fechada nesta data',slots:[]},
    {poolId:cyclePools[0].id,day:'2032-02-17',action:'REPLACE',reason:'Dois horários acordados em substituição',slots:[{at:'10:00'},{at:'16:00'}],technicianId:otherTech.id}
  ];
  const badDated=structuredClone(dated);badDated.servicePlan.exceptions[0].poolId=foreign.id;assert.equal((await call(cyclePath+'/preview',badDated)).status,400);
  const datedPreview=await ok(cyclePath+'/preview',dated);assert.equal(datedPreview.pricing.amount,180);assert(datedPreview.actions.some(a=>a.action==='CANCEL'&&a.day==='2032-02-16'&&a.reason.includes('fechada')));assert(datedPreview.actions.some(a=>a.action==='PRESERVE'&&a.visitId===priorVisit.id));assert.equal(datedPreview.actions.filter(a=>a.action==='CREATE'&&a.day==='2032-02-17').length,2);
  const datedRequest={...dated,reviewToken:datedPreview.reviewToken,requestId:randomUUID()},altered=structuredClone(datedRequest);altered.servicePlan.exceptions[1].reason='Outro motivo depois da simulação';assert.equal((await call(cyclePath,altered,'PUT')).status,409);
  const datedReplies=await Promise.all([ok(cyclePath,datedRequest,'PUT'),ok(cyclePath,datedRequest,'PUT')]);assert.deepEqual(datedReplies[0],datedReplies[1]);
  const originals=await prisma.serviceVisit.findMany({where:{clientId:cyc.id,poolId:cyclePools[0].id},orderBy:{plannedDate:'asc'}});assert.equal(originals.find(v=>calendar.localDay(v.plannedDate)==='2032-02-16').status,'CANCELLED');
  const custom=originals.filter(v=>calendar.localDay(v.plannedDate)==='2032-02-17');assert.equal(custom.length,2);assert(custom.every(v=>v.technicianId===otherTech.id&&v.contractService.exception.reason==='Dois horários acordados em substituição'&&v.revenue===0));assert((await prisma.serviceVisit.findUnique({where:{id:priorVisit.id}})).startAt);
  const beforeWeek=await prisma.serviceVisit.count({where:{clientId:cyc.id}});await scheduler.generateWeek(calendar.localDate('2032-02-16'));assert.equal(await prisma.serviceVisit.count({where:{clientId:cyc.id}}),beforeWeek);
  const restored=structuredClone(revisedCycle);restored.expectedVersion=3;restored.monthRef='2032-02';const restorePreview=await ok(cyclePath+'/preview',restored);assert(restorePreview.actions.some(a=>a.action==='CREATE'&&a.day==='2032-02-16'));assert.equal(restorePreview.actions.filter(a=>a.action==='CANCEL'&&a.day==='2032-02-17').length,2);await ok(cyclePath,{...restored,reviewToken:restorePreview.reviewToken,requestId:randomUUID()},'PUT');
  assert.deepEqual(await prisma.clientRatePlan.findUnique({where:{id:firstCyclePlan.id}}),firstCyclePlan);assert.equal((await ok(cyclePath,datedRequest,'PUT')).planVersion,3);
  console.log('PASS dated skip/replace, foreign installation rejected, reviewed reason and attribution, started visit preserved, weekly generation idempotent and removal restores normal schedule without deleting history');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
