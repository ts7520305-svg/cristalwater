'use strict';
const { prisma } = require('../prismaClient');
const { createHash } = require('node:crypto');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const { reportMonth } = require('./monthlyReportMonth');

const tokens = value => new Set(String(value || '').toUpperCase().split(/[^A-Z_]+/).filter(Boolean));
const singleEmail = value => typeof value === 'string' && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0 ? String(value) : 'Não indicado';

function textFor(report) {
  const data = report.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (report.type === 'CLIENT') {
    if (!Array.isArray(data.pools) || (data.clientId !== undefined && data.clientId !== report.clientId)) return null;
    return [
      'Cristal Water — Relatório mensal', 'Mês: ' + report.month,
      'Cliente: ' + (typeof data.client === 'string' ? data.client : 'Cliente #' + report.clientId),
      'Estado de pagamento no relatório: ' + (typeof data.paymentStatus === 'string' ? data.paymentStatus : 'Não indicado'), '',
      ...data.pools.flatMap(pool => [
        'Piscina: ' + (typeof pool?.name === 'string' ? pool.name : 'Não indicada'),
        'Visitas realizadas: ' + count(pool?.totalVisits), 'Não realizadas: ' + count(pool?.notDone),
        ...(data.reportVersion === 2 ? ['Por confirmar: ' + count(pool?.unconfirmed)] : []), '',
      ]),
      'Conteúdo do relatório guardado. Os dados não são recalculados no envio.',
      ...(data.reviewRequired ? ['Existem registos por confirmar neste relatório.'] : []),
    ].join('\n');
  }
  if (report.type === 'ADMIN') return [
    'Cristal Water — Relatório administrativo guardado', 'Referência: ' + report.month,
    'Este registo histórico não confirma um fecho mensal; os agregados administrativos antigos precisam de revisão.',
    ...[['Clientes ativos', 'totalClients'], ['Piscinas ativas', 'totalPools'], ['Visitas realizadas', 'visitsDone'], ['Visitas não realizadas', 'visitsNotDone'], ['Clientes em atraso', 'overdueClients']].map(([label, key]) => label + ': ' + count(data[key])),
  ].join('\n');
  return null;
}

// Read-only selection: the exact same validated month is used in the query,
// subject and stored message. No report is generated or rewritten here.
async function prepareMonthlyReportEmails({ monthRef, manual = false, clientOnly = false, db = prisma } = {}) {
  const month = reportMonth(monthRef, { required: manual });
  const rule = await db.notificationRule.findFirst({ where: { eventType: 'MONTHLY_REPORT', active: true, channels: { contains: 'EMAIL' } }, orderBy: { id: 'asc' } });
  if (!rule || !tokens(rule.channels).has('EMAIL') || !rule.defaultEmail) return { monthRef: month, enabled: false, messages: [], skipped: [] };
  const roles = tokens(rule.roles), types = ['ADMIN', 'CLIENT'].filter(role => roles.has(role) && (!clientOnly || role === 'CLIENT'));
  const reports = await db.monthlyReport.findMany({ where: { month, type: { in: types } }, include: { client: true }, orderBy: { id: 'asc' } });
  const messages = [], skipped = [];
  for (const report of reports) {
    const to = report.type === 'CLIENT' ? report.client?.email : rule.config?.adminReportEmail;
    const clientName = typeof report.data?.client === 'string' ? report.data.client : report.client?.name || 'Cliente #' + report.clientId;
    const reject = reason => skipped.push({ reportId: report.id, clientId: report.clientId, clientName, reason });
    if (report.type === 'CLIENT' && (!report.client || report.client.id !== report.clientId || report.client.active === false)) { reject('CLIENT_UNAVAILABLE'); continue; }
    // Never infer a destination for an administrative report from a login alias.
    if (!singleEmail(to)) { reject('RECIPIENT_MISSING_OR_INVALID'); continue; }
    if (manual && report.type === 'CLIENT' && report.data?.reportVersion !== 2) { reject('REPORT_REQUIRES_REVIEW'); continue; }
    const text = textFor(report);
    if (!text) { reject('REPORT_REQUIRES_REVIEW'); continue; }
    if (report.data.reportVersion === 2 && report.type === 'CLIENT') {
      const start = new Date(month + '-01T00:00:00Z'), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
      if (report.data.period?.start !== start.toISOString() || report.data.period?.end !== end.toISOString() || report.data.period?.timeZone !== 'UTC') { reject('REPORT_PERIOD_MISMATCH'); continue; }
    }
    const payload = { to, subject: `Relatório Mensal${report.type === 'ADMIN' ? ' ADMIN' : ''} - ${month}`, text };
    const contentHash = createHash('sha256').update(JSON.stringify(canonical({ id: report.id, clientId: report.clientId, month, type: report.type, data: report.data, payload }))).digest('hex');
    messages.push({ reportId: report.id, clientId: report.clientId, clientName, contentHash, payload });
  }
  return { monthRef: month, enabled: true, messages, skipped };
}

async function sendMonthlyReportEmails(options = {}) {
  return require('./monthlyReportDeliveryService').sendAutomatic(options);
}

module.exports = { prepareMonthlyReportEmails, sendMonthlyReportEmails };
