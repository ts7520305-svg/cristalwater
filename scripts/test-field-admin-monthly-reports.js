'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{fork}=require('node:child_process');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let child;
(async()=>{
 const stamp=Date.now(),monthRef='2097-02',start=new Date(monthRef+'-01T00:00:00Z'),end=new Date('2097-03-01T00:00:00Z');
 const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),token=jwt.sign({id:admin.id,role:'ADMIN',principalType:'USER'},getJwtSecret(),{expiresIn:'1h'});
 const path=(section,month=monthRef)=>'/api/admin/reports/summary?'+new URLSearchParams({monthRef:month,section});
 async function call(url,credential=token,origin=base){const response=await fetch(origin+url,{headers:credential?{Authorization:'Bearer '+credential}:{}});return{status:response.status,cache:response.headers.get('cache-control'),body:await response.json()};}
 const client=await prisma.client.create({data:{name:'QA_PRIVATE_CLIENT '+stamp,active:false,creditBalance:99}});
 const invoice=await prisma.invoice.create({data:{clientId:client.id,monthRef,month:'2097-03',year:2097,status:'PARTIAL',amount:93.4,total:93.4,totalAmount:93.4,amountPaid:15.9,amountOpen:77.5,issueDate:new Date('2097-04-01T00:00:00Z')}});
 await prisma.invoice.createMany({data:[
  {clientId:client.id,monthRef:null,month:monthRef,year:1970,status:'ISSUED',total:4,amountOpen:4},
  {clientId:client.id,monthRef:null,month:'2',year:2097,status:'PENDING',total:5,amountOpen:5},
  {clientId:client.id,monthRef:null,month:'02',year:2097,status:'PAID',total:6,amountPaid:6,amountOpen:0},
  ...['DRAFT','CANCELLED','SUPERSEDED'].map(status=>({clientId:client.id,monthRef:null,month:monthRef,status,total:999,amountOpen:999})),
  {clientId:client.id,monthRef:'2097-03',month:monthRef,status:'ISSUED',total:888,amountOpen:888},
  ...Array.from({length:10001},()=>({clientId:client.id,monthRef:null,month:'02',year:2097,status:'PENDING',total:0.01,amountOpen:0.01}))
 ]});
 await prisma.invoice.create({data:{clientId:client.id,monthRef:null,month:monthRef,status:'PAID',amountPaid:100,lines:{create:{type:'CREDIT_DEPOSIT',description:'QA_PRIVATE_LEDGER',total:0,lineTotal:0}}}});
 const deposit=await prisma.invoice.create({data:{clientId:client.id,monthRef:monthRef+'-CREDIT-'+stamp,month:monthRef,status:'PAID',amountPaid:25,lines:{create:{type:'CREDIT_DEPOSIT',description:'QA_PRIVATE_CREDIT',total:0,lineTotal:0}}}});
 await prisma.payment.createMany({data:[
  {invoiceId:invoice.id,amount:12.34,method:'CASH',paidAt:start},
  {invoiceId:invoice.id,amount:3.56,method:'BANK_TRANSFER',paidAt:new Date(end-1)},
  {invoiceId:invoice.id,amount:0,method:'MANUAL',paidAt:start},
  {invoiceId:deposit.id,amount:25,method:'CASH',paidAt:start},
  {invoiceId:invoice.id,amount:9,method:'CASH',paidAt:new Date(start-1)},
  {invoiceId:invoice.id,amount:7,method:'CASH',paidAt:end},
  ...[' credit ','CREDIT_NOTE','ADJUSTMENT','credit_adjustment'].map(method=>({invoiceId:invoice.id,amount:999,method,paidAt:start})),
  ...Array.from({length:10001},()=>({invoiceId:invoice.id,amount:0.01,method:'CASH',paidAt:start}))
 ]});
 await prisma.monthlyReport.createMany({data:[{month:monthRef,type:'ADMIN',data:{private:'QA_PRIVATE_SNAPSHOT'}},{month:monthRef,type:'CLIENT',clientId:client.id,data:{}},{month:monthRef,type:'CLIENT',data:{}},{month:monthRef,type:'EXTRA_VISITS',clientId:client.id,data:{items:[{visitId:1},{visitId:2}]}},{month:monthRef,type:'OTHER',data:{}},{month:'2097-03',type:'ADMIN',data:{}}]});
 await prisma.communicationLog.createMany({data:[
  {channel:'EMAIL',message:'QA_PRIVATE_MESSAGE',clientId:client.id,createdAt:start},
  {channel:'PORTAL',message:'QA_PRIVATE_MESSAGE',clientId:client.id,createdAt:new Date(end-1)},
  {channel:'EXCLUDED_BEFORE',message:'QA_PRIVATE_MESSAGE',createdAt:new Date(start-1)},
  {channel:'EXCLUDED_AFTER',message:'QA_PRIVATE_MESSAGE',createdAt:end},
  ...Array.from({length:10001},()=>({channel:'PORTAL',message:'QA_PRIVATE_MESSAGE',createdAt:new Date(end-1)}))
 ]});
 const snapshot=async()=>({invoice:await prisma.invoice.findUnique({where:{id:invoice.id}}),client:await prisma.client.findUnique({where:{id:client.id}}),counts:await Promise.all(['invoice','payment','monthlyReport','communicationLog','task','notification','userAuditLog'].map(model=>prisma[model].count()))});
 const before=await snapshot();
 const responses={};
 for(const section of ['financial','reports','communications']){
  const result=await call(path(section));assert.equal(result.status,200,section);assert.match(result.cache,/private.*no-store/);const body=result.body;responses[section]=body;
  assert.equal(body.section,section);assert.equal(body.monthRef,monthRef);assert.equal(body.reportVersion,1);assert.equal(body.complete,true);assert.equal(body.limitApplied,null);assert.deepEqual(body.period,{start:start.toISOString(),end:end.toISOString(),timeZone:'UTC'});assert(Number.isFinite(Date.parse(body.generatedAt)));
  assert.doesNotMatch(JSON.stringify(body),/QA_PRIVATE|password|clientId|message|toEmail/);
 }
 const f=responses.financial.data;
 assert.deepEqual(f.cash,{amountCents:14091,paymentCount:10005,invalidAmountCount:0});
 assert.deepEqual(f.documents,{total:10009,receivableCount:10005,excludedCount:4,unknownStatusCount:0,invalidAmountCount:0,amountCents:20841,openAmountCents:18651});
 assert.equal(f.basis.historicalClosingBalance,false);assert.equal(f.basis.internalCreditIncluded,false);
 assert.deepEqual(responses.reports.data,{basis:'MONTHLY_REPORT_MONTH',total:5,adminCount:1,clientCount:2,extraVisitsCount:1,otherCount:1});
 const communications=responses.communications.data;assert.equal(communications.total,10003);assert.equal(communications.latestLimit,5);assert.equal(communications.latest.length,5);assert.equal(communications.deliveryConfirmed,false);
 for(let i=1;i<5;i++)assert(communications.latest[i-1].id>communications.latest[i].id);
 assert.equal((await call(path('financial','2097-03'))).body.data.cash.amountCents,700);
 assert.equal((await call(path('financial','2097-03'))).body.data.documents.amountCents,88800);
 for(const section of ['financial','reports','communications']){
  const empty=(await call(path(section,'2199-12'))).body;assert.equal(empty.period.end,'2200-01-01T00:00:00.000Z');
  if(section==='financial'){assert.equal(empty.data.cash.amountCents,0);assert.equal(empty.data.documents.openAmountCents,0);}else assert.equal(empty.data.total,0);
 }
 assert.deepEqual(await snapshot(),before);
 console.log('PASS monthly sources: real cash at exact UTC boundaries, prepaid cash versus internal credit, document-reference precedence/legacy months, current open balance, drafts/cancellations, 10000+ payments/documents/logs, stable latest five, saved report types, empty month and read-only private projections');
 for(const query of ['', 'monthRef=2097-02','section=financial','monthRef=2097-02&section=missing','monthRef=1999-12&section=financial','monthRef=2200-01&section=financial','monthRef=2097-13&section=financial','monthRef=2097-02&monthRef=2097-03&section=financial','monthRef=2097-02&section=financial&section=reports','monthRef=2097-02&section=financial&limit=5','monthRef[x]=2097-02&section=financial'])assert.equal((await call('/api/admin/reports/summary?'+query)).status,400,query);
 assert.equal((await call(path('financial'),null)).status,401);
 const tech=await prisma.technician.create({data:{name:'QA report technician '+stamp,active:true}}),leader=await prisma.technician.create({data:{name:'QA report leader '+stamp,role:'TEAM_LEADER',active:true}});
 await prisma.client.update({where:{id:client.id},data:{active:true,status:'ACTIVE'}});
 for(const principal of [{id:tech.id,technicianId:tech.id,role:'TECHNICIAN',principalType:'TECHNICIAN'},{id:leader.id,technicianId:leader.id,role:'TEAM_LEADER',principalType:'TECHNICIAN'},{id:client.id,clientId:client.id,role:'CLIENT',principalType:'CLIENT'}]){
  const credential=jwt.sign(principal,getJwtSecret(),{expiresIn:'1h'});for(const section of ['financial','reports','communications'])assert.equal((await call(path(section),credential)).status,403,principal.role);
 }
 await prisma.invoice.update({where:{id:invoice.id},data:{totalAmount:94}});
 let uncertain=(await call(path('financial'))).body.data;assert.equal(uncertain.documents.amountCents,null);assert.equal(uncertain.documents.openAmountCents,null);assert.equal(uncertain.documents.invalidAmountCount,1);assert.equal(uncertain.cash.amountCents,14091);
 await prisma.invoice.update({where:{id:invoice.id},data:{totalAmount:93.4,status:'UNKNOWN_LEGACY'}});
 uncertain=(await call(path('financial'))).body.data;assert.equal(uncertain.documents.unknownStatusCount,1);assert.equal(uncertain.documents.amountCents,null);
 await prisma.invoice.update({where:{id:invoice.id},data:{status:'PARTIAL'}});
 const bad=await prisma.payment.create({data:{invoiceId:invoice.id,amount:-1,method:'CASH',paidAt:start}});
 uncertain=(await call(path('financial'))).body.data;assert.equal(uncertain.cash.amountCents,null);assert.equal(uncertain.cash.invalidAmountCount,1);assert.equal(uncertain.documents.amountCents,20841);
 await prisma.payment.delete({where:{id:bad.id}});
 await prisma.payment.createMany({data:[1,2].map(()=>({invoiceId:invoice.id,amount:90000000000000,method:'CASH',paidAt:start}))});
 uncertain=(await call(path('financial'))).body.data;assert.equal(uncertain.cash.amountCents,null);assert.equal(uncertain.cash.invalidAmountCount,0);
 await prisma.payment.deleteMany({where:{invoiceId:invoice.id,amount:90000000000000}});
 const safeAgain=(await call(path('financial'))).body.data;assert.deepEqual(safeAgain,f);
 child=fork(require.resolve('./fixtures/admin-report-server'),[],{stdio:['ignore','ignore','ignore','ipc']});
 const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA report child timeout')),15000);child.once('error',reject);child.once('message',({port})=>{clearTimeout(timer);resolve('http://127.0.0.1:'+port);});});
 async function fault(model){await new Promise(resolve=>{child.once('message',resolve);child.send({fault:model});});}
 const stable=await snapshot();
 for(const [model,section] of [['payment','financial'],['invoice','financial'],['monthlyReport','reports'],['communicationLog','communications']]){
  await fault(model);const failed=await call(path(section),token,origin);assert.equal(failed.status,503);assert.equal(failed.body.ok,false);assert.doesNotMatch(JSON.stringify(failed.body),/QA_PRIVATE|amountCents|total|count/);assert.match(failed.cache,/no-store/);
  const available=await call(path(section==='reports'?'communications':'reports'),token,origin);assert.equal(available.status,200);
  await fault(null);assert.equal((await call(path(section),token,origin)).status,200);
 }
 assert.deepEqual(await snapshot(),stable);
 console.log('PASS invalid queries and non-ADMIN access, conflicting/unknown/negative/overflow values stay unavailable, real HTTP database-read faults return 503 without fabricated values, independent source recovery and no writes');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{child?.kill('SIGTERM');await prisma.$disconnect();});
