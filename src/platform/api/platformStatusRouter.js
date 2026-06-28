const express = require("express");
const Kernel = require("../../core/Kernel");
const CrystalBrain = require("../../system/brain/CrystalBrain");

const router = express.Router();

router.get("/status", async (req, res) => {
  try {
    const runtimeStatus = KernelRuntime.status();

    res.json({
      ok: true,
      module: "Crystal Platform",
      version: "23.4.0",
      kernel: runtimeStatus,
      brain: CrystalBrain.status(),
      monitor: Kernel.RuntimeMonitor.status(),
      doctor: await Kernel.CrystalDoctor.run(),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
