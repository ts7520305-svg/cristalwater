require('../src/loadEnv')();
const assert=require('node:assert/strict');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const {prisma}=require('../src/prismaClient'),jwt=require('jsonwebtoken');
const {getJwtSecret}=require('../src/utils/jwtSecret');
const rates=require('../src/business/finance/ClientRateBusiness'),automation=require('../src/business/finance/MonthlyAutomationBusiness');
const {setSetting}=require('../src/services/systemSettingService');
const BASE=process.env.CW_BASE_URL||'http://127.0.0.1:3002';
(async()=>{
 const suffix=Date.now();
 const admin=await prisma.user.create({data:{name:'Rates QA',email:`rates-${suffix}@qa.test`,password:'qa-no-login',role:'ADMIN',active:true}});
 const client=await prisma.client.create({data:{name:'Rates QA client',monthlyFee:80,monthlyAmount:80,active:true,status:'ACTIVE',billingActive:true}});
 const tech=await prisma.technician.create({data:{name:'Rates QA tech',active:true}});
 const sign=body=>jwt.sign(body,getJwtSecret(),{expiresIn:'1h'}),at=sign({id:admin.id,role:'ADMIN'}),tt=sign({id:tech.id,technicianId:tech.id,role:'TECHNICIAN'}),ct=sign({id:client.id,clientId:client.id,role:'CLIENT'});
 async function call(path,token,method='GET',body){const r=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,body:await r.json().catch(()=>({}))};}
 const path=`/api/settings/client-rates/${client.id}`;
 const payload={expectedVersion:0,baseMonthlyAmount:80,periods:[{startsOn:'2032-01-01',endsOn:'2032-06-30',monthlyAmount:120,label:'Verão QA'}]};
 for(const [token,expected] of [[null,401],[tt,403],[ct,403]]){
  assert.equal((await call(path,token)).status,expected);assert.equal((await call(path,token,'PUT',payload)).status,expected);
  assert.equal((await call('/api/settings/client-rates-preview',token,'POST',{...payload,monthRef:'2032-01'})).status,expected);
 }
 const preview=await call('/api/settings/client-rates-preview',at,'POST',{...payload,monthRef:'2032-01'});assert.equal(preview.status,200);assert.equal(preview.body.preview.amount,120);assert.equal(await prisma.clientRatePlan.count({where:{clientId:client.id}}),0);
 const results=await Promise.all([call(path,at,'PUT',payload),call(path,at,'PUT',payload)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal((await call(path,at)).body.plan.version,1);
 const requests=[['/api/core/invoices/generate','2032-01'],['/api/operational-flow/generate-monthly-invoice','2032-02'],[`/api/invoices/generate-for-client/${client.id}`,'2032-03']];
 for(const [url,monthRef] of requests){const r=await call(url,at,'POST',{clientId:client.id,monthRef});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.invoice.total,120);}
 await setSetting('AUTO_MONTHLY_BILLING_ENABLED','true');
 const now=new Date('2032-04-10T12:00:00Z');await automation.monthly({now,clientIds:[client.id]});
 assert.equal((await prisma.invoice.findUnique({where:{clientId_monthRef:{clientId:client.id,monthRef:'2032-04'}}})).total,120);
 const changed={...payload,expectedVersion:1,periods:[{...payload.periods[0],monthlyAmount:200}]};assert.equal((await call(path,at,'PUT',changed)).status,200);
 for(const [url,monthRef] of requests){const r=await call(url,at,'POST',{clientId:client.id,monthRef});assert.equal(r.status,url.includes('generate-for-client')?200:409,JSON.stringify(r));assert.equal((await prisma.invoice.findUnique({where:{clientId_monthRef:{clientId:client.id,monthRef}}})).total,120);}
 await automation.monthly({now,clientIds:[client.id]});assert.equal((await prisma.invoice.findUnique({where:{clientId_monthRef:{clientId:client.id,monthRef:'2032-04'}}})).total,120);
 const fresh=await call('/api/core/invoices/generate',at,'POST',{clientId:client.id,monthRef:'2032-05'});assert.equal(fresh.body.invoice.total,200);
 const batch=await call('/api/invoices/generate-monthly',at,'POST',{monthRef:'2032-06'});assert.equal(batch.status,200,JSON.stringify(batch));assert.equal((await prisma.invoice.findUnique({where:{clientId_monthRef:{clientId:client.id,monthRef:'2032-06'}}})).total,200);
 assert.equal(await prisma.clientRatePlan.count({where:{clientId:client.id}}),2);
 // A contract with a zero legacy value must still be considered by the scheduler.
 const zero=await prisma.client.create({data:{name:'Rates QA zero base',monthlyFee:0,active:true,status:'ACTIVE',billingActive:true}});
 await rates.save(zero.id,{baseMonthlyAmount:0,expectedVersion:0,periods:[{startsOn:'2032-01-01',endsOn:'2032-04-30',monthlyAmount:90}]},'qa');
 await automation.monthly({now,clientIds:[zero.id]});assert.equal((await prisma.invoice.findUnique({where:{clientId_monthRef:{clientId:zero.id,monthRef:'2032-04'}}})).total,90);
 await automation.monthly({now:new Date('2032-05-10T12:00:00Z'),clientIds:[zero.id]});assert.equal(await prisma.invoice.count({where:{clientId:zero.id,monthRef:'2032-05'}}),0);
 console.log('PASS rates permission boundaries, read-only preview, concurrent versions, all monthly paths, immutable old invoices, scheduler with zero legacy price and free periods');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await setSetting('AUTO_MONTHLY_BILLING_ENABLED','false');await prisma.$disconnect();});
