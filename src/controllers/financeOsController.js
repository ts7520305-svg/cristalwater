const business = require("../business/finance/FinanceOsBusiness");

function actor(req) {
  return req.user?.email || req.user?.name || req.user?.role || "finance-os";
}

function send(res, result, successStatus = 200) {
  if (!result?.ok) {
    return res.status(result?.status || 400).json({ ok: false, error: result?.error || "Operação inválida" });
  }
  return res.status(successStatus).json(result);
}

async function createDraftInvoice(req, res) {
  return send(res, await business.createDraftInvoice(req.body || {}, actor(req)), 201);
}

async function issueInvoice(req, res) {
  return send(res, await business.issueInvoice(req.params.invoiceId, req.body || {}, actor(req)));
}

async function sendInvoice(req, res) {
  return send(res, await business.sendInvoice(req.params.invoiceId, req.body || {}, actor(req)));
}

async function registerPayment(req, res) {
  return send(res, await business.registerPayment(req.params.invoiceId, req.body || {}, actor(req)), 201);
}

async function createCreditNote(req, res) {
  return send(res, await business.createCreditNote(req.params.invoiceId, req.body || {}, actor(req)), 201);
}

async function cancelInvoice(req, res) {
  return send(res, await business.cancelInvoice(req.params.invoiceId, req.body || {}, actor(req)));
}

async function invoiceHistory(req, res) {
  return send(res, await business.getInvoiceHistory(req.params.invoiceId));
}

async function detectOverdue(req, res) {
  return send(res, await business.detectOverdueAndInterest(req.body || {}, actor(req)));
}

async function customerBalance(req, res) {
  return send(res, await business.getCustomerBalance(req.params.clientId));
}

async function customerAccount(req, res) {
  return send(res, await business.getCustomerAccount(req.params.clientId));
}

async function companyBalance(req, res) {
  return send(res, await business.getCompanyBalance());
}

async function reportRevenue(req, res) {
  return send(res, await business.getRevenueReport(req.query || {}));
}

async function reportMonthlyRevenue(req, res) {
  return send(res, await business.getMonthlyRevenueReport());
}

async function reportOutstandingDebt(req, res) {
  return send(res, await business.getOutstandingDebtReport());
}

async function reportCashflow(req, res) {
  return send(res, await business.getCashflowReport());
}

async function reportVatSummary(req, res) {
  return send(res, await business.getVatSummaryReport());
}

async function reportTechnicianProfitability(req, res) {
  return send(res, await business.getTechnicianProfitabilityReport(req.query || {}));
}

async function reportCustomerProfitability(req, res) {
  return send(res, await business.getCustomerProfitabilityReport(req.query || {}));
}

async function automationReminders(req, res) {
  return send(res, await business.triggerReminderAutomation(actor(req)));
}

async function automationPaymentConfirmation(req, res) {
  return send(res, await business.confirmPaymentAutomation(req.params.invoiceId, req.body || {}, actor(req)));
}

module.exports = {
  createDraftInvoice,
  issueInvoice,
  sendInvoice,
  registerPayment,
  createCreditNote,
  cancelInvoice,
  invoiceHistory,
  detectOverdue,
  customerBalance,
  customerAccount,
  companyBalance,
  reportRevenue,
  reportMonthlyRevenue,
  reportOutstandingDebt,
  reportCashflow,
  reportVatSummary,
  reportTechnicianProfitability,
  reportCustomerProfitability,
  automationReminders,
  automationPaymentConfirmation,
};
