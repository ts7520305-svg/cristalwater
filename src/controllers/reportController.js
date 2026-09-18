'use strict';
const { period } = require('../services/operationalValueReportService');
const { language } = require('../services/monthlyReportLanguage');
const monthly = require('../services/monthlyPrintableReportService');

async function getMonthlyPrintableReport(req, res) {
  res.set({ 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' });
  const query = req.query || {};
  if (Object.keys(query).some(key => !['monthRef', 'onlyRequiresInvoice', 'lang'].includes(key)) ||
      typeof query.monthRef !== 'string' ||
      (query.onlyRequiresInvoice !== undefined && !['true', 'false'].includes(query.onlyRequiresInvoice))) {
    return res.status(400).json({ok:false,error:'Indique um mês AAAA-MM e um filtro de faturação válido.'});
  }
  let monthRef;
  try { ({monthRef} = period({monthRef:query.monthRef})); }
  catch (_) { return res.status(400).json({ok:false,error:'Mês inválido; use AAAA-MM entre 2000 e 2199.'}); }
  let lang;
  try { lang = language(query.lang); }
  catch (_) { return res.status(400).json({ok:false,error:'Idioma do relatório inválido.'}); }
  const onlyRequiresInvoice = query.onlyRequiresInvoice === 'true';
  try {
    const report = await monthly.read(monthRef, onlyRequiresInvoice, lang);
    const html = monthly.html(report);
    res.set({ 'Content-Language':lang, 'X-CW-Report-Type':'monthly-print', 'X-CW-Report-Version':'2', 'X-CW-Month-Ref':monthRef, 'X-CW-Invoice-Filter':String(onlyRequiresInvoice) });
    return res.type('html').send(html);
  } catch (error) {
    console.error('getMonthlyPrintableReport:', error.message);
    return res.status(503).json({ok:false,error:'O relatório mensal está indisponível. Tente novamente.'});
  }
}
module.exports = { getMonthlyPrintableReport };
