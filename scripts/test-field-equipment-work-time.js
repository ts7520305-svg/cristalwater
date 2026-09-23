'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID, randomInt } = require('node:crypto'), { fork } = require('node:child_process');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const children = [], planIds = [], visitIds = [], extraIds = []; let browser, pool;
async function server() {
  const child = fork(require.resolve('./fixtures/expense-server'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); children.push(child);
  const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); });
  return { base, configure: fault => new Promise(resolve => { child.once('message', resolve); child.send({ fault }); }) };
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const tech = await prisma.technician.create({ data: { name: 'Equipment interval QA', active: true } }), other = await prisma.technician.create({ data: { name: 'Other interval QA', active: true } });
  const client = await prisma.client.create({ data: { name: 'Equipment own time ' + randomUUID() } }); pool = await prisma.pool.create({ data: { name: 'Own time QA', clientId: client.id } });
  const sameId = randomInt(800000000, 890000000), baseVisit = { id: sameId, poolId: pool.id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date('2005-01-02T08:00:00.000Z') };
  const regular = await prisma.serviceVisit.create({ data: baseVisit }); visitIds.push(regular.id);
  const extra = await prisma.extraVisit.create({ data: { ...baseVisit, technicianId: other.id } }); extraIds.push(extra.id);
  const token = person => jwt.sign(person, getJwtSecret(), { expiresIn: '1h' });
  const at = token({ id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' }), tt = token({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }), ot = token({ id: other.id, technicianId: other.id, role: 'TECHNICIAN' });
  const one = await server(), two = await server();
  async function api(url, body, status = 200, server = one, credential = tt) {
    const response = await fetch(server.base + '/api/equipment-maintenance' + url, { method: body ? 'POST' : 'GET', headers: { ...(credential ? { Authorization: 'Bearer ' + credential } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); assert.match(response.headers.get('cache-control'), /no-store/); return result;
  }
  async function plan(title) { const p = (await api('/pools/' + pool.id, { component: 'FILTER', title: title + ' ' + randomUUID(), instructions: 'Verificar equipamento e registar observações.', intervalUnit: 'MONTHS', intervalCount: 1, nextDue: '2005-01-02' }, 200, one, at)).plan; planIds.push(p.id); return p; }
  const time = (start = '08:00:00', end = '08:10:00') => ({ startAt: '2005-01-02T' + start + '.000Z', endAt: '2005-01-02T' + end + '.000Z' });
  const input = (p, workTime = time(), type = 'REGULAR') => ({ requestId: randomUUID(), visitType: type, visitId: sameId, poolId: pool.id, expectedVersion: p.version, notes: 'Filtro verificado com tempo explicitamente registado.', confirmed: true, ...(workTime ? { workTime } : {}) });
  const complete = (p, data, status = 200, server = one, credential = tt) => api('/plans/' + p.id + '/complete', data, status, server, credential);
  const listing = (type = 'REGULAR', credential = tt) => api('/visits/' + sameId + '?visitType=' + type, null, 200, one, credential);
  const a = await plan('Intervalo próprio'), b = await plan('Segundo intervalo'), c = await plan('Intervalo concorrente');
  for (const workTime of [null, {}, { ...time(), durationMs: 600000 }, { ...time(), endAt: time().startAt }, { ...time(), startAt: 1 }, { ...time(), startAt: '2005-02-30T08:00:00.000Z' }, { ...time(), startAt: '2005-01-02T08:00:00+00:00' }]) await complete(a, { ...input(a), workTime }, 400);
  await complete(a, input(a), 401, one, null); await complete(a, input(a), 403, one, ot);
  const legacy = { ...input(a) }; delete legacy.visitType; await complete(a, legacy, 400);
  for (const workTime of [time('07:59:00', '08:10:00'), { startAt: new Date(Date.now() + 60000).toISOString(), endAt: new Date(Date.now() + 120000).toISOString() }]) assert.equal((await complete(a, input(a, workTime))).code, 'EQUIPMENT_WORK_TIME');
  const original = input(a), replies = await Promise.all([complete(a, original), complete(a, original, 200, two)]); assert.deepEqual(replies[0], replies[1]); assert(replies[0].applied);
  const receipt = replies[0], record = receipt.completion.workTime; assert.equal(record.durationMs, 600000); assert.equal(record.origin.technicianId, tech.id); assert.equal(record.origin.visitId, sameId); assert.equal(record.origin.visitType, 'REGULAR');
  assert.equal(await prisma.equipmentMaintenanceCompletion.count({ where: { planId: a.id } }), 1);
  const saved = await prisma.equipmentMaintenanceCompletion.findUniqueOrThrow({ where: { id: receipt.completion.id } }); assert.deepEqual(saved.result, receipt);
  const history = await prisma.technicalHistory.findFirstOrThrow({ where: { poolId: pool.id, type: 'EQUIPMENT_MAINTENANCE', message: a.title } }); assert.deepEqual(JSON.parse(history.description).workTime, record);
  await complete(a, { ...original, workTime: time('08:00:00', '08:09:00') }, 409);
  const rejected = input(b, time('08:09:59', '08:20:00')), refusal = await complete(b, rejected); assert.equal(refusal.code, 'EQUIPMENT_WORK_TIME'); assert.deepEqual(await complete(b, rejected, 200, two), refusal);
  const racing = await Promise.all([complete(b, input(b, time('08:10:00', '08:20:00'))), complete(c, input(c, time('08:10:00', '08:20:00')), 200, two)]); assert.equal(racing.filter(r => r.applied).length, 1); assert.equal(racing.filter(r => r.code === 'EQUIPMENT_WORK_TIME').length, 1);
  const extraReceipt = await complete(a, { ...input(a, time(), 'EXTRA'), expectedVersion: 2 }, 200, one, ot); assert(extraReceipt.applied); assert.equal(extraReceipt.completion.workTime.origin.visitType, 'EXTRA'); assert.equal(extraReceipt.completion.workTime.origin.technicianId, other.id);
  const timeless = await plan('Execução sem tempo'); const old = await complete(timeless, input(timeless, null)); assert(old.applied); assert.equal(old.completion.workTime, undefined); assert.equal((await listing()).plans.find(p => p.id === timeless.id).completion.workTime.state, 'MISSING');
  assert.equal((await listing()).plans.find(p => p.id === a.id).completion.workTime.state, 'RECORDED');
  assert.equal((await listing('EXTRA', ot)).plans.find(p => p.id === a.id).completion.workTime.state, 'RECORDED');
  for (const mutation of ['changed', 'removed']) {
    const result = JSON.parse(JSON.stringify(saved.result));
    if (mutation === 'removed') delete result.completion.workTime;
    else { result.completion.workTime.endAt = time('08:00:00', '08:09:00').endAt; result.completion.workTime.durationMs = 540000; }
    await prisma.equipmentMaintenanceCompletion.update({ where: { id: saved.id }, data: { result } }); assert.equal((await listing()).plans.find(p => p.id === a.id).completion.workTime.state, 'REVIEW');
    assert.deepEqual(await complete(a, original), receipt);
    await prisma.equipmentMaintenanceCompletion.update({ where: { id: saved.id }, data: { result: saved.result } });
  }
  // A late parent change requires review while preserving the original time and receipt.
  await prisma.serviceVisit.update({ where: { id: sameId }, data: { startAt: new Date('2005-01-02T08:01:00.000Z') } });
  let view = (await listing()).plans.find(p => p.id === a.id).completion.workTime; assert.equal(view.state, 'REVIEW'); assert.deepEqual(view.record, record); assert.deepEqual(await complete(a, original), receipt);
  await prisma.serviceVisit.update({ where: { id: sameId }, data: { startAt: baseVisit.startAt, endAt: new Date('2005-01-02T08:30:00.000Z'), status: 'DONE' } }); assert.equal((await listing()).plans.find(p => p.id === a.id).completion.workTime.state, 'RECORDED');
  await prisma.serviceVisit.update({ where: { id: sameId }, data: { technicianId: other.id } }); assert.deepEqual(await complete(a, original), receipt); assert.equal((await listing('REGULAR', ot)).plans.find(p => p.id === a.id).completion.workTime.state, 'REVIEW'); await prisma.serviceVisit.update({ where: { id: sameId }, data: { technicianId: tech.id } });
  const conflicting = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, startAt: baseVisit.startAt, endAt: new Date(time().endAt), status: 'DONE' } }); visitIds.push(conflicting.id);
  assert.equal((await listing()).plans.find(p => p.id === a.id).completion.workTime.state, 'REVIEW'); await prisma.serviceVisit.update({ where: { id: conflicting.id }, data: { startAt: null, endAt: null, status: 'PLANNED' } });
  const current = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(Date.now() - 60000) } }); visitIds.push(current.id);
  const uiPlan = await plan('Filtro <img src=x onerror=alert(1)>'), uiInput = { ...input(uiPlan, { startAt: new Date(+current.startAt + 1000).toISOString(), endAt: new Date(+current.startAt + 2000).toISOString() }), visitId: current.id };
  const monetary = async () => Promise.all([prisma.companyExpense.count(), prisma.expenseAllocation.count(), prisma.expensePayment.count(), prisma.stockMovement.count(), prisma.invoice.count(), prisma.emailLog.count()]); const moneyBefore = await monetary();
  for (const fault of ['equipment-audit', 'composition-receipt']) {
    await one.configure(fault); const response = await fetch(one.base + '/api/equipment-maintenance/plans/' + uiPlan.id + '/complete', { method: 'POST', headers: { Authorization: 'Bearer ' + tt, 'Content-Type': 'application/json' }, body: JSON.stringify(uiInput) }); assert.equal(response.status, 500); await one.configure(null);
    assert.equal(await prisma.equipmentMaintenanceCompletion.count({ where: { planId: uiPlan.id } }), 0); assert.equal(await prisma.fieldWriteRequest.count({ where: { requestId: uiInput.requestId } }), 0); assert.equal((await prisma.equipmentMaintenancePlan.findUniqueOrThrow({ where: { id: uiPlan.id } })).version, 1);
  }
  // Real API and real persistent field store; only the acknowledgement is damaged.
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Lisbon' }), page = await context.newPage(); page.setDefaultTimeout(10000);
  const html = fs.readFileSync(path.resolve(__dirname, '../frontend/technician-field-mode.html'), 'utf8'), sectionStart = html.indexOf('    <section class="card field-panel field-panel-agora" id="fieldEquipmentMaintenance"'), section = html.slice(sectionStart, html.indexOf('</section>', sectionStart) + 10); assert(sectionStart >= 0);
  await context.addInitScript(tt => { if (!localStorage.getItem('token')) localStorage.setItem('token', tt); window.CristalAuth = { getToken: () => localStorage.getItem('token'), isSessionExpired: () => false }; const interval = window.setInterval; window.setInterval = (fn, ms, ...args) => interval(fn, ms === 15000 ? 3600000 : ms, ...args); }, tt);
  let mode = 'missing', sent = [], errors = []; page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url()); if (url.origin !== one.base) return route.abort();
    if (url.pathname === '/qa-equipment') return route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font-family:Arial}#cwEquipmentSyncStatus{overflow-wrap:anywhere}</style>${section}<script src="/cw-field-write-store.js"></script><script src="/field-equipment-maintenance.js"></script>` });
    if (url.pathname.endsWith('/complete')) {
      sent.push(route.request().postDataJSON()); const response = await route.fetch(), result = await response.json(); assert(result.applied);
      if (mode === 'missing') delete result.completion.workTime;
      if (mode === 'duration') result.completion.workTime.durationMs++;
      if (mode === 'origin') result.completion.workTime.origin.visitType = 'EXTRA';
      return route.fulfill({ response, json: result });
    }
    return route.continue();
  });
  const open = async p => { await p.goto(one.base + '/qa-equipment'); await p.evaluate(visit => window.dispatchEvent(new CustomEvent('cw:field-visit-selected', { detail: { visitId: visit.id, visitType: 'REGULAR', poolId: visit.poolId, state: 'IN_PROGRESS' } })), current); };
  const card = p => p.locator('.field-equipment-plan').filter({ hasText: uiPlan.title });
  const draftKey = 'cwEquipmentDraft:v1:TECH:' + tech.id + ':REGULAR:' + current.id + ':' + uiPlan.id;
  await open(page); await card(page).getByRole('button', { name: 'Marcar início', exact: true }).click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.workTime?.startAt, draftKey); const initialDraft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey); assert.equal(initialDraft.notes, ''); assert.equal((await page.evaluate(() => CWFieldEquipment.pendingSummary())).length, 1);
  await open(page); assert.match(await card(page).locator('.field-equipment-time').textContent(), /Falta marcar o fim/); assert(await card(page).getByRole('button', { name: 'Registar revisão realizada' }).isDisabled());
  const second = await context.newPage(); await open(second); await card(second).getByRole('button', { name: 'Marcar fim', exact: true }).waitFor();
  await card(page).getByRole('button', { name: 'Marcar fim', exact: true }).click(); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.workTime?.endAt, draftKey);
  await card(second).getByRole('button', { name: 'Marcar fim', exact: true }).click(); await second.waitForFunction(() => document.getElementById('fieldEquipmentStatus').textContent.includes('Outra janela')); assert(await card(second).getByRole('button', { name: 'Registar revisão realizada' }).isDisabled()); await second.close();
  await card(page).locator('textarea').fill('Tempo e observações confirmados no terreno.'); await card(page).locator('input[type=checkbox]').check();
  const output = path.resolve(__dirname, '../reports/field-visual/equipment-work-time'); fs.mkdirSync(output, { recursive: true });
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 950 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await card(page).screenshot({ path: path.join(output, 'timer-' + width + '.png') }); }
  await card(page).getByRole('button', { name: 'Registar revisão realizada' }).click(); await page.waitForFunction(() => document.getElementById('fieldEquipmentStatus').textContent.includes('Resultado incerto'));
  assert.equal(await prisma.equipmentMaintenanceCompletion.count({ where: { planId: uiPlan.id } }), 1); const pending = () => page.evaluate(() => CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE').then(rows => rows.length)); assert.equal(await pending(), 1);
  const sentTime = sent[0].workTime; assert.equal(sentTime.startAt, initialDraft.workTime.startAt);
  for (const next of ['duration', 'origin']) { mode = next; const count = sent.length; const message = await page.evaluate(async () => { const [row] = await CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE'); try { await CWFieldWriteStore.send(row.requestId); } catch (error) { return error.message; } }); assert.match(message, /O tempo da revisão/); assert(sent.length > count); assert.equal(await pending(), 1); }
  mode = 'success'; await page.getByRole('button', { name: 'Repetir a mesma confirmação' }).click(); await page.waitForFunction(() => CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE').then(rows => rows.length === 0));
  await card(page).getByText('Revisão já registada nesta visita.').waitFor(); assert.match(await card(page).textContent(), /s registados/); assert(sent.length >= 4); for (const request of sent) assert.deepEqual(request, sent[0]); assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null);
  await page.evaluate(() => { localStorage.setItem('token', 'other-account'); window.dispatchEvent(new Event('storage')); }); assert.equal(await page.locator('#fieldEquipmentMaintenance').isVisible(), false); assert.deepEqual(errors, []);
  assert.deepEqual(await monetary(), moneyBefore); assert.deepEqual((await prisma.equipmentMaintenanceCompletion.findUniqueOrThrow({ where: { id: saved.id } })).result, receipt);
  console.log('PASS equipment own work time: explicit optional intervals, UTC bounds and invalid input, typed equal-ID parents, adjacent and concurrent overlapping plans, exact receipts and rollback, missing time stays missing, late source/time review, no financial or stock writes, real browser timer/draft reload/CAS/account isolation, damaged acknowledgements preserved and identical retry, responsive 320/390/1440');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); for (const child of children) child.kill('SIGTERM');
  if (pool) {
    await prisma.fieldWriteRequest.deleteMany({ where: { scope: 'EQUIPMENT_MAINTENANCE', resourceId: { in: planIds } } });
    await prisma.technicalHistory.deleteMany({ where: { poolId: pool.id, type: 'EQUIPMENT_MAINTENANCE' } });
    await prisma.equipmentMaintenanceCompletion.deleteMany({ where: { planId: { in: planIds } } });
    await prisma.equipmentMaintenancePlan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.serviceVisit.deleteMany({ where: { id: { in: visitIds } } }); await prisma.extraVisit.deleteMany({ where: { id: { in: extraIds } } });
  }
  await prisma.$disconnect();
});
