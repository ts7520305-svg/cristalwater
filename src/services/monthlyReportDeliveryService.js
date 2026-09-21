'use strict';
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prismaClient');
const { getJwtSecret } = require('../utils/jwtSecret');
const { reportMonth } = require('./monthlyReportMonth');
const { prepareMonthlyReportEmails } = require('./reportEmailService');
const email = require('./emailService'), integrations = require('../config/externalIntegrations');
const fail = (code, message, status = 409) => { throw Object.assign(Error(message), { code, statusCode: status }); };
const id = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const actorId = actor => {
  const value = actor?.userId || actor?.id;
  if (actor?.role !== 'ADMIN' || !id(value)) fail('ADMIN_REQUIRED', 'Acesso administrativo obrigatório.', 403);
  return value;
};
const blocked = plan => !plan.enabled ? 'RULE_DISABLED' : !integrations.isEmailEnabled() || !integrations.areExternalNotificationsEnabled() ? 'EMAIL_DISABLED' : null;
const view = row => ({ reportId: row.reportId, requestId: row.requestId, recipient: row.recipient, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt });

async function legacyReview(db, monthRef) {
  const history = await db.emailLog.findMany({ where: { eventType: 'MONTHLY_REPORT', monthlyDelivery: { is: null } }, select: { subject: true } });
  return history.some(row => typeof row.subject !== 'string' || !/^Relatório Mensal(?: ADMIN)? - (20|21)\d{2}-(0[1-9]|1[0-2])$/.test(row.subject) || row.subject.endsWith(monthRef));
}

async function preview(actor, monthRef) {
  const userId = actorId(actor), month = reportMonth(monthRef, { required: true });
  const plan = await prepareMonthlyReportEmails({ monthRef: month, clientOnly: true, manual: true });
  // Include existing outcomes even when a recipient or rule has since changed.
  const deliveries = await prisma.monthlyReportDelivery.findMany({ where: { report: { month, type: 'CLIENT' } }, orderBy: { id: 'asc' } });
  const byReport = new Map(deliveries.map(row => [row.reportId, row]));
  const rows = plan.messages.map(message => {
    const delivery = byReport.get(message.reportId);
    return { reportId: message.reportId, clientId: message.clientId, clientName: message.clientName, ...message.payload,
      delivery: delivery ? view(delivery) : null,
      reviewToken: delivery ? null : jwt.sign({ purpose: 'MONTHLY_REPORT_REVIEW', userId, reportId: message.reportId, monthRef: month, recipient: message.payload.to, contentHash: message.contentHash }, getJwtSecret(), { algorithm: 'HS256', expiresIn: '15m' }) };
  });
  return { ok: true, version: 1, monthRef: month, blocked: blocked(plan) || (await legacyReview(prisma, month) ? 'LEGACY_REVIEW_REQUIRED' : null), rows, skipped: plan.skipped, deliveries: deliveries.map(view), deliveryConfirmed: false };
}

function confirmation(actor, body) {
  const userId = actorId(actor);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['monthRef','reportId','requestId','reviewToken','confirmed'].includes(key))) fail('INVALID_CONFIRMATION', 'Confirmação inválida.', 400);
  const monthRef = reportMonth(body.monthRef, { required: true });
  if (!id(body.reportId) || !uuid(body.requestId) || body.confirmed !== true || typeof body.reviewToken !== 'string' || body.reviewToken.length > 4096) fail('REVIEW_REQUIRED', 'Reveja o destinatário e o texto antes de confirmar.', 400);
  let token;
  try { token = jwt.verify(body.reviewToken, getJwtSecret(), { algorithms: ['HS256'] }); }
  catch (_) { fail('REVIEW_EXPIRED', 'A confirmação expirou. Volte a consultar o relatório.'); }
  if (token.purpose !== 'MONTHLY_REPORT_REVIEW' || token.userId !== userId || token.reportId !== body.reportId || token.monthRef !== monthRef) fail('REVIEW_MISMATCH', 'A confirmação não corresponde a este relatório ou conta.');
  return { monthRef, reportId: body.reportId, requestId: body.requestId.toLowerCase(), requestedBy: userId, mode: 'MANUAL', recipient: token.recipient, contentHash: token.contentHash, clientOnly: true };
}

function match(existing, expected) {
  if (existing.reportId !== expected.reportId || existing.recipient !== expected.recipient || existing.contentHash !== expected.contentHash) fail('ALREADY_PROCESSED', 'Este relatório já tem um envio registado. Consulte o resultado antes de qualquer novo contacto.');
  return { ok: true, monthRef: expected.monthRef, delivery: view(existing), replayed: true, logUnconfirmed: false, deliveryConfirmed: false };
}

