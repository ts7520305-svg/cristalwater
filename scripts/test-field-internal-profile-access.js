'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const dataFile = path.join(__dirname, '../src/data/internalChat.json');
let previous, touched = false;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Profile QA', active: true, monthlyFee: 92, email: 'private-profile@qa.test', password: 'not-for-response' } });
  const other = await prisma.client.create({ data: { name: 'Other profile QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Internal chat technician', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Internal chat leader', active: true, role: 'TEAM_LEADER' } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), ot = sign({ id: other.id, role: 'CLIENT' });
  const tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }), lt = sign({ id: leader.id, technicianId: leader.id, role: 'TEAM_LEADER' });
  async function call(p, token, method = 'GET', body) { const r = await fetch(base + p, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') }; }
  const profilePath = `/api/client-profile/${client.id}/profile`, chatPath = '/api/internal-chat/messages';
  const probes = { anonymousProfile: (await call(profilePath)).status, anonymousInternalChat: (await call(chatPath)).status };
  console.log(JSON.stringify(probes)); assert.deepEqual(probes, { anonymousProfile: 401, anonymousInternalChat: 401 });
  for (const [token, status] of [[null, 401], ['invalid', 401], [ot, 403], [tt, 403], [lt, 403]]) assert.equal((await call(profilePath, token)).status, status);
  for (const token of [at, ct]) {
    const row = await call(profilePath, token); assert.equal(row.status, 200); assert.equal(row.body.id, client.id); assert.equal(row.body.monthlyFee, 92); assert.equal(row.cache, 'private, no-store');
    assert.deepEqual(Object.keys(row.body).sort(), ['id', 'lastPaymentAt', 'monthlyFee', 'name', 'paymentStatus']);
  }
  for (const id of ['0', '-1', '1.5', '2147483648', 'abc']) assert.equal((await call(`/api/client-profile/${id}/profile`, at)).status, 400);
  assert.equal((await call('/api/client-profile/2147483647/profile', at)).status, 404);
  for (const [token, status] of [[null, 401], [ct, 403], [ot, 403]]) {
    assert.equal((await call(chatPath, token)).status, status);
    assert.equal((await call(chatPath, token, 'POST', { text: 'Forbidden', author: 'ADMIN' })).status, status);
  }
  previous = fs.existsSync(dataFile) ? fs.readFileSync(dataFile) : null; touched = true;
  const baseline = await prisma.internalChatMessage.count();
  const history = JSON.stringify([{ id: randomUUID(), author: 'ADMIN', text: 'Preserved historical message', created_at: '2026-01-01T00:00:00.000Z' }]);
  fs.writeFileSync(dataFile, history);
  for (const [token, role, id] of [[at, 'ADMIN', admin.id], [tt, 'TECHNICIAN', tech.id], [lt, 'TEAM_LEADER', leader.id]]) {
    const sent = await call(chatPath, token, 'POST', { requestId: randomUUID(), author: role === 'ADMIN' ? 'TECHNICIAN' : 'ADMIN', actorId: 999999, text: '  Real author  ' });
    assert.equal(sent.status, 201, JSON.stringify(sent)); assert.equal(sent.body.author, role); assert.equal(sent.body.actorId, id); assert.equal(sent.body.text, 'Real author');
    const listed = await call(chatPath, token); assert.equal(listed.status, 200); assert.equal(listed.cache, 'private, no-store'); assert(listed.body.some(m => m.id === sent.body.id));
  }
  const email = `internal-user-${Date.now()}@qa.test`;
  const user = await prisma.user.create({ data: { name: 'Linked staff', email, password: 'qa-no-login', role: 'TECHNICIAN', active: true } });
  await prisma.technician.update({ where: { id: tech.id }, data: { email } });
  const ut = sign({ id: tech.id, userId: user.id, technicianId: tech.id, principalType: 'USER', role: 'TECHNICIAN' });
  const linked = await call(chatPath, ut, 'POST', { text: 'Linked identity', requestId: randomUUID() }); assert.equal(linked.body.actorType, 'USER'); assert.equal(linked.body.actorId, user.id); assert.equal(linked.body.technicianId, tech.id);
  const many = await Promise.all(Array.from({ length: 12 }, (_, n) => call(chatPath, tt, 'POST', { text: `Concurrent message ${n}`, requestId: randomUUID() })));
  assert(many.every(row => row.status === 201)); assert.equal(new Set(many.map(row => row.body.id)).size, 12);
  const messages = (await call(chatPath, at)).body; assert.equal(messages.length, baseline + 17); assert(messages.some(m => m.text === 'Preserved historical message' && !m.identityVerified));
  assert.equal(fs.readFileSync(dataFile, 'utf8'), history);
  for (const text of ['', '  ', {}, [], null, 'x'.repeat(4001)]) assert.equal((await call(chatPath, tt, 'POST', { text })).status, 400);
  fs.writeFileSync(dataFile, '{corrupt');
  assert.equal((await call(chatPath, at)).status, 500); assert.equal((await call(chatPath, at, 'POST', { text: 'Must not erase history', requestId: randomUUID() })).status, 500); assert.equal(fs.readFileSync(dataFile, 'utf8'), '{corrupt');
  fs.writeFileSync(dataFile, '{}'); assert.equal((await call(chatPath, tt, 'POST', { text: 'Must not replace invalid structure', requestId: randomUUID() })).status, 500); assert.equal(fs.readFileSync(dataFile, 'utf8'), '{}');
  await prisma.client.update({ where: { id: client.id }, data: { active: false } }); assert.equal((await call(profilePath, ct)).status, 401);
  await prisma.technician.update({ where: { id: tech.id }, data: { active: false } }); assert.equal((await call(chatPath, tt)).status, 401); assert.equal((await call(chatPath, ut)).status, 401);
  console.log('PASS own client profile and internal staff chat require active identity; author cannot be forged, invalid messages and corrupt history are preserved, concurrent writes keep every message');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (touched) { if (previous !== null) fs.writeFileSync(dataFile, previous); else fs.rmSync(dataFile, { force: true }); } await prisma.$disconnect(); });
