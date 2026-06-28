const express = require("express");

const CrystalBrain = require("../brain/CrystalBrain");
const BrainHealth = require("../health/BrainHealth");
const BrainQuality = require("../quality/BrainQuality");
const { listProviders } = require("../providers/ProviderRegistry");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
    ok: true,
    module: "CrystalBrainAPI",
    status: CrystalBrain.status(),
    providers: listProviders(),
  });
});

router.get("/health", (req, res) => {
  res.json(BrainHealth.getHealth());
});

router.post("/ask", async (req, res) => {
  try {
    const { question, context } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({
        ok: false,
        error: "Pergunta vazia.",
      });
    }

    const result = await CrystalBrain.ask(question, context || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/quality/smoke-test", async (req, res) => {
  try {
    const result = await BrainQuality.runSmokeTest();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
