const os = require("os");

class CrystalDoctor {
  async run(kernel = null) {
    const report = {
      ok: true,
      timestamp: new Date().toISOString(),
      kernel: {},
      runtime: {},
      brain: {},
      providers: [],
      system: {},
      score: 100,
    };

    try {
      if (kernel) {
        report.kernel = {
          ok: true,
          version: kernel.KernelConfig?.version || "unknown",
          modules: kernel.ModuleRegistry ? Object.keys(kernel.ModuleRegistry.all()).length : 0,
          services: kernel.ServiceContainer ? kernel.ServiceContainer.list().length : 0,
        };
      } else {
        report.kernel = {
          ok: true,
          version: "unknown",
          modules: 0,
          services: 0,
        };
      }
    } catch (e) {
      report.kernel = { ok: false, error: e.message };
      report.score -= 20;
    }

    try {
      report.runtime = kernel?.RuntimeMonitor
        ? kernel.RuntimeMonitor.status()
        : {
            ok: true,
            note: "RuntimeMonitor indisponível",
          };
    } catch (e) {
      report.runtime = { ok: false, error: e.message };
      report.score -= 10;
    }

    try {
      const Brain = require("../../system/brain/CrystalBrain");
      report.brain = {
        ok: true,
        status: Brain.status(),
      };
    } catch (e) {
      report.brain = {
        ok: false,
        error: e.message,
      };
      report.score -= 20;
    }

    try {
      const { listProviders } = require("../../system/providers/ProviderRegistry");
      report.providers = listProviders();
    } catch (e) {
      report.providers = [];
      report.score -= 10;
    }

    report.system = {
      hostname: os.hostname(),
      node: process.version,
      platform: os.platform(),
      cpu: os.cpus().length,
      ramGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
      uptimeHours: (os.uptime() / 3600).toFixed(2),
    };

    return report;
  }
}

module.exports = new CrystalDoctor();
