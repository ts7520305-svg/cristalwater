const os = require("os");

class RuntimeMonitor {

    status() {

        return {

            timestamp: new Date().toISOString(),

            cpu: {

                cores: os.cpus().length,

                load: os.loadavg()

            },

            memory: {

                total: os.totalmem(),

                free: os.freemem(),

                used: os.totalmem()-os.freemem()

            },

            uptime: os.uptime(),

            hostname: os.hostname(),

            platform: os.platform(),

            node: process.version

        };

    }

}

module.exports = new RuntimeMonitor();
