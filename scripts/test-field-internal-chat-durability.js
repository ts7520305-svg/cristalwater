'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto'), { fork } = require('node:child_process');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const dataFile = path.join(__dirname, '../src/data/internalChat.json'), children = new Set();
const routes = ['/api/internal-chat/messages', '/api/chat/internal'];
let previous, touched = false, trigger = false;
const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
async function call(route, token, method = 'GET', body, origin = base, extra = {}) {
  const response = await fetch(origin + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
const messages = result => Array.isArray(result.body) ? result.body : result.body.messages;
const message = result => result.body.message || result.body;
async function start() {
  const child = fork(path.join(__dirname, 'fixtures/internal-chat-server.js'), { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.add(child);
  let errors = ''; child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2500); });
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('QA chat process did not start: ' + errors)), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`QA chat process exited ${code}: ${errors}`)); });
    child.once('message', value => { clearTimeout(timer); resolve(`http://127.0.0.1:${value.port}`); });
  });
  return { child, origin };
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) { children.delete(child); return; }
  await new Promise(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM');
  });
  children.delete(child);
}
async function removeTrigger() {
  if (!trigger) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS cw_qa_internal_chat_fail ON "InternalChatMessage"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS cw_qa_internal_chat_fail()'); trigger = false;
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const tech = await prisma.technician.create({ data: { name: 'Durable chat technician', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Durable chat leader', role: 'TEAM_LEADER', active: true } });
  const client = await prisma.client.create({ data: { name: 'Private chat must remain separate', active: true } });
  const at = sign({ id: admin.id, role: 'ADMIN' }), modernAdmin = sign({ id: admin.id, userId: admin.id, principalType: 'USER', role: 'ADMIN' });
  const tt = sign({ id: tech.id, role: 'TECHNICIAN' }), lt = sign({ id: leader.id, role: 'TEAM_LEADER' }), ct = sign({ id: client.id, role: 'CLIENT' });
  const privateText = randomUUID();
  await prisma.chatMessage.create({ data: { senderId: admin.id, receiverId: admin.id, channel: 'ADMIN_INTERNAL', text: privateText } });
  await prisma.clientMessage.create({ data: { clientId: client.id, text: privateText } });
  for (const route of routes) for (const [token, status] of [[null, 401], ['invalid', 401], [ct, 403]]) {
    assert.equal((await call(route, token)).status, status);
    assert.equal((await call(route, token, 'POST', { text: 'Forbidden', requestId: randomUUID() })).status, status);
  }
  previous = fs.existsSync(dataFile) ? fs.readFileSync(dataFile) : null; touched = true;
  const initial = await prisma.internalChatMessage.count(), initialImports = await prisma.internalChatImport.count();
  const marker = randomUUID(), historic = { id: 15, author: 'ADMIN', text: marker, extra: { b: 2, a: 'Preserve me' }, created_at: 'unknown' };
  const history = [historic, { ...historic }, { id: 15, author: 'unknown', text: marker + '-different' },
    ...Array.from({ length: 500 }, (_, index) => ({ id: `${marker}-${index}`, text: `Historic ${index}`, metadata: [null, false, index] }))];
  const originalText = JSON.stringify(history, null, 2); fs.writeFileSync(dataFile, originalText);
  let worker = await start();
  const lists = await Promise.all([call(routes[0], tt), call(routes[1], lt, 'GET', undefined, worker.origin)]);
  for (const list of lists) { assert.equal(list.status, 200, JSON.stringify(list)); assert.equal(list.cache, 'private, no-store'); assert.equal(messages(list).length, initial + history.length); }
  assert.deepEqual(messages(lists[0]), messages(lists[1]));
  const old = messages(lists[0]).filter(row => row.text === marker);
  assert.equal(old.length, 2); assert.equal(new Set(old.map(row => row.recordId)).size, 2);
  for (const row of old) { assert.equal(row.id, 15); assert.equal(row.created_at, 'unknown'); assert.equal(row.author, 'ADMIN'); assert.equal(row.actorId, undefined); assert.equal(row.identityVerified, false); assert.deepEqual(row.extra, historic.extra); }
  const archived = await prisma.internalChatImport.findUniqueOrThrow({ where: { sourceHash: createHash('sha256').update(originalText).digest('hex') } });
  assert.equal(archived.sourceText, originalText); assert.equal(archived.messageCount, history.length);
  assert.equal(await prisma.internalChatImport.count(), initialImports + 1);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), originalText);
  // Key order and indentation are not new messages; duplicate historical rows stay distinct.
  fs.writeFileSync(dataFile, JSON.stringify(history.map(row => Object.fromEntries(Object.entries(row).reverse()))));
  assert.equal(messages(await call(routes[1], at)).length, initial + history.length);
  const addition = { id: 15, text: marker + '-append' }; history.push(addition); fs.writeFileSync(dataFile, JSON.stringify(history));
  assert.equal(messages(await call(routes[0], tt)).length, initial + history.length);
  assert.equal(await prisma.internalChatImport.count(), initialImports + 3);
  assert(!messages(await call(routes[1], lt)).some(row => row.text === privateText));

  const sameRequest = randomUUID(), payload = { text: '  Concurrent single send  ', requestId: sameRequest, actorId: admin.id, author: 'ADMIN', clientId: client.id, receiverId: admin.id };
  const sent = await Promise.all(Array.from({ length: 12 }, (_, index) => call(routes[index % 2], tt, 'POST', payload, index % 3 ? base : worker.origin)));
  assert(sent.every(row => [200, 201].includes(row.status)), JSON.stringify(sent)); assert.equal(sent.filter(row => row.status === 201).length, 1);
  assert.equal(new Set(sent.map(row => message(row).id)).size, 1);
  for (const row of sent) { assert.equal(message(row).text, 'Concurrent single send'); assert.equal(message(row).author, 'TECHNICIAN'); assert.equal(message(row).actorId, tech.id); assert.equal(message(row).actorType, 'TECHNICIAN'); assert.equal(message(row).identityVerified, true); }
  assert.equal(await prisma.internalChatMessage.count({ where: { requestId: sameRequest } }), 1);
  const distinct = await Promise.all(Array.from({ length: 18 }, (_, index) => call(routes[index % 2], tt, 'POST', { text: `Separate ${index}`, requestId: randomUUID() }, index % 2 ? worker.origin : base)));
  assert(distinct.every(row => row.status === 201), JSON.stringify(distinct)); assert.equal(new Set(distinct.map(row => message(row).id)).size, 18);
  const upper = await call(routes[1], tt, 'POST', { ...payload, requestId: sameRequest.toUpperCase(), text: 'Concurrent single send' });
  assert.equal(upper.status, 200); assert.equal(upper.body.replayed, true);
  assert.equal((await call(routes[0], tt, 'POST', { ...payload, text: 'Changed replay' })).status, 409);
  for (const requestId of [undefined, null, '', 1, {}, [], 'not-a-uuid', ' ' + sameRequest, sameRequest + 'x']) assert.equal((await call(routes[1], tt, 'POST', { text: 'Invalid request', requestId })).status, 400);
  for (const text of ['', ' ', null, [], {}, 'x'.repeat(4001)]) assert.equal((await call(routes[0], tt, 'POST', { text, requestId: randomUUID() })).status, 400);
  // Same UUID belongs to separate authenticated accounts. Old/new admin tokens
  // still identify one account and return the original persisted confirmation.
  const adminSend = await call(routes[0], at, 'POST', { text: 'Admin account', requestId: sameRequest }); assert.equal(adminSend.status, 201);
  const adminReplay = await call(routes[1], modernAdmin, 'POST', { text: 'Admin account', requestId: sameRequest }); assert.equal(adminReplay.status, 200); assert.equal(message(adminReplay).id, message(adminSend).id);
  const leaderSend = await call(routes[1], lt, 'POST', { text: 'Leader account', requestId: sameRequest }); assert.equal(leaderSend.status, 201);
  await prisma.technician.update({ where: { id: leader.id }, data: { role: 'TECHNICIAN' } });
  const formerLeader = sign({ id: leader.id, role: 'TECHNICIAN' });
  const roleReplay = await call(routes[0], formerLeader, 'POST', { text: 'Leader account', requestId: sameRequest }); assert.equal(roleReplay.status, 200); assert.equal(message(roleReplay).author, 'TEAM_LEADER');
  assert.equal((await call(routes[1], lt)).status, 401);

  const [maxUser, maxTech] = await Promise.all([prisma.user.aggregate({ _max: { id: true } }), prisma.technician.aggregate({ _max: { id: true } })]);
  const sharedId = Math.max(maxUser._max.id, maxTech._max.id) + 100;
  let collisionUser, collisionTech;
  try {
    collisionUser = await prisma.user.create({ data: { id: sharedId, email: `${marker}@qa.test`, password: 'qa-no-login', role: 'ADMIN', active: true } });
    collisionTech = await prisma.technician.create({ data: { id: sharedId, name: 'Same numeric ID, another account', active: true } });
    const collisionRequest = { text: 'Same number is not the same account', requestId: randomUUID() };
    const first = await call(routes[0], sign({ id: sharedId, userId: sharedId, role: 'ADMIN', principalType: 'USER' }), 'POST', collisionRequest);
    const second = await call(routes[1], sign({ id: sharedId, role: 'TECHNICIAN' }), 'POST', collisionRequest, worker.origin);
    assert.equal(first.status, 201); assert.equal(second.status, 201); assert.notEqual(message(first).id, message(second).id);
    assert.equal(message(first).actorType, 'USER'); assert.equal(message(second).actorType, 'TECHNICIAN');
  } finally {
    if (collisionUser) await prisma.user.delete({ where: { id: collisionUser.id } });
    if (collisionTech) await prisma.technician.delete({ where: { id: collisionTech.id } });
  }

  const lost = { text: 'Saved despite lost response', requestId: randomUUID() };
  await assert.rejects(call(routes[1], tt, 'POST', lost, worker.origin, { 'x-cw-qa-drop-response': 'true' }));
  assert.equal(await prisma.internalChatMessage.count({ where: { requestId: lost.requestId } }), 1);
  await stop(worker.child); worker = await start();
  const recovered = await call(routes[0], tt, 'POST', lost, worker.origin); assert.equal(recovered.status, 200); assert.equal(recovered.body.replayed, true);
  fs.rmSync(dataFile);
  const recoveredList = await call(routes[1], tt, 'GET', undefined, worker.origin); assert.equal(recoveredList.status, 200);
  assert(messages(recoveredList).some(row => row.id === recovered.body.id)); assert.equal(messages(recoveredList).filter(row => row.text === marker).length, 2);

  const beforeFailure = await prisma.internalChatMessage.count(), importsBeforeFailure = await prisma.internalChatImport.count();
  const failure = { text: 'Atomic message and import', requestId: randomUUID() };
  history.push({ text: marker + '-rollback' }); const failingSource = JSON.stringify(history); fs.writeFileSync(dataFile, failingSource);
  trigger = true;
  await prisma.$executeRawUnsafe(`CREATE FUNCTION cw_qa_internal_chat_fail() RETURNS trigger AS $$ BEGIN IF NEW."requestId" = '${failure.requestId}' THEN RAISE EXCEPTION 'Isolated QA chat failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER cw_qa_internal_chat_fail BEFORE INSERT ON "InternalChatMessage" FOR EACH ROW EXECUTE FUNCTION cw_qa_internal_chat_fail()');
  const failed = await call(routes[1], tt, 'POST', failure); assert.equal(failed.status, 500); assert(!JSON.stringify(failed).includes('Isolated QA chat failure'));
  assert.equal(await prisma.internalChatMessage.count(), beforeFailure); assert.equal(await prisma.internalChatImport.count(), importsBeforeFailure);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), failingSource);
  await removeTrigger();
  const restored = await call(routes[0], tt, 'POST', failure, worker.origin); assert.equal(restored.status, 201);
  assert.equal(await prisma.internalChatMessage.count(), beforeFailure + 2); assert.equal(await prisma.internalChatImport.count(), importsBeforeFailure + 1);
  const finalCount = await prisma.internalChatMessage.count();
  for (const invalid of ['{corrupt', '{}', '[null]', '[1]', '[[]]', '[{"text":"valid prefix"},null]', '[{"number":1e400}]']) {
    fs.writeFileSync(dataFile, invalid);
    for (const route of routes) { assert.equal((await call(route, tt)).status, 500); assert.equal((await call(route, at, 'POST', { text: 'Must not erase anything', requestId: randomUUID() })).status, 500); }
    assert.equal(fs.readFileSync(dataFile, 'utf8'), invalid); assert.equal(await prisma.internalChatMessage.count(), finalCount);
  }
  fs.writeFileSync(dataFile, failingSource);
  await prisma.technician.update({ where: { id: tech.id }, data: { active: false } });
  for (const route of routes) { assert.equal((await call(route, tt)).status, 401); assert.equal((await call(route, tt, 'POST', lost)).status, 401); }
  assert.equal(await prisma.chatMessage.count({ where: { text: privateText } }), 1); assert.equal(await prisma.clientMessage.count({ where: { text: privateText } }), 1);
  console.log('PASS shared internal chat: two HTTP processes, atomic multi-batch legacy import, exact archived JSON, unknown authors, duplicate historical rows, concurrent unique sends/retries, conflicting replay, account namespaces, lost response/restart, missing/corrupt source, rollback and private-channel separation');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.all([...children].map(stop));
  try { await removeTrigger(); } finally {
    if (touched) { if (previous !== null) fs.writeFileSync(dataFile, previous); else fs.rmSync(dataFile, { force: true }); }
    await prisma.$disconnect();
  }
});
