const fs = require("fs");
const path = require("path");

require("../src/loadEnv")();

const prismaModule = require("../src/prismaClient");
const prisma = prismaModule.prisma || prismaModule.default || prismaModule;
const fetchImpl = global.fetch || require("node-fetch");

const BASE_URL = process.env.CW_BASE_URL || "http://localhost:3002";
const monthRef = "2026-06";
const runId = `REAL-MES-${Date.now()}`;
const reportDir = path.resolve(__dirname, "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });

const checks = [];
let adminToken = null;
let tempAdminUserId = null;
const created = {
  clients: [],
  pools: [],
  technicians: [],
  vehicles: [],
  rounds: [],
  visits: [],
  invoices: [],
  workGuides: [],
  transportGuides: [],
};

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  const mark = ok ? "OK" : "FAIL";
  console.log(`${mark} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function call(method, pathname, body = undefined, expected = [200, 201]) {
  const token = await ensureAdminToken();
  const response = await fetchImpl(`${BASE_URL}${pathname}`, {
    method,
    headers: body instanceof FormData ? undefined : {
      "Content-Type": "application/json",
      "x-actor": `qa-real-month-${runId}`,
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!expected.includes(response.status) || (response.status < 400 && data.ok === false)) {
    const message = data.error || data.message || response.statusText || text;
    throw new Error(`${method} ${pathname} -> ${response.status}: ${message}`);
  }
  return { status: response.status, data };
}

async function loginAdmin(email, password) {
  const response = await fetchImpl(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data, text };
}

async function ensureAdminToken() {
  if (adminToken) return adminToken;

  const envEmail = process.env.ADMIN_EMAIL || "cristal.water@sapo.pt";
  const envPassword = process.env.ADMIN_PASSWORD || "";
  if (envPassword) {
    const envLogin = await loginAdmin(envEmail, envPassword);
    if (envLogin.ok && envLogin.data?.token) {
      adminToken = envLogin.data.token;
      return adminToken;
    }
  }

  const marker = `REAL_FLOW_${runId}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `${marker.toLowerCase()}@qa-real-flow.test`;
  const plainPassword = `Tmp-${marker}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      active: true,
      name: `QA REAL FLOW ${marker}`,
      mustChangePassword: false,
    },
  });
  tempAdminUserId = user.id;

  const login = await loginAdmin(email, plainPassword);
  if (!login.ok || !login.data?.token) {
    throw new Error(`Admin login failed: ${login.status} ${login.data?.error || login.data?.message || login.text || "unknown"}`);
  }

  adminToken = login.data.token;
  return adminToken;
}

function iso(day, hour = 9, minute = 0) {
  return new Date(Date.UTC(2026, 5, day, hour, minute, 0)).toISOString();
}

function productPlan(index, type) {
  if (type === "JACUZZI") return [{ name: "Bromo", quantity: 0.25, unit: "KG" }];
  if (index % 5 === 0) return [{ name: "Cloro shock", quantity: 2, unit: "KG" }, { name: "pH menos", quantity: 1, unit: "KG" }];
  if (index % 3 === 0) return [{ name: "Algicida", quantity: 1, unit: "L" }];
  return [{ name: "Cloro pastilhas", quantity: 0.8, unit: "KG" }];
}

async function createClient(payload) {
  const { data } = await call("POST", "/api/core/clients", payload);
  created.clients.push(data.client);
  await call("POST", `/api/core/clients/${data.client.id}/activate`, { amount: 0 });
  return data.client;
}

async function createPool(client, payload) {
  const { data } = await call("POST", `/api/core/clients/${client.id}/pools`, payload);
  created.pools.push(data.pool);
  await call("PUT", `/api/core/pools/${data.pool.id}/technical-sheet`, {
    ...payload,
    pumpType: payload.type === "JACUZZI" ? "Bomba jacuzzi 0.75CV" : "Bomba piscina 1.5CV",
    pumpPower: payload.type === "JACUZZI" ? "0.75 CV" : "1.5 CV",
    filterType: payload.type === "JACUZZI" ? "Cartucho" : "Areia",
    filterMedia: payload.type === "JACUZZI" ? "Cartucho" : "Vidro",
    saltSystem: payload.disinfectionType === "SAL",
    technicalRoomCondition: "Boa",
    technicalRoomLocation: "Casa tecnica acessivel",
    technicalRoomVentilation: "Adequada",
    technicalRoomElectrical: "Quadro identificado",
    shape: "RECTANGULAR",
    targetChlorinePpm: payload.type === "JACUZZI" ? 0 : 2,
    targetSalinityPpm: payload.disinfectionType === "SAL" ? 3400 : 0,
    historyNote: `Ficha tecnica real QA ${runId}`,
  });
  return data.pool;
}

async function setupPeopleAndFleet() {
  for (let i = 1; i <= 3; i += 1) {
    const { data } = await call("POST", "/api/core/technicians", {
      name: `QA Real Tecnico ${i} ${runId}`,
      email: `qa.real.tecnico.${i}.${runId}@cristalwater.test`,
      phone: `91000000${i}`,
      pin: `90${i}${i}`,
      zone: i === 1 ? "Cascais" : i === 2 ? "Sintra" : "Lisboa",
    });
    created.technicians.push(data.technician);

    const vehicle = await call("POST", "/api/guides/vehicles", {
      plate: `QA-${String(i).padStart(2, "0")}-${String(runId).slice(-2)}`,
      name: `Viatura QA Real ${i}`,
      brand: "Toyota",
      model: "Proace",
      year: 2024,
      currentKm: 10000 + i * 100,
      notes: `Teste real mensal ${runId}`,
    });
    created.vehicles.push(vehicle.data.vehicle);

    await call("POST", "/api/guides/vehicles/assign", {
      technicianId: data.technician.id,
      vehicleId: vehicle.data.vehicle.id,
      startKm: 10000 + i * 100,
      notes: `Inicio de mes QA real ${runId}`,
    });

    const guide = await call("POST", "/api/guides/transport", {
      codeAT: `AT-${runId}-${i}`,
      vehicleId: vehicle.data.vehicle.id,
      technicianId: data.technician.id,
      validFrom: iso(1, 7),
      validUntil: iso(30, 20),
      origin: "Armazem Cristal Water",
      destination: "Clientes em rota",
      isDraft: false,
      startKm: 10000 + i * 100,
      items: [
        { name: "Cloro pastilhas", type: "CHEMICAL", unit: "KG", quantity: 80 },
        { name: "Cloro shock", type: "CHEMICAL", unit: "KG", quantity: 60 },
        { name: "pH menos", type: "CHEMICAL", unit: "KG", quantity: 50 },
        { name: "Algicida", type: "CHEMICAL", unit: "L", quantity: 40 },
        { name: "Bromo", type: "CHEMICAL", unit: "KG", quantity: 10 },
      ],
      notes: `Guia AT real QA ${runId}`,
    });
    created.transportGuides.push(guide.data.guide);
    if (guide.data.workGuide) created.workGuides.push(guide.data.workGuide);
  }
}

async function setupClientsAndPools() {
  const specs = [
    { name: "Condominio Azul", type: "CONDOMINIO", zone: "Cascais", monthlyFee: 120, pools: [{ type: "POOL", disinfectionType: "CLORO", volumeM3: 72, monthlyAmount: 210 }, { type: "JACUZZI", disinfectionType: "BROMO", volumeM3: 8, monthlyAmount: 70 }] },
    { name: "Hotel Atlantico", type: "EMPRESA", zone: "Lisboa", monthlyFee: 250, pools: [{ type: "POOL", disinfectionType: "SAL", volumeM3: 140, monthlyAmount: 420 }, { type: "POOL", disinfectionType: "CLORO", volumeM3: 60, monthlyAmount: 180 }, { type: "JACUZZI", disinfectionType: "BROMO", volumeM3: 10, monthlyAmount: 90 }] },
    { name: "Moradia Silva", type: "PARTICULAR", zone: "Sintra", monthlyFee: 80, pools: [{ type: "POOL", disinfectionType: "SAL", volumeM3: 55, monthlyAmount: 140 }] },
    { name: "Alojamento Sol", type: "ALOJAMENTO_LOCAL", zone: "Cascais", monthlyFee: 90, pools: [{ type: "POOL", disinfectionType: "CLORO", volumeM3: 48, monthlyAmount: 150 }] },
    { name: "Moradia Rocha", type: "PARTICULAR", zone: "Oeiras", monthlyFee: 80, pools: [{ type: "POOL", disinfectionType: "CLORO", volumeM3: 52, monthlyAmount: 130 }, { type: "JACUZZI", disinfectionType: "BROMO", volumeM3: 7, monthlyAmount: 65 }] },
  ];

  for (const [clientIndex, spec] of specs.entries()) {
    const client = await createClient({
      name: `QA Real ${spec.name} ${runId}`,
      internalName: `QA Real ${spec.name}`,
      email: `qa.real.${clientIndex}.${runId}@cliente.test`,
      phone: `9300000${clientIndex}`,
      address: `Rua QA Real ${clientIndex}, ${spec.zone}`,
      zone: spec.zone,
      country: "Portugal",
      type: spec.type,
      requiresInvoice: clientIndex % 2 === 0,
      nif: `509${String(clientIndex).padStart(6, "0")}`,
      monthlyFee: spec.monthlyFee,
      notes: `Cliente criado pelo teste real mensal ${runId}`,
    });

    for (const [poolIndex, poolSpec] of spec.pools.entries()) {
      await createPool(client, {
        name: `QA Real ${poolSpec.type === "JACUZZI" ? "Jacuzzi" : "Piscina"} ${poolIndex + 1} ${runId}`,
        internalName: `QA ${spec.name} equipamento ${poolIndex + 1}`,
        type: poolSpec.type,
        disinfectionType: poolSpec.disinfectionType,
        address: `Rua QA Real ${clientIndex}, ${spec.zone}`,
        location: `${poolSpec.type}-${poolIndex + 1}-${runId}`,
        serialNumber: `SN-${runId}-${clientIndex}-${poolIndex}`,
        zone: spec.zone,
        volumeM3: poolSpec.volumeM3,
        monthlyAmount: poolSpec.monthlyAmount,
        serviceFrequency: poolSpec.type === "JACUZZI" ? 1 : 2,
        lengthM: poolSpec.type === "JACUZZI" ? 3 : 10,
        widthM: poolSpec.type === "JACUZZI" ? 2 : 5,
        depthMinM: poolSpec.type === "JACUZZI" ? 0.8 : 1.1,
        depthMaxM: poolSpec.type === "JACUZZI" ? 0.9 : 1.8,
        notes: `Equipamento real QA ${runId}`,
      });
    }
  }
}

async function setupRoundsAndVisits() {
  for (const [index, technician] of created.technicians.entries()) {
    const { data } = await call("POST", "/api/core/rounds", {
      name: `QA Real Ronda ${index + 1} ${runId}`,
      dayOfWeek: index + 1,
    });
    created.rounds.push(data.round);
    await call("POST", `/api/core/rounds/${data.round.id}/technicians`, { technicianId: technician.id });
  }

  for (const [index, pool] of created.pools.entries()) {
    const round = created.rounds[index % created.rounds.length];
    await call("POST", `/api/core/rounds/${round.id}/pools`, { poolId: pool.id, order: index + 1 });
  }

  let visitIndex = 0;
  const plannedDays = [2, 5, 9, 12, 16, 19, 23, 26, 30];
  for (const day of plannedDays) {
    for (const [poolIndex, pool] of created.pools.entries()) {
      if ((poolIndex + day) % 3 === 1) continue;
      const technician = created.technicians[poolIndex % created.technicians.length];
      const round = created.rounds[poolIndex % created.rounds.length];
      const workGuide = created.workGuides[poolIndex % created.workGuides.length];
      const visit = await call("POST", "/api/core/visits", {
        poolId: pool.id,
        roundId: round.id,
        technicianId: technician.id,
        plannedDate: iso(day, 8 + (poolIndex % 7), 15),
        notes: `Visita real mensal ${runId}`,
      });
      const serviceVisit = visit.data.visit;
      created.visits.push(serviceVisit);
      visitIndex += 1;

      const products = productPlan(visitIndex, pool.type);
      const readings = visitIndex % 7 === 0
        ? { ph: 8.1, chlorine: 0.3, alkalinity: 75, orpMv: 550, temperature: 30 }
        : { ph: 7.4, chlorine: pool.type === "JACUZZI" ? 0 : 1.8, alkalinity: 95, orpMv: 710, temperature: 27 };

      if (visitIndex % 8 === 0) {
        await call("POST", `/api/core/visits/${serviceVisit.id}/problem`, {
          type: pool.type === "JACUZZI" ? "Falta de pressao na bomba" : "Agua verde",
          message: pool.type === "JACUZZI" ? "Bomba com pressao irregular no circuito." : "Agua verde detectada antes do tratamento.",
          severity: "URGENT",
          notes: `Problema real QA ${runId}`,
        });
      }

      await call("POST", `/api/core/visits/${serviceVisit.id}/complete`, {
        ...readings,
        workGuideId: workGuide.id,
        vehicleId: workGuide.vehicleId,
        products,
        cleaned: true,
        brushed: true,
        vacuumed: true,
        basketCleaned: true,
        waterlineClean: true,
        backwashDone: true,
        notes: `Servico concluido no teste real mensal ${runId}`,
      });
    }
  }
}

async function setupMessagesAndBilling() {
  for (const [index, client] of created.clients.entries()) {
    await call("POST", "/api/client-messages", {
      clientId: client.id,
      sender: "Cliente",
      message: index % 2 === 0
        ? `Bom dia, podem confirmar a proxima manutencao? QA ${runId}`
        : `A piscina teve mais uso este fim de semana. QA ${runId}`,
    });

    const invoice = await call("POST", "/api/core/invoices/generate", {
      clientId: client.id,
      monthRef,
    });
    created.invoices.push(invoice.data.invoice);

    if (index === 0) {
      await call("POST", `/api/core/invoices/${invoice.data.invoice.id}/pay`, {
        amount: invoice.data.invoice.total || invoice.data.invoice.amount || 0,
        method: "TRANSFER",
        notes: `Pagamento total QA ${runId}`,
      });
    } else if (index === 1) {
      await call("POST", `/api/core/invoices/${invoice.data.invoice.id}/pay`, {
        amount: Math.max(20, Number(invoice.data.invoice.total || 0) / 2),
        method: "MBWAY",
        notes: `Pagamento parcial QA ${runId}`,
      });
    }
  }
}

async function edgeChecks() {
  const pool = created.pools[0];
  const technician = created.technicians[0];
  const round = created.rounds[0];
  const workGuide = created.workGuides[0];

  const invalidVisit = await call("POST", "/api/core/visits", {
    poolId: pool.id,
    roundId: round.id,
    technicianId: technician.id,
    plannedDate: iso(28, 14),
    notes: `EDGE ph invalido ${runId}`,
  });

  const invalid = await call("POST", `/api/core/visits/${invalidVisit.data.visit.id}/complete`, {
    ph: 14,
    chlorine: 1,
    products: [{ name: "Cloro pastilhas", quantity: 0.5, unit: "KG" }],
    workGuideId: workGuide.id,
  }, [400]);
  check("EDGE valida pH impossivel", invalid.status === 400 && invalid.data.code === "INVALID_READING", invalid.data.error || "");

  const concurrentVisit = await call("POST", "/api/core/visits", {
    poolId: pool.id,
    roundId: round.id,
    technicianId: technician.id,
    plannedDate: iso(29, 15),
    notes: `EDGE concorrencia ${runId}`,
  });

  const body = {
    ph: 7.3,
    chlorine: 1.5,
    alkalinity: 100,
    orpMv: 700,
    temperature: 26,
    products: [{ name: "Cloro pastilhas", quantity: 0.5, unit: "KG" }],
    workGuideId: workGuide.id,
  };
  const results = await Promise.allSettled([
    call("POST", `/api/core/visits/${concurrentVisit.data.visit.id}/complete`, body, [200, 409]),
    call("POST", `/api/core/visits/${concurrentVisit.data.visit.id}/complete`, body, [200, 409]),
  ]);
  const statuses = results.map((result) => result.status === "fulfilled" ? result.value.status : 500);
  check("EDGE concorrencia bloqueia duplo fecho", statuses.includes(200) && statuses.includes(409), `status ${statuses.join("/")}`);
}

async function validateResults() {
  const dashboard = await call("GET", "/api/core/dashboard");
  const chatOverview = await call("GET", "/api/chat/overview?filter=unread");
  const notifications = await call("GET", "/api/notifications");

  const poolIds = created.pools.map((pool) => pool.id);
  const visitIds = created.visits.map((visit) => visit.id);
  const [technicalSheets, doneVisits, chemicalUsages, vehicleMovements, repairs, invoices, messages] = await Promise.all([
    prisma.technicalSheet.count({ where: { poolId: { in: poolIds } } }),
    prisma.serviceVisit.count({ where: { id: { in: visitIds }, status: "DONE" } }),
    prisma.chemicalUsage.count({ where: { visitId: { in: visitIds } } }),
    prisma.vehicleStockMovement.count({ where: { visitId: { in: visitIds }, movementType: "CONSUMPTION" } }),
    prisma.repair.count({ where: { poolId: { in: poolIds } } }),
    prisma.invoice.findMany({ where: { clientId: { in: created.clients.map((client) => client.id) }, monthRef }, include: { lines: true, payments: true } }),
    prisma.clientMessage.count({ where: { clientId: { in: created.clients.map((client) => client.id) }, isReadByAdmin: false } }),
  ]);

  check("clientes criados por API real", created.clients.length === 5, `${created.clients.length} clientes`);
  check("piscinas/jacuzzis criados por API real", created.pools.length === 9, `${created.pools.length} equipamentos`);
  check("fichas tecnicas preenchidas", technicalSheets === created.pools.length, `${technicalSheets}/${created.pools.length}`);
  check("tecnicos e viaturas ligados", created.technicians.length === 3 && created.vehicles.length === 3 && created.workGuides.length === 3, `${created.technicians.length} tecnicos, ${created.vehicles.length} carros, ${created.workGuides.length} guias obra`);
  check("rondas criadas e visitas concluídas", created.rounds.length === 3 && doneVisits >= 20, `${created.rounds.length} rondas, ${doneVisits} visitas`);
  check("produtos da visita viram registo quimico", chemicalUsages >= doneVisits, `${chemicalUsages} registos`);
  check("consumo automatico baixa guia/viatura", vehicleMovements >= doneVisits, `${vehicleMovements} movimentos`);
  check("problemas em campo geram reparacoes/alertas", repairs >= 2, `${repairs} reparacoes`);
  check("faturacao mensal gerada", invoices.length === created.clients.length, `${invoices.length} faturas`);
  check("pagamentos total/parcial registados", invoices.some((i) => i.status === "PAID") && invoices.some((i) => i.status === "PARTIAL"), invoices.map((i) => i.status).join(", "));
  check("mensagens reais do portal cliente ficam por ler", messages >= created.clients.length, `${messages} mensagens QA por ler`);
  check("chat mostra conversas por ler", (chatOverview.data.conversations || []).some((c) => String(c.name || "").includes(runId)), `${chatOverview.data.totalUnread || 0} mensagens totais por ler`);
  check("notificacoes mostram alarme de chat", (notifications.data.notifications || []).some((n) => n.type === "CHAT_MESSAGE" && String(n.message || "").includes(runId)), "alarme CHAT_MESSAGE");
  check("dashboard recebe dados reais", Number(dashboard.data.counts?.clients || 0) >= created.clients.length && Number(dashboard.data.counts?.messagesUnread || 0) >= messages, `clientes ${dashboard.data.counts?.clients}, mensagens ${dashboard.data.counts?.messagesUnread}`);

  const workGuide = await prisma.workGuide.findUnique({
    where: { id: created.workGuides[0].id },
    include: { items: true, guide: { include: { items: true } } },
  });
  check("guia de obra mantem referencia AT e totais finais", Boolean(workGuide?.guideId && workGuide?.items?.some((item) => item.usedQty > 0)), `guia AT ${workGuide?.guideId || "-"}`);
}

async function main() {
  console.log(`Cristal Water - teste real mensal via API (${runId})`);
  console.log(`Servidor: ${BASE_URL}`);

  await call("GET", "/api/core/health");
  await setupPeopleAndFleet();
  await setupClientsAndPools();
  await setupRoundsAndVisits();
  await setupMessagesAndBilling();
  await edgeChecks();
  await validateResults();

  const failed = checks.filter((item) => !item.ok);
  const report = {
    runId,
    monthRef,
    baseUrl: BASE_URL,
    status: failed.length ? "FAILED" : "PASSED",
    created: {
      clients: created.clients.map((item) => item.id),
      pools: created.pools.map((item) => item.id),
      technicians: created.technicians.map((item) => item.id),
      vehicles: created.vehicles.map((item) => item.id),
      rounds: created.rounds.map((item) => item.id),
      visits: created.visits.map((item) => item.id),
      invoices: created.invoices.map((item) => item.id),
      workGuides: created.workGuides.map((item) => item.id),
      transportGuides: created.transportGuides.map((item) => item.id),
    },
    checks,
  };
  const file = path.join(reportDir, `real-month-flow-${runId}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`Relatorio: ${file}`);

  if (failed.length) {
    console.error("Falhas:");
    failed.forEach((item) => console.error(`- ${item.name}: ${item.detail}`));
    process.exit(1);
  }
}

main()
  .catch((error) => {
    const file = path.join(reportDir, `real-month-flow-${runId}-FAILED.json`);
    fs.writeFileSync(file, JSON.stringify({ runId, status: "ERROR", error: error.message, checks }, null, 2));
    console.error(error.message);
    console.error(`Relatorio: ${file}`);
    process.exit(1);
  })
  .finally(async () => {
    if (tempAdminUserId) {
      await prisma.user.updateMany({ where: { id: tempAdminUserId }, data: { active: false } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  });
