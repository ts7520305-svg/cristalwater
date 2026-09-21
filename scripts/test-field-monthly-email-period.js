'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { reportMonth } = require('../src/services/monthlyReportMonth');
const { prepareMonthlyReportEmails, sendMonthlyReportEmails } = require('../src/services/reportEmailService');
const { sendMonthlyReports } = require('../src/services/monthlyReportEmailService');
const { generate: generateClient } = require('../src/business/client/ClientMonthlyReportBusiness');
const email = require('../src/services/emailService'), integrations = require('../src/config/externalIntegrations');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with email disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const stamp = 'monthly-' + randomUUID(), month = '2002-02';
let rule, oldRules = [], originalEmail = email.sendEmail, originalFlags = [integrations.isEmailEnabled, integrations.areExternalNotificationsEnabled];
(async () => {
  for (const [now, expected] of [['2026-01-01T00:00:00Z', '2025-12'], ['2024-03-01T00:00:00Z', '2024-02'], ['2026-03-31T23:30:00-02:00', '2026-03']]) assert.equal(reportMonth(undefined, { now: new Date(now) }), expected);
  assert.equal(reportMonth('2024-02'), '2024-02');
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: 'Bearer ' + jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret()), 'Content-Type': 'application/json' };
  async function api(body, custom = headers) {
    const r = await fetch(base + '/api/admin/reports/prepare', { method: 'POST', headers: custom, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') };
  }
  const beforeInvalid = await prisma.monthlyReport.count();
  for (const body of [{}, [], { monthRef: null }, { monthRef: 202602 }, { monthRef: ['2026-02'] }, { monthRef: '2026-2' }, { monthRef: '2026-00' }, { monthRef: '2026-13' }, { monthRef: '1999-12' }, { monthRef: '2200-01' }, { monthRef: month, month: '2026-01' }]) assert.equal((await api(body)).status, 400, JSON.stringify(body));
  assert.equal(await prisma.monthlyReport.count(), beforeInvalid);
  await assert.rejects(sendMonthlyReports({ manual: true }), /Escolha/);
  assert.equal((await api({ monthRef: month }, { 'Content-Type': 'application/json' })).status, 401);

  oldRules = await prisma.notificationRule.findMany({ where: { eventType: 'MONTHLY_REPORT' }, select: { id: true, active: true } });
  await prisma.notificationRule.updateMany({ where: { eventType: 'MONTHLY_REPORT' }, data: { active: false } });
  rule = await prisma.notificationRule.create({ data: { eventType: 'MONTHLY_REPORT', channels: 'EMAIL', roles: 'ADMIN,CLIENT', defaultEmail: true, active: true, config: { adminReportEmail: 'admin-' + stamp + '@qa.invalid' } } });
  const clients = [];
  for (let i = 0; i < 3; i++) clients.push(await prisma.client.create({ data: { name: 'Guardado ' + stamp + i, email: `client-${i}-${stamp}@qa.invalid`, status: 'ACTIVE', active: true } }));
  const clientToken = jwt.sign({ id: clients[0].id, clientId: clients[0].id, role: 'CLIENT' }, getJwtSecret());
  assert.equal((await api({ monthRef: month }, { ...headers, Authorization: 'Bearer ' + clientToken })).status, 403);
  const reports = [];
  for (const c of clients) reports.push(await generateClient(c.id, month));
  const previousMonth = await prisma.monthlyReport.create({ data: { clientId: clients[0].id, month: '2002-01', type: 'CLIENT', data: { client: 'WRONG-MONTH', pools: [] } } });
  await prisma.client.update({ where: { id: clients[0].id }, data: { name: 'Current name differs from saved report' } });
  const noEmail = await prisma.client.create({ data: { name: stamp + ' missing email', active: true } });
  await generateClient(noEmail.id, month);
  const mismatchClient = await prisma.client.create({ data: { name: stamp + ' wrong period', email: 'mismatch-' + stamp + '@qa.invalid', active: true } });
  await prisma.monthlyReport.create({ data: { month, clientId: mismatchClient.id, type: 'CLIENT', data: { ...reports[0].data, clientId: mismatchClient.id, period: { start: '2002-01-01T00:00:00.000Z', end: '2002-02-01T00:00:00.000Z', timeZone: 'UTC' } } } });
  const ownIds = [...reports.map(r => r.id), previousMonth.id];
  const snapshot = () => prisma.monthlyReport.findMany({ where: { id: { in: ownIds } }, orderBy: { id: 'asc' } });
  const saved = await snapshot(), logsBefore = await prisma.emailLog.count();
  const generated = await api({ monthRef: month });
  assert.equal(generated.status, 200, JSON.stringify(generated.body)); assert.equal(generated.body.monthRef, month); assert.equal(generated.body.sent, 0); assert.equal(generated.body.prepared, true); assert.equal(generated.body.deliveryConfirmed, false); assert.match(generated.cache, /private.*no-store/);
  assert.deepEqual(await snapshot(), saved); assert.equal(await prisma.emailLog.count(), logsBefore);
  const disabled = await sendMonthlyReportEmails({ monthRef: month });
  assert.equal(disabled.blocked, 'EMAIL_DISABLED'); assert.equal(disabled.sent, 0);
  await require('../src/services/reportService').generateAdminMonthlyReport(month);
  const plan = await prepareMonthlyReportEmails({ monthRef: month, manual: true });
  const selected = plan.messages.filter(m => reports.some(r => r.id === m.reportId));
  assert.equal(selected.length, 3);
  assert(plan.messages.every(m => m.payload.subject.endsWith(month) && !m.payload.text.includes('WRONG-MONTH')));
  assert.match(selected[0].payload.text, new RegExp('Guardado ' + stamp)); assert(!selected[0].payload.text.includes('Current name'));
  assert(plan.skipped.some(r => r.clientId === noEmail.id && r.reason === 'RECIPIENT_MISSING_OR_INVALID'));
  assert(plan.skipped.some(r => r.clientId === mismatchClient.id && r.reason === 'REPORT_PERIOD_MISMATCH'));
  const adminReport = await prisma.monthlyReport.findFirstOrThrow({ where: { month, type: 'ADMIN' } });
  assert(plan.messages.some(m => m.reportId === adminReport.id));
  await prisma.notificationRule.update({ where: { id: rule.id }, data: { config: {} } });
  const noAdmin = await prepareMonthlyReportEmails({ monthRef: month });
  assert(noAdmin.skipped.some(m => m.reportId === adminReport.id && m.reason === 'RECIPIENT_MISSING_OR_INVALID'));
  console.log('PASS explicit month and UTC rollover, invalid requests without writes, real ADMIN route, preserved snapshots, exact query/subject/content and disabled emails without false sent counts');

  // Transport simulation is confined to this process and synthetic addresses.
  // The HTTP server continues running with all external integrations disabled.
  const calls = [];
  integrations.isEmailEnabled = integrations.areExternalNotificationsEnabled = () => true;
  email.sendEmail = async payload => {
    assert(payload.to.endsWith('@qa.invalid')); calls.push(payload);
    if (payload.to === clients[0].email) return { accepted: [payload.to], rejected: [] };
    if (payload.to === clients[1].email) return { accepted: [], rejected: [payload.to] };
    throw Error('QA provider response lost');
  };
  // Limit simulated dispatch to the three known recipient fixtures, preserving
  // every other rule and report used by the integration suite.
  const actualPrepareClients = await prisma.client.findMany({ where: { reports: { some: { month, type: 'CLIENT' } }, id: { notIn: clients.map(c => c.id) } }, select: { id: true, active: true } });
  await prisma.client.updateMany({ where: { id: { in: actualPrepareClients.map(c => c.id) } }, data: { active: false } });
  try {
    const result = await sendMonthlyReports({ monthRef: month });
    assert.equal(result.sent, 1); assert.equal(result.failed, 1); assert.equal(result.uncertain, 1); assert.equal(result.deliveryConfirmed, false); assert.equal(calls.length, 3);
    const logs = await prisma.emailLog.findMany({ where: { to: { in: clients.map(c => c.email) }, eventType: 'MONTHLY_REPORT' }, orderBy: { id: 'asc' } });
    assert.deepEqual(logs.map(l => l.status), ['SENT', 'FAILED', 'UNKNOWN']);
    assert(logs.every(l => l.subject.endsWith(month) && l.text.includes('Mês: ' + month) && l.mode === 'AUTOMATIC'));
    assert.deepEqual(await snapshot(), saved);
    // The next integration group exercises atomic reservation/result failures.
    const repeat = await sendMonthlyReports({ monthRef: month });
    assert.equal(repeat.sent, 0); assert.equal(repeat.replayed, 3); assert.equal(calls.length, 3);
    await assert.rejects(sendMonthlyReports({ monthRef: month, manual: true }), error => error.code === 'REVIEW_REQUIRED');
    await prisma.notificationRule.update({ where: { id: rule.id }, data: { roles: 'ADMIN' } });
    const beforeCalls = calls.length, adminOnly = await sendMonthlyReports({ monthRef: month });
    assert.equal(adminOnly.sent, 0); assert.equal(calls.length, beforeCalls);
    await prisma.notificationRule.update({ where: { id: rule.id }, data: { defaultEmail: false } });
    assert.equal((await sendMonthlyReportEmails({ monthRef: month })).blocked, 'RULE_DISABLED');
  } finally { for (const c of actualPrepareClients) await prisma.client.update({ where: { id: c.id }, data: { active: c.active } }); }
  console.log('PASS shared client-only entry point, explicit recipient configuration, provider acceptance/rejection/unknown outcomes, saved content and durable repeat protection; zero real emails');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  email.sendEmail = originalEmail; [integrations.isEmailEnabled, integrations.areExternalNotificationsEnabled] = originalFlags;
  if (rule) await prisma.notificationRule.delete({ where: { id: rule.id } });
  for (const old of oldRules) await prisma.notificationRule.update({ where: { id: old.id }, data: { active: old.active } });
  await prisma.$disconnect();
});
