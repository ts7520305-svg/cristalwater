'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PID-' + Date.now(), active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Product identity technician', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Product identity client', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Product identity pool', clientId: client.id, active: true } });
  const transport = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'PID-' + Date.now(), status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  const guide = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: transport.id, status: 'OPEN', isDraft: false } });
  const items = [];
  for (const unit of ['L', 'KG', 'KG', null]) items.push(await prisma.workGuideItem.create({ data: { workGuideId: guide.id, name: 'Cloro identidade', unit, type: 'CHEMICAL', quantity: 20, initialQty: 20 } }));
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const api = async (method, path, body) => { const r = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: r.status, body: await r.json() }; };
  const product = (item, quantity) => ({ name: item.name, unit: item.unit, quantity, workGuideId: guide.id, workGuideItemId: item.id, notes: 'Exact original row' });
  for (const type of ['REGULAR', 'EXTRA']) {
    const extra = type === 'EXTRA', model = extra ? prisma.extraVisit : prisma.serviceVisit;
    const create = () => model.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'PLANNED', ...(extra ? { scheduledAt: new Date(), billingMode: 'NO_CHARGE' } : { plannedDate: new Date(), date: new Date() }) } });
    const endpoint = visit => extra ? `/api/field/extra-visits/${visit.id}/complete` : `/api/core/visits/${visit.id}/complete`;
    const complete = (visit, products, requestId = randomUUID()) => api('POST', endpoint(visit), { requestId, ...(extra ? { visitType: type, poolId: pool.id } : {}), workGuideId: guide.id, vehicleId: vehicle.id, products });
    const link = visit => extra ? { extraVisitId: visit.id } : { visitId: visit.id };
    const snapshot = async visit => ({ visit: await model.findUnique({ where: { id: visit.id } }), items: await prisma.workGuideItem.findMany({ where: { workGuideId: guide.id }, orderBy: { id: 'asc' } }), vehicle: await prisma.vehicleStockMovement.findMany({ where: link(visit), orderBy: { id: 'asc' } }), stock: await prisma.stockMovement.findMany({ where: link(visit), orderBy: { id: 'asc' } }) });
    const path = visit => extra ? `/api/field/extra-visits/${visit.id}/correction` : `/api/technician/visits/${visit.id}/correction`;
    const correction = async (visit, products) => api(extra ? 'POST' : 'PATCH', path(visit), { products, ...(extra ? { requestId: randomUUID(), visitType: type, poolId: pool.id, baseVersion: (await api('GET', path(visit))).body.version, reason: 'Quantidade confirmada na linha original' } : {}) });
    const assertRejected = response => extra ? (assert.equal(response.status, 200, JSON.stringify(response)), assert.equal(response.body.applied, false), assert.equal(response.body.code, 'EXTRA_CORRECTION_STOCK')) : assert.equal(response.status, 409, JSON.stringify(response));
    const selected = [product(items[0], 1), product(items[2], 2)], visit = await create(), before = await snapshot(visit), requestId = randomUUID();
    const replies = await Promise.all(Array.from({ length: 4 }, () => complete(visit, selected, requestId)));
    replies.forEach(reply => assert.equal(reply.status, 200, JSON.stringify(reply)));
    let current = await snapshot(visit);
    assert.deepEqual(extra ? current.visit.execution.chemicalsJson : current.visit.chemicalsJson, selected);
    assert.equal(current.items[0].quantity, before.items[0].quantity - 1); assert.equal(current.items[1].quantity, before.items[1].quantity); assert.equal(current.items[2].quantity, before.items[2].quantity - 2);
    assert.equal(current.vehicle.length, 2); assert.equal(current.stock.length, 2);
    for (const movement of [...current.vehicle, ...current.stock]) { const id = JSON.parse(movement.notes); assert.equal(id.workGuideId, guide.id); assert([items[0].id, items[2].id].includes(id.workGuideItemId)); }
    const desired = [product(items[0], 2), product(items[2], 1)];
    assert.equal((await correction(visit, desired)).status, 200); current = await snapshot(visit);
    assert.equal(current.items[0].quantity, before.items[0].quantity - 2); assert.equal(current.items[2].quantity, before.items[2].quantity - 1); assert.equal(current.items[1].quantity, before.items[1].quantity);
    const movements = current.vehicle.length;
    assert.equal((await correction(visit, desired)).status, 200); assert.equal((await snapshot(visit)).vehicle.length, movements);
    for (const invalid of [
      [product(items[0], 3), { name: items[2].name, unit: 'KG', quantity: 1 }],
      [product(items[0], 3), { ...product(items[2], 1), workGuideItemId: items[0].id }],
      [product(items[0], 3), { ...product(items[2], 1), workGuideId: guide.id + 999 }],
      [product(items[0], 999)],
    ]) {
      const saved = await snapshot(visit); assertRejected(await correction(visit, invalid)); assert.deepEqual(await snapshot(visit), saved);
    }
    await prisma.workGuide.update({ where: { id: guide.id }, data: { status: 'CLOSED' } });
    const closed = await snapshot(visit); assertRejected(await correction(visit, [product(items[0], 3), product(items[2], 1)])); assert.deepEqual(await snapshot(visit), closed);
    await prisma.workGuide.update({ where: { id: guide.id }, data: { status: 'OPEN' } });
    // Moving the same named/unit quantity to a different exact row must not be a no-op.
    assert.equal((await correction(visit, [product(items[0], 2), product(items[1], 1)])).status, 200);
    current = await snapshot(visit); assert.equal(current.items[1].quantity, before.items[1].quantity - 1); assert.equal(current.items[2].quantity, before.items[2].quantity);
    console.log('PASS ' + type + ' exact duplicate rows, four concurrent replays, both ledgers, corrections by original identity, repeated correction and atomic rejections');
    for (const invalid of [
      [{ name: items[1].name, unit: 'KG', quantity: 1 }],
      [product(items[3], 1)],
      [{ ...product(items[0], 1), unit: 'KG' }],
      [{ ...product(items[0], 1), workGuideId: guide.id + 999 }],
      [{ ...product(items[0], 1), workGuideItemId: null }],
      [product(items[0], 11), product(items[0], 11)],
    ]) {
      const pending = await create(), saved = await snapshot(pending), response = await complete(pending, invalid);
      assert([400, 409].includes(response.status), JSON.stringify(response)); assert.deepEqual(await snapshot(pending), saved);
    }
    const legacy = await create(); assert.equal((await complete(legacy, [{ name: items[0].name, quantity: 1, unit: 'L' }])).status, 200);
    const duplicate = await prisma.workGuideItem.create({ data: { workGuideId: guide.id, name: items[0].name, unit: 'L', type: 'CHEMICAL', quantity: 20, initialQty: 20 } });
    const saved = await snapshot(legacy); assertRejected(await correction(legacy, [{ name: items[0].name, unit: 'L', quantity: 2 }])); assert.deepEqual(await snapshot(legacy), saved);
    await prisma.workGuideItem.delete({ where: { id: duplicate.id } });
    const decimal = await prisma.workGuideItem.create({ data: { workGuideId: guide.id, name: 'Decimal ' + type, unit: 'l', type: 'CHEMICAL', quantity: 0.3, initialQty: 0.3 } });
    const decimalVisit = await create(); assert.equal((await complete(decimalVisit, [product(decimal, 0.1), product(decimal, 0.2)])).status, 200);
    assert.equal((await prisma.workGuideItem.findUnique({ where: { id: decimal.id } })).quantity, 0);
    assert.equal((await correction(decimalVisit, [])).status, 200); assert.equal((await prisma.workGuideItem.findUnique({ where: { id: decimal.id } })).quantity, 0.3);
    console.log('PASS ' + type + ' missing unit, malformed/stale identity, aggregate insufficiency, unique legacy compatibility, ambiguous historical rejection and exact 0.1 + 0.2 debit/return');
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
