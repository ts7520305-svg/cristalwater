const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "tmp", "field-suite");

const GROUPS = [
  { name: "syntax-check", command: "npm", args: ["run", "check:syntax"], timeoutMs: 180_000 },
  { name: "prisma-validate", command: "npx", args: ["prisma", "validate"], timeoutMs: 120_000 },
  { name: "migration-check", command: "npm", args: ["run", "test:migrations"], timeoutMs: 120_000 },
  { name: "backend-regression", command: "npm", args: ["test"], timeoutMs: 180_000 },
  { name: "technician-core", command: "npm", args: ["run", "test:technician"], timeoutMs: 120_000 },
  { name: "browser-field-smoke", command: "npm", args: ["run", "test:field:browser"], timeoutMs: 180_000 },
  { name: "technician-real-flow", command: "npm", args: ["run", "test:technician:real"], timeoutMs: 120_000 },
  { name: "admin-equipment-real-flow", command: "npm", args: ["run", "test:admin:equipment:real"], timeoutMs: 120_000 },
  { name: "client-real-flow", command: "npm", args: ["run", "test:client:real"], timeoutMs: 120_000 },
  { name: "technician-gps", command: "npm", args: ["run", "test:technician:gps"], timeoutMs: 120_000 },
  { name: "technician-equipment", command: "npm", args: ["run", "test:technician:equipment"], timeoutMs: 120_000 },
  { name: "quote-equipment", command: "npm", args: ["run", "test:quote:equipment"], timeoutMs: 120_000 },
  { name: "inventory", command: "npm", args: ["run", "test:inventory"], timeoutMs: 120_000 },
  { name: "routes", command: "npm", args: ["run", "test:routes"], timeoutMs: 120_000 },
  { name: "email", command: "npm", args: ["run", "test:email"], timeoutMs: 120_000 },
  { name: "pool-health", command: "npm", args: ["run", "test:pool-health"], timeoutMs: 120_000 },
  { name: "handoff", command: "npm", args: ["run", "test:handoff"], timeoutMs: 120_000 },
  { name: "security", command: "npm", args: ["run", "test:security"], timeoutMs: 120_000 },
  { name: "field-reminder-lifecycle", command: "node", args: ["scripts/test-field-reminder-lifecycle.js"], timeoutMs: 120_000 },
  { name: "route-order-backend", command: "node", args: ["scripts/test-route-order-backend.js"], timeoutMs: 120_000 },
  { name: "draft-payment-backend", command: "node", args: ["scripts/test-field-draft-payments.js"], timeoutMs: 120_000 },
  { name: "invoice-draft-classification-browser", command: "node", args: ["scripts/test-invoice-draft-classification-browser.js"], timeoutMs: 120_000 },
  { name: "simulation", command: "npm", args: ["run", "test:simulation"], timeoutMs: 120_000 },
];

function parseArgs(argv) {
  const options = {
    only: [],
    skip: [],
    list: false,
    continueOnError: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list") options.list = true;
    else if (arg === "--continue-on-error") options.continueOnError = true;
    else if (arg === "--only") {
      options.only.push(...String(argv[index + 1] || "").split(",").map((value) => value.trim()).filter(Boolean));
      index += 1;
    } else if (arg === "--skip") {
      options.skip.push(...String(argv[index + 1] || "").split(",").map((value) => value.trim()).filter(Boolean));
      index += 1;
    }
  }

  return options;
}

function runGroup(group) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(group.command, group.args, {
      cwd: ROOT,
      env: { ...process.env, CI: process.env.CI || "1" },
      shell: process.platform === "win32",
    });

    let output = "";
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      output += `\n[TIMEOUT] ${group.name} excedeu ${group.timeoutMs} ms\n`;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, group.timeoutMs);

    const collect = (chunk) => {
      const text = String(chunk || "");
      output += text;
      process.stdout.write(text);
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      output += `\n[SPAWN_ERROR] ${error.message}\n`;
    });
    child.on("close", (code, signal) => {
      finished = true;
      clearTimeout(timeout);
      const durationMs = Date.now() - startedAt;
      resolve({
        name: group.name,
        command: `${group.command} ${group.args.join(" ")}`,
        ok: code === 0,
        exitCode: code,
        signal,
        durationMs,
        output,
      });
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    GROUPS.forEach((group) => console.log(group.name));
    return;
  }

  const selected = GROUPS.filter((group) => {
    if (options.only.length && !options.only.includes(group.name)) return false;
    if (options.skip.includes(group.name)) return false;
    return true;
  });

  if (!selected.length) {
    throw new Error("Nenhum grupo selecionado para test:field:all");
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const results = [];
  const suiteStartedAt = Date.now();

  console.log(`[FIELD_SUITE] grupos=${selected.length}`);
  for (const group of selected) {
    console.log(`\n[FIELD_SUITE] START ${group.name}`);
    const result = await runGroup(group);
    results.push(result);
    console.log(`[FIELD_SUITE] ${result.ok ? "PASS" : "FAIL"} ${group.name} (${result.durationMs} ms)`);
    fs.writeFileSync(path.join(LOG_DIR, `${group.name}.log`), result.output, "utf8");
    if (!result.ok && !options.continueOnError) break;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - suiteStartedAt,
    selectedGroups: selected.map((group) => group.name),
    passed: results.filter((result) => result.ok).map((result) => result.name),
    failed: results.filter((result) => !result.ok).map((result) => result.name),
    results: results.map(({ output, ...result }) => result),
  };

  fs.writeFileSync(path.join(LOG_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`\n[FIELD_SUITE] resumo: ${summary.passed.length} PASS / ${summary.failed.length} FAIL`);

  if (summary.failed.length) process.exit(1);
}

main().catch((error) => {
  console.error("FIELD_SUITE_ERROR", error);
  process.exit(1);
});
