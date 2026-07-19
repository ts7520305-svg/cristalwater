const express = require("express");
const auth = require("../middlewares/authMiddleware");
const c = require("../controllers/financeOsController");

const router = express.Router();

router.use(auth("ADMIN"));

router.post("/invoices/draft", c.createDraftInvoice);
router.post("/invoices/:invoiceId/issue", c.issueInvoice);
router.post("/invoices/:invoiceId/send", c.sendInvoice);
router.post("/invoices/:invoiceId/payments", c.registerPayment);
router.post("/invoices/:invoiceId/credit-note", c.createCreditNote);
router.post("/invoices/:invoiceId/cancel", c.cancelInvoice);
router.get("/invoices/:invoiceId/history", c.invoiceHistory);

router.post("/debts/overdue-detection", c.detectOverdue);
router.get("/balances/customer/:clientId", c.customerBalance);
router.get("/accounts/customer/:clientId", c.customerAccount);
router.get("/balances/company", c.companyBalance);

router.get("/reports/revenue", c.reportRevenue);
router.get("/reports/monthly-revenue", c.reportMonthlyRevenue);
router.get("/reports/outstanding-debt", c.reportOutstandingDebt);
router.get("/reports/cashflow", c.reportCashflow);
router.get("/reports/vat-summary", c.reportVatSummary);
router.get("/reports/technician-profitability", c.reportTechnicianProfitability);
router.get("/reports/customer-profitability", c.reportCustomerProfitability);

router.post("/automation/reminders", c.automationReminders);
router.post("/automation/payment-confirmation/:invoiceId", c.automationPaymentConfirmation);

module.exports = router;
