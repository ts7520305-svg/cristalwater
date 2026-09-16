'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
let browser;
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const client = await prisma.client.create({ data: { name: 'Briefing QA', active: true, email: 'private-briefing@qa.test', phone: 'PRIVATE-PHONE' } });
  const a = await prisma.technician.create({ data: { name: 'Briefing A', active: true } });
  const b = await prisma.technician.create({ data: { name: 'Briefing B', active: true } });
  const p = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina A', notes: 'Fechar o portão.\nNão mexer na válvula marcada.', monthlyAmount: 987 } });
  const p2 = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina B', notes: 'Entrada pelo jardim.' } });
  const now = new Date();
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: p.id, technicianId: a.id, status: 'PLANNED', plannedDate: now, date: now } });
  const visit2 = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: p2.id, technicianId: a.id, status: 'PLANNED', plannedDate: now, date: now } });
  const extra = await prisma.extraVisit.create({ data: { clientId: client.id, poolId: p.id, technicianId: a.id, scheduledAt: now, status: 'PLANNED', notes: 'Briefing QA' } });
  const general = values => prisma.generalReminder.create({ data: { title: 'Lembrete QA', dueAt: now, clientId: client.id, ...values } });
  const operation = values => prisma.operationalReminder.create({ data: { title: 'Operação QA', dueDate: now, clientId: client.id, ...values } });
  const shared = await general({ title: 'Cliente inteiro' });
  const own = await general({ poolId: p.id, technicianId: a.id, title: 'Só técnico A' });
  const foreign = await general({ poolId: p.id, technicianId: b.id, title: 'Só técnico B' });
  const otherPool = await operation({ poolId: p2.id, title: 'Só piscina B' });
  const foreignOperation = await operation({ poolId: p.id, assignedToTechnicianId: b.id, title: 'Operação do técnico B' });
  const closed = await general({ poolId: p.id, status: 'DONE', completedAt: now });
  const completedWithOldStatus = await general({ poolId: p.id, completedAt: now });
  await prisma.generalReminder.createMany({ data: Array.from({ length: 505 }, (_, i) => ({ title: `Briefing lote ${i}`, poolId: p.id, clientId: client.id, dueAt: now, status: 'PENDING' })) });
  await prisma.operationalReminder.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ title: `Operação lote ${i}`, poolId: p.id, clientId: client.id, dueDate: now })) });
  const sign = (tech, role = 'TECHNICIAN') => jwt.sign({ id: tech.id, technicianId: tech.id, role }, getJwtSecret(), { expiresIn: '1h' });
  async function read(tech, role) {
    const r = await fetch(base + '/api/technician/today', { headers: { Authorization: `Bearer ${sign(tech, role)}` } });
    const body = await r.json(); assert.equal(r.status, 200, JSON.stringify(body)); return body.visits;
  }
  for (const role of ['TECHNICIAN', 'TEAM_LEADER']) {
    await prisma.technician.update({ where: { id: a.id }, data: { role } });
    const rows = await read(a, role);
    for (const [id, type] of [[visit.id, 'REGULAR'], [extra.id, 'EXTRA']]) {
      const row = rows.find(v => v.id === id && v.visitType === type); assert(row, `${type} visible`);
      assert.equal(row.pool.notes, p.notes, 'Pool instructions must reach the field briefing');
      assert(row.pool.generalReminders.some(r => r.id === own.id));
      assert(!row.pool.generalReminders.some(r => [foreign.id, closed.id, completedWithOldStatus.id].includes(r.id)));
      assert.equal(row.pool.generalReminders.filter(r => r.title.startsWith('Briefing lote ')).length, 505);
      assert.equal(row.pool.operationalReminders.filter(r => r.title.startsWith('Operação lote ')).length, 23);
      assert(!row.pool.operationalReminders.some(r => r.id === foreignOperation.id));
      assert.deepEqual(row.client.generalReminders.map(r => r.id), [shared.id]);
      assert(!row.client.operationalReminders.some(r => r.id === otherPool.id));
      assert(!JSON.stringify(row).includes('private-briefing@qa.test')); assert(!JSON.stringify(row).includes('PRIVATE-PHONE'));
      assert(!Object.hasOwn(row.pool, 'monthlyAmount'));
    }
    const second = rows.find(v => v.id === visit2.id && v.visitType === 'REGULAR');
    assert.equal(second.pool.notes, p2.notes); assert(second.pool.operationalReminders.some(r => r.id === otherPool.id));
    assert.equal(second.pool.generalReminders.length, 0);
  }
  await prisma.technician.update({ where: { id: a.id }, data: { role: 'TECHNICIAN' } });
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { technicianId: b.id } });
  assert(!(await read(a)).some(v => v.visitType === 'REGULAR' && v.id === visit.id));
  const reassigned = (await read(b)).find(v => v.visitType === 'REGULAR' && v.id === visit.id);
  assert(reassigned.pool.generalReminders.some(r => r.id === foreign.id)); assert(!reassigned.pool.generalReminders.some(r => r.id === own.id));
  assert(reassigned.pool.operationalReminders.some(r => r.id === foreignOperation.id));
  assert.equal(await prisma.generalReminder.count({ where: { poolId: p.id } }), 509, 'Reading must not complete or delete instructions');
  console.log('PASS regular/extra briefing, pool notes, exact pool/client and technician scope, 505 general + 23 operational notices, closed exclusion, team leader, reassignment and read-only history');

  const { chromium } = require('playwright'), fs = require('node:fs'), path = require('node:path');
  const stamp = Date.now(), output = path.resolve(__dirname, '../reports/field-visual/visit-briefing-' + stamp);
  fs.mkdirSync(output, { recursive: true });
  const vehicle = await prisma.vehicle.create({ data: { plate: `BRIEF-${stamp}`, active: true } });
  const field = await prisma.technician.create({ data: { name: 'Técnico das instruções', active: true, vehicleId: vehicle.id } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 30 * 86400000) } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: `BRIEF-${stamp}`, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: field.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  const fieldClient = await prisma.client.create({ data: { name: 'Quinta da Luz', active: true } });
  const longNotes = 'Fechar o portão à entrada e à saída.\n' + 'Verificar os cestos e a linha de água. '.repeat(28) + '\nÚLTIMA INSTRUÇÃO: <img src=x onerror=alert(1)> Não tocar na válvula marcada.';
  const fieldPool = await prisma.pool.create({ data: { clientId: fieldClient.id, name: 'Piscina do jardim', notes: longNotes, active: true } });
  const fieldVisit = await prisma.serviceVisit.create({ data: { clientId: fieldClient.id, poolId: fieldPool.id, technicianId: field.id, plannedDate: now, date: now, status: 'PLANNED' } });
  const past = new Date(Date.now() - 86400000), future = new Date(Date.now() + 86400000);
  await prisma.generalReminder.createMany({ data: [
    { title: 'Limpar o pré-filtro', poolId: fieldPool.id, dueAt: past, repeatRule: 'WEEKLY', status: 'PENDING' },
    { title: 'Aviso permanente no título', poolId: fieldPool.id, dueAt: past, repeatRule: 'NONE', status: 'PENDING' },
    { title: 'Registar fotografia da cobertura', poolId: fieldPool.id, dueAt: future, repeatRule: 'NONE', status: 'PENDING' },
    { title: 'Aviso já concluído', poolId: fieldPool.id, dueAt: past, status: 'DONE', completedAt: now },
  ] });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const token = sign(field);
  await context.addInitScript(({ token, id }) => {
    localStorage.setItem('cristalwater_jwt', token); localStorage.setItem('token', token);
    const user = JSON.stringify({ id, technicianId: id, role: 'TECHNICIAN', name: 'Técnico das instruções' });
    localStorage.setItem('cristalwater_user', user); localStorage.setItem('user', user); localStorage.setItem('cwTechnicianId', String(id));
  }, { token, id: field.id });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' });
  await page.locator('[data-field-tab-button=agora]').click();
  await page.locator('#accessList [data-pool-notes]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('[data-pool-notes] .access-meta').textContent(), longNotes);
  assert.equal(await page.locator('[data-pool-notes] img').count(), 0);
  const recurring = page.locator('#accessList .access-item').filter({ hasText: 'Limpar o pré-filtro' });
  assert.match(await recurring.textContent(), /Lembrete recorrente atrasado/);
  assert.match(await page.locator('#accessList .access-item').filter({ hasText: 'Aviso permanente no título' }).textContent(), /Lembrete atrasado/);
  assert.match(await page.locator('#accessList .access-item').filter({ hasText: 'Registar fotografia' }).textContent(), /Lembrete pontual/);
  assert(!(await page.locator('#accessList').textContent()).includes('Aviso já concluído'));
  await page.locator('#startBtn').click(); await page.getByRole('dialog', { name: 'Check-in da visita' }).waitFor();
  assert((await page.locator('#cwFieldCheckinNotices').textContent()).includes('ÚLTIMA INSTRUÇÃO:'));
  assert.equal((await prisma.serviceVisit.findUnique({ where: { id: fieldVisit.id } })).startAt, null);
  await page.locator('#cwFieldCheckinCancel').click();
  assert.equal((await prisma.serviceVisit.findUnique({ where: { id: fieldVisit.id } })).startAt, null);
  await page.locator('#startBtn').click(); await page.locator('#cwFieldCheckinConfirm').click();
  await page.waitForFunction(name => document.querySelector('#toast').textContent.includes(name + ': início confirmado.'), fieldPool.name);
  assert((await prisma.serviceVisit.findUnique({ where: { id: fieldVisit.id } })).startAt);
  const concise = 'Fechar o portão à entrada e à saída.\nNão mexer na válvula marcada a vermelho.\nRegistar uma fotografia da cobertura no fim da visita.';
  await prisma.pool.update({ where: { id: fieldPool.id }, data: { notes: concise } });
  await prisma.generalReminder.updateMany({ where: { poolId: fieldPool.id, title: 'Aviso permanente no título' }, data: { title: 'Verificar a porta da casa técnica' } });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-field-tab-button=agora]').click();
  assert.equal(await page.locator('[data-pool-notes] .access-meta').textContent(), concise);
  for (const [language, startLabel, noteLabel, overdueLabel] of [
    ['en', 'Start visit', 'Pool notes', 'Overdue recurring reminder'],
    ['fr', 'Commencer la visite', 'Consignes de la piscine', 'Rappel récurrent en retard'],
    ['es', 'Iniciar visita', 'Notas de la piscina', 'Recordatorio recurrente vencido'],
    ['de', 'Besuch starten', 'Poolhinweise', 'Überfällige wiederkehrende Erinnerung'],
  ]) {
    await page.evaluate(language => CristalI18n.applyLanguage(language), language);
    await page.locator('#startBtn').filter({ hasText: startLabel }).waitFor();
    assert.equal(await page.locator('[data-pool-notes] .chip').textContent(), noteLabel);
    assert((await recurring.textContent()).includes(overdueLabel));
    assert.equal(await page.locator('[data-pool-notes] .access-meta').textContent(), concise);
    await page.locator('#startBtn').click(); await page.getByRole('dialog', { name: 'Check-in da visita' }).waitFor();
    assert((await page.locator('#cwFieldCheckinNotices').textContent()).includes(concise));
    await page.locator('#cwFieldCheckinCancel').click();
  }
  await page.evaluate(() => CristalI18n.applyLanguage('pt'));
  await page.locator('#startBtn').click(); await page.getByRole('dialog', { name: 'Check-in da visita' }).waitFor();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.locator('#cwFieldCheckinNotices').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    if (width === 390) await page.screenshot({ path: path.join(output, 'technician-briefing-mobile.png') });
  }
  await page.locator('#cwFieldCheckinCancel').click();
  assert.deepEqual(errors, []);
  console.log('PASS real field notes, recurring overdue warning, literal text, full check-in, cancellation, explicit persisted start, refresh, PT/EN/FR/ES/DE and responsive review');
  console.log('Visual evidence: ' + output);
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
