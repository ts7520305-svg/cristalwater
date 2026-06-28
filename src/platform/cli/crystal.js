#!/usr/bin/env node

require("dotenv").config();

const KernelRuntime = require("../../core/runtime/KernelRuntime");
const CrystalBrain = require("../../system/brain/CrystalBrain");
const BrainHealth = require("../../system/health/BrainHealth");
const BrainQuality = require("../../system/quality/BrainQuality");

async function doctor() {
  const kernel = KernelRuntime.start();
  const brain = CrystalBrain.status();
  const health = BrainHealth.getHealth();

  console.log(JSON.stringify({
    ok: true,
    command: "crystal doctor",
    kernel: {
      ok: kernel.ok,
      started: kernel.started,
      version: kernel.kernel.version,
      services: kernel.services,
    },
    brain: {
      name: brain.name,
      version: brain.version,
      providers: brain.aiManager.providers,
    },
    health,
    checkedAt: new Date().toISOString(),
  }, null, 2));
}

async function test() {
  const kernel = KernelRuntime.start();
  const quality = await BrainQuality.runSmokeTest();

  console.log(JSON.stringify({
    ok: kernel.ok === true && quality.ok === true,
    command: "crystal test",
    kernelOk: kernel.ok,
    brainQualityOk: quality.ok,
    quality,
    checkedAt: new Date().toISOString(),
  }, null, 2));
}

async function brainAsk(question) {
  const result = await CrystalBrain.ask(question || "Estado geral do Crystal Brain");
  console.log(JSON.stringify(result, null, 2));
}

async function status() {
  console.log(JSON.stringify({
    ok: true,
    command: "crystal status",
    kernel: KernelRuntime.status(),
    brain: CrystalBrain.status(),
    checkedAt: new Date().toISOString(),
  }, null, 2));
}

async function main() {
  const cmd = process.argv[2];
  const args = process.argv.slice(3).join(" ");

  if (cmd === "doctor") return doctor();
  if (cmd === "test") return test();
  if (cmd === "brain") return brainAsk(args);
  if (cmd === "status") return status();

  console.log(`
Crystal CLI

Comandos:
  node src/platform/cli/crystal.js doctor
  node src/platform/cli/crystal.js test
  node src/platform/cli/crystal.js status
  node src/platform/cli/crystal.js brain "pergunta"
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
