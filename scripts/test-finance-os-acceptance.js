const bcrypt = require("bcryptjs");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.FINANCE_OS_BASE_URL || "http://127.0.0.1:3002/api";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Non-JSON response from ${url} status ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  return { response, data };
}

async function main() {
  const run = `FIN-ACC-${Date.now()}`;
  const created = { userId: null, clientId: null, invoiceId: null };

  try {
    const admin = await prisma.user.create({
      data: {
        email: `${run.toLowerCase()}@example.com`,
        password: await bcrypt.hash("FinanceAcc123!", 10),
        role: "ADMIN",
        active: true,
        name: `Admin ${run}`,
      },
    });
    created.userId = admin.id;

    const client = await prisma.client.create({
      data: {
        name: `Client ${run}`,
        email: `${run.toLowerCase()}-client@example.com`,
        phone: "+351910000002",
        active: true,
        billingActive: true,
        status: "ACTIVE",
        creditBalance: 0,
      },
    });
    created.clientId = client.id;

    const login = await fetchJson(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: admin.email, password: "FinanceAcc123!" }),
    });
    assert(login.response.ok && login.data.ok, `admin login failed: ${JSON.stringify(login.data)}`);
    const headers = { Authorization: `Bearer ${login.data.token}`, "Content-Type": "application/json" };

    const draft = await fetchJson(`${BASE_URL}/finance-os/invoices/draft`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        clientId: client.id,
        monthRef: "2026-05",
        dueDate: new Date(Date.now() - 20 * 86400000).toISOString(),
        lines: [{ type: "MONTHLY", description: "Mensalidade", quantity: 1, unitPrice: 200 }],
      }),
    });
    assert(draft.response.ok && draft.data.ok, "draft creation failed");
    created.invoiceId = draft.data.invoice.id;

    const issue = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({ invoiceNumber: `ACC-${Date.now()}` }),
    });
    assert(issue.response.ok && issue.data.ok && issue.data.invoice.status === "ISSUED", "issue validation failed");

    const payReference = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: 60, method: "REFERENCE", notes: "Pagamento referência" }),
    });
    assert(payReference.response.ok && payReference.data.ok, "reference payment failed");

    const payCash = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: 40, method: "CASH", notes: "Pagamento caixa" }),
    });
    assert(payCash.response.ok && payCash.data.ok, "cash payment failed");

    const overdue = await fetchJson(`${BASE_URL}/finance-os/debts/overdue-detection`, {
      method: "POST",
      headers,
      body: JSON.stringify({ applyInterest: true, dailyInterestRate: 0.0015 }),
    });
    assert(overdue.response.ok && overdue.data.ok, "overdue detection failed");

    const monthlyRevenue = await fetchJson(`${BASE_URL}/finance-os/reports/monthly-revenue`, { headers });
    assert(monthlyRevenue.response.ok && monthlyRevenue.data.ok, "monthly revenue report failed");

    const cashflow = await fetchJson(`${BASE_URL}/finance-os/reports/cashflow`, { headers });
    assert(cashflow.response.ok && cashflow.data.ok, "cashflow report failed");

    const techProfit = await fetchJson(`${BASE_URL}/finance-os/reports/technician-profitability?monthRef=2026-05`, { headers });
    assert(techProfit.response.ok && techProfit.data.ok, "technician profitability failed");

    const customerProfit = await fetchJson(`${BASE_URL}/finance-os/reports/customer-profitability?monthRef=2026-05`, { headers });
    assert(customerProfit.response.ok && customerProfit.data.ok, "customer profitability failed");

    const reminders = await fetchJson(`${BASE_URL}/finance-os/automation/reminders`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    assert(reminders.response.ok && reminders.data.ok, "reminders automation failed");

    const refreshedInvoice = await fetchJson(`${BASE_URL}/invoices/${created.invoiceId}`, { headers });
    assert(refreshedInvoice.response.ok, "invoice refresh read failed");

    console.log(JSON.stringify({
      ok: true,
      service: "FinanceOsAcceptanceTest",
      invoiceId: created.invoiceId,
      overdueCount: overdue.data.count,
      monthlyRevenueRows: monthlyRevenue.data.monthlyRevenue.length,
      cashflow: cashflow.data.cashflow,
      technicianRows: techProfit.data.technicians.length,
      customerRows: customerProfit.data.clients.length,
    }, null, 2));
  } finally {
    if (created.invoiceId) await prisma.payment.deleteMany({ where: { invoiceId: created.invoiceId } }).catch(() => null);
    if (created.clientId) await prisma.notification.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
    if (created.clientId) await prisma.communicationLog.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
    if (created.invoiceId) await prisma.invoiceLine.deleteMany({ where: { invoiceId: created.invoiceId } }).catch(() => null);
    if (created.invoiceId) await prisma.invoice.deleteMany({ where: { id: created.invoiceId } }).catch(() => null);
    if (created.clientId) await prisma.client.deleteMany({ where: { id: created.clientId } }).catch(() => null);
    if (created.userId) await prisma.user.deleteMany({ where: { id: created.userId } }).catch(() => null);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, service: "FinanceOsAcceptanceTest", error: error.message }, null, 2));
  process.exit(1);
});
