'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const fs = require('node:fs'), path = require('node:path');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const dataFile = path.join(__dirname, '../src/data/clientChatMessages.json');
let previous, touched = false;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Chat identity QA', active: true } });
  const other = await prisma.client.create({ data: { name: 'Other chat QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Tech chat QA', active: true } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), ot = sign({ id: other.id, role: 'CLIENT' }), tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  async function call(p, token, method = 'GET', body) { const r = await fetch(base + p, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
  const first = await call(`/api/client-chat/${client.id}/messages`); console.log(JSON.stringify({ anonymousStatus: first.status, expected: 401 })); assert.equal(first.status, 401);
  for (const prefix of ['/api/client-chat', '/api/clientChat']) {
    for (const [token, status] of [[null, 401], [ot, 403], [tt, 403]]) {
      assert.equal((await call(`${prefix}/${client.id}/messages`, token)).status, status);
      assert.equal((await call(`${prefix}/${client.id}/messages`, token, 'POST', { text: 'forbidden', from: 'ADMIN' })).status, status);
      assert.equal((await call(`${prefix}/${client.id}/mark-read`, token, 'POST', { role: 'ADMIN' })).status, status);
    }
    assert.equal((await call(`${prefix}/unread-count`, ct)).status, 403);
  }
  previous = fs.existsSync(dataFile) ? fs.readFileSync(dataFile) : null; touched = true; fs.mkdirSync(path.dirname(dataFile), { recursive: true }); fs.writeFileSync(dataFile, '[]');
  for (const prefix of ['/api/client-chat', '/api/clientChat']) {
    const created = await call(`${prefix}/${client.id}/messages`, ct, 'POST', { from: 'ADMIN', text: 'Mensagem do cliente' });
    assert.equal(created.status, 201); assert.equal(created.body.from, 'CLIENT'); assert.equal(created.body.readByAdmin, false);
    const marked = await call(`${prefix}/${client.id}/mark-read`, ct, 'POST', { role: 'ADMIN' }); assert.equal(marked.status, 200);
    const rows = (await call(`${prefix}/${client.id}/messages`, at)).body;
    assert(rows.every(m => !m.readByAdmin)); assert(rows.every(m => m.readByClient));
  }
  const modern = await call('/api/chat', ct, 'POST', { clientId: client.id, sender: 'admin', text: 'Origem não falsificável' });
  assert.equal(modern.status, 200); assert.equal(modern.body.message.senderType, 'CLIENT'); assert.equal(modern.body.message.isReadByAdmin, false);
  const adminMessage = await call('/api/chat', at, 'POST', { clientId: client.id, sender: 'Cliente', text: 'Origem administrativa' });
  assert.equal(adminMessage.body.message.senderType, 'ADMIN');
  for (const id of ['0', '1x', '2147483648']) assert.equal((await call(`/api/client-chat/${id}/messages`, at)).status, 400);
  fs.writeFileSync(dataFile, '{invalid');
  assert.equal((await call(`/api/client-chat/${client.id}/messages`, ct, 'POST', { text: 'Do not erase' })).status, 500);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), '{invalid');
  console.log('PASS both legacy aliases enforce active identity, exact ownership and actual read/sender roles; modern chat cannot spoof administration; corrupt history is retained');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (touched) { if (previous) fs.writeFileSync(dataFile, previous); else fs.rmSync(dataFile, { force: true }); } await prisma.$disconnect(); });
