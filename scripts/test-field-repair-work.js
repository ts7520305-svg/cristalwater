'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret'), writes = require('../src/services/fieldWriteRequestService');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const children=[];let f;
async function server() { const child=fork(require.resolve('./fixtures/repair-work-server'),[],{stdio:['ignore','ignore','inherit','ipc']});children.push(child);const base=await new Promise((resolve,reject)=>{child.once('message',m=>resolve('http://127.0.0.1:'+m.port));child.once('error',reject);});return {base,configure:fault=>new Promise(resolve=>{child.once('message',resolve);child.send({fault});})}; }
(async()=>{
 const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}), token=jwt.sign({id:admin.id,userId:admin.id,principalType:'USER',role:'ADMIN'},getJwtSecret(),{expiresIn:'1h'});
 f=await require('./fixtures/repair-work-data')({admin});const one=await server(),two=await server();
 const techToken=jwt.sign({id:f.tech.id,principalType:'TECHNICIAN',role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}), otherToken=jwt.sign({id:f.second.id,principalType:'TECHNICIAN',role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
 const clientToken=jwt.sign({id:f.other.id,clientId:f.other.id,role:'CLIENT',principalType:'CLIENT'},getJwtSecret(),{expiresIn:'1h'});
 async function api(id,body,status=200,base=one.base,auth=token,suffix=''){const response=await fetch(base+'/api/repairs/'+id+'/work'+suffix,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));if(![401,403].includes(status))assert.match(response.headers.get('cache-control')||'',/no-store/);assert(!JSON.stringify(result).includes('QA_PRIVATE'));return result;}
 const detail=async(id=f.reserved.id,auth=token)=>(await api(id,null,200,one.base,auth)).detail;
 const data=(start='2020-01-01T09:00:00.000Z',end='2020-01-01T09:30:00.000Z',technicianId=f.tech.id)=>({technicianId,startedAt:start,endedAt:end,reason:'Trabalho efetivo confirmado, sem pausas.',confirmed:true});
 const cmd=async(id,d=data(),auth=token)=>({requestId:randomUUID(),command:'RECORD',expectedVersion:(await detail(id,auth)).contextVersion,data:d});
 const lookup=(id,c,auth=token)=>api(id,null,200,one.base,auth,'/requests/'+c.requestId+'?payloadHash='+writes.hash({v:1,scope:'REPAIR_WORK_INTERVAL',resourceId:id,payload:{command:c.command,expectedVersion:c.expectedVersion,data:c.data}}));
 async function voidCommand(id,row,auth=token){return {requestId:randomUUID(),command:'VOID',expectedVersion:(await detail(id,auth)).contextVersion,data:{intervalId:row.id,recordHash:(await detail(id,auth)).rows.find(r=>r.id===row.id).recordHash,reason:'Correção explícita do intervalo registado.',confirmed:true}};}
 const snapshot=async()=>JSON.stringify({repairs:await prisma.repair.findMany({where:{id:{in:f.repairs.map(r=>r.id)}},orderBy:{id:'asc'}}),movements:await prisma.stockMovement.findMany({where:{poolId:f.pool.id},orderBy:{id:'asc'}}),proofs:await prisma.auditTrail.findMany({where:{entity:'Repair',entityId:{in:f.repairs.map(r=>r.id)},eventType:'REPAIR_EXECUTION_CONFIRMED'},orderBy:{id:'asc'}}),expenses:await prisma.companyExpense.count(),costs:await prisma.expenseAllocation.count(),invoices:await prisma.invoice.count()});
 await prisma.client.update({where:{id:f.client.id},data:{active:false}});await prisma.pool.update({where:{id:f.pool.id},data:{clientId:f.other.id}});
 const before=await snapshot(), view=await detail();assert(view.canRegister);assert.equal(view.source.facts.clientId,f.client.id);assert.equal(view.summary.totalSeconds,0);
 await api(f.reserved.id,null,401,one.base,null);await api(f.reserved.id,null,403,one.base,clientToken);
 const field=await detail(f.reserved.id,techToken);assert.equal(field.visibility,'OWN_TECHNICIAN');assert.deepEqual(field.technicians.map(t=>t.id),[f.tech.id]);assert(!/PRIVATE_|unitPrice|totalPrice|hourlyCost|costPerVisit/.test(JSON.stringify(field)));
 await api(f.reserved.id,await cmd(f.reserved.id,data(undefined,undefined,f.second.id),techToken),403,one.base,techToken);
 for(const changes of [{confirmed:false},{startedAt:'invalid'},{startedAt:'2020-01-01T09:00:00.500Z'},{endedAt:'2020-01-01T09:00:00.000Z'},{endedAt:'2199-01-01T09:30:00.000Z'},{reason:'bad'},{clientId:f.other.id}])await api(f.reserved.id,await cmd(f.reserved.id,{...data(),...changes}),400);
 for(const id of [f.pending.id,f.legacy.id]){assert.equal((await detail(id)).canRegister,false);assert.equal((await api(id,await cmd(id))).applied,false);}
 const tooEarly=await api(f.reserved.id,await cmd(f.reserved.id,data('1999-01-01T09:00:00.000Z','1999-01-01T10:00:00.000Z')));assert.equal(tooEarly.applied,false);
 const command=await cmd(f.reserved.id),same=await Promise.all([api(f.reserved.id,command),api(f.reserved.id,command,200,two.base),api(f.reserved.id,command)]);
 same.forEach(r=>assert.deepEqual(r,same[0]));const first=same[0];assert(first.applied);assert.equal(first.interval.durationSeconds,1800);assert.equal(first.interval.clientId,f.client.id);assert.equal(first.interval.createdBy,'ADMIN:'+admin.id);assert.equal(first.interval.snapshot.basis,'EXPLICIT_AUTHENTICATED_REPAIR_WORK_INTERVAL');
 assert.equal((await lookup(f.reserved.id,command)).result.interval.id,first.interval.id);assert.equal((await lookup(f.reserved.id,command,otherToken)).found,false);
 await api(f.reserved.id,{...command,data:{...command.data,reason:'Reused identifier with another declaration'}},409);
 assert.equal(await prisma.repairWorkInterval.count({where:{repairId:f.reserved.id}}),1);assert.equal(await prisma.auditTrail.count({where:{entity:'RepairWorkInterval',entityId:first.interval.id,eventType:'REPAIR_WORK_RECORDED'}}),1);
 const overlap=await api(f.reserved.id,await cmd(f.reserved.id,data('2020-01-01T09:20:00.000Z','2020-01-01T10:00:00.000Z')));assert.equal(overlap.code,'WORK_TIME_CONFLICT');
 const adjacent=await api(f.reserved.id,await cmd(f.reserved.id,data('2020-01-01T09:30:00.000Z','2020-01-01T10:00:00.000Z')));assert(adjacent.applied);
 const team=await api(f.reserved.id,await cmd(f.reserved.id,data(undefined,undefined,f.second.id),otherToken),200,one.base,otherToken);assert(team.applied);
 assert.equal((await detail()).summary.totalSeconds,5400);assert.equal((await detail(f.reserved.id,techToken)).summary.totalSeconds,3600);assert.equal((await detail(f.reserved.id,otherToken)).summary.totalSeconds,1800);
 const protectedVoid=await voidCommand(f.reserved.id,first.interval);await api(f.reserved.id,protectedVoid,403,one.base,otherToken);
 // Different repairs share the same technician lock; only one overlapping interval survives.
 const raceData=data('2020-02-01T10:00:00.000Z','2020-02-01T11:00:00.000Z'),a=await cmd(f.reserved.id,raceData),b=await cmd(f.none.id,raceData);
 const race=await Promise.all([api(f.reserved.id,a),api(f.none.id,b,200,two.base)]);assert.equal(race.filter(r=>r.applied).length,1);assert.equal(race.filter(r=>r.code==='WORK_TIME_CONFLICT').length,1);
 // Both regular and extra visits keep their own identity even with the repair's ID.
 for(const model of ['serviceVisit','extraVisit']){
  await prisma[model].update({where:{id:f.reserved.id},data:{startAt:new Date('2020-03-01T10:00:00Z'),endAt:new Date('2020-03-01T11:00:00Z')}});
  assert.equal((await api(f.none.id,await cmd(f.none.id,data('2020-03-01T10:30:00.000Z','2020-03-01T11:30:00.000Z')))).code,'WORK_TIME_CONFLICT');
  await prisma[model].update({where:{id:f.reserved.id},data:{startAt:null,endAt:null}});
 }
 const atomic=await cmd(f.none.id,data('2020-04-01T10:00:00.000Z','2020-04-01T11:00:00.000Z')),countBefore=await prisma.repairWorkInterval.count(),auditBefore=await prisma.auditTrail.count({where:{entity:'RepairWorkInterval'}});
 for(const fault of ['after-create','after-audit','receipt']){await one.configure(fault);await api(f.none.id,atomic,500);await one.configure(null);assert.equal(await prisma.repairWorkInterval.count(),countBefore);assert.equal(await prisma.auditTrail.count({where:{entity:'RepairWorkInterval'}}),auditBefore);assert.equal((await lookup(f.none.id,atomic)).found,false);}
 const recovered=await api(f.none.id,atomic);assert(recovered.applied);assert.deepEqual((await lookup(f.none.id,atomic)).result,recovered);
 const voidAtomic=await voidCommand(f.none.id,recovered.interval);await one.configure('after-update');await api(f.none.id,voidAtomic,500);await one.configure(null);assert.equal((await prisma.repairWorkInterval.findUniqueOrThrow({where:{id:recovered.interval.id}})).voidedAt,null);assert((await api(f.none.id,voidAtomic)).applied);
 assert((await api(f.none.id,await cmd(f.none.id,atomic.data))).applied);
 const stale=await cmd(f.none.id,data('2020-05-01T10:00:00.000Z','2020-05-01T11:00:00.000Z'));
 assert((await api(f.none.id,await cmd(f.none.id,data('2020-05-02T10:00:00.000Z','2020-05-02T11:00:00.000Z')))).applied);
 const staleResult=await api(f.none.id,stale);assert.equal(staleResult.code,'REPAIR_WORK_CHANGED');assert.deepEqual(await api(f.none.id,stale),staleResult);
 // Changes discovered after recording withdraw confirmation, without freeing the overlap reservation.
 await prisma.serviceVisit.update({where:{id:f.regular.id},data:{startAt:new Date(command.data.startedAt),endAt:new Date(command.data.endedAt)}});
 let reviewed=(await detail()).rows.find(r=>r.id===first.interval.id);assert.equal(reviewed.state,'REVIEW');assert(reviewed.reviewReasons.includes('RECORDED_TIME_OVERLAP'));
 await prisma.serviceVisit.update({where:{id:f.regular.id},data:{startAt:null,endAt:null}});
 await prisma.repair.update({where:{id:f.reserved.id},data:{unitPrice:999999,totalPrice:999999}});assert.equal((await detail()).rows.find(r=>r.id===first.interval.id).state,'CONFIRMED');await prisma.repair.update({where:{id:f.reserved.id},data:{unitPrice:900,totalPrice:900}});
 const movement=await prisma.stockMovement.findFirstOrThrow({where:{poolId:f.pool.id,movementType:'CONSUMPTION'}});
 await prisma.stockMovement.update({where:{id:movement.id},data:{quantity:movement.quantity+1}});assert.equal((await detail()).rows.find(r=>r.id===first.interval.id).state,'REVIEW');await prisma.stockMovement.update({where:{id:movement.id},data:{quantity:movement.quantity}});
 const renamedCommand=await cmd(f.none.id,data('2020-07-01T10:00:00.000Z','2020-07-01T11:00:00.000Z'));
 await prisma.technician.update({where:{id:f.tech.id},data:{name:'Renamed technician',active:false}});assert.equal((await api(f.none.id,renamedCommand)).code,'REPAIR_WORK_CHANGED');assert.equal((await detail()).rows.find(r=>r.id===first.interval.id).state,'CONFIRMED');await prisma.technician.update({where:{id:f.tech.id},data:{name:f.tech.name,active:true}});
 assert.equal(await snapshot(),before);
 await prisma.repair.delete({where:{id:f.reserved.id}});const deleted=await detail();assert.equal(deleted.canRegister,false);assert(deleted.rows.filter(r=>!r.voidedAt).every(r=>r.state==='REVIEW'));
 const removal=await voidCommand(f.reserved.id,first.interval);const removed=await api(f.reserved.id,removal);assert(removed.applied);assert.equal(removed.interval.repairId,f.reserved.id);assert.equal(removed.interval.fingerprint,first.interval.fingerprint);
 assert.deepEqual((await lookup(f.reserved.id,command)).result,first);
 await f.cleanup();f=null;
 console.log('PASS repair work intervals: authenticated declared duration, original inactive client and pool transfer, reserved/no-material execution, technician ownership/privacy, exact concurrent receipts, cross-repair and visit overlaps, adjacent/team intervals, atomic rollback, durable refusals, later source/time review, independent commercial prices and deleted-source void/history');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const child of children)child.kill('SIGTERM');await prisma.$disconnect();});
