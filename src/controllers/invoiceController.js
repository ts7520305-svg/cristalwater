'use strict';
const chat = require('../business/finance/InvoiceChatDeliveryBusiness');
const outbound = require('../business/finance/InvoiceOutboundDeliveryBusiness');
async function sendInvoiceFull(req, res) {
  try {
    const mode = String(req.query.mode || 'chat').toLowerCase();
    const result = mode === 'chat' ? await chat.deliver(req.params.invoiceId, req.user)
      : await outbound.send(req.params.invoiceId, req.user, mode, process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`, req.body || {});
    return res.json(result);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({ ok: false, error: status === 500 ? 'Não foi possível preparar o documento.' : error.message });
  }
}
module.exports = { sendInvoiceFull };
