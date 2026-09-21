'use strict';
const { prisma } = require('../prismaClient');
const email = require('./emailService');
const integrations = require('../config/externalIntegrations');
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
async function prepareMonthlyReportEmails({ monthRef, manual = false, clientOnly = false } = {}) {
  const month = reportMonth(monthRef, { required: manual });
  const rule = await prisma.notificationRule.findFirst({ where: { eventType: 'MONTHLY_REPORT', active: true, channels: { contains: 'EMAIL' } }, orderBy: { id: 'asc' } });
  if (!rule || !tokens(rule.channels).has('EMAIL') || !rule.defaultEmail) return { monthRef: month, enabled: false, messages: [], skipped: [] };
  const roles = tokens(rule.roles), types = ['ADMIN', 'CLIENT'].filter(role => roles.has(role) && (!clientOnly || role === 'CLIENT'));
  const reports = await prisma.monthlyReport.findMany({ where: { month, type: { in: types } }, include: { client: true }, orderBy: { id: 'asc' } });
  const messages = [], skipped = [];
  for (const report of reports) {
    const to = report.type === 'CLIENT' ? report.client?.email : rule.config?.adminReportEmail;
    const reject = reason => skipped.push({ reportId: report.id, clientId: report.clientId, reason });
    if (report.type === 'CLIENT' && (!report.client || report.client.id !== report.clientId || report.client.active === false)) { reject('CLIENT_UNAVAILABLE'); continue; }
    // Never infer a destination for an administrative report from a login alias.
    if (!singleEmail(to)) { reject('RECIPIENT_MISSING_OR_INVALID'); continue; }
    const text = textFor(report);
    if (!text) { reject('REPORT_REQUIRES_REVIEW'); continue; }
    if (report.data.reportVersion === 2 && report.type === 'CLIENT') {
      const start = new Date(month + '-01T00:00:00Z'), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
      if (report.data.period?.start !== start.toISOString() || report.data.period?.end !== end.toISOString() || report.data.period?.timeZone !== 'UTC') { reject('REPORT_PERIOD_MISMATCH'); continue; }
    }
    messages.push({ reportId: report.id, clientId: report.clientId, payload: { to, subject: `Relatório Mensal${report.type === 'ADMIN' ? ' ADMIN' : ''} - ${month}`, text } });
  }
  return { monthRef: month, enabled: true, messages, skipped };
}

async function sendMonthlyReportEmails(options = {}) {
  const plan = await prepareMonthlyReportEmails(options);
  const result = { monthRef: plan.monthRef, sent: 0, failed: 0, uncertain: 0, logUnconfirmed: 0, skipped: plan.skipped.length, deliveryConfirmed: false, blocked: null };
  if (!plan.enabled) return { ...result, blocked: 'RULE_DISABLED' };
  if (!integrations.isEmailEnabled() || !integrations.areExternalNotificationsEnabled()) return { ...result, blocked: 'EMAIL_DISABLED' };
  for (const message of plan.messages) {
    // Store selected content before calling the provider. An uncertain outcome
    // must not enter the legacy FAILED retry queue.
    let log;
    try {
      log = await prisma.emailLog.create({ data: { ...message.payload, eventType: 'MONTHLY_REPORT', mode: options.manual ? 'MANUAL' : 'AUTOMATIC', status: 'PENDING' } });
    } catch (_) { result.failed++; continue; }
    let status = 'UNKNOWN', error = null;
    try {
      const response = await email.sendEmail(message.payload);
      const addresses = values => Array.isArray(values) ? values.map(value => String(value?.address || value).toLowerCase()) : [];
      const to = message.payload.to.toLowerCase(), accepted = addresses(response?.accepted), rejected = addresses(response?.rejected);
      if (accepted.includes(to) && !rejected.includes(to)) { status = 'SENT'; result.sent++; }
      else if (rejected.includes(to) && !accepted.includes(to)) { status = 'FAILED'; result.failed++; error = 'Destinatário recusado pelo serviço de email.'; }
      else { result.uncertain++; error = 'O serviço não confirmou a aceitação deste destinatário.'; }
    } catch (failure) { result.uncertain++; error = String(failure.message || 'Envio não confirmado').slice(0, 1000); }
    try { await prisma.emailLog.update({ where: { id: log.id }, data: { status, error } }); }
    catch (_) { result.logUnconfirmed++; }
  }
  return result;
}

module.exports = { prepareMonthlyReportEmails, sendMonthlyReportEmails };
