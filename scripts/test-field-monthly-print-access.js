'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const stamp = Date.now(), monthRef = '2096-11';
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = principal => jwt.sign(principal, getJwtSecret(), { expiresIn: '1h' });
  const adminToken = sign({ id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' });
  const client = await prisma.client.create({ data: { name: 'QA safe print client ' + stamp, active: true } });
  const payload = '<img id="qaInjected" src=x onerror="window.qaInjected=1"><script>window.qaInjected=2</script> & "\' <b>literal</b>';
  const text = label => label + ' ' + payload;
  const other = await prisma.client.create({ data: { name: text('QA_PRIVATE_NAME'), phone: text('PHONE'), email: text('EMAIL'), address: text('ADDRESS'), active: true } });
  await prisma.pool.create({ data: { clientId: other.id, name: text('POOL'), zone: text('ZONE'), monthlyAmount: 25 } });
  const tech = await prisma.technician.create({ data: { name: 'QA print technician ' + stamp, active: true } });
  const leader = await prisma.technician.create({ data: { name: 'QA print leader ' + stamp, role: 'TEAM_LEADER', active: true } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, technicianId: tech.id } });
  await prisma.invoice.create({ data: { clientId: client.id, monthRef, status: 'ISSUED', amount: 10, total: 10, totalAmount: 10, amountOpen: 10, requiresInvoice: false } });
  const invoice = await prisma.invoice.create({ data: { clientId: other.id, monthRef, status: 'PARTIAL', amount: 25, total: 25, totalAmount: 25, amountPaid: 5, amountOpen: 20, requiresInvoice: true } });
  await prisma.payment.create({ data: { invoiceId: invoice.id, amount: 5, method: text('METHOD'), notes: text('NOTES'), paidAt: new Date(monthRef + '-02T12:00:00Z') } });
  const snapshot = () => Promise.all(['invoice', 'payment', 'monthlyReport', 'clientReportSetting'].map(model => prisma[model].count()));
  const before = await snapshot();
  async function call(path, token = adminToken) {
    const response = await fetch(base + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    return { status: response.status, body: await response.text(), type: response.headers.get('content-type'), cache: response.headers.get('cache-control') };
  }
  const url = '/api/reports/monthly-print?monthRef=' + monthRef;
  const absent = await call(url, null); assert.equal(absent.status, 401); assert.doesNotMatch(absent.body, /QA_PRIVATE_NAME/);
  const principals = [
    { id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' },
    { id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' },
    { id: leader.id, technicianId: leader.id, role: 'TEAM_LEADER', principalType: 'TECHNICIAN' },
  ];
  for (const principal of principals) {
    for (const suffix of ['', '&role=ADMIN', '&onlyRequiresInvoice=true']) {
      const result = await call(url + suffix, sign(principal));
      assert.equal(result.status, 403, principal.role); assert.doesNotMatch(result.body, /QA_PRIVATE_NAME|PHONE|ADDRESS|METHOD|NOTES/);
    }
  }
  const html = await call(url); assert.equal(html.status, 200); assert.match(html.type, /^text\/html/); assert.match(html.cache, /private.*no-store/);
  const filtered = await call(url + '&onlyRequiresInvoice=true'); assert.equal(filtered.status, 200); assert(filtered.body.includes('QA_PRIVATE_NAME')); assert(!filtered.body.includes(client.name));
  const all = await call(url + '&onlyRequiresInvoice=false'); assert.equal(all.status, 200); assert(all.body.includes(client.name));
  const queries = ['', 'onlyRequiresInvoice=true', 'monthRef=', 'monthRef=1999-12', 'monthRef=2200-01', 'monthRef=2096-13', 'monthRef=2096-1', 'monthRef=2096-11&monthRef=2096-12', 'monthRef[x]=2096-11', 'monthRef=2096-11&onlyRequiresInvoice=true&onlyRequiresInvoice=false', 'monthRef=2096-11&onlyRequiresInvoice[flag]=true', 'monthRef=2096-11&onlyRequiresInvoice=TRUE', 'monthRef=2096-11&onlyRequiresInvoice=1', 'monthRef=2096-11&limit=5', 'monthRef=' + encodeURIComponent(payload)];
  for (const query of queries) {
    const result = await call('/api/reports/monthly-print?' + query); assert.equal(result.status, 400, query); assert.match(result.type, /^application\/json/); assert.match(result.cache, /no-store/); assert(!result.body.includes(payload));
  }
  for (const month of ['2000-01', '2199-12']) assert.equal((await call('/api/reports/monthly-print?monthRef=' + month)).status, 200);
  assert.equal((await call('/api/reports/visit/' + visit.id, sign(principals[0]))).status, 200);
  assert.equal((await call('/api/reports/visit/' + visit.id, sign(principals[1]))).status, 200);
  assert.equal((await call('/api/reports/visit/' + visit.id, sign({ id: other.id, clientId: other.id, role: 'CLIENT' }))).status, 403);
  browser = await chromium.launch({ headless: true, ...(process.env.CW_CHROMIUM_PATH ? { executablePath: process.env.CW_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); const network = [], errors = [];
  await page.route('**/*', route => { network.push(route.request().url()); return route.abort(); });
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(html.body, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('img, script, #qaInjected, b').count(), 0);
  assert.equal(await page.evaluate(() => window.qaInjected), undefined);
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  const rendered = await page.locator('body').textContent();
  for (const label of ['QA_PRIVATE_NAME', 'PHONE', 'EMAIL', 'ADDRESS', 'POOL', 'ZONE', 'METHOD', 'NOTES']) assert(rendered.includes(text(label)), label + ' must remain literal');
  assert((await page.locator('h2').allTextContents()).includes(other.name));
  assert.equal(await page.getByRole('button', { name: 'Imprimir / Guardar PDF' }).count(), 1);
  assert.deepEqual(await snapshot(), before);
  console.log('PASS monthly print: anonymous denied, CLIENT/TECHNICIAN/TEAM_LEADER cannot read global client financial data or elevate with role query; ADMIN and invoice filter retained; explicit valid month, duplicate/object/unknown query rejection and private no-store');
  console.log('PASS real HTML response in Chromium: client/contact/pool/payment fields remain literal, no injected nodes/scripts/network, print action retained; owned visit access preserved and report reads create no domain records');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
