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
  try {
    return send(res, await business.createDraftInvoice(req.body || {}, actor(req)), 201);
  } catch (error) {
    const known=[400,404,409].includes(error.status);
    return res.status(known?error.status:500).json({ok:false,error:known?error.message:'Erro ao preparar documento. Consulte os registos antes de repetir.'});
  }
}

async function issueInvoice(req, res) {
  try {
    return send(res, await business.issueInvoice(req.params.invoiceId, req.body || {}, actor(req)));
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Erro ao emitir documento interno' });
  }
}

async function sendInvoice(req, res) {
  try {
    return send(res, await business.sendInvoice(req.params.invoiceId, req.body || {}, actor(req)));
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Erro ao preparar documento' });
  }
}

async function registerPayment(req, res) {
  try {
    return send(res, await business.registerPayment(req.params.invoiceId, req.body || {}, actor(req), req.user), 201);
  } catch (error) {
    return res.status([400, 404, 409].includes(error.status) ? error.status : 500).json({ ok: false, error: error.message });
  }
}

async function createCreditNote(req, res) {
  try {
    return send(res, await business.createCreditNote(req.params.invoiceId, req.body || {}, actor(req), req.user), 201);
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Erro ao registar nota de crédito' });
  }
}

async function cancelInvoice(req, res) {
  try {
    return send(res, await business.cancelInvoice(req.params.invoiceId, req.body || {}, actor(req)));
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Erro ao cancelar fatura' });
  }
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
  try {
    return send(res, await business.getRevenueReport(req.query || {}));
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Erro ao consultar recebimentos' });
  }
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
  res.set('Cache-Control', 'private, no-store');
  try { return send(res, await business.getTechnicianProfitabilityReport(req.query || {})); }
  catch (error) { return res.status(error.status || 500).json({ok:false,error:error.status ? error.message : 'Não foi possível confirmar o relatório.'}); }
}

async function reportCustomerProfitability(req, res) {
  res.set('Cache-Control', 'private, no-store');
  try { return send(res, await business.getCustomerProfitabilityReport(req.query || {})); }
  catch (error) { return res.status(error.status || 500).json({ok:false,error:error.status ? error.message : 'Não foi possível confirmar o relatório.'}); }
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
