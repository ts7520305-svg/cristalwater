'use strict';
const InvoiceGenerationBusiness = require('../business/finance/InvoiceGenerationBusiness');
const handler = mode => async (req, res) => {
  try { return res.json(await InvoiceGenerationBusiness.generate(mode, req.body || {})); }
  catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível concluir a geração da fatura.',
      ...(error.code === 'INVOICE_ALREADY_EXISTS' ? { code: error.code, invoice: error.invoice } : {}) });
  }
};
module.exports = { core: handler('CORE'), legacy: handler('CORE_LEGACY'), operational: handler('OPERATIONAL') };
