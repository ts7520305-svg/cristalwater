const BillingCreditBusiness = require('../business/finance/BillingCreditBusiness');
const MonthlyBillingBusiness = require('../business/finance/MonthlyBillingBusiness');

async function generateMonthly(req, res) {
  try {
    return res.json(await MonthlyBillingBusiness.generateMonthly(req.body?.monthRef));
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível concluir a faturação mensal. Pode repetir o processamento sem duplicar as mensalidades concluídas.' });
  }
}

async function addCredit(req, res) {
  try { return res.json(await BillingCreditBusiness.adjust(req.params.id, req.body || {}, req.user)); }
  catch (error) { return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível confirmar o ajuste de crédito.' }); }
}
async function listMonthly(req, res) {
  try { return res.json(await BillingCreditBusiness.list(req.query.monthRef)); }
  catch (error) { return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível consultar a faturação.' }); }
}

module.exports = {
  generateMonthly,
  addCredit,
  listMonthly
};
