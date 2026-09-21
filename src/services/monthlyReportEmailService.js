'use strict';
const { sendMonthlyReportEmails } = require('./reportEmailService');

// Legacy client-only entry point shares month selection, rule and delivery logic.
async function sendMonthlyReports(options = {}) {
  return sendMonthlyReportEmails({ ...options, clientOnly: true });
}

module.exports = { sendMonthlyReports };
