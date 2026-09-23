'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const children = []; let f;
async function server() { const child = fork(require.resolve('./fixtures/expense-server'), [], { stdio: ['ignore','ignore','inherit','ipc'] }); children.push(child); const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); }); return { base, configure: fault => new Promise(resolve => { child.once('message', resolve); child.send({ fault }); }) }; }
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), token = jwt.sign({ id: admin.id, userId: admin.id, principalType: 'USER', role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' }), auth = { Authorization: 'Bearer ' + token };
  f = await require('./fixtures/cost-period-data')(admin); const one = await server(), two = await server();
  async function api(path, body, expected = 200, server = one) { const response = await fetch(server.base + '/api/expenses' + path, { method: body ? 'POST' : 'GET', headers: { ...auth, ...(body ? {'Content-Type':'application/json'} : {}) }, body: body ? JSON.stringify(body) : undefined }); const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); assert.match(response.headers.get('cache-control'), /no-store/); return result; }
  const detail = async id => (await api('/' + id)).expense;
  const preview = async a => (await api('/' + a.expenseId + '/cost-period-preview?allocationId=' + a.id)).preview;
  const envelope = p => ({ requestId: randomUUID(), command: 'CORRECT_COST_PERIOD', expenseId: p.expenseId, expectedVersion: p.expenseVersion, data: { allocationId: p.allocationId, fromMonth: p.fromMonth, toMonth: p.toMonth, amountCents: p.amountCents, previewHash: p.hash, reason: 'Corrigir para o mês da execução confirmada', confirmed: true } });
  const send = (e, status = 200, server = one) => api('/commands', e, status, server);
  const execution = async type => fetch(one.base + '/api/ai-admin/execution-values?' + new URLSearchParams({monthRef:f.month,mode:'COSTS',serviceType:type,serviceId:String(f.reserved.id),clientId:String(f.client.id)}), {headers:auth}).then(r=>r.json());
  await prisma.client.update({where:{id:f.client.id},data:{active:false}}); await prisma.pool.update({where:{id:f.pool.id},data:{clientId:f.other.id}});
  const originals = await Promise.all(['REGULAR','EXTRA','REPAIR'].map((type,i)=>f.cost(type,{category:['FUEL','VEHICLE','INSURANCE'][i]})));
  const beforeServices = await Promise.all([prisma.serviceVisit.findUnique({where:{id:f.regular.id}}),prisma.extraVisit.findUnique({where:{id:f.extraVisit.id}}),prisma.repair.findUnique({where:{id:f.reserved.id}})]);
  for (const original of originals) {
    const a = original.allocation, id = a.expenseId; await f.send('RECORD_PAYMENT',id,{amountCents:300,paidOn:f.documentMonth+'-02',method:'CASH',reference:'Pagamento já efetuado'});
    const before = await detail(id), p = await preview(a); assert(p.available); assert.equal(p.toMonth,f.month); assert.equal(p.fromMonth,f.mismatchMonth); assert.equal(p.clientId,f.client.id);
    assert.equal((await execution(a.targetType)).rows.find(r=>r.id===a.id).state,'PERIOD_MISMATCH');
    const oldSummary=(await api('/costs?monthRef='+f.mismatchMonth)).summary, newSummary=(await api('/costs?monthRef='+f.month)).summary, e=envelope(p);
    const results = await Promise.all([send(e),send(e,200,two)]); assert(results.every(r=>r.applied)); assert.equal(results.filter(r=>r.replayed).length,1); const result=results[0];
    assert.equal(await prisma.expenseEvent.count({where:{requestId:e.requestId}}),1); assert.deepEqual((await api('/requests/'+e.requestId)).allocation,result.allocation);
    assert.equal(result.version,p.expenseVersion+1); assert.equal(result.allocation.clientId,f.client.id); assert.equal(result.allocation.targetType,a.targetType); assert.notEqual(result.allocation.id,a.id);
    await require('./fixtures/cost-period-receipt-compat')(result,e,'ADMIN:'+admin.id);
    assert.equal(result.allocationVoided.activeKey,null); assert(result.allocationVoided.voidedAt); assert.deepEqual(result.allocationBefore,p.allocationBefore);
    for(const k of ['amountCents','targetType','clientId','visitId','extraVisitId','repairId','targetHash','targetSnapshot','expenseHash','expenseSnapshot']) assert.deepEqual(result.allocation[k],p.allocationBefore[k]);
    const after=await detail(id); assert.equal(after.allocatedCents,before.allocatedCents); assert.equal(after.unallocatedCents,before.unallocatedCents); assert.equal(after.paidCents,before.paidCents); assert.equal(after.openCents,before.openCents); assert.deepEqual(after.payments,before.payments); assert.deepEqual(after.evidence,before.evidence);
    assert.equal((await api('/costs?monthRef='+f.mismatchMonth)).summary.allocatedAmountCents,oldSummary.allocatedAmountCents-1500); assert.equal((await api('/costs?monthRef='+f.month)).summary.allocatedAmountCents,newSummary.allocatedAmountCents+1500);
    const report=await execution(a.targetType); assert.equal(report.rows.some(r=>r.id===a.id),false); assert.equal(report.rows.find(r=>r.id===result.allocation.id).state,'CONFIRMED'); assert.equal(report.summary.profit,null); assert.equal(report.summary.completeOperatingCosts,false);
    assert.equal((await preview(a)).code,'ALLOCATION_STATE'); assert.equal((await preview(result.allocation)).code,'PERIOD_ALIGNED');
    await send({...e,data:{...e.data,reason:'different payload'}},409);
  }
  assert.deepEqual(await Promise.all([prisma.serviceVisit.findUnique({where:{id:f.regular.id}}),prisma.extraVisit.findUnique({where:{id:f.extraVisit.id}}),prisma.repair.findUnique({where:{id:f.reserved.id}})]),beforeServices);
  const stale = (await f.cost()).allocation, p = await preview(stale), e = envelope(p);
  for(const change of [{amountCents:1},{fromMonth:'2001-01'},{toMonth:'2001-02'},{previewHash:'a'.repeat(64)}]) assert.equal((await send({...e,requestId:randomUUID(),data:{...e.data,...change}})).code,'PREVIEW_CHANGED');
  await send({...e,requestId:randomUUID(),data:{...e.data,confirmed:false}},400); await api('/'+stale.expenseId+'/cost-period-preview?allocationId=01',null,400); await api('/'+stale.expenseId+'/cost-period-preview?allocationId='+stale.id+'&toMonth=2001-01',null,400);
  await prisma.serviceVisit.update({where:{id:f.regular.id},data:{endAt:new Date('2001-03-01Z')}}); assert.equal((await send({...e,requestId:randomUUID()})).code,'TARGET_STALE'); await prisma.serviceVisit.update({where:{id:f.regular.id},data:{endAt:f.regular.endAt}});
  await f.send('EDIT',stale.expenseId,f.manual({category:'FUEL',amountCents:11000,reason:'Documento corrigido'})); assert.equal((await send(e)).code,'VERSION_CHANGED'); assert.equal((await preview(stale)).code,'EXPENSE_STALE');
  await f.send('REVIEW_COST',stale.expenseId,{allocationId:stale.id,targetHash:stale.targetHash,reason:'Documento revisto',confirmed:true}); assert((await preview(stale)).available);
  const target = await require('../src/services/expenseCostTargets').get(prisma,'REGULAR',f.regular.id);
  await f.send('ALLOCATE_COST',stale.expenseId,{targetType:'REGULAR',targetId:f.regular.id,targetHash:target.hash,monthRef:f.month,amountCents:200,reason:'Parcela já existente',confirmed:true}); assert.equal((await preview(stale)).code,'ALLOCATION_EXISTS');
  const rollback=(await f.cost('EXTRA')).allocation, rp=await preview(rollback), snapshot=await prisma.expenseAllocation.findMany({where:{expenseId:rollback.expenseId}});
  for(const fault of ['period-create','after-payment','audit']) { const request=envelope(rp); await one.configure(fault); const result=await send(request,503); await one.configure(null); assert(!JSON.stringify(result).includes('QA_PRIVATE')); assert.deepEqual(await prisma.expenseAllocation.findMany({where:{expenseId:rollback.expenseId}}),snapshot); assert.equal((await detail(rollback.expenseId)).version,rp.expenseVersion); assert.equal(await prisma.expenseEvent.count({where:{requestId:request.requestId}}),0); }
  const cancelled=envelope(rp); assert.equal((await api('/commands/cancel',cancelled)).code,'CANCELLED_REQUEST'); assert.equal((await send(cancelled)).code,'CANCELLED_REQUEST');
  const race=await Promise.all([send(envelope(rp)),send(envelope(rp),200,two)]); assert.equal(race.filter(r=>r.applied).length,1); assert.equal(race.filter(r=>r.code==='VERSION_CHANGED').length,1);
  // Undated executions and non-service recipients cannot acquire an invented execution month.
  const undated=await prisma.serviceVisit.create({data:{clientId:f.client.id,status:'DONE'}}); const u=(await f.cost('REGULAR',{},f.mismatchMonth,undated.id)).allocation; assert.equal((await preview(u)).code,'EXECUTION_DATE_REQUIRED');
  const client=(await f.cost('CLIENT',{},f.mismatchMonth,f.client.id)).allocation; assert.equal((await preview(client)).code,'SERVICE_REQUIRED');
  // Real valued records are refused before the manual correction path.
  const rich=await require('./fixtures/execution-values-data')({admin,rich:true});
  assert.equal((await preview(rich.material.allocation)).code,'REVALUE_REQUIRED'); assert.equal((await preview(rich.labor.allocation)).code,'REVALUE_REQUIRED');
  const importedId=rich.material.expenseId, imported=(await f.send('ALLOCATE_COST',importedId,{targetType:'REGULAR',targetId:f.regular.id,targetHash:target.hash,monthRef:f.mismatchMonth,amountCents:100,reason:'Parcela manual da compra',confirmed:true})).allocation;
  const ip=await preview(imported);assert(ip.available);const importedExpense=await prisma.companyExpense.findUniqueOrThrow({where:{id:importedId}}),purchase=await prisma.stockPurchase.findUniqueOrThrow({where:{id:importedExpense.stockPurchaseId}});
  await prisma.stockPurchase.update({where:{id:purchase.id},data:{supplierName:purchase.supplierName+' corrigido'}});assert.equal((await preview(imported)).code,'SOURCE_STALE');assert.equal((await send(envelope(ip))).code,'SOURCE_STALE');await prisma.stockPurchase.update({where:{id:purchase.id},data:{supplierName:purchase.supplierName}});await rich.cleanup();
  const denied=await fetch(one.base+'/api/expenses/'+u.expenseId+'/cost-period-preview?allocationId='+u.id); assert.equal(denied.status,401); assert.match(denied.headers.get('cache-control'),/no-store/);
  const other=await prisma.user.create({data:{name:'Cost period other '+randomUUID(),email:randomUUID()+'@example.test',password:admin.password,role:'ADMIN',active:true}}), otherToken=jwt.sign({id:other.id,userId:other.id,principalType:'USER',role:'ADMIN'},getJwtSecret(),{expiresIn:'1h'});
  assert.equal((await fetch(one.base+'/api/expenses/requests/'+cancelled.requestId,{headers:{Authorization:'Bearer '+otherToken}})).status,404);
  await prisma.expensePayment.deleteMany({where:{expenseId:{in:f.expenseIds}}}); await f.cleanup(); f=null; await prisma.serviceVisit.delete({where:{id:undated.id}});
  console.log('PASS cost period correction: typed regular/extra/repair identities and original client, exact preview and unchanged amounts/payments/budgets, execution/month projections, atomic replacement/history, competing commands and exact owner receipts, stale sources and collisions refused, full rollback and cancellation, valued costs and undated services excluded');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const child of children) child.kill('SIGTERM');await prisma.$disconnect();});
