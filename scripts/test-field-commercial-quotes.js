require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../src/utils/jwtSecret');
const BASE = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
(async () => {
 const suffix = Date.now();
 const admin = await prisma.user.create({data:{name:'Quote QA',email:`quote-${suffix}@qa.test`,password:'no-login',role:'ADMIN',active:true}});
 const tech = await prisma.technician.create({data:{name:'Quote tech',active:true}});
 const client = await prisma.client.create({data:{name:'Quote client',phone:'PRIVATE-TELEPHONE',active:true}});
 const pool = await prisma.pool.create({data:{name:'Quote pool',clientId:client.id}});
 const repair = await prisma.repair.create({data:{poolId:pool.id,problem:'Substituir bomba'}});
 const sign = body => jwt.sign(body,getJwtSecret(),{expiresIn:'1h'});
 const at=sign({id:admin.id,role:'ADMIN'}),tt=sign({id:tech.id,technicianId:tech.id,role:'TECHNICIAN'}),ct=sign({id:client.id,clientId:client.id,role:'CLIENT'});
 async function call(path,token,method='GET',body){const res=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return{status:res.status,body:await res.json().catch(()=>({}))};}
 const path=`/api/repairs/${repair.id}`;
 const payload={lines:[{type:'MATERIAL',description:'Bomba nova',quantity:2,unitCost:80,marginPercent:20},{type:'LABOR',description:'Instalação',quantity:1.5,unitCost:20,marginPercent:0}],taxPercent:23,expectedVersion:0};
 for(const token of [tt,ct]){
  assert.equal((await call(path+'/quotes',token)).status,403);
  assert.equal((await call('/api/repairs/quote-preview',token,'POST',payload)).status,403);
  assert.equal((await call(path+'/quote',token,'PUT',payload)).status,403);
  assert.equal((await call(path+'/pdf',token)).status,403);
 }
 assert.equal((await call(path+'/quotes',null)).status,401);
 const preview=await call('/api/repairs/quote-preview',at,'POST',payload);assert.equal(preview.status,200);assert.equal(preview.body.quote.net,230);assert.equal(preview.body.quote.total,282.9);
 assert.equal(await prisma.repairQuote.count({where:{repairId:repair.id}}),0);
 const attempts=await Promise.all([call(path+'/quote',at,'PUT',payload),call(path+'/quote',at,'PUT',payload)]);
 assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
 let versions=(await call(path+'/quotes',at)).body.quotes;assert.equal(versions.length,1);assert.equal(versions[0].snapshot.totalCost,190);
 assert.equal((await call(`/api/core/repairs/${repair.id}/quote`,at,'POST',{totalPrice:1})).status,409);
 assert.equal((await call(path+'/quote',at,'PUT',{})).status,409);
 assert.equal((await call(path+'/quote',at,'PUT',{...payload,expectedVersion:1})).status,200);
 versions=(await call(path+'/quotes',at)).body.quotes;assert.equal(versions.length,2);assert.equal(versions[0].version,2);
 assert.equal((await call(path+'/approve',at,'PUT',{quoteId:versions[1].id,approvalReference:'Email QA'})).status,409);
 assert.equal((await call(path+'/approve',at,'PUT',{quoteId:versions[0].id})).status,409);
 const technicianList=await call(`/api/repairs/pool/${pool.id}`,tt);assert.equal(technicianList.status,200);
 assert.equal(technicianList.body[0].problem,repair.problem);assert(!('totalPrice' in technicianList.body[0]));assert(!('paid' in technicianList.body[0]));
 const approve=await call(path+'/approve',at,'PUT',{quoteId:versions[0].id,approvalReference:'Cliente confirmou por email, QA'});assert.equal(approve.status,200,JSON.stringify(approve));
 assert.equal((await call(path+'/quote',at,'PUT',{...payload,expectedVersion:2})).status,409);
 assert.equal((await prisma.repair.findUnique({where:{id:repair.id}})).totalPrice,230);
 assert.equal(await prisma.userAuditLog.count({where:{entity:'RepairQuote',entityId:String(versions[0].id),action:'REPAIR_QUOTE_APPROVED'}}),1);
 console.log('PASS quote preview, fractional labor, tax, immutable versions, concurrent editors, stale approval, explicit approval, protected commercial routes and legacy overwrite guards');
 const expired=await prisma.repair.create({data:{poolId:pool.id,problem:'Expired quote',status:'QUOTED'}});
 const q=await prisma.repairQuote.create({data:{repairId:expired.id,version:1,createdBy:'qa',snapshot:{validUntil:'2020-01-01T00:00:00Z'}}});
 assert.equal((await call(`/api/repairs/${expired.id}/approve`,at,'PUT',{quoteId:q.id,approvalReference:'QA'})).status,409);
 console.log('PASS expired quote cannot be approved');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect());
