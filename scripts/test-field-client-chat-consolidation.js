'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto'), { fork } = require('node:child_process');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const file = path.join(__dirname, '../src/data/clientChatMessages.json'), children = new Set();
let previous, touched = false, trigger = false, readTrigger = false;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function call(route, token, method = 'GET', body, origin = base, extra = {}) {
  const r = await fetch(origin + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') };
}
async function start() {
  const child = fork(path.join(__dirname, 'fixtures/internal-chat-server.js'), { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.add(child);
  let errors = ''; child.stderr.on('data', b => { errors = (errors + b).slice(-2500); });
  const origin = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error(errors || 'Chat worker timeout')), 15000); child.once('error', e => { clearTimeout(timer); reject(e); }); child.once('exit', code => { clearTimeout(timer); reject(Error(`Worker ${code}: ${errors}`)); }); child.once('message', m => { clearTimeout(timer); resolve(`http://127.0.0.1:${m.port}`); }); });
  return { child, origin };
}
async function stop(child) { if (child.exitCode !== null || child.signalCode !== null) return; await new Promise(resolve => { const timer = setTimeout(() => child.kill('SIGKILL'), 3000); child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM'); }); children.delete(child); }
async function removeTrigger() { if (!trigger) return; await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_client_chat_import_fail ON "CommunicationLog"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_client_chat_import_fail()'); trigger = false; }
async function removeReadTrigger() { if (!readTrigger) return; await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_legacy_read_fail ON "ClientMessage"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_legacy_read_fail()'); readTrigger = false; }
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Unified legacy chat', active: true } }), other = await prisma.client.create({ data: { name: 'Separate legacy chat', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'No client chat access', active: true } });
  const sign = p => jwt.sign(p, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), ot = sign({ id: other.id, role: 'CLIENT' }), tt = sign({ id: tech.id, role: 'TECHNICIAN' });
  const routes = [`/api/clientChat/${client.id}/messages`, `/api/client-chat/${client.id}/messages`], modern = `/api/chat/client/${client.id}`;
  previous = fs.existsSync(file) ? fs.readFileSync(file) : null; touched = true; fs.writeFileSync(file, '[]');
  const marker = randomUUID(), request = { text: marker, requestId: randomUUID(), from: 'ADMIN' };
  const first = await call(routes[0], ct, 'POST', request); assert.equal(first.status, 201); assert.equal(first.body.from, 'CLIENT');
  const visible = (await call(modern, ct)).body.messages.some(m => m.text === marker);
  console.log(JSON.stringify({ legacySendVisibleInCurrentConversation: visible, expected: true })); assert(visible, 'Legacy writes must reach the real conversation');
  assert.equal(fs.readFileSync(file, 'utf8'), '[]', 'Sending must not rewrite the legacy archive');
  let worker = await start();
  const replay = await call('/api/client-messages', ct, 'POST', { ...request, clientId: client.id }, worker.origin); assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true); assert.equal(replay.body.message.id, first.body.messageId); assert.deepEqual(replay.body.receipt, first.body.receipt);
  for (const route of routes) for (const [token, status] of [[null, 401], [ot, 403], [tt, 403]]) { assert.equal((await call(route, token)).status, status); assert.equal((await call(route, token, 'POST', request)).status, status); }
  const concurrent = { text: marker + '-concurrent', requestId: randomUUID() };
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => call(routes[i % 2], ct, 'POST', concurrent, i % 3 ? base : worker.origin)));
  assert(results.every(r => r.status === 201), JSON.stringify(results)); assert.equal(new Set(results.map(r => r.body.messageId)).size, 1); assert.equal(results.filter(r => !r.body.replayed).length, 1);
  assert.equal(await prisma.clientMessage.count({ where: { requestId: concurrent.requestId } }), 1);
  assert.equal(await prisma.communicationLog.count({ where: { referenceId: results[0].body.messageId, message: concurrent.text } }), 1);
  assert.equal((await call(routes[1], ct, 'POST', { ...concurrent, text: 'Changed request' })).status, 409);
  const separate = await Promise.all(Array.from({ length: 16 }, (_, i) => call(routes[i % 2], ct, 'POST', { text: `${marker}-separate-${i}`, requestId: randomUUID() }, i % 2 ? base : worker.origin)));
  assert(separate.every(r => r.status === 201), JSON.stringify(separate)); assert.equal(new Set(separate.map(r => r.body.messageId)).size, 16);
  console.log('PASS both legacy aliases and current APIs share receipts, active ownership and concurrent sends across two processes');

  const initial = await prisma.clientChatLegacyRecord.count(), imports = await prisma.clientChatImport.count();
  const historic = { id: 19, clientId: String(client.id), from: 'ADMIN', text: marker + '-history <b>literal</b>', created_at: '2025-12-07T08:15:03.968Z', readByAdmin: false, readByClient: false, extra: { b: 2, a: 'Keep exact fields' } };
  const history = [historic, { ...historic }, { ...historic, id: 20, clientId: String(other.id), text: marker + '-private-other' },
    { id: 21, clientId: String(client.id), text: marker + '-unknown-date', created_at: 'unknown' }, { ...historic, id: 25, text: marker + '-invalid-calendar', created_at: '2025-02-30T08:15:03.968Z' }, { id: 22, clientId: '2147483647', text: marker + '-orphan', created_at: historic.created_at },
    ...Array.from({ length: 500 }, (_, i) => ({ ...historic, id: `batch-${marker}-${i}`, text: `${marker}-batch-${i}` }))];
  const original = Buffer.from(JSON.stringify(history, null, 2)); fs.writeFileSync(file, original);
  const listed = await Promise.all([call(routes[0], at, 'GET', undefined, worker.origin), call(`/api/client-portal/${client.id}/messages`, ct, 'GET', undefined, base)]);
  assert(listed.every(r => r.status === 200), JSON.stringify(listed)); assert.equal(listed[0].cache, 'private, no-store');
  const old = listed[0].body.filter(m => m.text === historic.text); assert.equal(old.length, 2); assert.equal(new Set(old.map(m => m.recordId)).size, 2);
  for (const row of old) { assert.equal(row.id, 19); assert.equal(row.from, 'ADMIN'); assert.equal(row.created_at, historic.created_at); assert.equal(row.identityVerified, false); assert.deepEqual(row.extra, historic.extra); }
  const projected = listed[1].body.messages.filter(m => m.text === historic.text); assert.equal(projected.length, 2); assert(projected.every(m => m.senderType === 'LEGACY' && m.identityVerified === false));
  assert(!JSON.stringify(listed[1].body).includes(marker + '-private-other')); assert(!JSON.stringify(listed[1].body).includes(marker + '-unknown-date'));
  assert(!JSON.stringify(listed[1].body).includes(marker + '-invalid-calendar'));
  assert(listed[0].body.some(m => m.text === marker + '-unknown-date' && m.projected === false));
  const archived = await prisma.clientChatImport.findUniqueOrThrow({ where: { sourceHash: hash(original) } }); assert.deepEqual(Buffer.from(archived.sourceBytes), original); assert.equal(archived.messageCount, history.length);
  assert.equal(await prisma.clientChatLegacyRecord.count(), initial + history.length); assert.equal(await prisma.clientChatImport.count(), imports + 1); assert.deepEqual(fs.readFileSync(file), original);
  fs.writeFileSync(file, JSON.stringify(history.map(r => Object.fromEntries(Object.entries(r).reverse())))); await call(routes[1], ct);
  assert.equal(await prisma.clientChatLegacyRecord.count(), initial + history.length);
  history.push({ ...historic, id: 23, text: marker + '-appended' }); fs.writeFileSync(file, JSON.stringify(history)); await call(modern, ct);
  assert.equal(await prisma.clientChatLegacyRecord.count(), initial + history.length);
  await prisma.client.create({ data: { id: 2147483647, name: 'New account must not inherit an orphan archive', active: true } });
  try {
    const orphanToken = sign({ id: 2147483647, role: 'CLIENT' });
    fs.writeFileSync(file, JSON.stringify(history, null, 3));
    assert.deepEqual((await call('/api/clientChat/2147483647/messages', orphanToken)).body, []);
    assert.equal(await prisma.clientMessage.count({ where: { clientId: 2147483647 } }), 0);
    assert((await call('/api/clientChat/2147483647/messages', at)).body.some(row => row.text === marker + '-orphan' && row.projected === false));
  } finally { await prisma.client.delete({ where: { id: 2147483647 } }); }
  // The source bytes are archived even when old UTF-8 decoding contains replacement characters.
  const nonUtf8 = Buffer.concat([Buffer.from('[{"clientId":"' + client.id + '","text":"'), Buffer.from([0xe1]), Buffer.from('","created_at":"2025-01-01T00:00:00Z"}]')]); fs.writeFileSync(file, nonUtf8);
  assert.equal((await call(routes[0], at)).status, 200); assert.deepEqual(Buffer.from((await prisma.clientChatImport.findUniqueOrThrow({ where: { sourceHash: hash(nonUtf8) } })).sourceBytes), nonUtf8);
  fs.writeFileSync(file, JSON.stringify(history));

  const { resolveUploadSubdir, toPublicUploadUrl } = require('../src/config/uploadPath');
  const name = `${marker}-private.txt`, privateUrl = toPublicUploadUrl('documents', 'client-chat', name), privateBytes = 'The old JSON must not grant access to these bytes';
  fs.writeFileSync(path.join(resolveUploadSubdir('documents/client-chat'), name), privateBytes);
  const privateAttachment = await prisma.clientMessage.create({ data: { clientId: other.id, fileUrl: privateUrl, fileName: name, messageType: 'FILE', senderType: 'ADMIN' } });
  history.push({ ...historic, id: 24, text: privateUrl, fileUrl: privateUrl, messageType: 'FILE' }); fs.writeFileSync(file, JSON.stringify(history));
  const forged = (await call(routes[0], ct)).body.find(m => m.text === privateUrl); assert(forged);
  for (const token of [ct, at]) assert.equal((await call(`/api/client-messages/attachments/${forged.messageId}`, token)).status, 404);
  const permitted = await fetch(base + `/api/client-messages/attachments/${privateAttachment.id}`, { headers: { Authorization: `Bearer ${ot}` } }); assert.equal(permitted.status, 200); assert.equal(await permitted.text(), privateBytes);

  await call(`/api/client-chat/${client.id}/mark-read`, ct, 'POST', { role: 'ADMIN' });
  let stored = await prisma.clientMessage.findUniqueOrThrow({ where: { id: first.body.messageId } }); assert.equal(stored.isReadByAdmin, false); assert.equal(stored.isReadByClient, true);
  const adminSend = await call(routes[1], at, 'POST', { text: marker + '-admin', requestId: randomUUID() }); assert.equal(adminSend.body.from, 'ADMIN'); assert.equal(adminSend.body.readByClient, false);
  await call(`/api/client-messages/seen/${client.id}`, ct, 'POST', {});
  assert.equal((await call(routes[0], ct)).body.find(m => m.messageId === adminSend.body.messageId).readByClient, true);
  await call('/api/chat/read', at, 'POST', { clientId: client.id });
  stored = await prisma.clientMessage.findUniqueOrThrow({ where: { id: first.body.messageId } }); assert.equal(stored.isReadByAdmin, true); const seenAt = stored.seenAt;
  await call(`/api/clientChat/${client.id}/mark-read`, at, 'POST', {}); assert.deepEqual((await prisma.clientMessage.findUniqueOrThrow({ where: { id: stored.id } })).seenAt, seenAt);
  assert.equal((await call('/api/clientChat/unread-count', at)).body.unreadCount, (await call('/api/chat/unread', at)).body.unread);
  const readProbe = await call(routes[0], ct, 'POST', { text: marker + '-read-rollback', requestId: randomUUID() });
  const beforeRead = await prisma.clientMessage.findUniqueOrThrow({ where: { id: readProbe.body.messageId } });
  readTrigger = true; await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_legacy_read_fail() RETURNS trigger AS $$ BEGIN IF NEW.id = ${beforeRead.id} AND NEW."isReadByAdmin" THEN RAISE EXCEPTION 'QA read rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_legacy_read_fail BEFORE UPDATE ON "ClientMessage" FOR EACH ROW EXECUTE FUNCTION qa_legacy_read_fail()');
  assert.equal((await call(`/api/clientChat/${client.id}/mark-read`, at, 'POST', {})).status, 500);
  assert.deepEqual(await prisma.clientMessage.findUniqueOrThrow({ where: { id: beforeRead.id } }), beforeRead);
  await removeReadTrigger(); assert.equal((await call(`/api/client-messages/seen/${client.id}`, at, 'POST', {})).status, 200);
  assert.equal((await prisma.clientMessage.findUniqueOrThrow({ where: { id: beforeRead.id } })).isReadByAdmin, true);
  console.log('PASS exact byte archive, duplicate historical rows, multi-batch import, unknown authors/dates, private clients, reformat/append and shared read state');

  const lost = { text: marker + '-lost-response', requestId: randomUUID() };
  await assert.rejects(call(routes[1], ct, 'POST', lost, worker.origin, { 'x-cw-qa-drop-response': 'true' })); await stop(worker.child); worker = await start(); fs.rmSync(file);
  const recovered = await call(routes[0], ct, 'POST', lost, worker.origin); assert.equal(recovered.status, 201); assert.equal(recovered.body.replayed, true); assert.equal(await prisma.clientMessage.count({ where: { requestId: lost.requestId } }), 1);
  assert.equal((await call(routes[1], at)).body.filter(m => m.text === historic.text).length, 2);
  const failure = { text: marker + '-rollback', requestId: randomUUID() }; history.push({ ...historic, text: marker + '-atomic-import' }); const failingSource = JSON.stringify(history); fs.writeFileSync(file, failingSource);
  const before = { records: await prisma.clientChatLegacyRecord.count(), imports: await prisma.clientChatImport.count(), messages: await prisma.clientMessage.count() };
  trigger = true; await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_client_chat_import_fail() RETURNS trigger AS $$ BEGIN IF NEW.message = '${failure.text}' THEN RAISE EXCEPTION 'QA atomic import failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_client_chat_import_fail BEFORE INSERT ON "CommunicationLog" FOR EACH ROW EXECUTE FUNCTION qa_client_chat_import_fail()');
  assert.equal((await call(routes[0], ct, 'POST', failure)).status, 500);
  assert.equal(await prisma.clientChatLegacyRecord.count(), before.records); assert.equal(await prisma.clientChatImport.count(), before.imports); assert.equal(await prisma.clientMessage.count(), before.messages); assert.equal(fs.readFileSync(file, 'utf8'), failingSource);
  await removeTrigger(); assert.equal((await call(routes[1], ct, 'POST', failure, worker.origin)).status, 201); assert.equal(await prisma.clientMessage.count(), before.messages + 2);
  const finalCount = await prisma.clientMessage.count();
  for (const bad of ['{corrupt', '{}', '[null]', '[1]', '[[]]', '[{"text":"prefix"},null]', '[{"number":1e400}]']) {
    fs.writeFileSync(file, bad); assert.equal((await call(routes[0], ct)).status, 500); assert.equal((await call(modern, ct)).status, 500);
    assert.equal((await call(`/api/client-portal/${client.id}/messages`, ct)).status, 500); assert.equal((await call(routes[1], ct, 'POST', { text: 'Preserve', requestId: randomUUID() })).status, 500);
    assert.equal(fs.readFileSync(file, 'utf8'), bad); assert.equal(await prisma.clientMessage.count(), finalCount);
  }
  fs.writeFileSync(file, failingSource); await prisma.client.update({ where: { id: client.id }, data: { active: false } }); assert.equal((await call(routes[0], ct)).status, 401);
  console.log('PASS response loss/restart, absent/corrupt source, atomic import + message + communication rollback, original retry and revoked identity');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.all([...children].map(stop)); try { await removeTrigger(); await removeReadTrigger(); } finally { if (touched) { if (previous !== null) fs.writeFileSync(file, previous); else fs.rmSync(file, { force: true }); } await prisma.$disconnect(); }
});
