class KernelRuntime {
  constructor() {
    this.started = false;
    this.startedAt = null;
    this.kernel = null;
  }

  start(kernel) {
    if (!kernel) {
      throw new Error("KernelRuntime.start(kernel): kernel é obrigatório.");
    }

    this.kernel = kernel;

    if (this.started) {
      return this.status();
    }

    kernel.EventBus.attachEventStore(kernel.EventStore);

    kernel.ServiceContainer.register("Kernel", kernel);
    kernel.ServiceContainer.register("EventBus", kernel.EventBus);
    kernel.ServiceContainer.register("EventStore", kernel.EventStore);
    kernel.ServiceContainer.register("Metrics", kernel.Metrics);
    kernel.ServiceContainer.register("AuditTrail", kernel.AuditTrail);
    kernel.ServiceContainer.register("PermissionEngine", kernel.PermissionEngine);

    kernel.ModuleRegistry.register("kernel", {
      name: "Crystal Kernel",
      version: kernel.KernelConfig.version,
      status: "online",
    });

    kernel.EventBus.emit("KernelRuntimeStarted", {
      version: kernel.KernelConfig.version,
    }, {
      actor: "system",
    });

    this.started = true;
    this.startedAt = new Date().toISOString();

    return this.status();
  }

  status() {
    const kernel = this.kernel;

    return {
      ok: true,
      service: "KernelRuntime",
      started: this.started,
      startedAt: this.startedAt,
      kernel: kernel ? kernel.KernelConfig : null,
      services: kernel ? kernel.ServiceContainer.list() : [],
      modules: kernel ? kernel.ModuleRegistry.all() : {},
      metrics: kernel ? kernel.EventBus.getMetrics() : {},
    };
  }
}

module.exports = new KernelRuntime();
