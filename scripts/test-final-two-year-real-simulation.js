const fs = require("fs");
const path = require("path");

require("../src/loadEnv")();

const { Prisma, PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["warn", "error"] });
const fetchImpl = global.fetch || require("node-fetch");

const CONFIG = {
  expectedClients: Number(process.env.CW_FINAL_CLIENTS || 100),
  expectedPools: Number(process.env.CW_FINAL_POOLS || 125),
  expectedTechnicians: Number(process.env.CW_FINAL_TECHNICIANS || 9),
  expectedVehicles: Number(process.env.CW_FINAL_VEHICLES || 9),
  startMonth: process.env.CW_FINAL_START_MONTH || "2026-06",
  months: Number(process.env.CW_FINAL_MONTHS || 24),
  baseUrl: process.env.CW_BASE_URL || "http://localhost:3002",
};

const runTag = `FINAL2Y_${CONFIG.startMonth.replace(/[^0-9]/g, "")}_${Date.now()}`;
const reportDir = path.resolve(__dirname, "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `final-two-year-simulation-${runTag}.json`);

const checks = [];
let reportWritten = false;

function buildReport(summary, error = null) {
  const failed = checks.filter((item) => !item.ok);
  return {
    ok: !error && failed.length === 0,
    partial: Boolean(error),
    createdAt: new Date().toISOString(),
    config: CONFIG,
    summary: summary || null,
    checks,
    failedCount: failed.length,
    error: error
      ? {
          message: error.message,
          stack: error.stack,
        }
      : null,
  };
}

function persistReport(summary, error = null) {
  try {
    const report = buildReport(summary, error);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    reportWritten = true;
    return report;
  } catch (persistError) {
    console.error("Erro ao persistir relatorio:", persistError);
    return null;
  }
}

function delegateName(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

const modelFields = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    delegateName(model.name),
    new Set(
      model.fields
        .filter((field) => field.kind === "scalar" || field.kind === "enum")
        .map((field) => field.name)
    ),
  ])
);

function dataFor(delegate, data) {
  const fields = modelFields.get(delegate);
  if (!fields) return data;
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined && fields.has(key)) out[key] = value;
  }
  return out;
}

function chunk(items, size = 500) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function createMany(delegate, rows, batchSize = 500) {
  if (!rows.length) return;
  for (const part of chunk(rows, batchSize)) {
    await prisma[delegate].createMany({
      data: part.map((row) => dataFor(delegate, row)),
      skipDuplicates: true,
    });
  }
}

function check(name, ok, detail = "") {
  const result = { name, ok: Boolean(ok), detail };
  checks.push(result);
  console.log(`${result.ok ? "OK" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
  return result.ok;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addMonths(monthRef, offset) {
  const [year, month] = monthRef.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1, 0, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDate(monthRef, day, hour = 8, minute = 0) {
  const [year, month] = monthRef.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function dayOfMonth(index) {
  return 2 + (index % 22);
}

function productPlan(pool, index, monthIndex) {
  const isJacuzzi = String(pool.type || "").toUpperCase().includes("JACUZZI");
  if (isJacuzzi) {
    return [
      { name: "Bromo", quantity: 0.25 + ((index + monthIndex) % 3) * 0.05, unit: "KG" },
      ...((index + monthIndex) % 5 === 0 ? [{ name: "pH Menos", quantity: 0.25, unit: "KG" }] : []),
    ];
  }
  return [
    { name: "Cloro Granulado", quantity: 0.7 + ((index + monthIndex) % 4) * 0.1, unit: "KG" },
    ...((index + monthIndex) % 4 === 0 ? [{ name: "pH Menos", quantity: 0.5, unit: "KG" }] : []),
    ...((index + monthIndex) % 9 === 0 ? [{ name: "Algicida", quantity: 0.4, unit: "L" }] : []),
  ];
}

function visitStatus(poolIndex, monthIndex) {
  if ((poolIndex + monthIndex) % 37 === 0) return "NOT_DONE";
  if (monthIndex === CONFIG.months - 1 && poolIndex % 19 === 0) return "PLANNED";
  return "DONE";
}

function invoiceStatus(clientIndex, monthIndex) {
  const n = (clientIndex * 3 + monthIndex) % 23;
  if (n === 0) return "OVERDUE";
  if (n === 1) return "PARTIAL";
  if (monthIndex >= CONFIG.months - 2 && n < 5) return "PENDING";
  return "PAID";
}

async function api(method, pathname, body, expected = [200, 201]) {
  const response = await fetchImpl(`${CONFIG.baseUrl}${pathname}`, {
    method,
    headers: body === undefined ? undefined : {
      "Content-Type": "application/json",
      "x-actor": `final-two-year-${runTag}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text.slice(0, 400) };
  }
  if (!expected.includes(response.status) || (response.status < 400 && data.ok === false)) {
    throw new Error(`${method} ${pathname} -> ${response.status}: ${data.error || data.message || text.slice(0, 200)}`);
  }
  return { status: response.status, data };
}

