'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const stamp = Date.now(), admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const user = { id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'QA areas '+stamp, active: true } });
  const seeds = [
    { name: '<img src=x onerror=alert(1)> '+stamp, latitude: -2, longitude: -2 },
    { name: 'SE '+stamp, latitude: -2, longitude: 2 }, { name: 'NW '+stamp, latitude: 2, longitude: -2 },
    { name: 'NE '+stamp, latitude: 2, longitude: 2 }, { name: null, latitude: 0, longitude: 0 },
    { name: 'Unknown '+stamp }, { name: 'Invalid '+stamp, latitude: 91, longitude: 0 }
  ];
  const pools = await Promise.all(seeds.map(p => prisma.pool.create({ data: { ...p, clientId: client.id } })));
  const snapshot = async () => ({ zones: await prisma.zone.count(), assignments: await prisma.roundAssignment.count(), pools: await prisma.pool.findMany({ where: { id: { in: pools.map(p => p.id) } }, orderBy: { id: 'asc' } }) });
  const before = await snapshot();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(({ user, token }) => {
    for (const k of ['token','cristalwater_jwt']) localStorage.setItem(k, token);
    for (const k of ['user','cristalwater_user']) localStorage.setItem(k, JSON.stringify(user));
    localStorage.setItem('cw_language','pt'); localStorage.setItem('qaUnrelatedDraft','preserved');
    window.qaLayers = []; window.qaPopups = [];
    const layer = { addTo() { return this; }, clearLayers() { window.qaLayers = []; } };
    const feature = (kind, coords) => ({ bindPopup(node) { window.qaPopups.push({ text: node.textContent, children: node.children.length }); return this; }, addTo() { window.qaLayers.push({ kind, coords }); return this; } });
    window.qaInstallLeaflet = () => { window.L = {
      map() { return { setView() { return this; }, fitBounds() {}, invalidateSize() {}, remove() { window.qaLayers = []; } }; },
      layerGroup() { return layer; }, tileLayer() { return { on(_, fn) { window.qaTileError = fn; return this; }, addTo() { return this; } }; },
      marker(coords) { return feature('marker', coords); }, rectangle(coords) { return feature('rectangle', coords); }
    }; };
  }, { user, token });
  let releaseAssets; const assetsGate = new Promise(resolve => releaseAssets = resolve);
  await context.route('**/*', async route => {
    const url = new URL(route.request().url()); if (url.origin === new URL(base).origin) return route.continue();
    if (url.pathname.includes('/leaflet/')) {
      await assetsGate; return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css', body: url.pathname.endsWith('.js') ? 'window.qaInstallLeaflet();' : '' });
    }
    return route.abort();
  });
  const page = await context.newPage(), errors = [], writes = [], gps = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const url = new URL(request.url()); if (/^\/api\/(pools|zones|rounds)(\/|$)/.test(url.pathname) && request.method() !== 'GET') writes.push(url.pathname); if (url.pathname === '/api/gps/live') gps.push(url.pathname); });
  const state = s => page.waitForFunction(s => document.getElementById('mapStatus').dataset.state === s, s);
  const card = id => page.locator('#mapList [data-record-id="'+id+'"]');
  await page.goto(base+'/map', { waitUntil: 'domcontentloaded' }); await state('ready');
  assert(await page.locator('#mapZonesShow').isEnabled(), 'Controls work with external assets indefinitely pending');
  for (const pool of pools) assert.equal(await card(pool.id).count(), 1);
  assert.equal(await card(pools[0].id).locator('h2').textContent(), pools[0].name); assert.equal(await card(pools[0].id).locator('img').count(), 0);
  assert.equal(await card(pools[4].id).locator('a').first().getAttribute('href'), 'https://www.google.com/maps?q=0,0');
  for (const pool of pools.slice(5)) assert.equal(await card(pool.id).locator('a').count(), 0);
  assert.equal(await page.locator('main a[href="/admin-rounds"]').count(), 1);
  assert.equal((await context.request.get(base+'/admin-rounds')).status(), 200);
  console.log('PASS areas real API: current pools, literal/null names, zero and invalid coordinates, planning destination and usable controls with blocked external assets');
  // Exact geometry uses a controlled response; the preceding read exercised the actual API/database.
  let payload = { ok: true, pools }, responseStatus = 200;
  await page.route('**/api/pools', route => route.fulfill({ status: responseStatus, json: payload }));
  await page.locator('#mapLoad').click(); await state('ready'); await page.locator('#mapZonesShow').click();
  const counts = () => page.locator('#mapZonesSummary li').evaluateAll(nodes => nodes.map(n => Number(n.dataset.count)));
  assert.deepEqual(await counts(), [2,1,1,1]);
  for (const [i, expected] of [0,1,2,3,0].entries()) assert.equal(await card(pools[i].id).getAttribute('data-zone'), String(expected));
  assert.equal(await page.locator('#mapList article[data-zone]').count(), 5);
  assert.match(await page.locator('#mapZonesSummary').textContent(), /2 sem coordenadas válidas/);
  assert.match(await page.locator('#mapZonesSummary').textContent(), /Não cria zonas nem atribui técnicos/);
  releaseAssets(); await page.waitForFunction(() => document.getElementById('mapNotice').dataset.state === 'ready');
  assert.deepEqual(await counts(), [2,1,1,1], 'Late map preserves the active preview');
  assert.equal(await page.evaluate(() => qaLayers.filter(l => l.kind === 'rectangle').length), 4);
  assert.equal(await page.evaluate(() => qaLayers.filter(l => l.kind === 'marker').length), 5);
  assert(await page.evaluate(() => qaPopups.every(p => p.children === 0)));
  await page.locator('#mapZonesShow').click(); assert.equal(await page.evaluate(() => qaLayers.length), 9, 'Preview replaces layers');
  await page.locator('#mapZonesHide').click(); assert.equal(await page.evaluate(() => qaLayers.length), 5); assert(await page.locator('#mapZonesSummary').isHidden());
  assert.equal(await page.locator('#mapList article').count(), 7); assert.equal(await page.locator('#mapList article[data-zone]').count(), 0);
  await page.locator('#mapZonesShow').click();
  const visual = path.join(__dirname, '../reports/field-visual/geographic-areas-'+stamp); fs.mkdirSync(visual, { recursive: true });
  for (const width of [320,390,1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => scrollTo(0,0));
    assert(await page.locator('.map-controls button,#mapZonesSummary,#mapList article').evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth+1 && n.scrollWidth <= n.clientWidth+1; })));
    await page.screenshot({ path: path.join(visual, 'areas-'+width+'.png') });
  }
  await page.evaluate(() => qaTileError()); assert(await page.locator('#map').isHidden()); assert.deepEqual(await counts(), [2,1,1,1]);
  for (const [status, value] of [[503,{}],[202,{ok:true,pools}],[200,[]],[200,{ok:true,pools:[pools[0],pools[0]]}]]) {
    responseStatus = status; payload = value; await page.locator('#mapLoad').click(); await state('error');
    assert(await page.locator('#mapZonesSummary').isHidden()); assert.equal(await page.locator('#mapList article').count(), 0); assert(await page.locator('#mapZonesShow').isDisabled());
  }
  responseStatus = 200; payload = { ok: true, pools: [] }; await page.locator('#mapLoad').click(); await state('empty');
  payload = { ok: true, pools: pools.slice(5) }; await page.locator('#mapLoad').click(); await state('ready'); assert(await page.locator('#mapZonesShow').isDisabled());
  payload = { ok: true, pools: [pools[4]] }; await page.locator('#mapLoad').click(); await state('ready'); await page.locator('#mapZonesShow').click(); assert.deepEqual(await counts(), [1,0,0,0]);
  payload = { ok: true, pools }; await page.locator('#mapLoad').click(); await state('ready'); assert(await page.locator('#mapZonesSummary').isHidden());
  await page.locator('#mapZonesShow').click();
  let entered, release; const arrival = new Promise(resolve => entered = resolve), gate = new Promise(resolve => release = resolve);
  await page.route('**/api/pools', async route => { entered(); await gate; await route.fulfill({ json: { ok:true, pools } }); });
  await page.locator('#mapLoad').click(); await arrival; assert(await page.locator('#mapZonesSummary').isHidden());
  await page.evaluate(() => localStorage.setItem('cristalwater_user','changed')); release(); await state('session');
  assert.equal(await page.locator('#mapList article').count(), 0); assert(await page.locator('#mapZonesShow').isDisabled()); assert(await page.locator('#map').isHidden());
  assert.equal(await page.evaluate(() => localStorage.getItem('qaUnrelatedDraft')), 'preserved');
  assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.deepEqual(gps, []); assert.deepEqual(await snapshot(), before);
  console.log('PASS areas preview: unique midline membership, no invalid coordinates, literal popups, late assets, replacement/clear, three widths, tile failure, invalid/empty reads, session invalidation and no persisted assignment; evidence '+visual);
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
