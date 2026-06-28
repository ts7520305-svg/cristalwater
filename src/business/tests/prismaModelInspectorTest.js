const inspector = require("../prisma/PrismaModelInspector");

const models = ["Client", "Pool", "Technician", "ServiceVisit", "Invoice", "Payment", "Visit"];

const result = inspector.inspect(models);

const ok =
  result.length === models.length &&
  result.every((item) => item.block && item.block.includes(`model ${item.model}`));

console.log(JSON.stringify({
  ok,
  service: "PrismaModelInspectorTest",
  models: result,
  checkedAt: new Date().toISOString(),
}, null, 2));

process.exit(ok ? 0 : 1);
