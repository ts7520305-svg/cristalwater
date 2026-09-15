// Applies the release SQL to the actual previous schema, only in an empty QA database.
require('../src/loadEnv')();
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {prisma}=require('../src/prismaClient');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw new Error('Empty isolated QA database required');
const root=path.resolve(__dirname,'..');
const baseline='a584369b7372a71c1aaa280078e5aeca00f8f1d1';
function run(command,args){const result=spawnSync(command,args,{cwd:root,env:process.env,encoding:'utf8',maxBuffer:10*1024*1024});if(result.status!==0)throw new Error(result.stderr||result.stdout||`Command failed: ${result.status}`);return result.stdout;}
const cli=args=>run(process.execPath,['node_modules/prisma/build/index.js',...args]);
(async()=>{
 const tables=await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
 assert.equal(tables.length,0,'Refusing to alter a non-empty database');
 await prisma.$disconnect();
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cw-migration-qa-'));
 try{
  const schema=path.join(temp,'previous.prisma'),sql=path.join(temp,'previous.sql');
  fs.writeFileSync(schema,run('git',['show',baseline+':prisma/schema.prisma']));
  fs.writeFileSync(sql,cli(['migrate','diff','--from-empty','--to-schema-datamodel',schema,'--script']));
  cli(['db','execute','--file',sql,'--schema','prisma/schema.prisma']);
  const [round]=await prisma.$queryRaw`INSERT INTO "Round" ("name","dayOfWeek","updatedAt") VALUES ('Migration preserved round',2,CURRENT_TIMESTAMP) RETURNING id`;
  const [visit]=await prisma.$queryRaw`INSERT INTO "ServiceVisit" ("notes","updatedAt") VALUES ('Migration preserved visit',CURRENT_TIMESTAMP) RETURNING id`;
  const [reminder]=await prisma.$queryRaw`INSERT INTO "OperationalReminder" ("title","dueDate","updatedAt") VALUES ('Migration preserved reminder',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`;
  await prisma.$disconnect();
  for(const migration of ['20260914140000_water_reminder_replay','20260914150000_visit_completion_replay','20260914160000_browser_push','20260914190000_round_assignment_periods','20260914220000_round_recurrence','20260915060000_repair_quotes'])cli(['db','execute','--file',`prisma/migrations/${migration}/migration.sql`,'--schema','prisma/schema.prisma']);
  const savedVisit=await prisma.serviceVisit.findUnique({where:{id:visit.id}}),savedReminder=await prisma.operationalReminder.findUnique({where:{id:reminder.id}});
  const savedRound=await prisma.round.findUnique({where:{id:round.id}});assert.equal(savedRound.recurrence,'WEEKLY');assert.equal(savedRound.dayOfWeek,2);assert.equal(savedRound.startsOn,null);
  assert.equal(savedVisit.notes,'Migration preserved visit');assert.equal(savedVisit.completionRequestId,null);
  assert.equal(savedReminder.title,'Migration preserved reminder');assert.equal(savedReminder.sourceKey,null);
  await prisma.webPushSubscription.create({data:{endpoint:'https://fcm.googleapis.com/fcm/send/migration-qa',role:'TECHNICIAN',principalId:999999,subscription:{},active:false}});
  await prisma.$disconnect();
  cli(['migrate','diff','--from-schema-datasource','prisma/schema.prisma','--to-schema-datamodel','prisma/schema.prisma','--exit-code']);
  await prisma.serviceVisit.delete({where:{id:visit.id}});await prisma.operationalReminder.delete({where:{id:reminder.id}});await prisma.webPushSubscription.deleteMany({where:{endpoint:'https://fcm.googleapis.com/fcm/send/migration-qa'}});
  console.log('PASS six additive migrations preserve previous data and match the current schema');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect());
