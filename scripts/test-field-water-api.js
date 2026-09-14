const assert = require('node:assert/strict');
require('../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true') throw new Error('Run only in isolated test/QA mode');
const { prisma } = require('../src/prismaClient');
const { processOverdue } = require('../src/services/waterReminderService');
const BASE = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
const results = [];
async function main() {
  const suffix = Date.now();
  const tech = await prisma.technician.create({ data: { name: `Water QA ${suffix}`, pin: '927418', active: true } });
  const other = await prisma.technician.create({ data: { name: `Water Other ${suffix}`, pin: '927419', active: true } });
  const client = await prisma.client.create({ data: { name: `Water client ${suffix}`, active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Water QA Pool', clientId: client.id } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, date: new Date(), status: 'PLANNED' } });
  async function call(method, path, token, body) {
    const response = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  }
  const login = await call('POST', '/api/technician-auth/login', null, { pin: tech.pin }); assert.equal(login.status, 200);
  const foreignLogin = await call('POST', '/api/technician-auth/login', null, { pin: other.pin }); assert.equal(foreignLogin.status, 200);
  const token = login.body.token, otherToken = foreignLogin.body.token, path = '/api/technician/water-reminders';
  const payload = { localId: `qa-${suffix}`, visitId: visit.id, poolId: pool.id, clientId: client.id, technicianId: tech.id, dueAt: new Date(Date.now()-60000).toISOString() };
  const test = async (name, fn) => { try { await fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false, error: e.message }); console.error('FAIL', name, e.message); } };
  await test('unauthenticated create rejected', async()=>assert.equal((await call('POST', path, null, payload)).status,401));
  await test('foreign visit create rejected', async()=>assert.equal((await call('POST', path, otherToken, payload)).status,403));
  await test('spoofed technician rejected', async()=>assert.equal((await call('POST', path, token, {...payload,technicianId:other.id})).status,400));
  let id;
  await test('concurrent replay creates one reminder', async()=>{ const replies=await Promise.all([call('POST',path,token,payload),call('POST',path,token,payload)]); replies.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.body))); id=replies[0].body.reminder.id;assert.equal(replies[1].body.reminder.id,id);assert.equal(await prisma.operationalReminder.count({where:{sourceKey:`water:${tech.id}:${payload.localId}`}}),1); });
  assert(id,'Creation must succeed to test remaining transitions');
  await test('foreign close rejected',async()=>assert.equal((await call('POST',`${path}/${id}/close`,otherToken,{})).status,403));
  await test('unknown close returns404',async()=>assert.equal((await call('POST',`${path}/99999999/close`,token,{})).status,404));
  await test('server escalates without browser and repeats safely',async()=>{await processOverdue();await processOverdue();assert.equal(await prisma.technicalAlert.count({where:{poolId:pool.id,type:'AGUA_ABERTA'}}),1);assert.equal(await prisma.notification.count({where:{clientId:client.id,eventType:'WATER_OPEN_OVERDUE'}}),2);});
  await test('foreign list hides reminder',async()=>{const r=await call('GET',path,otherToken);assert.equal(r.status,200);assert(!r.body.reminders.some(x=>x.id===id));});
  await test('close resolves linked alarm only',async()=>{const r=await call('POST',`${path}/${id}/close`,token,{});assert.equal(r.status,200);assert.equal(r.body.reminder.isCompleted,true);assert.equal(await prisma.technicalAlert.count({where:{poolId:pool.id,status:'OPEN'}}),0);});
  await test('late alarm cannot reopen a closed reminder',async()=>{const r=await call('POST',`${path}/${id}/alarm`,token,{});assert.equal(r.status,200);assert.equal(r.body.reminder.isCompleted,true);assert.equal(await prisma.technicalAlert.count({where:{poolId:pool.id}}),1);});
  await test('replayed create preserves closed state',async()=>{const r=await call('POST',path,token,payload);assert.equal(r.body.reminder.id,id);assert.equal(r.body.reminder.isCompleted,true);});
  await test('field reload can retrieve authoritative state',async()=>{const r=await call('GET',path,token);assert(r.body.reminders.some(x=>x.id===id&&x.isCompleted));});
  console.log(JSON.stringify({results},null,2));
  if(results.some(r=>!r.pass))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
