const KernelRuntime = require("../runtime/KernelRuntime");

function main() {
  const status = KernelRuntime.start();

  const ok =
    status.ok === true &&
    status.started === true &&
    status.services.includes("Kernel") &&
    status.services.includes("EventBus") &&
    status.modules.kernel.status === "online";

  console.log(JSON.stringify({
    ok,
    service: "KernelRuntimeTest",
    status,
    checkedAt: new Date().toISOString(),
  }, null, 2));

  process.exit(ok ? 0 : 1);
}

main();
