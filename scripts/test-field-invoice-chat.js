'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.create({ data: { email: `document-actor-${Date.now()}@qa.test`, password: 'no-login', name: 'Autor do documento', role: 'ADMIN', active: true } });
  const client = await prisma.client.create({ data: { name: 'Titular documento chat', active: true } });
  const other = await prisma.client.create({ data: { name: 'Outro titular documento chat', active: true } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 18, totalAmount: 18, amount: 18, amountOpen: 18 } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), ot = sign({ id: other.id, clientId: other.id, role: 'CLIENT' });
  async function call(path, token = at, method = 'GET', body) { const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
  const send = id => call(`/api/invoices/send-full/${id}?mode=chat`, at, 'POST', {});
  const sent = await send(invoice.id); assert.equal(sent.status, 200, JSON.stringify(sent));
  const messages = await call(`/api/chat/client/${client.id}`, ct);
  console.log(JSON.stringify({ visibleMessages: messages.body.messages?.length, expected: 1 })); assert.equal(messages.body.messages.length, 1);
  const message = messages.body.messages[0]; assert.equal(message.fileUrl, `/invoice-document?id=${invoice.id}`); assert.equal(message.senderType, 'ADMIN'); assert.equal(message.messageType, 'DOCUMENT');
  const repeats = await Promise.all(Array.from({ length: 8 }, () => send(invoice.id)));
  assert(repeats.every(r => r.status === 200 && r.body.messageId === message.id));
  assert.equal(await prisma.clientMessage.count({ where: { clientId: client.id } }), 1);
  assert.equal(await prisma.chatMessage.count({ where: { clientId: client.id } }), 0);
  assert.equal(await prisma.notification.count({ where: { clientId: client.id, type: 'INVOICE_CHAT_AVAILABLE' } }), 1);
  const audit = await prisma.auditTrail.findMany({ where: { entity: 'Invoice', entityId: invoice.id, action: 'INVOICE_CHAT_AVAILABLE' } });
  assert.equal(audit.length, 1); assert.equal(audit[0].metadata.actor, `ADMIN:${admin.id}`);
  assert.equal((await call(`/api/chat/client/${client.id}`, ot)).status, 403);
  for (const status of ['DRAFT', 'CANCELLED', 'VOID']) {
    const hidden = await prisma.invoice.create({ data: { clientId: client.id, status } }); assert.equal((await send(hidden.id)).status, 409);
  }
  const fault = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED' } });
  const countBefore = await prisma.clientMessage.count({ where: { clientId: client.id } });
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_invoice_chat_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityId" = ${fault.id} AND NEW.action = 'INVOICE_CHAT_AVAILABLE' THEN RAISE EXCEPTION 'QA audit failure'; END IF; RETURN NEW; END $$`);
  try {
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_invoice_chat_failure BEFORE INSERT ON "AuditTrail" FOR EACH ROW EXECUTE FUNCTION qa_invoice_chat_failure()');
    assert.equal((await send(fault.id)).status, 500);
    assert.equal(await prisma.clientMessage.count({ where: { clientId: client.id } }), countBefore);
    assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-chat:${fault.id}` } }), 0);
  } finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_invoice_chat_failure ON "AuditTrail"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_invoice_chat_failure()'); }
  console.log('PASS invoice publication reaches the actual client conversation once, records the actual actor, rejects withdrawn drafts and rolls back failures');
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [token, user, path, selector] of [[ct, { id: client.id, clientId: client.id, role: 'CLIENT' }, '/client-portal', '#chatBox'], [at, { id: admin.id, role: 'ADMIN' }, `/chat?clientId=${client.id}`, '#messages']]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ token, user }) => { for (const k of ['token', 'cristalwater_jwt']) localStorage.setItem(k, token); for (const k of ['user', 'cristalwater_user']) localStorage.setItem(k, JSON.stringify(user)); }, { token, user });
    const page = await context.newPage(); page.setDefaultTimeout(10000); await page.goto(base + path, { waitUntil: 'networkidle' });
    const link = page.locator(`${selector} a[href="/invoice-document?id=${invoice.id}"]`); await link.waitFor({ state: 'attached' });
    assert.equal(await link.count(), 1); assert.equal(await link.getAttribute('rel'), 'noopener'); await context.close();
  }
  console.log('PASS actual client portal and administration chat render the protected document link');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
