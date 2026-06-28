const { BusinessEngine } = require("../index");

const status = BusinessEngine.start();

const ok =
  status.ok === true &&
  status.started === true &&
  status.domains.clients &&
  status.domains.pools &&
  status.domains.technicians;

console.log(JSON.stringify({
  ok,
  service: "BusinessEngineTest",
  status,
  checkedAt: new Date().toISOString(),
}, null, 2));

process.exit(ok ? 0 : 1);
