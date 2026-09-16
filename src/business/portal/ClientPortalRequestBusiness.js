'use strict';
const { createHash } = require('node:crypto');
const { prisma } = require('../../prismaClient');
const { actor } = require('../chat/ClientMessageBusiness');
const { buildClientPaymentReference, buildPaymentNoticeText } = require('../../utils/clientPaymentReference');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const methods = new Set(['Transferencia', 'MBWay', 'Dinheiro', 'Multibanco', 'Outro', 'Nao indicado']);
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function normalize(kind, clientId, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Pedido inválido.');
  if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !uuid.test(body.requestId))) fail(400, 'Identifique o pedido com um UUID e conserve-o ao repetir.');
  if (kind === 'VISIT_REQUEST') {
    const message = body.message !== undefined ? body.message : body.text;
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) fail(400, 'Descreva o pedido de visita em 1 a 4000 caracteres.');
    return { v: 1, clientId, kind, message: message.trim() };
  }
  if (kind !== 'PAYMENT_NOTICE') fail(400, 'Tipo de pedido inválido.');
  let amountCents = null;
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const amount = body.amount;
    if (!['string', 'number'].includes(typeof amount) || !/^\d{1,8}(\.\d{1,2})?$/.test(String(amount))) fail(400, 'Indique um valor positivo com até duas casas decimais, ou deixe o valor vazio.');
    const [whole, fraction = ''] = String(amount).split('.');
    amountCents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!amountCents) amountCents = null; // Existing integrations use zero for an unspecified amount.
  }
  const method = body.method === undefined ? 'Nao indicado' : body.method;
  if (typeof method !== 'string' || !methods.has(method)) fail(400, 'Método de pagamento inválido.');
  const note = body.note !== undefined ? body.note : body.message !== undefined ? body.message : '';
  if (typeof note !== 'string' || note.length > 4000) fail(400, 'A nota deve ter até 4000 caracteres.');
  return { v: 1, clientId, kind, amountCents, method, note: note.trim(), channel: 'PORTAL_CLIENTE' };
}
async function create(user, rawClientId, kind, body) {
  const identity = actor(user, rawClientId);
  if (identity.role !== 'CLIENT') fail(403, 'Acesso reservado ao cliente autenticado.');
  const submission = normalize(kind, identity.clientId, body);
  const requestId = body.requestId?.toLowerCase() || null;
  const payloadHash = createHash('sha256').update(JSON.stringify(submission)).digest('hex');
  return prisma.$transaction(async tx => {
    // Visit requests and payment notices share a namespace, separate from chat sends.
    if (requestId) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`client-portal-request:${identity.actorKey}:${requestId}`}))::text`;
    const client = await tx.client.findUnique({ where: { id: identity.clientId }, select: { id: true, name: true } });
    if (!client) fail(404, 'Cliente não encontrado.');
    const saved = requestId ? await tx.clientPortalRequest.findUnique({ where: { actorKey_requestId: { actorKey: identity.actorKey, requestId } } }) : null;
    if (saved) {
      if (saved.payloadHash !== payloadHash) fail(409, 'Este pedido já foi usado para outro conteúdo. Conserve o pedido original.');
      return { ...saved.response, replayed: true };
    }
    const visit = kind === 'VISIT_REQUEST', paymentReference = buildClientPaymentReference(client.id);
    const amount = (submission.amountCents || 0) / 100;
    const text = visit ? `Pedido de visita: ${submission.message}` : buildPaymentNoticeText({ client, amount, method: submission.method, note: submission.note, channel: submission.channel });
    const message = await tx.clientMessage.create({ data: { clientId: client.id, actorKey: identity.actorKey, payloadHash,
      sender: 'Cliente', senderType: 'CLIENT', text, message: text, messageType: kind, isReadByAdmin: false, isReadByClient: true, seen: false } });
    const notification = await tx.notification.create({ data: { clientId: client.id, role: 'ADMIN', type: kind, eventType: `CLIENT_${kind}`,
      title: visit ? `Pedido de visita - ${client.name}` : `Pagamento comunicado - ${paymentReference}`,
      message: visit ? submission.message : `${client.name}: comunicou pagamento${amount > 0 ? ` de ${amount.toFixed(2)} EUR` : ''}. Ref. ${paymentReference}`,
      severity: visit ? 'INFO' : 'WARN', isRead: false,
      metadata: { clientId: client.id, href: `/chat?clientId=${client.id}&filter=unread`, source: 'customer-os',
        ...(visit ? { workflow: 'visit-request' } : { paymentReference, amount, method: submission.method, channel: submission.channel }) } } });
    const log = await tx.communicationLog.create({ data: { clientId: client.id, channel: 'PORTAL_CLIENTE', message: visit ? submission.message : text, referenceId: message.id } });
    const result = JSON.parse(JSON.stringify({ ok: true, replayed: false, submission, message, notification,
      ...(visit ? { request: message } : { paymentReference }),
      receipt: requestId ? { scope: 'CLIENT_PORTAL_REQUEST', actorKey: identity.actorKey, requestId, clientId: client.id, kind, payloadHash,
        messageId: message.id, messageHash: createHash('sha256').update(text).digest('hex'), notificationId: notification.id, communicationLogId: log.id } : null }));
    if (requestId) await tx.clientPortalRequest.create({ data: { actorKey: identity.actorKey, requestId, clientId: client.id, kind, payloadHash, response: result } });
    return result;
  }, { maxWait: 15000, timeout: 20000 });
}
function emit(result) {
  if (!global.io || result.replayed) return;
  try {
    global.io.to(`client_${result.message.clientId}`).emit('newMessage', result.message);
    global.io.emit('new-notification', result.notification);
  } catch (error) { console.error('Portal request event after commit:', error.message); }
}
function sendError(res, error) {
  return res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : 'Pedido não confirmado. Conserve o conteúdo e repita o mesmo pedido.' });
}
module.exports = { create, emit, sendError };
