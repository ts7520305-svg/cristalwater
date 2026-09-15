const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { civilDate, dayLisbon } = require('../../services/equipmentMaintenanceCalendar');
const KEY = 'EQUIPMENT_MAINTENANCE_NOTIFICATIONS_ENABLED';
const TYPE = 'EQUIPMENT_MAINTENANCE_DUE';
const BATCH = 500;
const terminal = new Set(['DONE','COMPLETED','CONCLUIDA','CONCLUÍDA','CONCLUIDO','CONCLUÍDO','CANCELLED','CANCELED','CANCELADA','CANCELADO','ARCHIVED','ARQUIVADA','ARQUIVADO','SKIPPED','CLOSED']);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function automaticChecksEnabled() { return process.env.ENABLE_BACKGROUND_JOBS === 'true' && process.env.NODE_ENV !== 'test' && process.env.QA_MODE !== 'true'; }
async function configuration(db = prisma) { return { ok: true, automaticChecksEnabled: automaticChecksEnabled(), enabled: (await db.systemSetting.findUnique({ where: { key: KEY } }))?.value === 'true' }; }
async function configure(user, enabled) {
  if (normalizeRole(user?.role) !== 'ADMIN') fail(403, 'Apenas a administração pode configurar os avisos');
  if (typeof enabled !== 'boolean') fail(400, 'Escolha ativar ou desativar os avisos');
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(93615004::bigint)`;
    await tx.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: String(enabled) }, update: { value: String(enabled) } });
    await tx.userAuditLog.create({ data: { actor: `${user.principalType || 'USER'}:${user.userId || user.id}`, action: 'EQUIPMENT_MAINTENANCE_NOTIFICATIONS_CONFIGURED', entity: 'SystemSetting', entityId: KEY, metadata: { enabled } } });
    if (!enabled) await tx.notification.updateMany({ where: { eventType: TYPE, status: { not: 'SUPERSEDED' } }, data: { status: 'SUPERSEDED' } });
    return { ok: true, enabled, automaticChecksEnabled: automaticChecksEnabled() };
  });
}
function visitCurrent(visit, today) {
  if (!visit || visit.endAt || terminal.has(String(visit.status).toUpperCase()) || !visit.technicianId || !visit.technician?.active || visit.technician.deletedAt) return false;
  const scheduled = visit.plannedDate || visit.date;
  return Boolean((scheduled && dayLisbon(new Date(scheduled)) === today) || (visit.startAt && dayLisbon(new Date(visit.startAt)) === today));
}
function planCurrent(plan, today) { return Boolean(plan && plan.active && plan.pool?.active && !plan.pool.deletedAt && plan.nextDue.toISOString().slice(0,10) <= today); }
function keyFor(plan, role, visit) { return `equipment:${plan.id}:${plan.version}:${role}${visit ? `:${visit.id}:${visit.technicianId}` : ''}`; }
async function current(notification, { db, now, enabled }) {
  if (!enabled || notification?.eventType !== TYPE || !['ADMIN','TECHNICIAN'].includes(notification.role)) return false;
  const meta = notification.metadata || {};
  if (!Number.isSafeInteger(meta.planId) || !Number.isSafeInteger(meta.planVersion)) return false;
  const plan = await db.equipmentMaintenancePlan.findUnique({ where: { id: meta.planId }, include: { pool: { select: { active: true, deletedAt: true } } } });
  const today = dayLisbon(now);
  if (!planCurrent(plan, today) || plan.version !== meta.planVersion) return false;
  if (notification.role === 'ADMIN') return meta.maintenanceKey === keyFor(plan, 'ADMIN');
  if (!Number.isSafeInteger(meta.visitId) || !Number.isSafeInteger(meta.technicianId)) return false;
  const visit = await db.serviceVisit.findUnique({ where: { id: meta.visitId }, include: { technician: { select: { active: true, deletedAt: true } } } });
  if (!visitCurrent(visit, today) || visit.poolId !== plan.poolId || visit.technicianId !== meta.technicianId || meta.maintenanceKey !== keyFor(plan, 'TECHNICIAN', visit)) return false;
  return !await db.equipmentMaintenanceCompletion.findUnique({ where: { planId_visitId: { planId: plan.id, visitId: visit.id } }, select: { id: true } });
}
async function isCurrentNotification(notification, { db = prisma, now = new Date() } = {}) {
  if (notification?.eventType !== TYPE) return true; // Only this module's notifications are filtered here.
  if (notification.status === 'SUPERSEDED') return false;
  return current(notification, { db, now, enabled: (await configuration(db)).enabled });
}
async function run({ now = new Date() } = {}) {
  const date = new Date(now); if (!Number.isFinite(+date)) fail(400, 'Data de avaliação inválida');
  return prisma.$transaction(async tx => {
    const lock = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(93615004::bigint) AS acquired`;
    if (!lock[0]?.acquired) return { ok: true, skipped: 'BUSY', created: 0, superseded: 0 };
    const enabled = (await configuration(tx)).enabled;
    const report = { ok: true, enabled, created: 0, reactivated: 0, superseded: 0, plansChecked: 0, batchSize: BATCH, ...(enabled ? {} : { skipped: 'CONFIG_DISABLED' }) };
    // Keyset pagination visits every still-visible maintenance notice, including already-read ones.
    let cursor = 0;
    while (true) {
      const rows = await tx.notification.findMany({ where: { eventType: TYPE, status: { not: 'SUPERSEDED' }, id: { gt: cursor } }, orderBy: { id: 'asc' }, take: BATCH });
      if (!rows.length) break;
      for (const row of rows) if (!await current(row, { db: tx, now: date, enabled })) {
        await tx.notification.update({ where: { id: row.id }, data: { status: 'SUPERSEDED' } }); report.superseded++;
      }
      cursor = rows[rows.length - 1].id;
    }
    if (!enabled) return report;
    const today = dayLisbon(date), dueDate = civilDate(today);
    async function ensure(plan, role, visit) {
      const maintenanceKey = keyFor(plan, role, visit);
      const existing = await tx.notification.findFirst({ where: { eventType: TYPE, metadata: { path: ['maintenanceKey'], equals: maintenanceKey } } });
      if (existing) {
        // A reverted reassignment/configuration reuses the same row and preserves read state/push counters.
        if (existing.status === 'SUPERSEDED' && !existing.isRead) { await tx.notification.update({ where: { id: existing.id }, data: { status: 'PENDING' } }); report.reactivated++; }
        return;
      }
      await tx.notification.create({ data: { eventType: TYPE, type: TYPE, role, title: 'Manutenção preventiva por realizar',
        message: `${plan.title} — ${plan.pool.name || 'Piscina'}. Prazo: ${plan.nextDue.toISOString().slice(0,10)}. Consulte as instruções antes de executar.`,
        severity: 'WARNING', status: 'PENDING', metadata: { planId: plan.id, planVersion: plan.version, poolId: plan.poolId, maintenanceKey, dueDate: plan.nextDue.toISOString().slice(0,10),
          ...(visit ? { visitId: visit.id, technicianId: visit.technicianId, href: '/technician-field-mode' } : { href: '/admin-operational-settings#equipmentMaintenancePanel' }) } } });
      report.created++;
    }
    cursor = 0;
    while (true) {
      const plans = await tx.equipmentMaintenancePlan.findMany({ where: { id: { gt: cursor }, active: true, nextDue: { lte: dueDate }, pool: { active: true, deletedAt: null } }, include: { pool: { select: { name: true } } }, orderBy: { id: 'asc' }, take: BATCH });
      if (!plans.length) break;
      for (const plan of plans) {
        report.plansChecked++; await ensure(plan, 'ADMIN');
        // Filter canonical visit day in Lisbon below; this broad range also includes ongoing visits begun today.
        const lower = new Date(+date - 2 * 86400000), upper = new Date(+date + 2 * 86400000);
        const visits = await tx.serviceVisit.findMany({ where: { poolId: plan.poolId, endAt: null, technicianId: { not: null }, OR: [{ plannedDate: { gte: lower, lte: upper } }, { date: { gte: lower, lte: upper } }, { startAt: { gte: lower, lte: upper } }] }, include: { technician: { select: { active: true, deletedAt: true } } } });
        for (const visit of visits) if (visitCurrent(visit, today) && !await tx.equipmentMaintenanceCompletion.findUnique({ where: { planId_visitId: { planId: plan.id, visitId: visit.id } }, select: { id: true } })) await ensure(plan, 'TECHNICIAN', visit);
      }
      cursor = plans[plans.length - 1].id;
    }
    return report;
  }, { timeout: 30000, maxWait: 5000 });
}
module.exports = { KEY, TYPE, configuration, configure, run, reconcile: run, isCurrentNotification };