async function loadBaseData() {
  const [clients, pools, technicians, vehicles, rounds, transportGuides, workGuides] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.pool.findMany({ where: { active: true }, include: { calculationProfile: true, equipment: true, technicalRoom: true }, orderBy: { id: "asc" } }),
    prisma.technician.findMany({ where: { active: true }, include: { vehicle: true }, orderBy: { id: "asc" } }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.round.findMany({ where: { active: true }, include: { pools: true, technicians: true }, orderBy: { id: "asc" } }),
    prisma.transportGuide.findMany({ where: { status: "ACTIVE" }, orderBy: { id: "asc" } }),
    prisma.workGuide.findMany({ where: { status: "OPEN" }, include: { items: true }, orderBy: { id: "asc" } }),
  ]);

  check("base: 100 clientes", clients.length === CONFIG.expectedClients, `${clients.length}/${CONFIG.expectedClients}`);
  check("base: 125 piscinas/jacuzzis", pools.length === CONFIG.expectedPools, `${pools.length}/${CONFIG.expectedPools}`);
  check("base: 9 tecnicos", technicians.length === CONFIG.expectedTechnicians, `${technicians.length}/${CONFIG.expectedTechnicians}`);
  check("base: 9 viaturas", vehicles.length === CONFIG.expectedVehicles, `${vehicles.length}/${CONFIG.expectedVehicles}`);
  check("base: rondas existentes", rounds.length >= 6, `${rounds.length} rondas`);
  check("base: guias AT e obra", transportGuides.length >= CONFIG.expectedVehicles && workGuides.length >= CONFIG.expectedVehicles, `AT=${transportGuides.length}, obra=${workGuides.length}`);
  check(
    "base: ficha tecnica minima por piscina",
    pools.every((pool) => pool.calculationProfile && pool.equipment && pool.technicalRoom),
    `${pools.filter((pool) => pool.calculationProfile && pool.equipment && pool.technicalRoom).length}/${pools.length}`
  );

  return { clients, pools, technicians, vehicles, rounds, transportGuides, workGuides };
}

