const { sendMonthlyReports } = require("../services/monthlyReportEmailService");

async function sendReportsNow(req, res, next) {
  try {
    const result = await sendMonthlyReports({ manual: true });
    res.json({
      message: "Envio manual executado",
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendReportsNow,
};