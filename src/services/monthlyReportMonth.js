'use strict';
const { period } = require('./operationalValueReportService');
const { lastMonth } = require('./clientMonthlyReportDataService');

function reportMonth(monthRef, { required = false, now = new Date() } = {}) {
  if (required && monthRef === undefined) throw Object.assign(Error('Escolha o mês do relatório (AAAA-MM).'), { status: 400, statusCode: 400 });
  try { return period({ monthRef: monthRef === undefined ? lastMonth(now) : monthRef }).monthRef; }
  catch (error) { error.statusCode = error.status || 400; throw error; }
}

function manualReportMonth(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'monthRef')) {
    throw Object.assign(Error('Indique apenas o mês do relatório em monthRef.'), { status: 400, statusCode: 400 });
  }
  return reportMonth(body.monthRef, { required: true });
}

module.exports = { reportMonth, manualReportMonth };