async function createTwoYearOperations(base) {
  const { clients, pools, technicians, rounds, transportGuides, workGuides } = base;
  const roundByDay = new Map(rounds.map((round) => [round.dayOfWeek, round]));
  const workGuideByTechnician = new Map(workGuides.map((guide) => [guide.technicianId, guide]));
  const transportGuideByVehicle = new Map(transportGuides.map((guide) => [guide.vehicleId, guide]));
  const poolsByClient = new Map();
  for (const pool of pools) {
    if (!poolsByClient.has(pool.clientId)) poolsByClient.set(pool.clientId, []);
    poolsByClient.get(pool.clientId).push(pool);
  }

  const serviceVisits = [];
  const extraVisits = [];
  const reminders = [];

  for (let monthIndex = 0; monthIndex < CONFIG.months; monthIndex += 1) {
    const monthRef = addMonths(CONFIG.startMonth, monthIndex);
    for (let poolIndex = 0; poolIndex < pools.length; poolIndex += 1) {
      const pool = pools[poolIndex];
      const client = clients.find((item) => item.id === pool.clientId);
      const technician = technicians[(poolIndex + monthIndex) % technicians.length];
      const planned = monthDate(monthRef, dayOfMonth(poolIndex), 8 + (poolIndex % 8), (poolIndex % 4) * 10);
      const round = roundByDay.get(planned.getUTCDay()) || rounds[(poolIndex + monthIndex) % rounds.length];
      const status = visitStatus(poolIndex, monthIndex);
      const products = productPlan(pool, poolIndex, monthIndex);
      const totalProducts = money(products.reduce((sum, product) => sum + Number(product.quantity || 0) * 3.2, 0));
      const revenue = money(Number(pool.monthlyAmount || 0) / Math.max(1, Number(pool.serviceFrequency || 1)) + totalProducts);
      const startAt = status === "DONE" ? planned : null;
      const endAt = status === "DONE" ? addMinutes(planned, Number(pool.estimatedMinutes || 35)) : null;
      const readingsAreBad = (poolIndex + monthIndex) % 31 === 0;

      serviceVisits.push({
        clientId: pool.clientId,
        poolId: pool.id,
        technicianId: technician.id,
        technicianName: technician.name,
        roundId: round?.id || null,
        date: planned,
        plannedDate: planned,
        startAt,
        endAt,
        status,
        reason: status === "NOT_DONE" ? "Sem acesso confirmado" : null,
        notes: status === "DONE"
          ? "Manutencao realizada no fluxo final de dois anos."
          : status === "NOT_DONE"
            ? "Visita nao realizada, reagendamento necessario."
            : "Visita planeada.",
        alerts: readingsAreBad ? "pH alto e cloro baixo detectados em manutencao." : null,
        internalNotes: `${runTag}|VISIT|${monthRef}|pool:${pool.id}|client:${client?.id || pool.clientId}`,
        products: JSON.stringify(products),
        chemicalsJson: products,
        ph: readingsAreBad ? 8.35 : 7.25 + ((poolIndex + monthIndex) % 4) * 0.08,
        chlorine: readingsAreBad ? 0 : 1.6 + ((poolIndex + monthIndex) % 5) * 0.2,
        alkalinity: 88 + ((poolIndex + monthIndex) % 6) * 6,
        salt: String(pool.type || "").toUpperCase().includes("SAL") ? 3300 : null,
        temperature: String(pool.type || "").toUpperCase().includes("JACUZZI") ? 34 : 25 + ((poolIndex + monthIndex) % 4),
        orpMv: readingsAreBad ? 520 : 680 + ((poolIndex + monthIndex) % 5) * 12,
        cleaned: status === "DONE",
        brushed: status === "DONE",
        vacuumed: status === "DONE",
        basketCleaned: status === "DONE",
        waterlineClean: status === "DONE",
        backwashDone: status === "DONE",
        billed: false,
        cost: status === "DONE" ? 18 + (poolIndex % 7) : 0,
        revenue: status === "DONE" ? revenue : 0,
        profit: status === "DONE" ? money(revenue - (18 + (poolIndex % 7))) : 0,
      });

      if ((poolIndex + monthIndex) % 17 === 0) {
        const extraAt = addMinutes(planned, 160);
        extraVisits.push({
          clientId: pool.clientId,
          poolId: pool.id,
          technicianId: technician.id,
          visitType: "ONE_OFF",
          type: "EXTRA_CLEANING",
          source: "FINAL_TWO_YEAR_SIMULATION",
          origin: "ADMIN",
          scheduledAt: extraAt,
          date: extraAt,
          status: monthIndex % 8 === 0 ? "PLANNED" : "DONE",
          billingMode: "EXTRA",
          billingStatus: "PENDING",
          commercialRule: "EXTRA_BILLABLE",
          isBillable: true,
          unitPrice: 45,
          totalPrice: 45,
          price: 45,
          includedInPackage: false,
          billed: false,
          notes: "Limpeza extra pontual para teste final.",
          internalNote: `${runTag}|EXTRA|${monthRef}|pool:${pool.id}`,
        });
      }

      if ((poolIndex + monthIndex) % 53 === 0) {
        reminders.push({
          title: "Lembrete tecnico da piscina",
          description: "Cliente chega brevemente: confirmar aquecimento, agua e acesso.",
          category: "POOL_SERVICE",
          priority: "HIGH",
          status: "PENDING",
          dueAt: addMinutes(planned, -24 * 60),
          clientId: pool.clientId,
          poolId: pool.id,
          technicianId: technician.id,
          repeatRule: "CUSTOM:1:MONTHS",
          createdBy: "final-two-year-simulation",
        });
      }
    }
  }

  await createMany("serviceVisit", serviceVisits, 500);
  await createMany("extraVisit", extraVisits, 500);
  await createMany("generalReminder", reminders, 500);

  const visits = await prisma.serviceVisit.findMany({
    where: { internalNotes: { startsWith: runTag } },
    select: {
      id: true,
      clientId: true,
      poolId: true,
      technicianId: true,
      plannedDate: true,
      startAt: true,
      endAt: true,
      status: true,
      products: true,
      alerts: true,
      ph: true,
      chlorine: true,
    },
    orderBy: { id: "asc" },
  });

  const photos = [];
  const chemicalUsage = [];
  const stockMovements = [];
  const alerts = [];
  const notifications = [];
  const histories = [];
  const repairs = [];
  const tracks = [];

  for (let index = 0; index < visits.length; index += 1) {
    const visit = visits[index];
    if (visit.status !== "DONE") {
      if (visit.status === "NOT_DONE") {
        alerts.push({
          poolId: visit.poolId,
          type: "VISITA_NAO_REALIZADA",
          message: `Visita ${visit.id} nao realizada. Confirmar acesso e reagendar.`,
          priority: "HIGH",
          status: "OPEN",
          createdAt: visit.plannedDate || new Date(),
        });
        notifications.push({
          clientId: visit.clientId,
          type: "ALERT",
          eventType: "VISIT_NOT_DONE",
          title: "Visita nao realizada",
          message: `A visita ${visit.id} ficou por realizar e precisa de acao.`,
          role: "ADMIN",
          status: "PENDING",
          severity: "HIGH",
          metadata: { visitId: visit.id, poolId: visit.poolId },
          isRead: false,
          createdAt: visit.plannedDate || new Date(),
        });
      }
      continue;
    }

    if (index < 1200) {
      photos.push({ visitId: visit.id, url: `/uploads/final-two-year/${visit.id}-before.jpg`, type: "BEFORE" });
      photos.push({ visitId: visit.id, url: `/uploads/final-two-year/${visit.id}-after.jpg`, type: "AFTER" });
    }

    const products = visit.products ? JSON.parse(visit.products) : [];
    const technician = technicians.find((item) => item.id === visit.technicianId);
    const workGuide = workGuideByTechnician.get(visit.technicianId);
    const transportGuide = technician ? transportGuideByVehicle.get(technician.vehicleId) : null;

    for (const product of products) {
      chemicalUsage.push({ visitId: visit.id, name: product.name, quantity: product.quantity, unit: product.unit });
      stockMovements.push({
        movementType: "CONSUMPTION",
        scopeFrom: "VEHICLE",
        scopeTo: "POOL",
        vehicleId: technician?.vehicleId || null,
        productName: product.name,
        category: "CHEMICAL",
        unit: product.unit || "KG",
        quantity: product.quantity || 0,
        transportGuideId: transportGuide?.id || null,
        workGuideId: workGuide?.id || null,
        visitId: visit.id,
        clientId: visit.clientId,
        poolId: visit.poolId,
        technicianId: visit.technicianId,
        notes: `Consumo automatico por dosagem no teste final ${runTag}`,
        createdBy: technician?.name || "Sistema",
        createdAt: visit.plannedDate || new Date(),
      });
    }

    if (visit.alerts) {
      alerts.push({
        poolId: visit.poolId,
        type: "QUIMICA_FORA_REFERENCIA",
        message: `Visita ${visit.id}: pH ${visit.ph}, cloro ${visit.chlorine}. Criado automaticamente pelo teste final.`,
        priority: "CRITICAL",
        status: index % 4 === 0 ? "EM_ANALISE" : "OPEN",
        createdAt: visit.plannedDate || new Date(),
      });
      notifications.push({
        clientId: visit.clientId,
        type: "ALERT",
        eventType: "CHEMISTRY_ALERT",
        title: "Quimica fora de referencia",
        message: `Piscina ${visit.poolId}: rever pH/cloro da visita ${visit.id}.`,
        role: "ADMIN",
        status: "PENDING",
        severity: "CRITICAL",
        metadata: { visitId: visit.id, poolId: visit.poolId },
        isRead: false,
        createdAt: visit.plannedDate || new Date(),
      });
    }

    if (index % 80 === 0) {
      repairs.push({
        poolId: visit.poolId,
        problem: index % 160 === 0 ? "Fuga no filtro recorrente" : "Bomba com perda de pressao",
        quantity: 1,
        unitPrice: index % 160 === 0 ? 185 : 95,
        totalPrice: index % 160 === 0 ? 185 : 95,
        priority: index % 160 === 0 ? "HIGH" : "NORMAL",
        notes: `Reparacao aberta a partir da visita ${visit.id}.`,
        status: index % 240 === 0 ? "APPROVED" : "PENDING",
        paid: false,
        createdAt: visit.plannedDate || new Date(),
      });
    }

    if (index % 6 === 0) {
      histories.push({
        poolId: visit.poolId,
        type: "MAINTENANCE",
        component: "Piscina/Jacuzzi",
        message: `Historico tecnico gerado pela visita ${visit.id}`,
        description: `Leituras finais: pH ${visit.ph}, cloro ${visit.chlorine}. Produtos aplicados e fotos registadas quando necessario.`,
        status: "DONE",
        performedAt: visit.plannedDate || new Date(),
        doneAt: visit.endAt || visit.plannedDate || new Date(),
        nextSuggested: addMonthsFromDate(visit.plannedDate || new Date(), 1),
      });
    }

    if (index < 900) {
      const baseAt = visit.startAt || visit.plannedDate || new Date();
      for (let point = 0; point < 3; point += 1) {
        tracks.push({
          technicianId: visit.technicianId,
          latitude: Number((37.05 + ((visit.poolId || 0) % 60) * 0.004 + point * 0.0003).toFixed(6)),
          longitude: Number((-8.03 + ((visit.poolId || 0) % 60) * 0.003 + point * 0.0003).toFixed(6)),
          createdAt: addMinutes(baseAt, point * 10),
        });
      }
    }
  }

  await createMany("visitPhoto", photos, 500);
  await createMany("chemicalUsage", chemicalUsage, 500);
  await createMany("stockMovement", stockMovements, 500);
  await createMany("technicalAlert", alerts, 500);
  await createMany("notification", notifications, 500);
  await createMany("technicalHistory", histories, 500);
  await createMany("repair", repairs, 500);
  await createMany("technicianTrack", tracks, 500);

  await createBilling(base, poolsByClient);

  await createMany("monthlyReport", Array.from({ length: CONFIG.months }, (_, index) => {
    const monthRef = addMonths(CONFIG.startMonth, index);
    return {
      month: monthRef,
      type: "FINAL_TWO_YEAR_SUMMARY",
      clientId: null,
      data: {
        runTag,
        expectedClients: CONFIG.expectedClients,
        expectedPools: CONFIG.expectedPools,
        monthIndex: index + 1,
      },
    };
  }), 100);
}

