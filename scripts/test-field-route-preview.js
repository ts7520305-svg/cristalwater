'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const date = value => [value.getFullYear(), String(value.getMonth() + 1).padStart(2,'0'), String(value.getDate()).padStart(2,'0')].join('-');
(async () => {
  const today = new Date(); today.setHours(12,0,0,0); const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1); const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  const tech = await prisma.technician.create({ data: { name: 'Route preview owner', active: true } }), other = await prisma.technician.create({ data: { name: 'Route preview leader', role: 'TEAM_LEADER', active: true } });
  const client = await prisma.client.create({ data: { name: 'Route preview client', active: true, password: 'QA-private', pin: 'QA-private', fiscalNif: 'QA-private', monthlyFee: 100 } });
  const pools = [];
  for (const [name, latitude, longitude] of [['Near zero',0.01,0],['Far zero',0.1,0],['Missing',null,null]]) pools.push(await prisma.pool.create({ data: { clientId: client.id, name, latitude, longitude, active: true } }));
  const make = overrides => prisma.serviceVisit.create({ data: { technicianId: tech.id, poolId: pools[0].id, clientId: client.id, date: today, plannedDate: today, status: 'PLANNED', ...overrides } });
  const far = await make({ poolId: pools[1].id }), near = await make({}), missing = await make({ poolId: pools[2].id }), noPool = await make({ poolId: null });
  const nextDay = await make({ plannedDate: tomorrow }), previousDay = await make({ plannedDate: yesterday });
  const oldFallback = await make({ plannedDate: null, date: yesterday }); await make({ status: 'DONE', endAt: today }); await make({ status: 'CANCELLED' }); await make({ startAt: today }); await make({ endAt: today });
  const fallback = await make({ plannedDate: null }), leader = await make({ technicianId: other.id });
  const sign = actor => jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' }), token = sign({ id: tech.id, role: 'TECHNICIAN' }), otherToken = sign({ id: other.id, role: 'TEAM_LEADER' });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), adminToken = sign({ id: admin.id, role: 'ADMIN' });
  const before = await prisma.serviceVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } });
  async function call(query = 'date=' + date(today), auth = token) { const response = await fetch(base + '/api/route/optimize?lat=0&lng=0&' + query, { headers: { Authorization: 'Bearer ' + auth } }); return { response, data: await response.json() }; }
  const current = await call(); assert.equal(current.response.status,200); assert.equal(current.response.headers.get('cache-control'),'private, no-store'); assert.equal(current.response.headers.get('x-cw-route-date'),date(today)); assert.equal(current.response.headers.get('x-cw-route-mode'),'proximity-preview'); assert.equal(current.response.headers.get('x-cw-route-technician'),String(tech.id));
  assert.deepEqual(current.data.map(row=>row.id),[near.id,fallback.id,far.id,missing.id,noPool.id]);
  assert.deepEqual((await call('')).data,current.data); assert.deepEqual((await call('date='+date(today)+'&technicianId='+other.id)).data,current.data);
  assert.deepEqual((await call('date='+date(tomorrow))).data.map(row=>row.id),[nextDay.id]); assert.deepEqual((await call('date='+date(yesterday))).data.map(row=>row.id),[previousDay.id,oldFallback.id]);
  assert.deepEqual((await call('date='+date(today),otherToken)).data.map(row=>row.id),[leader.id]);
  assert.deepEqual((await call('date='+date(today)+'&technicianId='+other.id,adminToken)).data.map(row=>row.id),[leader.id]);
  for (const row of current.data) { assert.equal(row.technicianId,tech.id); assert.equal(row.status,'PLANNED'); assert.equal(row.startAt,null); assert.equal(row.endAt,null); for (const key of ['password','pin','fiscalNif','monthlyFee']) assert(!(key in row.client)); }
  for (const query of ['date=2026-02-30','date=2026-13-01','date=invalid','date=','date=2026-01-01&date=2026-01-02','date[x]=2026-01-01']) assert.equal((await call(query)).response.status,400,query);
  for (const query of ['technicianId=0','technicianId=foo','technicianId=1&technicianId=2']) assert.equal((await call(query,adminToken)).response.status,400,query);
  assert.equal((await call('',sign({ id:client.id,role:'CLIENT' }))).response.status,403);
  assert.deepEqual(await prisma.serviceVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),before);
  console.log('PASS read-only proximity preview uses the scheduled day before creation date, excludes started/finished visits, isolates technicians/leaders, preserves missing coordinates and zero coordinates, and validates dates');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
