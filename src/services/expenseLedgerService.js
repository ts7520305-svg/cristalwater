'use strict';
const { prisma } = require('../prismaClient');
const { roleMatches } = require('../utils/roles');
const { period } = require('./operationalValueReportService');
const { sum } = require('./monthlyFinancialProjection');
const r = require('./expenseLedgerRules'), sources = require('./expenseSourceService'), costs = require('./expenseCostAllocationService');
const valuation = require('./expenseValuationService');
const evidenceSelect = { id: true, expenseId: true, name: true, mime: true, size: true, sha256: true, createdAt: true, voidedAt: true, voidReason: true };
const include = { ...require('./expenseLaborDistributionService').include, laborBasis: { include: { technician: { select: { id: true, name: true, active: true } } } }, expenseAllocations: { orderBy: { id: 'asc' } }, payments: { orderBy: { id: 'asc' } }, evidence: { select: evidenceSelect, orderBy: { id: 'asc' } } };
const json = value => JSON.parse(JSON.stringify(value));
function actor(user) {
  if (!roleMatches(user?.role, 'ADMIN')) r.fail('Acesso reservado à administração.', 403);
  return { id: r.id(user.userId || user.id), name: String(user.name || user.email || 'ADMIN').slice(0, 180) };
}
function view(row, hashes) {
  const paid = sum(row.payments.filter(p => !p.reversedAt).map(p => p.amountCents));
  const sourceId = row.stockPurchaseId || row.maintenanceId;
  const sourceChanged = row.sourceType !== 'MANUAL' && hashes.get(row.sourceType + ':' + sourceId) !== row.sourceHash;
  const valid = Number.isSafeInteger(row.amountCents) && row.amountCents > 0 && paid !== null && paid >= 0 && paid <= row.amountCents && (!row.cancelledAt || paid === 0);
  return { ...row, expenseDate: r.day(row.expenseDate), dueDate: r.day(row.dueDate), payments: row.payments.map(p => ({ ...p, paidOn: r.day(p.paidOn) })), sourceId, sourceChanged, needsReview: sourceChanged || !valid, paidCents: valid ? paid : null, openCents: valid ? row.cancelledAt ? 0 : row.amountCents - paid : null, status: row.cancelledAt ? 'CANCELLED' : !valid ? 'REVIEW' : paid === row.amountCents ? 'PAID' : paid ? 'PARTIAL' : 'OPEN' };
}
async function rows(db) {
  const expenses = await db.companyExpense.findMany({ include, orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }] });
  const hashes = await sources.fingerprints(db, expenses);
  return costs.decorate(db, expenses.map(row => view(row, hashes)));
}
function summarize(expenses, monthRef, generatedAt) {
  const active = expenses.filter(e => !e.cancelledAt), selected = active.filter(e => e.expenseDate.startsWith(monthRef));
  const review = active.filter(e => e.needsReview), due = r.day(generatedAt);
  const payments = expenses.flatMap(e => e.payments).filter(p => !p.reversedAt && p.paidOn.startsWith(monthRef));
  const categories = r.categories.map(category => ({ category, amountCents: selected.some(e => e.category === category && e.needsReview) ? null : sum(selected.filter(e => e.category === category).map(e => e.amountCents)) }));
  return { attribution: costs.summary(expenses, monthRef, generatedAt), version: 1, monthRef, currency: 'EUR', generatedAt: generatedAt.toISOString(), coverage: 'REGISTERED_EXPENSES_ONLY', completeOperatingCosts: false, bankReconciled: false, state: review.length ? 'REVIEW' : 'READY',
    documentAmountCents: selected.some(e => e.needsReview) ? null : sum(selected.map(e => e.amountCents)), documentCount: selected.length,
    paymentsAmountCents: sum(payments.map(p => p.amountCents)), paymentCount: payments.length,
    openAmountCents: review.length ? null : sum(active.map(e => e.openCents)), overdueAmountCents: review.length ? null : sum(active.filter(e => e.dueDate && e.dueDate < due).map(e => e.openCents)),
    openCount: review.length ? null : active.filter(e => e.openCents > 0).length, missingDueDateCount: active.filter(e => e.openCents > 0 && !e.dueDate).length,
    reviewCount: review.length, categories, basis: { documents: 'EXPENSE_DOCUMENT_DATE', payments: 'RECORDED_PAYMENT_DATE', open: 'CURRENT_REGISTERED_OBLIGATIONS' }, limitApplied: null };
}
async function summary(db, monthRef, generatedAt = new Date()) { return summarize(await rows(db), period({ monthRef }).monthRef, generatedAt); }
async function list(query) {
  r.object(query, ['monthRef', 'scope', 'filter', 'q', 'page']);
  const monthRef = period({ monthRef: query.monthRef }).monthRef, scope = query.scope || 'month', filter = query.filter || 'ALL', q = r.text(query.q || '', 160), page = r.queryId(query.page === undefined ? '1' : query.page);
  if (!['month', 'all'].includes(scope) || !['ALL', 'OPEN', 'PAID', 'CANCELLED', 'REVIEW'].includes(filter)) r.fail('Filtro inválido.'); r.id(page);
  return prisma.$transaction(async db => {
    const all = await rows(db), generatedAt = new Date();
    const filtered = all.filter(e => (scope === 'all' || e.expenseDate.startsWith(monthRef)) && (filter === 'ALL' || filter === 'OPEN' && !e.cancelledAt && (e.openCents > 0 || e.needsReview) || filter === 'REVIEW' && (e.needsReview || e.allocationReviewCount > 0) || e.status === filter) && (!q || r.normalized([e.title, e.supplierName, e.documentNumber].join(' ')).includes(r.normalized(q))));
    return { ok: true, monthRef, scope, filter, q, page, pageSize: 10, total: filtered.length, summary: summarize(all, monthRef, generatedAt), rows: filtered.slice((page - 1) * 10, page * 10).map(({ payments, evidence, allocations, sourceSnapshot, ...e }) => ({ ...e, evidenceCount: evidence.filter(f => !f.voidedAt).length })) };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
async function detail(id) {
  r.id(id);
  return prisma.$transaction(async db => {
    const row = await db.companyExpense.findUnique({ where: { id }, include }); if (!row) r.fail('Despesa não encontrada.', 404);
    const [hashes, events] = await Promise.all([sources.fingerprints(db, [row]), db.expenseEvent.findMany({ where: { expenseId: id }, orderBy: { id: 'desc' }, select: { id: true, actorName: true, command: true, createdAt: true, result: true } })]);
    return { ok: true, expense: (await costs.decorate(db, [view(row, hashes)]))[0], events };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
const refused = (code, message, extra = {}) => ({ applied: false, code, message, ...extra });
const small = row => row ? { id: row.id, version: row.version, title: row.title, supplierName: row.supplierName, documentNumber: row.documentNumber, expenseDate: r.day(row.expenseDate), dueDate: r.day(row.dueDate), amountCents: row.amountCents, category: row.category, notes: row.notes, cancelledAt: row.cancelledAt, sourceType: row.sourceType, sourceId: row.stockPurchaseId || row.maintenanceId || null, sourceHash: row.sourceHash, sourceSnapshot: row.sourceSnapshot } : null;
async function expenseValues(db, env, current) {
  const d = env.data, values = r.expenseData(d);
  if (env.command === 'EDIT' && !values.reason) r.fail('Indique o motivo da correção.');
  let source = null;
  if (current && (current.sourceType !== d.sourceType || (current.stockPurchaseId || current.maintenanceId || null) !== d.sourceId)) return refused('SOURCE_CHANGED', 'A origem de uma despesa não pode ser substituída.');
  if (d.supplierId !== null) {
    const supplier = await db.supplierAccount.findUnique({ where: { id: d.supplierId }, select: { name: true } });
    if (!supplier || supplier.name !== values.supplierName) return refused('SUPPLIER_CHANGED', 'Reveja o fornecedor selecionado.');
  }
  if (d.sourceType !== 'MANUAL') {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-source:' + d.sourceType + ':' + d.sourceId }))::text`;
    source = await sources.source(db, d.sourceType, d.sourceId, true);
    if (!source || source.hash !== d.sourceHash) return refused('SOURCE_STALE', 'A origem mudou. Volte a consultar e rever os valores.');
    if (['CANCELLED', 'CANCELED', 'VOID'].includes(String(source.snapshot.status).trim().toUpperCase())) return refused('SOURCE_CANCELLED', 'A origem está anulada. Reveja o documento antes de registar uma despesa.');
    const duplicate = await db.companyExpense.findFirst({ where: { [d.sourceType === 'STOCK_PURCHASE' ? 'stockPurchaseId' : 'maintenanceId']: d.sourceId, ...(current ? { id: { not: current.id } } : {}) }, select: { id: true } });
    if (duplicate) return refused('SOURCE_REGISTERED', 'Esta origem já tem uma despesa registada.', { existingExpenseId: duplicate.id });
    if (source.suggested.amountCents !== values.amountCents && !values.reason) r.fail('Explique o valor confirmado quando difere do montante apurado na origem.');
  }
  const key = r.documentKey(values.supplierName, values.documentNumber);
  if (key) {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-document:' + key }))::text`;
    const duplicate = await db.companyExpense.findUnique({ where: { documentKey: key }, select: { id: true } });
    if (duplicate && duplicate.id !== current?.id) return refused('DOCUMENT_REGISTERED', 'Este fornecedor e número de documento já estão registados.', { existingExpenseId: duplicate.id });
  }
  const { reason, ...data } = values;
  return { data: { ...data, documentKey: key, sourceType: d.sourceType, stockPurchaseId: d.sourceType === 'STOCK_PURCHASE' ? d.sourceId : null, maintenanceId: d.sourceType === 'VEHICLE_MAINTENANCE' ? d.sourceId : null, sourceHash: source?.hash || null, sourceSnapshot: source ? json(source.snapshot) : undefined } };
}
async function apply(db, who, env, file, current) {
  const d = env.data, command = env.command, id = current?.id;
  if (command === 'CREATE' || command === 'EDIT') {
    if (current?.cancelledAt) return refused('CANCELLED', 'Reabra a despesa antes de a corrigir.');
    const parsed = await expenseValues(db, env, current); if (parsed.applied === false) return parsed;
    const paid = current ? sum(current.payments.filter(p => !p.reversedAt).map(p => p.amountCents)) : 0;
    if (paid === null || parsed.data.amountCents < paid) return refused('BELOW_PAYMENTS', 'O total não pode ficar abaixo dos pagamentos válidos. Reveja primeiro os pagamentos.');
    if (current && (costs.allocated(current) === null || parsed.data.amountCents < costs.allocated(current))) return refused('BELOW_ALLOCATIONS', 'O total não pode ficar abaixo das atribuições ativas. Corrija primeiro as atribuições.');
    const expense = current ? await db.companyExpense.update({ where: { id }, data: { ...parsed.data, version: { increment: 1 } } }) : await db.companyExpense.create({ data: { ...parsed.data, createdById: who.id } });
    return { applied: true, expenseId: expense.id, version: expense.version, before: small(current), after: small(expense), reason: d.reason };
  }
  if (command === 'CANCEL' || command === 'REOPEN') {
    r.object(d, ['reason']); const reason = r.text(d.reason, 500, true);
    if (command === 'CANCEL' && costs.live(current).length) return refused('ACTIVE_ALLOCATIONS', 'Anule as atribuições ativas antes de anular esta despesa.');
    if (command === 'CANCEL' && (current.cancelledAt || current.payments.some(p => !p.reversedAt))) return refused('PAYMENTS_OR_CANCELLED', 'Só pode anular uma despesa sem pagamentos válidos.');
    if (command === 'REOPEN' && !current.cancelledAt) return refused('ALREADY_OPEN', 'A despesa já está aberta.');
    const expense = await db.companyExpense.update({ where: { id }, data: { cancelledAt: command === 'CANCEL' ? new Date() : null, version: { increment: 1 } } });
    return { applied: true, expenseId: id, version: expense.version, before: small(current), after: small(expense), reason };
  }
  if (command === 'VOID_LABOR_DISTRIBUTION') return require('./expenseLaborDistributionService').apply(db, who, env, current);
  if (current.cancelledAt) return refused('CANCELLED', 'A despesa está anulada.');
  if (command === 'SET_LABOR_DISTRIBUTION') return require('./expenseLaborDistributionService').apply(db, who, env, current);
  if (['SET_LABOR_BASIS', 'VALUE_MATERIAL', 'VALUE_LABOR'].includes(command)) return valuation.apply(db, who, env, current);
  if (require('./maintenanceLaborShareService').commands.includes(command)) return require('./maintenanceLaborShareService').apply(db, who, env, current);
  if (require('./maintenanceMaterialShareService').commands.includes(command)) return require('./maintenanceMaterialShareService').apply(db, who, env, current);
  if (command === 'CORRECT_COST_PERIOD') return require('./expenseCostPeriodService').apply(db, who, env, current);
  if (['ALLOCATE_COST', 'REVIEW_COST', 'VOID_COST'].includes(command)) return costs.apply(db, who, env, current);
  if (command === 'RECORD_PAYMENT') {
    r.object(d, ['amountCents', 'paidOn', 'method', 'reference']);
    const amountCents = r.money(d.amountCents), paidOn = r.date(d.paidOn), reference = r.text(d.reference, 180);
    if (!['TRANSFER', 'CARD', 'CASH', 'OTHER'].includes(d.method) || d.paidOn > r.day(new Date())) r.fail('Confirme o meio e a data do pagamento já efetuado.');
    if (current.sourceType !== 'MANUAL') {
      const source = await sources.source(db, current.sourceType, current.stockPurchaseId || current.maintenanceId, true);
      if (!source || source.hash !== current.sourceHash) return refused('SOURCE_STALE', 'Reveja a origem alterada antes de registar o pagamento.');
    }
    const paid = sum(current.payments.filter(p => !p.reversedAt).map(p => p.amountCents));
    if (paid === null || paid + amountCents > current.amountCents) return refused('OVERPAYMENT', 'O pagamento excede o saldo por pagar.');
    const payment = await db.expensePayment.create({ data: { expenseId: id, amountCents, paidOn, method: d.method, reference, createdById: who.id } });
    const expense = await db.companyExpense.update({ where: { id }, data: { version: { increment: 1 } } });
    return { applied: true, expenseId: id, version: expense.version, payment: { ...payment, paidOn: r.day(payment.paidOn) } };
  }
  if (command === 'REVERSE_PAYMENT') {
    r.object(d, ['paymentId', 'reason']); r.id(d.paymentId); const reason = r.text(d.reason, 500, true);
    const payment = current.payments.find(p => p.id === d.paymentId);
    if (!payment || payment.reversedAt) return refused('PAYMENT_STATE', 'Pagamento inexistente nesta despesa ou já anulado.');
    await db.expensePayment.update({ where: { id: payment.id }, data: { reversedAt: new Date(), reverseReason: reason } });
    const expense = await db.companyExpense.update({ where: { id }, data: { version: { increment: 1 } } });
    return { applied: true, expenseId: id, version: expense.version, paymentId: payment.id, reason };
  }
  if (command === 'ADD_EVIDENCE') {
    const value = r.evidence(file, d);
    if (current.evidence.some(e => e.sha256 === value.sha256)) return refused('EVIDENCE_EXISTS', 'Este ficheiro já consta do histórico da despesa.');
    if (current.evidence.length >= 20) return refused('EVIDENCE_LIMIT', 'O histórico desta despesa já tem vinte comprovativos.');
    const evidence = await db.expenseEvidence.create({ data: { ...value, expenseId: id, createdById: who.id }, select: evidenceSelect });
    const expense = await db.companyExpense.update({ where: { id }, data: { version: { increment: 1 } } });
    return { applied: true, expenseId: id, version: expense.version, evidence };
  }
  if (command === 'VOID_EVIDENCE') {
    r.object(d, ['evidenceId', 'reason']); r.id(d.evidenceId); const reason = r.text(d.reason, 500, true);
    if (!current.evidence.some(e => e.id === d.evidenceId && !e.voidedAt)) return refused('EVIDENCE_STATE', 'Comprovativo inexistente ou já anulado.');
    await db.expenseEvidence.update({ where: { id: d.evidenceId }, data: { voidedAt: new Date(), voidReason: reason } });
    const expense = await db.companyExpense.update({ where: { id }, data: { version: { increment: 1 } } });
    return { applied: true, expenseId: id, version: expense.version, evidenceId: d.evidenceId, reason };
  }
  r.fail('Comando inválido.');
}
async function command(user, body, file, cancel = false) {
  const who = actor(user), env = r.envelope(body), payloadHash = r.hash({ v: 1, ...env });
  return prisma.$transaction(async db => {
    const account = await db.user.findUnique({ where: { id: who.id }, select: { name: true, email: true, active: true, role: true } });
    if (!account?.active || !roleMatches(account.role, 'ADMIN')) r.fail('Sessão inválida.', 401);
    who.name = String(account.name || account.email || 'ADMIN').slice(0, 180);
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-request:' + env.requestId }))::text`;
    const previous = await db.expenseEvent.findUnique({ where: { requestId: env.requestId } });
    if (previous) { if (previous.actorId !== who.id || previous.payloadHash !== payloadHash) r.fail('Este identificador já foi usado com outro pedido ou conta.', 409); return { ...previous.result, replayed: true }; }
    let current = null, outcome;
    if (env.expenseId) {
      await db.$queryRaw`SELECT id FROM "CompanyExpense" WHERE id=${env.expenseId} FOR UPDATE`;
      current = await db.companyExpense.findUnique({ where: { id: env.expenseId }, include });
    }
    if (cancel) outcome = refused('CANCELLED_REQUEST', 'O pedido foi cancelado antes de ser registado.');
    else if (env.expenseId && !current) outcome = refused('NOT_FOUND', 'Despesa não encontrada.');
    else if (current && current.version !== env.expectedVersion) outcome = refused('VERSION_CHANGED', 'A despesa mudou. Consulte o estado atual antes de continuar.');
    else outcome = await apply(db, who, env, file, current);
    const confirmedAt = new Date();
    const result = json({ ok: true, receipt: { owner: 'ADMIN:' + who.id, requestId: env.requestId, command: env.command, requestedExpenseId: env.expenseId, expectedVersion: env.expectedVersion, payloadHash, confirmedAt: confirmedAt.toISOString() }, ...outcome });
    await db.expenseEvent.create({ data: { requestId: env.requestId, actorId: who.id, actorName: who.name, expenseId: outcome.applied ? outcome.expenseId : current?.id || null, command: env.command, payloadHash, request: json(env), result, createdAt: confirmedAt } });
    return result;
  }, { maxWait: 15000, timeout: 30000 });
}
async function receipt(user, requestId) {
  const who = actor(user);
  if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) r.fail('Pedido inválido.');
  const event = await prisma.expenseEvent.findUnique({ where: { requestId: requestId.toLowerCase() } });
  if (!event || event.actorId !== who.id) r.fail('Pedido ainda não confirmado nesta conta.', 404);
  return event.result;
}
async function evidence(id, evidenceId) {
  r.id(id); r.id(evidenceId);
  const item = await prisma.expenseEvidence.findFirst({ where: { id: evidenceId, expenseId: id, voidedAt: null } });
  if (!item) r.fail('Comprovativo não encontrado.', 404);
  if (item.bytes.length !== item.size || r.hash(Buffer.from(item.bytes)) !== item.sha256) r.fail('O comprovativo não pôde ser confirmado.', 503);
  return item;
}
async function costReport(query) { return prisma.$transaction(async db => costs.report(await rows(db), query), { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 }); }
async function clientCosts(db, monthRef) { return costs.group(costs.entries(await rows(db), monthRef)); }
async function operationalCosts(db, monthRef) {
  const entries = costs.entries(await rows(db), monthRef), technicianIds = [...new Set(entries.filter(a => a.valuationType === 'LABOR').map(a => (a.valuationSnapshot?.source.workInterval?.snapshot.technicianId || a.valuationSnapshot?.source.service.technicianId)).filter(Boolean))];
  return { clients: costs.group(entries), technicians: technicianIds.map(technicianId => ({ technicianId, valuations: valuation.summary(entries.filter(a => a.valuationType === 'LABOR' && (a.valuationSnapshot?.source.workInterval?.snapshot.technicianId || a.valuationSnapshot?.source.service.technicianId) === technicianId)) })) };
}
async function valuationPreview(id, query) {
  r.id(id); r.object(query, ['kind', 'targetType', 'targetId', 'purchaseItemId', 'quantity', 'workIntervalId', 'laborPart']); const selection = valuation.selection(query, true);
  return prisma.$transaction(async db => { const expense = await db.companyExpense.findUnique({ where: { id }, include }); if (!expense) r.fail('Despesa não encontrada.', 404); return { ok: true, preview: await valuation.preview(db, expense, selection) }; }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
function maintenanceShareQuery(query, preview, material = false) {
  r.object(query, preview ? ['allocationId','completionId','reminderId',...(material ? ['quantity'] : [])] : ['allocationId','page','targetType']);
  const reminderMode = preview ? query.reminderId !== undefined : query.targetType === 'MAINTENANCE_REMINDER';
  if (preview && reminderMode && query.completionId !== undefined || !preview && query.targetType !== undefined && !['MAINTENANCE_EQUIPMENT','MAINTENANCE_REMINDER'].includes(query.targetType)) r.fail('Escolha um destino de manutenção válido.');
  return { reminderMode, allocationId: r.queryId(query.allocationId), selection: r.queryId(preview ? reminderMode ? query.reminderId : query.completionId : query.page || '1') };
}
async function maintenanceLabor(id, query, preview = false) {
  r.id(id); const { allocationId, selection, reminderMode } = maintenanceShareQuery(query, preview);
  return prisma.$transaction(async db => {
    const expense = await db.companyExpense.findUnique({ where: { id }, include }); if (!expense) r.fail('Despesa não encontrada.', 404);
    const service = require('./maintenanceLaborShareService');
    return { ok: true, [preview ? 'preview' : 'candidates']: preview ? await service.preview(db, expense, allocationId, selection, false, reminderMode) : await service.candidates(db, expense, allocationId, selection, reminderMode) };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
async function maintenanceMaterial(id, query, preview = false) {
  r.id(id); const { allocationId, selection, reminderMode } = maintenanceShareQuery(query, preview, true), service = require('./maintenanceMaterialShareService');
  const quantity = query.quantity === undefined || query.quantity === '' ? null : query.quantity;
  if (quantity !== null && (service.rules.quantity(quantity) === null || service.rules.quantity(quantity) <= 0n)) r.fail('Indique uma quantidade positiva com até seis casas decimais.');
  return prisma.$transaction(async db => {
    const expense = await db.companyExpense.findUnique({ where: { id }, include }); if (!expense) r.fail('Despesa não encontrada.', 404);
    return { ok: true, [preview ? 'preview' : 'candidates']: preview ? await service.preview(db, expense, allocationId, selection, quantity, false, reminderMode) : await service.candidates(db, expense, allocationId, selection, reminderMode) };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
async function costPeriodPreview(id, query) {
  r.id(id); r.object(query, ['allocationId']); const allocationId = r.queryId(query.allocationId);
  return prisma.$transaction(async db => { const expense = await db.companyExpense.findUnique({ where: { id }, include }); if (!expense) r.fail('Despesa não encontrada.', 404); return { ok: true, preview: await require('./expenseCostPeriodService').preview(db, expense, allocationId) }; }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
async function repairWorkIntervals(id, query) {
  r.id(id); r.object(query, ['repairId','laborPart']); const repairId = r.queryId(query.repairId), laborPart=query.laborPart===undefined?undefined:r.queryId(query.laborPart);
  return prisma.$transaction(async db => { const expense = await db.companyExpense.findUnique({ where: { id }, include }); if (!expense) r.fail('Despesa não encontrada.', 404); return { ok: true, intervals: await valuation.workIntervals(db, expense, repairId, laborPart) }; }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
async function reminderWorkIntervals(id, query) {
  r.id(id); r.object(query, ['reminderId','laborPart']); const reminderId = r.queryId(query.reminderId), laborPart=query.laborPart===undefined?undefined:r.queryId(query.laborPart);
  return prisma.$transaction(async db => { const expense = await db.companyExpense.findUnique({ where: { id }, include }); if (!expense) r.fail('Despesa não encontrada.', 404); return { ok: true, intervals: await valuation.workIntervals(db, expense, reminderId, laborPart, 'MAINTENANCE_REMINDER') }; }, { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 15000 });
}
async function laborDistributionPreview(id,body){
  r.id(id);r.object(body,['parts']);
  return prisma.$transaction(async db=>{const expense=await db.companyExpense.findUnique({where:{id},include});if(!expense)r.fail('Despesa não encontrada.',404);return {ok:true,preview:await require('./expenseLaborDistributionService').preview(db,expense,body.parts)};},{isolationLevel:'RepeatableRead',timeout:30000,maxWait:15000});
}
module.exports = { view, maintenanceMaterial, maintenanceLabor, laborDistributionPreview, costPeriodPreview, repairWorkIntervals, reminderWorkIntervals, list, detail, summary, rows, summarize, command, receipt, evidence, actor, sources, costs, costReport, clientCosts, valuationPreview, operationalCosts };