function addMonthsFromDate(date, offset) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
}

async function createBilling(base, poolsByClient) {
  const { clients } = base;

  for (let monthIndex = 0; monthIndex < CONFIG.months; monthIndex += 1) {
    const monthRef = addMonths(CONFIG.startMonth, monthIndex);
    const monthNumber = Number(monthRef.slice(5, 7));
    const yearNumber = Number(monthRef.slice(0, 4));
    for (let clientIndex = 0; clientIndex < clients.length; clientIndex += 1) {
      const client = clients[clientIndex];
      const clientPools = poolsByClient.get(client.id) || [];
      const monthly = money(clientPools.reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0));
      const extra = (clientIndex + monthIndex) % 7 === 0 ? 45 : 0;
      const repair = (clientIndex + monthIndex) % 19 === 0 ? 95 : 0;
      const total = money(monthly + extra + repair);
      const status = invoiceStatus(clientIndex, monthIndex);
      const paid = status === "PAID" ? total : status === "PARTIAL" ? money(total * 0.5) : 0;
      const open = money(total - paid);
      const dueDate = monthDate(monthRef, 28, 23, 0);
      const issueDate = monthDate(monthRef, 25, 9, 0);
      const paidAt = paid > 0 ? monthDate(monthRef, 29, 12, 0) : null;

      let invoice = await prisma.invoice.findUnique({
        where: { clientId_monthRef: { clientId: client.id, monthRef } },
      }).catch(() => null);

      if (invoice) {
        invoice = await prisma.invoice.update({
          where: { id: invoice.id },
          data: dataFor("invoice", {
            year: yearNumber,
            month: monthRef,
            amount: total,
            amountCents: Math.round(total * 100),
            total,
            totalCents: Math.round(total * 100),
            subtotal: total,
            subtotalCurrent: monthly,
            subtotalArrears: money(extra + repair),
            totalAmount: total,
            amountPaid: paid,
            amountOpen: open,
            status,
            paymentMethod: paid > 0 ? "TRANSFER" : null,
            notes: `Faturacao recalculada pelo teste final ${runTag}`,
            paidAt,
            dueDate,
            issueDate,
            requiresInvoice: Boolean(client.requiresInvoice),
          }),
        });
      } else {
        invoice = await prisma.invoice.create({
          data: dataFor("invoice", {
            clientId: client.id,
            monthRef,
            year: yearNumber,
            month: monthRef,
            amount: total,
            amountCents: Math.round(total * 100),
            total,
            totalCents: Math.round(total * 100),
            subtotal: total,
            subtotalCurrent: monthly,
            subtotalArrears: money(extra + repair),
            totalAmount: total,
            amountPaid: paid,
            amountOpen: open,
            status,
            paymentMethod: paid > 0 ? "TRANSFER" : null,
            notes: `Fatura mensal do teste final ${runTag}`,
            paidAt,
            dueDate,
            issueDate,
            invoiceNumber: `F2Y-${monthRef.replace("-", "")}-${String(client.id).padStart(5, "0")}`,
            requiresInvoice: Boolean(client.requiresInvoice),
          }),
        });
      }

      const existingFinalLine = await prisma.invoiceLine.findFirst({
        where: { invoiceId: invoice.id, sourceMonth: monthRef, notes: { contains: runTag } },
        select: { id: true },
      });
      if (!existingFinalLine) {
        await prisma.invoiceLine.create({
          data: dataFor("invoiceLine", {
            invoiceId: invoice.id,
            type: "MONTHLY",
            lineType: "MONTHLY",
            description: `Mensalidade ${monthRef}`,
            quantity: 1,
            unitPrice: monthly,
            total: monthly,
            lineTotal: monthly,
            sourceMonth: monthRef,
            notes: runTag,
          }),
        });
        if (extra > 0) {
          await prisma.invoiceLine.create({
            data: dataFor("invoiceLine", {
              invoiceId: invoice.id,
              type: "EXTRA",
              lineType: "EXTRA",
              description: "Visita extra pontual",
              quantity: 1,
              unitPrice: extra,
              total: extra,
              lineTotal: extra,
              sourceMonth: monthRef,
              notes: runTag,
            }),
          });
        }
        if (repair > 0) {
          await prisma.invoiceLine.create({
            data: dataFor("invoiceLine", {
              invoiceId: invoice.id,
              type: "REPAIR",
              lineType: "REPAIR",
              description: "Reparacao tecnica",
              quantity: 1,
              unitPrice: repair,
              total: repair,
              lineTotal: repair,
              sourceMonth: monthRef,
              notes: runTag,
            }),
          });
        }
      }

      if (paid > 0) {
        const existingPayment = await prisma.payment.findFirst({
          where: { invoiceId: invoice.id, notes: { contains: runTag } },
          select: { id: true },
        });
        if (!existingPayment) {
          await prisma.payment.create({
            data: dataFor("payment", {
              invoiceId: invoice.id,
              amount: paid,
              amountCents: Math.round(paid * 100),
              method: status === "PAID" ? "TRANSFER" : "MBWAY",
              notes: `Pagamento do teste final ${runTag}`,
              paidAt,
            }),
          });
        }
      }

      if (status !== "PAID" && monthIndex % 4 === 0) {
        await prisma.clientMessage.create({
          data: dataFor("clientMessage", {
            clientId: client.id,
            sender: "Sistema",
            senderType: "SYSTEM",
            message: `Aviso de pagamento ${monthRef}. Referencia fixa do cliente: CW-${String(client.id).padStart(6, "0")}. Valor em aberto: ${open.toFixed(2)} EUR.`,
            text: `Aviso de pagamento ${monthRef}. Referencia fixa do cliente: CW-${String(client.id).padStart(6, "0")}. Valor em aberto: ${open.toFixed(2)} EUR.`,
            isReadByAdmin: false,
            seen: false,
            messageType: "PAYMENT_NOTICE",
            createdAt: monthDate(monthRef, 29, 16, 0),
          }),
        });
      }
    }
  }

  for (const client of clients) {
    const lastInvoice = await prisma.invoice.findFirst({
      where: { clientId: client.id },
      orderBy: [{ monthRef: "desc" }, { id: "desc" }],
    });
    await prisma.client.update({
      where: { id: client.id },
      data: dataFor("client", {
        monthlyFee: money((poolsByClient.get(client.id) || []).reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0)),
        monthlyAmount: money((poolsByClient.get(client.id) || []).reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0)),
        paymentStatus: lastInvoice?.status || client.paymentStatus,
        lastPaymentAt: lastInvoice?.paidAt || client.lastPaymentAt,
        lastReminderAt: lastInvoice && lastInvoice.status !== "PAID" ? lastInvoice.dueDate : client.lastReminderAt,
        lastReminderMonth: lastInvoice && lastInvoice.status !== "PAID" ? lastInvoice.monthRef : client.lastReminderMonth,
      }),
    });
  }
}

