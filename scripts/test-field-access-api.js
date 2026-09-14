const assert = require('node:assert/strict');
require('../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true')throw new Error('Isolated QA required');
const {prisma}=require('../src/prismaClient');
const jwt=require('jsonwebtoken');
const {getJwtSecret}=require('../src/utils/jwtSecret');
const BASE=process.env.CW_BASE_URL||'http://127.0.0.1:3002';
async function main(){
 const results=[];const suffix=Date.now();
 const client=await prisma.client.create({data:{name:`Access QA ${suffix}`,active:true}});
 const other=await prisma.client.create({data:{name:`Other QA ${suffix}`,active:true}});
 const tech=await prisma.technician.create({data:{name:`Tech QA ${suffix}`,active:true}});
 const tech2=await prisma.technician.create({data:{name:`Tech2 QA ${suffix}`,active:true}});
 const sign=body=>jwt.sign(body,getJwtSecret(),{expiresIn:'1h'});
 const ct=sign({id:client.id,clientId:client.id,role:'CLIENT'}),tt=sign({id:tech.id,technicianId:tech.id,role:'TECHNICIAN'});
 const internal=await prisma.notification.create({data:{clientId:client.id,role:'ADMIN',title:'INTERNAL-ONLY',message:'Private management',eventType:'QA_ACCESS'}});
 const publicNote=await prisma.notification.create({data:{clientId:client.id,role:'CLIENT',title:'CLIENT-OK',message:'Client update',eventType:'QA_ACCESS'}});
 const ownTech=await prisma.notification.create({data:{role:'TECHNICIAN',title:'TECH-OWN',message:'Field update',metadata:{technicianId:tech.id}}});
 const otherTech=await prisma.notification.create({data:{role:'TECHNICIAN',title:'TECH-OTHER',message:'Other update',metadata:{technicianId:tech2.id}}});
 async function call(path,token,method='GET',body){const response=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,body:await response.json().catch(()=>({}))};}
 const test=async(name,fn)=>{try{await fn();console.log('PASS',name);results.push({name,pass:true})}catch(e){console.error('FAIL',name,e.message);results.push({name,pass:false,error:e.message})}};
 await test('client notifications exclude internal management',async()=>{const r=await call('/api/notifications',ct);assert.equal(r.status,200);assert(r.body.notifications.some(n=>n.id===publicNote.id));assert(!r.body.notifications.some(n=>n.id===internal.id));});
 await test('client portal notifications exclude internal management',async()=>{const r=await call(`/api/client-portal/${client.id}/notifications`,ct);assert.equal(r.status,200);assert(!JSON.stringify(r.body).includes('INTERNAL-ONLY'));assert(JSON.stringify(r.body).includes('CLIENT-OK'));});
 await test('technician sees own targeted notifications',async()=>{const r=await call('/api/notifications',tt);assert.equal(r.status,200,JSON.stringify(r.body));assert(r.body.notifications.some(n=>n.id===ownTech.id));assert(!r.body.notifications.some(n=>n.id===otherTech.id));});
 await test('anonymous offline write rejected',async()=>assert.equal((await call('/api/sync/text',null,'POST',{visits:[{id:1,ph:7.4}]})).status,401));
 await test('client offline write rejected',async()=>assert.equal((await call('/api/sync/text',ct,'POST',{visits:[{id:1,ph:7.4}]})).status,403));
 await test('anonymous document list rejected',async()=>assert.equal((await call('/api/documents')).status,401));
 await test('deleted administrator token rejected',async()=>assert.equal((await call('/api/notifications',sign({id:99999999,role:'ADMIN'}))).status,401));
 await test('unknown role token rejected',async()=>assert.equal((await call('/api/notifications',sign({id:1,role:'MAGIC'}))).status,401));
 await test('another client portal rejected',async()=>assert.equal((await call(`/api/client-portal/${other.id}/dashboard`,ct)).status,403));
 await test('anonymous chat rejected',async()=>assert.equal((await call(`/api/client-messages/${client.id}`)).status,401));
 await test('other client chat rejected',async()=>assert.equal((await call(`/api/client-messages/${other.id}`,ct)).status,403));
 await test('client cannot impersonate administrator',async()=>{const r=await call('/api/client-messages',ct,'POST',{clientId:client.id,sender:'Administrator',message:'QA identity test'});assert.equal(r.status,200);assert.equal(r.body.message.senderType,'CLIENT');});
 await test('anonymous realtime connection rejected' ,async()=>{
  const start=await fetch(`${BASE}/socket.io/?EIO=4&transport=polling`).then(r=>r.text());const sid=JSON.parse(start.slice(1)).sid;
  const url=`${BASE}/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(sid)}`;
  await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:'40'});
  const packet=await fetch(url,{signal:AbortSignal.timeout(5000)}).then(r=>r.text());assert(packet.includes('44'),packet);
 });
 console.log(JSON.stringify({results},null,2));if(results.some(r=>!r.pass))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
