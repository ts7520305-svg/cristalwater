'use strict';
const { prisma } = require('../../prismaClient');
const documents = require('./InvoiceDocumentAccessBusiness');
const { normalizeRole } = require('../../utils/roles');
const gate = require('../../config/externalIntegrations');
const whatsapp = require('../../services/whatsappService');
const nodemailer = require('nodemailer');
const reminderPolicy = require('../../services/invoiceReminderPolicy');
const { invoiceOpen } = require('../../services/clientCreditService');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function transport(mode) {
  if (mode === 'browser') return null;
  gate.assertExternalOperationAllowed(mode === 'email' ? 'email' : 'whatsapp');
  if (mode === 'api') {
    const config = whatsapp.getWhatsAppConfig();
    if (config.provider !== 'TWILIO' || !config.accountSid || !config.authToken || !config.from) fail(503, 'O envio por WhatsApp ainda não está configurado.');
    return ({ recipient, text }) => whatsapp.sendWhatsAppViaApi({ toPhone: recipient, text });
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) fail(503, 'O envio por email ainda não está configurado.');
  const sender = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: true }, connectionTimeout: 15000, socketTimeout: 30000 });
  return ({ recipient, text }) => sender.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: recipient, subject: 'Documento Cristal Water', text });
}
function recipientFor(invoice, mode, body, reminder) {
  if (mode !== 'email') {
    const phone = whatsapp.normalizePhone(reminder ? invoice.client.paymentReminderWhatsappNumber || invoice.client.phone : invoice.client.phone);
    if (!/^[1-9]\d{7,14}$/.test(phone || '')) fail(400, 'O cliente não tem um telefone válido.');
    return phone;
  }
  const registered = [reminder && invoice.client.paymentReminderEmailAddress, invoice.client.fiscalEmail, invoice.client.email].filter(Boolean).map(s => s.trim().toLowerCase());
  const email = body.email === undefined ? registered[0] : typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!registered.includes(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) fail(400, 'Use um endereço de email registado na ficha do cliente.');
  return email;
}
async function send(rawId, user, mode, baseUrl, body = {}, delivery = null) {
  if (normalizeRole(user?.role) !== 'ADMIN' || !Number.isSafeInteger(user?.id) || user.id <= 0) fail(403, 'Apenas a administração pode enviar documentos.');
  const id = Number(rawId);
  if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail(400, 'Documento inválido.');
  if (!['browser', 'api', 'email'].includes(mode) || !body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Modo de envio inválido.');
  if (delivery && delivery.purpose !== 'payment-reminder') fail(400, 'Tipo de envio inválido.');
  const reminder = delivery?.purpose === 'payment-reminder';
  const requestId = reminder ? reminderPolicy.requestId(delivery.requestId) : null;
  let origin;
  try { const url = new URL(baseUrl); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error(); origin = url.origin; }
  catch { fail(503, 'O endereço público da aplicação não está configurado.'); }
  const dispatch = transport(mode), channel = mode === 'email' ? 'EMAIL' : mode === 'api' ? 'WHATSAPP_API' : 'WHATSAPP_BROWSER';
  const sourceKey = reminder ? `invoice-reminder:${id}:${requestId}:${channel}` : `invoice-outbound:${id}:${channel}`;
  const prepared = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const invoice = await documents.sendable(rawId, user, tx);
    if (reminder) {
      reminderPolicy.assertEligible(invoice);
      if (!reminderPolicy.modes(invoice.client).includes(mode)) fail(409, 'O canal do lembrete já não está ativo.');
    }
    const recipient = recipientFor(invoice, mode, body, reminder);
    const previous = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (previous && reminder && previous.metadata.actor !== `ADMIN:${user.id}`) fail(409, 'Este pedido pertence a outro responsável.');
    if (previous) return { previous: true, result: { ...previous.metadata.result, idempotent: true } };
    const documentUrl = `${origin}/invoice-document?id=${id}`;
    const text = reminder
      ? `Cristal Water\n\nLembrete do documento #${id}: ${invoiceOpen(invoice).toFixed(2)} EUR em aberto. Se já efetuou o pagamento, ignore esta mensagem.\nConsulte o documento com a sua conta:\n${documentUrl}`
      : `Cristal Water\n\nDocumento financeiro #${id} disponível. Consulte o documento com a sua conta:\n${documentUrl}`;
    const result = { ok: true, mode, prepared: true, documentUrl, deliveryStatus: dispatch ? 'PENDING_CONFIRMATION' : 'NOT_SENT',
      requiresReview: !!dispatch, message: dispatch ? 'Tentativa registada. Confirme o resultado antes de reenviar.' : 'Mensagem preparada. O envio no WhatsApp ainda não foi efetuado.' };
    if (!dispatch) result.link = whatsapp.buildWhatsAppBrowserLink(recipient, text);
    await tx.operationalReminder.create({ data: { sourceKey, clientId: invoice.clientId, title: 'Preparação e resultado de envio de documento', dueDate: new Date(), isCompleted: true,
      metadata: { actor: `ADMIN:${user.id}`, recipient, channel, result } } });
    await tx.communicationLog.create({ data: { clientId: invoice.clientId, referenceId: id, channel: 'INVOICE_OUTBOUND_PREPARATION', message: `${channel}: ${result.message}` } });
    await tx.auditTrail.create({ data: { action: 'INVOICE_OUTBOUND_PREPARATION', eventType: 'INVOICE_OUTBOUND_PREPARATION', entity: 'Invoice', entityId: id, clientId: invoice.clientId,
      metadata: { actor: `ADMIN:${user.id}`, channel, deliveryStatus: result.deliveryStatus } } });
    return { result, recipient, text, clientId: invoice.clientId };
  }, { timeout: 30000 });
  if (prepared.previous || !dispatch) return prepared.result;
  let result;
  try {
    const info = await dispatch(prepared);
    const rejected = ['failed', 'undelivered'].includes(info?.status) || (Array.isArray(info?.accepted) && !info.accepted.some(value => String(value).toLowerCase() === prepared.recipient));
    const providerMessageId = String(info?.sid || info?.messageId || '');
    const state = rejected ? 'REJECTED' : providerMessageId ? 'PROVIDER_ACCEPTED' : 'UNKNOWN';
    result = { ...prepared.result, ok: !rejected, deliveryStatus: state, providerMessageId: providerMessageId || null, requiresReview: state !== 'PROVIDER_ACCEPTED',
      message: state === 'PROVIDER_ACCEPTED' ? 'Envio aceite pelo fornecedor. A entrega ao cliente ainda não está confirmada.' : state === 'REJECTED' ? 'O fornecedor recusou o envio. Reveja o contacto antes de nova tentativa.' : 'Resultado do envio desconhecido. Confirme com o fornecedor antes de reenviar.' };
  } catch {
    result = { ...prepared.result, deliveryStatus: 'UNKNOWN', requiresReview: true, message: 'A resposta do fornecedor perdeu-se ou falhou. Confirme o resultado antes de reenviar.' };
  }
  try {
    await prisma.$transaction(async tx => {
      await tx.operationalReminder.update({ where: { sourceKey }, data: { metadata: { actor: `ADMIN:${user.id}`, recipient: prepared.recipient, channel, result } } });
      await tx.auditTrail.create({ data: { action: 'INVOICE_OUTBOUND_RESULT', eventType: 'INVOICE_OUTBOUND_RESULT', entity: 'Invoice', entityId: id, clientId: prepared.clientId,
        metadata: { actor: `ADMIN:${user.id}`, channel, deliveryStatus: result.deliveryStatus, providerMessageId: result.providerMessageId || null } } });
    });
    return result;
  } catch {
    // The durable pre-dispatch record prevents a repeated HTTP request sending again.
    return prepared.result;
  }
}
module.exports = { send };
