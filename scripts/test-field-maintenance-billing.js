'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output = path.resolve('reports/maintenance-billing', String(Date.now())); let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = data => jwt.sign(data, getJwtSecret(), { expiresIn: '1h' }), token = sign({ id: admin.id, role: 'ADMIN' });
  const client = await prisma.client.create({ data: { name: 'Cliente de intervenções QA', status: 'ACTIVE', active: true, billingActive: true, monthlyFee: 80 } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina de intervenções QA', active: true, monthlyAmount: 80 } });
  const tech = await prisma.technician.create({ data: { name: 'Técnico intervenções QA', active: true } });
  const tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }), ct = sign({ id: client.id, clientId: client.id, role: 'CLIENT' });
  async function api(url, body, actor = token, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    return { status: response.status, body: await response.json() };
  }
  const listUrl = kind => `/api/equipment-maintenance/pools/${pool.id}/billing?kind=${kind}`;
  async function listing(kind = 'EQUIPMENT') { const r = await api(listUrl(kind)); assert.equal(r.status, 200, JSON.stringify(r)); return r.body; }
  async function equipment(title, type = 'REGULAR') {
    const created = await api(`/api/equipment-maintenance/pools/${pool.id}`, { component: 'FILTER', title, instructions: 'Rever vedação conforme manual.', intervalUnit: 'MONTHS', intervalCount: 3, nextDue: '2026-01-01' });
    assert.equal(created.status, 200, JSON.stringify(created)); const plan = created.body.plan;
    const visit = await prisma[type === 'EXTRA' ? 'extraVisit' : 'serviceVisit'].create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date() } });
    const result = await api(`/api/equipment-maintenance/plans/${plan.id}/complete`, { requestId: randomUUID(), visitType: type, visitId: visit.id, poolId: pool.id, expectedVersion: plan.version, notes: 'Vedação verificada e intervenção concluída.', confirmed: true }, tt);
    assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.body.applied, true);
    return { ...(await listing()).rows.find(r => r.sourceId === result.body.completion.id), plan, visit, completion: result.body };
  }
  async function reminder(title) {
    const made = await api(`/api/core/pools/${pool.id}/service-reminders`, { title, dueAt: '2026-01-01T12:00:00.000Z', repeatRule: 'EVERY_1_MONTHS', priority: 'NORMAL', description: 'Serviço periódico executado.', requestId: randomUUID() });
    assert.equal(made.status, 201, JSON.stringify(made));
    const done = await api(`/api/core/pools/${pool.id}/service-reminders/${made.body.reminder.id}/complete`, {}); assert.equal(done.status, 200, JSON.stringify(done));
    return (await listing('REMINDER')).rows.find(r => r.sourceId === made.body.reminder.id);
  }
  const payload = (row, mode = 'EXTRA', amount = '12,34') => ({ expectedVersion: row.expectedVersion, expectedPoolId: row.poolId, expectedClientId: row.clientId, mode, amount: mode === 'INCLUDED' ? '0.00' : amount, note: 'Condição acordada e revista pela administração.', confirmed: true });
  const endpoint = row => `/api/equipment-maintenance/billing/${row.kind}/${row.sourceId}/review`;
  const review = (row, body = payload(row), actor = token) => api(endpoint(row), body, actor);
  const receipt = row => prisma.operationalReminder.findUnique({ where: { sourceKey: `maintenance-billing:${row.kind}:${row.sourceId}` } });
  const regular = await equipment('Filtro principal QA'), extra = await equipment('Clorador extra QA', 'EXTRA'), service = await reminder('Substituição periódica QA');
  const originalPlan = await prisma.equipmentMaintenancePlan.findUnique({ where: { id: regular.plan.id } });
  for (const actor of [null, tt, ct]) {
    assert.equal((await api(listUrl('EQUIPMENT'), undefined, actor)).status, actor ? 403 : 401);
    assert.equal((await review(regular, payload(regular), actor)).status, actor ? 403 : 401);
  }
  const includedBefore = await prisma.invoice.count(); const included = await review(regular, payload(regular, 'INCLUDED'));
  assert.equal(included.status, 200, JSON.stringify(included)); assert.equal(included.body.status, 'INCLUDED'); assert.equal(included.body.invoiceId, null); assert.equal(await prisma.invoice.count(), includedBefore);
  assert.equal((await review(regular, payload(regular, 'INCLUDED'))).body.idempotent, true);
  assert.equal((await review(regular)).status, 409);
  const parallel = await Promise.all(Array.from({ length: 8 }, () => review(extra)));
  parallel.forEach(r => assert.equal(r.status, 200, JSON.stringify(r))); assert.equal(new Set(parallel.map(r => r.body.invoiceId)).size, 1);
  const invoiceId = parallel[0].body.invoiceId, invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { lines: true } });
  assert.equal(invoice.status, 'DRAFT'); assert.equal(invoice.invoiceIssued, false); assert.equal(invoice.monthRef, null); assert.equal(invoice.lines.length, 1);
  for (const field of ['total','totalAmount','amount','amountOpen','subtotal','subtotalCurrent']) assert.equal(invoice[field], 12.34, field);
  for (const field of ['totalCents','amountCents']) assert.equal(invoice[field], 1234, field);
  assert.equal(invoice.lines[0].lineType, 'MAINTENANCE_EQUIPMENT'); assert.equal(invoice.lines[0].referenceId, extra.sourceId);
  assert.equal((await review(extra, payload(extra, 'EXTRA', '13.00'))).status, 409);
  assert.deepEqual(await prisma.equipmentMaintenancePlan.findUnique({ where: { id: regular.plan.id } }), originalPlan);
  const field = (await api(`/api/equipment-maintenance/visits/${extra.visit.id}?visitType=EXTRA`, undefined, tt)).body;
  assert(!/amountCents|invoiceId|MAINTENANCE_BILLING|unitPrice/.test(JSON.stringify(field)), 'Commercial data must stay outside field API');
  assert.deepEqual((await prisma.equipmentMaintenanceCompletion.findUnique({ where: { id: extra.sourceId } })).result, extra.completion);
  const serviceCounts = await prisma.generalReminder.count({ where: { poolId: pool.id } });
  const reminderCharge = await review(service, payload(service, 'EXTRA', '0,01')); assert.equal(reminderCharge.status, 200, JSON.stringify(reminderCharge));
  assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id } }), serviceCounts, 'Review does not repeat the reminder');
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: reminderCharge.body.invoiceId }, include: { lines: true } })).lines[0].lineType, 'MAINTENANCE_REMINDER');
  console.log('PASS regular/extra equipment and completed service reminders, included decision, eight simultaneous approvals, exact cents, immutable execution and technician isolation');

  const strict = await equipment('Validações comerciais QA');
  for (const value of [0, -1, true, [], '1e2', '1.001', '21474836.48']) assert.equal((await review(strict, payload(strict, 'EXTRA', value))).status, 400);
  for (const change of [{ confirmed: false }, { mode: 'UNKNOWN' }, { note: 'a' }, { expectedClientId: true }, { amount: 1, mode: 'INCLUDED' }, { injection: true }]) assert.equal((await review(strict, { ...payload(strict), ...change })).status, 400);
  assert.equal((await review(strict, { ...payload(strict), expectedClientId: client.id + 1 })).status, 409);
  assert.equal((await review(strict, { ...payload(strict), expectedPoolId: pool.id + 1 })).status, 409);
  await prisma.equipmentMaintenanceCompletion.update({ where: { id: strict.sourceId }, data: { notes: 'Relato retificado antes da revisão.' } });
  assert.equal((await review(strict)).status, 409); assert.equal(await receipt(strict), null);
  const otherClient = await prisma.client.create({ data: { name: 'Outro cliente QA' } });
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: otherClient.id } });
  assert.equal((await review(strict)).status, 409);
  assert.equal((await listing()).rows.find(r => r.sourceId === strict.sourceId).reviewable, false, 'Historic visit client prevents billing a transferred pool');
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: client.id } });
  const pendingReminder = await prisma.generalReminder.create({ data: { title: 'Ainda por realizar QA', poolId: pool.id, clientId: client.id, category: 'POOL_SERVICE_REMINDER', dueAt: new Date() } });
  assert.equal((await review({ ...service, sourceId: pendingReminder.id })).status, 409);
  assert(!(await listing('REMINDER')).rows.some(r => r.sourceId === pendingReminder.id));
  const paid = await prisma.invoice.update({ where: { id: reminderCharge.body.invoiceId }, data: { status: 'PAID', invoiceIssued: true, amountPaid: 0.01, amountOpen: 0 } });
  await prisma.generalReminder.delete({ where: { id: service.sourceId } });
  assert.equal((await review(service, payload(service, 'EXTRA', '0,01'))).body.invoiceId, paid.id);
  assert.deepEqual(await prisma.invoice.findUnique({ where: { id: paid.id } }), paid);
  const fallbackSource = await reminder('Reserva comercial antiga QA');
  await prisma.invoiceLine.create({ data: { invoiceId, type: 'MAINTENANCE', lineType: 'MAINTENANCE_REMINDER', referenceId: fallbackSource.sourceId, description: 'Reserva antiga QA', total: 0 } });
  assert.equal((await review(fallbackSource)).status, 409);
  const monthlyResult = await require('../src/business/finance/MonthlyBillingBusiness').generateForClient(client.id, new Date().toISOString().slice(0, 7));
  assert.equal(monthlyResult.addedCents, 8000, 'Standalone maintenance drafts preserve the separate monthly price');
  assert.equal((await require('../src/business/finance/MonthlyBillingBusiness').generateForClient(client.id, new Date().toISOString().slice(0, 7))).changed, false);
  console.log('PASS stale source, changed client, strict commercial input, pending reminder refusal, deleted-source recovery and historical source reservation');

  for (let i = 0; i < 27; i++) await prisma.generalReminder.create({ data: { title: `Página QA ${i}`, poolId: pool.id, clientId: client.id, category: 'POOL_SERVICE_REMINDER', dueAt: new Date(), completedAt: new Date(), status: 'DONE' } });
  const pageOne = await listing('REMINDER'); assert.equal(pageOne.rows.length, 25); assert(pageOne.nextBefore);
  const pageTwo = await api(listUrl('REMINDER') + `&before=${pageOne.nextBefore}`); assert.equal(pageTwo.status, 200); assert(pageTwo.body.rows.length); assert(!pageTwo.body.rows.some(row => pageOne.rows.some(first => first.sourceId === row.sourceId)));
  const fault = await reminder('Falha atómica QA'), countBefore = await prisma.invoice.count();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_maintenance_billing_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."action" = 'MAINTENANCE_BILLING_REVIEWED' THEN RAISE EXCEPTION 'QA audit failure'; END IF; RETURN NEW; END $$`);
  try {
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_maintenance_billing_failure BEFORE INSERT ON "UserAuditLog" FOR EACH ROW EXECUTE FUNCTION qa_maintenance_billing_failure()');
    assert.equal((await review(fault)).status, 500); assert.equal(await prisma.invoice.count(), countBefore); assert.equal(await receipt(fault), null);
  } finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_maintenance_billing_failure ON "UserAuditLog"'); await prisma.$executeRawUnsafe('DROP FUNCTION qa_maintenance_billing_failure()'); }
  assert.equal((await review(fault)).status, 200);
  console.log('PASS pagination and atomic rollback of invoice, line, commercial receipt and audit');

  await api('/api/settings/language/me', { language: 'pt' }, token, 'PUT');
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => { for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN', name: 'Admin QA' })); }, { token, id: admin.id });
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const storageKey = `cwMaintenanceBilling:v1:ADMIN:${admin.id}`, pending = page.locator('#mbPending'), status = page.locator('#mbStatus');
  async function open(tab = page) { await tab.goto(base + '/admin-operational-settings', { waitUntil: 'networkidle' }); await tab.locator('#emLoadPools').click(); await tab.locator(`#emPool option[value="${pool.id}"]`).waitFor({ state: 'attached' }); await tab.locator('#emPool').selectOption(String(pool.id)); await tab.locator('#mbStatus').filter({ hasText: 'Intervenções atualizadas.' }).waitFor(); }
  async function prepare(row, tab = page, mode = 'EXTRA') {
    await tab.locator(`#mbRows [data-mb-source="${row.kind}:${row.sourceId}"] [data-mb-review]`).click(); await tab.locator('#mbMode').selectOption(mode);
    if (mode === 'EXTRA') await tab.locator('#mbAmount').fill('45,67'); await tab.locator('#mbNote').fill('Valor acordado para esta intervenção.'); await tab.locator('#mbConfirmed').check();
  }
  const lost = await equipment('Filtro <b>literal</b> QA'); await open(); await prepare(lost);
  assert.match(await page.locator('#mbSource').textContent(), /<b>literal<\/b>/); assert.equal(await page.locator('#mbSource b').count(), 0);
  await page.locator('#mbCancel').click(); assert.equal(await receipt(lost), null); await prepare(lost);
  let sent = 0; await page.route(base + endpoint(lost), async route => { sent++; const reply = await route.fetch(); assert.equal(reply.status(), 200); await route.abort('failed'); });
  await page.locator('#mbSave').click(); await status.filter({ hasText: 'O pedido foi conservado.' }).waitFor(); assert.equal(sent, 1); assert(await receipt(lost));
  assert.equal(JSON.parse(await page.evaluate(k => localStorage.getItem(k), storageKey)).amountCents, 4567);
  await page.unroute(base + endpoint(lost)); await page.reload({ waitUntil: 'networkidle' }); await pending.waitFor(); await page.locator('#mbRetry').click();
  await status.filter({ hasText: 'Decisão confirmada: rascunho' }).waitFor(); assert.equal(await page.evaluate(k => localStorage.getItem(k), storageKey), null);
  const uiIncluded = await equipment('Serviço incluído UI QA'); await open(); await prepare(uiIncluded, page, 'INCLUDED'); const beforeIncluded = await prisma.invoice.count(); await page.locator('#mbSave').click(); await status.filter({ hasText: 'Decisão confirmada: incluída' }).waitFor(); assert.equal(await prisma.invoice.count(), beforeIncluded);
  console.log('PASS real browser literal text, cancellation, one request, lost response/reload recovery and included work without a charge');

  const wrong = await equipment('Confirmação trocada QA'); await page.locator('#mbRefresh').click(); await status.filter({ hasText: 'Intervenções atualizadas.' }).waitFor(); await prepare(wrong);
  await page.route(base + endpoint(wrong), async route => { const reply = await route.fetch(), data = await reply.json(); await route.fulfill({ response: reply, json: { ...data, amountCents: data.amountCents + 1 } }); });
  await page.locator('#mbSave').click(); await status.filter({ hasText: 'não corresponde' }).waitFor(); assert(await page.evaluate(k => localStorage.getItem(k), storageKey));
  await page.unroute(base + endpoint(wrong)); await page.locator('#mbRetry').click(); await status.filter({ hasText: 'Decisão confirmada:' }).waitFor();
  const stale = await equipment('Conflito de revisão UI QA'); await page.locator('#mbRefresh').click(); await status.filter({ hasText: 'Intervenções atualizadas.' }).waitFor(); await prepare(stale);
  await prisma.equipmentMaintenanceCompletion.update({ where: { id: stale.sourceId }, data: { notes: 'Nota alterada após abertura da lista.' } });
  await page.locator('#mbSave').click(); await status.filter({ hasText: 'Use Rever dados.' }).waitFor(); assert.equal(await page.locator('#mbRetry').isDisabled(), true); assert.equal(await receipt(stale), null);
  await page.locator('#mbCorrect').click(); await status.filter({ hasText: 'Intervenções atualizadas.' }).waitFor(); assert.equal(await page.evaluate(k => localStorage.getItem(k), storageKey), null);
  await prepare((await listing()).rows.find(row => row.sourceId === stale.sourceId));
  fs.mkdirSync(output, { recursive: true });
  for (const width of [320,390,1440]) { await page.setViewportSize({ width, height: 1100 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${width}`); await page.locator('#maintenanceBillingPanel').screenshot({ path: path.join(output, `review-${width}.png`) }); }
  await page.locator('#mbCancel').click();
  console.log('PASS mismatched acknowledgement retention, stale decision refusal/review and layout at 320/390/1440');
  const quota = await equipment('Armazenamento indisponível QA'); await page.locator('#mbRefresh').click(); await status.filter({ hasText: 'Intervenções atualizadas.' }).waitFor(); await prepare(quota);
  let quotaSent = 0; page.on('request', request => { if (request.method() === 'POST' && request.url() === base + endpoint(quota)) quotaSent++; });
  await page.evaluate(k => { const original = Storage.prototype.setItem; window.qaRestoreStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(key, value) { if (key === k) throw new DOMException('QA quota', 'QuotaExceededError'); return original.call(this, key, value); }; }, storageKey);
  await page.locator('#mbSave').click(); await status.filter({ hasText: 'QA quota' }).waitFor(); assert.equal(quotaSent, 0); assert.equal(await receipt(quota), null); await page.evaluate(() => window.qaRestoreStorage());
  await page.locator('#mbCancel').click();
  const shared = await equipment('Duas janelas QA'), secondPage = await context.newPage(); secondPage.setDefaultTimeout(10000);
  await open(); await open(secondPage); await prepare(shared); await prepare(shared, secondPage);
  let releaseShared, reachedShared; const waitingShared = new Promise(resolve => { reachedShared = resolve; });
  await page.route(base + endpoint(shared), async route => { const reply = await route.fetch(); reachedShared(); await new Promise(resolve => { releaseShared = resolve; }); await route.fulfill({ response: reply }); });
  await page.locator('#mbSave').click(); await waitingShared;
  await secondPage.locator('#mbPending').waitFor(); await secondPage.locator('#mbRetry').click(); await secondPage.locator('#mbStatus').filter({ hasText: 'noutra janela' }).waitFor();
  const sharedId = (await receipt(shared)).metadata.result.invoiceId; releaseShared(); await status.filter({ hasText: 'Decisão confirmada:' }).waitFor();
  assert.equal(await prisma.invoiceLine.count({ where: { invoiceId: sharedId } }), 1); await secondPage.close();
  const uiReminder = await reminder('Lembrete incluído UI QA'); await page.locator('#mbKind').selectOption('REMINDER'); await status.filter({ hasText: 'Intervenções atualizadas.' }).waitFor();
  await prepare(uiReminder, page, 'INCLUDED'); await page.locator('#mbSave').click(); await status.filter({ hasText: 'Decisão confirmada: incluída' }).waitFor(); assert.equal((await receipt(uiReminder)).metadata.result.mode, 'INCLUDED');
  await page.locator('#mbKind').selectOption('EQUIPMENT'); await status.filter({ hasText: 'Intervenções atualizadas.' }).waitFor();
  console.log('PASS storage failure sends nothing, cross-window lock preserves one decision and completed reminders use the real form');
  const sessionSource = await equipment('Troca de sessão QA'); await page.locator('#mbRefresh').click(); await status.filter({ hasText: 'Intervenções atualizadas.' }).waitFor(); await prepare(sessionSource);
  let release, reached; const waiting = new Promise(resolve => { reached = resolve; });
  await page.route(base + endpoint(sessionSource), async route => { const reply = await route.fetch(); reached(); await new Promise(resolve => { release = resolve; }); await route.fulfill({ response: reply }); });
  await page.locator('#mbSave').click(); await waiting;
  await page.evaluate(() => { localStorage.setItem('token', 'different-account'); localStorage.setItem('cristalwater_jwt', 'different-account'); dispatchEvent(new Event('storage')); }); release();
  await page.locator('#maintenanceBillingPanel').waitFor({ state: 'hidden' }); assert(await page.evaluate(k => localStorage.getItem(k), storageKey), 'Original account retains recovery');
  assert(await receipt(sessionSource)); assert.deepEqual(errors, []); await context.close();
  console.log('PASS changed session hides commercial values and retains the original account request; evidence ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
