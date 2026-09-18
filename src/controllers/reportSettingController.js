'use strict';
const service = require('../services/clientReportSettingsService');
const handle = work => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    if (Object.keys(req.query || {}).length) return res.status(400).json({ ok: false, code: 'INVALID_REPORT_SETTINGS', error: 'Parâmetros de consulta inválidos.' });
    res.json(await work(req));
  } catch (error) {
    res.status(error.statusCode || 503).json({ ok: false, code: error.code || 'REPORT_SETTINGS_UNCONFIRMED', error: error.statusCode ? error.message : 'Operação por confirmar. Conserve e repita o pedido original.' });
  }
};
module.exports = {
  getClientReportSetting: handle(req => service.read(req.user, req.params.clientId)),
  updateClientReportSetting: handle(req => service.write(req.user, req.params.clientId, req.body)),
};
