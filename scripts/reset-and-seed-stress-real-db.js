require("dotenv").config();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["warn", "error"] });

const CONFIG = {
  clients: Number(process.env.CW_STRESS_CLIENTS || 500),
  pools: Number(process.env.CW_STRESS_POOLS || 700),
  technicians: Number(process.env.CW_STRESS_TECHNICIANS || 9),
  vehicles: Number(process.env.CW_STRESS_VEHICLES || 9),
  monthRef: process.env.CW_STRESS_MONTH || "2026-06",
  keepAdminEmail: process.env.CW_KEEP_ADMIN_EMAIL || "",
  confirmReset: process.env.CW_CONFIRM_RESET || "",
};

const runTag = `STRESS_${CONFIG.monthRef.replace(/[^0-9]/g, "")}_${Date.now()}`;
const reportDir = path.resolve(__dirname, "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });

const zones = [
  "Albufeira",
  "Vilamoura",
  "Quarteira",
  "Loule",
  "Faro",
  "Olhao",
  "Tavira",
  "Portimao",
  "Lagos",
];

const productCatalog = [
  { name: "Cloro Granulado", sku: "STRESS-CL-GR", unit: "KG", guideQty: 45, defaultCost: 2.8, minStockVehicle: 8 },
  { name: "Cloro Shock", sku: "STRESS-CL-SH", unit: "KG", guideQty: 22, defaultCost: 3.4, minStockVehicle: 5 },
  { name: "pH Menos", sku: "STRESS-PH-M", unit: "KG", guideQty: 32, defaultCost: 2.1, minStockVehicle: 6 },
  { name: "pH Mais", sku: "STRESS-PH-P", unit: "KG", guideQty: 14, defaultCost: 2.0, minStockVehicle: 3 },
  { name: "Alcalinidade", sku: "STRESS-ALK", unit: "KG", guideQty: 24, defaultCost: 1.9, minStockVehicle: 4 },
  { name: "Sal", sku: "STRESS-SAL", unit: "KG", guideQty: 100, defaultCost: 0.45, minStockVehicle: 20 },
  { name: "Algicida", sku: "STRESS-ALG", unit: "L", guideQty: 16, defaultCost: 4.2, minStockVehicle: 3 },
  { name: "Floculante", sku: "STRESS-FLOC", unit: "L", guideQty: 12, defaultCost: 3.6, minStockVehicle: 2 },
];

function pad(value, size = 3) {
  return String(value).padStart(size, "0");
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function monthDate(day, hour = 8, minute = 0) {
  const [year, month] = CONFIG.monthRef.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

async function createMany(tx, delegate, rows, batchSize = 500) {
  if (!rows.length) return;
  for (const part of chunk(rows, batchSize)) {
    await tx[delegate].createMany({ data: part.map((row) => dataFor(delegate, row)) });
  }
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function findAdmin() {
  if (CONFIG.keepAdminEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: CONFIG.keepAdminEmail } }).catch(() => null);
    if (byEmail) return byEmail;
  }
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { id: "asc" },
  });
  if (admin) return admin;
  return prisma.user.findFirst({ orderBy: { id: "asc" } });
}

