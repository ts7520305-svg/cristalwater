// ==========================================
// CRISTAL WATER - ALERT CONTROLLER
// src/controllers/alertController.js
// ==========================================

const { getPendingAlerts } = require("../services/alertService");

// GET /api/alerts
async function getAlerts(req, res, next) {
  try {
    const alerts = await getPendingAlerts(false);
    return res.json({
      count: alerts.length,
      alerts,
    });
  } catch (err) {
    return next(err);
  }
}

// POST /api/alerts/send-email
async function sendAlertsEmail(req, res, next) {
  try {
    const alerts = await getPendingAlerts(true);
    return res.json({
      message: "Emails enviados",
      count: alerts.length,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAlerts,
  sendAlertsEmail,
};