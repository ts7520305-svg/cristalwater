'use strict';
const business = require('../business/chat/ClientMessageBusiness');
const write = (fromParams = false, status = 200) => async (req, res) => {
  try { const result = await business.create(req.user, fromParams ? req.params.clientId : req.body?.clientId, req.body); business.emit(result); return res.status(status).json(result); }
  catch (error) { return res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : 'Envio não confirmado. Conserve a mensagem e repita o mesmo pedido.' }); }
};
module.exports = { write };
