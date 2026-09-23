'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
let child, browser;
(async () => {
  const month = '2005-03', stamp = randomUUID(), user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: user.id, userId: user.id, principalType: 'USER', role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const auth = { Authorization: 'Bearer ' + token }, owner = 'ADMIN:' + user.id;
  child = fork(require.resolve('./fixtures/expense-server'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); });
  const get = p => fetch(base + '/api/expenses' + p, { headers: auth }).then(r => r.json());
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ user, token }) => {
    if (top !== window) return; window.CW_API_ORIGIN = location.origin;
    for (const k of ['cristalwater_jwt', 'token', 'adminToken']) localStorage.setItem(k, token);
    for (const k of ['cristalwater_user', 'user']) localStorage.setItem(k, JSON.stringify(user));
    localStorage.setItem('qaUnrelatedDraft', 'preserved');
    const timer = window.setTimeout; window.setTimeout = (fn, ms, ...args) => timer(fn, window.qaExpenseTimeout && ms === 40000 ? 100 : ms, ...args);
  }, { user: { id: user.id, role: 'ADMIN' }, token });
  const page = await context.newPage(), errors = [], posts = []; page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname.startsWith('/api/expenses')) posts.push({ path: new URL(r.url()).pathname, body: r.headers()['content-type']?.includes('application/json') ? r.postDataJSON() : null }); });
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Correção confirmada pelo ADMIN em QA' : undefined));
  const state = value => page.waitForFunction(v => document.getElementById('expenseStatus').dataset.state === v, value);
  const ready = () => page.waitForFunction(() => ['ready', 'review'].includes(document.getElementById('expenseStatus').dataset.state));
  const pending = () => page.waitForFunction(() => !document.getElementById('pendingPanel').hidden && !document.getElementById('checkPending').disabled);
  const settled = () => page.waitForFunction(() => document.getElementById('pendingPanel').hidden && !document.getElementById('newExpense').disabled);
  async function load() { await page.locator('#expenseRefresh').click(); await ready(); }
  async function selectMonth() { await page.locator('#expenseMonth').fill(month); await load(); }
  async function form(title) {
    await page.locator('#newExpense').click(); await page.locator('#expenseTitle').waitFor({ state: 'visible' });
    await page.locator('#expenseTitle').fill(title); await page.locator('#expenseSupplierName').fill('Fornecedor UI ' + stamp);
    await page.locator('#expenseDocument').fill(title); await page.locator('#expenseAmount').fill('123,45');
    await page.locator('#expenseDate').fill(month + '-12'); await page.locator('#expenseDue').fill(month + '-30'); await page.locator('#expenseConfirmed').check();
  }
  await page.goto(base + '/admin-expenses', { waitUntil: 'domcontentloaded' }); await ready(); await selectMonth();
  const title = 'Expense UI <img src=x> ' + stamp; await form(title);
  const before = posts.length; await page.locator('#expenseForm button[type=submit]').evaluate(b => { b.click(); b.click(); });
  await settled(); const expense = await prisma.companyExpense.findFirstOrThrow({ where: { title } }), id = expense.id;
  await page.waitForFunction(id => document.getElementById('detailTitle').textContent.endsWith('#' + id) && !document.getElementById('expenseDetail').hidden, id);
  assert.equal(posts.length - before, 1); assert.equal(await page.locator('#expenseRows img').count(), 0); assert.match(await page.locator('#detailFacts').textContent(), /123,45/);
  await page.locator('#paymentAmount').fill('23,45'); await page.locator('#paymentDate').fill(month + '-20'); await page.locator('#paymentForm button').click(); await settled();
  await page.waitForFunction(() => document.querySelectorAll('#paymentRows .row').length === 1); assert.equal((await get('/' + id)).expense.openCents, 10000);
  await page.locator('#paymentRows button').click(); await settled(); assert.equal((await get('/' + id)).expense.openCents, 12345);
  const bytes = Buffer.from('%PDF-1.4\nExpense UI evidence\n%%EOF'); await page.locator('#expenseFile').setInputFiles({ name: 'private-ui.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.locator('#evidenceForm button').click(); await settled(); await page.locator('#evidenceRows button').first().waitFor();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Descarregar comprovativo', exact: true }).click(); const download = await downloaded;
  assert.deepEqual(fs.readFileSync(await download.path()), bytes);
  await page.getByRole('button', { name: 'Anular comprovativo', exact: true }).click(); await settled(); assert((await get('/' + id)).expense.evidence[0].voidedAt);
  await page.locator('#cancelExpense').click(); await settled(); assert.equal((await get('/' + id)).expense.status, 'CANCELLED');
  await page.locator('#reopenExpense').click(); await settled(); assert.equal((await get('/' + id)).expense.status, 'OPEN');
  const purchase = await prisma.stockPurchase.create({ data: { supplierName: 'UI source ' + stamp, invoiceNumber: 'SOURCE-UI-' + stamp, invoiceDate: new Date(month + '-02T00:00:00Z'), totalAmount: 10, items: { create: { productName: 'QA stock', quantity: 1, unitCost: 10, totalCost: 10 } } } });
  await page.locator('#newExpense').click(); await page.locator('#sourceType').selectOption('STOCK_PURCHASE'); await page.locator('#sourceSearch').fill(stamp); await page.locator('#sourceRefresh').click();
  await page.getByRole('button', { name: 'Rever esta origem', exact: true }).click(); await page.waitForFunction(() => document.getElementById('expenseAmount').value === '10.00'); await page.locator('#expenseConfirmed').check(); await page.locator('#expenseForm button[type=submit]').click(); await settled();
  const sourceExpense = await prisma.companyExpense.findUniqueOrThrow({ where: { stockPurchaseId: purchase.id } });
  await prisma.stockPurchase.update({ where: { id: purchase.id }, data: { totalAmount: 12 } }); await load(); await state('review'); assert.match(await page.locator('#expenseMetrics').textContent(), /Por confirmar/);
  await page.getByRole('button', { name: 'Abrir despesa #' + sourceExpense.id, exact: true }).click(); await page.locator('#expenseDetail').waitFor(); assert(await page.locator('#paymentBox').isHidden());
  await page.locator('#editExpense').click(); await page.locator('#expenseAmount').fill('12,00'); await page.locator('#expenseReason').fill('Documento revisto: total corrigido'); await page.locator('#expenseConfirmed').check(); await page.locator('#expenseForm button[type=submit]').click(); await settled(); await ready(); assert.equal((await get('/' + sourceExpense.id)).expense.sourceChanged, false);
  const visual = path.resolve('reports/field-visual/company-expenses-' + Date.now()); fs.mkdirSync(visual, { recursive: true });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.locator('#expenseMetrics').scrollIntoViewIfNeeded();
    const boxes = await page.locator('#expensePage main section,#expensePage main article,#expensePage main input,#expensePage main select,#expensePage main button').evaluateAll(ns => ns.filter(n => n.getClientRects().length).map(n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right, overflow: n.scrollWidth - n.clientWidth, height: r.height, tag: n.tagName, checkbox: n.type === 'checkbox' }; }));
    assert(boxes.every(r => r.x >= -0.001 && r.right <= width + 1 && r.overflow <= 1), JSON.stringify({ width, boxes }));
    assert(boxes.filter(r => ['INPUT','SELECT','BUTTON'].includes(r.tag) && !r.checkbox).every(r => r.height >= 44 - 0.001)); await page.screenshot({ path: path.join(visual, 'expenses-' + width + '.png') });
  }
  await page.setViewportSize({ width: 390, height: 900 }); await page.emulateMedia({ colorScheme: 'dark' });
  const contrast = await page.locator('#expensePage main p,#expensePage main h2,#expensePage .metric strong,#expensePage .metric span').evaluateAll(ns => {
    const light = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
    return ns.filter(n => n.getClientRects().length).map(n => { let p = n, bg; while (p) { bg = getComputedStyle(p).backgroundColor; if (!['transparent', 'rgba(0, 0, 0, 0)'].includes(bg)) break; p = p.parentElement; } const color = getComputedStyle(n).color, a = light(color), b = light(bg); return { id: n.id, className: n.className, text: n.textContent.slice(0, 120), color, background: bg, ratio: (Math.max(a,b) + .05) / (Math.min(a,b) + .05) }; });
  }); assert(contrast.every(c => c.ratio >= 4.5), JSON.stringify(contrast.filter(c => c.ratio < 4.5))); await page.screenshot({ path: path.join(visual, 'expenses-dark-390.png') }); await page.emulateMedia({ colorScheme: 'light' });
  // A response lost after commit must survive reload and resolve through its original receipt, without a POST replay.
  const commandEndpoint = '**/api/expenses/commands'; await page.route(commandEndpoint, async route => { await route.fetch(); await route.abort('failed'); });
  const lostTitle = 'Lost response ' + stamp; await form(lostTitle); await page.locator('#expenseForm button[type=submit]').click(); await pending(); const lostRequest = posts.at(-1).body; assert.equal(await prisma.expenseEvent.count({ where: { requestId: lostRequest.requestId } }), 1);
  await page.unroute(commandEndpoint); const sent = posts.length; await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await pending(); assert.equal(posts.length, sent); await page.locator('#checkPending').click(); await settled(); assert.equal(posts.length, sent); assert.equal(await prisma.companyExpense.count({ where: { title: lostTitle } }), 1);
  await selectMonth();
  // A request that never reached the server is explicitly cancelled there; replaying its UUID cannot create an expense.
  await page.route(commandEndpoint, route => route.abort('failed')); await form('Cancelled request ' + stamp); await page.locator('#expenseForm button[type=submit]').click(); await pending(); const cancelled = posts.at(-1).body; await page.unroute(commandEndpoint);
  await page.locator('#cancelPending').click(); await settled(); assert.equal((await fetch(base + '/api/expenses/commands', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(cancelled) }).then(r => r.json())).code, 'CANCELLED_REQUEST');
  await page.locator('#newExpense').click(); await page.locator('#discardDraft').click(); assert(await page.locator('#expenseEditor').isHidden());
  // Incomplete acknowledgements remain pending, and an explicit retry uses exactly the original envelope.
  await page.route(commandEndpoint, route => route.fulfill({ status: 200, json: { ok: true, applied: true } })); await form('Retry same request ' + stamp); await page.locator('#expenseForm button[type=submit]').click(); await pending(); const retryBody = posts.at(-1).body; await page.unroute(commandEndpoint); await page.locator('#retryPending').click(); await settled(); assert.deepEqual(posts.at(-1).body, retryBody);
  const endpoint = '**/api/expenses?*', good = await get('?monthRef=' + month + '&scope=month&filter=ALL&q=&page=1');
  for (const response of [{ status: 202, json: good }, { status: 503, json: { ok: false } }, { status: 200, contentType: 'text/html', body: 'unavailable' }, { status: 200, json: { ...good, summary: { ...good.summary, documentAmountCents: '0' } } }, { status: 200, json: { ...good, monthRef: '2005-04' } }]) {
    await page.route(endpoint, r => r.fulfill(response)); await page.locator('#expenseRefresh').click(); await state('error'); assert.equal(await page.locator('#expenseMetrics').textContent(), ''); await page.unroute(endpoint);
  }
  await load(); await context.setOffline(true); await page.waitForFunction(() => document.getElementById('newExpense').disabled); await context.setOffline(false); await load();
  async function delayed(pattern, start, work, json) { let enter, release, finish; const entered = new Promise(r => enter = r), gate = new Promise(r => release = r), done = new Promise(r => finish = r); await page.route(pattern, async route => { enter(); await gate; try { await route.fulfill({ json }); } finally { finish(); } }); await start(); await entered; await work(); release(); await done; await page.unroute(pattern); }
  await delayed(endpoint, () => page.locator('#expenseRefresh').click(), async () => { await page.locator('#expenseMonth').fill('2005-04'); await page.locator('#expenseMonth').fill(month); }, good); await state('idle'); assert.equal(await page.locator('#expenseMetrics').textContent(), ''); await load();
  await page.evaluate(() => window.qaExpenseTimeout = true); await delayed(endpoint, () => page.locator('#expenseRefresh').click(), () => state('error'), good); await page.evaluate(() => window.qaExpenseTimeout = false); await load();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await state('idle'); assert.equal(await page.locator('#expenseMetrics').textContent(), ''); await load();
  const detailJson = await get('/' + id);
  await delayed('**/api/expenses/' + id, () => page.getByRole('button', { name: 'Abrir despesa #' + id, exact: true }).click(), async () => {
    await page.getByRole('button', { name: 'Abrir despesa #' + sourceExpense.id, exact: true }).click(); await page.waitForFunction(id => document.getElementById('detailTitle').textContent.endsWith('#' + id), sourceExpense.id);
  }, detailJson); assert.match(await page.locator('#detailTitle').textContent(), new RegExp('#' + sourceExpense.id + '$'));
  // Failure to persist the command blocks the POST. Other local drafts survive session invalidation.
  await form('Storage must block ' + stamp); const countBeforeStorage = posts.length;
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; window.qaRestorePut = () => IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.put = function () { throw Error('QA storage unavailable'); }; });
  await page.locator('#expenseForm button[type=submit]').click(); await page.waitForFunction(() => document.getElementById('writeStatus').textContent.includes('QA storage unavailable')); assert.equal(posts.length, countBeforeStorage); await page.evaluate(() => window.qaRestorePut());
  await page.locator('#discardDraft').click(); await form('Pending owner ' + stamp); await page.route(commandEndpoint, r => r.abort('failed')); await page.locator('#expenseForm button[type=submit]').click(); await pending(); const ownedRequest = posts.at(-1).body;
  await page.evaluate(() => { const original = localStorage.getItem('user'); localStorage.setItem('user', JSON.stringify({ id: 999999, role: 'ADMIN' })); localStorage.setItem('user', original); }); await state('session');
  assert.equal(await page.locator('#expenseMetrics').textContent(), ''); assert.equal(await page.locator('#pendingPreview').textContent(), ''); assert.equal(await page.evaluate(() => localStorage.getItem('qaUnrelatedDraft')), 'preserved');
  await page.unroute(commandEndpoint); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await pending(); await page.locator('#checkPending').click(); await pending(); assert.equal((await get('/requests/' + ownedRequest.requestId)).ok, false); await page.locator('#cancelPending').click(); await settled();
  const other = await context.newPage(); await other.goto(base + '/admin-expenses', { waitUntil: 'domcontentloaded' }); await other.evaluate(() => localStorage.setItem('token', 'changed')); await state('session'); assert.equal(await page.locator('#expenseMetrics').textContent(), '');
  assert.deepEqual(errors, []); assert.equal(await prisma.expenseEvent.count({ where: { requestId: retryBody.requestId } }), 1);
  console.log('PASS real company expenses browser: manual/source entry, partial payment/reversal, private proof download/void, cancel/reopen, source review, responsive and dark contrast, lost response/reload/query, durable cancellation and exact retry, malformed acknowledgements and reads, offline/timeout/BFCache, stale month/detail guards, storage failure and owner/cross-tab session isolation');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); child?.kill('SIGTERM'); await prisma.$disconnect(); });
