'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const fs = require('node:fs/promises');
const path = require('node:path');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
const R = require('../frontend/cw-operational-risk-rules');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const prefix = 'QA Risk Summary ' + randomUUID();
const sign = value => jwt.sign(value, getJwtSecret(), { expiresIn: '1h' });
let client, technician, originalRules, rulesRead = false, browser, probe;

(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const call = async (credential = token, origin = base) => {
    const response = await fetch(origin + '/api/operational-risk/summary', { headers: credential ? { Authorization: 'Bearer ' + credential } : {} });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  };
  originalRules = await prisma.systemSetting.findUnique({ where: { key: R.key } });
  rulesRead = true;
  const rules = Object.fromEntries(Object.entries(R.defaults).map(([key, value]) => [key, typeof value === 'boolean' ? false : value]));
  rules.pendingOperationalLocks = rules.overduePayments = true;
  await prisma.systemSetting.upsert({ where: { key: R.key }, create: { key: R.key, value: JSON.stringify(rules) }, update: { value: JSON.stringify(rules) } });
  const baseline = (await call()).body;
  client = await prisma.client.create({ data: { name: prefix + ' <img src=x onerror=alert(1)>', status: 'PAUSED', active: false, creditBalance: 999, notes: 'PRIVATE_RISK_CLIENT_NOTES' } });
  technician = await prisma.technician.create({ data: { name: prefix, active: true } });
  const at = new Date('2000-01-01T00:00:00Z');
  await prisma.operationalLock.createMany({ data: Array.from({ length: 252 }, (_, i) => ({ clientId: client.id, lockType: prefix, title: prefix + ' lock ' + i, severity: i % 2 ? 'CRITICAL' : 'WARNING', status: i === 251 ? 'RESOLVED' : 'PENDING', createdAt: at, payload: { private: 'PRIVATE_LOCK_PAYLOAD' } })) });
  const invoice = (key, extra = {}) => ({ clientId: client.id, invoiceNumber: prefix + ' ' + key, amount: 1.11, amountOpen: 1.11, status: 'PENDING', dueDate: at, createdAt: at, notes: 'PRIVATE_RISK_INVOICE_NOTES', ...extra });
  const data = Array.from({ length: 503 }, (_, i) => invoice('ordinary-' + i));
  data.push(invoice('fallback', { amount: 20, amountPaid: 7.66, amountOpen: 0 }));
  for (const status of ['OVERDUE', 'EM_ATRASO', 'ATRASO', 'VENCIDA', ' overdue ']) data.push(invoice('alias-' + status, { status, dueDate: null }));
  for (const status of ['DRAFT', 'RASCUNHO', 'CANCELLED', 'CANCELED', 'CANCELADO', 'VOID', 'ARCHIVED', 'SUPERSEDED', ' draft ']) data.push(invoice('excluded-' + status, { status }));
  data.push(invoice('paid', { status: 'PAID', amountPaid: 1.11, amountOpen: 0 }), invoice('future', { dueDate: new Date('2099-01-01T00:00:00Z') }), invoice('undated', { dueDate: null }), invoice('zero', { amount: 0, amountOpen: 0 }));
  await prisma.invoice.createMany({ data });
  const snapshot = async () => ({ client: await prisma.client.findUnique({ where: { id: client.id } }), invoices: await prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), locks: await prisma.operationalLock.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), payments: await prisma.payment.count(), communications: await prisma.communicationLog.count() });
  const before = await snapshot();
  const result = await call();
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.cache, 'private, no-store');
  const packet = result.body;
  const locks = packet.issues.filter(issue => issue.source === 'OPERATIONAL_LOCK' && issue.clientId === client.id);
  const overdue = packet.issues.filter(issue => issue.source === 'INVOICE' && issue.clientId === client.id);
  assert.equal(locks.length, 251, 'All pending locks beyond the former 200-row limit must be returned');
  assert.equal(overdue.length, 509, 'All overdue receivables beyond 500, aliases and legacy balances must be returned');
  assert.equal(new Set(packet.issues.map(issue => issue.id)).size, packet.issues.length);
  assert.deepEqual(packet.counts, { total: packet.issues.length, critical: packet.issues.filter(issue => issue.severity === 'CRITICAL').length, warning: packet.issues.filter(issue => issue.severity !== 'CRITICAL').length });
  assert.equal(packet.counts.total, baseline.counts.total + 760);
  assert.equal(packet.complete, true);
  assert.equal(packet.byClientId[client.id].length, 760);
  const ids = new Set(overdue.map(issue => issue.id));
  for (const row of before.invoices) {
    const eligible = / ordinary-| fallback$| alias-/.test(row.invoiceNumber);
    assert.equal(ids.has('OVERDUE_PAYMENT:' + row.id), eligible, row.invoiceNumber);
  }
  assert(overdue.some(issue => issue.message.includes('12.34 EUR')));
  for (const privateText of ['PRIVATE_RISK_CLIENT_NOTES', 'PRIVATE_RISK_INVOICE_NOTES', 'PRIVATE_LOCK_PAYLOAD']) assert(!JSON.stringify(packet).includes(privateText));
  for (const credential of [null, 'invalid', sign({ id: technician.id, technicianId: technician.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' }), sign({ id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' })]) assert([401, 403].includes((await call(credential)).status));

  const service = require('../src/services/operationalRiskSummaryService');
  const originalRead = service.read;
  const app = require('express')();
  app.use('/api/operational-risk', require('../src/routes/operationalRiskRoutes'));
  probe = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  let batches = 0;
  try {
    service.read = () => originalRead({ $transaction: (read, options) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      return prisma.$transaction(tx => read(new Proxy(tx, { get(target, key) {
        if (key !== 'invoice') return target[key];
        return { findMany: args => { if (++batches === 2) throw Error('PRIVATE_LATER_BATCH_FAILURE'); return tx.invoice.findMany(args); } };
      } })), options);
    } });
    const failure = await call(token, 'http://127.0.0.1:' + probe.address().port);
    assert.equal(batches, 2);
    assert.equal(failure.status, 503);
    assert.deepEqual(failure.body, { ok: false, code: 'RISK_SUMMARY_UNAVAILABLE' });
  } finally { service.read = originalRead; }
  console.log('PASS summary API: 251 pending locks, 509 overdue receivables, full counts/groups, excluded drafts and withdrawn/settled documents, legacy balance, denied roles and no partial success after later-batch failure');

  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block', extraHTTPHeaders: { Authorization: 'Bearer ' + token } });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.method()); });
  await page.route('**/admin-qa-risk-summary', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/cw-polish.css"></head><body><main></main><script src="/cw-operational-risk.js"></script></body></html>' }));
  await page.goto(base + '/admin-qa-risk-summary', { waitUntil: 'networkidle' });
  const panel = page.locator('#cwOperationalRiskPanel');
  await panel.waitFor();
  await panel.locator('[data-cw-risk-toggle]').click();
  const seen = new Set();
  for (;;) {
    const pageIds = await panel.locator('[data-risk-id]').evaluateAll(items => items.map(item => item.dataset.riskId));
    assert(pageIds.length > 0 && pageIds.length <= 8);
    for (const id of pageIds) { assert(!seen.has(id), 'Duplicate page item ' + id); seen.add(id); }
    if (await panel.locator('[data-cw-risk-next]').isDisabled()) break;
    await panel.locator('[data-cw-risk-next]').click();
  }
  assert.deepEqual([...seen].sort(), packet.issues.map(issue => issue.id).sort());
  assert(await panel.locator('.dot.warning').count() > 0, 'Warnings remain reachable when critical alerts exist');
  await panel.locator('[data-cw-risk-previous]').focus();
  await page.keyboard.press('Enter');
  assert(!(await panel.locator('[data-cw-risk-next]').isDisabled()));
  assert.equal(await panel.locator('img,script').count(), 0);
  const visual = path.join(__dirname, '../reports/field-visual/operational-risk-summary');
  await fs.mkdir(visual, { recursive: true });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    assert(await panel.locator('[data-cw-risk-previous],[data-cw-risk-next]').evaluateAll(items => items.every(item => item.getBoundingClientRect().height >= 44)));
    await page.screenshot({ path: path.join(visual, 'pt-' + width + '.png') });
  }
  await page.route('**/api/operational-risk/summary', route => route.abort('failed'), { times: 1 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#cwOperationalRiskUnavailable').waitFor();
  assert.equal(await panel.count(), 0);
  await page.route('**/api/operational-risk/summary', async route => { const response = await route.fetch(), body = await response.json(); body.counts.total--; await route.fulfill({ response, json: body }); }, { times: 1 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#cwOperationalRiskUnavailable').waitFor();
  assert.equal(await panel.count(), 0);
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(await snapshot(), before);
  console.log('PASS summary UI: every issue reachable exactly once, eight visible entries per page, warnings after critical alerts, keyboard navigation, 320/390/1440 layouts, escaped content, unavailable/malformed states and no business writes');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (probe) await new Promise(resolve => probe.close(resolve));
  if (client) {
    await prisma.operationalLock.deleteMany({ where: { clientId: client.id, lockType: prefix } });
    await prisma.invoice.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
  if (technician) await prisma.technician.delete({ where: { id: technician.id } });
  if (rulesRead) {
    if (originalRules) await prisma.systemSetting.update({ where: { key: R.key }, data: { value: originalRules.value, notes: originalRules.notes, updatedAt: originalRules.updatedAt } });
    else await prisma.systemSetting.deleteMany({ where: { key: R.key } });
  }
  await prisma.$disconnect();
});
