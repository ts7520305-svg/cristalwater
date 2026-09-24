'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'QA document identity', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'QA document pool', clientId: client.id } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 17, totalAmount: 17, amount: 17, amountOpen: 17 } });
  await prisma.extraVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', billingMode: 'EXTRA', price: 3.45 } });
  const vehicle = await prisma.vehicle.create({ data: { plate: 'OPEN-' + Date.now(), active: true } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, status: 'ACTIVE', codeAT: 'OPEN-' + Date.now(), validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  const work = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  const oldGuide = await prisma.transportGuide.create({ data: { status: 'CLOSED' } });
  const oldWork = await prisma.workGuide.create({ data: { status: 'CLOSED' } });
  const sign = data => jwt.sign(data, getJwtSecret(), { expiresIn: '1h' });
  const token = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const clientToken = sign({ id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' });
  const form = new FormData(); form.append('clientId', String(client.id)); form.append('file', new Blob(['<script>UNTRUSTED_ATTACHMENT</script>'], { type: 'text/html' }), 'original.html');
  const upload = await fetch(base + '/api/client-messages/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  assert.equal(upload.status, 200); const attachment = (await upload.json()).message;
  const snapshot = async () => JSON.stringify(await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoice.id }, include: { lines: true, payments: true } }),
    prisma.extraVisit.findMany({ where: { clientId: client.id } }),
    prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.workGuide.findUnique({ where: { id: work.id } }),
    prisma.clientMessage.findUnique({ where: { id: attachment.id } }),
    prisma.transportGuide.findUnique({ where: { id: oldGuide.id } }), prisma.workGuide.findUnique({ where: { id: oldWork.id } }),
    ...['invoice', 'payment', 'stockMovement', 'fieldWriteRequest'].map(model => prisma[model].count())
  ]));
  const before = await snapshot();
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext();
  await context.addInitScript(({ token, id }) => {
    for (const key of ['cristalwater_jwt', 'token']) localStorage.setItem(key, token);
    for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
  }, { token, id: admin.id });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/invoice-document?id=' + invoice.id, { waitUntil: 'networkidle' });
  const paths = [`/api/invoice-pdf/${invoice.id}`, `/api/invoice-pdf/extras/${client.id}`, `/api/guides/transport/${guide.id}/pdf`, `/api/guides/transport/latest/${vehicle.id}/pdf`, `/api/guides/work/${work.id}/pdf`, `/api/guides/vehicles/${vehicle.id}/insurance/pdf`, `/api/guides/transport/${oldGuide.id}/pdf`, `/api/guides/work/${oldWork.id}/pdf`];
  for (const path of paths) {
    const result = await page.evaluate(async path => {
      const popup = { location: {}, close() { this.closed = true; } }; window.open = () => popup;
      await CristalDownloads.open(path); const response = await fetch(popup.location.href); const text = await response.text(); CristalDownloads.cancel();
      return { prefix: text.slice(0, 5), tail: text.trim().endsWith('%%EOF'), opener: popup.opener, closed: !!popup.closed };
    }, path);
    assert.deepEqual(result, { prefix: '%PDF-', tail: true, opener: null, closed: true });
  }
  console.log('PASS six real PDF endpoints and two historical guides without vehicles confirm document/client/vehicle identity and complete content through the authenticated browser reader');
  const attack = async (kind, argument = null) => page.evaluate(async ({ path, kind, argument }) => {
    const original = { fetch: window.fetch, open: window.open, now: Date.now, timeout: window.setTimeout.bind(window), create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'], saved = keys.map(key => localStorage.getItem(key));
    const response = await original.fetch(path, { headers: { Authorization: 'Bearer ' + saved[0] } });
    const bytes = await response.arrayBuffer(), headers = new Headers(response.headers);
    let created = 0, requests = 0, popupCount = 0, seenOptions;
    const popup = { location: {}, close() { this.closed = true; } };
    window.open = () => { popupCount++; return kind === 'popup' ? null : popup; };
    URL.createObjectURL = value => { created++; return original.create(value); };
    window.fetch = async (url, options) => {
      requests++; seenOptions = { cache: options.cache, redirect: options.redirect, authorization: options.headers.Authorization };
      if (['timeout', 'cancel'].includes(kind)) {
        if (kind === 'cancel') original.timeout(() => CristalDownloads.cancel(), 10);
        return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      }
      if (kind === 'offline') throw TypeError('Failed to fetch');
      if (kind === 'identity') headers.set(argument[0], argument[1]);
      if (kind === 'missing') headers.delete(argument);
      if (kind === 'mime') headers.set('content-type', 'text/html');
      const output = new Response(kind === 'html' ? '<html>NOT A PDF</html>' : kind === 'truncated' ? '%PDF-1.7\nunfinished' : bytes, { status: kind === 'status' ? argument : 200, headers });
      if (kind === 'account-response') localStorage.setItem('user', '{different-account');
      if (kind === 'account-body') output.blob = async () => { localStorage.setItem('user', '{different-account'); return new Blob([bytes]); };
      if (kind === 'expired') Date.now = () => original.now() + 7200000;
      if (kind === 'closed') popup.closed = true;
      return output;
    };
    if (kind === 'timeout') window.setTimeout = (fn, delay, ...args) => original.timeout(fn, delay === 20000 ? 15 : delay, ...args);
    if (kind === 'aliases') localStorage.setItem('adminToken', 'different');
    try { await CristalDownloads.open(kind === 'url' ? argument : path); return { code: 'OPENED', created, requests, popupCount }; }
    catch (error) { return { code: error.code, created, requests, popupCount, closed: !!popup.closed, url: popup.location.href || null, seenOptions }; }
    finally {
      CristalDownloads.cancel(); window.fetch = original.fetch; window.open = original.open; Date.now = original.now; window.setTimeout = original.timeout; URL.createObjectURL = original.create;
      keys.forEach((key, i) => saved[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, saved[i]));
    }
  }, { path: paths[0], kind, argument });
  const cases = [
    ['identity', ['X-CW-Invoice-Id', String(invoice.id + 1)], 'UNCONFIRMED'], ['identity', ['X-CW-Document-Type', 'extras'], 'UNCONFIRMED'],
    ['missing', 'X-CW-Client-Id', 'UNCONFIRMED'], ['missing', 'Cache-Control', 'UNCONFIRMED'], ['missing', 'X-Content-Type-Options', 'UNCONFIRMED'],
    ['mime', null, 'UNCONFIRMED'], ['html', null, 'INCOMPLETE'], ['truncated', null, 'INCOMPLETE'],
    ...[206, 302, 503].map(status => ['status', status, 'RETRY']), ['status', 401, 'SESSION'], ['status', 403, 'UNAVAILABLE'], ['status', 404, 'UNAVAILABLE'],
    ['offline', null, 'RETRY'], ['timeout', null, 'TIMEOUT'], ['cancel', null, 'CANCELLED'], ['closed', null, 'CANCELLED'],
    ['account-response', null, 'SESSION'], ['account-body', null, 'SESSION'], ['expired', null, 'SESSION'], ['aliases', null, 'SESSION'], ['popup', null, 'POPUP']
  ];
  for (const [kind, value, code] of cases) {
    const result = await attack(kind, value); assert.equal(result.code, code, JSON.stringify({ kind, result })); assert.equal(result.created, 0);
    if (result.popupCount && kind !== 'popup') assert.equal(result.closed, true);
    if (result.seenOptions) { assert.equal(result.seenOptions.cache, 'no-store'); assert.equal(result.seenOptions.redirect, 'error'); }
  }
  for (const url of ['https://other.invalid/api/invoice-pdf/1', '/api/invoice-pdf/01', '/api/invoice-pdf/2147483648', '/api/invoice-pdf/%31', '/api/invoice-pdf/1?clientId=2', '/api/invoice-pdf/1#x', '/api/guides/work/1/start', '/api/guides/work/1', '/api/invoice-pdf/../invoice-pdf/1', '/api/client-messages/attachments/0']) {
    const result = await attack('url', url); assert.equal(result.code, 'INVALID_DOCUMENT', url); assert.equal(result.requests, 0); assert.equal(result.popupCount, 0);
  }
  console.log('PASS wrong identity/MIME, HTML, truncated PDF, missing private headers, partial/redirect/error replies, blocked windows, timeout, cancellation, account/body changes, expiry and noncanonical URLs');
  const lifecycle = await page.evaluate(async path => {
    const popup = { location: {}, close() { this.closed = true; } }; window.open = () => popup;
    const original = URL.revokeObjectURL, revoked = []; URL.revokeObjectURL = value => { revoked.push(value); original(value); };
    await CristalDownloads.open(path); const url = popup.location.href;
    const before = localStorage.getItem('user'); localStorage.setItem('user', '{changed'); window.dispatchEvent(new StorageEvent('storage', { key: 'user' }));
    localStorage.setItem('user', before); URL.revokeObjectURL = original;
    return { closed: !!popup.closed, revoked: revoked.includes(url) };
  }, paths[0]); assert.deepEqual(lifecycle, { closed: true, revoked: true });
  const inert = await page.evaluate(async path => {
    const popup = { location: {}, close() { this.closed = true; } }; window.open = () => popup;
    const original = HTMLAnchorElement.prototype.click; let downloaded;
    HTMLAnchorElement.prototype.click = function () { downloaded = { name: this.download, url: this.href }; };
    try { await CristalDownloads.open(path); const response = await fetch(downloaded.url); return { name: downloaded.name, type: response.headers.get('content-type'), body: await response.text(), closed: !!popup.closed, displayed: !!popup.location.href }; }
    finally { HTMLAnchorElement.prototype.click = original; }
  }, `/api/client-messages/attachments/${attachment.id}`);
  assert.equal(inert.name, 'original.html'); assert.equal(inert.type, 'application/octet-stream'); assert.match(inert.body, /UNTRUSTED_ATTACHMENT/); assert.equal(inert.closed, true); assert.equal(inert.displayed, false);
  // A response labelled with another owner is refused even when its document ID matches.
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, clientId: id, role: 'CLIENT' })); }, { token: clientToken, id: client.id });
  const wrongOwner = await attack('identity', ['X-CW-Client-Id', String(client.id + 1)]); assert.equal(wrongOwner.code, 'UNCONFIRMED'); assert.equal(wrongOwner.created, 0);
  assert.equal(await snapshot(), before); assert.deepEqual(errors, []);
  console.log('PASS displayed files revoked on account change, HTML attachments preserved as inert downloads, owner binding and unchanged original financial/guide/chat records');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
