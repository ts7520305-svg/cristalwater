const fs = require("fs");
const path = require("path");

require("../src/loadEnv")();

const prismaModule = require("../src/prismaClient");
const prisma = prismaModule.prisma || prismaModule.default || prismaModule;
const fetchImpl = global.fetch || require("node-fetch");

const BASE_URL = process.env.CW_BASE_URL || "http://localhost:3002";
const monthRef = process.env.CW_SECOND_MONTH_REF || "2026-07";
const runId = `SECOND-MONTH-${Date.now()}`;
const secondMonthStart = new Date(Date.UTC(2026, 6, 1, 0, 0, 0));
const secondMonthEnd = new Date(Date.UTC(2026, 7, 1, 0, 0, 0));
const reportDir = path.resolve(__dirname, "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });

const checks = [];
const created = {
  visits: [],
  billableWork: [],
  invoices: [],
  payments: [],
  notices: [],
};

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function call(method, pathname, body = undefined, expected = [200, 201]) {
  const response = await fetchImpl(`${BASE_URL}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json", "x-actor": `qa-second-month-${runId}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!expected.includes(response.status) || (response.status < 400 && data.ok === false)) {
    throw new Error(`${method} ${pathname} -> ${response.status}: ${data.error || data.message || text}`);
  }
  return { status: response.status, data };
}

function iso(day, hour = 9, minute = 0) {
  return new Date(Date.UTC(2026, 6, day, hour, minute, 0)).toISOString();
}

function paymentReference(clientId) {
  return `CW-${String(clientId).padStart(6, "0")}`;
}

async function createSecondMonthVisits() {
  const existingVisits = await prisma.serviceVisit.count({
    where: {
      plannedDate: {
        gte: secondMonthStart,
        lt: secondMonthEnd,
      },
    },
  });
  if (existingVisits >= 30) {
    check("segundo mes ja tinha visitas reais", true, `${existingVisits} visitas existentes`);
    return;
  }

  const clients = await prisma.client.findMany({
    orderBy: { id: "asc" },
    include: { pools: { orderBy: { id: "asc" } } },
  });
  const technicians = await prisma.technician.findMany({ orderBy: { id: "asc" } });
  const rounds = await prisma.round.findMany({ orderBy: { id: "asc" } });
  const workGuides = await prisma.workGuide.findMany({ orderBy: { id: "asc" } });

  check("base tem clientes para segundo mes", clients.length >= 5, `${clients.length} clientes`);
  check("base tem tecnicos, rondas e guias", technicians.length >= 3 && rounds.length >= 3 && workGuides.length >= 3, `${technicians.length} tecnicos, ${rounds.length} rondas, ${workGuides.length} guias`);

  let visitIndex = 0;
  for (const client of clients) {
    for (const pool of client.pools) {
      for (const day of [3, 10, 17, 24]) {
        const technician = technicians[visitIndex % technicians.length];
        const round = rounds[visitIndex % rounds.length];
        const workGuide = workGuides[visitIndex % workGuides.length];
        const visit = await call("POST", "/api/core/visits", {
          poolId: pool.id,
          roundId: round.id,
          technicianId: technician.id,
          plannedDate: iso(day, 8 + (visitIndex % 6), 30),
          notes: `Segundo mes ${monthRef} ${runId}`,
        });
        const serviceVisit = visit.data.visit;
        created.visits.push(serviceVisit);

        const products = pool.type === "JACUZZI"
          ? [{ name: "Bromo", quantity: 0.2, unit: "KG" }]
          : [{ name: "Cloro pastilhas", quantity: 0.7, unit: "KG" }];

        await call("POST", `/api/core/visits/${serviceVisit.id}/complete`, {
          ph: visitIndex % 6 === 0 ? 7.9 : 7.4,
          chlorine: pool.type === "JACUZZI" ? 0 : visitIndex % 6 === 0 ? 0.7 : 1.9,
          alkalinity: 95,
          orpMv: 705,
          temperature: 28,
          workGuideId: workGuide.id,
          vehicleId: workGuide.vehicleId,
          products,
          cleaned: true,
          brushed: true,
          vacuumed: true,
          basketCleaned: true,
          waterlineClean: true,
          backwashDone: visitIndex % 2 === 0,
          notes: `Servico de julho concluido ${runId}`,
        });
        visitIndex += 1;
      }
    }
  }
}

async function createSecondMonthInvoices() {
  const clients = await prisma.client.findMany({ orderBy: { id: "asc" } });
  for (const [index, client] of clients.entries()) {
    const invoice = await call("POST", "/api/core/invoices/generate", {
      clientId: client.id,
      monthRef,
    });
    created.invoices.push(invoice.data.invoice);

    if (index === 2) {
      if (invoice.data.invoice.status === "PAID") continue;
      const total = Number(invoice.data.invoice.total || invoice.data.invoice.amount || 0);
      const payment = await call("POST", `/api/core/invoices/${invoice.data.invoice.id}/pay`, {
        amount: total,
        method: "TRANSFER",
        notes: `Pagamento manual sem login do cliente. Referencia ${paymentReference(client.id)}. ${runId}`,
      });
      created.payments.push(payment.data.payment || payment.data);
    }

    if (index === 3) {
      if (["PAID", "PARTIAL"].includes(String(invoice.data.invoice.status || "").toUpperCase())) continue;
      const total = Number(invoice.data.invoice.total || invoice.data.invoice.amount || 0);
      const payment = await call("POST", `/api/core/invoices/${invoice.data.invoice.id}/pay`, {
        amount: Math.max(20, total / 2),
        method: "MBWAY",
        notes: `Pagamento parcial manual por WhatsApp. Referencia ${paymentReference(client.id)}. ${runId}`,
      });
      created.payments.push(payment.data.payment || payment.data);
    }
  }
}

async function createBillableSecondMonthWork() {
  const clients = await prisma.client.findMany({
    orderBy: { id: "asc" },
    include: { pools: { orderBy: { id: "asc" } } },
  });
  const technicians = await prisma.technician.findMany({ orderBy: { id: "asc" } });
  const rounds = await prisma.round.findMany({ orderBy: { id: "asc" } });

  const client = clients[0];
  const pool = client?.pools?.[0];
  const technician = technicians[0];
  const round = rounds[0];
  check("base permite servicos faturaveis", Boolean(client && pool && technician && round), client ? client.name : "-");
  if (!client || !pool || !technician || !round) return;

  const existingService = await prisma.serviceVisit.count({
    where: {
      clientId: client.id,
      notes: { contains: "Servico faturavel segundo mes" },
      plannedDate: { gte: secondMonthStart, lt: secondMonthEnd },
    },
  });
  if (!existingService) {
    const visit = await call("POST", "/api/core/visits", {
      poolId: pool.id,
      roundId: round.id,
      technicianId: technician.id,
      plannedDate: iso(15, 14, 0),
      notes: `Servico faturavel segundo mes ${runId}`,
    });
    const serviceVisit = visit.data.visit;
    await call("POST", `/api/core/visits/${serviceVisit.id}/complete`, {
      ph: 7.3,
      chlorine: 1.7,
      alkalinity: 90,
      orpMv: 700,
      temperature: 27,
      cleaned: true,
      notes: `Servico faturavel segundo mes ${runId}`,
    });
    await call("PATCH", `/api/round-planner/visits/${serviceVisit.id}`, {
      revenue: 65,
      notes: `Servico faturavel segundo mes ${runId}`,
    });
    created.billableWork.push({ type: "SERVICE", id: serviceVisit.id, amount: 65 });
  }

  const existingExtra = await prisma.extraVisit.count({
    where: {
      clientId: client.id,
      notes: { contains: "Limpeza extra faturavel segundo mes" },
      scheduledAt: { gte: secondMonthStart, lt: secondMonthEnd },
    },
  });
  if (!existingExtra) {
    const extra = await call("POST", "/api/extra-visits", {
      poolId: pool.id,
      technicianId: technician.id,
      scheduledAt: iso(16, 11, 0),
      visitType: "ONE_OFF",
      type: "EXTRA_CLEANING",
      billingMode: "EXTRA",
      unitPrice: 45,
      totalPrice: 45,
      notes: `Limpeza extra faturavel segundo mes ${runId}`,
    });
    const extraVisit = extra.data.extraVisit;
    await call("PUT", `/api/extra-visits/${extraVisit.id}/status`, { status: "DONE" });
    created.billableWork.push({ type: "EXTRA_VISIT", id: extraVisit.id, amount: 45 });
  }
}

async function createPaymentNotices() {
  const clients = await prisma.client.findMany({ orderBy: { id: "asc" } });
  for (const client of clients.slice(0, 2)) {
    const notice = await call("POST", `/api/client-portal/${client.id}/payment-notice`, {
      amount: client.id === 1 ? 0 : 50,
      method: client.id === 1 ? "PORTAL_TEST" : "WHATSAPP",
      note: `Aviso de pagamento/controlo de cobranca ${runId}`,
      reference: paymentReference(client.id),
      source: client.id === 1 ? "PORTAL_CLIENTE" : "WHATSAPP_MANUAL",
    }, [200, 201]);
    created.notices.push(notice.data);
  }
}

async function validateSecondMonth() {
  const clients = await prisma.client.findMany({
    orderBy: { id: "asc" },
    include: {
      invoices: { where: { monthRef }, include: { payments: true, lines: true }, orderBy: { id: "asc" } },
    },
  });
  const clientOnePortal = await call("GET", `/api/client-portal/1?lang=pt`);
  const noLoginPortal = await call("GET", `/api/client-portal/0?lang=pt`, undefined, [400, 404]);
  const visitCount = await prisma.serviceVisit.count({
    where: {
      plannedDate: {
        gte: secondMonthStart,
        lt: secondMonthEnd,
      },
    },
  });
  const chemicalCount = await prisma.chemicalUsage.count({
    where: {
      visit: {
        plannedDate: {
          gte: secondMonthStart,
          lt: secondMonthEnd,
        },
      },
    },
  }).catch(() => 0);
  const invoices = clients.flatMap((client) => client.invoices);

  const openClientOne = Number(clientOnePortal.data.summary?.totalOpen || 0);
  const statuses = invoices.map((invoice) => invoice.status);
  const invoicesWithPayments = invoices.filter((invoice) => invoice.payments.length > 0).length;
  const lineTypes = invoices.flatMap((invoice) => invoice.lines.map((line) => line.type || line.lineType));

  check("segundo mes criou visitas reais", visitCount >= 30, `${visitCount} visitas`);
  check("segundo mes gerou faturas para todos os clientes", invoices.length === clients.length, `${invoices.length}/${clients.length}`);
  check("faturacao inclui manutencao mensal", lineTypes.includes("MONTHLY"), lineTypes.join(", "));
  check("faturacao inclui servicos avulsos", lineTypes.includes("SERVICE"), lineTypes.join(", "));
  check("faturacao inclui visitas extra", lineTypes.includes("EXTRA_VISIT"), lineTypes.join(", "));
  check("cliente 1 tem valor aberto para pagar", openClientOne > 0, `${openClientOne.toFixed(2)} EUR em aberto`);
  check("portal cliente mostra referencia fixa", clientOnePortal.data.paymentInstructions?.paymentReference === "CW-000001", clientOnePortal.data.paymentInstructions?.paymentReference || "-");
  check("pagamento manual sem login ficou registado", statuses.includes("PAID") && invoicesWithPayments >= 2, `${invoicesWithPayments} faturas com pagamentos; ${statuses.join(", ")}`);
  check("pagamento parcial ficou registado", statuses.includes("PARTIAL"), statuses.join(", "));
  check("cliente sem identificacao nao ve dados privados", [400, 404].includes(noLoginPortal.status), `status ${noLoginPortal.status}`);
  check("avisos de pagamento foram registados", created.notices.length >= 2, `${created.notices.length} avisos`);

  return {
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      paymentReference: paymentReference(client.id),
      invoices: client.invoices.map((invoice) => ({
        id: invoice.id,
        monthRef: invoice.monthRef,
        status: invoice.status,
        total: invoice.total,
        paid: invoice.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        lines: invoice.lines.length,
      })),
    })),
    clientOneOpen: openClientOne,
    visitCount,
    chemicalCount,
  };
}

async function main() {
  console.log(`Cristal Water - teste segundo mes (${runId})`);
  await call("GET", "/api/core/health");
  await createSecondMonthVisits();
  await createBillableSecondMonthWork();
  await createSecondMonthInvoices();
  await createPaymentNotices();
  const details = await validateSecondMonth();

  const failed = checks.filter((item) => !item.ok);
  const report = {
    runId,
    monthRef,
    status: failed.length ? "FAILED" : "PASSED",
    created: {
      visits: created.visits.map((item) => item.id),
      billableWork: created.billableWork,
      invoices: created.invoices.map((item) => item.id),
      payments: created.payments.length,
      notices: created.notices.length,
    },
    details,
    checks,
  };
  const file = path.join(reportDir, `second-month-flow-${runId}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`Relatorio: ${file}`);

  if (failed.length) {
    failed.forEach((item) => console.error(`- ${item.name}: ${item.detail}`));
    process.exit(1);
  }
}

main()
  .catch((error) => {
    const file = path.join(reportDir, `second-month-flow-${runId}-FAILED.json`);
    fs.writeFileSync(file, JSON.stringify({ runId, monthRef, status: "ERROR", error: error.message, checks }, null, 2));
    console.error(error.message);
    console.error(`Relatorio: ${file}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
