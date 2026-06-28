const BusinessConfig = require("./BusinessConfig");
const BusinessRegistry = require("./BusinessRegistry");

class BusinessEngine {
  constructor() {
    this.started = false;
    this.startedAt = null;
  }

  start() {
    if (this.started) return this.status();

    for (const domain of BusinessConfig.domains) {
      BusinessRegistry.register(domain, {
        engine: "BusinessEngine",
      });
    }

    this.started = true;
    this.startedAt = new Date().toISOString();

    return this.status();
  }

  status() {
    return {
      ok: true,
      name: BusinessConfig.name,
      version: BusinessConfig.version,
      started: this.started,
      startedAt: this.startedAt,
      domains: BusinessRegistry.all(),
    };
  }
}

module.exports = new BusinessEngine();
