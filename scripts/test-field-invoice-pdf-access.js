'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Documento privado QA', active: true } });
  const other = await prisma.client.create({ data: { name: 'Outro titular QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Técnico PDF QA', active: true } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 10, totalAmount: 10, amount: 10, amountOpen: 10 } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const own = sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), foreign = sign({ id: other.id, clientId: other.id, role: 'CLIENT' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  async function get(path, token) { const r = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); return { status: r.status, data: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type'), cache: r.headers.get('cache-control') }; }
  const path = `/api/invoice-pdf/${invoice.id}`;
  const anonymous = await get(path); console.log(JSON.stringify({ anonymousStatus: anonymous.status, expected: 401 })); assert.equal(anonymous.status, 401);
  assert.equal((await get(path, foreign)).status, 404); assert.equal((await get(path, tt)).status, 403);
  for (const token of [own, at]) { const r = await get(path, token); assert.equal(r.status, 200); assert.equal(r.data.subarray(0, 5).toString(), '%PDF-'); assert.equal(r.cache, 'private, no-store'); }
  for (const status of ['DRAFT', 'CANCELLED', 'VOID', 'ARCHIVED']) {
    const hidden = await prisma.invoice.create({ data: { clientId: client.id, status } }); assert.equal((await get(`/api/invoice-pdf/${hidden.id}`, own)).status, 404);
  }
  const extras = `/api/invoice-pdf/extras/${client.id}`;
  assert.equal((await get(extras)).status, 401); assert.equal((await get(extras, foreign)).status, 404); assert.equal((await get(extras, tt)).status, 403);
  assert.equal((await get(extras, own)).status, 404); // Authorized, but this fixture has no extra visits.
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina PDF' } });
  const extra = await prisma.extraVisit.create({ data: { clientId: client.id, poolId: pool.id, price: 15, billed: false } });
  assert.equal((await get(extras,own)).status,404,'Planned work is not a completed extra for billing');
  await prisma.extraVisit.create({data:{clientId:client.id,poolId:pool.id,price:99,status:'DONE',billingMode:'NO_CHARGE'}});
  assert.equal((await get(extras,own)).status,404,'A free extra is never a chargeable PDF source');
  await prisma.extraVisit.update({where:{id:extra.id},data:{status:'DONE'}});
  for (const token of [own, at]) { const r = await get(extras, token); assert.equal(r.status, 200); assert.equal(r.data.subarray(0, 5).toString(), '%PDF-'); assert.equal(r.cache, 'private, no-store'); }
  for (const id of ['0', '-1', '1x', '2147483648']) assert.equal((await get(`/api/invoice-pdf/${id}`, at)).status, 400);
  await prisma.client.update({ where: { id: client.id }, data: { active: false } }); assert.equal((await get(path, own)).status, 401);
  console.log('PASS invoice PDFs require an active principal, administration or exact client ownership; withdrawn drafts and extras do not leak');
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext();
  await context.addInitScript(({ token, id }) => {
    for (const key of ['cristalwater_jwt', 'token']) localStorage.setItem(key, token);
    for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
  }, { token: at, id: admin.id });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  await page.goto(base + '/invoices', { waitUntil: 'networkidle' });
  await page.waitForFunction(id => invoicesState.some(row => row.id === id), invoice.id);
  const displayed = await page.evaluate(async id => {
    const popup = { location: {}, close() { this.closed = true; } };
    window.open = () => popup;
    await openInvoicePdf(id);
    const response = await fetch(popup.location.href);
    return { url: popup.location.href, bytes: (await response.text()).slice(0, 5), opener: popup.opener, closed: !!popup.closed };
  }, invoice.id);
  assert(displayed.url.startsWith('blob:')); assert.equal(displayed.bytes, '%PDF-'); assert.equal(displayed.opener, null); assert.equal(displayed.closed, false);
  for (const phase of ['response', 'body']) {
    const stopped = await page.evaluate(async ({ path, token, phase, clientId }) => {
      localStorage.setItem('cristalwater_jwt', token);
      const original = window.fetch, popup = { location: {}, close() { this.closed = true; } };
      window.open = () => popup;
      window.fetch = async () => {
        if (phase === 'response') localStorage.setItem('cristalwater_jwt', 'changed');
        const headers = new Headers({ 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-CW-Document-Type': 'invoice-pdf', 'X-CW-Invoice-Id': path.split('/').pop(), 'X-CW-Client-Id': String(clientId) });
        return { status: 200, headers, blob: async () => { localStorage.setItem('cristalwater_jwt', 'changed'); return new Blob(['private']); } };
      };
      try { await CristalDownloads.open(path); return { error: false }; }
      catch (error) { return { error: error.message, closed: popup.closed, url: popup.location.href || null }; }
      finally { window.fetch = original; localStorage.setItem('cristalwater_jwt', token); }
    }, { path, token: at, phase, clientId: client.id });
    assert.match(stopped.error, /sessão mudou/); assert.equal(stopped.closed, true); assert.equal(stopped.url, null);
  }
  console.log('PASS actual invoice page opens an authenticated PDF blob and changed sessions cannot display the old response');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
