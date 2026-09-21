'use strict';
const { prisma } = require('../../prismaClient');
const { scope, id } = require('../../utils/clientReadScope');
const projection = require('../../services/clientMonthlyReportDataService');
const { period } = require('../../services/operationalValueReportService');
const fail = (message, statusCode) => { throw Object.assign(Error(message), { statusCode }); };

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

// Internal generation used by the protected administrative workflow.
async function generate(clientId, monthRef = projection.lastMonth()) {
  if (!Number.isSafeInteger(clientId) || clientId < 1 || clientId > 2147483647) fail('Cliente inválido.', 400);
  const range = period({monthRef}), where = {clientId,month:range.monthRef,type:'CLIENT'};
  try {
    return await prisma.$transaction(async db => {
      const saved = await db.monthlyReport.findFirst({where});
      if (saved) return saved;
      const data = await projection.read(db,clientId,range);
      if (!data) return null;
      return db.monthlyReport.create({data:{...where,data}});
    },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
  } catch (error) {
    // The existing unique key reserves one immutable report per client/month/type.
    if (['P2002','P2034'].includes(error.code)) {
      const saved = await prisma.monthlyReport.findFirst({where});
      if (saved) return saved;
    }
    throw error;
  }
}

module.exports = { list, read, generate };
