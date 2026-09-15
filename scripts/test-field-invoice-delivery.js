'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  const client = await prisma.client.create({ data: { name: 'Preparação envio QA', status: 'ACTIVE' } });
  const fixture = status => prisma.invoice.create({ data: { clientId: client.id, status, total: 10, totalAmount: 10, amount: 10, amountOpen: status === 'PAID' ? 0 : 10 } });
  async function post(id, action = 'send', body = { channel: 'EMAIL' }) { const r = await fetch(`${base}/api/finance-os/invoices/${id}/${action}`, { method: 'POST', headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  const state = id => prisma.invoice.findUniqueOrThrow({ where: { id } });
  const draft = await fixture('DRAFT'), beforeDraft = await state(draft.id), draftReply = await post(draft.id);
  console.log(JSON.stringify({ expectedDraftStatus: 409, actual: draftReply.status })); assert.equal(draftReply.status, 409); assert.deepEqual(await state(draft.id), beforeDraft);
  for (const status of ['CANCELLED', 'VOID', 'ARCHIVED']) { const f = await fixture(status); assert.equal((await post(f.id)).status, 409); assert.equal((await state(f.id)).status, status); }
  const issued = await fixture('ISSUED'), before = await state(issued.id);
  const replies = await Promise.all(Array.from({ length: 8 }, () => post(issued.id)));
  assert(replies.every(r => r.status === 200 && r.body.deliveryStatus === 'NOT_SENT' && r.body.prepared === true), JSON.stringify(replies));
  assert.deepEqual(await state(issued.id), before);
  assert.equal(await prisma.auditTrail.count({ where: { entity: 'Invoice', entityId: issued.id, action: 'FINANCE_INVOICE_DELIVERY_PREPARED' } }), 1);
  assert.equal(await prisma.notification.count({ where: { clientId: client.id, type: 'INVOICE_SENT' } }), 0);
  assert.equal(await prisma.communicationLog.count({ where: { clientId: client.id, channel: 'INVOICE_EMAIL' } }), 0);
  assert.equal((await post(issued.id, 'send', { channel: 'invalid' })).status, 400);
  await post(issued.id, 'cancel', {}); assert.equal((await post(issued.id)).status, 409); assert.equal((await state(issued.id)).status, 'CANCELLED');
  const paid = await fixture('PAID'), beforePaid = await state(paid.id); assert.equal((await post(paid.id)).body.deliveryStatus, 'NOT_SENT'); assert.deepEqual(await state(paid.id), beforePaid);
  console.log('PASS send preparation never issues drafts, reopens documents or claims external delivery; concurrent preparation is recorded once');
  const failed = await fixture('ISSUED');
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_delivery_failure() RETURNS trigger AS $$ BEGIN IF NEW.action = 'FINANCE_INVOICE_DELIVERY_PREPARED' AND NEW."entityId" = ${failed.id} THEN RAISE EXCEPTION 'QA delivery failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_delivery_failure BEFORE INSERT ON "AuditTrail" FOR EACH ROW EXECUTE FUNCTION qa_delivery_failure()');
  try { assert.equal((await post(failed.id)).status, 500); assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-delivery-preparation:${failed.id}:EMAIL` } }), 0); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_delivery_failure ON "AuditTrail"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_delivery_failure()'); }
  assert.equal((await post(failed.id)).status, 200);
  console.log('PASS failed preparation audit leaves no acknowledgement and retry succeeds');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
