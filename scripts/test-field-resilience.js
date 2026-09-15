// Bounded local API load and deterministic transport faults; never a production benchmark.
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated test/QA environment required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
const parsed = new URL(base);
assert(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname), 'Local HTTP QA backend required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../src/utils/jwtSecret');
const stamp = Date.now();
const report = { status: 'RUNNING', scope: 'ISOLATED_QA_NOT_PRODUCTION_CAPACITY', technicians: 12, readWaves: 6, checks: [], latency: {} };
const samples = new Map();
let proxy;
async function call(method, route, token, body, expected = [200, 201], origin = base) {
  const start = performance.now();
  const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  const key = method + ' ' + route.split('?')[0].replace(/\/\d+/g, '/:id');
  if (!samples.has(key)) samples.set(key, []);
  samples.get(key).push(performance.now() - start);
  assert(expected.includes(response.status), `${key}: ${response.status} ${data.error || data.message || ''}`);
  return data;
}
function check(message) { report.checks.push(message); console.log('PASS ' + message); }
(async () => {
  const admin = (await call('POST', '/api/auth/login', null, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).token;
  assert(admin, 'QA admin login required');
  const teams = [];
  for (let i = 0; i < report.technicians; i++) {
    const tech = await prisma.technician.create({ data: { name: `Resilience ${stamp}-${i}`, active: true } });
    const client = await prisma.client.create({ data: { name: `Resilience client ${stamp}-${i}`, active: true, arrivalAllowed: true, arrivalNotify: true } });
    const pool = await prisma.pool.create({ data: { name: `Resilience pool ${i}`, clientId: client.id, active: true, latitude: 37 + i / 100, longitude: -8 } });
    const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, date: new Date(), plannedDate: new Date(), status: 'PLANNED' } });
    const auth = jwt.sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
    teams.push({ tech, client, pool, visit, auth });
  }
  // Each technician retries the same location four times, while all technicians operate together.
  await Promise.all(teams.map(async team => {
    const point = { technicianId: team.tech.id, latitude: team.pool.latitude, longitude: -8, accuracy: 8, recordedAt: new Date().toISOString() };
    for (let attempt = 0; attempt < 4; attempt++) await call('POST', '/api/gps/update', team.auth, point);
  }));
  for (const team of teams) {
    assert.equal(await prisma.technicianTrack.count({ where: { technicianId: team.tech.id } }), 1);
    assert.equal(await prisma.notification.count({ where: { eventType: 'ARRIVAL_ALERT', clientId: team.client.id } }), 1);
  }
  check('12 concurrent technicians, 48 GPS submissions: exactly 12 history records and 12 proximity notices');
  // 12 simultaneous clients, each requesting its route, history and notification counter sequentially.
  for (let wave = 0; wave < report.readWaves; wave++) {
    await Promise.all(teams.map(async (team, i) => {
      // Deliberately supply a different technician in the query; the authenticated identity must win.
      const route = await call('GET', `/api/technician/today?technicianId=${teams[(i + 1) % teams.length].tech.id}`, team.auth);
      assert.equal(route.technicianId, team.tech.id);
      assert(route.visits.some(visit => visit.id === team.visit.id));
      assert(route.visits.every(visit => visit.pool.id === team.pool.id), 'Route exposes another technician pool');
      const history = await call('GET', `/api/gps/history/${team.tech.id}`, team.auth);
      assert.equal(history.length, 1);
      assert(history.every(point => point.technicianId === team.tech.id));
      await call('GET', '/api/notifications/unread-count', team.auth);
    }));
  }
  report.readRequests = report.technicians * report.readWaves * 3;
  check('216 bounded concurrent route/history/notification reads preserve technician isolation');
  const owner = teams[0];
  await call('GET', `/api/gps/history/${owner.tech.id}`, teams[1].auth, undefined, [403]);
  await call('POST', '/api/gps/update', teams[1].auth, { technicianId: owner.tech.id, latitude: 38, longitude: -9 }, [403]);
  await call('GET', '/api/technician/today', null, undefined, [401]);
  assert.equal(await prisma.technicianTrack.count({ where: { technicianId: owner.tech.id } }), 1);
  check('Cross-technician and unauthenticated requests remain rejected after load');

  const vehicle = await prisma.vehicle.create({ data: { plate: `RS-${stamp}`, name: 'QA resilience', active: true } });
  await prisma.technician.update({ where: { id: owner.tech.id }, data: { vehicleId: vehicle.id } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: `QA-RS-${stamp}`, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  const work = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: owner.tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  const product = await prisma.workGuideItem.create({ data: { workGuideId: work.id, name: 'Resilience chemical', type: 'CHEMICAL', unit: 'KG', quantity: 10, initialQty: 10, usedQty: 0 } });
  const route = `/api/core/visits/${owner.visit.id}/complete`;
  const body = { clientRequestId: randomUUID(), ph: 7.4, chlorine: 1.5, workGuideId: work.id, vehicleId: vehicle.id, products: [{ name: product.name, quantity: 0.5, unit: 'KG' }], cleaned: true, notes: 'QA transport failure and recovery' };
  let requests = 0, upstreamStatus;
  // No external listener; the proxy accepts exactly the intended QA mutation, never arbitrary URLs.
  proxy = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== route) { res.writeHead(404).end(); return; }
    if (++requests === 1) { res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":"QA link unavailable"}'); return; }
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const upstream = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.auth}` }, body: Buffer.concat(chunks), signal: AbortSignal.timeout(20000) });
      upstreamStatus = upstream.status;
      await upstream.arrayBuffer(); // Server has completed; the client receives no acknowledgement.
      res.destroy();
    } catch (error) { res.destroy(error); }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const proxyBase = `http://127.0.0.1:${proxy.address().port}`;
  await call('POST', route, owner.auth, body, [503], proxyBase);
  assert.equal((await prisma.serviceVisit.findUnique({ where: { id: owner.visit.id } })).status, 'PLANNED');
  assert.equal((await prisma.workGuideItem.findUnique({ where: { id: product.id } })).usedQty, 0);
  await assert.rejects(() => call('POST', route, owner.auth, body, [200], proxyBase), /fetch failed|socket|terminated/i);
  assert.equal(upstreamStatus, 200, 'The lost response must follow a successful server commit');
  assert.equal((await prisma.serviceVisit.findUnique({ where: { id: owner.visit.id } })).status, 'DONE');
  await Promise.all(Array.from({ length: 8 }, () => call('POST', route, owner.auth, body)));
  assert.equal(await prisma.chemicalUsage.count({ where: { visitId: owner.visit.id } }), 1);
  assert.equal(await prisma.vehicleStockMovement.count({ where: { visitId: owner.visit.id, movementType: 'CONSUMPTION' } }), 1);
  const stock = await prisma.workGuideItem.findUnique({ where: { id: product.id } });
  assert.equal(Number(stock.usedQty), 0.5);
  assert.equal(Number(stock.quantity), 9.5);
  check('503 before commit leaves no effects; actual lost response after commit plus 8 concurrent replays consumes chemicals exactly once');
  await call('GET', '/api/core/health', null);
  report.status = 'PASS';
})().catch(error => { report.status = 'FAIL'; report.error = error.message; console.error(error); process.exitCode = 1; }).finally(async () => {
  if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
  for (const [route, times] of samples) {
    times.sort((a, b) => a - b);
    const percentile = p => Math.round(times[Math.max(0, Math.ceil(times.length * p) - 1)]);
    report.latency[route] = { requests: times.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: Math.round(times[times.length - 1]) };
  }
  fs.mkdirSync('reports/field-suite', { recursive: true });
  fs.writeFileSync(`reports/field-suite/resilience-${stamp}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, readRequests: report.readRequests, latency: report.latency }));
  await prisma.$disconnect();
});
