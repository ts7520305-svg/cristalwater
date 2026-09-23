'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const ledger = require('../src/services/expenseLedgerService'), composition = require('../src/services/laborCostCompositionService');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
let f, child, browser;
const basisIds = [], requests = [], visits = [];
(async () => {
  const month = '2004-01';
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, userId: admin.id, principalType: 'USER', role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  child = fork(require.resolve('./fixtures/financial-ai-server'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); });
  const configure = value => new Promise(resolve => { child.once('message', resolve); child.send(value); });
  async function api(route, body) {
    const response = await fetch(base + '/api/ai-admin/' + route, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, 200); return response.json();
  }
  async function read(monthRef = month) { const value = (await api('status?monthRef=' + monthRef)).context.finance; assert.notEqual(value.state, 'UNAVAILABLE'); return value; }
  f = await require('./fixtures/repair-labor-data')({ admin });
  const before = (await read()).costCoverage, beforeFebruary = (await read('2004-02')).costCoverage;
  const times = (day, start = '09:00:00', end = '09:01:00') => ({ startAt: new Date('2004-01-' + day + 'T' + start + 'Z'), endAt: new Date('2004-01-' + day + 'T' + end + 'Z') });
  await prisma.serviceVisit.update({ where: { id: f.regular.id }, data: times('03') });
  await prisma.extraVisit.update({ where: { id: f.extra.id }, data: times('03', '09:01:00', '09:02:00') });
  const target = (type, id) => ({ kind: 'LABOR', targetType: type, targetId: id, purchaseItemId: null, quantity: null });
  async function visit(day, type = 'REGULAR') {
    const model = type === 'REGULAR' ? 'serviceVisit' : 'extraVisit';
    const row = await prisma[model].create({ data: { clientId: f.client.id, poolId: f.pool.id, technicianId: f.tech.id, status: 'DONE', ...times(day) } });
    visits.push({ model, id: row.id }); return target(type, row.id);
  }
  async function expenseCommand(e, command, data) {
    const requestId = randomUUID(); requests.push(requestId);
    const result = await ledger.command(admin, { requestId, command, expenseId: e.expenseId, expectedVersion: (await ledger.detail(e.expenseId)).expense.version, data });
    assert(result.applied, JSON.stringify(result)); return result;
  }
  async function send(command, resourceId, data) {
    const requestId = randomUUID(); requests.push(requestId);
    const result = await composition.command(admin, { requestId, command, resourceId, data: { ...data, reason: 'Documentos e medição conferidos', confirmed: true } });
    assert(result.applied, JSON.stringify(result)); return result;
  }
  async function create(selected, legacy = false) {
    const data = legacy ? { expenseIds: selected.map(e => e.expenseId) } : { components: selected };
    const preview = await composition.read(db => legacy ? composition.basisPreview(db, data.expenseIds) : composition.componentPreview(db, selected));
    const made = await send('CREATE', selected[0].expenseId, { ...data, previewHash: preview.hash }); basisIds.push(made.basis.id); return made.basis;
  }
  async function value(basis, choice) {
    const preview = await composition.read(db => composition.valuePreview(db, basis.id, choice));
    return (await send('VALUE', basis.id, { choice: preview.choice, previewHash: preview.hash })).group;
  }
  async function voidValue(basis, group) {
    const row = (await composition.detail(basis.id)).groups.find(g => g.id === group.id);
    await send('VOID_VALUE', basis.id, { groupId: group.id, recordHash: row.recordHash });
  }
  async function distribute(e) {
    const parts = [f.tech, f.second].map(t => ({ technicianId: t.id, periodStart: '2004-01-01', periodEnd: '2004-01-31', paidMinutes: 60, amountCents: 3000 }));
    const { preview } = await ledger.laborDistributionPreview(e.expenseId, { parts });
    await expenseCommand(e, 'SET_LABOR_DISTRIBUTION', { parts, previewHash: preview.hash, reason: 'Parcelas por técnico confirmadas', confirmed: true });
  }
  async function salary(amountCents = 6000) { return f.salary({ amountCents, paidMinutes: 60 }); }
  function counts(c, expected) {
    assert.deepEqual(Object.fromEntries(Object.keys(expected).map(k => [k, c.labor[k] - before.labor[k]])), expected);
    assert.equal(c.labor.total, c.labor.valued + c.labor.missing + c.labor.review);
    assert.equal(c.completeOperatingCosts, false); assert.equal(c.profit, null); assert.equal(c.limitApplied, null);
  }
  const a = await salary(), b = await salary(3000), legacy = await create([a, b], true);
  assert.equal(legacy.snapshot.version, 1);
  const regular = target('REGULAR', f.regular.id), extra = target('EXTRA', f.extra.id);
  const first = await value(legacy, regular);
  assert.equal((await composition.detail(legacy.id)).groups[0].state, 'CONFIRMED');
  for (const e of [a, b]) assert.equal((await ledger.detail(e.expenseId)).expense.allocationReviewCount, 0);
  // Two confirmed monetary components cover one recorded visit, not two times.
  counts((await read()).costCoverage, { total: 2, valued: 1, missing: 1, review: 0 });
  await value(legacy, extra);
  counts((await read()).costCoverage, { total: 2, valued: 2, missing: 0, review: 0 });

  const c = await salary(), d = await salary(3000); await distribute(c);
  const mixed = await create([{ expenseId: c.expenseId, laborPart: 1 }, { expenseId: d.expenseId, laborPart: null }]);
  assert.equal(mixed.snapshot.version, 2); const mixedChoice = await visit('04'); await value(mixed, mixedChoice);
  const e = await salary(), g = await salary(); await distribute(e); await distribute(g);
  const parts = await create([{ expenseId: e.expenseId, laborPart: 1 }, { expenseId: g.expenseId, laborPart: 1 }]);
  const partsChoice = await visit('05', 'EXTRA'); await value(parts, partsChoice);
  counts((await read()).costCoverage, { total: 4, valued: 4, missing: 0, review: 0 });

  const solo = await salary(), soloChoice = await visit('06');
  const p = (await ledger.valuationPreview(solo.expenseId, { kind: 'LABOR', targetType: soloChoice.targetType, targetId: String(soloChoice.targetId) })).preview;
  await expenseCommand(solo, 'VALUE_LABOR', { ...Object.fromEntries(['kind', 'targetType', 'targetId', 'targetHash', 'monthRef', 'purchaseItemId', 'quantity', 'amountCents', 'valuationHash'].map(k => [k, p[k]])), previewHash: p.hash, reason: 'Tempo individual confirmado', confirmed: true });
  const manualChoice = await visit('07'), manualTarget = await require('../src/services/expenseCostTargets').get(prisma, 'REGULAR', manualChoice.targetId);
  await expenseCommand(solo, 'ALLOCATE_COST', { targetType: 'REGULAR', targetId: manualChoice.targetId, targetHash: manualTarget.hash, monthRef: month, amountCents: 100, reason: 'Parcela manual, sem medição de tempo', confirmed: true });
  await expenseCommand(a, 'RECORD_PAYMENT', { amountCents: 6000, paidOn: '2004-01-16', method: 'TRANSFER', reference: 'Comprovativo original' });
  counts((await read()).costCoverage, { total: 6, valued: 5, missing: 1, review: 0 });
  const originalPart = await prisma.expenseAllocation.findUniqueOrThrow({ where: { id: first.snapshot.parts[1].id } });
  const history = async () => JSON.stringify(await Promise.all([
    prisma.companyExpense.findMany({ where: { id: { in: f.expenses } }, orderBy: { id: 'asc' } }),
    prisma.expenseAllocation.findMany({ where: { expenseId: { in: f.expenses } }, orderBy: { id: 'asc' } }),
    prisma.expensePayment.findMany({ where: { expenseId: { in: f.expenses } }, orderBy: { id: 'asc' } }),
    prisma.laborCostValuation.findMany({ where: { basisId: { in: basisIds } }, orderBy: { id: 'asc' } }),
    prisma.fieldWriteRequest.findMany({ where: { requestId: { in: requests } }, orderBy: { requestId: 'asc' } })
  ]));
  const savedHistory = await history();
  const good = await read(), answer = await api('chat', { message: 'Que custos de tempo estão valorizados?', monthRef: month, scope: 'finance' });
  assert(answer.answer.includes(`${good.costCoverage.labor.valued} têm o tempo valorizado`));
  assert(answer.answer.includes(`${good.costCoverage.labor.review} precisam de revisão`));
  await configure({ provider: 'success', reset: true });
  await api('chat', { message: 'Explica a cobertura dos salários', monthRef: month, scope: 'finance' });
  const sent = (await configure({})).calls.at(-1);
  assert.deepEqual(JSON.parse(sent.input[1].content[0].text).platformContext.finance.costCoverage.labor, good.costCoverage.labor);
  await configure({ provider: 'local' });
  assert.equal(await history(), savedHistory, 'Coverage and AI reads must preserve payments, allocations and receipts');

  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ id, token }) => { window.CW_API_ORIGIN = location.origin; for (const k of ['cristalwater_jwt', 'token', 'adminToken']) localStorage.setItem(k, token); for (const k of ['cristalwater_user', 'user']) localStorage.setItem(k, JSON.stringify({ id, role: 'ADMIN' })); }, { id: admin.id, token });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(10000);
  const ready = () => page.waitForFunction(() => ['ready', 'review'].includes(document.getElementById('aiStatus').dataset.state));
  async function reload() { await page.locator('#refreshBtn').click(); await ready(); }
  async function shown(expected) {
    const finance = await read(); counts(finance.costCoverage, expected);
    await reload(); const text = await page.locator('#financeCoverageBasis').textContent();
    assert(text.includes(`${finance.costCoverage.labor.valued} têm tempo valorizado e ${finance.costCoverage.labor.review} precisam de revisão`));
    assert.match(text, /Ausência de registo não significa custo zero/); return finance;
  }
  await page.goto(base + '/admin-ai', { waitUntil: 'domcontentloaded' }); await ready(); await page.locator('#aiMonth').fill(month);
  await shown({ total: 6, valued: 5, missing: 1, review: 0 });
  const visual = path.resolve('reports/field-visual/composed-cost-coverage-' + Date.now()); fs.mkdirSync(visual, { recursive: true });
  for (const [width, colorScheme] of [[320, 'light'], [390, 'dark']]) {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme });
    await page.locator('#financeCoverageBasis').evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 130));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: path.join(visual, 'confirmed-' + width + '-' + colorScheme + '.png') });
  }
  // A changed part still invalidates the entire composition in the same view.
  await prisma.expenseAllocation.update({ where: { id: originalPart.id }, data: { reason: 'Parcela alterada depois da confirmação' } });
  await shown({ total: 6, valued: 4, missing: 1, review: 1 });
  await page.locator('#financeCoverageServices summary').click(); assert.match(await page.locator('#financeCoverageServiceRows').textContent(), /Tempo ou valorização por rever/);
  await page.screenshot({ path: path.join(visual, 'review-390-dark.png') });
  await prisma.expenseAllocation.update({ where: { id: originalPart.id }, data: { reason: originalPart.reason } });
  await shown({ total: 6, valued: 5, missing: 1, review: 0 }); assert.equal(await history(), savedHistory);
  // The current overlap guard remains authoritative after grouping monetary parts.
  await prisma.extraVisit.update({ where: { id: f.extra.id }, data: times('03') });
  await shown({ total: 6, valued: 3, missing: 1, review: 2 });
  await prisma.extraVisit.update({ where: { id: f.extra.id }, data: times('03', '09:01:00', '09:02:00') });
  await shown({ total: 6, valued: 5, missing: 1, review: 0 });
  const forged = structuredClone(originalPart.valuationSnapshot); forged.composition.groupId = (await composition.detail(mixed.id)).groups[0].id;
  await prisma.expenseAllocation.update({ where: { id: originalPart.id }, data: { valuationSnapshot: forged } });
  counts((await read()).costCoverage, { total: 6, valued: 4, missing: 1, review: 1 });
  await prisma.expenseAllocation.update({ where: { id: originalPart.id }, data: { valuationSnapshot: originalPart.valuationSnapshot } });
  // A second standalone valuation is still refused before it can duplicate time.
  await assert.rejects(ledger.valuationPreview(solo.expenseId, { kind: 'LABOR', targetType: soloChoice.targetType, targetId: String(soloChoice.targetId) }), error => error.status === 409);
  assert.equal(await history(), savedHistory);
  await voidValue(legacy, first); await shown({ total: 6, valued: 4, missing: 2, review: 0 });
  const replacement = await value(legacy, regular); assert.notEqual(replacement.id, first.id);
  await shown({ total: 6, valued: 5, missing: 1, review: 0 });
  assert.equal(await prisma.expensePayment.count({ where: { expenseId: a.expenseId } }), 1);
  // Samples stay bounded without truncating complete counts or counting voided groups.
  for (let i = 0; i < 12; i++) await visit(String(10 + i).padStart(2, '0'));
  const sampled = await shown({ total: 18, valued: 5, missing: 13, review: 0 });
  assert(sampled.costCoverage.serviceIssues.sampleOnly); assert.equal(sampled.costCoverage.serviceIssues.rows.length, 10);
  assert.equal(sampled.costCoverage.serviceIssues.limit, 10); assert.equal(sampled.costCoverage.noMaterialRecordVisits - before.noMaterialRecordVisits, 18);
  assert.equal((await read('2004-02')).costCoverage.labor.valued, beforeFebruary.labor.valued);
  assert.deepEqual(errors, []);
  console.log('PASS composed cost coverage: one measured visit per confirmed legacy/mixed/distributed composition, typed equal IDs, standalone/manual distinctions, exact complete counts and bounded samples, unchanged payments and receipts, local/model context, real browser confirmation/review/recovery, changed/forged parts, real time conflicts, joint void and replacement');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  try { if (f) {
    await prisma.laborCostValuationPart.deleteMany({ where: { group: { basisId: { in: basisIds } } } });
    await prisma.laborCostValuation.deleteMany({ where: { basisId: { in: basisIds } } }); await prisma.laborCostBasis.deleteMany({ where: { id: { in: basisIds } } });
    await prisma.expensePayment.deleteMany({ where: { expenseId: { in: f.expenses } } }); await prisma.expenseLaborDistribution.deleteMany({ where: { expenseId: { in: f.expenses } } });
    await prisma.fieldWriteRequest.deleteMany({ where: { requestId: { in: requests } } });
    await f.cleanup();
    for (const model of ['serviceVisit', 'extraVisit']) await prisma[model].deleteMany({ where: { id: { in: visits.filter(v => v.model === model).map(v => v.id) } } });
  } } finally { child?.kill('SIGTERM'); await prisma.$disconnect(); }
});
