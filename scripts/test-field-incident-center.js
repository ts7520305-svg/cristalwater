'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const prefix = 'QA Incident ' + randomUUID();
let browser, probe, client, tech;
const ids = [];

(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const token = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const call = async (endpoint = '', method = 'GET', body, credential = token, origin = base) => {
    const response = await fetch(origin + '/api/incidents' + endpoint, { method, headers: { ...(credential ? { Authorization: 'Bearer ' + credential } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  const create = async extra => {
    const row = await prisma.incident.create({ data: { type: 'QA', severity: 'CRITICAL', title: prefix + ' <img src=x onerror=alert(1)> ' + 'Z'.repeat(180), description: 'Literal <script>alert(1)</script>', status: 'OPEN', source: 'QA', impactScore: 70, priorityScore: 80, slaDeadline: new Date(Date.now() + 600000), ...extra } });
    ids.push(row.id); return row;
  };
  const first = await create({}), second = await create({ severity: 'HIGH', title: prefix + ' second' });
  const app = require('express')(); app.use(require('express').json());
  app.use('/api/incidents', require('../src/routes/incidentRoutes'));
  probe = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  const origin = 'http://127.0.0.1:' + probe.address().port;
  const originalFind = prisma.incident.findMany;
  let fault;
  try {
    prisma.incident.findMany = async () => { throw Error('PRIVATE_INCIDENT_DATABASE_FAILURE'); };
    fault = await call('', 'GET', undefined, token, origin);
  } finally { prisma.incident.findMany = originalFind; }

  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block', timezoneId: 'Europe/Lisbon' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, user }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
  }, { token, user: { id: admin.id, role: 'ADMIN', name: 'QA administrator' } });
  const page = await context.newPage(), errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/incidents') && request.method() === 'POST') writes.push(request.url()); });
  // Serve the actual server read, narrowed to this test's own records for deterministic counters.
  await page.route('**/api/incidents', async route => {
    const response = await route.fetch(), data = await response.json();
    if (Array.isArray(data.incidents)) data.incidents = data.incidents.filter(row => ids.includes(row.id));
    await route.fulfill({ response, json: data });
  });
  await page.goto(base + '/incident-center', { waitUntil: 'networkidle' });
  const firstCard = page.locator('.incident').filter({ hasText: first.title }).first();
  await firstCard.locator('.btn-resolve').waitFor();
  await page.route('**/api/incidents/status/' + first.id, route => route.fulfill({ status: 403, json: { ok: false, error: 'Forbidden' } }), { times: 1 });
  const refused = page.waitForResponse(response => response.url().endsWith('/api/incidents/status/' + first.id) && response.status() === 403);
  await firstCard.locator('.btn-resolve').click(); await refused;
  await page.waitForFunction(() => !document.querySelector('#actionStatus') || document.querySelector('#actionStatus').textContent.includes('permissão'));
  const falseSuccess = await page.locator('#incidentTimeline').innerText();
  if (process.env.CW_INCIDENT_REGRESSION_ONLY === 'true') {
    console.log(JSON.stringify({ readFailureStatus: fault.status, readFailureBody: fault.body, refusedWriteReportedResolved: falseSuccess.includes('Incidente resolvido') }));
    assert.equal(fault.status, 503, 'Database failures must not appear as an empty successful list');
    assert(!falseSuccess.includes('Incidente resolvido'), 'Refused write must not be shown as resolved');
    return;
  }
  assert.equal(fault.status, 503);
  assert.equal(fault.body.ok, false);
  assert(!JSON.stringify(fault.body).includes('PRIVATE_INCIDENT_DATABASE_FAILURE'));
  assert(!falseSuccess.includes('Incidente resolvido'));
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: first.id } })).status, 'OPEN');
  assert.equal(await page.locator('#activeCount').innerText(), '—');
  assert.equal(await page.locator('.btn-resolve').count(), 0);
  await page.locator('#refreshBtn').click();
  await firstCard.locator('.btn-resolve').waitFor();

  // Read failures on every read route and mutation failures are explicit and sanitized.
  try {
    prisma.incident.findMany = async () => { throw Error('PRIVATE_INCIDENT_DATABASE_FAILURE'); };
    for (const endpoint of ['/summary', '/critical']) assert.equal((await call(endpoint, 'GET', undefined, token, origin)).status, 503);
  } finally { prisma.incident.findMany = originalFind; }
  const originalUpdate = prisma.incident.update;
  try {
    prisma.incident.update = async () => { throw Error('PRIVATE_INCIDENT_WRITE_FAILURE'); };
    const result = await call('/status/' + first.id, 'POST', { status: 'RESOLVED' }, token, origin);
    assert.equal(result.status, 503); assert(!JSON.stringify(result.body).includes('PRIVATE_INCIDENT'));
  } finally { prisma.incident.update = originalUpdate; }
  const originalCreate = prisma.incident.create;
  try {
    prisma.incident.create = async () => { throw Error('PRIVATE_INCIDENT_CREATE_FAILURE'); };
    const result = await call('', 'POST', { type: 'QA', title: prefix + ' failed creation' }, token, origin);
    assert.equal(result.status, 503); assert.equal(result.body.ok, false);
  } finally { prisma.incident.create = originalCreate; }
  const originalTransaction = prisma.$transaction;
  try {
    prisma.$transaction = async () => { throw Error('PRIVATE_INCIDENT_ESCALATION_FAILURE'); };
    assert.equal((await call('/escalate/' + first.id, 'POST', {}, token, origin)).status, 503);
  } finally { prisma.$transaction = originalTransaction; }
  for (const endpoint of ['/status/2147483647', '/escalate/2147483647']) assert.equal((await call(endpoint, 'POST', { status: 'RESOLVED' })).status, 404);
  assert.equal((await call()).cache, 'private, no-store');
  client = await prisma.client.create({ data: { name: prefix, active: true } });
  tech = await prisma.technician.create({ data: { name: prefix, active: true } });
  const before = await prisma.incident.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  for (const credential of [null, 'invalid', sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' })]) {
    for (const endpoint of ['', '/summary', '/critical']) assert([401, 403].includes((await call(endpoint, 'GET', undefined, credential)).status));
    for (const endpoint of ['/status/' + first.id, '/escalate/' + first.id]) assert([401, 403].includes((await call(endpoint, 'POST', { status: 'RESOLVED' }, credential)).status));
  }
  assert.deepEqual(await prisma.incident.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }), before);

  // Missing, mismatched and unsuccessful receipts cannot produce success, nor be retried automatically.
  for (const body of [{ ok: true, incident: null }, { ok: false, incident: { ...first, status: 'RESOLVED' } }, { ok: true, incident: { ...first, id: second.id, status: 'RESOLVED' } }, { ok: true, incident: first }]) {
    await page.route('**/api/incidents/status/' + first.id, route => route.fulfill({ json: body }), { times: 1 });
    const count = writes.length;
    await firstCard.locator('.btn-resolve').click();
    await page.waitForFunction(() => document.querySelector('#actionStatus').textContent.startsWith('Não foi possível confirmar'));
    assert.equal(writes.length, count + 1);
    assert(!await page.locator('#incidentTimeline').innerText().then(text => text.includes('Incidente resolvido')));
    assert.equal(await page.locator('.incident-actions button:not(:disabled)').count(), 0);
    await page.locator('#refreshBtn').click(); await firstCard.locator('.btn-resolve').waitFor();
  }
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/incidents/status/' + first.id, async route => { await gate; await route.continue(); }, { times: 1 });
  const count = writes.length;
  await firstCard.locator('.btn-resolve').evaluate(button => { button.click(); button.click(); });
  await page.waitForFunction(() => document.querySelector('#actionStatus').textContent.includes('confirmar a operação'));
  assert.equal(await page.locator('.incident-actions button:not(:disabled)').count(), 0);
  release();
  await page.waitForFunction(() => document.querySelector('#actionStatus').textContent.includes('Incidente resolvido'));
  await page.waitForFunction(() => document.querySelector('#resolvedCount').textContent === '1');
  assert.equal(writes.length, count + 1);
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: first.id } })).status, 'RESOLVED');
  assert.equal(await firstCard.locator('button').count(), 0);

  // A committed escalation whose response is lost is recovered by a GET, without increasing scores again.
  const secondCard = page.locator('.incident').filter({ hasText: second.title }).first();
  await page.route('**/api/incidents/escalate/' + second.id, async route => { await route.fetch(); await route.abort('failed'); }, { times: 1 });
  await secondCard.locator('.btn-escalate').click();
  await page.waitForFunction(() => document.querySelector('#actionStatus').textContent.startsWith('Não foi possível confirmar'));
  const afterLost = await prisma.incident.findUniqueOrThrow({ where: { id: second.id } });
  assert.equal(afterLost.escalated, true); assert.equal(afterLost.impactScore, 85); assert.equal(afterLost.priorityScore, 90);
  assert(!(await page.locator('#incidentTimeline').innerText()).includes('Incidente escalado'));
  await page.locator('#refreshBtn').click();
  await page.waitForFunction(() => document.querySelector('#incidentStatus').textContent.includes('atualizada'));
  assert.equal(await secondCard.locator('.btn-escalate').count(), 0);
  for (const result of await Promise.all([call('/escalate/' + second.id, 'POST', {}), call('/escalate/' + second.id, 'POST', {})])) assert.equal(result.status, 200);
  assert.deepEqual(await prisma.incident.findUniqueOrThrow({ where: { id: second.id } }), afterLost);
  const concurrent = await create({ title: prefix + ' concurrent' });
  const repeated = await Promise.all([call('/escalate/' + concurrent.id, 'POST', {}), call('/escalate/' + concurrent.id, 'POST', {})]);
  assert(repeated.every(result => result.status === 200 && result.body.incident.escalated));
  const escalated = await prisma.incident.findUniqueOrThrow({ where: { id: concurrent.id } });
  assert.equal(escalated.impactScore, 85); assert.equal(escalated.priorityScore, 90);
  console.log('PASS incident API: failures are explicit, null/missing receipts rejected, ADMIN scope, refused writes inert, repeated/concurrent escalation changes scores once');

  // Read states: failed/malformed responses never become zero; real empty data does.
  for (const response of [{ status: 503, json: { ok: false } }, { json: { ok: true } }, { json: { ok: true, incidents: [first, first] } }, { json: { ok: true, incidents: [{ ...first, impactScore: '<img src=x>' }] } }]) {
    await page.route('**/api/incidents', route => route.fulfill(response), { times: 1 });
    await page.locator('#refreshBtn').click();
    await page.waitForFunction(() => document.querySelector('#incidentStatus').dataset.state === 'error');
    assert.equal(await page.locator('#activeCount').innerText(), '—');
    assert.equal(await page.locator('.incident').count(), 0);
  }
  await page.route('**/api/incidents', route => route.fulfill({ json: { ok: true, incidents: [] } }), { times: 1 });
  await page.locator('#refreshBtn').click();
  await page.waitForFunction(() => document.querySelector('#activeCount').textContent === '0');
  assert((await page.locator('#incidentList').innerText()).includes('Sem incidentes registados'));
  await page.locator('#refreshBtn').focus(); await page.keyboard.press('Enter');
  await firstCard.waitFor();
  assert.equal(await page.locator('#incidentList img, #incidentList script, #incidentList [onclick]').count(), 0);
  const visual = path.join(__dirname, '../reports/field-visual/incident-center'); await fs.mkdir(visual, { recursive: true });
  await page.locator('#cw-v21-toast').waitFor({ state: 'hidden' });
  for (const [theme, width] of [['light', 320], ['light', 390], ['light', 1440], ['dark', 390]]) {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width, height: 1000 });
    await page.mouse.move(0, 0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => document.getAnimations().every(animation => !(animation instanceof CSSTransition) || animation.playState !== 'running'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow at ' + width);
    const sizes = await page.locator('#refreshBtn,#dashboardBtn,.incident-actions button').evaluateAll(items => items.map(el => ({ label: el.textContent, height: el.getBoundingClientRect().height })));
    assert(sizes.every(el => el.height >= 44), JSON.stringify({ theme, width, sizes }));
    const contrast = await page.locator('header h1,main h2,main h3,.label,.incident-meta,.timeline-item b,.timeline-time,#incidentStatus,[data-cw-open-drawer]').evaluateAll(items => items.map(el => {
      const color = value => value.match(/[\d.]+/g).map(Number);
      const luminance = rgb => rgb.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const front = luminance(color(getComputedStyle(el).color)); let parent = el, back;
      do { back = color(getComputedStyle(parent).backgroundColor); parent = parent.parentElement; } while (back[3] === 0 && parent);
      const background = luminance(back);
      return { text: el.textContent.slice(0, 25), ratio: (Math.max(front, background) + .05) / (Math.min(front, background) + .05), foreground: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, surface: getComputedStyle(el).getPropertyValue('--incident-surface'), markup: el.outerHTML.slice(0, 400) };
    }));
    assert(contrast.every(item => item.ratio >= 4.5), JSON.stringify({ theme, contrast: contrast.filter(item => item.ratio < 4.5) }));
    await page.screenshot({ path: path.join(visual, 'pt-' + theme + '-' + width + '.png'), fullPage: true });
  }
  await context.setOffline(true);
  await page.waitForFunction(() => document.querySelector('#incidentStatus').dataset.state === 'offline');
  assert.equal(await page.locator('.incident-actions button:not(:disabled)').count(), 0);
  await context.setOffline(false); await firstCard.waitFor();

  // Invalidate a pending read on an account change, including a quick switch back.
  let readRelease, readStarted;
  const held = new Promise(resolve => { readRelease = resolve; }), started = new Promise(resolve => { readStarted = resolve; });
  await page.route('**/api/incidents', async route => { const response = await route.fetch(); readStarted(); await held; await route.fulfill({ response }).catch(() => {}); }, { times: 1 });
  await page.locator('#refreshBtn').click(); await started;
  await page.evaluate(() => { const oldValue = localStorage.getItem('user'); window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue, newValue: '{"role":"CLIENT"}' })); window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue: '{"role":"CLIENT"}', newValue: oldValue })); });
  readRelease();
  await page.waitForFunction(() => document.querySelector('#incidentStatus').dataset.state === 'session');
  assert.equal(await page.locator('.incident').count(), 0); assert.equal(await page.locator('#activeCount').innerText(), '—');
  assert.equal(await page.locator('#refreshBtn').isDisabled(), true);
  await page.reload({ waitUntil: 'networkidle' });
  const concurrentCard = page.locator('#incident-' + concurrent.id);
  await concurrentCard.locator('.btn-resolve').waitFor();
  let writeRelease, writeStarted;
  const writeHeld = new Promise(resolve => { writeRelease = resolve; }), committed = new Promise(resolve => { writeStarted = resolve; });
  await page.route('**/api/incidents/status/' + concurrent.id, async route => { const response = await route.fetch(); writeStarted(); await writeHeld; await route.fulfill({ response }).catch(() => {}); }, { times: 1 });
  await concurrentCard.locator('.btn-resolve').click(); await committed;
  await page.evaluate(() => localStorage.setItem('user', '{"id":999,"role":"ADMIN"}'));
  await page.waitForFunction(() => document.querySelector('#incidentStatus').dataset.state === 'session');
  writeRelease();
  assert.equal(await page.locator('#incidentTimeline').innerText(), '');
  assert.equal(await page.locator('.incident').count(), 0);
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: concurrent.id } })).status, 'RESOLVED');
  await page.unrouteAll({ behavior: 'wait' });
  assert.deepEqual(errors, []);
  console.log('PASS incident UI: refused/malformed/lost responses never claim success, double clicks send once, explicit loading/empty/error/offline/session states, safe literal text, keyboard and 320/390/1440 layouts');
  const autoA = await create({ title: prefix + ' automatic A', slaDeadline: new Date('2000-01-01') });
  const autoB = await create({ title: prefix + ' automatic B', slaDeadline: new Date('2000-01-01') });
  let attempts = 0;
  try {
    prisma.incident.findMany = args => originalFind({ ...args, where: { ...args.where, id: { in: [autoA.id, autoB.id] } }, orderBy: { id: 'asc' } });
    prisma.$transaction = (...args) => { if (++attempts === 1) throw Error('QA isolated first escalation failure'); return originalTransaction.apply(prisma, args); };
    await require('../src/services/incidentService').processSlaEscalations();
    assert.equal(attempts, 2, 'A failed scheduled incident must not stop the next one');
    assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: autoA.id } })).escalated, false);
    const automatic = await prisma.incident.findUniqueOrThrow({ where: { id: autoB.id } });
    assert.equal(automatic.escalated, true); assert.equal(automatic.autoEscalated, true);
    assert.equal(automatic.impactScore, 85); assert.equal(automatic.priorityScore, 90);
  } finally { prisma.incident.findMany = originalFind; prisma.$transaction = originalTransaction; }
  console.log('PASS scheduled escalation: one failure remains isolated and subsequent overdue incidents are still processed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (probe) await new Promise(resolve => probe.close(resolve));
  if (ids.length) await prisma.incident.deleteMany({ where: { id: { in: ids } } });
  if (client) await prisma.client.delete({ where: { id: client.id } });
  if (tech) await prisma.technician.delete({ where: { id: tech.id } });
  await prisma.$disconnect();
});
