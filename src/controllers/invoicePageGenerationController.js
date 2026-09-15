'use strict';
const business = require('../business/finance/InvoicePageGenerationBusiness');
function failure(res, error) {
  return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível concluir a geração da fatura.' });
}
async function generateForClient(req, res) {
  try { return res.json(await business.generateForClient(req.params.clientId, req.body)); }
  catch (error) { return failure(res, error); }
}
async function generateMonthly(req, res) {
  try { return res.json(await business.generateMonthly(req.body)); }
  catch (error) { return failure(res, error); }
}
module.exports = { generateForClient, generateMonthly };
