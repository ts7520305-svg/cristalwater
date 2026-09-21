'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID, randomInt } = require('node:crypto'), { fork } = require('node:child_process'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false') throw Error('Isolated QA required');
const children = [];
async function server() { const child = fork(require.resolve('./fixtures/expense-server'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }); children.push(child); const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); }); return { base, configure: fault => new Promise(resolve => { child.once('message', resolve); child.send({ fault }); }) }; }
(async () => {
  const one = await server(), two = await server(), monthRef = '2004-01', nextMonth = '2004-02', stamp = randomUUID();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), token = jwt.sign({ id: user.id, userId: user.id, principalType: 'USER', role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const auth = { Authorization: 'Bearer ' + token };
  async function api(path, body, expected = 200, base = one.base) { const res = await fetch(base + '/api/expenses' + path, { method: body ? 'POST' : 'GET', headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const data = await res.json(); assert.equal(res.status, expected, JSON.stringify(data)); assert.match(res.headers.get('cache-control'), /no-store/); return data; }
  const env = (command, expenseId, expectedVersion, data, requestId = randomUUID()) => ({ requestId, command, expenseId, expectedVersion, data });
  const send = (command, status = 200, base = one.base) => api('/commands', command, status, base);
  const manual = extra => ({ title: 'Cost QA ' + stamp, supplierId: null, supplierName: 'QA supplier', documentNumber: '', expenseDate: monthRef + '-01', dueDate: null, amountCents: 10000, category: 'GENERAL', notes: '', sourceType: 'MANUAL', sourceId: null, sourceHash: null, confirmed: true, reason: '', ...extra });
  const clients = await prisma.client.createManyAndReturn({ data: [{ name: 'Cost A ' + stamp, active: false }, { name: 'Cost B ' + stamp }] }), [a, b] = clients;
  const sameId = randomInt(1000000000, 1900000000), regular = await prisma.serviceVisit.create({ data: { id: sameId, clientId: a.id, status: 'DONE', endAt: new Date('2004-01-15Z') } }), extra = await prisma.extraVisit.create({ data: { id: sameId, clientId: a.id, status: 'COMPLETED', endAt: new Date('2004-01-16Z') } });
  const target = async (type, id) => (await api('/targets/' + type + '/' + (id || 0))).target;
  const ca = await target('CLIENT', a.id), cb = await target('CLIENT', b.id), company = await target('COMPANY', null), rt = await target('REGULAR', regular.id), xt = await target('EXTRA', extra.id);
  assert.equal(ca.valid, true); assert.notEqual(rt.hash, xt.hash); assert.equal((await api('/targets?type=REGULAR&clientId=' + a.id)).rows.some(r => r.id === sameId), true);
  const created = await send(env('CREATE', null, null, manual())), id = created.expenseId;
  const get = async () => (await api('/' + id)).expense;
  const allocation = (t, amountCents, month = monthRef) => ({ targetType: t.type, targetId: t.id, targetHash: t.hash, monthRef: month, amountCents, reason: 'Documented attribution QA', confirmed: true });
  const p1 = env('ALLOCATE_COST', id, 1, allocation(ca, 6000)), p2 = env('ALLOCATE_COST', id, 1, allocation(cb, 6000));
  const concurrent = await Promise.all([send(p1), send(p2, 200, two.base)]); assert.equal(concurrent.filter(r => r.applied).length, 1); assert.equal(concurrent.filter(r => r.code === 'VERSION_CHANGED').length, 1);
  const first = concurrent.find(r => r.applied), firstTarget = first.allocation.clientId === a.id ? ca : cb;
  assert.equal((await get()).allocatedCents, 6000); assert.equal((await get()).unallocatedCents, 4000);
  assert.equal((await send(env('ALLOCATE_COST', id, 2, allocation(company, 4001, nextMonth)))).code, 'OVERALLOCATION');
  assert.equal((await send(env('ALLOCATE_COST', id, 2, allocation(firstTarget, 1)))).code, 'ALLOCATION_EXISTS');
  const second = await send(env('ALLOCATE_COST', id, 2, allocation(company, 4000, nextMonth))); assert(second.applied); assert.equal((await get()).unallocatedCents, 0);
  assert.equal((await api('/costs?monthRef=' + monthRef)).summary.allocatedAmountCents, 6000); assert.equal((await api('/costs?monthRef=' + nextMonth)).summary.companyAmountCents, 4000);
  const beforePayment = (await get()).allocations; await send(env('RECORD_PAYMENT', id, 3, { amountCents: 100, paidOn: '2004-01-02', method: 'CASH', reference: 'Cash already paid' })); assert((await get()).allocations.every(x => !x.needsReview)); assert.deepEqual((await get()).allocations, beforePayment);
  const voided = await send(env('VOID_COST', id, 4, { allocationId: second.allocation.id, reason: 'Correct cost destination' })); assert(voided.applied); assert.equal(voided.allocation.activeKey, null);
  const reg = await send(env('ALLOCATE_COST', id, 5, allocation(rt, 2000))), ext = await send(env('ALLOCATE_COST', id, 6, allocation(xt, 2000))); assert(reg.applied && ext.applied);
  assert.equal((await send(env('EDIT', id, 7, manual({ amountCents: 9999, reason: 'Must not reduce allocated budget' })))).code, 'BELOW_ALLOCATIONS');
  assert.equal((await send(env('CANCEL', id, 7, { reason: 'Must not hide attribution' }))).code, 'ACTIVE_ALLOCATIONS');
  const changed = await send(env('EDIT', id, 7, manual({ amountCents: 12000, reason: 'Confirmed corrected expense' }))); assert(changed.applied); assert.equal((await get()).allocationReviewCount, 3); assert.equal((await api('/costs?monthRef=' + monthRef)).summary.allocatedAmountCents, null);
  for (const record of (await get()).allocations.filter(a => !a.voidedAt)) { const current = await get(), currentTarget = await target(record.targetType, record.targetId); const reviewed = await send(env('REVIEW_COST', id, current.version, { allocationId: record.id, targetHash: currentTarget.hash, reason: 'Reviewed against corrected document', confirmed: true })); assert(reviewed.applied); }
  assert.equal((await get()).allocationReviewCount, 0); assert.equal((await get()).unallocatedCents, 2000);
  const targetRows = await api('/costs?monthRef=' + monthRef + '&mode=TARGETS&clientId=' + a.id); assert(targetRows.rows.some(g => g.targetType === 'REGULAR' && g.targetId === sameId)); assert(targetRows.rows.some(g => g.targetType === 'EXTRA' && g.targetId === sameId));
  const detail = await api('/costs?monthRef=' + monthRef + '&mode=ALLOCATIONS&clientId=' + a.id + '&targetType=REGULAR&targetId=' + sameId); assert.equal(detail.rows[0].id, reg.allocation.id);
  await prisma.serviceVisit.update({ where: { id: regular.id }, data: { clientId: b.id } }); const changedTarget = await target('REGULAR', regular.id), current = await get(); assert.equal(current.allocations.find(x => x.id === reg.allocation.id).needsReview, true);
  assert.equal((await send(env('REVIEW_COST', id, current.version, { allocationId: reg.allocation.id, targetHash: changedTarget.hash, confirmed: true, reason: 'Must not move costs silently' }))).code, 'TARGET_STALE');
  await send(env('VOID_COST', id, current.version, { allocationId: reg.allocation.id, reason: 'Correct historical attribution explicitly' }));
  const newReg = await send(env('ALLOCATE_COST', id, (await get()).version, allocation(changedTarget, 2000))); assert(newReg.applied); assert.equal(newReg.allocation.clientId, b.id);
  await prisma.extraVisit.update({where:{id:extra.id},data:{startAt:new Date('2004-01-15T23:00:00Z')}}); const durationChanged = await get(); assert.equal(durationChanged.allocations.find(a=>a.id===ext.allocation.id).needsReview,true);
  const updatedExtra = await target('EXTRA',extra.id);assert((await send(env('REVIEW_COST',id,durationChanged.version,{allocationId:ext.allocation.id,targetHash:updatedExtra.hash,reason:'Work duration reviewed',confirmed:true}))).applied);
  const originalRequest = first.allocation.clientId === a.id ? p1 : p2; assert.equal((await send(originalRequest)).version, first.version); assert.equal(await prisma.expenseEvent.count({ where: { requestId: originalRequest.requestId } }), 1);
  const pendingCancelled = env('ALLOCATE_COST', id, (await get()).version, allocation(company, 1000, nextMonth)); await api('/commands/cancel', pendingCancelled); assert.equal((await send(pendingCancelled)).code, 'CANCELLED_REQUEST');
  for (const fault of ['audit', 'after-payment']) { const version = (await get()).version, count = await prisma.expenseAllocation.count(); await one.configure(fault); const failed = await send(env('ALLOCATE_COST', id, version, allocation(company, 1000, nextMonth)), 503); assert(!JSON.stringify(failed).includes('QA_PRIVATE')); await one.configure(null); assert.equal(await prisma.expenseAllocation.count(), count); assert.equal((await get()).version, version); }
  await one.configure('read'); await api('/costs?monthRef=' + monthRef, null, 503); await one.configure(null);
  for (const q of ['monthRef=2004-13', 'monthRef=' + monthRef + '&page=01', 'monthRef=' + monthRef + '&mode=TARGETS', 'monthRef=' + monthRef + '&mode=CLIENTS&clientId=1']) await api('/costs?' + q, null, 400);
  await send(env('ALLOCATE_COST', id, (await get()).version, allocation(company, 1.5)), 400);
  const beforeRegular = await prisma.serviceVisit.findUniqueOrThrow({ where: { id: regular.id } }), beforeExtra = await prisma.extraVisit.findUniqueOrThrow({ where: { id: extra.id } });
  const stock = await send(env('CREATE', null, null, manual({ title: 'Stock purchase allocation QA', category: 'STOCK', amountCents: 1500 }))); const stockCost = await send(env('ALLOCATE_COST', stock.expenseId, stock.version, allocation(ca, 1500))); assert(stockCost.applied);
  const summary = (await api('/costs?monthRef=' + monthRef)).summary; assert.equal(summary.stockPurchaseAmountCents, 1500); assert.equal(summary.completeOperatingCosts, false); assert.equal(summary.profit, null);
  const more = await prisma.client.createManyAndReturn({ data: Array.from({ length: 12 }, (_, i) => ({ name: 'Cost pagination ' + stamp + ' ' + i })) }), bulk = await send(env('CREATE', null, null, manual({ title: 'Pagination expense', amountCents: 1200 })));
  let version = bulk.version; for (const client of more) { const result = await send(env('ALLOCATE_COST', bulk.expenseId, version, allocation(await target('CLIENT', client.id), 100))); assert(result.applied); version = result.version; }
  const firstPage = await api('/costs?monthRef=' + monthRef), secondPage = await api('/costs?monthRef=' + monthRef + '&page=2'); assert.equal(firstPage.rows.length, 10); assert(firstPage.total > 10); assert.equal(secondPage.summary.allocatedAmountCents, firstPage.summary.allocatedAmountCents); assert.equal(firstPage.summary.allocatedAmountCents, 12700); assert.equal(firstPage.summary.topClients.length, 10); assert.equal(firstPage.summary.sampleOnly, true);
  const ai = await fetch(one.base + '/api/ai-admin/chat', {method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({message:'Que custos e despesas estão atribuídos aos clientes? Qual o lucro?',monthRef,scope:'finance'})}).then(r=>r.json());
  assert.equal(ai.ok,true);assert.equal(ai.finance.expenses.attribution.allocatedAmountCents,12700);assert.match(ai.answer,/Despesas atribuídas no mês/);assert.match(ai.answer,/Não posso calcular lucro/);assert.deepEqual(ai.actions,[]);
  const report = await fetch(process.env.CW_BASE_URL + '/api/finance-os/reports/customer-profitability?monthRef=' + monthRef,{headers:auth}).then(r=>r.json());
  const reportedA = report.clients.find(row=>row.clientId===a.id);assert.equal(reportedA.registeredExpenseAmountCents,(first.allocation.clientId===a.id?6000:0)+3500);assert.equal(reportedA.profitability,null);assert.equal(reportedA.expenseCostCoverage,'REGISTERED_EXPENSE_ATTRIBUTION');
  const anonymous = await fetch(one.base+'/api/expenses/costs?monthRef='+monthRef);assert.equal(anonymous.status,401);assert.match(anonymous.headers.get('cache-control'),/no-store/);
  assert.deepEqual(await prisma.serviceVisit.findUniqueOrThrow({ where: { id: regular.id } }), beforeRegular); assert.deepEqual(await prisma.extraVisit.findUniqueOrThrow({ where: { id: extra.id } }), beforeExtra);
  console.log('PASS expense cost attribution: bounded budget across clients/months, typed regular/extra identities, concurrent writes and exact receipts, duplicate prevention, corrections and stale expense/target review, inactive historical clients, atomic rollback, full totals/pagination and explicit partial coverage without profit');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const child of children) child.kill('SIGTERM'); await prisma.$disconnect(); });
