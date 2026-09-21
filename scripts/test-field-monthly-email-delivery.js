'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{randomUUID}=require('node:crypto'),{fork}=require('node:child_process');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
const {generate}=require('../src/business/client/ClientMonthlyReportBusiness');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EMAIL_ENABLED!=='false'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA with email disabled required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const month='2003-02',stamp=randomUUID(),children=[];let rules=[],rule;
async function child(){const process=fork(require.resolve('./fixtures/monthly-email-server'),[],{stdio:['ignore','ignore','inherit','ipc']});children.push(process);const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA child timeout')),15000);process.once('message',m=>{clearTimeout(timer);resolve('http://127.0.0.1:'+m.port);});process.once('error',reject);});return {process,origin,configure:message=>new Promise(resolve=>{process.once('message',resolve);process.send(message);})};}
(async()=>{
 const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),actor={id:admin.id,userId:admin.id,role:'ADMIN',principalType:'USER'};
 const headers={Authorization:'Bearer '+jwt.sign(actor,getJwtSecret(),{expiresIn:'1h'}),'Content-Type':'application/json'};
 const second=await prisma.user.create({data:{email:'mail-admin-'+stamp+'@qa.invalid',name:'QA second admin',password:'QA only',role:'ADMIN',active:true}});
 const secondHeaders={...headers,Authorization:'Bearer '+jwt.sign({id:second.id,role:'ADMIN',principalType:'USER'},getJwtSecret(),{expiresIn:'1h'})};
 const call=async(origin,path,body,auth=headers)=>{const response=await fetch(origin+'/api/admin/'+path,{method:body===undefined?'GET':'POST',headers:auth,body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json(),cache:response.headers.get('cache-control')};};
 rules=await prisma.notificationRule.findMany({where:{eventType:'MONTHLY_REPORT'},select:{id:true,active:true}});await prisma.notificationRule.updateMany({where:{eventType:'MONTHLY_REPORT'},data:{active:false}});
 rule=await prisma.notificationRule.create({data:{eventType:'MONTHLY_REPORT',roles:'CLIENT',channels:'EMAIL',active:true,defaultEmail:true}});
 async function fixture(label){const client=await prisma.client.create({data:{name:'QA '+label+' '+stamp,email:label+'-'+stamp+'@qa.invalid',active:true,status:'ACTIVE'}});const report=await generate(client.id,month);return {client,report};}
 const a=await fixture('first'),b=await fixture('second');
 let server=await child();const other=await child();
 const preview=async(origin=server.origin,auth=headers)=>{const r=await call(origin,'reports/email-preview?monthRef='+month,undefined,auth);assert.equal(r.status,200);assert.match(r.cache,/private.*no-store/);return r.body;};
 async function bodyFor(item,origin=server.origin){const p=await preview(origin),row=p.rows.find(row=>row.reportId===item.report.id);assert(row);return {monthRef:month,reportId:row.reportId,requestId:randomUUID(),confirmed:true,reviewToken:row.reviewToken};}
 const send=(body,origin=server.origin,auth=headers)=>call(origin,'reports/send-now',body,auth);
 const before=await prisma.monthlyReport.findUniqueOrThrow({where:{id:a.report.id}}),counts=async()=>[await prisma.monthlyReportDelivery.count(),await prisma.emailLog.count()];
 const initial=await counts();const live=await preview(base);assert.equal(live.blocked,'EMAIL_DISABLED');
 assert.equal((await call(base,'reports/email-preview?monthRef='+month,undefined,{})).status,401);
 assert.equal((await call(base,'reports/send-now',{monthRef:month})).status,400);assert.deepEqual(await counts(),initial);
 const reportsBefore=await prisma.monthlyReport.count();assert.equal((await call(base,'reports/prepare',{monthRef:'2199-12'})).status,400);assert.equal(await prisma.monthlyReport.count(),reportsBefore);
 const tech=await prisma.technician.create({data:{name:'QA mail technician '+stamp,active:true}});
 for(const principal of [{id:a.client.id,clientId:a.client.id,role:'CLIENT',principalType:'CLIENT'},{id:tech.id,technicianId:tech.id,role:'TECHNICIAN',principalType:'TECHNICIAN'}]){
  const auth={...headers,Authorization:'Bearer '+jwt.sign(principal,getJwtSecret(),{expiresIn:'1h'})};
  for(const [path,body] of [['reports/email-preview?monthRef='+month,undefined],['reports/send-now',{monthRef:month}],['reports/prepare',{monthRef:month}]])assert.equal((await call(base,path,body,auth)).status,403);
 }
 const body=await bodyFor(a);
 for(const payload of [{...body,confirmed:false},{...body,requestId:'bad'},{...body,to:'override@qa.invalid'},{...body,reviewToken:null}])assert.equal((await send(payload)).status,400);
 assert.equal((await send({...body,reportId:b.report.id})).status,409);assert.equal((await send(body,server.origin,secondHeaders)).status,409);
 const decoded=jwt.decode(body.reviewToken);delete decoded.iat;decoded.exp=1;
 assert.equal((await send({...body,reviewToken:jwt.sign(decoded,getJwtSecret())})).status,409);
 await prisma.client.update({where:{id:a.client.id},data:{email:'changed-'+stamp+'@qa.invalid'}});assert.equal((await send(body)).status,409);await prisma.client.update({where:{id:a.client.id},data:{email:a.client.email}});
 await prisma.monthlyReport.update({where:{id:a.report.id},data:{data:{...a.report.data,reviewRequired:true}}});assert.equal((await send(body)).status,409);await prisma.monthlyReport.update({where:{id:a.report.id},data:{data:a.report.data}});
 await prisma.notificationRule.update({where:{id:rule.id},data:{defaultEmail:false}});assert.equal((await send(body)).status,503);await prisma.notificationRule.update({where:{id:rule.id},data:{defaultEmail:true}});
 await server.configure({enabled:false});assert.equal((await send(body)).status,503);await server.configure({enabled:true});assert.deepEqual(await counts(),initial);assert.equal((await server.configure({})).calls.length,0);
 console.log('PASS real routes and roles, strict confirmation, month closed before generation, read-only previews, disabled integrations, actor/expiry/report/recipient/content/rule validation without writes or email');
 await server.configure({delay:120});await other.configure({delay:120});
 const concurrent=await Promise.all([send(body),send({...body,requestId:randomUUID()},other.origin)]);
 assert(concurrent.every(r=>r.status===200),JSON.stringify(concurrent));assert.equal(concurrent.filter(r=>r.body.replayed===false).length,1);assert.equal((await server.configure({})).calls.length+(await other.configure({})).calls.length,1);
 const saved=await prisma.monthlyReportDelivery.findUniqueOrThrow({where:{reportId:a.report.id}});assert.equal(saved.status,'SENT');assert.equal(saved.requestedBy,admin.id);
 assert.deepEqual((await prisma.monthlyReport.findUniqueOrThrow({where:{id:a.report.id}})).data,before.data);
 const collision=await bodyFor(b);collision.requestId=saved.requestId;assert.equal((await send(collision)).status,409);assert.equal(await prisma.monthlyReportDelivery.count({where:{reportId:b.report.id}}),0);
 // A new process must see the committed reservation and must not contact again.
 const restarted=await child();assert.equal((await send({...body,requestId:randomUUID()},restarted.origin)).body.replayed,true);assert.equal((await restarted.configure({})).calls.length,0);
 await server.configure({delay:0,behavior:'rejected'});const rejected=await send(await bodyFor(b));assert.equal(rejected.body.delivery.status,'FAILED');
 const failed=await prisma.monthlyReportDelivery.findUniqueOrThrow({where:{reportId:b.report.id},include:{emailLog:true}});assert.equal(failed.emailLog.text,(await preview()).rows.find(r=>r.reportId===b.report.id).text);
 assert.equal((await call(server.origin,'email/retry-failed/'+failed.emailLogId,{},{...headers,'x-admin-token':'admin'})).status,409);
 const callsBefore=(await server.configure({})).calls.length;assert.equal((await send(await bodyFor(a))).status,400);assert.equal((await server.configure({})).calls.length,callsBefore);
 for(const [behavior,expected] of [['throw','UNKNOWN'],['unknown','UNKNOWN']]){const item=await fixture(behavior);await server.configure({behavior});const payload=await bodyFor(item);assert.equal((await send(payload)).body.delivery.status,expected);const total=(await server.configure({})).calls.length;assert.equal((await send(payload)).body.replayed,true);assert.equal((await server.configure({})).calls.length,total);}
 console.log('PASS concurrent independent processes, request collisions, durable replay after process replacement, exact saved content, provider acceptance/rejection/uncertainty and generic retry blocked');
 for(const fault of ['logCreate','reservation','logUpdate','resultUpdate']){
  const item=await fixture(fault),payload=await bodyFor(item),prior=await counts(),callCount=(await server.configure({fault,behavior:'accepted'})).calls.length;
  const result=await send(payload);
  if(['logCreate','reservation'].includes(fault)){
   assert.equal(result.status,503);assert.deepEqual(await counts(),prior);assert.equal((await server.configure({fault:null})).calls.length,callCount);
   assert.equal((await send(payload)).body.delivery.status,'SENT');
  }else{
   assert.equal(result.status,200);assert.equal(result.body.logUnconfirmed,true);assert.equal(result.body.delivery.status,'PENDING');
   const pending=await prisma.monthlyReportDelivery.findUniqueOrThrow({where:{reportId:item.report.id},include:{emailLog:true}});assert.equal(pending.status,'PENDING');assert.equal(pending.emailLog.status,'PENDING');
   assert.equal((await server.configure({fault:null})).calls.length,callCount+1);assert.equal((await send(payload)).body.replayed,true);assert.equal((await server.configure({})).calls.length,callCount+1);
  }
 }
 const lost=await fixture('lost-http'),lostBody=await bodyFor(lost);await server.configure({delay:400});const controller=new AbortController();
 const lostRequest=fetch(server.origin+'/api/admin/reports/send-now',{method:'POST',headers,body:JSON.stringify(lostBody),signal:controller.signal}).catch(()=>null);
 for(let i=0;i<100;i++){if((await server.configure({})).calls.some(c=>c.to===lost.client.email))break;await new Promise(r=>setTimeout(r,20));}
 assert((await server.configure({})).calls.some(c=>c.to===lost.client.email));controller.abort();await lostRequest;
 const repeated=await send(lostBody);assert.equal(repeated.body.replayed,true);
 for(let i=0;i<100;i++){if((await prisma.monthlyReportDelivery.findUniqueOrThrow({where:{reportId:lost.report.id}})).status==='SENT')break;await new Promise(r=>setTimeout(r,20));}
 assert.equal((await prisma.monthlyReportDelivery.findUniqueOrThrow({where:{reportId:lost.report.id}})).status,'SENT');assert.equal((await server.configure({delay:0})).calls.filter(c=>c.to===lost.client.email).length,1);
 const legacy=await fixture('legacy-block'),legacyBody=await bodyFor(legacy);
 const orphan=await prisma.emailLog.create({data:{eventType:'MONTHLY_REPORT',subject:'Relatório Mensal - '+month,to:legacy.client.email,status:'FAILED',text:'Old message without report ID'}});
 assert.equal((await preview()).blocked,'LEGACY_REVIEW_REQUIRED');assert.equal((await send(legacyBody)).body.code,'LEGACY_REVIEW_REQUIRED');assert.equal((await call(server.origin,'email/retry-failed/'+orphan.id,{},{...headers,'x-admin-token':'admin'})).status,409);
 await prisma.emailLog.update({where:{id:orphan.id},data:{subject:'Imported monthly email without a reliable period'}});assert.equal((await preview()).blocked,'LEGACY_REVIEW_REQUIRED');assert.equal((await send(legacyBody)).body.code,'LEGACY_REVIEW_REQUIRED');
 await prisma.emailLog.delete({where:{id:orphan.id}});
 // The bulk legacy service must also exclude monthly messages.
 const findMany=prisma.emailLog.findMany;prisma.emailLog.findMany=args=>findMany({...args,where:{AND:[args.where,{id:failed.emailLogId}]}});
 try{const bulk=await require('../src/services/emailRetryService').retryFailedEmails();assert.equal(bulk.total,0);}finally{prisma.emailLog.findMany=findMany;}
 assert.deepEqual((await prisma.monthlyReport.findUniqueOrThrow({where:{id:a.report.id}})).data,before.data);
 console.log('PASS claim/log rollback, atomic result rollback, reservation surviving unknown outcome, lost HTTP response recovery, old unlinked history and both legacy retry paths; zero real emails');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const child of children)child.kill('SIGTERM');if(rule)await prisma.notificationRule.delete({where:{id:rule.id}});for(const old of rules)await prisma.notificationRule.update({where:{id:old.id},data:{active:old.active}});await prisma.$disconnect();});
