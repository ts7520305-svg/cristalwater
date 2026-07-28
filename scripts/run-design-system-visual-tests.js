const fs = require("fs");
const path = require("path");
const { chromium, firefox, webkit } = require("playwright");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const outRoot = path.join(process.cwd(), "docs", "product", "evidence", "design-system");

const pages = [
  { key: "admin", url: `${BASE}/admin-master-control` },
  { key: "technician", url: `${BASE}/technician-field-mode` },
  { key: "client", url: `${BASE}/client-portal` },
];

const viewports = [
  [320, 740],
  [360, 780],
  [375, 812],
  [390, 844],
  [414, 896],
  [430, 932],
  [768, 1024],
  [1024, 1366],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];

const engines = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function captureEngine(engineName, engine) {
  const engineOut = path.join(outRoot, engineName);
  ensureDir(engineOut);

  const results = [];
  let browser = null;

  try {
    browser = await engine.launch({ headless: true });
  } catch (error) {
    return {
      engine: engineName,
      launched: false,
      error: String(error.message || error),
      results,
    };
  }

  for (const [width, height] of viewports) {
    const vpLabel = `${width}x${height}`;
    const vpOut = path.join(engineOut, vpLabel);
    ensureDir(vpOut);

    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();

    for (const p of pages) {
      const item = {
        viewport: vpLabel,
        page: p.key,
        url: p.url,
        ok: false,
        title: "",
        status: "",
        file: `${p.key}.png`,
      };

      try {
        const response = await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        item.status = response ? String(response.status()) : "n/a";
        await page.waitForTimeout(700);
        item.title = await page.title();
        await page.screenshot({ path: path.join(vpOut, item.file), fullPage: true });
        item.ok = true;
      } catch (error) {
        item.status = `error: ${String(error.message || error)}`;
      }

      results.push(item);
      console.log(`${engineName}\t${vpLabel}\t${p.key}\t${item.ok ? "PASS" : "FAIL"}\t${item.status}`);
    }

    await context.close();
  }

  await browser.close();
  return { engine: engineName, launched: true, results };
}

(async () => {
  ensureDir(outRoot);
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    pages,
    viewports,
    engines: [],
  };

  for (const [name, engine] of engines) {
    const engineResult = await captureEngine(name, engine);
    summary.engines.push(engineResult);
  }

  const summaryPath = path.join(outRoot, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`SUMMARY=${summaryPath}`);
})();
