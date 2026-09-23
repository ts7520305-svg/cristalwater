'use strict';
const { prisma } = require('../prismaClient'), { roleMatches } = require('../utils/roles');
const r = require('./expenseLedgerRules'), writes = require('./fieldWriteRequestService'), integrity = require('./laborCostCompositionIntegrity');
const valuation = require('./expenseValuationService'), targets = require('./expenseCostTargets');
const { json, hash, same } = integrity, scope = 'LABOR_COST_COMPOSITION';
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const read = work => prisma.$transaction(work, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
const record = row => { const { parts, ...raw } = row; return json(raw); };
function actor(user) { if (!roleMatches(user?.role, 'ADMIN')) r.fail('Acesso reservado à administração.', 403); return { id: r.id(user.userId || user.id), owner: writes.owner(user) }; }
function componentIds(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20 || value.some((id,i) => !Number.isSafeInteger(id) || id <= 0 || id > 2147483647 || i && id <= value[i-1])) r.fail('Escolha entre duas e vinte despesas diferentes, por ordem de identificador.');
  return value;
}
async function basisPreview(db, expenseIds, lock = false) {
  componentIds(expenseIds);
  const expenses = await integrity.expensesFor(db, { components: expenseIds.map(expenseId => ({ expenseId })) }, lock);
  const snapshot = integrity.facts(expenses), result = { version: 1, snapshot, fingerprint: hash(snapshot), expenseVersions: expenses.map(e => ({ expenseId: e.id, version: e.version })), technicianName: expenses[0].laborBasis.technician.name };
  return { ...result, hash: hash(result) };
}
async function valuePreview(db, basisId, choice, lock = false) {
  let basis = await db.laborCostBasis.findUnique({ where: { id: basisId } });
  if (!basis) r.fail('Base composta não encontrada.', 404);
  const expenses = await integrity.expensesFor(db, basis.snapshot, lock);
  if (lock) { await db.$queryRaw`SELECT id FROM "LaborCostBasis" WHERE id=${basisId} FOR UPDATE`; basis = await db.laborCostBasis.findUnique({ where: { id: basisId } }); }
  if ((await integrity.inspectBasis(db, basis, expenses)).state !== 'CONFIRMED') r.fail('Reveja a composição e os documentos antes de valorizar.', 409);
  const components = [];
  // Calculate every component before inserting any reservation. The first call
  // acquires the existing typed measurement/repair-work locks for the whole group.
  for (const expense of expenses) {
    try { components.push(await valuation.preview(db, expense, choice, lock)); }
    catch (error) { if (error.status === 409) r.fail('Despesa #' + expense.id + ': ' + error.message, 409); throw error; }
  }
  const first = components[0];
  if (components.some(p => !['targetType','targetId','targetHash','clientId','monthRef','quantity','quantityUnit','valuationKey'].every(k => p[k] === first[k]))) r.fail('Os documentos já não correspondem ao mesmo intervalo.', 409);
  const amountCents = components.reduce((n,p) => n + p.amountCents, 0); r.money(amountCents);
  const value = { version: 1, basisId, basisFingerprint: basis.fingerprint, basisSnapshot: basis.snapshot, choice, targetType: first.targetType, targetId: first.targetId, clientId: first.clientId, monthRef: first.monthRef, quantity: first.quantity, quantityUnit: first.quantityUnit, amountCents, components };
  return { ...value, hash: hash(value) };
}
async function candidates(query) {
  r.object(query, ['q','page']); const q = r.text(query.q || '', 160), page = r.queryId(query.page || '1');
  return read(async db => {
    const rows = await db.companyExpense.findMany({ where: { category: 'LABOR', sourceType: 'MANUAL', cancelledAt: null, laborBasis: { isNot: null }, laborDistributions: { none: { voidedAt: null } }, ...(q ? { OR: ['title','supplierName','documentNumber'].map(key => ({ [key]: { contains: q, mode: 'insensitive' } })) } : {}) }, include: integrity.include, orderBy: { id: 'desc' }, skip: (page-1)*10, take: 11 });
    return { ok: true, page, q, hasMore: rows.length > 10, rows: rows.slice(0,10).map(e => ({ expenseId: e.id, version: e.version, title: e.title, documentNumber: e.documentNumber, amountCents: e.amountCents, technicianName: e.laborBasis.technician.name, basis: valuation.data.laborBasis(e.laborBasis) })) };
  });
}
async function list(query) {
  r.object(query, ['page']); const page = r.queryId(query.page || '1');
  return read(async db => {
    const rows = await db.laborCostBasis.findMany({ orderBy: { id: 'desc' }, skip: (page-1)*10, take: 11 });
    const result = []; for (const row of rows.slice(0,10)) result.push({ ...record(row), recordHash: hash(record(row)), ...await integrity.inspectBasis(db, row) });
    return { ok: true, page, hasMore: rows.length > 10, rows: result };
  });
}
async function detail(id, query = {}) {
  r.id(id); r.object(query, ['page']); const page = r.queryId(query.page || '1');
  return read(async db => {
    const basis = await db.laborCostBasis.findUnique({ where: { id } }); if (!basis) r.fail('Base composta não encontrada.', 404);
    const groups = await db.laborCostValuation.findMany({ where: { basisId: id }, include: { parts: true }, orderBy: { id: 'desc' }, skip: (page-1)*10, take: 11 });
    const states = await integrity.inspectGroups(db, groups.slice(0,10));
    return { ok: true, basis: { ...record(basis), recordHash: hash(record(basis)), ...await integrity.inspectBasis(db, basis) }, page, hasMore: groups.length > 10, groups: groups.slice(0,10).map(g => ({ ...record(g), recordHash: hash(record(g)), ...states.get(g.id) })) };
  });
}
function envelope(body) {
  r.object(body, ['requestId','resourceId','command','data']); r.id(body.resourceId);
  const d = body.data; r.object(d, ['expenseIds','choice','previewHash','recordHash','groupId','reason','confirmed']);
  if (d.confirmed !== true || !['CREATE','VALUE','VOID_BASIS','VOID_VALUE'].includes(body.command)) r.fail('Reveja e confirme o pedido.');
  r.text(d.reason, 500, true);
  if (body.command === 'CREATE') { r.object(d,['expenseIds','previewHash','reason','confirmed']); componentIds(d.expenseIds); if (body.resourceId !== d.expenseIds[0] || !sha(d.previewHash)) r.fail('Reveja os documentos da composição.'); }
  if (body.command === 'VALUE') { r.object(d,['choice','previewHash','reason','confirmed']); r.object(d.choice,['kind','targetType','targetId','purchaseItemId','quantity','workIntervalId']); if (d.choice.kind !== 'LABOR' || d.choice.quantity !== null || d.choice.purchaseItemId !== null || !sha(d.previewHash) || !same(valuation.selection(d.choice), d.choice)) r.fail('Reveja o intervalo e a valorização completa.'); }
  if (body.command.startsWith('VOID_')) { r.object(d,body.command==='VOID_VALUE'?['groupId','recordHash','reason','confirmed']:['recordHash','reason','confirmed']); if (!sha(d.recordHash)) r.fail('Consulte o registo antes de anular.'); if(body.command==='VOID_VALUE')r.id(d.groupId); }
  return json({ command: body.command, data: d });
}
async function apply(db, who, resourceId, payload) {
  const { command, data: d } = payload, reason = r.text(d.reason, 500, true);
  if (command === 'CREATE') {
    const preview = await basisPreview(db, d.expenseIds, true); if (preview.hash !== d.previewHash) r.fail('Os documentos ou as bases mudaram. Calcule e reveja novamente.', 409);
    const activeKey = r.hash(d.expenseIds); await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'labor-cost-basis:' + activeKey }))::text`;
    if (await db.laborCostBasis.findUnique({ where: { activeKey } })) r.fail('Estes documentos já têm uma composição ativa.', 409);
    const basis = await db.laborCostBasis.create({ data: { snapshot: preview.snapshot, fingerprint: preview.fingerprint, technicianName: preview.technicianName, activeKey, reason, createdBy: who.owner } });
    return { basis: record(basis), recordHash: hash(record(basis)), preview };
  }
  if (command === 'VALUE') {
    const preview = await valuePreview(db, resourceId, d.choice, true); if (preview.hash !== d.previewHash) r.fail('O intervalo, os documentos ou os saldos mudaram. Calcule e reveja novamente.', 409);
    const group = await db.laborCostValuation.create({ data: { basisId: resourceId, snapshot: {}, fingerprint: '0'.repeat(64), reason, createdBy: who.owner } });
    const marker = { version: 1, basisId: resourceId, basisFingerprint: preview.basisFingerprint, groupId: group.id, primaryExpenseId: preview.components[0].expenseId, expenseIds: preview.components.map(p => p.expenseId) };
    const target = await targets.get(db, preview.targetType, preview.targetId), parts = [];
    for (const p of preview.components) {
      const snapshot = preview.basisSnapshot.components.find(c => c.expenseId === p.expenseId).expense;
      const measurement = 'LABOR:' + p.targetType + ':' + p.targetId + (p.workIntervalId ? ':INTERVAL:' + p.workIntervalId : '');
      const a = await db.expenseAllocation.create({ data: { expenseId: p.expenseId, monthRef: p.monthRef, amountCents: p.amountCents, targetType: p.targetType, clientId: p.clientId, visitId: p.targetType==='REGULAR'?p.targetId:null, extraVisitId: p.targetType==='EXTRA'?p.targetId:null, repairId: p.targetType==='REPAIR'?p.targetId:null, targetHash: p.targetHash, targetSnapshot: target.snapshot, expenseHash: hash(snapshot), expenseSnapshot: snapshot, activeKey: r.hash({ expenseId: p.expenseId, monthRef: p.monthRef, type: p.targetType, id: p.targetId, valuationType: 'LABOR', purchaseItemId: null, ...(p.workIntervalId ? {workIntervalId:p.workIntervalId} : {}) }), reason, createdById: who.id,
        valuationType: 'LABOR', valuationKey: p.valuationKey, valuationHash: p.valuationHash, valuationSnapshot: { source: p.source, calculation: p.calculation, composition: marker }, quantity: p.quantity, quantityUnit: 'SECOND', purchaseItemId: null, activeMeasurementKey: measurement + (p.expenseId === marker.primaryExpenseId ? '' : ':COMPONENT:' + p.expenseId) } });
      parts.push(integrity.allocationFacts(a));
      await db.laborCostValuationPart.create({ data: { groupId: group.id, allocationId: a.id, expenseId: a.expenseId } });
      await db.companyExpense.update({ where: { id: p.expenseId }, data: { version: { increment: 1 } } });
    }
    const snapshot = { version: 1, basisId: resourceId, basisFingerprint: preview.basisFingerprint, preview, parts };
    const saved = await db.laborCostValuation.update({ where: { id: group.id }, data: { snapshot, fingerprint: hash(snapshot) } });
    return { group: record(saved), recordHash: hash(record(saved)), preview };
  }
  const basis = await db.laborCostBasis.findUnique({ where: { id: resourceId } }); if (!basis) r.fail('Base composta não encontrada.', 409);
  // Cancellation remains possible when source facts change; lock original IDs.
  for (const id of componentIds(integrity.ids(basis.snapshot))) await db.$queryRaw`SELECT id FROM "CompanyExpense" WHERE id=${id} FOR UPDATE`;
  await db.$queryRaw`SELECT id FROM "LaborCostBasis" WHERE id=${resourceId} FOR UPDATE`;
  const current = command==='VOID_BASIS' ? await db.laborCostBasis.findUnique({where:{id:resourceId}}) : await db.laborCostValuation.findUnique({where:{id:d.groupId},include:{parts:true}});
  if (!current || current.voidedAt || command==='VOID_VALUE' && current.basisId!==resourceId || hash(record(current))!==d.recordHash) r.fail('O registo mudou ou já foi anulado. Consulte o histórico.',409);
  if (command==='VOID_BASIS' && await db.laborCostValuation.count({where:{basisId:resourceId,voidedAt:null}})) r.fail('Anule primeiro as valorizações desta composição.',409);
  const changes = { voidedAt: new Date(), voidedBy: who.owner, voidReason: reason };
  if (command==='VOID_BASIS') {
    const saved = await db.laborCostBasis.update({where:{id:resourceId},data:{...changes,activeKey:null}});
    return { basis: record(saved), before: record(current), recordHash: hash(record(saved)) };
  }
  const p=current.snapshot.preview;
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-valuation:' + p.targetType + ':' + p.targetId }))::text`;
  const allocations = await db.expenseAllocation.findMany({where:{id:{in:current.parts.map(x=>x.allocationId)}}});
  if (allocations.length !== current.parts.length || !same(current.parts.map(x=>x.allocationId).sort((a,b)=>a-b),current.snapshot.parts.map(x=>x.id).sort((a,b)=>a-b)) || allocations.some(a=>a.voidedAt||!integrity.ids(basis.snapshot).includes(a.expenseId))) r.fail('As parcelas estão incompletas. É necessária revisão antes da anulação.',409);
  for (const a of allocations) {
    await db.expenseAllocation.update({where:{id:a.id},data:{voidedAt:changes.voidedAt,voidReason:reason,activeKey:null,activeMeasurementKey:null}});
    await db.companyExpense.update({where:{id:a.expenseId},data:{version:{increment:1}}});
  }
  const saved=await db.laborCostValuation.update({where:{id:current.id},data:changes});
  return { group: record(saved), before: record(current), recordHash: hash(record(saved)) };
}
async function command(user, body) {
  const who=actor(user),payload=envelope(body),request=writes.context(user,scope,body.resourceId,body.requestId,payload);
  return prisma.$transaction(async db=>{
    const account=await db.user.findUnique({where:{id:who.id},select:{role:true,active:true}});if(!account?.active||!roleMatches(account.role,'ADMIN'))r.fail('Acesso reservado à administração.',403);
    const previous=await writes.recover(db,request);if(previous)return previous;
    let outcome;
    try { outcome={applied:true,...await apply(db,who,body.resourceId,payload)}; }
    catch(error){if(error.status!==409&&error.status!==404)throw error;outcome={applied:false,code:'COMPOSITION_REVIEW',message:error.message};}
    return writes.confirm(db,request,{ok:true,context:payload,...outcome});
  },{timeout:30000,maxWait:15000});
}
async function receipt(user, requestId, query) {
  actor(user);r.object(query,['resourceId','payloadHash']);const resourceId=r.queryId(query.resourceId);if(!sha(query.payloadHash))r.fail('Pedido inválido.');
  const context=writes.context(user,scope,resourceId,requestId,{}),saved=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner:context.owner,requestId:context.requestId}}});
  if(!saved)return{ok:true,found:false};if(saved.scope!==scope||saved.resourceId!==resourceId||saved.payloadHash!==query.payloadHash)r.fail('O identificador pertence a outro pedido.',409);
  return{ok:true,found:true,result:saved.response};
}
module.exports={scope,record,componentIds,basisPreview,valuePreview,candidates,list,detail,command,receipt,read};
