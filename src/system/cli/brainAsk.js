require("dotenv").config();

const CrystalBrain = require("../brain/CrystalBrain");

async function main() {
  const question = process.argv.slice(2).join(" ");

  if (!question) {
    console.error("Uso: node src/system/cli/brainAsk.js \"pergunta\"");
    process.exit(1);
  }

  const result = await CrystalBrain.ask(question);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
