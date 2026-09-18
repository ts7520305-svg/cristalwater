'use strict';
const business = require('../business/client/ClientMonthlyReportBusiness');
const { generateMonthlyReportPDF } = require('../services/pdfReportService');

function privateResponse(req, res, next) {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  next();
}

function sendError(res, error) {
  if (!error.statusCode) console.error('Client monthly report unavailable:', error.name);
  if (res.headersSent) return res.destroy();
  return res.status(error.statusCode || 503).json({ ok: false, error: error.statusCode ? error.message : 'Não foi possível consultar o relatório. Tente novamente.' });
}

async function listClientReports(req, res) {
  try {
    const result = await business.list(req.user, req.params.clientId);
    res.set({ 'X-CW-Report-Type': 'client-monthly-list', 'X-CW-Client-Id': req.params.clientId });
    return res.json(result);
  }
  catch (error) { return sendError(res, error); }
}

async function downloadClientReportPDF(req, res) {
  try {
    const report = await business.read(req.user, req.params.reportId ?? req.params.id, req.params.clientId);
    res.set({ 'Content-Language': 'pt', 'X-CW-Report-Type': 'client-monthly-pdf', 'X-CW-Client-Id': String(report.clientId), 'X-CW-Report-Id': String(report.id), 'X-CW-Month-Ref': report.month });
    return generateMonthlyReportPDF(res, report);
  } catch (error) { return sendError(res, error); }
}

module.exports = { listClientReports, downloadClientReportPDF, privateResponse };
