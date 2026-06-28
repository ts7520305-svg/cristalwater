const PoolService = require("../pools/PoolService");

const pool = PoolService.create({
  clientId: "client_test",
  name: "Piscina Principal",
  address: "Lagos",
  volumeM3: 50,
});

const ok =
  pool.name === "Piscina Principal" &&
  PoolService.list().length === 1 &&
  PoolService.findByClient("client_test").length === 1;

console.log(JSON.stringify({
  ok,
  service: "PoolDomainTest",
  pool,
  checkedAt: new Date().toISOString(),
}, null, 2));

process.exit(ok ? 0 : 1);
