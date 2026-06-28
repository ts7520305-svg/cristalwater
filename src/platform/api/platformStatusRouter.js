const express = require("express");

const Kernel = require("../../core/Kernel");
const KernelRuntime = require("../../core/runtime/KernelRuntime");

const router = express.Router();

router.get("/status", async (req, res) => {
  res.json({
    ok: true,
    platform: "Crystal Platform",
    version: "23.5.1",
    kernel: KernelRuntime.status(),
    runtime: Kernel.RuntimeMonitor.status(),
    modules: Kernel.ModuleRegistry.all(),
    services: Kernel.ServiceContainer.list(),
    checkedAt: new Date().toISOString()
  });
});

module.exports = router;
