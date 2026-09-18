'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { fork } = require('node:child_process');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
const { generateClientMonthlyReport: generate } = require('../src/services/reportService');
const pdfText = require('./lib/reportPdfText');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));

if (process.argv[2] === 'worker') {
  process.once('message', async ({clientId, month}) => {
    try { const report = await generate(clientId, month); process.send({report}); }
    catch (error) { process.send({error:error.message,code:error.code}); process.exitCode=1; }
    finally { await prisma.$disconnect(); process.disconnect(); }
  });
} else (async () => {
  // Earlier typed-identity fixtures reserve explicit visit IDs without advancing the sequence.
  // Keep automatic QA allocation above those rows; retain all 1001 volume assertions below.
  await prisma.$queryRaw`SELECT setval(pg_get_serial_sequence('"ServiceVisit"','id'), GREATEST(COALESCE((SELECT MAX(id) FROM "ServiceVisit"),0), nextval(pg_get_serial_sequence('"ServiceVisit"','id'))), true)`;
  const now = new Date(), previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-1, 5, 12));
  const defaultMonth = previous.toISOString().slice(0,7);
  const client = await prisma.client.create({data:{name:'QA monthly ownership Álvaro Łukasz Ελληνικά',paymentStatus:'PAID'}});
  const other = await prisma.client.create({data:{name:'QA other monthly owner'}});
  const pool = await prisma.pool.create({data:{clientId:client.id,name:'QA monthly pool'}});
  for (const [clientId,date] of [[client.id,previous],[client.id,new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-2,5,12))],[client.id,new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),5,12))],[other.id,previous]]) {
    await prisma.serviceVisit.create({data:{clientId,poolId:pool.id,status:'DONE',plannedDate:date,startAt:date,endAt:new Date(+date+3600000)}});
  }
  const original = await generate(client.id);
  console.log(JSON.stringify({month:original.month,expectedMonth:defaultMonth,total:original.data.pools[0].totalVisits,expected:1}));
  assert.equal(original.month,defaultMonth); assert.equal(original.data.pools[0].totalVisits,1,'Other months and another historical customer must not be counted');

  const month='2096-02', start=new Date(month+'-01T00:00:00Z'), end=new Date('2096-03-01T00:00:00Z');
  const at=delta=>new Date(+start+delta), before=new Date(+start-1), last=new Date(+end-1);
  const pastPool=await prisma.pool.create({data:{clientId:other.id,name:'PRIVATE_CURRENT_POOL_NAME'}});
  const empty=await prisma.pool.create({data:{clientId:client.id,name:'QA zero visits'}});
  const visit=(overrides={})=>prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,status:'DONE',plannedDate:at(1000),endAt:at(1000),...overrides}});
  await visit({endAt:start,plannedDate:before});
  await visit({endAt:last,status:'completed',plannedDate:end});
  await visit({endAt:at(2000),status:' CONCLUIDA '});
  await visit({endAt:at(3000),status:'CONCLUIDO'});
  await visit({endAt:before}); await visit({endAt:end});
  await visit({clientId:other.id}); await visit({clientId:null});
  await visit({status:'NOT_DONE',endAt:at(4000)});
  await visit({status:'NOT_DONE',endAt:end});
  await visit({status:'NOT_DONE',endAt:null});
  await visit({status:'DONE',endAt:null});
  await visit({status:'DONE',endAt:null,plannedDate:null,date:at(5000)});
  await visit({status:'DONE',endAt:null,plannedDate:end,date:at(5000)});
  for (const status of ['PLANNED','INCOMPLETE','IN_PROGRESS','CANCELLED','ARCHIVED','UNKNOWN']) await visit({status});
  await visit({poolId:pastPool.id}); await visit({poolId:null});
  await prisma.extraVisit.create({data:{clientId:client.id,poolId:pool.id,status:'DONE',endAt:start,scheduledAt:start}});
  // More than the common 1000-row limit must still contribute to the full monthly total.
  await prisma.serviceVisit.createMany({data:Array.from({length:1001},()=>({clientId:client.id,poolId:pool.id,status:'DONE',plannedDate:start,endAt:at(6000)}))});
  const snapshot=async()=>({client:await prisma.client.findUnique({where:{id:client.id}}),visits:await prisma.serviceVisit.findMany({where:{clientId:client.id},orderBy:{id:'asc'}}),money:await Promise.all(['invoice','payment','communicationLog','userAuditLog'].map(m=>prisma[m].count()))});
  const beforeGeneration=await snapshot();
  const report=await generate(client.id,month), data=report.data;
  assert.equal(report.month,month);assert.equal(data.reportVersion,2);assert.equal(data.scope,'REGULAR');
  assert.deepEqual(data.period,{start:start.toISOString(),end:end.toISOString(),timeZone:'UTC'});
  assert.equal(data.basis.completed,'END_AT');assert.equal(data.basis.client,'VISIT_CLIENT_ID');
  const row=data.pools.find(p=>p.poolId===pool.id);
  assert.equal(row.totalVisits,1005);assert.equal(row.notDone,1);assert.equal(row.unconfirmed,3);
  assert.equal(data.pools.find(p=>p.poolId===empty.id).totalVisits,0);
  assert.equal(data.pools.find(p=>p.poolId===pastPool.id).totalVisits,1);assert(!JSON.stringify(data).includes('PRIVATE_CURRENT_POOL_NAME'));
  assert.equal(data.pools.find(p=>p.poolId===null).totalVisits,1);
  assert.equal(data.totals.totalVisits,1007);assert.equal(data.totals.notDone,1);assert.equal(data.totals.unconfirmed,3);
  assert.equal(data.reviewRequired,true);assert.equal(data.paymentStatus,'PAID');assert.equal(data.basis.paymentStatus,'CURRENT_AT_GENERATION');
  assert.deepEqual(await snapshot(),beforeGeneration,'Generation must not alter visits, payment state or finances');
  assert.deepEqual(await generate(client.id,month),report);
  await prisma.pool.update({where:{id:pool.id},data:{name:'RENAMED_AFTER_SNAPSHOT',clientId:other.id}});
  await prisma.client.update({where:{id:client.id},data:{name:'RENAMED_CLIENT',paymentStatus:'OVERDUE'}});
  assert.deepEqual(await generate(client.id,month),report,'Existing monthly snapshots must not be silently rebuilt');
  const legacy=await prisma.monthlyReport.create({data:{clientId:client.id,month:'2096-01',type:'CLIENT',data:{client:'Legacy saved name',pools:[{name:'Legacy pool',totalVisits:99,notDone:2}],paymentStatus:'LEGACY'}}});
  assert.deepEqual(await generate(client.id,'2096-01'),legacy);
  assert.equal(await generate(2147483647,month),null);
  for (const bad of [0,-1,1.5,'1',true,null,2147483648]) await assert.rejects(()=>generate(bad,month));
  for (const bad of ['2096-2','2096-13','1999-12','2200-01',null,{},['2096-02']]) await assert.rejects(()=>generate(client.id,bad));
  const calendar=require('../src/services/clientMonthlyReportDataService');
  assert.equal(calendar.lastMonth(new Date('2027-01-01T00:00:00Z')),'2026-12');
  assert.equal(calendar.lastMonth(new Date('2028-03-01T00:00:00Z')),'2028-02');
  const savedZone=process.env.TZ;
  for (const zone of ['Pacific/Auckland','America/Los_Angeles','Europe/Lisbon']) {process.env.TZ=zone;assert.equal(calendar.lastMonth(new Date('2027-01-01T00:00:00Z')),'2026-12');}
  if(savedZone===undefined)delete process.env.TZ;else process.env.TZ=savedZone;

  // Independent processes must return the same durable report for a racing generation.
  const raceClient=await prisma.client.create({data:{name:'QA concurrent monthly'}});
  async function worker(){return new Promise((resolve,reject)=>{const child=fork(__filename,['worker'],{stdio:['ignore','pipe','pipe','ipc']});let result;const timer=setTimeout(()=>{child.kill();reject(Error('Monthly worker timeout'));},20000);child.once('error',reject);child.once('message',r=>result=r);child.once('exit',code=>{clearTimeout(timer);if(code||result?.error)reject(Error(JSON.stringify(result)));else resolve(result.report);});child.send({clientId:raceClient.id,month});});}
  const concurrent=await Promise.all([worker(),worker(),worker()]);
  assert(concurrent.every(r=>r.id===concurrent[0].id));assert.deepEqual(concurrent[1],concurrent[0]);
  assert.equal(await prisma.monthlyReport.count({where:{clientId:raceClient.id,month,type:'CLIENT'}}),1);
  assert.equal(concurrent[0].data.totals.totalVisits,0);assert.equal(concurrent[0].data.reviewRequired,false);
  // A failure after insert still rolls back the complete new snapshot.
  const transaction=prisma.$transaction.bind(prisma);
  prisma.$transaction=(work,options)=>transaction(async tx=>{const create=tx.monthlyReport.create.bind(tx.monthlyReport);tx.monthlyReport.create=async args=>{await create(args);throw Error('QA forced snapshot rollback');};return work(tx);},options);
  try {await assert.rejects(()=>generate(raceClient.id,'2096-03'),/QA forced snapshot rollback/);}finally{prisma.$transaction=transaction;}
  assert.equal(await prisma.monthlyReport.count({where:{clientId:raceClient.id,month:'2096-03',type:'CLIENT'}}),0);
  assert.equal((await generate(raceClient.id,'2096-03')).data.totals.totalVisits,0);

  const token=jwt.sign({id:client.id,clientId:client.id,role:'CLIENT',principalType:'CLIENT'},getJwtSecret(),{expiresIn:'1h'});
  const dir=path.join(__dirname,'../reports/field-visual/client-monthly-generation-'+Date.now());fs.mkdirSync(dir,{recursive:true});
  for(const [name,saved] of [['current',report],['legacy',legacy]]){
    const response=await fetch(base+'/api/client-reports/'+client.id+'/reports/'+saved.id+'/pdf',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),text=pdfText(bytes);assert(text.includes(saved.data.client));assert.match(bytes.toString('latin1'),/\/FontFile2/);
    if(name==='current'){assert(text.includes('1005'));assert(text.includes('Por confirmar: 3'));assert(text.includes('UTC'));assert(text.includes('Visitas regulares'));assert(!text.includes('PRIVATE_CURRENT_POOL_NAME'));assert(!text.includes('RENAMED_'));}
    else {assert(text.includes('99'));assert(!text.includes('Por confirmar'));}
    fs.writeFileSync(path.join(dir,name+'.pdf'),bytes);
  }
  // Change the sources between the customer and visit reads from an independent connection.
  const consistent=await prisma.client.create({data:{name:'QA original snapshot name'}});
  await prisma.serviceVisit.create({data:{clientId:consistent.id,status:'DONE',endAt:start}});
  const writer=new (require('@prisma/client').PrismaClient)(), originalTransaction=prisma.$transaction.bind(prisma);
  await writer.$connect();
  prisma.$transaction=(work,options)=>originalTransaction(async tx=>{
    const find=tx.client.findUnique.bind(tx.client);
    tx.client.findUnique=async args=>{
      const result=await find(args);
      if(args.where.id===consistent.id){await writer.client.update({where:{id:consistent.id},data:{name:'QA newer snapshot name'}});await writer.serviceVisit.create({data:{clientId:consistent.id,status:'DONE',endAt:start}});}
      return result;
    };
    return work(tx);
  },options);
  let consistentReport;
  try {consistentReport=await generate(consistent.id,month);}finally{prisma.$transaction=originalTransaction;await writer.$disconnect();}
  assert.equal(consistentReport.data.client,'QA original snapshot name');assert.equal(consistentReport.data.totals.totalVisits,1);
  assert.equal(consistentReport.data.reviewRequired,true,'An unidentified pool must remain visible for review');
  assert.equal(await prisma.serviceVisit.count({where:{clientId:consistent.id}}),2);

  console.log('PASS monthly CLIENT generation: exact UTC month/end boundaries and leap year, historical client, state-specific counts, 1000+ rows, transfer/no pool, review of missing end dates, read-only sources, immutable legacy snapshots, consistent read during independent mutation, concurrent processes, rollback and authorized PDF');
  console.log('Visual evidence '+dir);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
