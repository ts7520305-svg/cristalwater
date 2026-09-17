'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const stamp = Date.now(), admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const visual = path.join(__dirname, '../reports/field-visual/operational-pages-' + stamp); fs.mkdirSync(visual, { recursive: true });
  const user = { id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'QA priority client ' + stamp, active: true } });
  const pool = await prisma.pool.create({ data: { name: '<img src=x onerror=alert(1)> pool ' + stamp, clientId: client.id, priority: 0, monthlyAmount: 95 } });
  const legacy = await prisma.pool.create({ data: { name: 'QA legacy priority ' + stamp, clientId: client.id, priority: 7 } });
  const name = 'QA same technician name ' + stamp;
  const a = await prisma.technician.create({ data: { name, pin: 'OPA-' + stamp, active: true } });
  const b = await prisma.technician.create({ data: { name, pin: 'OPB-' + stamp, role: 'TEAM_LEADER', active: true } });
  for (const row of [
    { technicianId: a.id, status: 'DONE', endAt: new Date() }, { technicianId: a.id, status: 'PLANNED' },
    { technicianId: a.id, status: 'CANCELLED', endAt: new Date() }, { technicianId: b.id, status: 'DONE' },
    { technicianName: '__proto__', status: 'PLANNED' }
  ]) await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, ...row } });
  const api = (url, credential = token) => fetch(base + url, { headers: { Authorization: 'Bearer ' + credential } });
  const response = await api('/api/technician/ranking'), data = await response.json();
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(data.find(row => row.technicianId === a.id), { technicianId: a.id, name, total: 2, done: 1, performance: 50 });
  assert.deepEqual(data.find(row => row.technicianId === b.id), { technicianId: b.id, name, total: 1, done: 1, performance: 100 });
  assert(data.some(row => row.name === '__proto__' && row.total >= 1));
  for (const actor of [{ id: a.id, technicianId: a.id, principalType: 'TECHNICIAN', role: 'TECHNICIAN' }, { id: b.id, technicianId: b.id, principalType: 'TECHNICIAN', role: 'TEAM_LEADER' }, { id: client.id, clientId: client.id, principalType: 'CLIENT', role: 'CLIENT' }]) {
    assert.equal((await api('/api/technician/ranking', jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' }))).status, 403, actor.role);
    assert.equal((await api('/api/metrics/productivity', jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' }))).status, 403, actor.role);
  }
  console.log('PASS ranking API: administrator only, stable technician identities, cancelled exclusion, completed status and prototype-like legacy names');

  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(({ user, token }) => {
    for (const key of ['cristalwater_jwt', 'token']) localStorage.setItem(key, token);
    for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify(user));
    localStorage.setItem('cw_language', 'pt');
  }, { user, token });
  const goto = url => page.goto(base + url, { waitUntil: 'networkidle' });
  await goto('/ranking'); await page.waitForFunction(() => document.getElementById('status').dataset.state === 'ready');
  assert.equal(await page.locator('#ranking article').filter({ hasText: name }).count(), 2);
  assert.equal(await page.locator('#ranking.loading, #ranking[data-cw-state="loading"]').count(), 0, 'A completed list must not retain the legacy loading layout');
  assert((await page.locator('#ranking').textContent()).includes('1 de 2 visitas concluídas · 50%'));
  for (const [status, json, state] of [[503, [], 'error'], [202, [], 'error'], [200, { ok: true }, 'error'], [200, [], 'empty']]) {
    await page.route('**/api/technician/ranking', route => route.fulfill({ status, json })); await page.locator('#rankingReload').click();
    await page.waitForFunction(state => document.getElementById('status').dataset.state === state, state); assert.equal(await page.locator('#ranking article').count(), 0);
    await page.unroute('**/api/technician/ranking');
  }
  await page.locator('#rankingReload').click(); await page.waitForFunction(() => document.getElementById('status').dataset.state === 'ready');
  console.log('PASS ranking page: real records, retry, failed/malformed/queued reads and genuine empty state');

  const startAt = new Date('2026-09-01T10:00:00Z');
  for (const minutes of [20, 40]) await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, technicianId: a.id, status: 'DONE', startAt, endAt: new Date(startAt.getTime() + minutes * 60000) } });
  await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, technicianId: a.id, status: 'DONE', startAt, endAt: new Date(startAt.getTime() - 60000) } });
  const metricsResponse = await api('/api/metrics/productivity'), metrics = await metricsResponse.json();
  assert.equal(metricsResponse.status, 200); assert.match(metricsResponse.headers.get('cache-control'), /no-store/);
  assert.equal(metrics.clients.find(row => row.name === client.name)?.avgTime, 30, 'Averages must use only visits with valid recorded duration');
  const metricA = metrics.technicians.find(row => row.id === a.id), metricB = metrics.technicians.find(row => row.id === b.id);
  assert.equal(metricA.measuredVisits, 2); assert.equal(metricA.totalVisits, 4); assert.equal(metricA.totalTime, 60); assert.equal(metricA.avgTime, 30);
  assert.equal(metricB.totalVisits, 1); assert.equal(metricB.measuredVisits, 0); assert.equal(metricB.avgTime, null, 'Missing duration is unknown, not zero minutes');
  const sameNameClient = await prisma.client.create({ data: { name: client.name, active: true } });
  await prisma.serviceVisit.create({ data: { clientId: sameNameClient.id, technicianName: '__proto__', status: 'DONE', startAt, endAt: startAt } });
  await prisma.serviceVisit.create({ data: { poolId: pool.id, technicianName: 'QA missing customer ' + stamp, status: 'DONE', startAt, endAt: new Date(startAt.getTime() + 15 * 60000) } });
  const identityMetrics = await (await api('/api/metrics/productivity')).json();
  assert.equal(identityMetrics.clients.filter(row => row.name === client.name).length, 2, 'Customer names are not identities');
  assert.equal(identityMetrics.clients.find(row => row.id === sameNameClient.id).avgTime, 0, 'A recorded zero duration is distinct from missing duration');
  assert.equal(identityMetrics.clients.find(row => row.id === client.id).totalVisits, 5, 'An unassigned historical visit must not inherit the pool customer');
  assert(identityMetrics.clients.some(row => row.id === null));
  assert(identityMetrics.technicians.some(row => row.id === null && row.name === '__proto__' && row.measuredVisits >= 1));
  const recipient = await prisma.client.create({ data: { name: 'QA subsequent customer ' + stamp, active: true } });
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: recipient.id } });
  const reassignedMetrics = await (await api('/api/metrics/productivity')).json();
  assert.equal(reassignedMetrics.clients.find(row => row.id === client.id)?.avgTime, 30); assert(!reassignedMetrics.clients.some(row => row.id === recipient.id), 'Historical work stays with its recorded customer');
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: client.id } });
  await goto('/metrics'); await page.waitForFunction(() => document.getElementById('status').dataset.state === 'ready');
  assert.equal(await page.locator('#metricsList [data-metric-kind="technicians"] [data-metric-id="' + a.id + '"] [data-average]').textContent(), '30 min');
  assert.equal(await page.locator('#metricsList [data-metric-kind="technicians"] [data-metric-id="' + b.id + '"] [data-average]').textContent(), 'Sem duração válida');
  assert.equal(await page.locator('script[src*="cdn.jsdelivr.net"]').count(), 0, 'Metrics must remain readable without an external chart library');
  for (const [status, json, state] of [[503, {}, 'error'], [200, { ok: true, clients: [{ name: 'invalid' }], technicians: [] }, 'error'], [200, { ok: true, clients: [], technicians: [] }, 'empty']]) {
    await page.route('**/api/metrics/productivity', route => route.fulfill({ status, json })); await page.locator('#metricsReload').click();
    await page.waitForFunction(state => document.getElementById('status').dataset.state === state, state); assert.equal(await page.locator('#metricsList article').count(), 0);
    await page.unroute('**/api/metrics/productivity');
  }
  await page.locator('#metricsReload').click(); await page.waitForFunction(() => document.getElementById('status').dataset.state === 'ready');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.locator('#metricsList article').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.scrollWidth <= node.clientWidth + 1)), 'Metric names and values fit narrow screens');
    assert.equal(await page.locator('#metricsList.loading, #metricsList[data-cw-state="loading"]').count(), 0);
    assert(await page.locator('#metricsList article').evaluateAll(nodes => nodes.every(node => node.clientWidth >= 240)), 'Metric cards retain a readable width');
    await page.screenshot({ path: path.join(visual, 'metrics-' + width + '.png') });
  }
  console.log('PASS metrics: measured duration denominator, unknown/invalid times, stable technician and historical customer identities, local bars, failures and empty states');

  // Keep a genuine general-editor draft while exercising the separate priority
  // editor. Its stored v1 shape must not be migrated or reinterpreted.
  await goto('/admin-pools'); await page.evaluate(id => editPool(id), pool.id);
  await page.locator('#poolEditName').waitFor(); await page.waitForFunction(() => !document.getElementById('poolEditSave').disabled);
  await page.locator('#poolEditNotes').fill('Original general editor draft');
  const draftKey = 'cwPoolEditDraft:v1:USER:' + admin.id + ':' + pool.id;
  const oldDraft = await page.evaluate(key => sessionStorage.getItem(key), draftKey); assert(oldDraft);
  await goto('/admin-priority'); await page.waitForFunction(() => document.getElementById('priorityStatus').dataset.state === 'ready');
  const card = id => page.locator('#list [data-pool-id="' + id + '"]');
  assert.equal(await card(pool.id).locator('strong').textContent(), pool.name); assert.equal(await card(pool.id).locator('img').count(), 0);
  const open = async id => { await card(id).locator('button').click(); await page.waitForFunction(() => document.getElementById('poolEditForm').getAttribute('aria-busy') === 'false' && document.getElementById('poolEditPriority').value !== ''); };
  const idle = () => page.waitForFunction(() => document.getElementById('poolEditForm').getAttribute('aria-busy') === 'false');
  const count = id => prisma.poolEditRequest.count({ where: { poolId: id } });
  await open(pool.id); assert.equal(await page.locator('#poolEditNotes').inputValue(), '', 'A separate priority draft cannot absorb an old general draft');
  await page.locator('#poolEditPriority').selectOption('2'); let sent;
  await page.route('**/api/pools/' + pool.id, async route => {
    sent = route.request().postDataJSON(); await route.fetch(); await route.fulfill({ status: 503, json: { error: 'QA lost reply after commit' } });
  });
  await page.locator('#poolEditSave').click(); await idle();
  assert.equal((await prisma.pool.findUnique({ where: { id: pool.id } })).priority, 2); assert.equal(await count(pool.id), 1);
  assert.equal(await page.locator('#poolEditRetry').isVisible(), true); assert(sent.requestId && sent.expectedVersion); assert.equal(sent.priority, 2);
  assert(!Object.hasOwn(sent, 'notes')); assert.equal(await page.evaluate(key => sessionStorage.getItem(key), draftKey), oldDraft);
  await page.unroute('**/api/pools/' + pool.id); await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#poolEditPendingList [data-pool-edit-pending="' + pool.id + '"]').click(); await idle();
  await page.locator('#poolEditRetry').click(); await idle(); assert.equal(await count(pool.id), 1);
  assert.equal(await card(pool.id).locator('[data-priority]').getAttribute('data-priority'), '2');
  await page.locator('#poolEditCancel').click(); await open(pool.id); await page.locator('#poolEditPriority').selectOption('1');
  await prisma.pool.update({ where: { id: pool.id }, data: { priority: 0 } });
  await page.locator('#poolEditSave').click(); await idle(); assert.equal(await count(pool.id), 1);
  await page.locator('#poolEditReview').click(); await idle(); await page.locator('[data-pool-edit-field="priority"]').selectOption('draft');
  await page.locator('#poolEditApplyReview').click(); await idle(); assert.equal((await prisma.pool.findUnique({ where: { id: pool.id } })).priority, 0);
  await page.locator('#poolEditSave').click(); await idle(); assert.equal(await count(pool.id), 2); assert.equal((await prisma.pool.findUnique({ where: { id: pool.id } })).priority, 1);
  await page.locator('#poolEditCancel').click(); await open(legacy.id); assert.equal(await page.locator('#poolEditPriority').inputValue(), '7');
  await page.locator('#poolEditName').fill('QA old priority kept ' + stamp); await page.locator('#poolEditSave').click(); await idle(); assert.equal((await prisma.pool.findUnique({ where: { id: legacy.id } })).priority, 7);
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), draftKey), oldDraft);
  console.log('PASS priorities: real API shape, confirmed versioned writes, lost-response/reload recovery without duplication, explicit conflict review and old priority/general draft preserved');

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#poolEditPriority').scrollIntoViewIfNeeded();
    const bounds = await page.locator('.pool-edit-card').boundingBox(); assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert(await page.locator('#poolEditPriority').isVisible());
    await page.screenshot({ path: path.join(visual, 'priority-' + width + '.png') });
  }
  await page.locator('#poolEditCancel').click();
  await page.route('**/api/pools', route => route.fulfill({ status: 200, json: [] })); await page.locator('#priorityReload').click();
  await page.waitForFunction(() => document.getElementById('priorityStatus').dataset.state === 'error'); assert.equal(await page.locator('#list article').count(), 0);
  await page.unroute('**/api/pools');
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), arrival = new Promise(resolve => { entered = resolve; });
  await page.route('**/api/pools', async route => { const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }); });
  await page.locator('#priorityReload').click(); await arrival;
  await page.evaluate(() => localStorage.setItem('cristalwater_user', '{changed-account'));
  release(); await page.waitForFunction(() => document.getElementById('priorityStatus').dataset.state === 'session');
  assert.equal(await page.locator('#list article').count(), 0); assert(await page.locator('#priorityReload').isDisabled());
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), draftKey), oldDraft); assert.deepEqual(errors, []);
  console.log('PASS priorities: mobile/desktop editor, malformed read and delayed response after account change; visual evidence ' + visual);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
