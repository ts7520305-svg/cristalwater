const { sendMonthlyReports } = require("../services/monthlyReportEmailService");
const { manualReportMonth } = require('../services/monthlyReportMonth');

async function sendReportsNow(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  try {
    const monthRef = manualReportMonth(req.body);
    const result = await sendMonthlyReports({ manual: true, monthRef });
    res.json({
      ok: true,
      message: result.blocked ? 'Envio de email desativado.' : 'Processamento terminado. Consulte os resultados do envio.',
      ...result,
    });
  } catch (err) {
    if (err.status === 400 || err.statusCode === 400) return res.status(400).json({ ok: false, error: err.message });
    next(err);
  }
}

module.exports = {
  sendReportsNow,
};
