'use strict';
const service = require('../services/repairWorkService');
const handle = fn => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await fn(req)); } catch (error) {
    const status = [400, 403, 404, 409].includes(error.status || error.statusCode) ? error.status || error.statusCode : 500;
    res.status(status).json({ ok: false, message: status === 500 ? 'Não foi possível confirmar o registo. Preserve o pedido e consulte o resultado.' : error.message });
  }
};
module.exports = {
  detail: handle(req => service.detail(req.user, req.params.id)),
  command: handle(req => service.command(req.user, req.params.id, req.body)),
  lookup: handle(req => service.lookup(req.user, req.params.id, req.params.requestId, req.query.payloadHash))
};
