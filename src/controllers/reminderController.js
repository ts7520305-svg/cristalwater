const reminders = require('../business/finance/ManualInvoiceReminderBusiness');

// ==========================================================
// ENVIAR LEMBRETE MANUAL
// ==========================================================

async function sendReminder(req, res) {
  try {
    res.set('Cache-Control', 'private, no-store');
    const result = await reminders.send(req.params.id, req.user, process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`, req.body);
    return res.json(result);

  } catch (err) {
    const status = err.statusCode || err.status || 500;
    return res.status(status).json({ ok: false, error: err.code || (status === 500 ? 'Não foi possível preparar o lembrete.' : err.message) });
  }
}

module.exports = {
  sendReminder
};
