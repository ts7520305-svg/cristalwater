'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.FISCAL_ISSUING_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const routes = [id => `/api/invoices/${id}/mark-issued`, id => `/api/core/invoices/${id}/mark-external-issued`];
const stamp = 'QA external ' + randomUUID();
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const user = { id: admin.id, role: 'ADMIN' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const client = await prisma.client.create({ data: { name: stamp, requiresInvoice: true, fiscalName: 'Tiago QA', fiscalNif: 'QA', fiscalAddress: 'Morada QA', fiscalEmail: 'qa@example.test' } });
  const other = await prisma.client.create({ data: { name: stamp + ' outro', requiresInvoice: false } });
  const fixture = (data = {}) => prisma.invoice.create({ data: { clientId: client.id, requiresInvoice: false, status: 'PENDING', total: 10.3, totalAmount: 10.3, amount: 10.3, amountOpen: 10.3, notes: 'Nota a preservar',
    lines: { create: [{ description: 'Manutenção mensal', quantity: 1, unitPrice: 10.1, total: 10.1, lineTotal: 10.1, type: 'MONTHLY' }, { description: 'Intervenção periódica', quantity: 1, unitPrice: 0.2, total: 0.2, lineTotal: 0.2, type: 'SERVICE', serviceDate: new Date('2098-01-15T12:00:00Z') }] }, ...data }, include: { lines: true, payments: true } });
  async function call(url, body, custom = headers) {
    const response = await fetch(base + url, { headers: custom, ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
  }
  const list = async (q = stamp, status = 'all') => { const r = await call(`/api/invoices/to-issue?status=${status}&q=${encodeURIComponent(q)}`); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /no-store/); return r.body; };
  async function reviewed(invoice, number) {
    const body = await list(), row = body.clients.flatMap(c => c.invoices).find(row => row.id === invoice.id);
    assert(row, 'Document must be visible for review');
    return { externalInvoiceNo: number, expectedClientId: row.clientId, externalReviewToken: row.externalReviewToken, reviewedLineIds: row.lines.map(line => line.id) };
  }
  const snapshot = async id => ({ invoice: await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { id: 'asc' } }, payments: { orderBy: { id: 'asc' } } } }),
    logs: await prisma.communicationLog.findMany({ where: { referenceId: id, channel: 'EXTERNAL_INVOICE' }, orderBy: { id: 'asc' } }),
    audit: await prisma.auditTrail.findMany({ where: { entity: 'Invoice', entityId: id, action: 'EXTERNAL_INVOICE_REGISTERED' }, orderBy: { id: 'asc' } }) });
  const adminBefore = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
  for (const route of routes) {
    const row = await fixture(), before = await snapshot(row.id);
    for (const body of [{}, { externalInvoiceNo: '' }, { externalInvoiceNo: ' ' }, { externalInvoiceNo: {} }, { externalInvoiceNo: true }, { externalInvoiceNo: 'X'.repeat(201) }, { externalInvoiceNo: 'QA\n1' }, { externalInvoiceNo: 'QA1', invoiceNumber: 'QA2' }, { externalInvoiceNo: 'QA', reviewedLineIds: [] }]) assert.equal((await call(route(row.id), body)).status, 400, JSON.stringify(body));
    for (const id of ['0', '01', '-1', '1.5', '1e1', '2147483648', 'x']) assert.equal((await call(route(id), { externalInvoiceNo: stamp })).status, 400);
    assert.equal((await call(route(row.id), { externalInvoiceNo: stamp }, { 'Content-Type': 'application/json' })).status, 401);
    const clientToken = jwt.sign({ id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' }, getJwtSecret(), { expiresIn: '1h' });
    assert.equal((await call(route(row.id), { externalInvoiceNo: stamp }, { ...headers, Authorization: 'Bearer ' + clientToken })).status, 403);
    assert.deepEqual(await snapshot(row.id), before);
    for (const status of ['DRAFT', 'RASCUNHO', 'CANCELLED', 'CANCELED', 'CANCELADO', 'VOID', 'ARCHIVED', 'SUPERSEDED']) {
      const withdrawn = await fixture({ status }); const prior = await snapshot(withdrawn.id);
      assert.equal((await call(route(withdrawn.id), { externalInvoiceNo: stamp + withdrawn.id })).status, 409); assert.deepEqual(await snapshot(withdrawn.id), prior);
    }
    for (const values of [{ clientId: other.id }, { total: 0, totalAmount: 0, amount: 0 }, { total: -1, totalAmount: -1, amount: -1 }]) assert.equal((await call(route((await fixture(values)).id), { externalInvoiceNo: stamp + randomUUID() })).status, 409);
  }
  const missing = await fixture({ invoiceIssued: true, externalInvoiceNo: '  ' }), paid = await fixture({ status: 'PAID', amountPaid: 10.3, amountOpen: 0, payments: { create: { amount: 10.3, amountCents: 1030, method: 'CASH' } } });
  const perDocument = await fixture({ clientId: other.id, requiresInvoice: true });
  let visible = (await list()).clients.flatMap(c => c.invoices);
  assert(visible.some(i => i.id === missing.id && i.externalRegistrationStatus === 'NUMBER_MISSING'));
  assert(visible.some(i => i.id === paid.id)); assert(visible.some(i => i.id === perDocument.id));
  assert(!visible.some(i => ['DRAFT', 'RASCUNHO', 'CANCELLED', 'CANCELED', 'CANCELADO', 'VOID', 'ARCHIVED', 'SUPERSEDED'].includes(i.status)));
  assert.equal((await call('/api/invoices/to-issue?status=unknown')).status, 400);
  const flat = await call('/api/core/invoices/external'); assert.equal(flat.status, 200); assert(visible.every(i => flat.body.invoices.some(row => row.id === i.id)));
  console.log('PASS both aliases reject malformed, unauthorized, withdrawn, unrequested and non-positive documents; paid/requested documents and missing external numbers remain visible');

  for (const [i, row] of [missing, paid, perDocument].entries()) {
    const number = stamp + ' FT ' + row.id, payload = await reviewed(row, number), before = await snapshot(row.id);
    const result = await call(routes[i % 2](row.id), payload); assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.invoice.externalInvoiceNo, number);
    const saved = await snapshot(row.id); assert.equal(saved.logs.length, 1); assert.equal(saved.audit.length, 1);
    assert.equal(saved.audit[0].metadata.kind, 'EXTERNAL_REFERENCE_ONLY'); assert.equal(saved.audit[0].metadata.checklistConfirmed, true); assert.equal(saved.audit[0].metadata.snapshot.lines.length, 2);
    for (const key of ['status', 'issueDate', 'paidAt', 'invoiceNumber', 'total', 'amount', 'totalAmount', 'taxRate', 'taxAmount', 'amountPaid', 'amountOpen']) assert.deepEqual(saved.invoice[key], before.invoice[key], key);
    assert.deepEqual(saved.invoice.lines, before.invoice.lines); assert.deepEqual(saved.invoice.payments, before.invoice.payments);
    assert.equal((await call(routes[(i + 1) % 2](row.id), payload)).body.idempotent, true); assert.deepEqual(await snapshot(row.id), saved);
    assert.equal((await call(routes[0](row.id), { externalInvoiceNo: number + ' changed' })).status, 409); assert.deepEqual(await snapshot(row.id), saved);
    assert.equal((await call(routes[1]((await fixture()).id), { externalInvoiceNo: number })).status, 409);
  }
  assert.deepEqual(await prisma.client.findUniqueOrThrow({ where: { id: client.id } }), adminBefore);
  await prisma.client.update({ where: { id: client.id }, data: { requiresInvoice: false } });
  assert((await list()).clients.some(c => c.id === client.id && c.issuedInvoices.some(i => i.id === paid.id)));
  await prisma.client.update({ where: { id: client.id }, data: { requiresInvoice: true } });
  await prisma.invoiceLine.update({ where: { id: paid.lines[0].id }, data: { description: 'Descrição alterada depois da associação' } });
  const historical = (await list()).clients.flatMap(c => c.issuedInvoices).find(row => row.id === paid.id);
  assert.equal(historical.externalRegistration.snapshot.lines[0].description, 'Manutenção mensal');
  assert.equal((await list(historical.externalInvoiceNo, 'issued')).clients.length, 1);
  console.log('PASS registration preserves prices, payments, balances and issue dates; retries are read-only; history and original service snapshot survive customer flag and later line changes');

  const stale = await fixture(), stalePayload = await reviewed(stale, stamp + ' stale');
  for (const change of [{ reviewedLineIds: [] }, { reviewedLineIds: [stale.lines[0].id] }, { expectedClientId: other.id }, { externalReviewToken: '0'.repeat(64) }]) assert.equal((await call(routes[0](stale.id), { ...stalePayload, ...change })).status, 409);
  await prisma.invoiceLine.update({ where: { id: stale.lines[0].id }, data: { description: 'Nova intervenção a conferir' } });
  assert.equal((await call(routes[1](stale.id), stalePayload)).status, 409); assert.equal((await snapshot(stale.id)).invoice.externalInvoiceNo, null);
  for (const table of ['CommunicationLog', 'AuditTrail']) {
    const row = await fixture(), body = await reviewed(row, stamp + table), before = await snapshot(row.id);
    const condition = table === 'CommunicationLog' ? `NEW.channel = 'EXTERNAL_INVOICE' AND NEW."referenceId" = ${row.id}` : `NEW.action = 'EXTERNAL_INVOICE_REGISTERED' AND NEW."entityId" = ${row.id}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_external_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA external registration rollback'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_external_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_external_failure()`);
    try { assert.equal((await call(routes[0](row.id), body)).status, 500); assert.deepEqual(await snapshot(row.id), before); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_external_failure ON "${table}"`); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_external_failure()'); }
    assert.equal((await call(routes[1](row.id), body)).status, 200);
  }
  const concurrent = await fixture(), repeated = await reviewed(concurrent, stamp + ' repeated');
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => call(routes[i % 2](concurrent.id), repeated)));
  assert(results.every(r => r.status === 200), JSON.stringify(results)); assert.equal((await snapshot(concurrent.id)).audit.length, 1); assert.equal((await snapshot(concurrent.id)).logs.length, 1);
  const a = await fixture(), b = await fixture(), shared = stamp + ' shared';
  const races = await Promise.all([call(routes[0](a.id), { externalInvoiceNo: shared }), call(routes[1](b.id), { externalInvoiceNo: shared })]);
  assert.deepEqual(races.map(r => r.status).sort(), [200, 409]); assert.equal(await prisma.invoice.count({ where: { externalInvoiceNo: shared } }), 1);
  const internal = await fixture({ status: 'DRAFT' }), external = await fixture(), common = stamp + ' internal';
  const mixed = await Promise.all([call(`/api/finance-os/invoices/${internal.id}/issue`, { invoiceNumber: common }), call(routes[0](external.id), { externalInvoiceNo: common })]);
  assert.deepEqual(mixed.map(r => r.status).sort(), [200, 409]); assert.equal(await prisma.invoice.count({ where: { OR: [{ externalInvoiceNo: common }, { invoiceNumber: common }] } }), 1);
  const separate = await fixture({ status: 'DRAFT' }), internalNumber = stamp + ' internal-only';
  assert.equal((await call(`/api/finance-os/invoices/${separate.id}/issue`, { invoiceNumber: internalNumber })).status, 200);
  assert.equal((await snapshot(separate.id)).invoice.externalInvoiceNo, null);
  assert((await list()).clients.flatMap(c => c.pendingInvoices).some(row => row.id === separate.id));
  assert.equal((await call(routes[0](separate.id), await reviewed(separate, stamp + ' official-separate'))).status, 200);
  const separated = await snapshot(separate.id); assert.equal(separated.invoice.invoiceNumber, internalNumber);
  assert.equal((await call(`/api/finance-os/invoices/${separate.id}/issue`, { invoiceNumber: internalNumber })).status, 200); assert.deepEqual(await snapshot(separate.id), separated);
  const noLines = await fixture({ lines: { create: [] } });
  assert.equal((await call(routes[0](noLines.id), await reviewed(noLines, stamp + ' whole-document'))).status, 200);
  console.log('PASS stale or partial checklists rejected, communication/audit failures roll back, eight retries write once, both aliases and internal issuance share number reservation');

  const uiClient = await prisma.client.create({ data: { name: stamp + " D'Água <img src=x onerror=window.qaInjected=true>", requiresInvoice: true } });
  const uiDoc = await fixture({ clientId: uiClient.id });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 900 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(({ token, user }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
    localStorage.setItem('cw_language', 'pt');
  }, { token, user });
  const page = await context.newPage(), errors = [], posts = []; page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/\/mark-issued$/.test(request.url())) posts.push(request.postDataJSON()); });
  const url = base + '/to-issue?status=all&q=' + encodeURIComponent(uiClient.name);
  await page.goto(url, { waitUntil: 'networkidle' });
  const form = () => page.locator(`form[data-invoice-id="${uiDoc.id}"]`), save = () => form().locator('[type=submit]');
  const ready = () => page.waitForFunction(() => document.getElementById('status').textContent.includes('cliente(s) visíveis'));
  await ready(); assert.equal(await form().count(), 1); assert.equal(await page.locator('#list img').count(), 0); assert.equal(await page.evaluate(() => !!window.qaInjected), false);
  assert.equal(await save().isDisabled(), true); await form().locator('input[type=checkbox]').first().check(); await form().locator('[name=externalInvoiceNo]').fill('FT QA UI 275'); assert.equal(await save().isDisabled(), true);
  await form().locator('input[type=checkbox]').nth(1).check(); assert.equal(await save().isDisabled(), false);
  await save().click(); await page.locator('.cw-ui-modal').waitFor(); assert.match(await page.locator('.cw-ui-modal').textContent(), /FT QA UI 275/);
  await page.locator('.cw-ui-modal button').filter({ hasText: 'Cancelar' }).click(); assert.equal(posts.length, 0); assert.equal(await form().locator('[name=externalInvoiceNo]').inputValue(), 'FT QA UI 275');
  const evidence = path.join(__dirname, '..', 'reports', 'field-visual', 'external-invoice-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0, 0)); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: path.join(evidence, width + '.png'), fullPage: true });
  }
  const mutationUrl = base + routes[0](uiDoc.id);
  await page.route(mutationUrl, async route => { await route.fetch(); await route.abort('failed'); });
  await save().click(); await save().dispatchEvent('click'); assert.equal(await page.locator('.cw-ui-modal').count(), 1);
  await page.locator('.cw-ui-modal button').filter({ hasText: 'Guardar número confirmado' }).click();
  await page.waitForFunction(id => document.querySelector(`form[data-invoice-id="${id}"] .external-result`).textContent.includes('mesmo número'), uiDoc.id);
  assert.equal(posts.length, 1); assert.equal((await snapshot(uiDoc.id)).audit.length, 1); assert.equal(await form().locator('[name=externalInvoiceNo]').inputValue(), 'FT QA UI 275');
  await page.unroute(mutationUrl); await save().click(); await page.locator('.cw-ui-modal button').filter({ hasText: 'Guardar número confirmado' }).click(); await ready();
  assert.equal(await form().count(), 0); assert.equal(posts.length, 2); assert.deepEqual(posts[0], posts[1]); assert.equal((await snapshot(uiDoc.id)).audit.length, 1);
  assert.match(await page.locator('#list').textContent(), /FT QA UI 275/); assert.match(await page.locator('#list').textContent(), /Serviços associados no registo/);
  console.log('PASS real browser checklist, apostrophes/inert text, explicit number confirmation, responsive layout and recovery after committed response is lost');

  const pending = await fixture({ clientId: uiClient.id });
  await page.locator('#refreshBtn').click(); await ready();
  const nextForm = () => page.locator(`form[data-invoice-id="${pending.id}"]`);
  async function fillNext() { for (const box of await nextForm().locator('input[type=checkbox]').all()) await box.check(); await nextForm().locator('[name=externalInvoiceNo]').fill('FT QA STALE 275'); }
  async function confirmNext() { await nextForm().locator('[type=submit]').click(); await page.locator('.cw-ui-modal button').filter({ hasText: 'Guardar número confirmado' }).click(); }
  await fillNext(); await prisma.invoiceLine.update({ where: { id: pending.lines[0].id }, data: { description: 'Serviço modificado após a consulta' } });
  await confirmNext(); await page.waitForFunction(id => document.querySelector(`form[data-invoice-id="${id}"] .external-result`).textContent.includes('mudaram'), pending.id);
  assert.equal((await snapshot(pending.id)).invoice.externalInvoiceNo, null);
  await page.locator('#refreshBtn').click(); await ready(); await fillNext();
  const beforeSwitch = posts.length; await nextForm().locator('[type=submit]').click();
  await page.locator('#search').fill('outra seleção'); await page.locator('#search').fill(uiClient.name);
  await page.locator('.cw-ui-modal button').filter({ hasText: 'Guardar número confirmado' }).click(); assert.equal(posts.length, beforeSwitch);
  await page.locator('#refreshBtn').click(); await ready(); await fillNext();
  await nextForm().locator('[type=submit]').click(); await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'token' })));
  await page.locator('.cw-ui-modal button').filter({ hasText: 'Guardar número confirmado' }).click(); assert.equal(posts.length, beforeSwitch); assert.equal(await page.locator('form.external-form').count(), 0);
  await page.locator('#refreshBtn').click(); await ready(); await fillNext();
  await page.route(base + routes[0](pending.id), route => route.fulfill({ status: 200, contentType: 'application/json', json: { ok: true, invoice: { id: uiDoc.id, clientId: uiClient.id, externalInvoiceNo: 'FT QA STALE 275', invoiceIssued: true } } }));
  await confirmNext(); await page.waitForFunction(id => document.querySelector(`form[data-invoice-id="${id}"] .external-result`).textContent.includes('não corresponde'), pending.id);
  assert.equal((await snapshot(pending.id)).invoice.externalInvoiceNo, null); await page.unroute(base + routes[0](pending.id));
  await page.route('**/api/invoices/to-issue?*', route => route.fulfill({ status: 200, contentType: 'application/json', json: { ok: true, summary: {}, clients: [{ id: uiClient.id, pendingInvoices: [{ id: pending.id, clientId: other.id, lines: [], externalReviewToken: '0'.repeat(64) }], issuedInvoices: [] }] } }));
  await page.locator('#refreshBtn').click(); await page.waitForFunction(() => document.getElementById('status').textContent.includes('incompleta')); assert.equal(await page.locator('form.external-form').count(), 0);
  assert.deepEqual(errors, []); assert.equal((await snapshot(pending.id)).audit.length, 0);
  console.log('PASS browser rejects stale service details, selection/session changes and wrong response identities without false success; invalid lists cannot submit');
  console.log('Evidence: ' + evidence);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
