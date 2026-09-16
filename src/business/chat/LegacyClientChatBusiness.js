'use strict';
const { prisma } = require('../../prismaClient'), { normalizeRole } = require('../../utils/roles');
const current = require('./ClientMessageBusiness'), history = require('../../services/clientChatHistoryService');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function present(message) {
  const legacy = message.legacyRecord;
  return { ...(legacy ? legacy.payload : { id: `db-${message.id}`, clientId: String(message.clientId), from: message.senderType || 'UNKNOWN', text: message.text || message.message || '', created_at: message.createdAt.toISOString() }),
    recordId: legacy?.recordKey || `db-${message.id}`, messageId: message.id, source: legacy ? 'LEGACY' : 'DATABASE', projected: true, identityVerified: !legacy && !!message.actorKey,
    readByAdmin: message.isReadByAdmin, readByClient: message.isReadByClient || message.senderType === 'CLIENT',
    ...(message.fileUrl ? { fileUrl: message.fileUrl, fileName: message.fileName, messageType: message.messageType } : {}) };
}
async function list(user, rawId) {
  const { clientId, role } = current.actor(user, rawId); await history.ensure();
  const messages = (await prisma.clientMessage.findMany({ where: { clientId }, include: { legacyRecord: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(present);
  if (role === 'ADMIN') {
    const unassigned = await prisma.clientChatLegacyRecord.findMany({ where: { clientId, message: { is: null } }, orderBy: { importedAt: 'asc' } });
    messages.push(...unassigned.map(row => ({ ...row.payload, recordId: row.recordKey, source: 'LEGACY', projected: false, identityVerified: false, readByAdmin: row.readByAdmin, readByClient: row.readByClient })));
  }
  return messages;
}
async function unread(user) {
  if (normalizeRole(user?.role) !== 'ADMIN') fail(403, 'Sem permissão para esta consulta.');
  await history.ensure(); return { unreadCount: await prisma.clientMessage.count({ where: history.adminUnreadWhere() }) };
}
async function create(user, rawId, body = {}) {
  const result = await current.create(user, rawId, body); current.emit(result);
  return { ...present(result.message), ok: true, requestId: result.message.requestId, replayed: result.replayed, receipt: result.receipt };
}
async function markRead(user, rawId) {
  const role = normalizeRole(user?.role);
  const id = rawId == null && role === 'ADMIN' ? null : current.actor(user, rawId).clientId;
  const source = await history.snapshot();
  return prisma.$transaction(async tx => {
    await history.importSnapshot(tx, source);
    const scope = id ? { clientId: id } : {}, now = new Date();
    if (role === 'CLIENT') {
      await tx.clientMessage.updateMany({ where: { ...scope, isReadByClient: false, senderType: { not: 'CLIENT' }, seenAt: null }, data: { seen: true, seenAt: now } });
      await tx.clientMessage.updateMany({ where: { ...scope, isReadByClient: false }, data: { isReadByClient: true } });
    } else {
      const where = history.adminUnreadWhere(id);
      await tx.clientMessage.updateMany({ where: { ...where, seenAt: null }, data: { seenAt: now } });
      await tx.clientMessage.updateMany({ where, data: { isReadByAdmin: true, seen: true } });
    }
    if (role === 'ADMIN') await tx.clientChatLegacyRecord.updateMany({ where: { ...scope, message: { is: null }, readByAdmin: false }, data: { readByAdmin: true } });
    return { ok: true, ...(role === 'CLIENT' ? { actor: 'client' } : {}) };
  }, { maxWait: 15000, timeout: 20000 });
}
module.exports = { list, unread, create, markRead };
