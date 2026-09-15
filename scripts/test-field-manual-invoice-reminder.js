'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Manual reminder QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Reminder tech', active: true } });
  const fixture = (values = {}) => prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 20, totalAmount: 20, amountOpen: 20, ...values } });
  const invoice = await fixture(), sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), tt = sign({ id: tech.id, role: 'TECHNICIAN' });
  for (const [token, expected] of [[null, 401], [ct, 403], [tt, 403], [at, 503]]) {
    const r = await fetch(`${base}/api/reminders/${invoice.id}`, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID() }) }); assert.equal(r.status, expected);
  }
  const gate = require('../src/config/externalIntegrations'), nodemailer = require('nodemailer');
  const fetchPath = require.resolve('node-fetch'); require(fetchPath);
  const original = { gate: gate.assertExternalOperationAllowed, mail: nodemailer.createTransport, fetch: require.cache[fetchPath].exports };
  const envKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'], beforeEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  let mails = 0, loopbackCalls = 0;
  try {
    // In-process fakes only. A legacy loopback request gets an HTTP failure, never real transport.
    gate.assertExternalOperationAllowed = () => ({ allowed: true });
    require.cache[fetchPath].exports = async () => { loopbackCalls++; return { ok: false, status: 401, json: async () => ({ ok: false }) }; };
    const controller = require('../src/controllers/reminderController');
    async function invoke(item = invoice, body = { requestId: randomUUID() }, user = { id: admin.id, role: 'ADMIN' }) {
      let status = 200, payload; const res = { status(code) { status = code; return this; }, json(value) { payload = value; return this; }, set() { return this; } };
      await controller.sendReminder({ params: { id: String(item.id) }, body, user, protocol: 'http', get: () => new URL(base).host }, res); return { status, body: payload };
    }
    const noContact = await invoke(); console.log(JSON.stringify({ noContactStatus: noContact.status, noContactResult: noContact.body })); assert.equal(noContact.status, 409); assert.equal(noContact.body.ok, false);
    for (const requestId of [undefined, 'not-a-uuid', {}, 123]) assert.equal((await invoke(invoice, { requestId })).status, 400);
    await prisma.client.update({ where: { id: client.id }, data: { email: 'main@qa.test', phone: '912345678', paymentReminderEmailAddress: 'reminder@qa.test', paymentReminderWhatsappNumber: '919876543' } });
    for (const key of envKeys) process.env[key] = 'qa-only';
    nodemailer.createTransport = () => ({ sendMail: async payload => { mails++; assert.equal(payload.to, 'reminder@qa.test'); assert(payload.text.includes('20.00 EUR')); assert(payload.text.includes('/invoice-document?id=')); return { messageId: 'qa-reminder-mail', accepted: [payload.to] }; } });
    const requestId = randomUUID(), first = await invoke(invoice, { requestId, email: 'unregistered@qa.test', phone: '111111111' });
    assert.equal(first.status, 200, JSON.stringify(first)); assert.equal(first.body.deliveryStatus, 'PARTIAL'); assert.equal(first.body.delivered, false);
    assert.equal(first.body.channels.email.deliveryStatus, 'PROVIDER_ACCEPTED'); assert.equal(first.body.channels.whatsapp.deliveryStatus, 'NOT_SENT');
    const link = new URL(first.body.channels.whatsapp.link); assert.equal(link.pathname, '/351919876543'); assert(link.searchParams.get('text').includes('20.00 EUR'));
    const repeated = await Promise.all(Array.from({ length: 8 }, () => invoke(invoice, { requestId })));
    assert(repeated.every(r => r.status === 200 && r.body.channels.email.idempotent)); assert.equal(mails, 1); assert.equal(loopbackCalls, 0);
    const unknown = await fixture(); nodemailer.createTransport = () => ({ sendMail: async () => { mails++; throw Error('QA lost provider reply'); } });
    const unknownId = randomUUID(), lost = await invoke(unknown, { requestId: unknownId }); assert.equal(lost.body.deliveryStatus, 'REVIEW_REQUIRED'); assert.equal(lost.body.channels.email.deliveryStatus, 'UNKNOWN');
    await invoke(unknown, { requestId: unknownId }); assert.equal(mails, 2);
    nodemailer.createTransport = () => ({ sendMail: async () => { mails++; return { rejected: ['reminder@qa.test'], accepted: [] }; } });
    const rejected = await invoke(await fixture()); assert.equal(rejected.body.ok, false); assert.equal(rejected.body.channels.email.deliveryStatus, 'REJECTED'); assert.equal(rejected.body.delivered, false);
    delete process.env.SMTP_HOST;
    const missingConfig = await invoke(await fixture()); assert.equal(missingConfig.body.ok, false); assert.equal(missingConfig.body.channels.email.deliveryStatus, 'NOT_SENT'); assert(missingConfig.body.channels.whatsapp.link);
    for (const status of ['DRAFT', 'CANCELLED', 'VOID', 'PAID']) { const item = await fixture({ status, ...(status === 'PAID' ? { amountOpen: 0, amountPaid: 20 } : {}) }); assert.equal((await invoke(item)).status, 409); }
    for (const data of [{ active: false }, { status: 'PAUSED' }, { paymentReminderMode: 'DISABLED' }]) {
      await prisma.client.update({ where: { id: client.id }, data }); assert.equal((await invoke()).status, 409); await prisma.client.update({ where: { id: client.id }, data: { active: true, status: 'ACTIVE', paymentReminderMode: 'DEFAULT' } });
    }
    await prisma.client.update({ where: { id: client.id }, data: { paymentReminderEmail: false } });
    const browserOnly = await invoke(await fixture()); assert.equal(browserOnly.body.deliveryStatus, 'PREPARED'); assert.equal(browserOnly.body.delivered, false); assert.deepEqual(Object.keys(browserOnly.body.channels), ['whatsapp']);
    const saved = await prisma.operationalReminder.findMany({ where: { sourceKey: { startsWith: `invoice-reminder:${invoice.id}:${requestId}:` } } }); assert.equal(saved.length, 2); assert(saved.every(row => row.metadata.actor === `ADMIN:${admin.id}`));
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, 'ISSUED');
    console.log('PASS manual invoice reminder uses authenticated business calls, registered preferences and request receipts; no false delivery, duplicate email, hidden channel failure or requests to legacy HTTP endpoints');
  } finally {
    gate.assertExternalOperationAllowed = original.gate; nodemailer.createTransport = original.mail; require.cache[fetchPath].exports = original.fetch;
    for (const key of envKeys) { if (beforeEnv[key] === undefined) delete process.env[key]; else process.env[key] = beforeEnv[key]; }
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
