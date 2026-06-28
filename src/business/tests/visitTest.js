const VisitService = require("../visits/VisitService");

const visit = VisitService.create({
  clientId: "client_test",
  poolId: "pool_test",
  technicianId: "tech_test",
  notes: "Visita semanal",
});

const ok =
  visit.status === "SCHEDULED" &&
  VisitService.list().length === 1 &&
  VisitService.byTechnician("tech_test").length === 1 &&
  VisitService.byPool("pool_test").length === 1;

console.log(JSON.stringify({
  ok,
  service: "VisitDomainTest",
  visit,
  checkedAt: new Date().toISOString(),
}, null, 2));

process.exit(ok ? 0 : 1);
