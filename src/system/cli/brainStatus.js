require("dotenv").config();

const CrystalBrain = require("../brain/CrystalBrain");
const BrainHealth = require("../health/BrainHealth");
const { listProviders } = require("../providers/ProviderRegistry");

async function main() {
  console.log("=== CRYSTAL BRAIN STATUS ===");
  console.log(JSON.stringify({
    brain: CrystalBrain.status(),
    health: BrainHealth.getHealth(),
    providers: listProviders(),
  }, null, 2));
}

main().catch(console.error);
