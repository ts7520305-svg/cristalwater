'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Account client QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Account tech QA', active: true } });
  const password = randomUUID(), bcrypt = require('bcryptjs');
  const victim = await prisma.user.create({ data: { name: 'Protected account QA', email: `protected-${randomUUID()}@qa.test`, role: 'ADMIN', password: await bcrypt.hash(password, 10), active: true } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  async function call(path, token, method = 'GET', body) { const r = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
  const anonymous = await call('/api/users'); console.log(JSON.stringify({ anonymousUsersStatus: anonymous.status, expected: 401 })); assert.equal(anonymous.status, 401);
  const candidates = [['/api/users', 'GET'], ['/api/security/status', 'GET'], ['/api/security/audit', 'GET'],
    ['/api/users', 'POST', { name: 'Forbidden', email: `forbidden-${randomUUID()}@qa.test`, role: 'ADMIN', password }],
    [`/api/users/${victim.id}`, 'PUT', { role: 'CLIENT', password: 'forbidden-change' }],
    [`/api/security/users/${victim.id}/identity`, 'PUT', { active: false }],
    [`/api/security/users/${victim.id}/change-password`, 'POST', { newPassword: 'forbidden-change', force: true }],
    [`/api/security/users/${victim.id}/reset-password`, 'POST', { newPassword: 'forbidden-change' }]];
  const count = await prisma.user.count();
  for (const [token, expected] of [[null, 401], [ct, 403], [tt, 403]]) for (const [path, method, body] of candidates) assert.equal((await call(path, token, method, body)).status, expected, path);
  assert.equal(await prisma.user.count(), count); assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: victim.id } }), victim);
  const list = await call('/api/users', at); assert.equal(list.status, 200); assert(!list.body.some(u => 'password' in u));
  assert.equal((await call('/api/security/status', at)).status, 200);
  const newPassword = randomUUID();
  assert.equal((await call(`/api/security/users/${victim.id}/reset-password`, at, 'POST', { newPassword, actor: 'forged-actor' })).status, 409);
  const review = await call(`/api/security/users/${victim.id}/password-review`, at);
  assert.equal(review.status, 200);
  assert.equal((await call(`/api/security/users/${victim.id}/reset-password`, at, 'POST', { newPassword, reviewToken: review.body.reviewToken, actor: 'forged-actor' })).status, 400);
  assert.equal((await call(`/api/security/users/${victim.id}/reset-password`, at, 'POST', { newPassword, reviewToken: review.body.reviewToken })).status, 200);
  const saved = await prisma.user.findUniqueOrThrow({ where: { id: victim.id } }); assert(await bcrypt.compare(newPassword, saved.password)); assert(saved.passwordChangedAt);
  const audit = await prisma.userAuditLog.findFirstOrThrow({ where: { entityId: String(victim.id), action: 'PASSWORD_RESET_REVIEWED' }, orderBy: { id: 'desc' } }); assert.equal(audit.actor, `ADMIN:${admin.id}`);
  assert.equal((await call(`/api/security/users/${victim.id}/identity`, at, 'PUT', { name: 'Updated QA', actor: 'forged-actor' })).status, 200);
  const identityAudit = await prisma.userAuditLog.findFirstOrThrow({ where: { entityId: String(victim.id), action: 'IDENTITY_UPDATED' }, orderBy: { id: 'desc' } }); assert.equal(identityAudit.actor, `ADMIN:${admin.id}`);
  const logger = require('../src/services/loggerService'), oldAudit = logger.audit; let recorded;
  try {
    logger.audit = (name, data) => { recorded = data; };
    require('../src/middlewares/auditMiddleware')({ method: 'POST', originalUrl: '/api/security/users/1/change-password', body: { password: 'secret', currentPassword: 'secret', newPassword: 'secret', pin: 'secret', token: 'secret', allowed: 'retained' } }, { statusCode: 200, on(event, fn) { fn(); } }, () => {});
    assert.deepEqual(recorded.body, { allowed: 'retained' });
  } finally { logger.audit = oldAudit; }
  console.log('PASS account lists, creation, identity changes and password operations require ADMIN; refused actions are inert and audit records the authenticated actor');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
