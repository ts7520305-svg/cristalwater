const TechnicianService = require("../technicians/TechnicianService");

const technician = TechnicianService.create({
  name: "Carlos",
  email: "carlos@cristalwater.pt",
  vehicleId: "van_1",
});

const ok =
  technician.name === "Carlos" &&
  TechnicianService.list().length === 1 &&
  TechnicianService.active().length === 1;

console.log(JSON.stringify({
  ok,
  service: "TechnicianDomainTest",
  technician,
  checkedAt: new Date().toISOString(),
}, null, 2));

process.exit(ok ? 0 : 1);
