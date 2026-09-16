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
  const [chat]=await prisma.$queryRaw`INSERT INTO "ChatMessage" ("text","channel") VALUES ('Migration preserved private message','ADMIN_INTERNAL') RETURNING id`;
  const [oldClient] = await prisma.$queryRaw`INSERT INTO "Client" ("name","updatedAt") VALUES ('Migration preserved chat client',CURRENT_TIMESTAMP) RETURNING id`;
  const historical = await prisma.$queryRaw`INSERT INTO "ClientMessage" ("clientId","text") VALUES (${oldClient.id},'Historical one'),(${oldClient.id},'Historical two') RETURNING id`;
  await prisma.$disconnect();
  for(const migration of ['20260914140000_water_reminder_replay','20260914150000_visit_completion_replay','20260914160000_browser_push','20260914190000_round_assignment_periods','20260914220000_round_recurrence','20260915060000_repair_quotes','20260915080000_client_rate_plans','20260915100000_quote_portal','20260915120000_equipment_maintenance','20260916090000_internal_chat','20260916100000_client_chat_retry','20260916110000_client_chat_legacy','20260916120000_client_portal_requests','20260916130000_client_edit_requests','20260916140000_pool_edit_requests','20260916150000_technical_sheet_edit_requests','20260916160000_technical_proposal_requests'])cli(['db','execute','--file',`prisma/migrations/${migration}/migration.sql`,'--schema','prisma/schema.prisma']);
  const savedVisit=await prisma.serviceVisit.findUnique({where:{id:visit.id}}),savedReminder=await prisma.operationalReminder.findUnique({where:{id:reminder.id}});
  const savedRound=await prisma.round.findUnique({where:{id:round.id}});assert.equal(savedRound.recurrence,'WEEKLY');assert.equal(savedRound.dayOfWeek,2);assert.equal(savedRound.startsOn,null);
  assert.equal(savedVisit.notes,'Migration preserved visit');assert.equal(savedVisit.completionRequestId,null);
  assert.equal(savedReminder.title,'Migration preserved reminder');assert.equal(savedReminder.sourceKey,null);
  assert.equal((await prisma.chatMessage.findUniqueOrThrow({where:{id:chat.id}})).text,'Migration preserved private message');
  const retained = await prisma.clientMessage.findMany({where:{id:{in:historical.map(row=>row.id)}},orderBy:{id:'asc'}});
  assert.deepEqual(retained.map(row=>row.text),['Historical one','Historical two']);assert(retained.every(row=>row.actorKey===null&&row.requestId===null&&row.payloadHash===null&&row.legacyKey===null&&row.isReadByClient===false));
  assert.equal(await prisma.clientChatLegacyRecord.count(),0);assert.equal(await prisma.clientChatImport.count(),0);
  assert.equal(await prisma.internalChatMessage.count(),0);assert.equal(await prisma.internalChatImport.count(),0);
  await prisma.webPushSubscription.create({data:{endpoint:'https://fcm.googleapis.com/fcm/send/migration-qa',role:'TECHNICIAN',principalId:999999,subscription:{},active:false}});
  await prisma.$disconnect();
  cli(['migrate','diff','--from-schema-datasource','prisma/schema.prisma','--to-schema-datamodel','prisma/schema.prisma','--exit-code']);
  await prisma.serviceVisit.delete({where:{id:visit.id}});await prisma.operationalReminder.delete({where:{id:reminder.id}});await prisma.webPushSubscription.deleteMany({where:{endpoint:'https://fcm.googleapis.com/fcm/send/migration-qa'}});
  await prisma.chatMessage.delete({where:{id:chat.id}});
  await prisma.clientMessage.deleteMany({where:{id:{in:historical.map(row=>row.id)}}});await prisma.client.delete({where:{id:oldClient.id}});
  assert.equal(await prisma.clientPortalRequest.count(),0);
  assert.equal(await prisma.clientEditRequest.count(),0);
  assert.equal(await prisma.poolEditRequest.count(),0);
  assert.equal(await prisma.technicalSheetEditRequest.count(),0);
  assert.equal(await prisma.technicalProposalRequest.count(),0);
  console.log('PASS seventeen additive migrations preserve previous data and match the current schema');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect());