async function truncateOperationalTables(tx, adminId) {
  const rows = await tx.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const preserved = new Set(["_prisma_migrations", "User"]);
  const targets = rows
    .map((row) => row.tablename)
    .filter((name) => !preserved.has(name));

  if (targets.length) {
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${targets.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`);
  }

  await tx.user.deleteMany({ where: { id: { not: adminId } } });
}

function clientRows() {
  return Array.from({ length: CONFIG.clients }, (_, index) => {
    const n = index + 1;
    const zone = zones[index % zones.length];
    const requiresInvoice = n % 3 === 0 || n % 11 === 0;
    return dataFor("client", {
      name: `Cliente Stress ${pad(n)}`,
      internalName: `CW-STRESS-CLIENT-${pad(n)}`,
      email: `cliente${pad(n)}@stress.cristalwater.local`,
      phone: `91${String(2000000 + n).slice(-7)}`,
      address: `Rua de Teste ${n}, ${zone}`,
      zone,
      notes: `Criado por teste integral ${runTag}`,
      status: "ACTIVE",
      active: true,
      latitude: 37.02 + (index % 30) * 0.011,
      longitude: -8.02 + (index % 30) * 0.009,
      monthlyFee: 0,
      monthlyAmount: 0,
      creditBalance: 0,
      paymentStatus: "PAID",
      requiresInvoice,
      billingActive: true,
      contractActive: true,
      contractActivatedAt: monthDate(1, 9),
      fiscalName: requiresInvoice ? `Cliente Stress ${pad(n)} LDA` : null,
      fiscalNif: requiresInvoice ? `50${String(1000000 + n).slice(-7)}` : null,
      fiscalAddress: requiresInvoice ? `Rua Fiscal ${n}, ${zone}` : null,
      fiscalEmail: requiresInvoice ? `faturas${pad(n)}@stress.cristalwater.local` : null,
      source: runTag,
      archiveStatus: "ATIVO",
      deletedAt: null,
    });
  });
}

function poolRows(clients) {
  const rows = [];
  let poolNumber = 1;
  for (const client of clients) {
    rows.push(makePoolRow(poolNumber++, client, 0));
  }
  for (let i = 0; rows.length < CONFIG.pools; i += 1) {
    rows.push(makePoolRow(poolNumber++, clients[i % clients.length], 1));
  }
  return rows;
}

function makePoolRow(poolNumber, client, extraIndex) {
  const zone = client.zone || zones[poolNumber % zones.length];
  const isJacuzzi = poolNumber % 10 === 0 || extraIndex === 1 && poolNumber % 6 === 0;
  const volume = isJacuzzi ? 6 + (poolNumber % 8) : 35 + (poolNumber % 95);
  const monthlyAmount = isJacuzzi ? 38 + (poolNumber % 5) * 4 : 82 + (poolNumber % 9) * 9;
  return dataFor("pool", {
    clientId: client.id,
    name: `${isJacuzzi ? "Jacuzzi" : "Piscina"} Stress ${pad(poolNumber)}`,
    location: `${zone} - Local ${pad(poolNumber)}`,
    address: client.address,
    zone,
    volumeM3: volume,
    type: isJacuzzi ? "JACUZZI" : "POOL",
    priority: poolNumber % 17 === 0 ? 3 : poolNumber % 7 === 0 ? 2 : 1,
    active: true,
    notes: `Piscina criada para teste integral ${runTag}`,
    latitude: Number((37.02 + (poolNumber % 90) * 0.0041).toFixed(6)),
    longitude: Number((-8.05 + (poolNumber % 90) * 0.0037).toFixed(6)),
    monthlyAmount,
    serviceFrequency: poolNumber % 20 === 0 ? 2 : 1,
    preferredDays: ["MON", "TUE", "WED", "THU", "FRI"][poolNumber % 5],
    scheduleMode: "PENDING_ROUND",
    estimatedMinutes: isJacuzzi ? 22 : 38 + (poolNumber % 4) * 5,
    hasLights: poolNumber % 4 !== 0,
    source: runTag,
    archiveStatus: "ATIVO",
    deletedAt: null,
  });
}

function buildVisitProducts(pool, variant) {
  const base = pool.type === "JACUZZI" ? 0.35 : 0.9;
  const products = [
    { name: "Cloro Granulado", quantity: money(base + (variant % 3) * 0.1), unit: "KG" },
  ];
  if (variant % 4 === 0) products.push({ name: "pH Menos", quantity: 0.4, unit: "KG" });
  if (variant % 6 === 0) products.push({ name: "Alcalinidade", quantity: 0.6, unit: "KG" });
  if (variant % 11 === 0) products.push({ name: "Algicida", quantity: 0.25, unit: "L" });
  return products;
}

async function seed(tx, admin, passwordHash) {
  const techUsers = [];
  const vehicles = [];
  const technicians = [];

  for (let i = 1; i <= CONFIG.vehicles; i += 1) {
    vehicles.push(await tx.vehicle.create({
      data: dataFor("vehicle", {
        plate: `CW-${pad(i, 2)}-${pad(10 + i, 2)}`,
        name: `Viatura Campo ${i}`,
        brand: i % 2 ? "Toyota" : "Peugeot",
        model: i % 2 ? "Proace" : "Partner",
        year: 2021 + (i % 4),
        currentKm: 42000 + i * 3180,
        status: "ACTIVE",
        notes: `Viatura criada para teste integral ${runTag}`,
        active: true,
        archiveStatus: "ATIVO",
        deletedAt: null,
      }),
    }));
  }

  for (let i = 1; i <= CONFIG.technicians; i += 1) {
    const user = await tx.user.create({
      data: dataFor("user", {
        email: `tecnico${pad(i, 2)}@stress.cristalwater.local`,
        password: passwordHash,
        role: "TECH",
        name: `Tecnico Stress ${i}`,
        phone: `92${String(3000000 + i).slice(-7)}`,
        pin: `7${pad(i, 3)}`,
        active: true,
      }),
    });
    techUsers.push(user);
    const vehicle = vehicles[(i - 1) % vehicles.length];
    const technician = await tx.technician.create({
      data: dataFor("technician", {
        name: `Tecnico Stress ${i}`,
        email: `tecnico${pad(i, 2)}@stress.cristalwater.local`,
        phone: user.phone,
        pin: user.pin,
        role: "TECHNICIAN",
        zone: zones[(i - 1) % zones.length],
        vehicleId: vehicle.id,
        latitude: 37.05 + i * 0.01,
        longitude: -8.05 + i * 0.01,
        notes: `Tecnico criado para teste integral ${runTag}`,
        active: true,
        costPerVisit: 18,
        hourlyCost: 12,
        commissionRate: 0.1,
        archiveStatus: "ATIVO",
        deletedAt: null,
      }),
    });
    technicians.push(technician);
    await tx.technicianVehicleLog.create({
      data: dataFor("technicianVehicleLog", {
        technicianId: technician.id,
        vehicleId: vehicle.id,
        startAt: monthDate(1, 7, 30),
      }),
    });
  }

  const products = [];
  for (const item of productCatalog) {
    products.push(await tx.inventoryProduct.create({
      data: dataFor("inventoryProduct", {
        name: item.name,
        sku: item.sku,
        brand: "Cristal Water",
        category: "CHEMICAL",
        unit: item.unit,
        defaultCost: item.defaultCost,
        minStockCentral: item.guideQty * CONFIG.vehicles,
        minStockVehicle: item.minStockVehicle,
        notes: `Produto de teste ${runTag}`,
        active: true,
        archiveStatus: "ATIVO",
        deletedAt: null,
      }),
    }));
  }
  const productByName = new Map(products.map((item) => [item.name, item]));

  await tx.stockPurchase.create({
    data: dataFor("stockPurchase", {
      supplierName: "Fornecedor Stress Cristal Water",
      invoiceNumber: `STRESS-${CONFIG.monthRef}`,
      invoiceDate: monthDate(1, 10),
      totalAmount: productCatalog.reduce((sum, p) => sum + p.guideQty * CONFIG.vehicles * p.defaultCost, 0),
      status: "POSTED",
      notes: `Compra central de teste ${runTag}`,
      createdBy: admin.email,
    }),
  });

  const stockBalances = [];
  for (const product of productCatalog) {
    const dbProduct = productByName.get(product.name);
    stockBalances.push({
      scope: "CENTRAL",
      vehicleId: null,
      productId: dbProduct.id,
      productName: product.name,
      category: "CHEMICAL",
      unit: product.unit,
      quantity: product.guideQty * CONFIG.vehicles * 2,
    });
  }

  const transportGuides = [];
  const workGuides = [];
  for (let i = 0; i < vehicles.length; i += 1) {
    const vehicle = vehicles[i];
    const technician = technicians[i % technicians.length];
    const guide = await tx.transportGuide.create({
      data: dataFor("transportGuide", {
        codeAT: `AT-${CONFIG.monthRef.replace("-", "")}-${pad(i + 1, 3)}`,
        vehicleId: vehicle.id,
        status: "ACTIVE",
        origin: "Armazem Cristal Water",
        destination: "Rondas Algarve",
        notes: `Guia AT carregada para teste ${runTag}`,
        validFrom: monthDate(1, 7),
        validUntil: monthDate(30, 20),
        isDraft: false,
      }),
    });
    transportGuides.push(guide);
    const workGuide = await tx.workGuide.create({
      data: dataFor("workGuide", {
        guideId: guide.id,
        vehicleId: vehicle.id,
        technicianId: technician.id,
        status: "OPEN",
        startKm: vehicle.currentKm || 0,
        notes: `Guia de obra gerada automaticamente da guia AT ${guide.codeAT}`,
        isDraft: false,
      }),
    });
    workGuides.push(workGuide);
    for (const product of productCatalog) {
      const dbProduct = productByName.get(product.name);
      await tx.transportGuideItem.create({
        data: dataFor("transportGuideItem", {
          guideId: guide.id,
          name: product.name,
          type: "CHEMICAL",
          unit: product.unit,
          quantity: product.guideQty,
        }),
      });
      await tx.workGuideItem.create({
        data: dataFor("workGuideItem", {
          workGuideId: workGuide.id,
          name: product.name,
          type: "CHEMICAL",
          unit: product.unit,
          initialQty: product.guideQty,
          quantity: product.guideQty,
          usedQty: 0,
        }),
      });
      stockBalances.push({
        scope: "VEHICLE",
        vehicleId: vehicle.id,
        productId: dbProduct.id,
        productName: product.name,
        category: "CHEMICAL",
        unit: product.unit,
        quantity: product.guideQty,
      });
    }
  }
  await createMany(tx, "stockBalance", stockBalances);

  await createMany(tx, "client", clientRows());
  const clients = await tx.client.findMany({ where: { source: runTag }, orderBy: { id: "asc" } });
  await createMany(tx, "pool", poolRows(clients));
  const pools = await tx.pool.findMany({ where: { source: runTag }, orderBy: { id: "asc" } });

  await createMany(tx, "technicalSheet", pools.map((pool, index) => ({
    poolId: pool.id,
    volumeM3: pool.volumeM3 || 0,
    disinfectionType: pool.type === "JACUZZI" ? "BROMO" : index % 4 === 0 ? "SAL" : "CLORO",
    targetPhMin: 7.2,
    targetPhMax: 7.6,
    targetChlorineMin: pool.type === "JACUZZI" ? 2.0 : 1.0,
    targetChlorineMax: pool.type === "JACUZZI" ? 4.0 : 3.0,
    targetAlkalinityMin: 80,
    targetAlkalinityMax: 120,
    targetOrpMinMv: 650,
    filterBrandModel: `Filtro Stress ${1 + index % 5}`,
    pumpHorsePower: pool.type === "JACUZZI" ? 0.75 : 1 + (index % 4) * 0.25,
    chlorinatorModel: index % 4 === 0 ? `Salino CW ${index % 8}` : null,
    technicalRoomLocation: `Casa tecnica junto a ${pool.location}`,
    specialObservations: "Valores referencia: pH 7.2-7.6, cloro 1-3 ppm, alcalinidade 80-120 ppm, ORP 650-750 mV.",
  })));

  await createMany(tx, "poolCalculationProfile", pools.map((pool, index) => {
    const isJacuzzi = pool.type === "JACUZZI";
    const lengthM = isJacuzzi ? 2.3 + (index % 3) * 0.2 : 7 + (index % 6) * 0.8;
    const widthM = isJacuzzi ? 2.1 + (index % 2) * 0.2 : 3.5 + (index % 5) * 0.45;
    const depthMinM = isJacuzzi ? 0.85 : 1.05 + (index % 3) * 0.1;
    const depthMaxM = isJacuzzi ? 0.95 : 1.55 + (index % 4) * 0.15;
    const averageDepthM = money((depthMinM + depthMaxM) / 2);
    const surfaceM2 = money(lengthM * widthM);
    return {
      poolId: pool.id,
      shape: isJacuzzi ? "SPA" : index % 9 === 0 ? "IRREGULAR" : "RECTANGULAR",
      lengthM: money(lengthM),
      widthM: money(widthM),
      depthMinM: money(depthMinM),
      depthMaxM: money(depthMaxM),
      averageDepthM,
      surfaceM2,
      volumeM3: pool.volumeM3 || money(surfaceM2 * averageDepthM),
      pumpFlowM3h: isJacuzzi ? 4.5 : 8 + (index % 6) * 1.2,
      pumpPowerHp: isJacuzzi ? 0.75 : 1 + (index % 4) * 0.25,
      bathersAverage: isJacuzzi ? 3 : 4 + (index % 8),
      poolLoad: index % 13 === 0 ? "HIGH" : "NORMAL",
      saltCurrentPpm: index % 4 === 0 ? 3100 + (index % 8) * 55 : null,
      targetSalinityPpm: isJacuzzi ? null : 3500,
      chlorinatorGph: index % 4 === 0 ? 18 + (index % 5) * 2 : null,
      chlorineCurrentPpm: isJacuzzi ? 2.2 : 1.6,
      targetChlorinePpm: isJacuzzi ? 3 : 2,
      currentWaterTempC: isJacuzzi ? 32 : 25 + (index % 5),
      targetWaterTempC: isJacuzzi ? 34 : 27,
      covered: index % 5 === 0,
      notes: `Perfil calculo validado no fluxo ${runTag}. Referencias: pH 7.2-7.6, cloro ${isJacuzzi ? "2-4" : "1-3"} ppm, alcalinidade 80-120, ORP 650-750.`,
    };
  }));

  await createMany(tx, "poolEquipment", pools.map((pool, index) => {
    const isJacuzzi = pool.type === "JACUZZI";
    return {
      poolId: pool.id,
      type: isJacuzzi ? "JACUZZI_PACK" : "POOL_TECHNICAL_SET",
      brand: ["AstralPool", "Hayward", "Zodiac", "Pentair"][index % 4],
      model: `${isJacuzzi ? "Spa" : "Filtro"} CW-${pad(index + 1, 4)}`,
      pumpType: isJacuzzi ? "Circulacao jacuzzi" : index % 3 === 0 ? "Velocidade variavel" : "Centrifuga",
      pumpPower: `${isJacuzzi ? "0.75" : (1 + (index % 4) * 0.25).toFixed(2)} CV`,
      filterType: isJacuzzi ? "Cartucho" : index % 5 === 0 ? "Vidro" : "Areia",
      filterMedia: isJacuzzi ? "Cartucho lavavel" : index % 5 === 0 ? "Vidro filtrante 0.5-1.0" : "Areia silica",
      saltSystem: !isJacuzzi && index % 4 === 0,
      saltLastAdded: !isJacuzzi && index % 4 === 0 ? monthDate(5 + (index % 12), 10) : null,
      saltQuantity: !isJacuzzi && index % 4 === 0 ? 25 + (index % 5) * 5 : null,
      lightsCount: pool.hasLights ? 1 + (index % 4) : 0,
      lightsType: pool.hasLights ? (index % 2 ? "LED branco" : "LED RGB") : null,
      hasLights: Boolean(pool.hasLights),
      brokenLightsCount: index % 23 === 0 ? 1 : 0,
      lightsNotes: index % 23 === 0 ? "Uma luz a confirmar em reparacao." : "Iluminacao verificada.",
      notes: `Equipamento preenchido no fluxo ${runTag}. Bomba, filtro, tratamento e iluminacao validados para campo.`,
    };
  }));

  await createMany(tx, "technicalRoom", pools.map((pool, index) => ({
    poolId: pool.id,
    condition: index % 19 === 0 ? "A rever" : "Boa",
    locationNote: `Casa tecnica junto a ${pool.location || pool.zone || "local da piscina"}`,
    ventilation: index % 7 === 0 ? "Ventilacao limitada - rever" : "Adequada",
    electrical: index % 11 === 0 ? "Quadro identificado, verificar disjuntor auxiliar" : "Quadro identificado e funcional",
    notes: `Tubagens, valvulas, filtro e quadro eletrico registados no fluxo ${runTag}.`,
  })));

  await createMany(tx, "clientMessage", clients.flatMap((client, index) => {
    const pool = pools.find((item) => item.clientId === client.id);
    return [
      {
        clientId: client.id,
        sender: "Administraçao Cristal Water",
        senderType: "ADMIN",
        message: `Bom dia ${client.name}. A sua manutencao de junho ficou agendada para ${pool?.name || "a piscina"}.`,
        text: `Bom dia ${client.name}. A sua manutencao de junho ficou agendada para ${pool?.name || "a piscina"}.`,
        isReadByAdmin: true,
        seen: true,
        messageType: "TEXT",
        createdAt: monthDate(2 + (index % 10), 9, 5),
        seenAt: monthDate(2 + (index % 10), 10, 15),
      },
      {
        clientId: client.id,
        sender: "Cliente",
        senderType: "CLIENT",
        message: index % 9 === 0
          ? "Bom dia, podem confirmar tambem a pressao do filtro?"
          : "Obrigado. Se houver atraso avisem-me por favor.",
        text: index % 9 === 0
          ? "Bom dia, podem confirmar tambem a pressao do filtro?"
          : "Obrigado. Se houver atraso avisem-me por favor.",
        isReadByAdmin: index % 7 !== 0,
        seen: false,
        messageType: "TEXT",
        createdAt: monthDate(3 + (index % 10), 12, 30),
      },
    ];
  }), 500);

  await createMany(tx, "clientAccess", clients.slice(0, Math.min(clients.length, 500)).map((client, index) => ({
    clientId: client.id,
    title: "Acesso principal",
    accessType: index % 2 ? "KEY" : "CODE",
    codeValue: index % 2 ? `CH-${pad(index + 1, 4)}` : `${1000 + index}`,
    instructions: "Usar apenas durante a visita atribuida.",
    visibleToTechnician: index % 7 !== 0,
    active: true,
  })));

  await createMany(tx, "keyAccess", pools.map((pool, index) => ({
    keyCode: `KEY-${runTag}-${pad(index + 1, 4)}`,
    description: `Chave/codigo da ${pool.name}`,
    requiredForVisit: index % 3 === 0,
    visibleToTechnician: index % 8 !== 0,
    assignedTechnicianId: technicians[index % technicians.length].id,
    assignedAt: monthDate(1, 7, 45),
    active: true,
  })));
  const keys = await tx.keyAccess.findMany({ where: { keyCode: { startsWith: `KEY-${runTag}` } }, orderBy: { id: "asc" } });
  const joinValues = keys.map((key, index) => `(${key.id}, ${pools[index].id})`);
  for (const values of chunk(joinValues, 300)) {
    await tx.$executeRawUnsafe(`INSERT INTO "_KeyAccessToPool" ("A", "B") VALUES ${values.join(", ")}`);
  }

  const rounds = [];
  for (let i = 0; i < technicians.length; i += 1) {
    const round = await tx.round.create({
      data: dataFor("round", {
        name: `Ronda Stress ${i + 1} - ${technicians[i].zone}`,
        dayOfWeek: (i % 6) + 1,
        active: true,
      }),
    });
    rounds.push(round);
  }
  await createMany(tx, "roundTechnician", rounds.map((round, index) => ({
    roundId: round.id,
    technicianId: technicians[index % technicians.length].id,
  })));
  await createMany(tx, "roundPool", pools.map((pool, index) => ({
    roundId: rounds[index % rounds.length].id,
    poolId: pool.id,
    order: Math.floor(index / rounds.length) + 1,
  })));
  await tx.pool.updateMany({ where: { source: runTag }, data: { scheduleMode: "ROUND_ASSIGNED" } });

  const extraRulePools = pools.filter((_, index) => index % 20 === 0).slice(0, 35);
  await createMany(tx, "extraVisitRule", extraRulePools.map((pool, index) => ({
    poolId: pool.id,
    name: `Extra Verao ${pad(index + 1, 2)}`,
    description: "Limpezas extra entre dias definidos para teste integral.",
    active: true,
    recurrenceType: "SEASONAL",
    yearMode: "CURRENT_YEAR",
    startDate: monthDate(10, 8),
    endDate: monthDate(24, 18),
    visitsPerWeek: index % 2 ? 2 : 1,
    monday: true,
    wednesday: index % 2 === 0,
    friday: true,
    preferredTime: "09:00",
    billingMode: "EXTRA",
    unitPrice: 45,
    notes: runTag,
  })));
  const extraRules = await tx.extraVisitRule.findMany({ where: { notes: runTag }, orderBy: { id: "asc" } });

  const roundByPool = new Map(pools.map((pool, index) => [pool.id, rounds[index % rounds.length]]));
  const techByRoundId = new Map(rounds.map((round, index) => [round.id, technicians[index % technicians.length]]));
  const workGuideByTechId = new Map(workGuides.map((guide) => [guide.technicianId, guide]));

  const visits = [];
  const extraVisits = [];
  const monthDays = [2, 9, 16, 23];
  for (const pool of pools) {
    const round = roundByPool.get(pool.id);
    const technician = techByRoundId.get(round.id);
    for (let week = 0; week < monthDays.length; week += 1) {
      const day = monthDays[week] + (pool.id % 5);
      const planned = monthDate(Math.min(day, 28), 8 + (pool.id % 8), (pool.id * 7) % 50);
      const notDone = week === 1 && pool.id % 53 === 0;
      const plannedOnly = week === 3 && pool.id % 10 === 0;
      const status = plannedOnly ? "PLANNED" : notDone ? "NOT_DONE" : "DONE";
      const startAt = status === "DONE" ? planned : null;
      const endAt = status === "DONE" ? addMinutes(planned, pool.estimatedMinutes || 35) : null;
      const products = status === "DONE" ? buildVisitProducts(pool, pool.id + week) : [];
      visits.push({
        clientId: pool.clientId,
        poolId: pool.id,
        technicianId: technician.id,
        technicianName: technician.name,
        roundId: round.id,
        date: planned,
        plannedDate: planned,
        startAt,
        endAt,
        status,
        reason: notDone ? "Sem acesso" : null,
        notes: notDone ? "Portao fechado. Reagendar e notificar cliente." : plannedOnly ? "Planeada para execucao." : "Servico mensal concluido.",
        internalNotes: `${runTag}|BASE|pool:${pool.id}|week:${week + 1}`,
        alerts: notDone ? "SEM_ACESSO" : null,
        products: products.length ? JSON.stringify(products) : null,
        chemicalsJson: products.length ? products : undefined,
        ph: status === "DONE" ? money(7.15 + (pool.id % 8) * 0.06) : null,
        chlorine: status === "DONE" ? money(0.9 + (pool.id % 7) * 0.28) : null,
        alkalinity: status === "DONE" ? 78 + (pool.id % 8) * 7 : null,
        salt: status === "DONE" && pool.id % 4 === 0 ? 3200 + (pool.id % 10) * 40 : null,
        temperature: status === "DONE" ? 23 + (pool.id % 9) : null,
        orpMv: status === "DONE" ? 640 + (pool.id % 14) * 10 : null,
        cleaned: status === "DONE",
        brushed: status === "DONE",
        vacuumed: status === "DONE",
        basketCleaned: status === "DONE",
        waterlineClean: status === "DONE",
        backwashDone: status === "DONE" && pool.id % 3 === 0,
        billed: false,
        cost: status === "DONE" ? 18 : 0,
        revenue: status === "DONE" ? money((pool.monthlyAmount || 0) / 4) : 0,
        profit: status === "DONE" ? money((pool.monthlyAmount || 0) / 4 - 18) : 0,
      });
    }
  }

  for (let i = 0; i < extraRules.length; i += 1) {
    const rule = extraRules[i];
    const pool = pools.find((item) => item.id === rule.poolId);
    const round = roundByPool.get(pool.id);
    const technician = techByRoundId.get(round.id);
    const extraDay = 11 + (i % 12);
    const scheduledAt = monthDate(extraDay, 14, (i * 5) % 50);
    extraVisits.push({
      clientId: pool.clientId,
      poolId: pool.id,
      ruleId: rule.id,
      technicianId: technician.id,
      visitType: "EXTRA_CLEANING",
      type: "EXTRA_CLEANING",
      source: "STRESS_TEST",
      origin: "ADMIN",
      scheduledAt,
      date: scheduledAt,
      status: "DONE",
      billingMode: "EXTRA",
      billingStatus: "PENDING",
      commercialRule: "EXTRA",
      isBillable: true,
      unitPrice: rule.unitPrice || 45,
      totalPrice: rule.unitPrice || 45,
      price: rule.unitPrice || 45,
      includedInPackage: false,
      billed: false,
      notes: `${runTag}|limpeza extra`,
    });
    visits.push({
      clientId: pool.clientId,
      poolId: pool.id,
      technicianId: technician.id,
      technicianName: technician.name,
      roundId: round.id,
      date: scheduledAt,
      plannedDate: scheduledAt,
      startAt: scheduledAt,
      endAt: addMinutes(scheduledAt, 42),
      status: "DONE",
      notes: "Limpeza extra concluida.",
      internalNotes: `${runTag}|EXTRA|rule:${rule.id}`,
      products: JSON.stringify([{ name: "Cloro Shock", quantity: 0.8, unit: "KG" }]),
      chemicalsJson: [{ name: "Cloro Shock", quantity: 0.8, unit: "KG" }],
      ph: 7.35,
      chlorine: 2.4,
      alkalinity: 96,
      salt: null,
      temperature: 27,
      orpMv: 710,
      cleaned: true,
      brushed: true,
      vacuumed: true,
      basketCleaned: true,
      waterlineClean: true,
      backwashDone: true,
      billed: false,
      cost: 20,
      revenue: rule.unitPrice || 45,
      profit: money((rule.unitPrice || 45) - 20),
    });
  }
  await createMany(tx, "extraVisit", extraVisits);
  await createMany(tx, "serviceVisit", visits, 300);

  const doneVisits = await tx.serviceVisit.findMany({
    where: { internalNotes: { startsWith: runTag }, status: "DONE" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      clientId: true,
      poolId: true,
      technicianId: true,
      plannedDate: true,
      startAt: true,
      products: true,
    },
  });
  const allStressVisits = await tx.serviceVisit.findMany({
    where: { internalNotes: { startsWith: runTag } },
    orderBy: { id: "asc" },
    select: { id: true, clientId: true, poolId: true, technicianId: true, status: true, plannedDate: true, internalNotes: true },
  });

  const photos = [];
  const chemicalRows = [];
  const stockMovements = [];
  const workUsage = new Map();
  const gpsTracks = [];
  const locationLogs = [];
  for (let i = 0; i < doneVisits.length; i += 1) {
    const visit = doneVisits[i];
    const technician = technicians.find((item) => item.id === visit.technicianId);
    const techUser = techUsers[technicians.findIndex((item) => item.id === visit.technicianId)];
    const workGuide = workGuideByTechId.get(visit.technicianId);
    const products = visit.products ? JSON.parse(visit.products) : [];
    if (i < 800) {
      photos.push({ visitId: visit.id, url: `/uploads/stress/${visit.id}-before.jpg`, type: "BEFORE" });
      photos.push({ visitId: visit.id, url: `/uploads/stress/${visit.id}-after.jpg`, type: "AFTER" });
    }
    for (const product of products) {
      chemicalRows.push({ visitId: visit.id, name: product.name, quantity: product.quantity, unit: product.unit });
      const dbProduct = productByName.get(product.name);
      stockMovements.push({
        movementType: "CONSUMPTION",
        scopeFrom: "VEHICLE",
        scopeTo: "POOL",
        vehicleId: technician.vehicleId,
        productId: dbProduct?.id || null,
        productName: product.name,
        category: "CHEMICAL",
        unit: product.unit,
        quantity: product.quantity,
        transportGuideId: transportGuides.find((guide) => guide.vehicleId === technician.vehicleId)?.id || null,
        workGuideId: workGuide?.id || null,
        visitId: visit.id,
        clientId: visit.clientId,
        poolId: visit.poolId,
        technicianId: visit.technicianId,
        notes: `Consumo automatico pela dosagem da visita ${visit.id}`,
        createdBy: technician.name,
        createdAt: visit.plannedDate || monthDate(1),
      });
      const key = `${workGuide?.id || 0}|${product.name}`;
      workUsage.set(key, money((workUsage.get(key) || 0) + Number(product.quantity || 0)));
    }
    if (i < 1500) {
      const at = visit.startAt || visit.plannedDate || monthDate(1);
      for (let point = 0; point < 3; point += 1) {
        const lat = Number((37.04 + ((visit.poolId || 0) % 60) * 0.004 + point * 0.0004).toFixed(6));
        const lng = Number((-8.04 + ((visit.poolId || 0) % 60) * 0.003 + point * 0.0004).toFixed(6));
        gpsTracks.push({
          userId: techUser?.id || null,
          technicianId: visit.technicianId,
          latitude: lat,
          longitude: lng,
          createdAt: addMinutes(at, point * 12),
        });
        if (techUser) {
          locationLogs.push({
            userId: techUser.id,
            latitude: lat,
            longitude: lng,
            accuracyM: 12 + point,
            timestamp: addMinutes(at, point * 12),
            createdAt: addMinutes(at, point * 12),
          });
        }
      }
    }
  }
  await createMany(tx, "visitPhoto", photos, 500);
  await createMany(tx, "chemicalUsage", chemicalRows, 500);
  await createMany(tx, "stockMovement", stockMovements, 500);
  await createMany(tx, "technicianTrack", gpsTracks, 500);
  await createMany(tx, "locationLog", locationLogs, 500);

  for (const [key, usedQty] of workUsage.entries()) {
    const [workGuideIdRaw, productName] = key.split("|");
    const workGuideId = Number(workGuideIdRaw);
    if (!workGuideId) continue;
    const current = await tx.workGuideItem.findFirst({ where: { workGuideId, name: productName } });
    if (!current) continue;
    await tx.workGuideItem.update({
      where: { id: current.id },
      data: {
        usedQty: money((current.usedQty || 0) + usedQty),
        quantity: money(Math.max(0, (current.quantity || 0) - usedQty)),
      },
    });
  }

  const workDays = [];
  for (const user of techUsers) {
    for (let day = 1; day <= 28; day += 1) {
      if ([6, 7, 13, 14, 20, 21, 27, 28].includes(day)) continue;
      workDays.push({
        userId: user.id,
        date: monthDate(day, 0),
        startAt: monthDate(day, 7, 35),
        endAt: day % 9 === 0 ? null : monthDate(day, 17, 50),
        status: day % 9 === 0 ? "ACTIVE" : "CLOSED",
      });
    }
  }
  await createMany(tx, "technicianWorkDay", workDays, 300);

  const notDoneVisits = allStressVisits.filter((visit) => visit.status === "NOT_DONE").slice(0, 20);
  await createMany(tx, "technicalAlert", notDoneVisits.map((visit) => ({
    poolId: visit.poolId,
    type: "SEM_ACESSO",
    message: `Visita ${visit.id} nao realizada por falta de acesso.`,
    priority: "HIGH",
    status: "OPEN",
    createdAt: visit.plannedDate || monthDate(9),
  })));
  await createMany(tx, "notification", notDoneVisits.map((visit) => ({
    clientId: visit.clientId,
    type: "ALERT",
    eventType: "VISIT_NOT_DONE",
    title: "Visita nao realizada",
    message: `Piscina ${visit.poolId}: visita sem acesso.`,
    role: "ADMIN",
    status: "PENDING",
    severity: "HIGH",
    metadata: { visitId: visit.id, poolId: visit.poolId },
    isRead: false,
  })));

  const repairVisits = doneVisits.filter((_, index) => index % 75 === 0).slice(0, 38);
  await createMany(tx, "repair", repairVisits.map((visit, index) => ({
    poolId: visit.poolId,
    problem: index % 3 === 0 ? "Bomba com ruido" : index % 3 === 1 ? "Filtro com pressao alta" : "Cobertura avariada",
    quantity: 1,
    unitPrice: 95 + (index % 5) * 35,
    totalPrice: 95 + (index % 5) * 35,
    priority: index % 4 === 0 ? "HIGH" : "NORMAL",
    notes: `Criado a partir da visita ${visit.id}`,
    status: index % 5 === 0 ? "APPROVED" : "QUOTED",
    paid: false,
    createdAt: visit.plannedDate || monthDate(10),
  })));
  await createMany(tx, "technicalAlert", repairVisits.map((visit, index) => ({
    poolId: visit.poolId,
    type: "REPARACAO_NECESSARIA",
    message: `Problema tecnico reportado na visita ${visit.id}`,
    priority: index % 4 === 0 ? "HIGH" : "NORMAL",
    status: index % 6 === 0 ? "EM_ANALISE" : "OPEN",
    createdAt: visit.plannedDate || monthDate(10),
  })));

  const reminderPools = pools.filter((_, index) => index % 64 === 0).slice(0, 12);
  await createMany(tx, "operationalReminder", reminderPools.map((pool, index) => ({
    title: "Agua aberta - confirmar fecho",
    description: `Lembrete de campo para fechar agua na ${pool.name}.`,
    dueDate: addMinutes(monthDate(14 + (index % 5), 14, 0), 45 + index * 5),
    isCompleted: false,
    clientId: pool.clientId,
    poolId: pool.id,
    assignedToTechnicianId: technicians[index % technicians.length].id,
  })));

  await createMany(tx, "generalReminder", pools.filter((_, index) => index % 12 === 0).map((pool, index) => ({
    title: index % 5 === 0 ? "Troca de meio filtrante" : index % 5 === 1 ? "Verificar celula salina" : index % 5 === 2 ? "Revisao bomba/filtro" : index % 5 === 3 ? "Limpeza preventiva casa tecnica" : "Verificar iluminacao",
    description: `Servico periodico associado a ${pool.name}. Deve aparecer na ficha tecnica e ficar ligado ao historico operacional.`,
    category: "TECHNICAL_PERIODIC_SERVICE",
    priority: index % 7 === 0 ? "HIGH" : "NORMAL",
    status: index % 11 === 0 ? "DONE" : "PENDING",
    dueAt: monthDate(6 + (index % 21), 9 + (index % 6), 0),
    completedAt: index % 11 === 0 ? monthDate(7 + (index % 21), 11, 0) : null,
    clientId: pool.clientId,
    poolId: pool.id,
    technicianId: technicians[index % technicians.length].id,
    repeatRule: index % 3 === 0 ? "EVERY_90_DAYS" : "EVERY_180_DAYS",
    createdBy: admin.email,
  })), 300);

  await createMany(tx, "technicalHistory", doneVisits.slice(0, 1200).map((visit, index) => ({
    poolId: visit.poolId,
    type: index % 20 === 0 ? "MANUTENCAO_PREVENTIVA" : "MANUTENCAO",
    component: index % 20 === 0 ? "Filtro" : "Piscina",
    message: `Historico tecnico da visita ${visit.id}`,
    description: "Checklist, leituras, consumo e fotografias registados.",
    status: "DONE",
    performedAt: visit.plannedDate || monthDate(1),
    doneAt: visit.plannedDate || monthDate(1),
    nextSuggested: addDays(visit.plannedDate || monthDate(1), 30),
  })), 400);

  const repairs = await tx.repair.findMany({ include: { pool: true }, orderBy: { id: "asc" } });
  const extrasByClient = new Map();
  for (const extra of extraVisits) {
    extrasByClient.set(extra.clientId, money((extrasByClient.get(extra.clientId) || 0) + Number(extra.totalPrice || 0)));
  }
  const repairsByClient = new Map();
  for (const repair of repairs) {
    const clientId = repair.pool?.clientId;
    if (!clientId) continue;
    repairsByClient.set(clientId, money((repairsByClient.get(clientId) || 0) + Number(repair.totalPrice || 0)));
  }
  const poolsByClient = new Map();
  for (const pool of pools) {
    if (!poolsByClient.has(pool.clientId)) poolsByClient.set(pool.clientId, []);
    poolsByClient.get(pool.clientId).push(pool);
  }

  for (let i = 0; i < clients.length; i += 1) {
    const client = clients[i];
    const clientPools = poolsByClient.get(client.id) || [];
    const monthly = money(clientPools.reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0));
    const extras = money(extrasByClient.get(client.id) || 0);
    const repairTotal = money(repairsByClient.get(client.id) || 0);
    const total = money(monthly + extras + repairTotal);
    const status = i % 17 === 0 ? "OVERDUE" : i % 11 === 0 ? "PARTIAL" : "PAID";
    const paid = status === "PAID" ? total : status === "PARTIAL" ? money(total * 0.45) : 0;
    const invoice = await tx.invoice.create({
      data: dataFor("invoice", {
        clientId: client.id,
        monthRef: CONFIG.monthRef,
        year: Number(CONFIG.monthRef.slice(0, 4)),
        month: CONFIG.monthRef,
        amount: total,
        amountCents: Math.round(total * 100),
        total,
        totalCents: Math.round(total * 100),
        subtotal: total,
        subtotalCurrent: total,
        totalAmount: total,
        amountPaid: paid,
        amountOpen: money(total - paid),
        status,
        paymentMethod: status === "PAID" ? "TRANSFER" : null,
        notes: `Fatura mensal criada por teste integral ${runTag}`,
        paidAt: status === "PAID" ? monthDate(28, 10) : null,
        dueDate: monthDate(28, 23),
        issueDate: monthDate(25, 9),
        invoiceNumber: `ST-${CONFIG.monthRef.replace("-", "")}-${pad(i + 1, 5)}`,
        requiresInvoice: Boolean(client.requiresInvoice),
      }),
    });
    await tx.invoiceLine.create({
      data: dataFor("invoiceLine", {
        invoiceId: invoice.id,
        type: "MONTHLY",
        lineType: "MONTHLY",
        description: `Mensalidade ${CONFIG.monthRef}`,
        quantity: 1,
        unitPrice: monthly,
        total: monthly,
        lineTotal: monthly,
        sourceMonth: CONFIG.monthRef,
      }),
    });
    if (extras > 0) {
      await tx.invoiceLine.create({
        data: dataFor("invoiceLine", {
          invoiceId: invoice.id,
          type: "EXTRA",
          lineType: "EXTRA",
          description: "Limpezas extra do mes",
          quantity: 1,
          unitPrice: extras,
          total: extras,
          lineTotal: extras,
          sourceMonth: CONFIG.monthRef,
        }),
      });
    }
    if (repairTotal > 0) {
      await tx.invoiceLine.create({
        data: dataFor("invoiceLine", {
          invoiceId: invoice.id,
          type: "REPAIR",
          lineType: "REPAIR",
          description: "Reparacoes orcamentadas/aprovadas",
          quantity: 1,
          unitPrice: repairTotal,
          total: repairTotal,
          lineTotal: repairTotal,
          sourceMonth: CONFIG.monthRef,
        }),
      });
    }
    if (paid > 0) {
      await tx.payment.create({
        data: dataFor("payment", {
          invoiceId: invoice.id,
          amount: paid,
          amountCents: Math.round(paid * 100),
          method: status === "PAID" ? "TRANSFER" : "MBWAY",
          notes: `Pagamento de teste ${runTag}`,
          paidAt: monthDate(29, 12),
        }),
      });
    }
    await tx.client.update({
      where: { id: client.id },
      data: dataFor("client", {
        monthlyFee: monthly,
        monthlyAmount: monthly,
        paymentStatus: status,
        lastPaymentAt: status === "PAID" ? monthDate(29, 12) : null,
        lastReminderAt: status !== "PAID" ? monthDate(29, 16) : null,
        lastReminderMonth: status !== "PAID" ? CONFIG.monthRef : null,
      }),
    });
  }

  await tx.monthlyReport.create({
    data: dataFor("monthlyReport", {
      month: CONFIG.monthRef,
      type: "ADMIN_STRESS_SUMMARY",
      data: {
        runTag,
        clients: CONFIG.clients,
        pools: CONFIG.pools,
        technicians: CONFIG.technicians,
        vehicles: CONFIG.vehicles,
      },
    }),
  });

  await tx.userAuditLog.create({
    data: dataFor("userAuditLog", {
      userId: admin.id,
      actor: admin.email,
      action: "RESET_AND_STRESS_SEED",
      entity: "System",
      entityId: runTag,
      details: {
        clients: CONFIG.clients,
        pools: CONFIG.pools,
        technicians: CONFIG.technicians,
        vehicles: CONFIG.vehicles,
      },
    }),
  }).catch(() => null);
}

async function collectSummary() {
  const [
    clients,
    pools,
    techs,
    vehicles,
    techUsers,
    sheets,
    rounds,
    roundPools,
    visits,
    doneVisits,
    plannedVisits,
    notDoneVisits,
    photos,
    chemicalUsage,
    transportGuides,
    workGuides,
    stockMovements,
    invoices,
    paidInvoices,
    partialInvoices,
    overdueInvoices,
    payments,
    alerts,
    repairs,
    operationalReminders,
    generalReminders,
    clientMessages,
    calculationProfiles,
    equipmentProfiles,
    technicalRooms,
    gpsPoints,
    serviceHistory,
  ] = await Promise.all([
    prisma.client.count({ where: { source: runTag } }),
    prisma.pool.count({ where: { source: runTag } }),
    prisma.technician.count(),
    prisma.vehicle.count(),
    prisma.user.count({ where: { role: "TECH" } }),
    prisma.technicalSheet.count(),
    prisma.round.count(),
    prisma.roundPool.count(),
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag } } }),
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag }, status: "DONE" } }),
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag }, status: "PLANNED" } }),
    prisma.serviceVisit.count({ where: { internalNotes: { startsWith: runTag }, status: "NOT_DONE" } }),
    prisma.visitPhoto.count(),
    prisma.chemicalUsage.count(),
    prisma.transportGuide.count(),
    prisma.workGuide.count(),
    prisma.stockMovement.count(),
    prisma.invoice.count({ where: { monthRef: CONFIG.monthRef } }),
    prisma.invoice.count({ where: { monthRef: CONFIG.monthRef, status: "PAID" } }),
    prisma.invoice.count({ where: { monthRef: CONFIG.monthRef, status: "PARTIAL" } }),
    prisma.invoice.count({ where: { monthRef: CONFIG.monthRef, status: "OVERDUE" } }),
    prisma.payment.count(),
    prisma.technicalAlert.count(),
    prisma.repair.count(),
    prisma.operationalReminder.count({ where: { isCompleted: false } }),
    prisma.generalReminder.count({ where: { category: { in: ["TECHNICAL_PERIODIC_SERVICE", "POOL_SERVICE_REMINDER"] } } }),
    prisma.clientMessage.count(),
    prisma.poolCalculationProfile.count(),
    prisma.poolEquipment.count(),
    prisma.technicalRoom.count(),
    prisma.technicianTrack.count(),
    prisma.technicalHistory.count(),
  ]);

  const [
    missingSheets,
    missingCalculationProfiles,
    missingEquipmentProfiles,
    missingTechnicalRooms,
    missingRounds,
    negativeStock,
    openDebtAgg,
    invoiceTotalAgg,
  ] = await Promise.all([
    prisma.pool.count({ where: { source: runTag, technicalSheet: { is: null } } }),
    prisma.pool.count({ where: { source: runTag, calculationProfile: { is: null } } }),
    prisma.pool.count({ where: { source: runTag, equipment: { is: null } } }),
    prisma.pool.count({ where: { source: runTag, technicalRoom: { is: null } } }),
    prisma.pool.count({ where: { source: runTag, roundPools: { none: {} } } }),
    prisma.workGuideItem.count({ where: { quantity: { lt: 0 } } }),
    prisma.invoice.aggregate({ where: { monthRef: CONFIG.monthRef }, _sum: { amountOpen: true } }),
    prisma.invoice.aggregate({ where: { monthRef: CONFIG.monthRef }, _sum: { total: true } }),
  ]);

  return {
    runTag,
    clients,
    pools,
    technicians: techs,
    techUsers,
    vehicles,
    technicalSheets: sheets,
    rounds,
    roundPools,
    visits,
    doneVisits,
    plannedVisits,
    notDoneVisits,
    photos,
    chemicalUsage,
    transportGuides,
    workGuides,
    stockMovements,
    invoices,
    paidInvoices,
    partialInvoices,
    overdueInvoices,
    payments,
    alerts,
    repairs,
    operationalReminders,
    generalReminders,
    clientMessages,
    calculationProfiles,
    equipmentProfiles,
    technicalRooms,
    gpsPoints,
    serviceHistory,
    missingSheets,
    missingCalculationProfiles,
    missingEquipmentProfiles,
    missingTechnicalRooms,
    missingRounds,
    negativeStock,
    invoiceTotal: money(invoiceTotalAgg._sum.total || 0),
    openDebt: money(openDebtAgg._sum.amountOpen || 0),
  };
}

function validate(summary) {
  const minimumPhotos = Math.min(1000, CONFIG.pools * 6);
  const checks = [
    ["clientes", summary.clients === CONFIG.clients, `${summary.clients}/${CONFIG.clients}`],
    ["piscinas/jacuzzis", summary.pools === CONFIG.pools, `${summary.pools}/${CONFIG.pools}`],
    ["tecnicos", summary.technicians === CONFIG.technicians, `${summary.technicians}/${CONFIG.technicians}`],
    ["utilizadores tecnicos", summary.techUsers === CONFIG.technicians, `${summary.techUsers}/${CONFIG.technicians}`],
    ["viaturas", summary.vehicles === CONFIG.vehicles, `${summary.vehicles}/${CONFIG.vehicles}`],
    ["ficha tecnica completa por piscina", summary.technicalSheets === CONFIG.pools && summary.calculationProfiles === CONFIG.pools && summary.equipmentProfiles === CONFIG.pools && summary.technicalRooms === CONFIG.pools && summary.missingSheets === 0 && summary.missingCalculationProfiles === 0 && summary.missingEquipmentProfiles === 0 && summary.missingTechnicalRooms === 0, `sheet=${summary.technicalSheets}, calculo=${summary.calculationProfiles}, equipamento=${summary.equipmentProfiles}, casa=${summary.technicalRooms}`],
    ["piscinas em ronda", summary.roundPools === CONFIG.pools && summary.missingRounds === 0, `${summary.roundPools}/${CONFIG.pools}`],
    ["visitas do mes", summary.visits >= CONFIG.pools * 4, `${summary.visits}`],
    ["visitas concluidas", summary.doneVisits > CONFIG.pools * 3, `${summary.doneVisits}`],
    ["visitas planeadas e nao realizadas", summary.plannedVisits > 0 && summary.notDoneVisits > 0, `planned=${summary.plannedVisits}, notDone=${summary.notDoneVisits}`],
    ["fotografias registadas", summary.photos >= minimumPhotos, `${summary.photos}/${minimumPhotos}`],
    ["consumos por dosagem", summary.chemicalUsage > 0 && summary.stockMovements > 0, `${summary.chemicalUsage}/${summary.stockMovements}`],
    ["guias AT e guias de obra", summary.transportGuides === CONFIG.vehicles && summary.workGuides === CONFIG.vehicles, `${summary.transportGuides}/${summary.workGuides}`],
    ["stock sem saldo negativo", summary.negativeStock === 0, `${summary.negativeStock}`],
    ["faturacao por cliente", summary.invoices === CONFIG.clients, `${summary.invoices}/${CONFIG.clients}`],
    ["pagamentos com estados variados", summary.paidInvoices > 0 && summary.partialInvoices > 0 && summary.overdueInvoices > 0 && summary.payments > 0, `paid=${summary.paidInvoices}, partial=${summary.partialInvoices}, overdue=${summary.overdueInvoices}`],
    ["portal cliente com mensagens", summary.clientMessages >= CONFIG.clients * 2, `${summary.clientMessages}/${CONFIG.clients * 2}`],
    ["alertas e reparacoes", summary.alerts > 0 && summary.repairs > 0, `${summary.alerts}/${summary.repairs}`],
    ["GPS e historico tecnico", summary.gpsPoints > 0 && summary.serviceHistory > 0, `${summary.gpsPoints}/${summary.serviceHistory}`],
    ["lembretes operacionais", summary.operationalReminders > 0, `${summary.operationalReminders}`],
    ["lembretes periodicos por piscina", summary.generalReminders > 0, `${summary.generalReminders}`],
  ];
  return checks.map(([name, ok, detail]) => ({ name, ok: Boolean(ok), detail }));
}

async function writeReport(summary, checks, admin) {
  const report = {
    name: "Cristal Water real database stress reset and flow test",
    startedAt: new Date().toISOString(),
    monthRef: CONFIG.monthRef,
    adminPreserved: { id: admin.id, email: admin.email, role: admin.role },
    config: CONFIG,
    summary,
    checks,
    status: checks.every((check) => check.ok) ? "PASSED" : "FAILED",
  };
  const file = path.join(reportDir, `real-db-stress-${CONFIG.monthRef}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return { report, file };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL nao esta definido. Nao e seguro limpar/semear sem base explicita.");
  }
  if (CONFIG.confirmReset !== "SIM") {
    throw new Error("Reset bloqueado. Define CW_CONFIRM_RESET=SIM para confirmar a limpeza operacional.");
  }
  if (CONFIG.clients < 1 || CONFIG.pools < CONFIG.clients || CONFIG.technicians < 1 || CONFIG.vehicles < 1) {
    throw new Error("Configuracao invalida: piscinas devem ser >= clientes e tecnicos/viaturas > 0.");
  }

  const admin = await findAdmin();
  if (!admin) throw new Error("Nenhum administrador encontrado para preservar.");
  const passwordHash = await bcrypt.hash("campo1234", 10);

  await prisma.$transaction(async (tx) => {
    await truncateOperationalTables(tx, admin.id);
    await seed(tx, admin, passwordHash);
  }, { maxWait: 10000, timeout: 180000 });

  const summary = await collectSummary();
  const checks = validate(summary);
  const { report, file } = await writeReport(summary, checks, admin);

  console.log("Cristal Water real DB stress test");
  console.log("---------------------------------");
  console.log(`Status: ${report.status}`);
  console.log(`Run: ${summary.runTag}`);
  console.log(`Clientes: ${summary.clients}`);
  console.log(`Piscinas/Jacuzzis: ${summary.pools}`);
  console.log(`Tecnicos/Viaturas: ${summary.technicians}/${summary.vehicles}`);
  console.log(`Visitas: ${summary.visits} (${summary.doneVisits} feitas, ${summary.plannedVisits} planeadas, ${summary.notDoneVisits} nao feitas)`);
  console.log(`Fichas tecnicas: sheet=${summary.technicalSheets}, calculo=${summary.calculationProfiles}, equipamento=${summary.equipmentProfiles}, casa=${summary.technicalRooms}`);
  console.log(`Guias AT/Obra: ${summary.transportGuides}/${summary.workGuides}`);
  console.log(`Portal cliente: mensagens=${summary.clientMessages}, lembretes periodicos=${summary.generalReminders}`);
  console.log(`Stock/GPS/Fotos: ${summary.stockMovements}/${summary.gpsPoints}/${summary.photos}`);
  console.log(`Faturas/Pagamentos: ${summary.invoices}/${summary.payments}`);
  console.log(`Faturacao: EUR ${summary.invoiceTotal} | Divida aberta: EUR ${summary.openDebt}`);
  console.log(`Checks: ${checks.filter((check) => check.ok).length}/${checks.length}`);
  console.log(`Relatorio: ${file}`);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    failed.forEach((check) => console.error(`FALHA ${check.name}: ${check.detail}`));
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
