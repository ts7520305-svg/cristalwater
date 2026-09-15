'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { NON_RECEIVABLE_STATUSES } = require('../../services/clientCreditService');
function fail(message, status) { throw Object.assign(new Error(message), { status }); }
function scope(user, rawId) {
  const id = Number(rawId), role = normalizeRole(user?.role);
  if (!['ADMIN', 'CLIENT'].includes(role)) fail('Sem permissão para documentos financeiros.', 403);
  if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail('Documento inválido.', 400);
  const clientId = role === 'CLIENT' ? Number(user.clientId || user.id) : null;
  if (role === 'CLIENT' && (!Number.isSafeInteger(clientId) || clientId <= 0)) fail('Sessão inválida.', 403);
  return { id, clientId };
}
async function invoice(rawId, user, db = prisma) {
  const { id, clientId } = scope(user, rawId);
  const row = await db.invoice.findFirst({ where: { id, ...(clientId ? { clientId, status: { notIn: NON_RECEIVABLE_STATUSES } } : {}) },
    include: { client: true, lines: true, payments: true } });
  if (!row || (clientId && NON_RECEIVABLE_STATUSES.includes(String(row.status || '').trim().toUpperCase()))) fail('Documento não encontrado.', 404);
  return row;
}
async function extras(rawId, user) {
  const { id, clientId } = scope(user, rawId);
  if (clientId && clientId !== id) fail('Documento não encontrado.', 404);
  return prisma.extraVisit.findMany({ where: { billed: false, pool: { clientId: id } }, include: { pool: { include: { client: true } } } });
}
async function sendable(rawId, user, db = prisma) {
  if (normalizeRole(user?.role) !== 'ADMIN') fail('Apenas a administração pode preparar envios.', 403);
  const row = await invoice(rawId, user, db);
  if (NON_RECEIVABLE_STATUSES.includes(String(row.status || '').trim().toUpperCase())) fail('Reveja o rascunho ou documento retirado antes do envio.', 409);
  if (!row.client?.active) fail('O cliente está inativo.', 409);
  return row;
}
module.exports = { invoice, extras, sendable };
