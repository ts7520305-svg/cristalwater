'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { createHash } = require('node:crypto'), jwt = require('jsonwebtoken'), sharp = require('sharp');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { ensureUploadBaseDirReady, toPublicUploadUrl } = require('../src/config/uploadPath');
const pdfText = require('./lib/reportPdfText');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = data => jwt.sign(data, getJwtSecret(), { expiresIn: '1h' });
  const token = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const old = await prisma.client.create({ data: { name: 'HISTORICAL_CLIENT Łukasz', address: 'OLD_LIVE_ADDRESS', zone: 'OLD_LIVE_ZONE' } });
  const owner = await prisma.client.create({ data: { name: 'CURRENT_CLIENT_SECRET' } });
  const tech = await prisma.technician.create({ data: { name: 'CURRENT_TECH_NAME', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: owner.id, name: 'CURRENT_POOL_SECRET', address: 'CURRENT_ADDRESS_SECRET', zone: 'CURRENT_ZONE_SECRET', equipment: { create: { pumpType: 'CURRENT_PUMP_SECRET' } }, technicalRoom: { create: { notes: 'CURRENT_ROOM_SECRET' } } } });
  const literal = '<script>HISTORICAL_LITERAL</script>';
  const createRegular = () => prisma.serviceVisit.create({ data: { clientId: old.id, poolId: pool.id, technicianId: tech.id, technicianName: 'RECORDED_TECH', status: 'COMPLETED', notes: 'REGULAR_RECORDED ' + literal, internalNotes: 'REGULAR_PRIVATE', ph: 7.3, startAt: new Date('2026-01-10T09:00:00Z'), endAt: new Date('2026-01-10T09:30:00Z'), chemicals: { create: { name: 'RECORDED_CHEMICAL', quantity: 2, unit: 'kg' } } } });
  const regular = await createRegular();
  const extra = await prisma.extraVisit.create({ data: { clientId: old.id, poolId: pool.id, technicianId: tech.id, status: 'DONE', notes: 'EXTRA_PLANNING', internalNote: 'EXTRA_PRIVATE', execution: { notes: 'EXTRA_RECORDED ' + literal, ph: 7.4, cleaned: true } } });
  const photo = await sharp({ create: { width: 160, height: 100, channels: 3, background: '#1a7799' } }).jpeg().toBuffer();
  const sha = createHash('sha256').update(photo).digest('hex'), uploadRoot = ensureUploadBaseDirReady();
  for (const type of ['REGULAR', 'EXTRA']) {
    const visitId = type === 'EXTRA' ? extra.id : regular.id;
    const filename = `${type === 'EXTRA' ? 'extra-' : ''}visit-${visitId}-AFTER-${sha}.jpg`;
    await fs.writeFile(path.join(uploadRoot, filename), photo);
    await prisma[type === 'EXTRA' ? 'extraVisitPhoto' : 'visitPhoto'].create({ data: { [type === 'EXTRA' ? 'extraVisitId' : 'visitId']: visitId, type: 'AFTER', url: toPublicUploadUrl(filename) } });
  }
  const settings = async () => (await (await fetch(base + '/api/report-settings/' + old.id, { headers: { Authorization: 'Bearer ' + token } })).json());
  let state = await settings();
  const review = type => new URLSearchParams({ visitType: type, view: 'admin', history: 'review', clientId: String(old.id), settingsVersion: state.version });
  async function call(query, auth = token, route = 'reports', visitId = new URLSearchParams(query).get('visitType') === 'EXTRA' ? extra.id : regular.id) {
    const response = await fetch(`${base}/api/${route}/visit/${visitId}?${query}`, { headers: auth ? { Authorization: 'Bearer ' + auth } : {} });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, bytes, text: bytes.subarray(0, 5).toString() === '%PDF-' ? pdfText(bytes) : bytes.toString() };
  }
  const clients = [old, owner].map(c => sign({ id: c.id, clientId: c.id, role: 'CLIENT', principalType: 'CLIENT' }));
  const technician = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
  const before = await prisma.serviceVisit.findUniqueOrThrow({ where: { id: regular.id } });
  const beforeExtra = await prisma.extraVisit.findUniqueOrThrow({ where: { id: extra.id } });
  const counters = () => Promise.all(['invoice', 'payment', 'userAuditLog', 'fieldWriteRequest', 'clientReportSetting', 'visitPhoto', 'extraVisitPhoto'].map(model => prisma[model].count()));
  const counts = await counters();
  const evidence = path.join(process.cwd(), 'reports/field-visual/report-history-review-' + Date.now()); await fs.mkdir(evidence, { recursive: true });
  const titles = { pt: 'Revisão administrativa da visita', en: 'Administrative visit review', fr: 'Examen administratif de la visite', es: 'Revisión administrativa de la visita' };
  for (const type of ['REGULAR', 'EXTRA']) for (const route of ['reports', 'report-visit']) {
    for (const auth of [token, clients[0], technician]) assert.equal((await call('visitType=' + type, auth, route)).status, 409);
    assert.equal((await call('visitType=' + type, clients[1], route)).status, 403);
    for (const auth of [...clients, technician]) {
      assert.equal((await call(review(type), auth, route)).status, 403);
      const q = review(type); q.set('view', 'client'); assert.equal((await call(q, auth, route)).status, 403);
    }
    assert.equal((await call(review(type), null, route)).status, 401);
    for (const bad of ['', 'true', 'REVIEW', 'review&history=review', 'review&history[x]=review']) {
      const q = review(type); q.delete('history'); assert.equal((await call(q + '&history=' + bad, token, route)).status, 400);
    }
    for (const key of ['clientId', 'settingsVersion', 'view']) { const q = review(type); q.delete(key); assert.equal((await call(q, token, route)).status, 428); }
    const wrong = review(type); wrong.set('clientId', String(owner.id)); assert.equal((await call(wrong, token, route)).status, 409);
    const clientView = review(type); clientView.set('view', 'client'); assert.equal((await call(clientView, token, route)).status, 403);
    for (const [lang, title] of Object.entries(titles)) {
      const q = review(type); q.set('lang', lang); const result = await call(q, token, route);
      assert.equal(result.status, 200, result.text); assert(result.text.includes(title)); assert(result.text.includes('HISTORICAL_CLIENT'));
      for (const marker of [type + '_RECORDED', type + '_PRIVATE', 'HISTORICAL_LITERAL']) assert(result.text.includes(marker), marker);
      for (const marker of ['CURRENT_', 'OLD_LIVE_', type === 'EXTRA' ? 'REGULAR_RECORDED' : 'EXTRA_RECORDED']) assert(!result.text.includes(marker), marker);
      assert.equal(result.headers.get('x-cw-report-origin'), 'historical-review'); assert.equal(result.headers.get('x-cw-client-id'), String(old.id));
      assert.equal(result.headers.get('x-cw-visit-type'), type); assert.equal(result.headers.get('content-language'), lang); assert.match(result.headers.get('cache-control'), /private.*no-store/);
      if (route === 'reports') { assert(!result.text.includes('<script>')); assert(result.text.includes('&lt;script&gt;')); assert(result.text.includes('data:image/jpeg;base64,')); }
      else { assert.match(result.headers.get('content-disposition'), /admin-historical-review\.pdf/); assert.equal((result.bytes.toString('latin1').match(/\/Subtype \/Image\b/g) || []).length, 1); await fs.writeFile(path.join(evidence, `${lang}-${type.toLowerCase()}.pdf`), result.bytes); }
    }
  }
  assert.deepEqual(await counters(), counts);
  assert.deepEqual(await prisma.serviceVisit.findUniqueOrThrow({ where: { id: regular.id } }), before);
  assert.deepEqual(await prisma.extraVisit.findUniqueOrThrow({ where: { id: extra.id } }), beforeExtra);
  // A later settings edit, missing client or reconciled owner must require a new read.
  await prisma.clientReportSetting.create({ data: { clientId: old.id, showNotes: false } });
  assert.equal((await call(review('REGULAR'))).status, 409); state = await settings();
  for (const [model, type] of [['serviceVisit', 'REGULAR'], ['extraVisit', 'EXTRA']]) {
    await prisma[model].update({ where: { id: type === 'EXTRA' ? extra.id : regular.id }, data: { clientId: null } }); assert.equal((await call(review(type))).status, 409);
    await prisma[model].update({ where: { id: type === 'EXTRA' ? extra.id : regular.id }, data: { clientId: old.id } });
  }
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: old.id } });
  assert.equal((await call(review('REGULAR'))).status, 409); assert.equal((await call('view=admin')).status, 200);
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: owner.id } });
  // An archived original client can still be reviewed; no edit/reactivation is needed.
  await prisma.client.update({ where: { id: old.id }, data: { active: false, archiveStatus: 'ARQUIVADO' } }); state = await settings();
  assert.equal((await call(review('REGULAR'))).status, 200);
  const browserBefore = await prisma.serviceVisit.findUniqueOrThrow({ where: { id: regular.id } });
  const browserBeforeExtra = await prisma.extraVisit.findUniqueOrThrow({ where: { id: extra.id } });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'adminToken', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
    localStorage.setItem('cw_language', 'pt'); window.qaBlobs = []; window.qaClosed = 0;
    window.open = () => ({ location: {}, closed: false, close() { this.closed = true; window.qaClosed++; } });
    const create = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { const url = create(blob); qaBlobs.push(url); return url; };
  }, { token, id: admin.id });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/report-settings', { waitUntil: 'networkidle' });
  const button = page.locator('#openHistoryReport'); assert(await button.isDisabled());
  await page.locator('#clientId').fill(String(old.id)); await page.locator('#loadSettings').click();
  await page.waitForFunction(() => document.getElementById('loadedClient').textContent.includes('HISTORICAL_CLIENT'));
  await page.locator('#visitId').fill(String(regular.id));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await button.scrollIntoViewIfNeeded();
    assert(await button.evaluate(e => e.getBoundingClientRect().left >= 0 && e.getBoundingClientRect().right <= innerWidth));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, `review-${width}.png`), fullPage: true });
  }
  const wait = kind => page.waitForFunction(k => document.getElementById('previewStatus').dataset.state === k, kind);
  await page.locator('#openAdminReport').click(); await wait('error'); assert.equal(await page.evaluate(() => qaBlobs.length), 0);
  for (const type of ['REGULAR', 'EXTRA']) {
    await page.locator('#visitType').selectOption(type); await page.locator('#visitId').fill(String(type === 'EXTRA' ? extra.id : regular.id)); await button.click(); await wait('opened');
    const bytes = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(qaBlobs.at(-1))).arrayBuffer()))));
    assert(pdfText(bytes).includes(type + '_RECORDED')); assert(!pdfText(bytes).includes('CURRENT_'));
  }
  const endpoint = '**/api/report-visit/visit/*';
  await page.route(endpoint, async route => { const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), 'x-cw-report-origin': 'current' } }); });
  const blobs = await page.evaluate(() => qaBlobs.length); await button.click(); await wait('error'); assert.equal(await page.evaluate(() => qaBlobs.length), blobs); await page.unroute(endpoint);
  let arrive, release; const arrived = new Promise(r => arrive = r), gate = new Promise(r => release = r);
  await page.route(endpoint, async route => { const response = await route.fetch(); arrive(); await gate; await route.fulfill({ response }).catch(() => {}); });
  await button.click(); await arrived; await page.locator('#reportLanguage').selectOption('fr'); await wait('idle'); release(); await page.unroute(endpoint);
  assert.equal(await page.evaluate(() => qaBlobs.length), blobs);
  await context.setOffline(true); await button.click(); await wait('error'); await context.setOffline(false);
  await button.click(); await wait('opened');
  await page.evaluate(() => localStorage.setItem('user', JSON.stringify({ id: 2147483647, role: 'ADMIN' }))); await wait('session'); assert(await button.isDisabled());
  assert.deepEqual(errors, []);
  assert.deepEqual(await prisma.serviceVisit.findUniqueOrThrow({ where: { id: regular.id } }), browserBefore);
  assert.deepEqual(await prisma.extraVisit.findUniqueOrThrow({ where: { id: extra.id } }), browserBeforeExtra);
  console.log('PASS historical report inspection: explicit ADMIN-only REGULAR/EXTRA, original client, live facility withheld, four languages/PDF/HTML/photos, strict context/settings, source unchanged, archived client, responsive UI, forged origin, cancellation, offline retry and session change');
  console.log('REPORT_HISTORY_EVIDENCE ' + evidence);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
