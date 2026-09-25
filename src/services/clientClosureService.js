'use strict';
const { prisma } = require('../prismaClient');
const { scope } = require('../utils/clientReadScope');
const { publicMessage } = require('./companyClosureService');

async function list(actor, rawClientId, query = {}, database = prisma, now = new Date()) {
  const clientId = scope(actor, rawClientId);
  if (rawClientId === undefined || Object.keys(query).length) throw Object.assign(Error('Consulta inválida.'), { statusCode: 400 });
  const client = await database.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw Object.assign(Error('Cliente não encontrado.'), { statusCode: 404 });
  // Publication is explicit. Future notices are useful before the closure begins;
  // administrative preferences, authorship, metadata and routing never leave here.
  const rows = await database.companyClosure.findMany({
    where: { status: 'ACTIVE', showOnClientPortal: true, endDate: { gte: now } },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }], take: 101,
    select: { id: true, title: true, messageTitle: true, messageBody: true, startDate: true, endDate: true, emergencyPhone: true, emergencyEmail: true },
  });
  const closures = rows.slice(0, 100).map(row => {
    if (!Number.isFinite(row.startDate?.getTime()) || !Number.isFinite(row.endDate?.getTime()) || row.startDate > row.endDate) throw Error('Invalid closure source');
    const message = publicMessage(row);
    return { id: row.id, title: message.title, message: message.message, startDate: row.startDate.toISOString(), endDate: row.endDate.toISOString(), emergencyPhone: row.emergencyPhone || null, emergencyEmail: row.emergencyEmail || null };
  });
  return { ok: true, version: 1, clientId, asOf: now.toISOString(), timeZone: 'UTC', complete: rows.length <= 100, limit: 100, closures };
}
module.exports = { list };
