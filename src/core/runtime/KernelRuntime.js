const Kernel = require("../Kernel");

class KernelRuntime {
  constructor() {
    this.started = false;
    this.startedAt = null;
  }

  start() {
    if (this.started) {
      return this.status();
    }

    Kernel.EventBus.attachEventStore(Kernel.EventStore);

    Kernel.ServiceContainer.register("Kernel", Kernel);
    Kernel.ServiceContainer.register("EventBus", Kernel.EventBus);
    Kernel.ServiceContainer.register("EventStore", Kernel.EventStore);
    Kernel.ServiceContainer.register("Metrics", Kernel.Metrics);
    Kernel.ServiceContainer.register("AuditTrail", Kernel.AuditTrail);
    Kernel.ServiceContainer.register("PermissionEngine", Kernel.PermissionEngine);

    Kernel.ModuleRegistry.register("kernel", {
      name: "Crystal Kernel",
      version: Kernel.KernelConfig.version,
      status: "online",
    });

    Kernel.EventBus.emit("KernelRuntimeStarted", {
      version: Kernel.KernelConfig.version,
    }, {
      actor: "system",
    });

    this.started = true;
    this.startedAt = new Date().toISOString();

    return this.status();
  }

  status() {
    return {
      ok: true,
      service: "KernelRuntime",
      started: this.started,
      startedAt: this.startedAt,
      kernel: Kernel.KernelConfig,
      services: Kernel.ServiceContainer.list(),
      modules: Kernel.ModuleRegistry.all(),
      metrics: Kernel.EventBus.getMetrics(),
    };
  }
}

module.exports = new KernelRuntime();
