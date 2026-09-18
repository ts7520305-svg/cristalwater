'use strict';
const { prisma } = require('../prismaClient');
const cashReceipts = require('./cashReceiptReportService');
const { period, documentMonthWhere } = require('./operationalValueReportService');
const financialProjection = require('./monthlyFinancialProjection');

const sections = new Set(['financial', 'reports', 'communications']);

async function financial(db, monthRef) {
  const [payments, invoices] = await Promise.all([
    cashReceipts.payments(monthRef, db),
    db.invoice.findMany({where:documentMonthWhere(monthRef),select:financialProjection.documentSelect})
  ]);
  return financialProjection.project(invoices, payments).summary;
}

async function reports(db, monthRef) {
  const groups = await db.monthlyReport.groupBy({by:['type'],where:{month:monthRef},_count:{_all:true}});
  const result = {basis:'MONTHLY_REPORT_MONTH',total:0,adminCount:0,clientCount:0,extraVisitsCount:0,otherCount:0};
  for (const group of groups) {
    result.total += group._count._all;
    result[group.type === 'ADMIN' ? 'adminCount' : group.type === 'CLIENT' ? 'clientCount' : group.type === 'EXTRA_VISITS' ? 'extraVisitsCount' : 'otherCount'] += group._count._all;
  }
  return result;
}

async function communications(db, start, end) {
  const where = {createdAt:{gte:start,lt:end}};
  const [total,latest] = await Promise.all([
    db.communicationLog.count({where}),
    db.communicationLog.findMany({where,select:{id:true,channel:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:5})
  ]);
  return {basis:'COMMUNICATION_LOG_CREATED_AT_UTC',deliveryConfirmed:false,total,latestLimit:5,latest};
}

async function summary(query = {}) {
  if (Object.keys(query).some(key => !['monthRef','section'].includes(key)) || typeof query.monthRef !== 'string' || !sections.has(query.section)) {
    throw Object.assign(new Error('Indique mês e secção válidos para o relatório.'),{status:400});
  }
  const {monthRef,start,end} = period({monthRef:query.monthRef});
  return prisma.$transaction(async db => {
    const data = query.section === 'financial' ? await financial(db,monthRef) : query.section === 'reports' ? await reports(db,monthRef) : await communications(db,start,end);
    return {ok:true,reportVersion:1,section:query.section,monthRef,period:{start,end,timeZone:'UTC'},generatedAt:new Date().toISOString(),complete:true,limitApplied:null,data};
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
}

module.exports = {summary};
