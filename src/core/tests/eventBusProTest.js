const { EventBus, EventStore } = require("../Kernel");

async function main() {
  EventBus.reset();
  EventStore.clear();
  EventBus.attachEventStore(EventStore);

  let specificHandled = false;
  let wildcardHandled = false;

  EventBus.on("PoolCreated", async (event) => {
    specificHandled = event.name === "PoolCreated";
    return "specific-ok";
  });

  EventBus.on("*", async (event) => {
    wildcardHandled = Boolean(event.id);
    return "wildcard-ok";
  });

  const result = await EventBus.emit("PoolCreated", {
    poolId: "pool_test",
  }, {
    actor: "test",
  });

  const metrics = EventBus.getMetrics();
  const stored = EventStore.byName("PoolCreated");

  const ok =
    result.ok === true &&
    result.handlers === 2 &&
    specificHandled === true &&
    wildcardHandled === true &&
    metrics.emitted === 1 &&
    metrics.handled === 2 &&
    stored.length === 1;

  console.log(JSON.stringify({
    ok,
    service: "EventBusProTest",
    result,
    metrics,
    stored,
    checkedAt: new Date().toISOString(),
  }, null, 2));

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
