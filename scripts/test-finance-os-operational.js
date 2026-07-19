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
  const run = `FIN-OPS-${Date.now()}`;
  const created = { userId: null, clientId: null, invoiceId: null, invoice2Id: null };

  try {
    const admin = await prisma.user.create({
      data: {
        email: `${run.toLowerCase()}@example.com`,
        password: await bcrypt.hash("FinanceOps123!", 10),
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
        phone: "+351910000001",
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
      body: JSON.stringify({ email: admin.email, password: "FinanceOps123!" }),
    });
    assert(login.response.ok && login.data.ok, `admin login failed: ${JSON.stringify(login.data)}`);
    const headers = { Authorization: `Bearer ${login.data.token}`, "Content-Type": "application/json" };

    const draft = await fetchJson(`${BASE_URL}/finance-os/invoices/draft`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        clientId: client.id,
        monthRef: "2026-07",
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        lines: [{ type: "MONTHLY", description: "Mensalidade", quantity: 1, unitPrice: 120 }],
      }),
    });
    assert(draft.response.ok && draft.data.ok, `draft invoice failed: ${JSON.stringify(draft.data)}`);
    created.invoiceId = draft.data.invoice.id;

    const issue = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({ invoiceNumber: `INV-${Date.now()}` }),
    });
    assert(issue.response.ok && issue.data.ok, "issue invoice failed");

    const send = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/send`, {
      method: "POST",
      headers,
      body: JSON.stringify({ channel: "EMAIL" }),
    });
    assert(send.response.ok && send.data.ok, "send invoice failed");

    const payment1 = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: 70, method: "BANK_TRANSFER", notes: "Pagamento parcial" }),
    });
    assert(payment1.response.ok && payment1.data.ok, "first payment failed");

    const payment2 = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: 30, method: "MBWAY", notes: "Segundo pagamento" }),
    });
    assert(payment2.response.ok && payment2.data.ok, "second payment failed");

    const credit = await fetchJson(`${BASE_URL}/finance-os/invoices/${created.invoiceId}/credit-note`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: 10, reason: "Ajuste serviço" }),
    });
    assert(credit.response.ok && credit.data.ok, "credit note failed");

    const overdueDraft = await fetchJson(`${BASE_URL}/finance-os/invoices/draft`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        clientId: client.id,
        monthRef: "2026-06",
        dueDate: new Date(Date.now() - 10 * 86400000).toISOString(),
        lines: [{ type: "MONTHLY", description: "Mensalidade atrasada", quantity: 1, unitPrice: 50 }],
      }),
    });
    assert(overdueDraft.response.ok && overdueDraft.data.ok, "overdue draft failed");
    created.invoice2Id = overdueDraft.data.invoice.id;

    const overdue = await fetchJson(`${BASE_URL}/finance-os/debts/overdue-detection`, {
      method: "POST",
      headers,
      body: JSON.stringify({ applyInterest: true, dailyInterestRate: 0.001 }),
    });
    assert(overdue.response.ok && overdue.data.ok, "overdue detection failed");

    const companyBalance = await fetchJson(`${BASE_URL}/finance-os/balances/company`, { headers });
    assert(companyBalance.response.ok && companyBalance.data.ok, "company balance failed");

    const customerBalance = await fetchJson(`${BASE_URL}/finance-os/balances/customer/${client.id}`, { headers });
    assert(customerBalance.response.ok && customerBalance.data.ok, "customer balance failed");

    const dashboardRevenue = await fetchJson(`${BASE_URL}/finance-os/reports/revenue`, { headers });
    assert(dashboardRevenue.response.ok && dashboardRevenue.data.ok, "revenue report failed");

    const outstanding = await fetchJson(`${BASE_URL}/finance-os/reports/outstanding-debt`, { headers });
    assert(outstanding.response.ok && outstanding.data.ok, "outstanding debt report failed");

    const vat = await fetchJson(`${BASE_URL}/finance-os/reports/vat-summary`, { headers });
    assert(vat.response.ok && vat.data.ok, "vat summary failed");

    const paymentConfirmation = await fetchJson(`${BASE_URL}/finance-os/automation/payment-confirmation/${created.invoiceId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "Pagamento validado automaticamente" }),
    });
    assert(paymentConfirmation.response.ok && paymentConfirmation.data.ok, "payment confirmation automation failed");

    console.log(JSON.stringify({
      ok: true,
      service: "FinanceOsOperationalSmoke",
      invoiceId: created.invoiceId,
      overdueProcessed: overdue.data.count,
      companyBalance: companyBalance.data.balance,
      customerBalance: customerBalance.data.balance,
    }, null, 2));
  } finally {
    if (created.invoice2Id) await prisma.payment.deleteMany({ where: { invoiceId: created.invoice2Id } }).catch(() => null);
    if (created.invoiceId) await prisma.payment.deleteMany({ where: { invoiceId: created.invoiceId } }).catch(() => null);
    if (created.clientId) await prisma.notification.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
    if (created.clientId) await prisma.communicationLog.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
    if (created.invoice2Id) await prisma.invoiceLine.deleteMany({ where: { invoiceId: created.invoice2Id } }).catch(() => null);
    if (created.invoiceId) await prisma.invoiceLine.deleteMany({ where: { invoiceId: created.invoiceId } }).catch(() => null);
    if (created.invoice2Id) await prisma.invoice.deleteMany({ where: { id: created.invoice2Id } }).catch(() => null);
    if (created.invoiceId) await prisma.invoice.deleteMany({ where: { id: created.invoiceId } }).catch(() => null);
    if (created.clientId) await prisma.client.deleteMany({ where: { id: created.clientId } }).catch(() => null);
    if (created.userId) await prisma.user.deleteMany({ where: { id: created.userId } }).catch(() => null);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, service: "FinanceOsOperationalSmoke", error: error.message }, null, 2));
  process.exit(1);
});
