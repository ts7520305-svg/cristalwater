const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");

const invoices = [
  {
    id: 1,
    clientId: 10,
    status: "DRAFT",
    month: 9,
    year: 2026,
    totalAmount: 100,
    amountPaid: 0,
    client: { id: 10, name: "Cliente Rascunho", email: "draft@example.test" },
    lines: [{ total: 100, description: "Manutencao" }],
  },
  {
    id: 2,
    clientId: 11,
    status: "PENDING",
    month: 9,
    year: 2026,
    totalAmount: 120,
    amountPaid: 0,
    client: { id: 11, name: "Cliente Pendente" },
    lines: [{ total: 120, description: "Manutencao" }],
  },
  {
    id: 3,
    clientId: 12,
    status: "PAID",
    month: 9,
    year: 2026,
    totalAmount: 80,
    amountPaid: 80,
    client: { id: 12, name: "Cliente Pago" },
    lines: [{ total: 80, description: "Reparacao" }],
  },
  {
    id: 4,
    clientId: 13,
    status: "OVERDUE",
    month: 8,
    year: 2026,
    totalAmount: 50,
    amountPaid: 0,
    client: { id: 13, name: "Cliente Vencido" },
    lines: [{ total: 50, description: "Manutencao" }],
  },
];

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function createServer() {
  let paymentPosts = 0;

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, "http://127.0.0.1");

    if (requestUrl.pathname === "/api/invoices") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(invoices));
      return;
    }

    if (requestUrl.pathname.startsWith("/api/payments/invoice/") && req.method === "POST") {
      paymentPosts += 1;
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "draft payment must not reach backend" }));
      return;
    }

    const servedFiles = new Map([
      ["/invoices.html", path.join(FRONTEND, "invoices.html")],
      ["/invoices.js", path.join(FRONTEND, "invoices.js")],
      ["/invoice-draft-classification.js", path.join(FRONTEND, "invoice-draft-classification.js")],
    ]);

    const filePath = servedFiles.get(requestUrl.pathname);
    if (filePath) {
      res.writeHead(200, { "Content-Type": contentType(filePath) });
      res.end(fs.readFileSync(filePath));
      return;
    }

    if (requestUrl.pathname.endsWith(".js")) {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end("// browser test stub\n");
      return;
    }

    if (requestUrl.pathname.endsWith(".css")) {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end("");
      return;
    }

    res.writeHead(204);
    res.end();
  });

  return { server, getPaymentPosts: () => paymentPosts };
}

async function waitForInvoiceCount(page, count) {
  await page.waitForFunction(
    (expected) => document.querySelectorAll("#invoiceList .invoice-card").length === expected,
    count,
    { timeout: 10_000 },
  );
}

async function cardTexts(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll("#invoiceList .invoice-card")).map((card) => card.textContent));
}

async function main() {
  const { server, getPaymentPosts } = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(`${baseUrl}/invoices.html`, { waitUntil: "load" });
    await waitForInvoiceCount(page, 4);

    const snapshot = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("#invoiceList .invoice-card"));
      const draftCard = cards.find((card) => card.textContent.includes("Fatura #1"));
      const paymentButton = Array.from(draftCard.querySelectorAll("button")).find((button) => button.textContent.includes("Pagamento indisponível"));
      const copyButton = Array.from(draftCard.querySelectorAll("button")).find((button) => button.textContent.includes("Partilha disponível"));
      return {
        draftText: draftCard.textContent,
        draftClasses: Array.from(draftCard.classList),
        paymentDisabled: Boolean(paymentButton?.disabled),
        copyDisabled: Boolean(copyButton?.disabled),
        openAmount: document.getElementById("sumOpen")?.textContent,
        pendingCount: document.getElementById("sumPending")?.textContent,
        draftCount: document.getElementById("sumDrafts")?.textContent,
        hasDraftFilter: Boolean(document.querySelector('#statusFilter option[value="draft"]')),
      };
    });

    assert.match(snapshot.draftText, /RASCUNHO/);
    assert.match(snapshot.draftText, /ainda não emitido/i);
    assert.match(snapshot.draftText, /Em aberto:\s*0\.00 EUR/);
    assert(snapshot.draftClasses.includes("draft"), "draft card must have draft class");
    assert(!snapshot.draftClasses.includes("overdue"), "draft card must never be marked overdue");
    assert.strictEqual(snapshot.paymentDisabled, true, "draft payment action must be disabled");
    assert.strictEqual(snapshot.copyDisabled, true, "draft sharing action must be disabled");
    assert.strictEqual(snapshot.openAmount, "170.00 EUR", "draft amount must not count as open debt");
    assert.strictEqual(snapshot.pendingCount, "2", "draft must not count as pending/overdue");
    assert.strictEqual(snapshot.draftCount, "1", "draft summary must classify the draft explicitly");
    assert.strictEqual(snapshot.hasDraftFilter, true, "draft filter must be available");

    await page.evaluate(() => {
      const draftCard = Array.from(document.querySelectorAll("#invoiceList .invoice-card")).find((card) => card.textContent.includes("Fatura #1"));
      const button = Array.from(draftCard.querySelectorAll("button")).find((item) => item.textContent.includes("Pagamento indisponível"));
      button?.click();
    });
    assert.strictEqual(getPaymentPosts(), 0, "disabled draft action must not submit a payment");

    await page.selectOption("#statusFilter", "draft");
    await waitForInvoiceCount(page, 1);
    let texts = await cardTexts(page);
    assert(texts[0].includes("Fatura #1") && texts[0].includes("RASCUNHO"), "draft filter must show only drafts");

    await page.selectOption("#statusFilter", "paid");
    await waitForInvoiceCount(page, 1);
    texts = await cardTexts(page);
    assert(texts[0].includes("Fatura #3"), "paid filter must not classify a draft as paid");

    await page.selectOption("#statusFilter", "overdue");
    await waitForInvoiceCount(page, 2);
    texts = await cardTexts(page);
    assert(texts.some((text) => text.includes("Fatura #2")), "open pending invoice must remain in debt filter");
    assert(texts.some((text) => text.includes("Fatura #4")), "overdue invoice must remain in debt filter");
    assert(!texts.some((text) => text.includes("Fatura #1")), "draft must be excluded from debt filter");

    await page.goto(`${baseUrl}/invoices.html?status=draft`, { waitUntil: "load" });
    await waitForInvoiceCount(page, 1);
    texts = await cardTexts(page);
    assert(texts[0].includes("Fatura #1") && texts[0].includes("RASCUNHO"), "draft deep-link must preserve the draft filter");

    assert.deepStrictEqual(pageErrors, [], `browser page errors: ${pageErrors.join(" | ")}`);
    console.log("OK invoice draft classification browser");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
