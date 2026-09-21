'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto'), { chromium } = require('playwright'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { resolveUploadSubdir } = require('../src/config/uploadPath');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const root = resolveUploadSubdir('documents'), manifest = path.join(root, 'manifest.json');
const original = fs.existsSync(manifest) ? fs.readFileSync(manifest) : null, files = [];
const gate = () => { let release; return { promise: new Promise(r => { release = r; }), release }; };
const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let browser;
(async () => {
  const stamp = 'qa-document-ui-' + randomUUID(), firstId = Date.now();
  const a = await prisma.client.create({ data: { name: stamp + '-alpha', active: true } });
  const b = await prisma.client.create({ data: { name: stamp + '-beta', active: true } });
  const empty = await prisma.client.create({ data: { name: stamp + '-empty', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: b.id, name: stamp } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: a.id, poolId: pool.id, status: 'DONE' } });
  const user = { id: a.id, clientId: a.id, role: 'CLIENT', principalType: 'CLIENT' }, token = sign(user);
  const bUser = { id: b.id, clientId: b.id, role: 'CLIENT', principalType: 'CLIENT' }, bToken = sign(bUser);
  const listing = id => base + `/api/client-portal/${id}/documents`, download = (id, row) => listing(id) + `/${row.id}/download`;
  const bytesById = new Map(), docs = [];
  function add(fields, bytes = Buffer.from('QA_DOCUMENT_ALPHA_' + docs.length)) {
    const id = firstId + docs.length, filename = stamp + '-' + id + '.txt', file = path.join(root, filename);
    fs.writeFileSync(file, bytes); files.push(file);
    const row = { id, clientId: a.id, filename, title: 'Documento técnico ' + docs.length, type: 'MANUAL', originalName: 'documento-' + docs.length + '.txt', notes: null, createdAt: `2098-01-${String(docs.length + 1).padStart(2, '0')}T00:00:00.000Z`, ...fields };
    docs.push(row); bytesById.set(String(row.id), bytes); return row;
  }
  const historical = add({ id: String(Number.MAX_SAFE_INTEGER), clientId: null, visitId: visit.id, poolId: pool.id, title: 'Histórico máximo', createdAt: null });
  const undated = add({ title: 'Sem data válida', createdAt: 'historical-unknown' });
  const zero = add({ title: 'Ficheiro vazio', originalName: 'vazio.txt' }, Buffer.alloc(0));
  for (let i = 3; i < 13; i++) add({});
  const current = add({ title: 'Ficha técnica <img src=x onerror="window.qaInjected=true"> ' + 'Á'.repeat(90), originalName: 'Ficha técnica — piscina.html', notes: '<script>window.qaInjected=true</script>' }, Buffer.from('<!doctype html><html><script>window.qaExecuted=true;localStorage.setItem("qaExecuted","true")</script></html>'));
  const foreign = add({ clientId: b.id, title: 'DOCUMENT_BETA_ONLY' }, Buffer.from('QA_DOCUMENT_BETA'));
  const snapshot = Buffer.from(JSON.stringify(docs)); fs.writeFileSync(manifest, snapshot);
  const fileHashes = files.map(file => hash(fs.readFileSync(file)));
  const counts = () => Promise.all(['invoice', 'payment', 'serviceVisit', 'monthlyReport'].map(model => prisma[model].count())), before = await counts();
  const response = await fetch(listing(a.id), { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('x-cw-document-type'), 'client-document-list'); assert.equal(response.headers.get('x-cw-client-id'), String(a.id));
  const listData = await response.json(); assert.equal(listData.ok, true); assert.equal(listData.documents.length, 14);
  assert.equal(listData.documents.find(d => String(d.id) === historical.id).clientId, null);
  assert.equal((await fetch(download(b.id, foreign), { headers: { Authorization: 'Bearer ' + token } })).status, 403);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], requests = [];
  async function contextFor(identity, credential) {
    const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 390, height: 900 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(({ user, token }) => {
      if (top !== window || location.protocol === 'blob:') return;
      if (!localStorage.getItem('qaDocumentsInitialized')) {
        for (const key of ['cristalwater_jwt', 'token', 'adminToken']) localStorage.setItem(key, token);
        for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify(user));
        localStorage.setItem('qaDocumentsInitialized', 'true'); localStorage.setItem('cw_language', 'pt');
      }
      localStorage.setItem('qaDocumentsDraft', 'preserved');
      const later = setTimeout; window.setTimeout = (fn, ms, ...args) => later(fn, window.qaShortTimeout && ms === 20000 ? 100 : window.qaShortExpiry && ms === 60000 ? 200 : ms, ...args);
      const make = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      window.qaCreated = []; window.qaRevoked = []; window.qaPopups = [];
      window.open = (...args) => { qaPopups.push(args); return null; };
      URL.createObjectURL = blob => { const url = make(blob); qaCreated.push(url); return url; };
      URL.revokeObjectURL = url => { qaRevoked.push(url); revoke(url); };
      const originalFetch = fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (window.qaHoldBlob && /\/documents\/\d+\/download$/.test(String(args[0]))) {
          const read = response.blob.bind(response); response.blob = async () => { const blob = await read(); window.qaBlobReady = true; await new Promise(r => window.qaReleaseBlob = r); return blob; };
        }
        if (window.qaHoldJson && /\/documents$/.test(String(args[0]))) {
          const read = response.json.bind(response); response.json = async () => { const data = await read(); window.qaJsonReady = true; await new Promise(r => window.qaReleaseJson = r); return data; };
        }
        return response;
      };
    }, { user: identity, token: credential });
    return context;
  }
  async function pageFor(context, suffix = '') {
    const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => { errors.push(e.message); console.error('Portal error:', e.message); });
    page.on('request', r => { if (/\/api\/client-portal\/\d+\/documents/.test(r.url())) requests.push({ url: r.url(), method: r.method(), authorization: r.headers().authorization }); });
    await page.goto(base + '/client-portal' + suffix, { waitUntil: 'networkidle' }); return page;
  }
  async function state(page, kind) {
    try { await page.waitForFunction(kind => document.getElementById('clientDocumentsPanel').dataset.state === kind, kind); }
    catch (error) { console.error(await page.evaluate(() => ({ page: location.pathname, state: document.getElementById('clientDocumentsPanel')?.dataset.state, status: document.getElementById('documentStatus')?.textContent }))); throw error; }
  }
  const downloadState = (page, kind) => page.waitForFunction(kind => document.getElementById('documentDownloadStatus').dataset.state === kind, kind);
  const info = page => page.evaluate(() => ({ created: qaCreated.length, revoked: qaRevoked.length, popups: qaPopups.length }));
  async function hold(page, url, action, work, replacement) {
    const arrived = gate(), release = gate(), finished = gate(); let first = true;
    await page.route(url, async route => {
      if (!first) return route.continue(); first = false;
      const response = await route.fetch(); arrived.release(); await release.promise;
      try { await route.fulfill(replacement ? { response, ...replacement } : { response }); }
      catch (error) { if (!/closed|handled|cancel/i.test(error.message)) throw error; }
      finally { finished.release(); }
    });
    try { await action(); await arrived.promise; await work(); } finally { release.release(); }
    await finished.promise; await page.unroute(url);
  }
  const context = await contextFor(user, token), page = await pageFor(context); await state(page, 'ready');
  const first = () => page.locator('#documentList article button').first(), refresh = () => page.locator('#documentRefresh').click();
  async function save(row, name) {
    const pending = page.waitForEvent('download'); await first().click(); const file = await pending;
    await downloadState(page, 'started'); assert.equal(file.suggestedFilename(), name || row.originalName);
    assert.equal(hash(fs.readFileSync(await file.path())), hash(bytesById.get(String(row.id))));
    assert.equal((await info(page)).popups, 0); assert.equal(await page.evaluate(() => !!window.qaExecuted || !!window.qaInjected || localStorage.getItem('qaExecuted') !== null), false);
  }
  assert.equal(await page.locator('#documentList article').count(), 6); assert.match(await page.locator('#documentSummary').textContent(), /1–6 de 14/);
  assert.equal(await page.locator('#documentList article').first().getAttribute('data-document-id'), String(current.id));
  assert.equal(await page.locator('#documentList a, #documentList img, #documentList script').count(), 0);
  assert.match(await page.locator('#documentList').textContent(), /<img src=x/); assert(!/DOCUMENT_BETA_ONLY/.test(await page.locator('#documentList').textContent()));
  await save(current);
  await page.locator('#documentNext').click(); assert.equal((await info(page)).revoked, 1);
  await page.locator('#documentNext').click(); assert.equal(await page.locator('#documentList article').count(), 2); assert.equal(await page.locator('#documentNext').isDisabled(), true);
  assert.deepEqual(await page.locator('#documentList article').evaluateAll(nodes => nodes.map(n => n.dataset.documentId)), [historical.id, String(undated.id)]);
  await page.locator('#documentSearch').fill('historico'); assert.equal(await page.locator('#documentList article').count(), 1); await save(historical);
  await page.locator('#documentSearch').fill('vazio.txt'); await save(zero);
  await page.locator('#documentSearch').fill('nada-encontrado'); assert.match(await page.locator('#documentList').textContent(), /Não existem documentos/);
  await page.locator('#documentSearch').fill('manual'); assert.match(await page.locator('#documentSummary').textContent(), /14/);
  await page.locator('#documentClear').click(); assert(requests.every(r => r.method === 'GET' && r.authorization === 'Bearer ' + token));
  const fetchesBeforeInvalid = requests.length;
  const invalidUrls = [download(b.id, foreign), '/uploads/documents/file.html', download(a.id, current) + '?x=1', download(a.id, current) + '#x', download(a.id, current).replace('/documents/', '/x/../documents/'), download(a.id, current).replace(String(current.id), '0' + current.id), download(a.id, current).replace(String(current.id), '9007199254740992'), 'https://unrelated.invalid/api/client-portal/1/documents/1/download'];
  assert.equal(await page.evaluate(async urls => {
    let errors = 0; const reader = CristalReportDownloads.create({ access: 'CLIENT_DOCUMENTS', context: () => 'url-validation', state: kind => { if (kind === 'error') errors++; } });
    for (const url of urls) await reader.download(url); return errors;
  }, invalidUrls), invalidUrls.length); assert.equal(requests.length, fetchesBeforeInvalid);
  for (const mutation of [
    { status: 202 }, { status: 403 }, { status: 404 }, { status: 503 }, { status: 302, headers: { location: download(a.id, current) } },
    { headers: { 'content-type': 'text/html' } }, { headers: { 'content-type': 'application/pdf' } },
    { headers: { 'x-cw-document-type': 'client-monthly-pdf' } }, { headers: { 'x-cw-document-id': String(foreign.id) } }, { headers: { 'x-cw-client-id': String(b.id) } },
    { headers: { 'content-disposition': 'inline; filename="wrong.html"' } }, { headers: { 'content-disposition': '' } }, { headers: { 'content-length': '2' } },
  ]) {
    await page.route(download(a.id, current), async route => { const response = await route.fetch(); await route.fulfill({ response, ...mutation, headers: { ...response.headers(), ...mutation.headers } }); });
    const before = (await info(page)).created; await first().click(); await downloadState(page, 'error'); assert.equal((await info(page)).created, before); await page.unroute(download(a.id, current));
  }
  const head = listData.documents[0], one = row => ({ ok: true, documents: [row] });
  for (const mutation of [
    { status: 202 }, { status: 503 }, { headers: { 'x-cw-client-id': String(b.id) } }, { headers: { 'x-cw-document-type': 'other' } },
    { headers: { 'content-type': 'text/html' } }, { body: '{broken' }, { json: { documents: [] } }, { json: { ok: false, documents: [] } },
    { json: one({ ...head, clientId: b.id }) }, { json: one({ ...head, id: '0' + head.id }) }, { json: one({ ...head, id: 9007199254740992 }) },
    { json: one({ ...head, id: true }) }, { json: one({ ...head, downloadUrl: 'javascript:alert(1)' }) }, { json: one({ ...head, url: download(b.id, foreign) }) },
    { json: { ok: true, documents: [head, { ...head, id: String(head.id) }] } }, { json: { ok: true, documents: [null] } },
  ]) {
    await page.route(listing(a.id), async route => { const response = await route.fetch(); await route.fulfill({ response, ...mutation, headers: { ...response.headers(), ...mutation.headers } }); });
    await refresh(); await state(page, 'error'); assert.equal(await page.locator('#documentList article').count(), 0); await page.unroute(listing(a.id));
    await page.locator('#documentList button').click(); await state(page, 'ready');
  }
  const beforeDelay = (await info(page)).created;
  await hold(page, download(a.id, current), () => first().click(), async () => {
    const count = requests.length; await first().dispatchEvent('click'); assert.equal(requests.length, count);
    await page.locator('#documentSearch').fill('historico'); await downloadState(page, 'idle'); await page.locator('#documentClear').click();
  }); assert.equal((await info(page)).created, beforeDelay);
  await page.evaluate(() => window.qaHoldBlob = true); await first().click(); await page.waitForFunction(() => window.qaBlobReady);
  await page.locator('#documentNext').click(); await downloadState(page, 'idle'); await page.evaluate(() => { window.qaHoldBlob = false; window.qaReleaseBlob(); });
  assert.equal((await info(page)).created, beforeDelay); await page.locator('#documentClear').click();
  await hold(page, download(a.id, current), () => first().click(), async () => {
    await page.locator('#cwLanguageSelect').selectOption('en'); await state(page, 'ready'); await downloadState(page, 'idle');
    await page.locator('#cwLanguageSelect').selectOption('pt'); await state(page, 'ready');
  }); assert.equal((await info(page)).created, beforeDelay);
  await page.evaluate(() => window.qaShortTimeout = true);
  await hold(page, download(a.id, current), () => first().click(), () => downloadState(page, 'error'));
  await hold(page, listing(a.id), refresh, () => state(page, 'error')); await page.evaluate(() => window.qaShortTimeout = false); await refresh(); await state(page, 'ready');
  await context.setOffline(true); await refresh(); await state(page, 'error'); await context.setOffline(false);
  const noReplay = requests.length; await page.waitForTimeout(300); assert.equal(requests.length, noReplay); await page.locator('#documentList button').click(); await state(page, 'ready');
  await page.evaluate(() => window.qaShortExpiry = true); await save(current); await page.waitForFunction(() => qaRevoked.includes(qaCreated.at(-1))); await page.evaluate(() => window.qaShortExpiry = false);
  const titleByLanguage = { pt: 'Documentos disponíveis', en: 'Available documents', fr: 'Documents disponibles', es: 'Documentos disponibles', de: 'Verfügbare Dokumente' };
  for (const [language, title] of Object.entries(titleByLanguage)) {
    await page.locator('#cwLanguageSelect').selectOption(language); await state(page, 'ready'); await page.waitForFunction(title => document.getElementById('documentTitle').textContent === title, title);
  }
  const evidence = path.join(__dirname, '../reports/field-visual/client-documents-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
  await page.locator('#cw-v21-toast').waitFor({ state: 'hidden' });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.locator('#clientDocumentsPanel').scrollIntoViewIfNeeded();
    const layout = await page.locator('#clientDocumentsPanel, #clientDocumentsPanel input, #clientDocumentsPanel button, #clientDocumentsPanel h4').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { id: n.id, x: r.x, right: r.right, overflow: n.scrollWidth - n.clientWidth, height: r.height, control: n.matches('input,button') }; }));
    await page.locator('#clientDocumentsPanel').screenshot({ path: path.join(evidence, 'documents-' + width + '.png') });
    // Chromium can report 43.99998474121094 for a 44 px control after scrolling.
    const rectangleTolerance = 0.001;
    assert(layout.every(r => r.x >= 0 && r.right <= width + 1 && r.overflow <= 1 && (!r.control || r.height + rectangleTolerance >= 44)), JSON.stringify({ width, layout }));
  }
  await page.locator('#cwLanguageSelect').selectOption('pt'); await state(page, 'ready'); await save(current);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide'))); assert.equal(await page.locator('#documentList article').count(), 0); assert.equal((await info(page)).created, (await info(page)).revoked);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await state(page, 'ready');
  console.log('PASS client documents: authenticated list and real inert downloads, 14 documents, historical/MAX_SAFE_INTEGER IDs, empty files, search, pagination, malformed responses, timeout, offline, expiry and five responsive languages');
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const adminUser = { id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' }, adminContext = await contextFor(adminUser, sign(adminUser));
  const preview = await pageFor(adminContext, '?clientId=' + a.id); await state(preview, 'ready');
  const choose = id => preview.evaluate(id => chooseAdminClient(id), id);
  await hold(preview, listing(a.id), () => preview.locator('#documentRefresh').click(), async () => {
    await choose(b.id); await state(preview, 'ready'); assert.equal(await preview.locator('#documentList article').getAttribute('data-document-id'), String(foreign.id));
    await choose(a.id); await state(preview, 'ready');
  }, { json: { ok: true, documents: [] } });
  await state(preview, 'ready'); assert.match(await preview.locator('#documentSummary').textContent(), /14/);
  await hold(preview, download(a.id, current), () => preview.locator('#documentList article button').first().click(), async () => { await choose(b.id); await state(preview, 'ready'); await choose(a.id); await state(preview, 'ready'); });
  assert.equal((await info(preview)).created, 0);
  await preview.evaluate(() => window.qaHoldJson = true); await preview.locator('#documentRefresh').click(); await preview.waitForFunction(() => window.qaJsonReady);
  await preview.evaluate(() => window.qaHoldJson = false); await choose(b.id); await state(preview, 'ready'); await choose(a.id); await state(preview, 'ready');
  await preview.evaluate(() => window.qaReleaseJson()); assert.match(await preview.locator('#documentSummary').textContent(), /14/);
  await choose(empty.id); await state(preview, 'ready'); assert.match(await preview.locator('#documentList').textContent(), /Ainda não existem/);
  await choose(0); await state(preview, 'idle'); assert.equal(await preview.locator('#documentRefresh').isDisabled(), true);
  console.log('PASS administrator preview: exact customer, late A-B-A list/JSON/download cancellation, empty history and cleared selection');
  await hold(page, download(a.id, current), () => first().click(), async () => {
    const otherTab = await context.newPage(); await otherTab.goto(base + '/client-portal');
    await otherTab.evaluate(({ user, token }) => { for (const key of ['cristalwater_jwt', 'token', 'adminToken']) localStorage.setItem(key, token); for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: bUser, token: bToken });
    await state(page, 'session'); assert.equal(await page.locator('#documentList article').count(), 0); await otherTab.close();
  });
  assert.equal(await page.evaluate(() => localStorage.getItem('qaDocumentsDraft')), 'preserved');
  await page.reload(); await state(page, 'ready'); assert.equal(await page.locator('#documentList article').getAttribute('data-document-id'), String(foreign.id));
  const expiredContext = await contextFor(user, token), expired = await pageFor(expiredContext); await state(expired, 'ready');
  await expired.route(download(a.id, current), route => route.fulfill({ status: 401, json: { ok: false } }));
  await expired.locator('#documentList article button').first().click(); await expired.waitForURL(/\/(?:client-)?login/);
  assert.equal(await expired.evaluate(() => localStorage.getItem('qaDocumentsDraft')), 'preserved'); assert.equal(await expired.evaluate(() => localStorage.getItem('cristalwater_jwt')), null);
  assert.deepEqual(await counts(), before); assert.equal(hash(fs.readFileSync(manifest)), hash(snapshot)); assert.deepEqual(files.map(file => hash(fs.readFileSync(file))), fileHashes);
  assert.deepEqual(errors, []); console.log('PASS cross-tab session switch and actual 401; manifest, source files, visits, monthly reports and finances preserved'); console.log('Visual evidence ' + evidence);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (original === null) fs.rmSync(manifest, { force: true }); else fs.writeFileSync(manifest, original);
  for (const file of files) fs.rmSync(file, { force: true });
  await prisma.$disconnect();
});
