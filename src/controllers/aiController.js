const { askAdminAI } = require("../services/ai/aiOrchestrator");
const { buildLiveBusinessContext } = require("../services/ai/context/liveBusinessContext");

async function ask(req, res) {
  try {
    const { question } = req.body;
    const liveContext = await buildLiveBusinessContext();

    const result = await askAdminAI({ question, context: liveContext });

    return res.json({
      success: true,
      answer: result.text,
      provider: result.provider,
      model: result.model,
    });
  } catch (error) {
    console.error("AI ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = { ask };