async function dispatch(expected) {
  let reserved;
  try {
    reserved = await prisma.$transaction(async db => {
      const existing = await db.monthlyReportDelivery.findFirst({ where: { OR: [{ reportId: expected.reportId }, { requestId: expected.requestId }] } });
      if (existing) return { replay: match(existing, expected) };
      const plan = await prepareMonthlyReportEmails({ monthRef: expected.monthRef, clientOnly: expected.clientOnly, manual: expected.mode === 'MANUAL', db });
      if (await legacyReview(db, expected.monthRef)) fail('LEGACY_REVIEW_REQUIRED', 'Há registos antigos de envio deste mês sem ligação a um relatório. Reveja o histórico antes de enviar.');
      const disabled = blocked(plan);
      if (disabled) fail(disabled, 'O envio de email está desativado.', 503);
      const message = plan.messages.find(row => row.reportId === expected.reportId);
      if (!message || message.payload.to !== expected.recipient || message.contentHash !== expected.contentHash) fail('REVIEW_STALE', 'O relatório, destinatário ou permissões mudaram. Volte a consultar e confirmar.');
      const log = await db.emailLog.create({ data: { ...message.payload, eventType: 'MONTHLY_REPORT', mode: expected.mode, status: 'PENDING' } });
      const delivery = await db.monthlyReportDelivery.create({ data: { reportId: expected.reportId, requestId: expected.requestId, recipient: expected.recipient, contentHash: expected.contentHash, requestedBy: expected.requestedBy, mode: expected.mode, emailLogId: log.id } });
      return { delivery, payload: message.payload };
    }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 30000 });
  } catch (error) {
    if (['P2002', 'P2034'].includes(error.code)) {
      const existing = await prisma.monthlyReportDelivery.findFirst({ where: { OR: [{ reportId: expected.reportId }, { requestId: expected.requestId }] } });
      if (existing) return match(existing, expected);
    }
    throw error;
  }
  if (reserved.replay) return reserved.replay;
  // The committed reservation survives a crash or a lost provider response.
  // Neither automatic nor manual repeats may reclaim it.
  let status = 'UNKNOWN', error = null;
  try {
    const response = await email.sendEmail(reserved.payload);
    const addresses = values => Array.isArray(values) ? values.map(value => String(value?.address || value).toLowerCase()) : [];
    const recipient = expected.recipient.toLowerCase(), accepted = addresses(response?.accepted), rejected = addresses(response?.rejected);
    if (accepted.includes(recipient) && !rejected.includes(recipient)) status = 'SENT';
    else if (rejected.includes(recipient) && !accepted.includes(recipient)) { status = 'FAILED'; error = 'Destinatário recusado pelo serviço de email.'; }
    else error = 'O serviço não confirmou a aceitação deste destinatário.';
  } catch (_) { error = 'Resposta do serviço de email não confirmada. Rever antes de qualquer novo envio.'; }
  try {
    const delivery = await prisma.$transaction(async db => {
      await db.emailLog.update({ where: { id: reserved.delivery.emailLogId }, data: { status, error } });
      return db.monthlyReportDelivery.update({ where: { id: reserved.delivery.id }, data: { status } });
    });
    return { ok: true, monthRef: expected.monthRef, delivery: view(delivery), replayed: false, logUnconfirmed: false, deliveryConfirmed: false };
  } catch (_) {
    return { ok: true, monthRef: expected.monthRef, delivery: view(reserved.delivery), replayed: false, logUnconfirmed: true, deliveryConfirmed: false };
  }
}

async function sendConfirmed(actor, body) { return dispatch(confirmation(actor, body)); }

async function sendAutomatic(options = {}) {
  reportMonth(options.monthRef, { required: options.manual === true });
  if (options.manual) fail('REVIEW_REQUIRED', 'Reveja o destinatário e o texto antes de confirmar.');
  const plan = await prepareMonthlyReportEmails(options);
  const result = { monthRef: plan.monthRef, sent: 0, failed: 0, uncertain: 0, logUnconfirmed: 0, replayed: 0, skipped: plan.skipped.length, deliveryConfirmed: false, blocked: blocked(plan) };
  if (result.blocked) return result;
  for (const message of plan.messages) {
    try {
      const out = await dispatch({ monthRef: plan.monthRef, reportId: message.reportId, recipient: message.payload.to, contentHash: message.contentHash, requestId: randomUUID(), requestedBy: null, mode: 'AUTOMATIC', clientOnly: options.clientOnly === true });
      if (out.replayed) result.replayed++;
      else if (out.logUnconfirmed) { result.logUnconfirmed++; result.uncertain++; }
      else if (out.delivery.status === 'SENT') result.sent++;
      else if (out.delivery.status === 'FAILED') result.failed++;
      else result.uncertain++;
    } catch (_) { result.failed++; }
  }
  return result;
}

module.exports = { preview, sendConfirmed, sendAutomatic };
