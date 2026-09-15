'use strict';
const outbound = require('../business/finance/InvoiceOutboundDeliveryBusiness');
async function sendInvoiceEmail(req, res) {
  try {
    return res.json(await outbound.send(req.body?.invoiceId, req.user, 'email', process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`, req.body || {}));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({ ok: false, error: error.code || (status === 500 ? 'Não foi possível preparar o email.' : error.message) });
  }
}
module.exports = { sendInvoiceEmail };
