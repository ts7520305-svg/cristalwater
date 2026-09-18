"use strict";
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const jwt = require('jsonwebtoken'), sharp = require('sharp');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { defaults, keys } = require('../src/services/clientReportSettingsDefaults');
const { ensureUploadBaseDirReady, toPublicUploadUrl } = require('../src/config/uploadPath');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const images = bytes => (bytes.toString('latin1').match(/\/Subtype \/Image\b/g) || []).length;
const pdfText = require('./lib/reportPdfText');
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const user = { id: admin.id, role: 'ADMIN' }, sign = row => jwt.sign(row, getJwtSecret(), { expiresIn: '1h' }), token = sign(user);
  const client = await prisma.client.create({ data: { name: 'EXTRA report client Łukasz' } }), other = await prisma.client.create({ data: { name: 'Other EXTRA report client' } });
  const tech = await prisma.technician.create({ data: { name: 'Assigned extra technician', active: true } }), unassigned = await prisma.technician.create({ data: { name: 'Unassigned extra technician', active: true } });
  const clientToken = sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), techToken = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'EXTRA report pool' } });
  const ids = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...ids.map(x => x._max.id || 0)) + 101;
  const regular = await prisma.serviceVisit.create({ data: { id, clientId: client.id, poolId: pool.id, notes: 'REGULAR_ONLY' } });
  const extra = await prisma.extraVisit.create({ data: { id, clientId: client.id, poolId: pool.id, technicianId: tech.id, scheduledAt: new Date('2097-04-03T12:00:00Z'), billingMode: 'INCLUDED', notes: 'PLANNING_PRIVATE', internalNote: 'EXTRA_INTERNAL', status: 'IN_PROGRESS', startAt: new Date() } });
  const picture = await sharp({ create: { width: 420, height: 260, channels: 3, background: '#148d9c' } }).jpeg().toBuffer();
  const form = new FormData(); form.append('requestId', randomUUID()); form.append('poolId', String(pool.id)); form.append('type', 'AFTER'); form.append('photo', new Blob([picture], { type: 'image/jpeg' }), 'extra.jpg');
  const uploaded = await fetch(`${base}/api/field/extra-visits/${id}/photo`, { method: 'POST', headers: { Authorization: 'Bearer ' + techToken }, body: form }); assert.equal(uploaded.status, 200); const photo = (await uploaded.json()).photo;
  const done = await fetch(`${base}/api/field/extra-visits/${id}/complete`, { method: 'POST', headers: { Authorization: 'Bearer ' + techToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), visitType: 'EXTRA', poolId: pool.id, ph: 7.3, cleaned: true, brushed: false, notes: 'EXTRA_EXECUTION <script>literal</script>', products: [] }) }); assert.equal(done.status, 200);
  const saved = await prisma.extraVisit.findUniqueOrThrow({ where: { id } });
  await prisma.extraVisit.update({ where: { id }, data: { execution: { ...saved.execution, chemicalsJson: [{ name: 'EXTRA_CHEMICAL', quantity: 2.5, unit: 'kg' }], internalNotes: 'FORGED_EXECUTION_SECRET', id: regular.id + 1, clientId: other.id, status: 'FORGED_STATUS', notesForClient: 'UNSUPPORTED_ALIAS' } } });
  const root = ensureUploadBaseDirReady(), regularName = `visit-${id}-AFTER-${createHash('sha256').update(picture).digest('hex')}.jpg`; await fs.writeFile(path.join(root, regularName), picture);
  await prisma.visitPhoto.create({ data: { visitId: id, type: 'AFTER', url: toPublicUploadUrl(regularName) } });
  await prisma.extraVisitPhoto.create({ data: { extraVisitId: id, type: 'AFTER', url: toPublicUploadUrl(regularName) } });
  await prisma.visitPhoto.create({ data: { visitId: id, type: 'AFTER', url: photo.url } });
  const allOn = Object.fromEntries(keys.map(key => [key, true])); await prisma.clientReportSetting.create({ data: { clientId: client.id, ...allOn } });
  async function call(query = 'visitType=EXTRA&view=client', auth = token, route = 'report-visit', target = id) {
    const response = await fetch(`${base}/api/${route}/visit/${target}?${query}`, { headers: auth ? { Authorization: 'Bearer ' + auth } : {} }); const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, bytes, text: bytes.subarray(0, 5).toString() === '%PDF-' ? pdfText(bytes) : bytes.toString() };
  }
  const counters = () => Promise.all(['invoice','payment','monthlyReport','stockMovement','vehicleStockMovement','fieldWriteRequest','auditTrail','visitPhoto','extraVisitPhoto'].map(model => prisma[model].count())); const before = await counters();
  for (const route of ['report-visit','reports']) {
    let result = await call(undefined, token, route); assert.equal(result.status, 200); assert.equal(result.headers.get('x-cw-visit-type'), 'EXTRA'); assert.equal(result.headers.get('x-cw-report-type'), route === 'reports' ? 'extra-visit-html' : 'extra-visit-pdf');
    for (const marker of ['Visita extra #'+id,'Łukasz','EXTRA_EXECUTION','EXTRA_CHEMICAL','7.3','DONE']) assert(result.text.includes(marker), marker);
    for (const marker of ['REGULAR_ONLY','PLANNING_PRIVATE','EXTRA_INTERNAL','FORGED_EXECUTION_SECRET','FORGED_STATUS','UNSUPPORTED_ALIAS']) assert(!result.text.includes(marker), marker);
    assert.equal((await call(undefined, clientToken, route)).status, 200); assert.equal((await call(undefined, techToken, route)).status, 200);
    for (const auth of [clientToken, techToken]) assert.equal((await call('visitType=EXTRA&view=admin', auth, route)).status, 403);
    assert.equal((await call(undefined, sign({ id: other.id, role: 'CLIENT' }), route)).status, 403); assert.equal((await call(undefined, sign({ id: unassigned.id, role: 'TECHNICIAN' }), route)).status, 403); assert.equal((await call(undefined, null, route)).status, 401);
    for (const query of ['visitType=extra','visitType=ONE_OFF','visitType=EXTRA&visitType=REGULAR','visitType[x]=EXTRA']) assert.equal((await call(query, token, route)).status, 400);
    assert.equal((await call('visitType=EXTRA&clientId='+other.id, token, route)).status, 409);
    const ordinary = await call('view=client', token, route); assert.equal(ordinary.headers.get('x-cw-visit-type'), 'REGULAR'); assert(ordinary.text.includes('REGULAR_ONLY')); assert(!ordinary.text.includes('EXTRA_EXECUTION'));
  }
  assert.equal(images((await call()).bytes), 1); assert.equal(images((await call('view=client')).bytes), 1);
  let html = (await call(undefined, token, 'reports')).text; assert(!html.includes('<script>')); assert(html.includes('&lt;script&gt;')); assert(html.includes('<dt>Limpeza geral</dt><dd>Sim</dd>')); assert(html.includes('<dt>Escovagem</dt><dd>Não</dd>'));
  const state = await (await fetch(base+'/api/report-settings/'+client.id, { headers: { Authorization: 'Bearer '+token } })).json();
  const versionQuery = 'visitType=EXTRA&settingsVersion='+encodeURIComponent(state.version);
  assert.equal((await call(versionQuery)).status, 200); await prisma.clientReportSetting.update({ where: { clientId: client.id }, data: { showPhotos: false } }); assert.equal((await call(versionQuery)).status, 409); assert.equal(images((await call()).bytes), 0); assert.equal(images((await call('visitType=EXTRA&view=admin')).bytes), 1);
  const legacy = await prisma.extraVisit.create({ data: { clientId: client.id, poolId: pool.id, notes: 'LEGACY_PLANNING', status: 'DONE' } });
  html = (await call(undefined, token, 'reports', legacy.id)).text; assert(html.includes('<dt>Limpeza geral</dt><dd>Não registado</dd>')); assert(html.includes('Consumo não registado')); assert(!html.includes('LEGACY_PLANNING'));
  await prisma.extraVisit.update({ where: { id: legacy.id }, data: { execution: { ph: { secret: 'NO_OBJECT_LEAK' }, cleaned: 'false', chemicalsJson: [{ name: 'BAD_CHEMICAL', quantity: -1, unit: 'kg' }], notes: {} } } });
  html = (await call(undefined, token, 'reports', legacy.id)).text; assert(html.includes('<dt>Limpeza geral</dt><dd>Por confirmar</dd>')); assert(html.includes('Consumo por confirmar')); assert(!html.includes('NO_OBJECT_LEAK') && !html.includes('BAD_CHEMICAL'));
  await prisma.extraVisit.update({ where: { id: legacy.id }, data: { clientId: null } }); assert.equal((await call(undefined, token, 'report-visit', legacy.id)).status, 409); assert.equal((await call(undefined, clientToken, 'reports', legacy.id)).status, 403);
  await prisma.extraVisit.update({ where: { id: legacy.id }, data: { clientId: other.id } }); assert.equal((await call(undefined, token, 'reports', legacy.id)).status, 409);
  assert.deepEqual(await counters(), before); assert.deepEqual(await prisma.serviceVisit.findUnique({ where: { id } }), regular);
  console.log('PASS explicit EXTRA/REGULAR identity with colliding IDs, real extra upload/completion, isolated photos, private planning/internal notes, saved visibility/version, historical owner and technician authorization, legacy missing/malformed execution and side-effect-free reads');

  await prisma.clientReportSetting.update({ where: { clientId: client.id }, data: { ...defaults, showPhotos: true, showChemicals: true } });
  const evidence = path.join(process.cwd(), 'reports/field-visual/extra-report-'+Date.now()); await fs.mkdir(evidence, { recursive: true });
  for (const view of ['client','admin']) { const doc = await call('visitType=EXTRA&view='+view); assert.equal(doc.status, 200); assert.equal(doc.text.includes('EXTRA_INTERNAL'), view === 'admin'); assert.equal(doc.text.includes('PLANNING_PRIVATE'), view === 'admin'); assert.equal(images(doc.bytes), 1); await fs.writeFile(path.join(evidence, view+'.pdf'), doc.bytes); }
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block' }), errors = [], requests = [];
  await context.addInitScript(({ token, user }) => {
    for (const key of ['token','adminToken','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
    localStorage.setItem('cw_language','pt'); window.qaPopups=[]; window.qaCreated=[]; window.qaRevoked=[];
    window.open=()=>{if(window.qaBlocked)return null;const popup={location:{},closed:false,close(){this.closed=true;}};qaPopups.push(popup);return popup;};
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL); URL.createObjectURL=blob=>{const url=create(blob);qaCreated.push(url);return url;}; URL.revokeObjectURL=url=>{qaRevoked.push(url);revoke(url);};
  }, { token, user });
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error=>errors.push(error.message)); page.on('request', request=>{if(request.url().includes('/api/report-visit/'))requests.push({url:request.url(),auth:request.headers().authorization});});
  await page.goto(base+'/report-settings',{waitUntil:'networkidle'}); await page.locator('#clientId').fill(String(client.id)); await page.locator('#loadSettings').click(); await page.waitForFunction(()=>document.getElementById('loadedClient').textContent.includes('EXTRA report client'));
  await page.locator('#visitId').fill(String(id)); await page.locator('#visitType').selectOption('EXTRA'); const button=page.locator('#openClientReport'), stateUI=kind=>page.waitForFunction(kind=>document.getElementById('previewStatus').dataset.state===kind,kind);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.locator('#visitType').evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(evidence,'settings-'+width+'.png'),fullPage:true});}
  await page.evaluate(()=>window.qaBlocked=true); await button.click(); await stateUI('error'); assert.equal(requests.length,0); await page.evaluate(()=>window.qaBlocked=false); await button.click(); await stateUI('opened');
  assert(new URL(requests.at(-1).url).searchParams.get('visitType')==='EXTRA'); assert(requests.every(r=>r.auth==='Bearer '+token&&!r.url.includes(token)));
  const opened = Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch(qaCreated.at(-1))).arrayBuffer())))); assert(pdfText(opened).includes('Visita extra #'+id));
  await page.locator('#visitType').selectOption('REGULAR'); await stateUI('idle'); assert(await page.evaluate(()=>qaPopups.at(-1).closed)); assert.equal(await page.evaluate(()=>qaRevoked.length),1); await button.click(); await stateUI('opened'); assert.equal(new URL(requests.at(-1).url).searchParams.get('visitType'),null);
  await page.locator('#visitType').selectOption('EXTRA'); const endpoint='**/api/report-visit/visit/*';
  await page.route(endpoint,async route=>{const url=new URL(route.request().url());url.searchParams.delete('visitType');const response=await route.fetch({url:url.toString()});await route.fulfill({response});}); const beforeBlobs=await page.evaluate(()=>qaCreated.length); await button.click(); await stateUI('error'); assert.equal(await page.evaluate(()=>qaCreated.length),beforeBlobs); await page.unroute(endpoint);
  let entered,release; const arrived=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  await page.route(endpoint,async route=>{const response=await route.fetch();entered();await gate;await route.fulfill({response}).catch(()=>{});}); await button.click(); await arrived; await page.locator('#visitType').selectOption('REGULAR'); await stateUI('idle'); release(); await page.unroute(endpoint); assert.equal(await page.evaluate(()=>qaCreated.length),beforeBlobs);
  await page.locator('#visitType').selectOption('EXTRA'); await page.locator('#openAdminReport').click(); await stateUI('opened'); await page.evaluate(()=>localStorage.setItem('user',JSON.stringify({id:999999,role:'ADMIN'}))); await stateUI('session'); assert(await button.isDisabled()); assert(await page.locator('#visitType').isDisabled()); assert(await page.evaluate(()=>qaPopups.at(-1).closed)); assert.deepEqual(errors,[]);
  console.log('PASS settings type selector at 320/390/1440 px, real authenticated EXTRA and REGULAR PDF, blocked popup retry, mismatched type rejected, cancellation on changed type/in-flight response and session invalidation');
  console.log('EXTRA_REPORT_EVIDENCE '+evidence);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
