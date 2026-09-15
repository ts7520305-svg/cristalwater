require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
const BASE=process.env.CW_BASE_URL||'http://127.0.0.1:3002';
(async()=>{
 const suffix=Date.now();
 const admin=await prisma.user.create({data:{name:'Retention QA',email:`retention-${suffix}@qa.test`,password:'no-login',role:'ADMIN',active:true}});
 const tech=await prisma.technician.create({data:{name:'Retention tech',active:true}});
 const sign=p=>jwt.sign(p,getJwtSecret(),{expiresIn:'1h'}),at=sign({id:admin.id,role:'ADMIN'}),tt=sign({id:tech.id,technicianId:tech.id,role:'TECHNICIAN'});
 async function call(path,token,body){const r=await fetch(BASE+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,body:await r.json()};}
 for(const [token,code] of [[null,401],[tt,403]]){assert.equal((await call('/api/system/retention/preview',token)).status,code);assert.equal((await call('/api/system/retention/execute',token,{})).status,code);}
 const old=new Date('2001-01-01T00:00:00Z'),recent=new Date();
 const track=await prisma.technicianTrack.create({data:{technicianId:tech.id,latitude:37,longitude:-8,createdAt:old}});
 const kept=await prisma.technicianTrack.create({data:{technicianId:tech.id,latitude:37,longitude:-8,createdAt:recent}});
 const live=await prisma.technicianLocation.create({data:{technicianId:tech.id,latitude:37,longitude:-8,createdAt:old}});
 const log=await prisma.locationLog.create({data:{userId:admin.id,latitude:37,longitude:-8,timestamp:old,createdAt:old}});
 const late=await prisma.locationLog.create({data:{userId:admin.id,latitude:37,longitude:-8,timestamp:old,createdAt:recent}});
 const beforeCritical={visits:await prisma.serviceVisit.count(),history:await prisma.technicalHistory.count(),invoices:await prisma.invoice.count(),payments:await prisma.payment.count()};
 let preview=(await call('/api/system/retention/preview',at)).body;assert(preview.counts.total>=2);assert.equal(preview.automaticDeletionEnabled,false);assert(await prisma.technicianTrack.findUnique({where:{id:track.id}}));
 const execute=review=>call('/api/system/retention/execute',at,{previewToken:review.previewToken,confirmation:'ELIMINAR GPS ANTIGO',reason:'Limpeza de teste QA'});
 assert.equal((await call('/api/system/retention/execute',at,{previewToken:preview.previewToken,reason:'QA teste'})).status,400);
 const changed=await prisma.technicianTrack.create({data:{technicianId:tech.id,latitude:37,longitude:-8,createdAt:old}});assert.equal((await execute(preview)).status,409);assert(await prisma.technicianTrack.findUnique({where:{id:track.id}}));
 preview=(await call('/api/system/retention/preview',at)).body;
 const forged={...preview,previewToken:preview.previewToken+'x'};assert.equal((await execute(forged)).status,409);
 const result=await execute(preview);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.body.deleted.total,preview.counts.total);
 for(const id of [track.id,changed.id])assert.equal(await prisma.technicianTrack.findUnique({where:{id}}),null);
 assert(await prisma.technicianTrack.findUnique({where:{id:kept.id}}));assert(await prisma.technicianLocation.findUnique({where:{id:live.id}}));assert(await prisma.locationLog.findUnique({where:{id:late.id}}));assert.equal(await prisma.locationLog.findUnique({where:{id:log.id}}),null);
 assert.deepEqual({visits:await prisma.serviceVisit.count(),history:await prisma.technicalHistory.count(),invoices:await prisma.invoice.count(),payments:await prisma.payment.count()},beforeCritical);
 assert.equal((await execute(preview)).status,409);
 assert.equal(await prisma.userAuditLog.count({where:{actor:`USER:${admin.id}`,action:'GPS_RETENTION_APPLIED'}}),1);
 console.log('PASS retention authorization, review-only counts, explicit confirmation, changed/forged/replayed previews, old GPS cleanup, recent/live/late records preserved and critical records unchanged');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
