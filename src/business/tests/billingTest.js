const BillingService = require("../billing/BillingService");

const bill = BillingService.create({
  clientId: "client_test",
  poolId: "pool_test",
  description: "Manutenção mensal",
  amount: 80,
});

BillingService.markPaid(bill.id);

const ok =
  bill.amount === 80 &&
  BillingService.list().length === 1 &&
  BillingService.byClient("client_test").length === 1 &&
  BillingService.pending().length === 0 &&
  bill.status === "PAID";

console.log(JSON.stringify({
  ok,
  service: "BillingDomainTest",
  bill,
  checkedAt: new Date().toISOString(),
}, null, 2));

process.exit(ok ? 0 : 1);
