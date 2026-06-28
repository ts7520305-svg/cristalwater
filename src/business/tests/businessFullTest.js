const {
  BusinessEngine,
  ClientService,
  PoolService,
  TechnicianService,
  VisitService,
  BillingService,
} = require("../index");

const engine = BusinessEngine.start();

const client = ClientService.create({
  name: "Cliente Teste",
  email: "cliente@cristalwater.pt",
});

const pool = PoolService.create({
  clientId: client.id,
  name: "Piscina Teste",
  volumeM3: 50,
});

const technician = TechnicianService.create({
  name: "Técnico Teste",
  email: "tecnico@cristalwater.pt",
});

const visit = VisitService.create({
  clientId: client.id,
  poolId: pool.id,
  technicianId: technician.id,
});

const bill = BillingService.create({
  clientId: client.id,
  poolId: pool.id,
  description: "Manutenção mensal",
  amount: 80,
});

BillingService.markPaid(bill.id);

const ok =
  engine.started === true &&
  client.id &&
  pool.clientId === client.id &&
  technician.id &&
  visit.poolId === pool.id &&
  bill.status === "PAID";

console.log(JSON.stringify({
  ok,
  service: "BusinessFullTest",
  client,
  pool,
  technician,
  visit,
  bill,
  checkedAt: new Date().toISOString(),
}, null, 2));

process.exit(ok ? 0 : 1);
