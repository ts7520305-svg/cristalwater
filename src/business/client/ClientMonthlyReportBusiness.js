'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const fail = (message, statusCode) => { throw Object.assign(Error(message), { statusCode }); };
const id = value => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647
  ? Number(value) : fail('Identificador inválido.', 400);

function principalClient(actor) {
  const role = normalizeRole(actor?.role);
  if (role === 'ADMIN') return null;
  // An authenticated User/Technician ID is not proof of a Client identity.
  if (role !== 'CLIENT' || actor.principalType && actor.principalType !== 'CLIENT') fail('Acesso reservado ao cliente autenticado.', 403);
  const clientId = Number(actor.clientId ?? actor.id);
  if (!Number.isSafeInteger(clientId) || clientId < 1 || clientId > 2147483647) fail('Cliente não confirmado.', 403);
  return clientId;
}

function scope(actor, rawClientId) {
  const ownClientId = principalClient(actor);
  if (rawClientId === undefined) return ownClientId;
  const clientId = id(rawClientId);
  if (ownClientId !== null && clientId !== ownClientId) fail('Acesso reservado ao cliente autenticado.', 403);
  return clientId;
}

async function list(actor, rawClientId) {
  const clientId = scope(actor, rawClientId);
  if (rawClientId === undefined) fail('Cliente obrigatório.', 400);
  const reports = await prisma.monthlyReport.findMany({ where: { clientId, type: 'CLIENT' }, orderBy: [{ month: 'desc' }, { id: 'desc' }] });
  return { count: reports.length, reports };
}

async function read(actor, rawReportId, rawClientId) {
  const clientId = scope(actor, rawClientId);
  const report = await prisma.monthlyReport.findFirst({ where: {
    id: id(rawReportId), type: 'CLIENT', clientId: clientId === null ? { not: null } : clientId,
  } });
  if (!report) fail('Relatório não encontrado.', 404);
  return report;
}

module.exports = { list, read };
