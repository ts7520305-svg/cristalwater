'use strict';
const { createHash } = require('node:crypto'), fs = require('node:fs/promises');
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const hash = value => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function actor(user, rawClientId) {
  const role = normalizeRole(user?.role), clientId = Number(rawClientId);
  if (!['ADMIN', 'CLIENT'].includes(role)) fail(403, 'Sem permissão para esta conversa.');
  if (!/^[1-9]\d*$/.test(String(rawClientId)) || !Number.isSafeInteger(clientId) || clientId > 2147483647) fail(400, 'Cliente inválido.');
  const type = role === 'CLIENT' ? 'CLIENT' : user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN' : 'USER';
  const id = Number(type === 'CLIENT' ? user.clientId || user.id : user.userId || user.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail(403, 'Identidade inválida.');
  if (role === 'CLIENT' && clientId !== id) fail(403, 'Sem permissão para esta conversa.');
  return { clientId, role, actorKey: `${type}:${type === 'ENV_ADMIN' ? hash(String(user.email || '').trim().toLowerCase()) : id}` };
}
async function create(user, rawClientId, body = {}, attachment) {
  const identity = actor(user, rawClientId);
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Pedido inválido.');
  // Older callers without a UUID remain compatible; only identified requests
  // receive the replay guarantee. All current composers supply a UUID.
  if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !uuid.test(body.requestId))) fail(400, 'Identifique o envio com um UUID e conserve-o ao repetir.');
  const requestId = body.requestId?.toLowerCase() || null;
  let payload, input;
  if (attachment) {
    const bytes = await fs.readFile(attachment.path);
    if (!bytes.length || bytes.length > 25 * 1024 * 1024) fail(400, 'Anexo inválido.');
    input = { v: 1, clientId: identity.clientId, kind: 'FILE', name: attachment.name, size: bytes.length, sha256: hash(bytes) };
    payload = { text: attachment.url, message: attachment.url, fileUrl: attachment.url, fileName: attachment.name, messageType: attachment.type };
  } else {
    const text = body.text !== undefined ? body.text : body.message;
    if (typeof text !== 'string' || !text.trim() || text.length > 10000) fail(400, 'Indique uma mensagem de 1 a 10000 caracteres.');
    input = { v: 1, clientId: identity.clientId, kind: 'TEXT', text: text.trim() };
    payload = { text: input.text, message: input.text, messageType: 'TEXT' };
  }
  const payloadHash = hash(JSON.stringify(input));
  return prisma.$transaction(async tx => {
    if (requestId) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`client-message:${identity.actorKey}:${requestId}`}))::text`;
    const client = await tx.client.findUnique({ where: { id: identity.clientId }, select: { id: true } });
    if (!client) fail(404, 'Cliente não encontrado.');
    let message = requestId ? await tx.clientMessage.findUnique({ where: { actorKey_requestId: { actorKey: identity.actorKey, requestId } } }) : null;
    const replayed = !!message;
    if (message && message.payloadHash !== payloadHash) fail(409, 'Este pedido já foi usado para outro conteúdo ou conversa. Conserve o envio original.');
    if (!message) {
      const fromClient = identity.role === 'CLIENT';
      message = await tx.clientMessage.create({ data: { ...payload, clientId: identity.clientId, actorKey: identity.actorKey, requestId, payloadHash,
        sender: fromClient ? 'Cliente' : 'Administração Cristal Water', senderType: identity.role, isReadByAdmin: !fromClient, seen: !fromClient, seenAt: fromClient ? null : new Date() } });
      await tx.communicationLog.create({ data: { clientId: identity.clientId, channel: fromClient ? 'PORTAL_CLIENTE' : 'CHAT', referenceId: message.id, message: attachment ? `Anexo: ${attachment.name}` : input.text } });
    }
    return { ok: true, message, replayed, receipt: requestId ? { scope: 'CLIENT_CHAT_SEND', actorKey: message.actorKey, requestId: message.requestId,
      clientId: message.clientId, messageId: message.id, payloadHash: message.payloadHash } : null };
  }, { maxWait: 15000, timeout: 20000 });
}
function emit(result) {
  if (!global.io || result.replayed) return;
  // Events are best effort after commit; the stored conversation is authoritative.
  try {
    const message = result.message;
    global.io.to(`client_${message.clientId}`).emit('newMessage', message);
    if (message.senderType === 'CLIENT') global.io.emit('new-notification', { id: `chat-${message.clientId}`, clientId: message.clientId, type: 'CHAT_MESSAGE', message: message.message, createdAt: message.createdAt });
  } catch (error) { console.error('Chat event after commit:', error.message); }
}
module.exports = { create, emit };
