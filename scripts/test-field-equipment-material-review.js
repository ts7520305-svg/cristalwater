'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const jwt = require('jsonwebtoken'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const r = require('../src/services/fieldWriteRequestService'), scope = 'EQUIPMENT_MATERIAL_REVIEW';
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const children = []; let f, labor, browser, otherAdmin;
async function server() { const child = fork(require.resolve('./fixtures/expense-server'), [], { stdio:['ignore','ignore','inherit','ipc'] }); children.push(child); const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); }); return { base, configure:fault => new Promise(resolve => { child.once('message', resolve); child.send({ fault }); }) }; }
async function cleanup() {
  for (const fixture of [f,labor].filter(Boolean)) {
    const ids = (await prisma.equipmentMaintenanceCompletion.findMany({ where:{ plan:{ poolId:fixture.pool.id } },select:{ id:true } })).map(row => row.id);
    await prisma.fieldWriteRequest.deleteMany({ where:{ scope,resourceId:{ in:ids } } });
    await prisma.userAuditLog.deleteMany({ where:{ action:scope,entityId:{ in:ids.map(String) } } });
    await prisma.technicalHistory.deleteMany({ where:{ type:scope,poolId:fixture.pool.id } }); await fixture.cleanup();
  }
  f = null; labor = null;
  if (otherAdmin) { await prisma.user.delete({ where:{ id:otherAdmin.id } }); otherAdmin = null; }
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where:{ email:process.env.ADMIN_EMAIL } }), token = jwt.sign({ id:admin.id,userId:admin.id,principalType:'USER',role:'ADMIN' }, getJwtSecret(), { expiresIn:'1h' });
  f = await require('./fixtures/maintenance-material-data')(admin); const one = await server(), two = await server();
  async function api(url, body, status = 200, server = one, credential = token) { const response = await fetch(server.base + url, { method:body ? 'POST' : 'GET',headers:{ ...(credential ? { Authorization:'Bearer ' + credential } : {}),...(body ? { 'Content-Type':'application/json' } : {}) },body:body ? JSON.stringify(body) : undefined }); const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value; }
  const base = id => '/api/equipment-maintenance/completions/' + id;
  const detail = id => api(base(id) + '/materials').then(v => v.declaration);
  const material = q => ({ mode:'DECLARED',items:[{ productName:f.product.name.toUpperCase(),unit:'KG',quantity:q }] });
  const preview = (id, q, action = 'REPLACE') => api(base(id) + '/material-preview', { action,materials:action === 'WITHDRAW' ? null : q === 'NONE' ? { mode:'NONE',items:[] } : material(q) }).then(v => v.preview);
  const command = p => ({ requestId:randomUUID(),action:p.proposed.action,materials:p.proposed.record ? { mode:p.proposed.record.mode,items:p.proposed.record.items } : null,previewHash:p.hash,reason:'Corrigir após conferência dos materiais',confirmed:true });
  const send = (id, body, status = 200, server = one) => api(base(id) + '/material-review', body, status, server);
  const cid = f.reviews[0].id, sibling = f.reviews[1].id, original = await prisma.equipmentMaintenanceCompletion.findUniqueOrThrow({ where:{ id:cid } });
  await api(base(cid) + '/materials', null, 401, one, null);
  const tech = jwt.sign({ id:f.tech.id,technicianId:f.tech.id,role:'TECHNICIAN' }, getJwtSecret(), { expiresIn:'1h' });
  await api(base(cid) + '/materials', null, 403, one, tech); await api(base(cid) + '/material-preview', { action:'REPLACE',materials:material('0.2') }, 403, one, tech);
  assert((await detail(cid)).editable); assert.equal((await detail(f.none.id)).current.state, 'NONE'); assert.equal((await detail(f.missing[0].id)).current.state, 'MISSING');
  assert.equal((await preview(cid, '0.1')).code, 'NO_CHANGE');
  for (const input of [{ mode:'DECLARED',items:[] },{ mode:'NONE',items:[{ productName:f.product.name,unit:'KG',quantity:'1' }] },material('-1'),material('0.0000001'),material('100001')]) await api(base(cid) + '/material-preview', { action:'REPLACE',materials:input }, 400);
  await api(base(cid) + '/material-preview', { action:'WITHDRAW',materials:material('0.1') }, 400);
  const a = await f.value(await f.purchase()), b = await f.value(await f.purchase(2));
  async function share(allocation, id, quantity) {
    const p = (await api('/api/expenses/' + allocation.expenseId + '/maintenance-material-preview?' + new URLSearchParams({ allocationId:allocation.id,completionId:id,quantity }))).preview; assert(p.available, JSON.stringify(p));
    return f.send('SHARE_MAINTENANCE_MATERIAL', allocation.expenseId, { allocationId:allocation.id,completionId:id,quantity:p.quantity,amountCents:p.amountCents,previewHash:p.hash,reason:'Parcela confirmada antes da correção',confirmed:true });
  }
  const shares = [await share(a, cid, '0.05'), await share(b, sibling, '0.05')]; assert(shares.every(s => s.applied));
  const stockBefore = r.hash(await f.stock()), originals = r.hash(await prisma.equipmentMaintenanceCompletion.findMany({ where:{ plan:{ poolId:f.pool.id } },orderBy:{ id:'asc' } }));
  const expenseBefore = r.hash(await prisma.companyExpense.findMany({ where:{ id:{ in:f.expenseIds } },include:{ expenseAllocations:true,payments:true },orderBy:{ id:'asc' } }));
  const p = await preview(cid, '0.2'); assert(p.available, JSON.stringify(p)); assert.equal(p.afterState, 'MATCHED'); assert.equal(p.affectedShares.length, 2); assert(p.affectedShares.some(s => s.completionId === sibling && s.expenseId === b.expenseId));
  const body = command(p), repeated = await Promise.all([send(cid, body), send(cid, body, 200, two)]); assert(repeated.every(v => v.applied)); assert.deepEqual(repeated[0], repeated[1]);
  assert.equal(await prisma.fieldWriteRequest.count({ where:{ scope,requestId:body.requestId } }), 1); assert.equal(await prisma.userAuditLog.count({ where:{ action:scope,metadata:{ path:['requestId'],equals:body.requestId } } }), 1);
  await send(cid, { ...body,reason:'Um motivo diferente' }, 409);
  const current = await detail(cid); assert.equal(current.current.record.items[0].quantity, '0.2'); assert.equal(current.original.record.items[0].quantity, '0.1'); assert.equal(current.history.length, 1); assert.equal(current.history[0].revision.owner, 'ADMIN:' + admin.id);
  const field = await api('/api/equipment-maintenance/visits/' + f.sameId + '?visitType=REGULAR'); assert.equal(field.plans.find(p => p.completion?.id === cid).completion.materials.record.items[0].quantity, '0.2');
  for (const allocation of [a,b]) { const expense = (await api('/api/expenses/' + allocation.expenseId)).expense; assert(expense.allocations[0].maintenanceMaterialShareReview); assert(expense.allocations[0].maintenanceMaterialShares.some(s => s.needsReview)); }
  assert.equal(r.hash(await f.stock()), stockBefore); assert.equal(r.hash(await prisma.equipmentMaintenanceCompletion.findMany({ where:{ plan:{ poolId:f.pool.id } },orderBy:{ id:'asc' } })), originals); assert.equal(r.hash(await prisma.companyExpense.findMany({ where:{ id:{ in:f.expenseIds } },include:{ expenseAllocations:true,payments:true },orderBy:{ id:'asc' } })), expenseBefore);
  assert.deepEqual((await api('/api/equipment-maintenance/material-review-requests/' + body.requestId)), repeated[0]);
  otherAdmin = await prisma.user.create({ data:{ email:'material-review-' + randomUUID() + '@qa.test',password:randomUUID(),role:'ADMIN',name:'QA other administrator' } });
  const other = jwt.sign({ id:otherAdmin.id,userId:otherAdmin.id,principalType:'USER',role:'ADMIN' }, getJwtSecret(), { expiresIn:'1h' }); await api('/api/equipment-maintenance/material-review-requests/' + body.requestId, null, 404, one, other);
  const stale = command(await preview(cid, '0.25')); assert((await send(cid, command(await preview(cid, null, 'WITHDRAW')))).applied); const refused = await send(cid, stale); assert.equal(refused.code, 'PREVIEW_CHANGED'); assert.deepEqual(await send(cid, stale), refused);
  assert.equal((await detail(cid)).current.state, 'WITHDRAWN'); assert.equal((await preview(cid, null, 'WITHDRAW')).code, 'NO_CHANGE'); assert((await send(cid, command(await preview(cid, 'NONE')))).applied); assert.equal((await detail(cid)).current.state, 'NONE');
  const poor = await preview(cid, '100'); assert.equal(poor.afterState, 'REVIEW'); assert(poor.afterReasons.includes('DECLARATIONS_EXCEED_NET_CONSUMPTION'));
  const missing = f.missing[0].id; assert((await send(missing, command(await preview(missing, '0.1')))).applied); assert.equal((await detail(missing)).original.record, null); assert.equal((await detail(missing)).current.state, 'MATCHED');
  // Equal numeric regular/extra IDs remain independent, including source changes.
  const extra = await preview(f.extraReview.id, '0.2'); assert.equal(extra.affectedShares.length, 0); assert.equal(extra.origin.visitType, 'EXTRA'); assert((await send(f.extraReview.id, command(extra))).applied);
  const raceA = command(await preview(cid, '0.1')), raceB = command(await preview(cid, '0.15')), raced = await Promise.all([send(cid, raceA), send(cid, raceB, 200, two)]); assert.equal(raced.filter(v => v.applied).length, 1); assert.equal(raced.filter(v => v.code === 'PREVIEW_CHANGED').length, 1);
  const next = command(await preview(cid, '0.2')), beforeCount = await prisma.technicalHistory.count({ where:{ poolId:f.pool.id,type:scope } });
  for (const fault of ['composition-receipt','equipment-audit','material-history']) { await one.configure(fault); await send(cid, next, 503); await one.configure(null); assert.equal(await prisma.fieldWriteRequest.count({ where:{ scope,requestId:next.requestId } }), 0); assert.equal(await prisma.technicalHistory.count({ where:{ poolId:f.pool.id,type:scope } }), beforeCount); }
  assert((await send(cid, next)).applied);
  const staleStock = command(await preview(cid, '0.25')), returned = await f.movement('REGULAR', f.sameId, 0.01, 'RETURN'); assert.equal((await send(cid, staleStock)).code, 'PREVIEW_CHANGED'); await prisma.stockMovement.delete({ where:{ id:returned.id } });
  const corrupted = await prisma.fieldWriteRequest.findUniqueOrThrow({ where:{ owner_requestId:{ owner:'ADMIN:' + admin.id,requestId:body.requestId } } }); await prisma.fieldWriteRequest.update({ where:{ id:corrupted.id },data:{ payloadHash:'f'.repeat(64) } });
  assert.equal((await detail(cid)).current.state, 'REVIEW'); assert.equal((await preview(cid, '0.25')).code, 'MATERIAL_SOURCE_REVIEW'); assert((await api('/api/expenses/' + b.expenseId)).expense.allocations[0].needsReview); await prisma.fieldWriteRequest.update({ where:{ id:corrupted.id },data:{ payloadHash:corrupted.payloadHash } });
  await prisma.equipmentMaintenanceCompletion.update({ where:{ id:cid },data:{ result:{ ...original.result,completion:{ ...original.result.completion,materials:{ mode:'NONE',items:[] } } } } }); assert.equal((await detail(cid)).editable, false); await prisma.equipmentMaintenanceCompletion.update({ where:{ id:cid },data:{ result:original.result } });
  await prisma.serviceVisit.update({ where:{ id:f.sameId },data:{ clientId:f.other.id } }); assert.equal((await preview(cid, '0.25')).code, 'MATERIAL_SOURCE_REVIEW'); assert.deepEqual(await api('/api/equipment-maintenance/material-review-requests/' + body.requestId), repeated[0]); await prisma.serviceVisit.update({ where:{ id:f.sameId },data:{ clientId:f.client.id } });
  for (const s of shares) assert((await f.send('VOID_MAINTENANCE_MATERIAL_SHARE', s.expenseId, { allocationId:s.share.allocationId,shareId:s.share.id,shareHash:s.shareHash,reason:'Repor parcela após correção explícita',confirmed:true })).applied);
  const materialPreview = (await api('/api/expenses/' + a.expenseId + '/maintenance-material-preview?' + new URLSearchParams({ allocationId:a.id,completionId:cid,quantity:'0.05' }))).preview; assert(materialPreview.available);
  const materialRequest = { requestId:randomUUID(),command:'SHARE_MAINTENANCE_MATERIAL',expenseId:a.expenseId,expectedVersion:materialPreview.expenseVersion,data:{ allocationId:a.id,completionId:cid,quantity:materialPreview.quantity,amountCents:materialPreview.amountCents,previewHash:materialPreview.hash,reason:'Concorrência com correção de declaração',confirmed:true } };
  const correctionRace = command(await preview(cid, '0.25'));
  const crossRace = await Promise.all([api('/api/expenses/commands', materialRequest, 200, two),send(cid, correctionRace)]); assert.equal(crossRace.filter(v => v.applied).length, 1); assert.equal(crossRace.filter(v => v.code === 'PREVIEW_CHANGED').length, 1);
  if (crossRace[0].applied) { const s = crossRace[0]; assert((await f.send('VOID_MAINTENANCE_MATERIAL_SHARE', s.expenseId, { allocationId:s.share.allocationId,shareId:s.share.id,shareHash:s.shareHash,reason:'Repor parcela do ensaio concorrente',confirmed:true })).applied); }
  if ((await detail(cid)).current.record.items[0].quantity !== '0.2') assert((await send(cid, command(await preview(cid, '0.2')))).applied);
  assert.deepEqual(await require('../src/business/equipment/EquipmentMaintenanceBusiness').complete(admin, original.planId, { requestId:original.requestId,visitType:'REGULAR',visitId:f.sameId,poolId:f.pool.id,expectedVersion:original.version,notes:original.notes,confirmed:true,materials:{ mode:'DECLARED',items:[{ productName:f.product.name,unit:'kg',quantity:'0.1' }] } }), original.result);
  // A new declaration on a completion with original work time must leave the
  // existing labor share, commercial destination and source receipt intact.
  labor = await require('./fixtures/maintenance-labor-data')(admin); const salary = await labor.salary(), la = await labor.value(salary), lc = labor.reviews[0].id;
  const lp = (await require('../src/services/expenseLedgerService').maintenanceLabor(salary, { allocationId:String(la.id),completionId:String(lc) }, true)).preview;
  assert(lp.available, JSON.stringify(lp)); const ls = await labor.send('SHARE_MAINTENANCE_LABOR', salary, { allocationId:la.id,completionId:lc,previewHash:lp.hash,amountCents:lp.amountCents,reason:'Tempo próprio e parcela conferidos',confirmed:true }); assert(ls.applied);
  const laborBefore = (await api('/api/expenses/' + salary)).expense.allocations[0], targetBefore = await require('../src/services/expenseMaintenanceTargets').get(prisma, 'MAINTENANCE_EQUIPMENT', lc);
  assert((await send(lc, command(await preview(lc, 'NONE')))).applied); assert.deepEqual((await api('/api/expenses/' + salary)).expense.allocations[0], laborBefore); assert.deepEqual(await require('../src/services/expenseMaintenanceTargets').get(prisma, 'MAINTENANCE_EQUIPMENT', lc), targetBefore);
  await require('./fixtures/equipment-material-review-browser')({ one,f,token,admin,prisma,api,detail,preview,command,send,open:value => { browser = value; } });
  assert.equal(r.hash(await f.stock()), stockBefore); await cleanup();
  console.log('PASS equipment material review: immutable originals, explicit correction/none/withdrawal, recovered exact receipts, history and source integrity, sibling/cross-document material cost review, unchanged labor shares and commercial sources, admin permissions, independent typed parents, two-process races and stale previews, atomic receipt/audit/history rollback, real browser drafts/recovery/forged replies/session isolation/layout');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); for (const child of children) child.kill('SIGTERM'); await cleanup(); await prisma.$disconnect(); });
