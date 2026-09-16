'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let trigger = false;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const secret = 'Client-edit-QA-' + randomUUID(), originalPassword = await bcrypt.hash(secret, 4);
  const client = await prisma.client.create({ data: {
    name: 'Client edit preservation QA', internalName: 'Internal original', email: 'original@edit.test', phone: '999',
    address: 'Original address', zone: 'Original zone', notes: 'Original notes', active: true, status: 'ACTIVE',
    contractActive: true, billingActive: true, contractActivatedAt: new Date('2026-01-02T12:00:00Z'),
    creditBalance: 85.25, monthlyFee: 125.75, monthlyAmount: 125.75, paymentStatus: 'PARTIAL',
    requiresInvoice: true, fiscalName: 'Original fiscal', fiscalNif: '123456789', fiscalAddress: 'Fiscal address',
    fiscalEmail: 'fiscal@edit.test', externalBillingNotes: 'Original accountant notes',
    password: originalPassword, pin: await bcrypt.hash('4321', 4),
  } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'PARTIAL', total: 150.5, totalCents: 15050, amountPaid: 25.25, amountOpen: 125.25,
    payments: { create: { amount: 25.25, amountCents: 2525, method: 'MANUAL' } } } });
  const invoiceBefore = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
  async function call(alias, body, credential = token) {
    const response = await fetch(base + alias + '/' + client.id, { method: 'PUT',
      headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json', 'x-user-email': 'forged@edit.test' },
      body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const row = () => prisma.client.findUniqueOrThrow({ where: { id: client.id } });
  const logs = () => prisma.userAuditLog.findMany({ where: { entity: 'Client', entityId: String(client.id), action: 'CLIENT_UPDATED' }, orderBy: { id: 'asc' } });
  function equalExcept(before, after, fields) {
    const omit = object => Object.fromEntries(Object.entries(object).filter(([key]) => !['updatedAt', ...fields].includes(key)));
    assert.deepEqual(omit(after), omit(before));
  }
  for (const alias of ['/api/core/clients', '/api/clients']) {
    const before = await row(), beforeLogs = (await logs()).length;
    const result = await call(alias, { name: 'Only name changed ' + alias });
    assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(result.data.ok, true);
    const after = await row(); equalExcept(before, after, ['name']);
    assert.equal(after.contractActive, true); assert.equal(after.billingActive, true); assert.equal(after.status, 'ACTIVE');
    assert.equal(after.creditBalance, 85.25); assert.equal(after.email, before.email); assert.equal(after.address, before.address);
    assert(!('password' in result.data.client)); assert(!('pin' in result.data.client));
    const entries = await logs(); assert.equal(entries.length, beforeLogs + 1);
    assert.equal(entries.at(-1).actor, 'USER:' + admin.id);
    assert(!JSON.stringify(entries.at(-1)).includes('forged@edit.test'));
    assert(!('password' in entries.at(-1).metadata.before)); assert(!('pin' in entries.at(-1).metadata.after));
    assert.deepEqual(entries.at(-1).metadata.credentialsChanged, { password: false, pin: false });
  }
  console.log('PASS both edit APIs preserve omitted contacts, fiscal data, credentials, active contract, billing state, pricing and credit');
  let before = await row();
  const cleared = await call('/api/core/clients', { email: '', phone: null, fiscalNif: null, nif: 'must-not-override-null', password: '', pin: '' });
  assert.equal(cleared.status, 200); let after = await row();
  equalExcept(before, after, ['email', 'phone', 'fiscalNif']);
  assert.equal(after.email, null); assert.equal(after.phone, null); assert.equal(after.fiscalNif, null);
  before = after;
  const password = 'New-secret-' + randomUUID();
  assert.equal((await call('/api/core/clients', { password, pin: '8765' })).status, 200);
  after = await row(); equalExcept(before, after, ['password', 'pin']);
  assert(await bcrypt.compare(password, after.password)); assert(await bcrypt.compare('8765', after.pin));
  const changed = (await logs()).at(-1);
  assert.deepEqual(changed.metadata.credentialsChanged, { password: true, pin: true });
  const auditText = JSON.stringify(await logs()); assert(!auditText.includes(password)); assert(!auditText.includes(after.password)); assert(!auditText.includes(originalPassword)); assert(!auditText.includes('8765'));
  // Concurrent disjoint patches are merged against the locked current row.
  const concurrent = await Promise.all([call('/api/core/clients', { phone: '12345' }), call('/api/clients', { address: 'New address' })]);
  assert(concurrent.every(result => result.status === 200)); after = await row();
  assert.equal(after.phone, '12345'); assert.equal(after.address, 'New address'); assert.equal(after.billingActive, true);
  console.log('PASS explicit clears, blank credential preservation, hashed credentials excluded from replies/audit and concurrent disjoint patches');
  for (const alias of ['/api/core/clients', '/api/clients']) {
    before = await row(); const beforeLogs = (await logs()).length;
    await prisma.$executeRawUnsafe("CREATE FUNCTION qa_client_edit_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'CLIENT_UPDATED' THEN RAISE EXCEPTION 'QA mandatory client edit audit failed'; END IF; RETURN NEW; END $$");
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_client_edit_audit_fail BEFORE INSERT ON "UserAuditLog" FOR EACH ROW EXECUTE FUNCTION qa_client_edit_audit_fail()'); trigger = true;
    const failed = await call(alias, { name: 'MUST ROLLBACK' }); assert.equal(failed.status, 500); assert.equal(failed.data.ok, false);
    assert(!JSON.stringify(failed.data).includes('QA mandatory')); assert(!JSON.stringify(failed.data).includes('prisma'));
    assert.deepEqual(await row(), before); assert.equal((await logs()).length, beforeLogs);
    await prisma.$executeRawUnsafe('DROP TRIGGER qa_client_edit_audit_fail ON "UserAuditLog"');
    await prisma.$executeRawUnsafe('DROP FUNCTION qa_client_edit_audit_fail()'); trigger = false;
    assert.equal((await call(alias, { name: 'Recovered ' + alias })).status, 200);
  }
  const beforeInvalid = await row(), auditCount = (await logs()).length;
  for (const body of [{ name: '' }, { name: null }, { phone: {} }, { email: [] }, { password: 123 }, { password: 'x'.repeat(73) }]) {
    assert.equal((await call('/api/core/clients', body)).status, 400, JSON.stringify(body)); assert.deepEqual(await row(), beforeInvalid);
  }
  assert.equal((await logs()).length, auditCount);
  for (const alias of ['/api/core/clients', '/api/clients']) {
    assert.equal((await call(alias, { name: 'Anonymous' }, '')).status, 401);
    const clientToken = jwt.sign({ id: client.id, clientId: client.id, role: 'CLIENT' }, getJwtSecret(), { expiresIn: '1h' });
    assert.equal((await call(alias, { name: 'Client self escalation' }, clientToken)).status, 403);
  }
  // Keep the existing TEAM_LEADER permission on /api/clients, with the authenticated identity type.
  const leaderEmail = 'client-edit-leader-' + randomUUID() + '@edit.test';
  const leader = await prisma.technician.create({ data: { name: 'Client edit leader QA', email: leaderEmail, role: 'TEAM_LEADER', active: true } });
  const leaderUser = await prisma.user.create({ data: { email: leaderEmail, name: 'Client edit leader QA', password: originalPassword, role: 'TEAM_LEADER', active: true } });
  const leaderSessions = [
    { claims: { id: leader.id, role: 'TEAM_LEADER' }, actor: 'TECHNICIAN:' + leader.id },
    { claims: { id: leader.id, userId: leaderUser.id, technicianId: leader.id, principalType: 'USER', role: 'TEAM_LEADER' }, actor: 'USER:' + leaderUser.id },
  ];
  for (const session of leaderSessions) {
    const leaderToken = jwt.sign(session.claims, getJwtSecret(), { expiresIn: '1h' });
    assert.equal((await call('/api/clients', { zone: 'Leader edited zone' }, leaderToken)).status, 200);
    assert.equal((await logs()).at(-1).actor, session.actor);
    const leaderSnapshot = await row();
    assert.equal((await call('/api/core/clients', { name: 'Forbidden leader edit' }, leaderToken)).status, 403);
    assert.deepEqual(await row(), leaderSnapshot);
  }
  assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } }), invoiceBefore);
  await prisma.client.update({ where: { id: client.id }, data: { active: false, status: 'ARCHIVED', archiveStatus: 'ARQUIVADO', deletedAt: new Date(), billingActive: false } });
  for (const alias of ['/api/core/clients', '/api/clients']) {
    const archived = await row(); assert.equal((await call(alias, { notes: 'Archive annotation' })).status, 200);
    equalExcept(archived, await row(), ['notes']);
  }
  console.log('PASS required audit rollback and recovery, invalid payloads, access control, preserved archive and unchanged invoice/payment history');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (trigger) { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_client_edit_audit_fail ON "UserAuditLog"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_client_edit_audit_fail()'); }
  await prisma.$disconnect();
});
