const automation = require('../business/finance/MonthlyAutomationBusiness');
async function runAutoBilling(options = {}) {
  const billing = await automation.monthly(options);
  const reminders = await automation.reminders(options);
  if (!billing.ok) throw new Error('Algumas mensalidades não foram preparadas; consultar os registos e repetir.');
  return { ok: true, billing, reminders };
}
module.exports = { runAutoBilling };
