'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Envio privado QA', active: true, email: 'document@qa.test', phone: '912345678' } });
  const tech = await prisma.technician.create({ data: { name: 'Técnico envio QA', active: true } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  const fixture = status => prisma.invoice.create({ data: { clientId: client.id, status: status || 'ISSUED', total: 20, totalAmount: 20 } });
  const invoice = await fixture();
  async function post(path, token, body = {}) { const r = await fetch(base + path, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  const anonymous = await post('/api/email/invoice', null, { email: client.email, invoiceId: invoice.id });
  console.log(JSON.stringify({ anonymousEmailStatus: anonymous.status, expected: 401 })); assert.equal(anonymous.status, 401);
  for (const path of ['/api/email/invoice', '/api/whatsapp/mass-debt']) for (const [token, status] of [[null, 401], [ct, 403], [tt, 403]]) assert.equal((await post(path, token, { invoiceId: invoice.id, email: client.email })).status, status);
  assert.equal((await post('/api/email/invoice', at, { invoiceId: invoice.id, email: client.email })).status, 503);
  assert.equal((await post(`/api/invoices/send-full/${invoice.id}?mode=api`, at)).status, 503);
  assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: { startsWith: `invoice-outbound:${invoice.id}:` } } }), 0);
  const browser = await post(`/api/invoices/send-full/${invoice.id}?mode=browser`, at);
  assert.equal(browser.status, 200, JSON.stringify(browser)); assert.equal(browser.body.deliveryStatus, 'NOT_SENT');
  const text = new URL(browser.body.link).searchParams.get('text'); assert(text.includes(`/invoice-document?id=${invoice.id}`)); assert(!text.includes('em anexo'));
  const repeat = await post(`/api/invoices/send-full/${invoice.id}?mode=browser`, at); assert.equal(repeat.body.idempotent, true);
  for (const status of ['DRAFT', 'CANCELLED', 'VOID']) { const hidden = await fixture(status); assert.equal((await post(`/api/invoices/send-full/${hidden.id}?mode=browser`, at)).status, 409); }
  console.log('PASS outbound HTTP routes require administration, QA never sends, browser prepares an authenticated link without claiming delivery');
  // Exercise transport recovery using in-process fake providers only; no network transport is invoked.
  const business = require('../src/business/finance/InvoiceOutboundDeliveryBusiness');
  const gate = require('../src/config/externalIntegrations'), whatsapp = require('../src/services/whatsappService'), nodemailer = require('nodemailer');
  const originals = { gate: gate.assertExternalOperationAllowed, send: whatsapp.sendWhatsAppViaApi, config: whatsapp.getWhatsAppConfig, mail: nodemailer.createTransport };
  const envKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'], beforeEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  let sends = 0;
  try {
    gate.assertExternalOperationAllowed = () => ({ allowed: true });
    whatsapp.getWhatsAppConfig = () => ({ provider: 'TWILIO', accountSid: 'qa', authToken: 'qa', from: 'qa' });
    whatsapp.sendWhatsAppViaApi = async () => { sends++; return { sid: 'qa-provider-id', status: 'queued' }; };
    const user = { id: admin.id, role: 'ADMIN' }, item = await fixture();
    const results = await Promise.all(Array.from({ length: 8 }, () => business.send(item.id, user, 'api', base)));
    assert.equal(sends, 1); assert(results.every(r => ['PENDING_CONFIRMATION', 'PROVIDER_ACCEPTED'].includes(r.deliveryStatus)));
    assert.equal((await business.send(item.id, user, 'api', base)).deliveryStatus, 'PROVIDER_ACCEPTED'); assert.equal(sends, 1);
    const unknown = await fixture(); whatsapp.sendWhatsAppViaApi = async () => { sends++; throw Error('QA lost provider response'); };
    assert.equal((await business.send(unknown.id, user, 'api', base)).deliveryStatus, 'UNKNOWN');
    assert.equal((await business.send(unknown.id, user, 'api', base)).deliveryStatus, 'UNKNOWN'); assert.equal(sends, 2);
    for (const k of envKeys) process.env[k] = 'qa-only';
    let mails = 0; nodemailer.createTransport = options => { assert.equal(options.tls.rejectUnauthorized, true); return { sendMail: async payload => { mails++; assert.equal(payload.to, client.email); assert(payload.text.includes('/invoice-document?id=')); return { messageId: 'qa-mail-id', accepted: [payload.to] }; } }; };
    const mail = await fixture();
    await assert.rejects(() => business.send(mail.id, user, 'email', base, { email: 'foreign@qa.test' }), error => error.statusCode === 400);
    assert.equal((await business.send(mail.id, user, 'email', base, { email: client.email })).deliveryStatus, 'PROVIDER_ACCEPTED');
    await business.send(mail.id, user, 'email', base, { email: client.email }); assert.equal(mails, 1);
    const crash = await fixture(); whatsapp.sendWhatsAppViaApi = async () => { sends++; return { sid: 'qa-accepted-before-db-failure' }; };
    await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_outbound_result_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sourceKey" = 'invoice-outbound:${crash.id}:WHATSAPP_API' THEN RAISE EXCEPTION 'QA lost result write'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe('CREATE TRIGGER qa_outbound_result_failure BEFORE UPDATE ON "OperationalReminder" FOR EACH ROW EXECUTE FUNCTION qa_outbound_result_failure()');
      assert.equal((await business.send(crash.id, user, 'api', base)).deliveryStatus, 'PENDING_CONFIRMATION');
    } finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_outbound_result_failure ON "OperationalReminder"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_outbound_result_failure()'); }
    assert.equal((await business.send(crash.id, user, 'api', base)).deliveryStatus, 'PENDING_CONFIRMATION'); assert.equal(sends, 3);
    console.log('PASS fake-provider concurrency, unknown replies and result-write failure never auto-resend; SMTP uses the registered recipient and verified TLS');
  } finally {
    gate.assertExternalOperationAllowed = originals.gate; whatsapp.sendWhatsAppViaApi = originals.send; whatsapp.getWhatsAppConfig = originals.config; nodemailer.createTransport = originals.mail;
    for (const k of envKeys) { if (beforeEnv[k] === undefined) delete process.env[k]; else process.env[k] = beforeEnv[k]; }
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
