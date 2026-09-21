'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.FISCAL_ISSUING_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const stamp = 'QA external summary ' + randomUUID();
const gate = () => { let release; return { promise: new Promise(r => { release = r; }), release }; };
const mapping = { officialInvoiceClients: 'clients', officialInvoiceTotal: 'totalInvoices', officialInvoicePending: 'pendingInvoices', officialInvoicePendingAmount: 'pendingTotal', officialInvoiceConfirmed: 'confirmedReferences', officialInvoiceReview: 'reviewReferences' };
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const user = { id: admin.id, role: 'ADMIN' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  async function call(route, body, custom = headers) {
    const response = await fetch(base + route, { headers: custom, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  }
  async function get(route) { const r = await call(route); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; }
  const listing = () => get('/api/invoices/to-issue?status=all');
  const dashboard = (month = '1999-01') => get('/api/dashboard/admin?monthRef=' + month);
  async function consistent() {
    const list = await listing(), data = await dashboard();
    for (const [key, source] of Object.entries(mapping)) assert.equal(data.summary[key], list.summary[source], key);
    return data;
  }
  const before = await consistent();
  const client = await prisma.client.create({ data: { name: stamp, requiresInvoice: true } });
  const perDocument = await prisma.client.create({ data: { name: stamp + ' document request', requiresInvoice: false } });
  const historical = await prisma.client.create({ data: { name: stamp + ' historical', requiresInvoice: false } });
  await prisma.client.create({ data: { name: stamp + ' awaiting services', requiresInvoice: true } });
  const fixture = (amount, extra = {}) => prisma.invoice.create({ data: { clientId: client.id, status: 'PENDING', amount, total: amount, totalAmount: amount, amountOpen: amount,
    lines: { create: { description: stamp + ' maintenance', quantity: 1, unitPrice: amount, total: amount, lineTotal: amount } }, ...extra }, include: { lines: true } });
  const missing = await fixture(12.3, { status: 'ISSUED', invoiceIssued: true, invoiceNumber: stamp + ' internal' });
  await fixture(0.1);
  await fixture(0.2, { status: 'PAID', amountOpen: 0, amountPaid: 0.2, payments: { create: { amount: 0.2, amountCents: 20, method: 'CASH' } } });
  await fixture(0.3, { invoiceIssued: true, externalInvoiceNo: ' \u00a0\ufeff ' });
  await fixture(5, { clientId: perDocument.id, requiresInvoice: true });
  for (const status of ['DRAFT', 'RASCUNHO', 'CANCELLED', 'CANCELED', 'CANCELADO', 'VOID', 'ARCHIVED', 'SUPERSEDED']) await fixture(100, { status });
  await fixture(0);
  const internalNo = stamp + ' copied', copied = await fixture(9, { invoiceNumber: internalNo, externalInvoiceNo: internalNo });
  const legacy = await fixture(8, { clientId: historical.id, status: 'CANCELLED', externalInvoiceNo: stamp + ' old external' });
  const duplicateNo = stamp + ' duplicate';
  await fixture(10, { externalInvoiceNo: '\u00a0' + duplicateNo + '\ufeff' });
  await fixture(10, { clientId: historical.id, status: 'DRAFT', invoiceNumber: duplicateNo });
  await fixture(11, { externalInvoiceNo: 'invalid\n' + stamp });
  const confirmed = await fixture(6), mismatch = await fixture(7);
  for (const row of [confirmed, mismatch]) assert.equal((await call(`/api/invoices/${row.id}/mark-issued`, { externalInvoiceNo: stamp + ' FT ' + row.id })).status, 200);
  await prisma.invoice.update({ where: { id: mismatch.id }, data: { externalInvoiceNo: null } });
  const correctionNo = stamp + ' corrected', corrected = await fixture(15, { invoiceIssued: true, invoiceNumber: correctionNo, externalInvoiceNo: correctionNo });
  async function review(id, decision) {
    const row = (await listing()).clients.flatMap(c => c.invoices).find(i => i.id === id);
    const result = await call(`/api/invoices/${id}/review-external-reference`, { requestId: randomUUID(), decision, note: 'Reviewed isolated QA documents', expectedClientId: row.clientId,
      externalInvoiceNo: row.externalInvoiceNo, externalReferenceReviewToken: row.externalReferenceReview.token, reviewedLineIds: row.lines.map(line => line.id) });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
  await review(corrected.id, 'INTERNAL_ONLY');
  const after = await consistent();
  assert.equal(after.summary.officialInvoiceClients - before.summary.officialInvoiceClients, 4);
  assert.equal(after.summary.officialInvoicePending - before.summary.officialInvoicePending, 6);
  assert.equal(Math.round(after.summary.officialInvoicePendingAmount * 100) - Math.round(before.summary.officialInvoicePendingAmount * 100), 3290);
  assert.equal(after.summary.officialInvoiceConfirmed - before.summary.officialInvoiceConfirmed, 1);
  assert.equal(after.summary.officialInvoiceReview - before.summary.officialInvoiceReview, 5);
  assert.equal(after.summary.officialInvoiceTotal - before.summary.officialInvoiceTotal, 12);
  const pendingRows = (await listing()).clients.flatMap(c => c.pendingInvoices);
  assert(pendingRows.some(row => row.id === missing.id)); assert(pendingRows.some(row => row.id === corrected.id));
  assert(!pendingRows.some(row => row.id === mismatch.id));
  const differentMonth = await dashboard('2021-07');
  for (const key of Object.keys(mapping)) assert.equal(differentMonth.summary[key], after.summary[key], 'External register totals cover all dates');
  const filtered = await get('/api/invoices/to-issue?status=pending&q=' + encodeURIComponent(randomUUID()));
  assert.equal(filtered.clients.length, 0);
  for (const [key, source] of Object.entries(mapping)) assert.equal(after.summary[key], filtered.summary[source]);
  console.log('PASS internal issuance/paid documents/Unicode blanks remain pending; drafts and withdrawn documents excluded; per-document requests, history, duplicates, confirmed references and cents agree globally');

  const financialKeys = ['totalBilledAll', 'totalPaidAll', 'totalOpenAll', 'monthBilled', 'monthPaid', 'monthOpen'];
  await review(legacy.id, 'CONFIRM_EXTERNAL');
  const reviewed = await consistent();
  assert.equal(reviewed.summary.officialInvoiceConfirmed, after.summary.officialInvoiceConfirmed + 1);
  assert.equal(reviewed.summary.officialInvoiceReview, after.summary.officialInvoiceReview - 1);
  for (const key of financialKeys) assert.equal(reviewed.summary[key], after.summary[key], key);
  const snapshot = () => prisma.invoice.findMany({ where: { clientId: { in: [client.id, perDocument.id, historical.id] } }, include: { lines: true, payments: true }, orderBy: { id: 'asc' } });
  const unchanged = await snapshot(), auditCount = await prisma.auditTrail.count(), logCount = await prisma.communicationLog.count();
  await consistent(); await dashboard();
  assert.deepEqual(await snapshot(), unchanged); assert.equal(await prisma.auditTrail.count(), auditCount); assert.equal(await prisma.communicationLog.count(), logCount);
  const response = await call('/api/dashboard/admin'); assert.match(response.cache, /private/); assert.match(response.cache, /no-store/);
  assert.equal((await call('/api/dashboard/admin', undefined, {})).status, 401);
  const tech = await prisma.technician.create({ data: { name: stamp + ' technician', active: true } });
  const leader = await prisma.technician.create({ data: { name: stamp + ' leader', role: 'TEAM_LEADER', active: true } });
  for (const principal of [{ id: client.id, clientId: client.id, principalType: 'CLIENT', role: 'CLIENT' }, { id: tech.id, role: 'TECHNICIAN' }, { id: leader.id, role: 'TEAM_LEADER' }]) {
    assert.equal((await call('/api/dashboard/admin', undefined, { Authorization: 'Bearer ' + jwt.sign(principal, getJwtSecret()) })).status, 403);
  }
  const repository = require('../src/dal/FinanceOsRepository'), transaction = repository.transaction;
  repository.transaction = async () => { throw Error('QA external register unavailable'); };
  try { await assert.rejects(require('../src/controllers/dashboardController').getAdminDashboardData(), /QA external register unavailable/); }
  finally { repository.transaction = transaction; }
  console.log('PASS historical confirmation updates counts without financial changes; read-only summaries, ADMIN scope, private responses and unavailable-source failure preserved');

  const payload = await dashboard(new Date().toISOString().slice(0, 7));
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(({ user, token }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
    localStorage.setItem('cw_language', 'pt');
  }, { user, token });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
  const card = kind => page.locator(`[data-external-invoice="${kind}"]`);
  const ready = () => page.waitForFunction(() => document.getElementById('status').textContent === 'Resumo Operacional online');
  const load = async () => { await page.goto(base + '/admin-dashboard', { waitUntil: 'networkidle' }); await ready(); };
  await load();
  assert.equal(await card('pending').locator('strong').textContent(), String(payload.summary.officialInvoicePending));
  assert.equal(await card('review').locator('strong').textContent(), String(payload.summary.officialInvoiceReview));
  assert.match(await card('pending').textContent(), new RegExp(payload.summary.officialInvoiceConfirmed + ' referência'));
  assert.equal(await card('pending').getAttribute('href'), '/to-issue?status=pending');
  assert.equal(await card('review').getAttribute('href'), '/to-issue?status=review');
  assert(!/por emitir|Fatura real/.test(await card('pending').textContent()));
  const evidence = path.join(__dirname, '..', 'reports', 'field-visual', 'external-invoice-summary-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Dashboard must fit at ' + width);
    assert(await page.locator('[data-external-invoice]').evaluateAll(cards => cards.every(card => {
      const bounds = card.getBoundingClientRect(), children = [...card.children].map(child => child.getBoundingClientRect());
      return children.every(child => child.left >= bounds.left && child.right <= bounds.right + 1)
        && children.slice(1).every((child, i) => child.top >= children[i].bottom);
    })), 'Fiscal card content must remain legible without overlaps at ' + width);
    await page.locator('#adminRoleDashboard').screenshot({ path: path.join(evidence, width + '.png') });
    if (width === 320) {
      await card('pending').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, '320-fiscal-viewport.png') });
    }
  }
  await card('review').click(); await page.waitForURL('**/to-issue?status=review');
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('cliente(s) visíveis'));
  assert.equal(await page.locator('#statusFilter').inputValue(), 'review'); assert(await page.locator(`[data-invoice-id="${copied.id}"]`).count());
  await load(); await card('pending').click(); await page.waitForURL('**/to-issue?status=pending');
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('cliente(s) visíveis'));
  assert(await page.locator(`[data-invoice-id="${missing.id}"]`).count());
  await load();
  const endpoint = '**/api/dashboard/admin?*';
  await page.route(endpoint, route => route.fulfill({ status: 503, contentType: 'application/json', json: { ok: false } }));
  await page.evaluate(() => loadDashboard());
  assert.equal(await card('pending').locator('strong').textContent(), '—'); assert.equal(await card('review').locator('strong').textContent(), '—');
  assert.equal(await card('pending').getAttribute('href'), '/to-issue?status=all'); await page.unroute(endpoint);
  const malformed = structuredClone(payload); delete malformed.summary.officialInvoiceReview;
  await page.route(endpoint, route => route.fulfill({ contentType: 'application/json', json: malformed }));
  await page.evaluate(() => loadDashboard()); assert.equal(await card('review').locator('strong').textContent(), '—');
  assert.match(await page.locator('#status').textContent(), /indisponível/); await page.unroute(endpoint);
  const zero = structuredClone(payload);
  for (const key of Object.keys(mapping)) zero.summary[key] = 0;
  await page.route(endpoint, route => route.fulfill({ contentType: 'application/json', json: zero }));
  await page.evaluate(() => loadDashboard());
  assert.equal(await card('pending').locator('strong').textContent(), '0'); assert.equal(await card('review').locator('strong').textContent(), '0');
  assert.equal(await card('review').getAttribute('href'), '/to-issue?status=all'); await page.unroute(endpoint);

  for (const mode of ['newer request', 'session A-B-A', 'month changed']) {
    const arrived = gate(), release = gate(), finished = gate(); let calls = 0;
    await page.route(endpoint, async route => {
      if (++calls > 1) return route.fulfill({ contentType: 'application/json', json: payload });
      arrived.release(); await release.promise;
      try { await route.fulfill({ contentType: 'application/json', json: zero }); }
      catch (e) { if (!/closed|handled|cancel/i.test(e.message)) throw e; }
      finally { finished.release(); }
    });
    await page.evaluate(() => { void loadDashboard(); }); await arrived.promise;
    if (mode === 'newer request') await page.evaluate(() => loadDashboard());
    else if (mode === 'session A-B-A') await page.evaluate(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'token' })); window.dispatchEvent(new StorageEvent('storage', { key: 'token' })); });
    else await page.locator('#monthRef').fill('2020-06');
    release.release(); await finished.promise; await page.unroute(endpoint);
    assert.equal(await card('pending').locator('strong').textContent(), mode === 'newer request' ? String(payload.summary.officialInvoicePending) : '—', mode);
    await page.evaluate(() => loadDashboard()); await ready();
  }
  assert.deepEqual(errors, []);
  console.log('PASS real browser counts, exact pending/review links, responsive cards, failure versus zero, malformed summaries and late response/session/month protection');
  console.log('Evidence: ' + evidence);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
