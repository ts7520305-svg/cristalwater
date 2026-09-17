'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
(async()=>{
 const stamp=Date.now(),monthRef='2033-05',end=new Date('2033-05-01T00:00:00Z'),admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}});
 const token=jwt.sign({id:admin.id,userId:admin.id,role:'ADMIN',principalType:'USER'},getJwtSecret(),{expiresIn:'1h'});
 const call=async(path,credential=token)=>{const response=await fetch(base+path,{headers:{Authorization:'Bearer '+credential}});return{status:response.status,cache:response.headers.get('cache-control'),data:await response.json()};};
 const client=await prisma.client.create({data:{name:'QA values '+stamp,active:false}}),other=await prisma.client.create({data:{name:'QA values other '+stamp,active:true}});
 const pool=await prisma.pool.create({data:{clientId:client.id,name:'QA values pool'}}),otherPool=await prisma.pool.create({data:{clientId:other.id,name:'QA values other pool'}});
 const a=await prisma.technician.create({data:{name:'<b>Same technician</b> '+stamp,active:true,costPerVisit:32}}),b=await prisma.technician.create({data:{name:a.name,active:false,hourlyCost:60}}),c=await prisma.technician.create({data:{name:'QA ambiguous '+stamp,costPerVisit:10,hourlyCost:20}});
 await prisma.technician.createMany({data:Array.from({length:205},(_,i)=>({name:'QA values population '+stamp+' '+i,active:i%2===0}))});
 await prisma.user.create({data:{name:a.name,email:'qa-values-'+stamp+'@qa.test',password:'not-used-by-qa',role:'tecnico',costPerVisit:999}});
 const maxima=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),sharedId=Math.max(...maxima.map(v=>v._max.id||0))+1;
 const regular=await prisma.serviceVisit.create({data:{id:sharedId,clientId:client.id,poolId:pool.id,technicianId:a.id,technicianName:a.name,status:'DONE',plannedDate:new Date('2033-04-30T12:00:00Z'),startAt:new Date(end-3600000),endAt:end}});
 const extra=await prisma.extraVisit.create({data:{id:sharedId,clientId:client.id,poolId:pool.id,technicianId:a.id,status:'DONE',scheduledAt:new Date('2033-04-30T12:00:00Z'),startAt:new Date('2033-05-02T10:00:00Z'),endAt:new Date('2033-05-02T10:30:00Z'),isBillable:true,billingMode:'EXTRA',totalPrice:120,price:999}});
 for(const model of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${model}"','id'), ${sharedId}, true)`);
 const extraB=await prisma.extraVisit.create({data:{clientId:other.id,poolId:otherPool.id,technicianId:b.id,status:'DONE',endAt:new Date('2033-05-03T10:00:00Z'),scheduledAt:end}});
 await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:c.id,status:'DONE',startAt:new Date('2033-05-04T11:00:00Z'),endAt:new Date('2033-05-04T10:00:00Z')}});
 // Current pool ownership must never invent the client of a historical visit.
 await prisma.serviceVisit.create({data:{clientId:null,poolId:otherPool.id,technicianId:c.id,status:'DONE',endAt:end}});
 await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:null,technicianName:a.name,status:'DONE',endAt:new Date('2033-05-05T10:00:00Z')}});
 await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:a.id,status:'DONE',plannedDate:end}});
 await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:a.id,status:'CANCELLED',endAt:end}});
 await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:a.id,status:'DONE',plannedDate:end,endAt:new Date('2033-06-01T00:00:00Z')}});
 const invoice=await prisma.invoice.create({data:{clientId:client.id,monthRef,status:'ISSUED',invoiceIssued:true,total:320,totalAmount:320,amount:320,lines:{create:[{type:'EXTRA_VISIT',referenceId:extra.id,description:'Extra source',total:120,lineTotal:120},{type:'MONTHLY',description:'Monthly fee',total:200,lineTotal:200}]}}});
 const adjusted=await prisma.invoice.create({data:{clientId:other.id,monthRef,status:'ISSUED',invoiceIssued:true,total:40,totalAmount:40,amount:40,lines:{create:[{type:'EXTRA_VISIT',referenceId:extraB.id,description:'Extra source',total:50,lineTotal:50},{type:'CREDIT_NOTE',description:'Unallocated credit',total:-10,lineTotal:-10}]}}});
 await prisma.invoice.create({data:{clientId:client.id,monthRef:'2033-04',status:'CANCELLED',total:999,lines:{create:{type:'EXTRA_VISIT',referenceId:extra.id,description:'Cancelled duplicate',total:999,lineTotal:999}}}});
 const draftClient=await prisma.client.create({data:{name:'QA draft values '+stamp}});
 await prisma.invoice.create({data:{clientId:draftClient.id,monthRef,status:'DRAFT',total:999,lines:{create:{type:'EXTRA_VISIT',referenceId:extra.id,description:'Draft duplicate',total:999,lineTotal:999}}}});
 await prisma.payment.createMany({data:[{invoiceId:invoice.id,amount:100,method:'BANK_TRANSFER',paidAt:new Date('2033-05-07T00:00:00Z')},{invoiceId:invoice.id,amount:20,method:'CREDIT',paidAt:end},{invoiceId:adjusted.id,amount:30,method:'CASH',paidAt:end},{invoiceId:invoice.id,amount:999,method:'CASH',paidAt:new Date('2033-06-01T00:00:00Z')}]});
 await prisma.stockMovement.createMany({data:[
  {movementType:'CONSUMPTION',productName:'QA Product',unit:'KG',quantity:10,technicianId:a.id,clientId:client.id,visitId:regular.id,createdAt:end},
  {movementType:'RETURN',productName:'QA Product',unit:'KG',quantity:3,visitId:regular.id,createdAt:end},
  {movementType:'RETURN',productName:'QA Product',unit:'L',quantity:5,technicianId:a.id,clientId:client.id,createdAt:end},
  {movementType:'CONSUMPTION',productName:'QA ambiguous',unit:'KG',quantity:5,technicianId:a.id,visitId:regular.id,extraVisitId:extra.id,createdAt:end},
  {movementType:'CONSUMPTION',productName:'QA wrong owner',unit:'KG',quantity:5,technicianId:a.id,extraVisitId:extraB.id,createdAt:end},
  {movementType:'PURCHASE',productName:'QA Product',unit:'KG',quantity:100,technicianId:a.id,clientId:client.id,createdAt:end},
  {movementType:'CONSUMPTION',productName:'QA Product',unit:'KG',quantity:999,technicianId:a.id,clientId:client.id,createdAt:new Date('2033-06-01T00:00:00Z')}
 ]});
 const vehicle=await prisma.vehicle.create({data:{plate:'QA-VALUES-'+stamp}});
 await prisma.vehicleStockMovement.create({data:{vehicleId:vehicle.id,visitId:regular.id,technicianId:a.id,itemName:'QA Product',unit:'KG',quantity:10,movementType:'CONSUMPTION',createdAt:end}});
 const snapshot=async()=>({visits:await prisma.serviceVisit.findMany({where:{clientId:client.id},orderBy:{id:'asc'}}),invoices:await prisma.invoice.findMany({where:{clientId:{in:[client.id,other.id]}},include:{lines:true,payments:true},orderBy:{id:'asc'}}),stocks:await prisma.stockMovement.count(),legacy:await prisma.clientProfitSnapshot.count()});
 const before=await snapshot();
 const paths=['/api/billing/technician-profit?month=5&year=2033','/api/finance-os/reports/technician-profitability?monthRef='+monthRef];let data;
 for(const path of paths){const result=await call(path);assert.equal(result.status,200);assert.match(result.cache,/no-store/);data=result.data;assert.equal(data.reportVersion,1);assert.equal(data.monthRef,monthRef);assert.equal(data.complete,true);assert.equal(data.financialComplete,false);assert.equal(data.limitApplied,null);assert(data.total>205);assert.equal(data.total,data.technicians.length);
  const ra=data.technicians.find(t=>t.id===a.id),rb=data.technicians.find(t=>t.id===b.id),rc=data.technicians.find(t=>t.id===c.id),unassigned=data.technicians.find(t=>t.id===null);
  assert.equal(ra.regularDone,1);assert.equal(ra.extraDone,1);assert.equal(ra.visitsDone,2);assert.equal(ra.undatedCompleted,1);assert.equal(ra.minutes,90);assert.equal(ra.laborEstimate,64);assert.equal(ra.laborEstimateBasis,'CURRENT_RATE_PER_VISIT');assert.equal(ra.extraLinesAmount,120);assert.deepEqual(ra.extraLineEvidence.map(e=>e.extraVisitId),[extra.id]);
  assert.equal(rb.active,false);assert.equal(rb.extraDone,1);assert.equal(rb.unknownDurations,1);assert.equal(rb.laborEstimate,null);assert.equal(rb.extraLinesAmount,null);assert.equal(rb.extraLinesReviewCount,1);assert.equal(rc.laborEstimate,null);assert.equal(rc.laborEstimateBasis,'AMBIGUOUS_RATE');assert.equal(unassigned.regularDone,1);assert.equal(unassigned.stockReviewCount,2);
  assert.deepEqual(ra.stock.map(s=>[s.unit,s.consumed,s.returned,s.net]),[['KG',10,3,7],['L',0,5,-5]]);
  for(const row of [ra,rb,rc,unassigned])for(const key of ['revenue','estimatedRevenue','stockCost','laborCost','cost','profit','profitability'])assert.equal(row[key],null,key);
  assert(data.dataQuality.excludedDocuments>=1);assert(data.dataQuality.excludedStockMovements>=1);
 }
 const limited=await call('/api/billing/technician-profit?monthRef='+monthRef+'&limit=1');assert.equal(limited.data.total,data.total);assert.equal(limited.data.complete,true);
 const customer=await call('/api/finance-os/reports/customer-profitability?monthRef='+monthRef);assert.equal(customer.status,200);assert.equal(customer.data.clients.find(c=>c.id===client.id).cashReceived,100);assert.equal(customer.data.clients.find(c=>c.id===other.id).cashReceived,30);assert.equal(customer.data.clients.find(c=>c.id===client.id).active,false);assert.equal(customer.data.clients.find(c=>c.id===client.id).profitability,null);
 assert.equal(customer.data.clients.find(c=>c.id===null).regularDone,1);assert.equal(customer.data.clients.find(c=>c.id===other.id).regularDone,0);
 for(const query of ['monthRef=2033-13','monthRef=2033-05&monthRef=2033-06','month=0&year=2033','year=2033','month=5&year=2033&monthRef=2033-05','monthRef=2033-05&limit=1.5'])assert.equal((await call('/api/billing/technician-profit?'+query)).status,400,query);
 for(const query of ['monthRef=invalid','monthRef=2033-05&monthRef=2033-06'])assert.equal((await call('/api/finance-os/reports/customer-profitability?'+query)).status,400);
 for(const role of ['TECHNICIAN','CLIENT']){const t=jwt.sign(role==='CLIENT'?{id:other.id,clientId:other.id,role,principalType:'CLIENT'}:{id:a.id,technicianId:a.id,role,principalType:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});for(const path of [...paths,'/api/finance-os/reports/customer-profitability?monthRef='+monthRef])assert.equal((await call(path,t)).status,403,role+path);}
 const diagnostic=await fetch(base+'/api/operational-state/profitability/'+client.id,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({monthRef})});
 assert.equal(diagnostic.status,200);const diagnosticData=await diagnostic.json();assert.equal(diagnosticData.snapshot.grossProfit,null);assert.equal(diagnosticData.snapshot.grossMarginPercent,null);assert.equal(diagnosticData.snapshot.status,'INSUFFICIENT_DATA');assert.equal(diagnosticData.snapshot.persisted,false);assert.equal(diagnosticData.snapshot.cashReceived,100);
 const invalidDiagnostic=await fetch(base+'/api/operational-state/profitability/'+client.id,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({monthRef:'2033-13'})});assert.equal(invalidDiagnostic.status,400);
 assert.deepEqual(await snapshot(),before);
 console.log('PASS source-backed operational values: 205+ technicians, inactive/homonyms/legacy names, typed regular+extra IDs, completion month boundaries, undated work, literal configured labor estimate, stock returns/units/source identities without mirrored duplication, document sources/credits/drafts, cash versus credit, complete query, invalid periods and ADMIN-only read without writes');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect());
