const Kernel = require("../Kernel");
const os = require("os");

class CrystalDoctor {

    async run() {

        const report = {
            timestamp: new Date().toISOString(),
            kernel: {},
            runtime: {},
            brain: {},
            providers: {},
            system: {},
            score: 0
        };

        // Kernel
        report.kernel.ok = true;
        report.kernel.version = Kernel.KernelConfig.version;
        report.kernel.modules = Object.keys(Kernel.ModuleRegistry.all()).length;
        report.kernel.services = Kernel.ServiceContainer.list().length;

        // Runtime
        report.runtime = Kernel.RuntimeMonitor.status();

        // Brain
        try {

            const Brain = require("../../system/brain/CrystalBrain");

            report.brain = {
                ok: true,
                status: Brain.status()
            };

        } catch (e) {

            report.brain = {
                ok: false,
                error: e.message
            };

        }

        // Providers
        try {

            const { listProviders } = require("../../system/providers/ProviderRegistry");

            report.providers = listProviders();

        } catch {

            report.providers = [];

        }

        // Sistema
        report.system = {
            hostname: os.hostname(),
            node: process.version,
            platform: os.platform(),
            cpu: os.cpus().length,
            ramGB: (os.totalmem()/1024/1024/1024).toFixed(2),
            uptimeHours: (os.uptime()/3600).toFixed(2)
        };

        let score = 100;

        if (!report.brain.ok) score -= 20;
        if (report.providers.length === 0) score -= 10;

        report.score = score;

        return report;

    }

}

module.exports = new CrystalDoctor();
