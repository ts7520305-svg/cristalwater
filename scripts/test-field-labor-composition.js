'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{fork}=require('node:child_process'),jwt=require('jsonwebtoken');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EMAIL_ENABLED!=='false'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA required');
const children=[],basisIds=[],requests=[];let f;
async function server(){const c=fork(require.resolve('./fixtures/expense-server'),[],{stdio:['ignore','ignore','inherit','ipc']});children.push(c);const base=await new Promise((resolve,reject)=>{c.once('message',m=>resolve('http://127.0.0.1:'+m.port));c.once('error',reject);});return{base,configure:fault=>new Promise(resolve=>{c.once('message',resolve);c.send({fault});})};}
(async()=>{
 const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),token=jwt.sign({id:admin.id,userId:admin.id,principalType:'USER',role:'ADMIN'},getJwtSecret(),{expiresIn:'1h'});
 f=await require('./fixtures/repair-labor-data')({admin});const one=await server(),two=await server();
 async function api(path,body,status=200,base=one.base,auth=token){const res=await fetch(base+path,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),v=await res.json();assert.equal(res.status,status,JSON.stringify(v));return v;}
 const cmd=(command,resourceId,data)=>{const requestId=randomUUID();requests.push(requestId);return{requestId,resourceId,command,data:{...data,reason:'Documentos, técnico e tempo pago conferidos',confirmed:true}};};
 const send=(body,status=200,base=one.base)=>api('/api/labor-cost-bases/commands',body,status,base);
 const basisPreview=async(es,status=200)=>(await api('/api/labor-cost-bases/basis-preview',{expenseIds:es.map(e=>e.expenseId).sort((a,b)=>a-b)},status)).preview;
 async function create(es){const p=await basisPreview(es),r=await send(cmd('CREATE',p.snapshot.components[0].expenseId,{expenseIds:p.snapshot.components.map(c=>c.expenseId),previewHash:p.hash}));assert(r.applied,JSON.stringify(r));basisIds.push(r.basis.id);return r.basis;}
 const choice=w=>({kind:'LABOR',targetType:'REPAIR',targetId:w.repairId,workIntervalId:w.id,purchaseItemId:null,quantity:null});
 const preview=async(b,c=choice(f.first),status=200)=>(await api('/api/labor-cost-bases/'+b.id+'/valuation-preview?'+new URLSearchParams(Object.fromEntries(Object.entries(c).filter(([k])=>!['quantity','purchaseItemId'].includes(k)))),null,status)).preview;
 const valueRequest=p=>cmd('VALUE',p.basisId,{choice:p.choice,previewHash:p.hash});
 const detail=async b=>api('/api/labor-cost-bases/'+b.id),expense=async e=>(await api('/api/expenses/'+e.expenseId)).expense;
 async function voidValue(b,g){const row=(await detail(b)).groups.find(r=>r.id===g.id),r=await send(cmd('VOID_VALUE',b.id,{groupId:row.id,recordHash:row.recordHash}));assert(r.applied,JSON.stringify(r));return r;}
 const a=await f.salary(),b=await f.salary({amountCents:50}),other=await f.salary(),badTech=await f.salary({technicianId:f.second.id}),badTime=await f.salary({paidMinutes:4}),badPeriod=await f.salary({periodStart:'2004-01-02'}),tiny=await f.salary({amountCents:1});
 for(const es of [[a,badTech],[a,badTime],[a,badPeriod]])await basisPreview(es,409);
 await basisPreview([a],400);await basisPreview([a,a],400);await api('/api/labor-cost-bases/basis-preview',{expenseIds:[b.expenseId,a.expenseId]},400);
 for(const path of ['/api/labor-cost-bases','/api/labor-cost-bases/candidates']){await api(path,null,401,one.base,null);const clientToken=jwt.sign({id:f.other.id,clientId:f.other.id,principalType:'CLIENT',role:'CLIENT'},getJwtSecret(),{expiresIn:'1h'});await api(path,null,403,one.base,clientToken);}
 const candidates=await api('/api/labor-cost-bases/candidates?q='+encodeURIComponent(f.tag));assert(candidates.rows.some(e=>e.expenseId===a.expenseId));
 const composition=await create([a,b]);assert.equal(composition.snapshot.paidMinutes,3);assert.equal(composition.snapshot.amountCents,150);
 const duplicated=await basisPreview([a,b]);assert.equal((await send(cmd('CREATE',a.expenseId,{expenseIds:[a.expenseId,b.expenseId],previewHash:duplicated.hash}))).code,'COMPOSITION_REVIEW');
 const tinyBasis=await create([other,tiny]);await preview(tinyBasis,choice(f.first),409);
 await preview(composition,choice(f.otherTech),409);await preview(composition,choice(f.boundary),409);
 const p=await preview(composition);assert.equal(p.quantity,'60');assert.equal(p.amountCents,50);assert.deepEqual(p.components.map(c=>c.amountCents),[33,17]);
 const request=valueRequest(p),race=await Promise.all([send(request),send(request,200,two.base),send(request)]);race.forEach(r=>assert.deepEqual(r,race[0]));assert(race[0].applied);const first=race[0].group;
 assert.equal(await prisma.fieldWriteRequest.count({where:{requestId:request.requestId}}),1);assert.equal(await prisma.laborCostValuationPart.count({where:{groupId:first.id}}),2);
 await send({...request,data:{...request.data,reason:'Conteúdo alterado'}},409);
 const receipt=await api('/api/labor-cost-bases/requests/'+request.requestId+'?'+new URLSearchParams({resourceId:composition.id,payloadHash:race[0].receipt.payloadHash}));assert.deepEqual(receipt.result,race[0]);
 await api('/api/labor-cost-bases/requests/'+request.requestId+'?'+new URLSearchParams({resourceId:composition.id,payloadHash:'a'.repeat(64)}),null,409);
 for(const e of [a,b])assert.equal((await expense(e)).allocations[0].needsReview,false);
 for(const part of first.snapshot.parts)assert.equal((await api('/api/expenses/'+part.expenseId+'/cost-period-preview?allocationId='+part.id)).preview.code,'REVALUE_REQUIRED');
 await preview(composition,choice(f.first),409);await api('/api/expenses/'+other.expenseId+'/valuation-preview?kind=LABOR&targetType=REPAIR&targetId='+f.reserved.id+'&workIntervalId='+f.first.id,null,409);
 const ea=await expense(a),partial=await api('/api/expenses/commands',{requestId:randomUUID(),command:'VOID_COST',expenseId:ea.id,expectedVersion:ea.version,data:{allocationId:first.snapshot.parts[0].id,reason:'Tentar anulação parcial'}});assert.equal(partial.code,'COMPOSITE_VOID_REQUIRED');
 let d=await detail(composition);assert.equal(d.groups[0].state,'CONFIRMED');assert.equal((await send(cmd('VOID_BASIS',composition.id,{recordHash:d.basis.recordHash}))).code,'COMPOSITION_REVIEW');
 const second=await send(valueRequest(await preview(composition,choice(f.adjacent))));assert(second.applied);assert.equal(second.group.snapshot.preview.amountCents,50);
 await prisma.serviceVisit.update({where:{id:f.regular.id},data:{startAt:new Date('2004-01-03T09:00:00Z'),endAt:new Date('2004-01-03T09:01:00Z')}});
 const regular={kind:'LABOR',targetType:'REGULAR',targetId:f.regular.id,purchaseItemId:null,quantity:null},last=await send(valueRequest(await preview(composition,regular)));assert(last.applied);assert.deepEqual(last.group.snapshot.parts.map(a=>a.amountCents),[34,16]);assert(last.group.snapshot.preview.components.every(p=>p.calculation.rounding==='FINAL_POOL_REMAINDER'));
 assert.equal((await expense(a)).allocatedCents,100);assert.equal((await expense(b)).allocatedCents,50);await preview(composition,choice(f.noMaterialWork),409);
 const coverage=await api('/api/expenses/costs?monthRef='+f.month);assert.equal(coverage.summary.valuations.laborAmountCents,100);assert.equal(coverage.summary.profit,null);
 const original=await prisma.companyExpense.findUniqueOrThrow({where:{id:b.expenseId}});await prisma.companyExpense.update({where:{id:b.expenseId},data:{amountCents:51}});
 assert.equal((await detail(composition)).basis.state,'REVIEW');for(const e of [a,b])assert((await expense(e)).allocations.every(x=>x.needsReview));assert.equal((await api('/api/expenses/costs?monthRef='+f.month)).summary.valuations.laborAmountCents,null);
 await prisma.companyExpense.update({where:{id:b.expenseId},data:{amountCents:original.amountCents}});assert.equal((await detail(composition)).groups[0].state,'CONFIRMED');
 const altered=await prisma.expenseAllocation.findUniqueOrThrow({where:{id:first.snapshot.parts[1].id}});await prisma.expenseAllocation.update({where:{id:altered.id},data:{reason:'Alteração indevida de uma parcela'}});assert((await expense(a)).allocations.find(x=>x.id===first.snapshot.parts[0].id).needsReview);await prisma.expenseAllocation.update({where:{id:altered.id},data:{reason:altered.reason}});
 await voidValue(composition,last.group);await voidValue(composition,second.group);await voidValue(composition,first);assert.equal((await expense(a)).allocatedCents,0);assert.equal((await expense(b)).allocatedCents,0);
 // A fault after the first part, after all parts, or before the durable receipt rolls back every row and every version.
 const pending=valueRequest(await preview(composition)),before=await Promise.all([expense(a),expense(b)]),count=await prisma.laborCostValuation.count();
 for(const fault of ['composition-part','after-payment','composition-receipt']){await one.configure(fault);await send(pending,503);await one.configure(null);assert.equal(await prisma.laborCostValuation.count(),count);assert.equal(await prisma.fieldWriteRequest.count({where:{requestId:pending.requestId}}),0);for(const [i,e]of[a,b].entries()){const now=await expense(e);assert.equal(now.version,before[i].version);assert.equal(now.allocatedCents,0);}}
 const saved=await send(pending);assert(saved.applied);
 const pendingVoid=cmd('VOID_VALUE',composition.id,{groupId:saved.group.id,recordHash:(await detail(composition)).groups.find(g=>g.id===saved.group.id).recordHash});await one.configure('composition-receipt');await send(pendingVoid,503);await one.configure(null);assert.equal((await detail(composition)).groups.find(g=>g.id===saved.group.id).state,'CONFIRMED');assert((await send(pendingVoid)).applied);
 // Manual attribution uses the very same monetary budget as every component.
 const company=(await api('/api/expenses/targets/COMPANY/0')).target,staleManual=valueRequest(await preview(composition)),manualExpense=await expense(a);
 const manual=await api('/api/expenses/commands',{requestId:randomUUID(),command:'ALLOCATE_COST',expenseId:a.expenseId,expectedVersion:manualExpense.version,data:{monthRef:f.month,amountCents:90,targetType:'COMPANY',targetId:null,targetHash:company.hash,reason:'Parcela manual confirmada',confirmed:true}});assert(manual.applied);assert.equal((await send(staleManual)).code,'COMPOSITION_REVIEW');assert.equal((await expense(b)).allocatedCents,0);
 const manualNow=await expense(a);assert((await api('/api/expenses/commands',{requestId:randomUUID(),command:'VOID_COST',expenseId:a.expenseId,expectedVersion:manualNow.version,data:{allocationId:manual.allocation.id,reason:'Repor orçamento após revisão'}})).applied);
 // Disjoint document sets must serialize at the global measurement lock too.
 const separate=await create([await f.salary(),await f.salary({amountCents:50})]);const separateA=valueRequest(await preview(composition)),separateB=valueRequest(await preview(separate));
 const disjoint=await Promise.all([send(separateA),send(separateB,200,two.base)]);assert.equal(disjoint.filter(r=>r.applied).length,1);const disjointWinner=disjoint.find(r=>r.applied);await voidValue(disjointWinner.group.basisId===composition.id?composition:separate,disjointWinner.group);
 // Existing standalone valuations and overlapping compositions share the same measurement and document pools.
 const overlap=await create([a,other]),pa=valueRequest(await preview(composition)),pb=valueRequest(await preview(overlap));const concurrent=await Promise.all([send(pa),send(pb,200,two.base)]);assert.equal(concurrent.filter(r=>r.applied).length,1);assert.equal(concurrent.filter(r=>r.code==='COMPOSITION_REVIEW').length,1);const winner=concurrent.find(r=>r.applied),winnerBasis=winner.group.basisId===composition.id?composition:overlap;await voidValue(winnerBasis,winner.group);
 const standalonePreview=(await api('/api/expenses/'+a.expenseId+'/valuation-preview?kind=LABOR&targetType=REPAIR&targetId='+f.reserved.id+'&workIntervalId='+f.first.id)).preview;
 const standalone={requestId:randomUUID(),command:'VALUE_LABOR',expenseId:a.expenseId,expectedVersion:standalonePreview.expenseVersion,data:{...Object.fromEntries(['kind','targetType','targetId','workIntervalId','targetHash','monthRef','purchaseItemId','quantity','amountCents','valuationHash'].map(k=>[k,standalonePreview[k]])),previewHash:standalonePreview.hash,reason:'Custo isolado confirmado',confirmed:true}};
 const composedRequest=valueRequest(await preview(composition));assert((await api('/api/expenses/commands',standalone)).applied);assert.equal((await send(composedRequest)).code,'COMPOSITION_REVIEW');await preview(overlap,choice(f.first),409);
 const next=await send(valueRequest(await preview(composition,choice(f.noMaterialWork))));assert(next.applied);assert.equal(next.group.snapshot.parts[0].amountCents,33);assert.equal(next.group.snapshot.parts[1].amountCents,17);
 // Missing/voided source invalidates every component, but explicit group void still preserves history.
 await f.voidWork(f.noMaterialWork);assert.equal((await detail(composition)).groups.find(g=>g.id===next.group.id).state,'REVIEW');assert((await expense(b)).allocations.find(x=>x.id===next.group.snapshot.parts[1].id).needsReview);
 await prisma.repair.delete({where:{id:f.none.id}});await voidValue(composition,next.group);assert.equal((await detail(composition)).groups.find(g=>g.id===next.group.id).state,'VOIDED');
 d=await detail(composition);assert((await send(cmd('VOID_BASIS',composition.id,{recordHash:d.basis.recordHash}))).applied);const replacement=await create([a,b]);assert.notEqual(replacement.id,composition.id);
 assert.equal(await prisma.expensePayment.count({where:{expenseId:{in:f.expenses}}}),0);
 await prisma.laborCostValuationPart.deleteMany({where:{group:{basisId:{in:basisIds}}}});await prisma.laborCostValuation.deleteMany({where:{basisId:{in:basisIds}}});await prisma.laborCostBasis.deleteMany({where:{id:{in:basisIds}}});await prisma.fieldWriteRequest.deleteMany({where:{requestId:{in:requests}}});await f.cleanup();f=null;
 console.log('PASS labor composition: common technician/period/paid time, original document budgets, exact per-component rounding and remainder, tiny-part refusal, global interval and typed visit reservation, atomic parts/version/receipt rollback and joint void, concurrent replay and overlapping bases, standalone coexistence, propagated source review and deleted-source history, admin-only recovery');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const c of children)c.kill('SIGTERM');await prisma.$disconnect();});
