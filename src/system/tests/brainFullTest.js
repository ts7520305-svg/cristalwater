require("dotenv").config();

const CrystalBrain = require("../brain/CrystalBrain");
const BrainHealth = require("../health/BrainHealth");
const BrainQuality = require("../quality/BrainQuality");
const BrainSecurity = require("../security/BrainSecurity");
const BrainArchitecture = require("../architecture/BrainArchitecture");
const BrainKnowledge = require("../knowledge/BrainKnowledge");

async function main() {
  const results = [];

  results.push({
    test: "brain_status",
    ok: Boolean(CrystalBrain.status().name),
  });

  results.push({
    test: "brain_health",
    ok: BrainHealth.getHealth().ok === true,
  });

  const ask = await CrystalBrain.ask("Responde apenas: FULL TEST OK");
  results.push({
    test: "brain_ask",
    ok: ask.ok === true,
    provider: ask.provider,
    agent: ask.agent?.name,
  });

  const quality = await BrainQuality.runSmokeTest();
  results.push({
    test: "brain_quality",
    ok: quality.ok === true,
  });

  const security = BrainSecurity.checkPrompt("OPENAI_API_KEY=sk-test-123");
  results.push({
    test: "brain_security",
    ok: security.sanitized.includes("[REDACTED"),
  });

  const architecture = BrainArchitecture.checkModule("CrystalBrain");
  results.push({
    test: "brain_architecture",
    ok: architecture.ok === true,
  });

  const note = BrainKnowledge.addNote("Teste", "Nota de conhecimento", ["test"]);
  results.push({
    test: "brain_knowledge",
    ok: Boolean(note.id),
  });

  const allOk = results.every((r) => r.ok);

  console.log(JSON.stringify({
    ok: allOk,
    service: "CrystalBrainFullTest",
    results,
    checkedAt: new Date().toISOString(),
  }, null, 2));

  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
