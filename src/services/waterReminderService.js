const { prisma } = require('../prismaClient');
const { normalizeRole } = require('../utils/roles');
const { sendPush } = require('./pushService');
const { randomUUID } = require('crypto');

function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
const privileged = user => ['ADMIN', 'TEAM_LEADER'].includes(normalizeRole(user?.role));
const techId = user => Number(user?.technicianId || user?.id || 0);
const isWater = row => row && (row.sourceKey?.startsWith('water:') || row.sourceKey?.startsWith('pump:') || /^Agua aberta - /i.test(row.title));
const kindFor = row => row?.sourceKey?.startsWith('pump:') ? 'PUMP_MANUAL' : 'WATER_OPEN';
const labelFor = row => kindFor(row)==='PUMP_MANUAL' ? 'Bomba em manual' : 'Água aberta';
function authorize(user, row) {
  if (!isWater(row)) fail(404, 'Lembrete de água não encontrado');
  if (!privileged(user) && row.assignedToTechnicianId !== techId(user)) fail(403, 'Lembrete de outro técnico');
}
async function contextForVisit(tx, user, body) {
  const id = Number(body.visitId);
  if (!Number.isSafeInteger(id) || id <= 0) fail(400, 'Indique a visita associada à água');
  const visit = await tx.serviceVisit.findUnique({ where: { id }, include: { pool: true, client: true, technician: true } });
  if (!visit) fail(404, 'Visita não encontrada');
  if (!privileged(user) && visit.technicianId !== techId(user)) fail(403, 'Visita de outro técnico');
  if (!visit.poolId) fail(400, 'Visita sem piscina');
  for (const field of ['poolId', 'clientId', 'technicianId']) {
    if (body[field] && Number(body[field]) !== Number(visit[field] || (field === 'clientId' ? visit.pool?.clientId : 0))) fail(400, 'Contexto da visita inválido');
  }
  return visit;
}
function dueDateFor(body) {
  let due = body.dueAt ? new Date(body.dueAt) : null;
  const minutes = Number(body.minutes || body.delayMinutes || body.afterMinutes || body.closeInMinutes);
  if (!due && minutes > 0 && minutes <= 1440) due = new Date(Date.now() + minutes * 60000);
  if (!due && /^\d{1,2}:\d{2}$/.test(body.time || '')) {
    const [h, m] = body.time.split(':').map(Number);
    if (h < 24 && m < 60) { due = new Date(); due.setHours(h, m, 0, 0); if (due <= new Date()) due.setDate(due.getDate() + 1); }
  }
  // Past dates must be accepted for a reminder first uploaded after an offline period.
  if (!due || !Number.isFinite(due.getTime()) || due > new Date(Date.now() + 86400000)) fail(400, 'Indique um prazo válido, até 24 horas');
  return due;
}
async function trace(tx, reminder, status) {
  const meta = reminder.metadata || {};
  const line = `[${labelFor(reminder)} ${status}] ${new Date().toISOString()} - ${reminder.title}`;
  if (meta.visitId) {
    const visit = await tx.serviceVisit.findUnique({ where: { id: meta.visitId }, select: { internalNotes: true } });
    if (visit) await tx.serviceVisit.update({ where: { id: meta.visitId }, data: { internalNotes: [visit.internalNotes, line].filter(Boolean).join('\n').slice(-6000) } });
  }
  if (reminder.poolId) await tx.technicalHistory.create({ data: { poolId: reminder.poolId, type: kindFor(reminder), component: labelFor(reminder), message: status, description: line, performedAt: new Date(), status, nextSuggested: status === 'CLOSED' ? null : reminder.dueDate } });
}
async function notify(tx, reminder, eventType, role) {
  return tx.notification.create({ data: {
    clientId: reminder.clientId, role, type: kindFor(reminder), eventType,
    title: `${labelFor(reminder)} — ${eventType.endsWith('_OVERDUE') ? 'confirmar agora' : 'lembrete registado'}`,
    message: `${reminder.title}. ${kindFor(reminder)==='PUMP_MANUAL' ? 'Verificar e confirmar o regresso da bomba a automático.' : 'Verificar e confirmar o fecho da torneira.'}`,
    severity: eventType.endsWith('_OVERDUE') ? 'CRITICAL' : 'WARNING', status: 'PENDING',
    metadata: { ...reminder.metadata, reminderId: reminder.id, poolId: reminder.poolId, technicianId: reminder.assignedToTechnicianId, dueAt: reminder.dueDate.toISOString(), href: role === 'ADMIN' ? '/admin-alerts?origin=water-open' : '/technician-field-mode' }
  } });
}
async function create(user, body = {}, kind = "WATER_OPEN") {
  const pump=kind==='PUMP_MANUAL';
  const dueDate = dueDateFor(body);
  const visit = await contextForVisit(prisma, user, body);
  const localId = String(body.localId || randomUUID()).slice(0, 160);
  const sourceKey = `${pump ? 'pump' : 'water'}:${visit.technicianId || 'admin'}:${localId}`;
  const result = await prisma.$transaction(async tx => {
    // A transaction lock also protects the absence of a row during concurrent retries.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    const existing = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (existing) {
      authorize(user, existing);
      if (existing.metadata?.visitId !== visit.id) fail(409, 'Identificador já usado noutra visita');
      return { reminder: existing, idempotent: true };
    }
    const reminder = await tx.operationalReminder.create({ data: {
      title: `${pump ? 'Bomba manual' : 'Agua aberta'} - ${visit.pool?.name || 'Piscina'}`, description: String(body.note || '').slice(0, 4000), dueDate,
      clientId: visit.clientId || visit.pool?.clientId, poolId: visit.poolId, assignedToTechnicianId: visit.technicianId,
      sourceKey, metadata: { kind, technicianName: visit.technician?.name || '', localId, visitId: visit.id, poolName: visit.pool?.name || '', clientName: visit.client?.name || '', flowState: ['DRIP','HALF','FULL'].includes(body.flowState) ? body.flowState : 'FULL', openedAt: body.openedAt && Number.isFinite(Date.parse(body.openedAt)) ? new Date(body.openedAt).toISOString() : new Date().toISOString() }
    } });
    await trace(tx, reminder, 'OPEN');
    return { reminder, notification: await notify(tx, reminder, `${kind}_CREATED`, 'ADMIN') };
  });
  return { ok: true, ...result };
}
async function transition(user, value, action, { automatic = false, now = new Date() } = {}) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail(404, 'Lembrete de água não encontrado');
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "OperationalReminder" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.operationalReminder.findUnique({ where: { id } });
    authorize(user, current);
    const meta = current.metadata || {};
    if (action === 'close') {
      if (current.isCompleted) return { reminder: current, idempotent: true };
      const reminder = await tx.operationalReminder.update({ where: { id }, data: { isCompleted: true, metadata: { ...meta, closedAt: now.toISOString() } } });
      if (meta.alertId) await tx.technicalAlert.updateMany({ where: { id: meta.alertId, poolId: reminder.poolId, type: kindFor(current)==='PUMP_MANUAL'?'BOMBA_MANUAL':'AGUA_ABERTA' }, data: { status: 'RESOLVED', resolvedAt: now } });
      await tx.notification.updateMany({ where: { eventType: `${kindFor(current)}_OVERDUE`, metadata: { path: ['reminderId'], equals: id } }, data: { status: 'RESOLVED' } });
      await trace(tx, reminder, 'CLOSED');
      return { reminder };
    }
    if (current.isCompleted || meta.alarmedAt || (automatic && current.dueDate > now)) return { reminder: current, idempotent: true };
    const alert = await tx.technicalAlert.create({ data: { poolId: current.poolId, type: kindFor(current)==='PUMP_MANUAL'?'BOMBA_MANUAL':'AGUA_ABERTA', message: `${labelFor(current)} por confirmar: ${current.title}`, priority: 'CRITICAL', status: 'OPEN' } });
    const reminder = await tx.operationalReminder.update({ where: { id }, data: { metadata: { ...meta, alarmedAt: now.toISOString(), alertId: alert.id } } });
    await trace(tx, reminder, 'OVERDUE');
    const notifications = [];
    for (const role of ['ADMIN', 'TECHNICIAN']) notifications.push(await notify(tx, reminder, `${kindFor(reminder)}_OVERDUE`, role));
    return { reminder, alert, notifications };
  });
  // Durable notification rows are committed before any external delivery is attempted.
  return { ok: true, ...result };
}
async function list(user, kind = "WATER_OPEN") {
  const where = kind==='PUMP_MANUAL' ? {sourceKey:{startsWith:'pump:'}} : { OR: [{ sourceKey: { startsWith: 'water:' } }, { title: { startsWith: 'Agua aberta - ' } }] };
  if (!privileged(user)) where.assignedToTechnicianId = techId(user);
  const [active, closed] = await Promise.all([
    prisma.operationalReminder.findMany({ where: { ...where, isCompleted: false }, orderBy: { dueDate: 'asc' } }),
    prisma.operationalReminder.findMany({ where: { ...where, isCompleted: true }, orderBy: { updatedAt: 'desc' }, take: 100 })
  ]);
  return { ok: true, reminders: [...active, ...closed] };
}
let processing = false;
async function processOverdue(now = new Date()) {
  if (processing) return { skipped: true };
  processing = true;
  try {
    const pending = await prisma.operationalReminder.findMany({ where: { isCompleted: false, dueDate: { lte: now }, OR: [{ sourceKey: { startsWith: 'water:' } }, {sourceKey:{startsWith:'pump:'}}, { title: { startsWith: 'Agua aberta - ' } }] }, orderBy: { dueDate: 'asc' } });
    let escalated = 0;
    for (const row of pending) {
      if (!row.poolId || row.metadata?.alarmedAt) continue;
      await transition({ role: 'ADMIN' }, row.id, 'alarm', { automatic: true, now }); escalated++;
    }
    // Admin push only: legacy DeviceToken has no technician identity. Never broadcast client details to every technician.
    const notifications = await prisma.notification.findMany({ where: { eventType: {in:['WATER_OPEN_OVERDUE','PUMP_MANUAL_OVERDUE']}, role: 'ADMIN', status: 'PENDING' }, take: 100 });
    const tokens = notifications.length ? await prisma.deviceToken.findMany({ where: { role: 'ADMIN', active: true } }) : [];
    for (const notification of notifications) {
      const deliveries = await Promise.all(tokens.map(t => sendPush(t.token, notification.title, notification.message, { notificationId: notification.id, href: '/admin-alerts?origin=water-open' })));
      if (deliveries.length && deliveries.every(d => d.ok)) await prisma.notification.update({ where: { id: notification.id }, data: { status: 'SENT' } });
    }
    await require('./browserPushService').deliverWaterNotifications();
    return { escalated };
  } finally { processing = false; }
}
function startScheduler() {
  // Field safety monitoring is independent of optional billing/AI jobs.
  if (process.env.NODE_ENV === 'test' || process.env.QA_MODE === 'true') return null;
  const run = () => processOverdue().catch(e => console.error('WATER_REMINDER_JOB_ERROR', e.message));
  run(); const timer = setInterval(run, 60000); timer.unref(); return timer;
}
module.exports = { create, transition, list, processOverdue, startScheduler };
