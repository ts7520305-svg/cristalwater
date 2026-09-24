'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID, randomInt } = require('node:crypto'), { fork } = require('node:child_process');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { hash } = require('../src/services/fieldWriteRequestService');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const children = [], planIds = [], visitIds = [], extraIds = [], requestIds = [];
let browser, pool, admin, tech, other, client, vehicle, guide;
const uuid = () => { const id = randomUUID(); requestIds.push(id); return id; };
async function server() {
  const child = fork(require.resolve('./fixtures/expense-server'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); children.push(child);
  const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); });
  return { base, configure: fault => new Promise(resolve => { child.once('message', resolve); child.send({ fault }); }) };
}
const declared = (quantity = '0.1', productName = 'Clóro', unit = 'KG') => ({ mode: 'DECLARED', items: [{ productName, unit, quantity }] });
(async () => {
  admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  client = await prisma.client.create({ data: { name: 'Equipment materials ' + randomUUID() } }); pool = await prisma.pool.create({ data: { name: 'Material quantities QA', clientId: client.id } });
  vehicle = await prisma.vehicle.create({ data: { plate: 'MAT-' + randomUUID(), active: true } });
  tech = await prisma.technician.create({ data: { name: 'Materials field QA', active: true, vehicleId: vehicle.id } }); other = await prisma.technician.create({ data: { name: 'Other materials QA', active: true } });
  guide = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, status: 'OPEN', items: { create: { name: 'CLORO', type: 'CHEMICAL', unit: 'KG', quantity: 10, initialQty: 10 } } }, include: { items: true } });
  const actor = { id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }, token = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const tt = token(actor), at = token({ id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' }), ot = token({ id: other.id, technicianId: other.id, role: 'TECHNICIAN' });
  const sameId = randomInt(610000000, 690000000), baseVisit = { id: sameId, poolId: pool.id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(Date.now() - 60000) };
  await prisma.serviceVisit.create({ data: baseVisit }); visitIds.push(sameId); await prisma.extraVisit.create({ data: baseVisit }); extraIds.push(sameId);
  const one = await server(), two = await server();
  async function api(url, body, status = 200, server = one, credential = tt) {
    const response = await fetch(server.base + '/api/equipment-maintenance' + url, { method: body ? 'POST' : 'GET', headers: { ...(credential ? { Authorization: 'Bearer ' + credential } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (status === 500) { assert.equal(response.status, 500); await response.text(); return null; }
    const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); assert.match(response.headers.get('cache-control'), /no-store/); return result;
  }
  async function plan(title) { const p = (await api('/pools/' + pool.id, { component: 'FILTER', title: title + ' ' + randomUUID(), instructions: 'Conferir materiais e observações.', intervalUnit: 'MONTHS', intervalCount: 1, nextDue: '2005-01-02' }, 200, one, at)).plan; planIds.push(p.id); return p; }
  const input = (p, materials = declared(), type = 'REGULAR', visitId = sameId) => ({ requestId: uuid(), visitType: type, visitId, poolId: pool.id, expectedVersion: p.version, notes: 'Materiais explicitamente declarados nesta revisão.', confirmed: true, ...(materials ? { materials } : {}) });
  const complete = (p, data, status = 200, server = one, credential = tt) => api('/plans/' + p.id + '/complete', data, status, server, credential);
  const listing = (type = 'REGULAR', credential = tt) => api('/visits/' + sameId + '?visitType=' + type, null, 200, one, credential);
  const material = (view, p) => view.plans.find(row => row.id === p.id).completion.materials;
  const a = await plan('Primeira parcela'), b = await plan('Segunda parcela'), c = await plan('Sem materiais'), d = await plan('Registo antigo');
  for (const materials of [null, [], {}, declared('0'), declared('-1'), declared('0.0000001'), declared('100000.000001'), declared(1), { ...declared(), cost: 5 }, { mode: 'NONE', items: declared().items }, { mode: 'DECLARED', items: [...declared().items, ...declared('0.2', 'CLORO').items] }]) await complete(a, { ...input(a), materials }, 400);
  const legacy = input(a); delete legacy.visitType; await complete(a, legacy, 400);
  await complete(a, input(a), 401, one, null); await complete(a, input(a), 403, one, ot);
  const stock = () => prisma.stockMovement.findMany({ where: { OR: [{ visitId: { in: visitIds } }, { extraVisitId: { in: extraIds } }] }, orderBy: { id: 'asc' } });
  const finance = async () => Promise.all([prisma.companyExpense.count(), prisma.expenseAllocation.count(), prisma.expensePayment.count(), prisma.invoice.count(), prisma.emailLog.count()]);
  const moneyBefore = await finance(), stockBefore = await stock(), guideBefore = await prisma.workGuideItem.findMany({ where: { workGuideId: guide.id } });
  const original = input(a), repeated = await Promise.all([complete(a, original), complete(a, original, 200, two)]); assert.deepEqual(repeated[0], repeated[1]); assert(repeated[0].applied);
  const receipt = repeated[0], record = receipt.completion.materials, saved = await prisma.equipmentMaintenanceCompletion.findUniqueOrThrow({ where: { id: receipt.completion.id } });
  assert.deepEqual(record.items, [{ productName: 'CLORO', unit: 'KG', quantity: '0.1' }]); assert.equal(record.origin.visitType, 'REGULAR'); assert.equal(record.origin.clientId, client.id);
  assert.equal(await prisma.equipmentMaintenanceCompletion.count({ where: { planId: a.id } }), 1); assert.deepEqual(saved.result, receipt);
  const history = await prisma.technicalHistory.findFirstOrThrow({ where: { poolId: pool.id, type: 'EQUIPMENT_MAINTENANCE', message: a.title } }); assert.deepEqual(JSON.parse(history.description).materials, record);
  await complete(a, { ...original, materials: declared('0.2') }, 409);
  const second = await complete(b, input(b, declared('0.2'))); assert(second.applied);
  const none = await complete(c, input(c, { mode: 'NONE', items: [] })); assert(none.applied);
  const missing = await complete(d, input(d, null)); assert(missing.applied); assert.equal(missing.completion.materials, undefined);
  let view = await listing(); assert.equal(material(view, a).state, 'DECLARED'); assert.equal(material(view, c).state, 'NONE'); assert.equal(material(view, d).state, 'MISSING');
  const extraReceipt = await complete(a, { ...input(a, declared('0.3'), 'EXTRA'), expectedVersion: 2 }); assert(extraReceipt.applied); assert.equal(extraReceipt.completion.materials.origin.visitType, 'EXTRA');
  assert.deepEqual(await stock(), stockBefore); assert.deepEqual(await finance(), moneyBefore); assert.deepEqual(await prisma.workGuideItem.findMany({ where: { workGuideId: guide.id } }), guideBefore);
  // A real parent completion consumes the guide once; declarations never add movements.
  const completionBody = { requestId: uuid(), visitType: 'EXTRA', poolId: pool.id, workGuideId: guide.id, vehicleId: vehicle.id, products: [{ name: 'CLORO', unit: 'KG', quantity: 0.5 }], notes: 'Total includes maintenance material exactly once.' };
  const extraExecution = require('../src/services/extraVisitExecutionService');
  const parent = await extraExecution.complete(actor, sameId, completionBody); assert.equal(parent.visit.status, 'DONE'); assert.deepEqual(await extraExecution.complete(actor, sameId, completionBody), parent);
  assert.equal((await stock()).length, 1); assert.equal((await prisma.workGuideItem.findUniqueOrThrow({ where: { id: guide.items[0].id } })).quantity, 9.5);
  let extraView = material(await listing('EXTRA'), a); assert.equal(extraView.state, 'MATCHED'); assert.deepEqual(extraView.comparison.lines[0], { productName: 'CLORO', unit: 'KG', quantity: '0.3', visitQuantity: '0.5', declaredMaintenanceQuantity: '0.3', unassignedQuantity: '0.2' }); assert.equal(extraView.comparison.sourceHash, hash(extraView.comparison.source));
  assert.equal(material(await listing(), a).state, 'DECLARED');
  // Controlled stock history fixtures exercise current returns, identity and sibling budgets.
  const consume = await prisma.stockMovement.create({ data: { movementType: 'CONSUMPTION', productName: 'CLORO', unit: 'KG', quantity: 0.5, visitId: sameId, clientId: client.id, poolId: pool.id, technicianId: tech.id } });
  await prisma.serviceVisit.update({ where: { id: sameId }, data: { status: 'DONE', endAt: new Date() } });
  view = await listing(); assert.equal(material(view, a).state, 'MATCHED'); assert.equal(material(view, b).comparison.lines[0].declaredMaintenanceQuantity, '0.3');
  const returned = await prisma.stockMovement.create({ data: { movementType: 'RETURN', productName: 'Clóro', unit: 'KG', quantity: 0.3, visitId: sameId, clientId: client.id, poolId: pool.id } });
  view = await listing(); for (const p of [a, b]) { assert.equal(material(view, p).state, 'REVIEW'); assert(material(view, p).reasons.includes('DECLARATIONS_EXCEED_NET_CONSUMPTION')); }
  assert.equal(material(await listing('EXTRA'), a).state, 'MATCHED'); assert.deepEqual(await complete(a, original), receipt);
  await prisma.stockMovement.update({ where: { id: returned.id }, data: { quantity: 0.2 } }); assert.equal(material(await listing(), a).comparison.lines[0].unassignedQuantity, '0');
  const baselineMovement = await prisma.stockMovement.findUniqueOrThrow({ where: { id: consume.id } });
  for (const mutation of [{ productId: 101 }, { extraVisitId: sameId }, { unit: 'L' }, { clientId: client.id + 10000 }, { movementType: 'UNSUPPORTED' }]) {
    if (mutation.productId) await prisma.stockMovement.update({ where: { id: returned.id }, data: { productId: 102 } });
    await prisma.stockMovement.update({ where: { id: consume.id }, data: mutation }); assert.equal(material(await listing(), a).state, 'REVIEW');
    await prisma.stockMovement.update({ where: { id: consume.id }, data: Object.fromEntries(Object.keys(mutation).map(k => [k, baselineMovement[k]])) });
    await prisma.stockMovement.update({ where: { id: returned.id }, data: { productId: null } });
  }
  for (const mutation of ['changed', 'removed']) {
    const result = structuredClone(saved.result); if (mutation === 'removed') delete result.completion.materials; else result.completion.materials.items[0].quantity = '0.01';
    await prisma.equipmentMaintenanceCompletion.update({ where: { id: saved.id }, data: { result } }); view = await listing(); assert.equal(material(view, a).state, 'REVIEW'); assert.equal(material(view, b).state, 'REVIEW'); assert.deepEqual(await complete(a, original), receipt);
    await prisma.equipmentMaintenanceCompletion.update({ where: { id: saved.id }, data: { result: saved.result } });
  }
  await prisma.serviceVisit.update({ where: { id: sameId }, data: { technicianId: other.id } }); assert.equal(material(await listing('REGULAR', ot), a).state, 'REVIEW'); assert.deepEqual(await complete(a, original), receipt); await prisma.serviceVisit.update({ where: { id: sameId }, data: { technicianId: tech.id } });
  const current = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(Date.now() - 60000) } }); visitIds.push(current.id);
  const uiPlan = await plan('Filtro <img src=x onerror=alert(1)>'), uiInput = input(uiPlan, declared(), 'REGULAR', current.id);
  for (const fault of ['equipment-audit', 'composition-receipt']) {
    await one.configure(fault); await complete(uiPlan, uiInput, 500); await one.configure(null);
    assert.equal(await prisma.equipmentMaintenanceCompletion.count({ where: { planId: uiPlan.id } }), 0); assert.equal(await prisma.fieldWriteRequest.count({ where: { requestId: uiInput.requestId } }), 0); assert.equal((await prisma.equipmentMaintenancePlan.findUniqueOrThrow({ where: { id: uiPlan.id } })).version, 1);
  }
  const beforeUIStock = await stock(), beforeUIMoney = await finance();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(10000);
  const html = fs.readFileSync(path.resolve(__dirname, '../frontend/technician-field-mode.html'), 'utf8'), sectionStart = html.indexOf('    <section class="card field-panel field-panel-agora" id="fieldEquipmentMaintenance"'), section = html.slice(sectionStart, html.indexOf('</section>', sectionStart) + 10); assert(sectionStart >= 0);
  await context.addInitScript(tt => { if (!localStorage.getItem('token')) localStorage.setItem('token', tt); window.CristalAuth = { getToken: () => localStorage.getItem('token'), isSessionExpired: () => false }; const interval = window.setInterval; window.setInterval = (fn, ms, ...args) => interval(fn, ms === 15000 ? 3600000 : ms, ...args); }, tt);
  let mode = 'missing', sent = []; const errors = []; page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url()); if (url.origin !== one.base) return route.abort();
    if (url.pathname === '/qa-equipment-materials') return route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font-family:Arial}#cwEquipmentSyncStatus{overflow-wrap:anywhere}</style>${section}<script src="/cw-field-write-store.js"></script><script src="/field-equipment-maintenance.js"></script>` });
    if (url.pathname.endsWith('/complete')) {
      sent.push(route.request().postDataJSON()); if (!requestIds.includes(sent.at(-1).requestId)) requestIds.push(sent.at(-1).requestId); const response = await route.fetch(), result = await response.json(); assert(result.applied);
      if (mode === 'missing') delete result.completion.materials;
      if (mode === 'quantity') result.completion.materials.items[0].quantity = '9';
      if (mode === 'origin') result.completion.materials.origin.visitType = 'EXTRA';
      if (mode === 'lost') return route.abort();
      return route.fulfill({ response, json: result });
    }
    return route.continue();
  });
  const open = async p => { await p.goto(one.base + '/qa-equipment-materials'); await p.evaluate(visit => window.dispatchEvent(new CustomEvent('cw:field-visit-selected', { detail: { visitId: visit.id, visitType: 'REGULAR', poolId: visit.poolId, state: visit.status } })), current); };
  const card = p => p.locator('.field-equipment-plan').filter({ hasText: uiPlan.title }), field = (p, name) => card(p).locator('[data-material-field="' + name + '"]');
  const draftKey = 'cwEquipmentDraft:v1:TECH:' + tech.id + ':REGULAR:' + current.id + ':' + uiPlan.id;
  await open(page); await card(page).getByLabel('Registo de materiais').selectOption('DECLARED');
  await field(page, 'productName').fill('CLORO'); await field(page, 'quantity').fill('0,123456'); await field(page, 'unit').fill('KG');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.materials?.items[0]?.unit === 'KG', draftKey);
  assert.equal((await page.evaluate(() => CWFieldEquipment.pendingSummary())).length, 1); assert(await card(page).getByRole('button', { name: 'Registar revisão realizada' }).isDisabled());
  await open(page); assert.equal(await field(page, 'quantity').inputValue(), '0.123456');
  await card(page).getByLabel('Registo de materiais').selectOption('NONE'); assert.equal(await card(page).getByLabel('Registo de materiais').inputValue(), 'DECLARED'); assert.equal(await field(page, 'quantity').inputValue(), '0.123456');
  const secondPage = await context.newPage(); await open(secondPage); await field(secondPage, 'quantity').waitFor();
  await field(page, 'quantity').fill('0.2'); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).materials.items[0].quantity === '0.2', draftKey);
  await field(secondPage, 'quantity').fill('0.3'); await secondPage.waitForFunction(() => document.getElementById('fieldEquipmentStatus').textContent.includes('Outra janela')); assert(await card(secondPage).getByRole('button', { name: 'Registar revisão realizada' }).isDisabled()); await secondPage.close();
  await card(page).locator('textarea').fill('Materiais confirmados no terreno.'); await card(page).locator('input[type=checkbox]').check();
  const output = path.resolve(__dirname, '../reports/field-visual/equipment-materials'); fs.mkdirSync(output, { recursive: true });
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await card(page).screenshot({ path: path.join(output, 'materials-' + width + '.png') }); }
  await card(page).getByRole('button', { name: 'Registar revisão realizada' }).click(); await page.waitForFunction(() => document.getElementById('fieldEquipmentStatus').textContent.includes('Resultado incerto'));
  const pending = () => page.evaluate(() => CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE').then(rows => rows.length)); assert.equal(await pending(), 1); assert.equal(await prisma.equipmentMaintenanceCompletion.count({ where: { planId: uiPlan.id } }), 1);
  await open(page); assert.equal(await pending(), 1);
  // Reload may automatically retry the original request. Let that attempt finish
  // before injecting each distinct acknowledgement fault.
  await page.waitForFunction(() => [...document.querySelectorAll('#cwEquipmentSyncStatus button')].some(b => b.textContent === 'Repetir a mesma confirmação' && !b.disabled), null, { timeout: 30000 });
  for (const next of ['quantity', 'origin', 'lost']) { mode = next; const count = sent.length; const message = await page.evaluate(async () => { const [row] = await CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE'); try { await CWFieldWriteStore.send(row.requestId); } catch (error) { return error.message; } }); assert.match(message, next === 'lost' ? /fetch|Network|Load failed/i : /Os materiais da revisão/); assert(sent.length > count); assert.equal(await pending(), 1); }
  mode = 'success'; await page.getByRole('button', { name: 'Repetir a mesma confirmação' }).click(); await page.waitForFunction(() => CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE').then(rows => rows.length === 0));
  await card(page).getByText('Revisão já registada nesta visita.').waitFor(); assert.match(await card(page).textContent(), /aguardam o fecho/); assert.match(await card(page).textContent(), /CLORO · 0.2 KG/);
  assert(sent.length >= 5); for (const request of sent) assert.deepEqual(request, sent[0]); assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null);
  await page.evaluate(({ id, poolId }) => window.dispatchEvent(new CustomEvent('cw:field-visit-selected', { detail: { visitId: id, visitType: 'REGULAR', poolId, state: 'DONE' } })), { id: sameId, poolId: pool.id });
  const originalCard = page.locator('.field-equipment-plan').filter({ hasText: a.title });
  await originalCard.getByText('Quantidades compatíveis com o consumo líquido atual da visita.').waitFor(); assert.match(await originalCard.textContent(), /ainda sem parcela declarada 0/);
  await page.locator('.field-equipment-plan').filter({ hasText: c.title }).getByText('Sem materiais, por declaração explícita.').waitFor();
  await page.locator('.field-equipment-plan').filter({ hasText: d.title }).getByText('Materiais próprios não registados.').waitFor();
  await page.evaluate(() => { localStorage.setItem('token', 'other-account'); window.dispatchEvent(new Event('storage')); }); assert.equal(await page.locator('#fieldEquipmentMaintenance').isVisible(), false); assert.deepEqual(errors, []);
  assert.deepEqual(await stock(), beforeUIStock); assert.deepEqual(await finance(), beforeUIMoney); assert.deepEqual((await prisma.equipmentMaintenanceCompletion.findUniqueOrThrow({ where: { id: saved.id } })).result, receipt);
  console.log('PASS equipment material origins: optional/missing/explicit-none, canonical six-decimal quantities, shared sibling budget and current returns, typed equal-ID parents, real extra completion consumes once, original receipt/history and rollback, source changes fail closed, no duplicate stock or money, browser draft-only/reload/CAS and loss/damaged acknowledgement identical retry, responsive 320/390/1440 and account isolation');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); for (const child of children) child.kill('SIGTERM');
  if (pool) {
    await prisma.fieldWriteRequest.deleteMany({ where: { requestId: { in: requestIds }, owner: { in: ['TECH:' + tech?.id, 'ADMIN:' + admin?.id] } } });
    await prisma.equipmentMaintenanceCompletion.deleteMany({ where: { planId: { in: planIds } } }); await prisma.equipmentMaintenancePlan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.stockMovement.deleteMany({ where: { OR: [{ visitId: { in: visitIds } }, { extraVisitId: { in: extraIds } }] } }); await prisma.vehicleStockMovement.deleteMany({ where: { extraVisitId: { in: extraIds } } });
    await prisma.technicalHistory.deleteMany({ where: { poolId: pool.id } });
    await prisma.serviceVisit.deleteMany({ where: { id: { in: visitIds } } }); await prisma.extraVisit.deleteMany({ where: { id: { in: extraIds } } });
    if (guide) await prisma.workGuide.delete({ where: { id: guide.id } });
  }
  await prisma.$disconnect();
});
