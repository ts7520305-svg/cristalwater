'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { NON_RECEIVABLE_STATUSES } = require('../../services/clientCreditService');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
async function deliver(rawId, user) {
  const id = Number(rawId);
  if (normalizeRole(user?.role) !== 'ADMIN' || !Number.isSafeInteger(user?.id) || user.id <= 0) fail(403, 'Apenas a administração pode disponibilizar documentos.');
  if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail(400, 'Documento inválido.');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { client: true } });
    if (!invoice) fail(404, 'Documento não encontrado.');
    if (NON_RECEIVABLE_STATUSES.includes(String(invoice.status || '').trim().toUpperCase())) fail(409, 'Reveja o rascunho ou documento retirado antes de o disponibilizar.');
    if (!invoice.client?.active) fail(409, 'O cliente está inativo.');
    const sourceKey = `invoice-chat:${id}`;
    const previous = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (previous) return { ...previous.metadata.result, idempotent: true };
    const documentUrl = `/invoice-document?id=${id}`;
    const text = `Documento financeiro #${id} disponível para consulta. Entre na sua conta para abrir o PDF.`;
    const message = await tx.clientMessage.create({ data: { clientId: invoice.clientId, sender: 'Administração Cristal Water', senderType: 'ADMIN',
      message: text, text, isReadByAdmin: true, seen: true, fileUrl: documentUrl, fileName: `documento-${id}.pdf`, messageType: 'DOCUMENT' } });
    await tx.notification.create({ data: { clientId: invoice.clientId, role: 'CLIENT', type: 'INVOICE_CHAT_AVAILABLE', eventType: 'INVOICE_CHAT_AVAILABLE',
      title: 'Documento disponível', message: text, metadata: { invoiceId: id, messageId: message.id, documentUrl } } });
    await tx.communicationLog.create({ data: { clientId: invoice.clientId, channel: 'CHAT', referenceId: id, message: text } });
    await tx.auditTrail.create({ data: { action: 'INVOICE_CHAT_AVAILABLE', eventType: 'INVOICE_CHAT_AVAILABLE', entity: 'Invoice', entityId: id,
      clientId: invoice.clientId, metadata: { actor: `ADMIN:${user.id}`, messageId: message.id, documentUrl } } });
    const result = { ok: true, mode: 'chat', message: 'Documento disponível na conversa do cliente.', deliveryStatus: 'AVAILABLE_IN_PORTAL', messageId: message.id, documentUrl };
    await tx.operationalReminder.create({ data: { sourceKey, clientId: invoice.clientId, title: 'Documento disponibilizado na conversa', dueDate: new Date(), isCompleted: true, metadata: { result } } });
    return result;
  }, { timeout: 30000 });
}
module.exports = { deliver };
