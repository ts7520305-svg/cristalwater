"use strict";
const { prisma } = require('../prismaClient');
const { generate: generateClientMonthlyReport } = require('../business/client/ClientMonthlyReportBusiness');
const { manualReportMonth } = require('../services/monthlyReportMonth');
const delivery = require('../services/monthlyReportDeliveryService');

const action = work => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await work(req)); }
  catch (error) {
    const status = error.statusCode || error.status;
    if ([400,403,409,503].includes(status)) return res.status(status).json({ ok: false, code: error.code, error: error.message });
    res.status(503).json({ ok: false, code: 'RESULT_UNAVAILABLE', error: 'Não foi possível confirmar a operação. Consulte o resultado antes de tentar novamente.' });
  }
};

const prepareReports = action(async req => {
  const monthRef = manualReportMonth(req.body);
  // An immutable snapshot must not freeze a month that is still in progress.
  if (monthRef >= new Date().toISOString().slice(0,7)) throw Object.assign(Error('Escolha um mês concluído para gerar relatórios guardados.'), { statusCode: 400, code: 'MONTH_NOT_CLOSED' });
  const clients = await prisma.client.findMany({ where: { status: 'ACTIVE', active: true }, select: { id: true } });
  for (const client of clients) await generateClientMonthlyReport(client.id, monthRef);
  return { ok: true, monthRef, clients: clients.length, prepared: true, sent: 0, deliveryConfirmed: false };
});
const previewReports = action(req => delivery.preview(req.user, manualReportMonth(req.query)));
const sendReportsNow = action(req => delivery.sendConfirmed(req.user, req.body));
module.exports = { prepareReports, previewReports, sendReportsNow };
