const {
  Entity,
  EventBus,
  StateMachine,
  Validator,
  AuditTrail,
  Metrics,
  CrystalError,
  KernelConfig,
} = require("../Kernel");

async function main() {
  const results = [];

  const entity = new Entity({
    type: "client",
    props: { name: "Teste" },
  });

  results.push({
    test: "entity_create",
    ok: Boolean(entity.id && entity.type === "client"),
  });

  const validation = Validator.validate([
    () => Validator.required(entity.props.name, "name"),
    () => Validator.email("teste@cristalwater.pt", "email"),
  ]);

  results.push({
    test: "validation",
    ok: validation.ok === true,
  });

  const sm = new StateMachine({
    initialState: "created",
    transitions: {
      created: ["active"],
      active: ["archived"],
    },
  });

  sm.transition("active", "test");

  results.push({
    test: "state_machine",
    ok: sm.current() === "active",
  });

  const event = await EventBus.emit("KernelSmokeTested", {
    entityId: entity.id,
  });

  results.push({
    test: "event_bus",
    ok: event.name === "KernelSmokeTested",
  });

  const audit = AuditTrail.record({
    action: "kernel_smoke_test",
    actor: "test",
    entityId: entity.id,
    entityType: entity.type,
  });

  results.push({
    test: "audit",
    ok: Boolean(audit.id),
  });

  Metrics.increment("kernel_smoke_tests");

  results.push({
    test: "metrics",
    ok: Metrics.snapshot().counters.kernel_smoke_tests >= 1,
  });

  const err = new CrystalError("Teste", { code: "TEST", status: 400 });

  results.push({
    test: "crystal_error",
    ok: err.toJSON().code === "TEST",
  });

  results.push({
    test: "kernel_config",
    ok: KernelConfig.name === "Crystal Kernel",
  });

  const ok = results.every((r) => r.ok);

  console.log(JSON.stringify({
    ok,
    service: "CrystalKernelSmokeTest",
    version: KernelConfig.version,
    results,
    checkedAt: new Date().toISOString(),
  }, null, 2));

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
