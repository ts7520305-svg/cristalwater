'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tAAAAABJRU5ErkJggg==', 'base64');
let child, trigger = false;
async function start() { child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore','ignore','ignore','ipc'] }); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA startup timeout')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve('http://127.0.0.1:' + port); }); }); }
async function stop() { if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function clearTrigger() { if (!trigger) return; await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_field_receipt_failure ON "FieldWriteRequest"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_field_receipt_failure()'); trigger = false; }
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Field recovery owner', active: true } }), other = await prisma.technician.create({ data: { name: 'Field recovery other', active: true } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), otherToken = jwt.sign({ id: other.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Field recovery client', active: true } }), pool = await prisma.pool.create({ data: { name: 'Field recovery pool', clientId: client.id, active: true } });
  const visit = () => prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), status: 'PLANNED' } });
  const photoVisit = await visit(), doneVisit = await visit(), rollbackVisit = await visit();
  async function photo(id, requestId, { host = base, credential = token, bytes = png, type = 'AFTER', drop = false, name = 'field.png' } = {}) { const form = new FormData(); form.append('type', type); form.append('requestId', requestId); form.append('photo', new Blob([bytes], { type: 'image/png' }), name); const response = await fetch(host + '/api/visits/' + id + '/photo', { method: 'POST', headers: { Authorization: 'Bearer ' + credential, 'X-CW-Field-Request': requestId, ...(drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: form }); return { status: response.status, body: await response.json() }; }
  async function complete(id, body, host = base, drop = false, credential = token) { const response = await fetch(host + '/api/core/visits/' + id + '/complete', { method: 'POST', headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json', ...(drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; }
  let second = await start(); const photoId = randomUUID();
  const photos = await Promise.all(Array.from({ length: 6 }, (_, i) => photo(photoVisit.id, photoId, { host: i % 2 ? base : second })));
  for (const result of photos) { assert.equal(result.status, 200); assert.deepEqual(result.body, photos[0].body); }
  assert.equal(await prisma.visitPhoto.count({ where: { visitId: photoVisit.id } }), 1); assert.equal(await prisma.auditTrail.count({ where: { visitId: photoVisit.id, eventType: 'VISIT_PHOTO_UPLOADED' } }), 1);
  assert.equal((await photo(photoVisit.id, photoId, { bytes: Buffer.concat([png, Buffer.from('other')]) })).status, 409);
  assert.equal((await photo(photoVisit.id, randomUUID(), { credential: otherToken })).status, 403);
  assert.equal((await photo(photoVisit.id, randomUUID(), { bytes: Buffer.from('<svg onload="evil()"/>') })).status, 400);
  const sameBytes = await photo(photoVisit.id, randomUUID(), { name: 'renamed.jpeg' }); assert.equal(sameBytes.body.photo.id, photos[0].body.photo.id); assert.equal(await prisma.visitPhoto.count({ where: { visitId: photoVisit.id } }), 1);
  const lostPhoto = randomUUID(); await assert.rejects(photo(photoVisit.id, lostPhoto, { host: second, drop: true })); await stop(); second = await start();
  assert.equal((await photo(photoVisit.id, lostPhoto, { host: second })).body.photo.id, photos[0].body.photo.id);
  console.log('PASS exact immutable photo receipt, six sends/two processes, byte/UUID conflict, renamed file deduplication, lost reply/restart and private ownership');

  const vehicle = await prisma.vehicle.create({ data: { plate: 'FW-' + Date.now(), active: true } }); await prisma.technician.update({ where: { id: tech.id }, data: { vehicleId: vehicle.id } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'FW-' + Date.now(), status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  const work = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  const item = await prisma.workGuideItem.create({ data: { workGuideId: work.id, name: 'Field recovery chemical', type: 'CHEMICAL', unit: 'KG', quantity: 10, initialQty: 10, usedQty: 0 } });
  const body = { requestId: randomUUID(), visitId: doneVisit.id, notes: 'Original completion', ph: 7.4, chlorine: 1.5, vehicleId: vehicle.id, workGuideId: work.id, products: [{ name: item.name, quantity: 0.5, unit: 'KG' }], problem: 'QA inspection' };
  await assert.rejects(complete(doneVisit.id, body, second, true)); await stop(); second = await start();
  const replies = await Promise.all(Array.from({ length: 6 }, (_, i) => complete(doneVisit.id, body, i % 2 ? base : second)));
  for (const result of replies) { assert.equal(result.status, 200); assert.deepEqual(result.body, replies[0].body); }
  assert.equal((await prisma.workGuideItem.findUnique({ where: { id: item.id } })).quantity, 9.5); assert.equal(await prisma.vehicleStockMovement.count({ where: { visitId: doneVisit.id } }), 1);
  assert.equal(await prisma.technicalHistory.count({ where: { poolId: pool.id, type: 'VISIT_COMPLETED' } }), 1); assert.equal(await prisma.auditTrail.count({ where: { visitId: doneVisit.id, eventType: 'VISIT_COMPLETED' } }), 1);
  assert.equal((await complete(doneVisit.id, { ...body, notes: 'Changed' })).status, 409); assert.equal((await complete(doneVisit.id, { ...body, requestId: randomUUID() })).status, 409);
  assert.equal((await complete(rollbackVisit.id, { requestId: randomUUID() }, base, false, otherToken)).status, 403);
  await prisma.serviceVisit.update({ where: { id: doneVisit.id }, data: { technicianId: other.id, notes: 'Later admin correction' } }); assert.deepEqual((await complete(doneVisit.id, body)).body, replies[0].body);
  console.log('PASS immutable completion recovery after restart/reassignment, changed payload rejection and one consumption/history/audit/repair effect');

  trigger = true; await prisma.$executeRawUnsafe("CREATE FUNCTION qa_field_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA receipt failure'; END $$"); await prisma.$executeRawUnsafe('CREATE TRIGGER qa_field_receipt_failure BEFORE INSERT ON "FieldWriteRequest" FOR EACH ROW EXECUTE FUNCTION qa_field_receipt_failure()');
  const rollbackBody = { ...body, requestId: randomUUID(), visitId: rollbackVisit.id };
  try {
    const failed = await complete(rollbackVisit.id, rollbackBody, second); assert.equal(failed.status, 503); await stop(); second = await start();
    assert.equal((await prisma.serviceVisit.findUnique({ where: { id: rollbackVisit.id } })).status, 'PLANNED'); assert.equal((await prisma.workGuideItem.findUnique({ where: { id: item.id } })).quantity, 9.5); assert.equal(await prisma.vehicleStockMovement.count({ where: { visitId: rollbackVisit.id } }), 0);
    assert.equal((await photo(rollbackVisit.id, randomUUID(), { host: second })).status, 503); assert.equal(await prisma.visitPhoto.count({ where: { visitId: rollbackVisit.id } }), 0); assert.equal(await prisma.auditTrail.count({ where: { visitId: rollbackVisit.id } }), 0);
  } finally { await clearTrigger(); await stop(); }
  assert.equal((await complete(rollbackVisit.id, rollbackBody)).status, 200); assert.equal((await prisma.workGuideItem.findUnique({ where: { id: item.id } })).quantity, 9);
  console.log('PASS missing receipt rolls back completion, stock, photo rows and audit; original completion recovers after repair');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await clearTrigger(); await stop(); await prisma.$disconnect(); });
