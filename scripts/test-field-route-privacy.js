'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Route private QA', active: true, email: 'route-private@qa.test', phone: '123456789', password: 'private-password', pin: 'private-pin', monthlyFee: 200, fiscalNif: '987654321' } });
  const near = await prisma.pool.create({ data: { clientId: client.id, name: 'Near pool', active: true, monthlyAmount: 100, latitude: 37.01, longitude: -8 } });
  const far = await prisma.pool.create({ data: { clientId: client.id, name: 'Far pool', active: true, monthlyAmount: 100, latitude: 37.1, longitude: -8 } });
  const tech = await prisma.technician.create({ data: { name: 'Route QA tech', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Route QA leader', active: true, role: 'TEAM_LEADER' } });
  const make = (technicianId, poolId) => prisma.serviceVisit.create({ data: { technicianId, poolId, clientId: client.id, status: 'PLANNED', cost: 15, revenue: 35, profit: 20 } });
  const techFar = await make(tech.id, far.id), techNear = await make(tech.id, near.id), leaderNear = await make(leader.id, near.id), missing = await make(tech.id, null);
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' });
  const tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }), lt = sign({ id: leader.id, technicianId: leader.id, role: 'TEAM_LEADER' });
  async function call(token, query = 'lat=37&lng=-8') { const r = await fetch(`${base}/api/route/optimize?${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') }; }
  const first = await call(lt); console.log(JSON.stringify({ leaderOwnVisitsOnly: first.status === 200 && first.body.every(v => v.technicianId === leader.id) }));
  assert.equal(first.status, 200); assert.deepEqual(first.body.map(v => v.id), [leaderNear.id]);
  assert.equal((await call()).status, 401); assert.equal((await call(ct)).status, 403);
  for (const [token, id] of [[tt, tech.id], [lt, leader.id]]) {
    const route = await call(token); assert.equal(route.cache, 'private, no-store'); assert(route.body.every(v => v.technicianId === id));
    for (const visit of route.body) {
      for (const key of ['cost', 'revenue', 'profit', 'billed', 'billedAt']) assert(!(key in visit), key);
      for (const key of ['email', 'phone', 'password', 'pin', 'fiscalNif', 'monthlyFee']) assert(!(key in visit.client), key);
      if (visit.pool) assert(!('monthlyAmount' in visit.pool));
    }
  }
  assert.deepEqual((await call(tt)).body.map(v => v.id), [techNear.id, techFar.id, missing.id]);
  const management = await call(at); assert.equal(management.status, 200); assert(management.body.some(v => v.id === techNear.id)); assert(management.body.some(v => v.id === leaderNear.id));
  const row = management.body.find(v => v.id === techNear.id); assert.equal(row.revenue, 35); assert.equal(row.client.monthlyFee, 200); assert(!('password' in row.client)); assert(!('pin' in row.client));
  for (const query of ['lat=&lng=-8', 'lat=%20&lng=-8', 'lat=37&lng=', 'lat=37&lat=38&lng=-8', 'lat[x]=37&lng=-8', 'lat=91&lng=-8', 'lat=37&lng=-181', 'lng=-8', 'lat=NaN&lng=-8']) assert.equal((await call(tt, query)).status, 400, query);
  await prisma.serviceVisit.update({ where: { id: techNear.id }, data: { technicianId: leader.id } }); assert(!(await call(tt)).body.some(v => v.id === techNear.id)); assert((await call(lt)).body.some(v => v.id === techNear.id));
  await prisma.technician.update({ where: { id: leader.id }, data: { active: false } }); assert.equal((await call(lt)).status, 401);
  console.log('PASS optimization scopes technicians and team leaders, preserves route order and missing coordinates, hides private/financial fields from field users and authentication secrets from all responses');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