async function validateDatabase(base) {
  const monthRefs = Array.from({ length: CONFIG.months }, (_, index) => addMonths(CONFIG.startMonth, index));
  const [
    visitCount,
    doneCount,
    notDoneCount,
    plannedCount,
    invoiceCount,
    paidInvoices,
    partialInvoices,
    overdueInvoices,
    payments,
    chemicalUsage,
    stockMovements,
    photos,
    alerts,
    criticalAlerts,
    repairs,
    reminders,
    messagesUnread,
    externalInvoices,
    gpsTracks,
    reports,
    invoiceTotals,
  ] = await Promise.all([
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag } } }),
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag }, status: "DONE" } }),
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag }, status: "NOT_DONE" } }),
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag }, status: "PLANNED" } }),
    prisma.invoice.count({ where: { monthRef: { in: monthRefs } } }),
    prisma.invoice.count({ where: { monthRef: { in: monthRefs }, status: "PAID" } }),
    prisma.invoice.count({ where: { monthRef: { in: monthRefs }, status: "PARTIAL" } }),
    prisma.invoice.count({ where: { monthRef: { in: monthRefs }, status: "OVERDUE" } }),
    prisma.payment.count(),
    prisma.chemicalUsage.count(),
    prisma.stockMovement.count(),
    prisma.visitPhoto.count(),
    prisma.technicalAlert.count(),
    prisma.technicalAlert.count({ where: { priority: "CRITICAL" } }),
    prisma.repair.count(),
    prisma.generalReminder.count(),
    prisma.clientMessage.count({ where: { isReadByAdmin: false } }),
    prisma.invoice.count({ where: { monthRef: { in: monthRefs }, requiresInvoice: true } }),
    prisma.technicianTrack.count(),
    prisma.monthlyReport.count({ where: { type: "FINAL_TWO_YEAR_SUMMARY" } }),
    prisma.invoice.aggregate({ where: { monthRef: { in: monthRefs } }, _sum: { total: true, amountOpen: true, amountPaid: true } }),
  ]);

  check("dois anos: visitas criadas", visitCount === CONFIG.expectedPools * CONFIG.months, `${visitCount}/${CONFIG.expectedPools * CONFIG.months}`);
  check("dois anos: visitas concluidas", doneCount > CONFIG.expectedPools * 20, `${doneCount}`);
  check("dois anos: visitas nao realizadas ficam visiveis", notDoneCount > 0, `${notDoneCount}`);
  check("dois anos: visitas futuras/pendentes ficam visiveis", plannedCount > 0, `${plannedCount}`);
  check("financeiro: fatura por cliente e mes", invoiceCount >= CONFIG.expectedClients * CONFIG.months, `${invoiceCount}/${CONFIG.expectedClients * CONFIG.months}`);
  check("financeiro: estados variados", paidInvoices > 0 && partialInvoices > 0 && overdueInvoices > 0, `paid=${paidInvoices}, partial=${partialInvoices}, overdue=${overdueInvoices}`);
  check("financeiro: pagamentos registados", payments > CONFIG.expectedClients, `${payments}`);
  check("financeiro: clientes com fatura externa identificaveis", externalInvoices > 0, `${externalInvoices}`);
  check("stock: consumo automatico por dosagem", chemicalUsage > 0 && stockMovements > 0, `quimicos=${chemicalUsage}, movimentos=${stockMovements}`);
  check("registo: fotos de visita", photos >= 1000, `${photos}`);
  check("alertas: problemas operacionais", alerts > 0 && criticalAlerts > 0, `total=${alerts}, criticos=${criticalAlerts}`);
  check("reparacoes: abertas por problemas recorrentes", repairs > 0, `${repairs}`);
  check("lembretes: por piscina/servico", reminders > 0, `${reminders}`);
  check("mensagens: notificacoes para admin", messagesUnread > 0, `${messagesUnread}`);
  check("gps: linhas de tempo em campo", gpsTracks > 0, `${gpsTracks}`);
  check("relatorios: resumo mensal por dois anos", reports >= CONFIG.months, `${reports}/${CONFIG.months}`);

  const missingTechnical = await prisma.pool.count({
    where: {
      active: true,
      OR: [
        { calculationProfile: null },
        { equipment: null },
        { technicalRoom: null },
      ],
    },
  });
  check("integridade: nenhuma piscina ativa sem ficha tecnica minima", missingTechnical === 0, `${missingTechnical} em falta`);

  const poolsWithoutRound = await prisma.pool.count({
    where: {
      active: true,
      roundPools: { none: {} },
    },
  });
  check("integridade: piscinas ativas em rondas", poolsWithoutRound === 0, `${poolsWithoutRound} sem ronda`);

  const duplicatePhysicalPools = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT address, location, type
      FROM "Pool"
      WHERE address IS NOT NULL AND location IS NOT NULL AND type IS NOT NULL
      GROUP BY address, location, type
      HAVING COUNT(*) > 1
    ) dup
  `;
  const duplicateCount = Number(duplicatePhysicalPools?.[0]?.count || 0);
  check("integridade: sem piscinas duplicadas por morada/local/tipo", duplicateCount === 0, `${duplicateCount} duplicados`);

  const firstClient = base.clients[0];
  const firstTechnician = base.technicians[0];
  const firstVisit = await prisma.serviceVisit.findFirst({
    where: { internalNotes: { startsWith: runTag }, technicianId: firstTechnician.id },
    orderBy: { plannedDate: "asc" },
  });
  const day = firstVisit?.plannedDate ? firstVisit.plannedDate.toISOString().slice(0, 10) : `${CONFIG.startMonth}-02`;

  await api("GET", "/api/core/health");
  const dashboard = await api("GET", "/api/core/dashboard");
  check("api: dashboard responde", dashboard.data.ok !== false, "core/dashboard");

  const rounds = await api("GET", "/api/core/rounds");
  check("api: rondas respondem", Array.isArray(rounds.data.rounds) && rounds.data.rounds.length > 0, `${rounds.data.rounds?.length || 0}`);

  const invoices = await api("GET", "/api/core/invoices");
  check("api: faturas respondem", Array.isArray(invoices.data.invoices) && invoices.data.invoices.length >= CONFIG.expectedClients, `${invoices.data.invoices?.length || 0}`);

  const portal = await api("GET", `/api/client-portal/${firstClient.id}?lang=pt`);
  const paymentReference =
    portal.data.paymentInstructions?.paymentReference
    || portal.data.client?.paymentReference
    || "";
  check("portal cliente: dados reais e referencia de pagamento", portal.data.ok !== false && portal.data.client && paymentReference, paymentReference);
  check("portal cliente: faturas visiveis", Array.isArray(portal.data.invoices) && portal.data.invoices.length > 0, `${portal.data.invoices?.length || 0}`);

  const technicianToday = await api("GET", `/api/technician/today?technicianId=${firstTechnician.id}&date=${day}`);
  const techVisits = technicianToday.data.visits || technicianToday.data.rounds || [];
  check("portal tecnico: ronda filtrada por tecnico e dia", Array.isArray(techVisits) && techVisits.length > 0 && techVisits.length < 40, `${techVisits.length} visita(s) em ${day}`);

  const invalidVisit = await prisma.serviceVisit.findFirst({
    where: { internalNotes: { startsWith: runTag }, status: "PLANNED" },
    orderBy: { id: "desc" },
  });
  if (invalidVisit) {
    const invalid = await api("POST", `/api/core/visits/${invalidVisit.id}/complete`, {
      ph: 14,
      chlorine: 1,
      alkalinity: 90,
      orpMv: 700,
      temperature: 25,
      products: [{ name: "Cloro Granulado", quantity: 1, unit: "KG" }],
    }, [400]);
    check("edge: pH impossivel bloqueado", invalid.status === 400, "400 esperado");
  }

  const completedVisit = await prisma.serviceVisit.findFirst({
    where: { internalNotes: { startsWith: runTag }, status: "DONE" },
    orderBy: { id: "asc" },
  });
  if (completedVisit) {
    const secondComplete = await api("POST", `/api/core/visits/${completedVisit.id}/complete`, {
      ph: 7.4,
      chlorine: 2,
      alkalinity: 100,
      orpMv: 720,
      temperature: 26,
      products: [{ name: "Cloro Granulado", quantity: 1, unit: "KG" }],
    }, [409]);
    check("edge: dupla conclusao bloqueada", secondComplete.status === 409, "409 esperado");
  }

  return {
    runTag,
    months: monthRefs,
    counts: {
      visitCount,
      doneCount,
      notDoneCount,
      plannedCount,
      invoiceCount,
      paidInvoices,
      partialInvoices,
      overdueInvoices,
      payments,
      chemicalUsage,
      stockMovements,
      photos,
      alerts,
      criticalAlerts,
      repairs,
      reminders,
      messagesUnread,
      externalInvoices,
      gpsTracks,
      reports,
      invoiceTotals: invoiceTotals._sum,
    },
  };
}

async function main() {
  console.log(`Teste final dois anos: ${runTag}`);
  let summary = null;

  const flushOnSignal = (signal) => {
    const partial = persistReport(summary, new Error(`Finalizacao por sinal ${signal}`));
    if (partial) {
      console.log(`Relatorio parcial: ${reportPath}`);
    }
    process.exit(1);
  };

  process.once("SIGINT", () => flushOnSignal("SIGINT"));
  process.once("SIGTERM", () => flushOnSignal("SIGTERM"));

  try {
    const base = await loadBaseData();
    await createTwoYearOperations(base);
    summary = await validateDatabase(base);
    const report = persistReport(summary, null) || buildReport(summary, null);
    const failed = checks.filter((item) => !item.ok);

    console.log(`Relatorio: ${reportPath}`);
    console.log(`Resultado: ${failed.length === 0 ? "SUCCESS" : "FAIL"} (${checks.length - failed.length}/${checks.length} checks)`);
    if (failed.length) {
      for (const item of failed) console.log(`FALHA: ${item.name} - ${item.detail}`);
      process.exit(1);
    }
    return report;
  } catch (error) {
    persistReport(summary, error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Erro no teste final de dois anos:", error);
    if (!reportWritten) {
      persistReport(null, error);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
