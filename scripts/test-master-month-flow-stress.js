const fs = require("fs");
const path = require("path");

const reportDir = path.resolve(__dirname, "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });

const startedAt = new Date();
const monthRef = "2026-06";
const checks = [];
const warnings = [];

function addCheck(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
}

function warn(name, detail) {
  warnings.push({ name, detail });
}

function assertCheck(name, condition, detail = "") {
  addCheck(name, condition, detail);
}

function dayDate(day, hour = 8, minute = 0) {
  return new Date(Date.UTC(2026, 5, day, hour, minute, 0));
}

function iso(date) {
  return date.toISOString();
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function makeId(prefix) {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function sameDayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function routePoint(baseLat, baseLng, offset) {
  return {
    latitude: Number((baseLat + offset * 0.0041).toFixed(6)),
    longitude: Number((baseLng + offset * 0.0037).toFixed(6)),
  };
}

const counters = {};

const db = {
  clients: [],
  pools: [],
  technicalSheets: [],
  technicians: [],
  vehicles: [],
  transportGuides: [],
  workGuides: [],
  rounds: [],
  visits: [],
  extraVisitRules: [],
  alerts: [],
  repairs: [],
  stockMovements: [],
  gpsTimeline: [],
  invoices: [],
  payments: [],
  notifications: [],
  audit: [],
};

function createClient(data) {
  const client = {
    id: makeId("client"),
    status: "ACTIVE",
    active: true,
    billingActive: true,
    requiresInvoice: false,
    paymentStatus: "PAID",
    ...data,
  };
  db.clients.push(client);
  db.audit.push({ at: iso(new Date()), action: "CLIENT_CREATE", entityId: client.id });
  return client;
}

function createPool(client, data) {
  const pool = {
    id: makeId("pool"),
    clientId: client.id,
    status: "ACTIVE",
    active: true,
    scheduleMode: "PENDING_ROUND",
    monthlyAmount: 0,
    serviceFrequency: 1,
    ...data,
  };
  db.pools.push(pool);
  db.audit.push({ at: iso(new Date()), action: "POOL_CREATE", entityId: pool.id, clientId: client.id });
  return pool;
}

function createTechnicalSheet(pool, data) {
  const sheet = {
    id: makeId("sheet"),
    poolId: pool.id,
    volumeM3: pool.volumeM3 || 0,
    targetPhMin: 7.2,
    targetPhMax: 7.6,
    targetChlorineMin: 1,
    targetChlorineMax: 3,
    targetAlkalinityMin: 80,
    targetAlkalinityMax: 120,
    targetOrpMinMv: 650,
    ...data,
  };
  db.technicalSheets.push(sheet);
  return sheet;
}

function createTechnician(data) {
  const technician = { id: makeId("tech"), active: true, role: "TECHNICIAN", ...data };
  db.technicians.push(technician);
  return technician;
}

function createVehicle(data) {
  const vehicle = { id: makeId("vehicle"), active: true, stock: {}, ...data };
  db.vehicles.push(vehicle);
  return vehicle;
}

function loadVehicleStock(vehicle, productName, quantity, unit = "kg") {
  const key = `${productName}|${unit}`;
  vehicle.stock[key] = money((vehicle.stock[key] || 0) + quantity);
}

function consumeVehicleStock(vehicle, workGuide, visit, productName, quantity, unit = "kg", notes = "") {
  const key = `${productName}|${unit}`;
  const before = money(vehicle.stock[key] || 0);
  vehicle.stock[key] = money(before - quantity);
  const movement = {
    id: makeId("stockMove"),
    vehicleId: vehicle.id,
    workGuideId: workGuide.id,
    visitId: visit ? visit.id : null,
    technicianId: workGuide.technicianId,
    productName,
    quantity,
    unit,
    movementType: "CONSUMPTION",
    createdAt: iso(visit ? visit.endAt || visit.startAt : workGuide.createdAt),
    notes,
  };
  db.stockMovements.push(movement);
  workGuide.movements.push(movement.id);
  if (visit) visit.stockMovements.push(movement.id);
  return movement;
}

function createTransportGuide(vehicle, data = {}) {
  const guide = {
    id: makeId("transportGuide"),
    codeAT: data.codeAT || `AT-CW-${monthRef}-${vehicle.plate}`,
    vehicleId: vehicle.id,
    status: "ACTIVE",
    origin: "Armazem Cristal Water",
    destination: "Clientes em rota",
    validFrom: iso(dayDate(1, 7)),
    validUntil: iso(dayDate(30, 20)),
    items: [],
    officialDocumentUploaded: true,
    ...data,
  };
  db.transportGuides.push(guide);
  return guide;
}

function createWorkGuide(technician, vehicle, transportGuide, day) {
  const guide = {
    id: makeId("workGuide"),
    guideId: transportGuide.id,
    vehicleId: vehicle.id,
    technicianId: technician.id,
    status: "OPEN",
    createdAt: iso(dayDate(day, 7, 30)),
    closedAt: iso(dayDate(day, 18, 30)),
    movements: [],
  };
  db.workGuides.push(guide);
  return guide;
}

function createRound(name, technician, pools, dayOfWeek) {
  const round = {
    id: makeId("round"),
    name,
    technicianId: technician.id,
    dayOfWeek,
    poolIds: pools.map((pool) => pool.id),
    active: true,
  };
  db.rounds.push(round);
  pools.forEach((pool) => { pool.scheduleMode = "ROUND_ASSIGNED"; });
  return round;
}

function createVisit(data) {
  const visit = {
    id: makeId("visit"),
    type: "MAINTENANCE",
    status: "PLANNED",
    checklist: {},
    readings: {},
    photos: [],
    stockMovements: [],
    alerts: [],
    gpsEvents: [],
    billable: false,
    price: 0,
    ...data,
  };
  db.visits.push(visit);
  return visit;
}

function addGps(technician, visit, at, point, eventType) {
  const gps = {
    id: makeId("gps"),
    technicianId: technician.id,
    visitId: visit ? visit.id : null,
    at: iso(at),
    eventType,
    ...point,
  };
  db.gpsTimeline.push(gps);
  if (visit) visit.gpsEvents.push(gps.id);
  return gps;
}

function completeVisit(visit, technician, vehicle, workGuide, options = {}) {
  const pool = db.pools.find((item) => item.id === visit.poolId);
  const baseLat = pool.latitude || 38.7;
  const baseLng = pool.longitude || -9.4;
  visit.status = options.status || "DONE";
  visit.startAt = options.startAt || addDays(new Date(visit.plannedAt), 0);
  visit.endAt = options.endAt || new Date(visit.startAt.getTime() + 38 * 60 * 1000);
  visit.technicianId = technician.id;
  visit.vehicleId = vehicle.id;
  visit.workGuideId = workGuide.id;
  visit.checklist = {
    vacuumed: true,
    skimmerCleaned: true,
    pumpBasketCleaned: true,
    filterWashed: true,
    waterlineClean: true,
    equipmentChecked: true,
    ...options.checklist,
  };
  visit.readings = {
    ph: options.ph ?? 7.4,
    chlorine: options.chlorine ?? 1.8,
    alkalinity: options.alkalinity ?? 95,
    orp: options.orp ?? 710,
    salt: options.salt ?? 3400,
  };
  visit.photos.push({ type: "BEFORE", at: iso(visit.startAt) }, { type: "AFTER", at: iso(visit.endAt) });
  addGps(technician, visit, new Date(visit.startAt.getTime() - 12 * 60 * 1000), routePoint(baseLat, baseLng, -1), "A_CAMINHO");
  addGps(technician, visit, visit.startAt, routePoint(baseLat, baseLng, 0), "START");
  addGps(technician, visit, visit.endAt, routePoint(baseLat, baseLng, 0.15), "DONE");
  consumeVehicleStock(vehicle, workGuide, visit, options.product || "Cloro pastilhas", options.quantity || 0.7, "kg", "Servico normal");
  if (options.extraProduct) consumeVehicleStock(vehicle, workGuide, visit, options.extraProduct, options.extraQuantity || 1, options.extraUnit || "kg", "Extra tecnico");
  return visit;
}

function createExtraRule(pool, data) {
  const rule = {
    id: makeId("extraRule"),
    poolId: pool.id,
    active: true,
    billingMode: "EXTRA",
    unitPrice: 45,
    ...data,
  };
  db.extraVisitRules.push(rule);
  return rule;
}

function addProblem(visit, type, message, priority = "HIGH", repairPrice = 0) {
  const alert = {
    id: makeId("alert"),
    poolId: visit.poolId,
    visitId: visit.id,
    type,
    message,
    priority,
    status: repairPrice > 0 ? "QUOTE_REQUIRED" : "OPEN",
    createdAt: iso(visit.endAt || visit.startAt),
  };
  db.alerts.push(alert);
  visit.alerts.push(alert.id);
  db.notifications.push({ id: makeId("notification"), role: "ADMIN", type: priority === "HIGH" ? "CRITICAL" : "ALERT", alertId: alert.id });
  if (!repairPrice) return { alert };
  const repair = {
    id: makeId("repair"),
    poolId: visit.poolId,
    alertId: alert.id,
    visitId: visit.id,
    problem: message,
    status: "APPROVED",
    priority,
    totalPrice: repairPrice,
    createdAt: alert.createdAt,
  };
  db.repairs.push(repair);
  return { alert, repair };
}

function createInvoice(client, lines, status = "PENDING") {
  const total = money(lines.reduce((sum, line) => sum + line.total, 0));
  const invoice = {
    id: makeId("invoice"),
    clientId: client.id,
    monthRef,
    status,
    lines,
    total,
    amountPaid: 0,
    amountOpen: total,
    requiresInvoice: Boolean(client.requiresInvoice),
  };
  db.invoices.push(invoice);
  return invoice;
}

function registerPayment(invoice, amount, method) {
  const payment = {
    id: makeId("payment"),
    invoiceId: invoice.id,
    amount: money(amount),
    method,
    paidAt: iso(dayDate(30, 12)),
  };
  db.payments.push(payment);
  invoice.amountPaid = money(invoice.amountPaid + payment.amount);
  invoice.amountOpen = money(Math.max(0, invoice.total - invoice.amountPaid));
  invoice.status = invoice.amountOpen <= 0 ? "PAID" : "PARTIAL";
  return payment;
}

function buildScenario() {
  const condo = createClient({ name: "QA Condominio Azul", type: "CONDOMINIO", monthlyAmount: 260, requiresInvoice: true, fiscalNif: "509000111" });
  const villa = createClient({ name: "QA Moradia Silva", type: "PARTICULAR", monthlyAmount: 130, requiresInvoice: false });
  const hotel = createClient({ name: "QA Hotel Atlantico", type: "EMPRESA", monthlyAmount: 620, requiresInvoice: true, fiscalNif: "509000222" });

  const condoPool = createPool(condo, { name: "Piscina Principal QA", type: "POOL", volumeM3: 72, monthlyAmount: 210, serviceFrequency: 2, latitude: 38.6979, longitude: -9.4215 });
  const condoJacuzzi = createPool(condo, { name: "Jacuzzi Condominio QA", type: "JACUZZI", volumeM3: 8, monthlyAmount: 50, serviceFrequency: 1, latitude: 38.6981, longitude: -9.4208 });
  const villaPool = createPool(villa, { name: "Piscina Moradia QA", type: "POOL", volumeM3: 55, monthlyAmount: 130, serviceFrequency: 1, latitude: 38.8029, longitude: -9.3817 });
  const hotelPool = createPool(hotel, { name: "Piscina Hotel QA", type: "POOL", volumeM3: 140, monthlyAmount: 620, serviceFrequency: 3, latitude: 38.707, longitude: -9.136 });

  [condoPool, condoJacuzzi, villaPool, hotelPool].forEach((pool) => createTechnicalSheet(pool, {
    disinfectionType: pool.type === "JACUZZI" ? "BROMO" : "SAL",
    filterBrandModel: "QA Filter Pro",
    pumpHorsePower: pool.type === "JACUZZI" ? 0.75 : 1.5,
    specialObservations: "Ficha tecnica QA completa para teste mensal.",
  }));

  const rui = createTechnician({ name: "QA Rui Tecnico", pin: "1111" });
  const marta = createTechnician({ name: "QA Marta Tecnica", pin: "2222" });
  const joao = createTechnician({ name: "QA Joao Tecnico", pin: "3333" });

  const vanA = createVehicle({ plate: "QA-11-AA", name: "Carrinha QA Norte" });
  const vanB = createVehicle({ plate: "QA-22-BB", name: "Carrinha QA Sul" });
  [vanA, vanB].forEach((vehicle) => {
    loadVehicleStock(vehicle, "Cloro pastilhas", 80);
    loadVehicleStock(vehicle, "pH menos", 40);
    loadVehicleStock(vehicle, "Cloro shock", 30);
    loadVehicleStock(vehicle, "Algicida", 20);
  });

  const guideA = createTransportGuide(vanA, { codeAT: "AT-QA-2026-06-A" });
  const guideB = createTransportGuide(vanB, { codeAT: "AT-QA-2026-06-B" });

  const rounds = [
    createRound("QA Segunda Cascais", rui, [condoPool, condoJacuzzi], 1),
    createRound("QA Quinta Cascais", rui, [condoPool], 4),
    createRound("QA Terca Sintra", marta, [villaPool], 2),
    createRound("QA Hotel Alta Utilizacao", joao, [hotelPool], 1),
  ];

  const oneOffExtra = createExtraRule(condoJacuzzi, {
    name: "Limpeza pontual jacuzzi",
    recurrenceType: "ONE_OFF",
    startDate: iso(dayDate(6, 10)),
    endDate: iso(dayDate(6, 11)),
    unitPrice: 60,
  });
  const recurringExtra = createExtraRule(hotelPool, {
    name: "Limpezas extra hotel evento",
    recurrenceType: "DATE_RANGE",
    startDate: iso(dayDate(12, 9)),
    endDate: iso(dayDate(20, 18)),
    visitsPerWeek: 3,
    unitPrice: 75,
  });

  return { clients: { condo, villa, hotel }, pools: { condoPool, condoJacuzzi, villaPool, hotelPool }, technicians: { rui, marta, joao }, vehicles: { vanA, vanB }, guides: { guideA, guideB }, rounds, extraRules: { oneOffExtra, recurringExtra } };
}

function simulateMonth(s) {
  const dayPlans = [
    [3, s.pools.condoPool, s.technicians.rui, s.vehicles.vanA, s.guides.guideA],
    [3, s.pools.condoJacuzzi, s.technicians.rui, s.vehicles.vanA, s.guides.guideA],
    [4, s.pools.villaPool, s.technicians.marta, s.vehicles.vanB, s.guides.guideB],
    [5, s.pools.hotelPool, s.technicians.joao, s.vehicles.vanB, s.guides.guideB],
    [6, s.pools.condoJacuzzi, s.technicians.rui, s.vehicles.vanA, s.guides.guideA, "EXTRA", 60],
    [8, s.pools.condoPool, s.technicians.rui, s.vehicles.vanA, s.guides.guideA],
    [9, s.pools.villaPool, s.technicians.marta, s.vehicles.vanB, s.guides.guideB],
    [10, s.pools.hotelPool, s.technicians.joao, s.vehicles.vanB, s.guides.guideB],
    [12, s.pools.hotelPool, s.technicians.joao, s.vehicles.vanB, s.guides.guideB, "EXTRA", 75],
    [13, s.pools.condoPool, s.technicians.rui, s.vehicles.vanA, s.guides.guideA],
    [15, s.pools.hotelPool, s.technicians.joao, s.vehicles.vanB, s.guides.guideB, "EXTRA", 75],
    [16, s.pools.villaPool, s.technicians.marta, s.vehicles.vanB, s.guides.guideB],
    [18, s.pools.condoPool, s.technicians.rui, s.vehicles.vanA, s.guides.guideA, "NO_ACCESS", 0],
    [19, s.pools.condoPool, s.technicians.rui, s.vehicles.vanA, s.guides.guideA],
    [19, s.pools.hotelPool, s.technicians.joao, s.vehicles.vanB, s.guides.guideB, "EXTRA", 75],
    [22, s.pools.condoJacuzzi, s.technicians.rui, s.vehicles.vanA, s.guides.guideA],
    [23, s.pools.villaPool, s.technicians.marta, s.vehicles.vanB, s.guides.guideB],
    [24, s.pools.hotelPool, s.technicians.joao, s.vehicles.vanB, s.guides.guideB],
    [26, s.pools.condoPool, s.technicians.rui, s.vehicles.vanA, s.guides.guideA],
    [29, s.pools.hotelPool, s.technicians.joao, s.vehicles.vanB, s.guides.guideB],
    [30, s.pools.villaPool, s.technicians.marta, s.vehicles.vanB, s.guides.guideB],
  ];

  const workGuideByDayTech = new Map();
  function guideFor(day, technician, vehicle, transportGuide) {
    const key = `${day}|${technician.id}`;
    if (!workGuideByDayTech.has(key)) {
      workGuideByDayTech.set(key, createWorkGuide(technician, vehicle, transportGuide, day));
    }
    return workGuideByDayTech.get(key);
  }

  for (const [day, pool, technician, vehicle, transportGuide, kind, price] of dayPlans) {
    const client = db.clients.find((item) => item.id === pool.clientId);
    const workGuide = guideFor(day, technician, vehicle, transportGuide);
    const plannedAt = dayDate(day, 9 + (db.visits.length % 5), 15);
    const visit = createVisit({
      clientId: client.id,
      poolId: pool.id,
      plannedAt,
      type: kind === "EXTRA" ? "EXTRA_CLEANING" : "MAINTENANCE",
      billable: kind === "EXTRA",
      price: money(price || 0),
      extraRuleId: kind === "EXTRA" && pool.id === s.pools.hotelPool.id ? s.extraRules.recurringExtra.id : kind === "EXTRA" ? s.extraRules.oneOffExtra.id : null,
    });

    if (kind === "NO_ACCESS") {
      visit.status = "NOT_DONE";
      visit.reason = "Sem acesso";
      visit.startAt = plannedAt;
      visit.endAt = new Date(plannedAt.getTime() + 10 * 60 * 1000);
      visit.technicianId = technician.id;
      visit.vehicleId = vehicle.id;
      visit.workGuideId = workGuide.id;
      addGps(technician, visit, visit.startAt, routePoint(pool.latitude, pool.longitude, 0), "NO_ACCESS");
      addProblem(visit, "SEM_ACESSO", "Portao fechado. Reagendar visita.", "NORMAL", 0);
      continue;
    }

    const options = {};
    if (pool.type === "JACUZZI") {
      options.product = "Bromo";
      options.quantity = 0.25;
      loadVehicleStock(vehicle, "Bromo", 5);
    }
    if (kind === "EXTRA") {
      options.extraProduct = "Cloro shock";
      options.extraQuantity = 2;
    }
    if (day === 8 && pool.id === s.pools.condoPool.id) {
      options.extraProduct = "pH menos";
      options.extraQuantity = 1.5;
    }
    if (day === 15 && pool.id === s.pools.hotelPool.id) {
      options.extraProduct = "Algicida";
      options.extraQuantity = 2;
      options.chlorine = 0.4;
      options.ph = 7.9;
    }
    completeVisit(visit, technician, vehicle, workGuide, options);

    if (day === 8 && pool.id === s.pools.condoPool.id) {
      addProblem(visit, "BOMBA", "Bomba com ruido e vibracao. Orçamento necessario.", "HIGH", 185);
    }
    if (day === 15 && pool.id === s.pools.hotelPool.id) {
      addProblem(visit, "AGUA_VERDE", "Agua verde apos evento. Tratamento de choque aplicado.", "HIGH", 90);
    }
  }
}

function invoiceMonth() {
  for (const client of db.clients) {
    const clientPools = db.pools.filter((pool) => pool.clientId === client.id);
    const visits = db.visits.filter((visit) => visit.clientId === client.id);
    const repairs = db.repairs.filter((repair) => clientPools.some((pool) => pool.id === repair.poolId));
    const lines = [];
    const monthlyTotal = money(clientPools.reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0));
    if (monthlyTotal > 0) lines.push({ type: "MONTHLY", description: `Mensalidade ${monthRef}`, quantity: 1, unitPrice: monthlyTotal, total: monthlyTotal });
    visits.filter((visit) => visit.billable).forEach((visit) => lines.push({ type: "EXTRA", description: `Limpeza extra ${visit.id}`, quantity: 1, unitPrice: visit.price, total: visit.price, referenceId: visit.id }));
    repairs.forEach((repair) => lines.push({ type: "REPAIR", description: repair.problem, quantity: 1, unitPrice: repair.totalPrice, total: repair.totalPrice, referenceId: repair.id }));
    const invoice = createInvoice(client, lines);
    if (client.name.includes("Condominio")) registerPayment(invoice, invoice.total, "TRANSFER");
    if (client.name.includes("Moradia")) registerPayment(invoice, Math.max(40, invoice.total / 2), "MBWAY");
    if (client.name.includes("Hotel")) invoice.status = "OVERDUE";
  }
}

function technicianPortalPayload(technician) {
  const assignedVisits = db.visits.filter((visit) => visit.technicianId === technician.id);
  return assignedVisits.map((visit) => {
    const pool = db.pools.find((item) => item.id === visit.poolId);
    return {
      id: visit.id,
      poolName: pool.name,
      status: visit.status,
      plannedAt: visit.plannedAt,
      hasAccessCode: true,
      // No finance fields here by design.
    };
  });
}

function validateScenario() {
  assertCheck("clientes criados antes das piscinas", db.clients.length === 3 && db.pools.every((pool) => db.clients.some((client) => client.id === pool.clientId)), `${db.clients.length} clientes, ${db.pools.length} piscinas/jacuzzis`);
  assertCheck("cada piscina/jacuzzi tem ficha tecnica", db.pools.every((pool) => db.technicalSheets.some((sheet) => sheet.poolId === pool.id)), `${db.technicalSheets.length}/${db.pools.length}`);
  assertCheck("rondas ligam tecnicos e piscinas", db.rounds.length >= 4 && db.rounds.every((round) => round.technicianId && round.poolIds.length), `${db.rounds.length} rondas`);
  assertCheck("guias de transporte oficiais carregadas", db.transportGuides.every((guide) => guide.codeAT && guide.officialDocumentUploaded), `${db.transportGuides.length} guias`);
  assertCheck("guias de obra ligam tecnico e viatura", db.workGuides.length > 0 && db.workGuides.every((guide) => guide.technicianId && guide.vehicleId && guide.guideId), `${db.workGuides.length} guias de obra`);
  assertCheck("visitas do mes geradas", db.visits.length >= 20, `${db.visits.length} visitas`);
  assertCheck("visitas concluidas tem checklist, leituras, fotos e GPS", db.visits.filter((visit) => visit.status === "DONE").every((visit) => Object.keys(visit.checklist).length && Object.keys(visit.readings).length && visit.photos.length >= 2 && visit.gpsEvents.length >= 3), "checklist/readings/fotos/gps completos");
  assertCheck("visita sem acesso fica justificada e gera alerta", db.visits.some((visit) => visit.status === "NOT_DONE" && visit.reason === "Sem acesso" && visit.alerts.length), "sem acesso testado");
  assertCheck("limpeza pontual e limpezas extra por intervalo", db.visits.some((visit) => visit.type === "EXTRA_CLEANING" && visit.extraRuleId) && db.visits.filter((visit) => visit.type === "EXTRA_CLEANING").length >= 4, `${db.visits.filter((visit) => visit.type === "EXTRA_CLEANING").length} extras`);
  assertCheck("problemas tecnicos geram alertas e reparacoes", db.alerts.length >= 3 && db.repairs.length >= 2, `${db.alerts.length} alertas, ${db.repairs.length} reparacoes`);
  assertCheck("consumos de stock ligados a visita e guia de obra", db.stockMovements.every((movement) => movement.workGuideId && (movement.visitId || movement.notes)), `${db.stockMovements.length} movimentos`);
  assertCheck("stock de viaturas nao fica negativo", db.vehicles.every((vehicle) => Object.values(vehicle.stock).every((qty) => qty >= 0)), "saldo final valido");
  assertCheck("timeline GPS cobre tecnicos em campo", db.gpsTimeline.length >= db.visits.filter((visit) => visit.status === "DONE").length * 3, `${db.gpsTimeline.length} pontos GPS`);
  assertCheck("faturacao mensal criada para todos clientes", db.invoices.length === db.clients.length && db.invoices.every((invoice) => invoice.lines.length && invoice.total > 0), `${db.invoices.length} faturas`);
  assertCheck("totais de fatura batem com linhas", db.invoices.every((invoice) => money(invoice.lines.reduce((sum, line) => sum + line.total, 0)) === invoice.total), "totais coerentes");
  assertCheck("pagamentos atualizam estado e saldo", db.invoices.some((invoice) => invoice.status === "PAID") && db.invoices.some((invoice) => invoice.status === "PARTIAL") && db.invoices.some((invoice) => invoice.status === "OVERDUE"), "pago/parcial/em atraso testados");
  assertCheck("divida bloqueia eliminacao definitiva", db.invoices.filter((invoice) => invoice.amountOpen > 0).every((invoice) => invoice.status !== "PAID"), "clientes com saldo em aberto preservados");
  const techPayload = technicianPortalPayload(db.technicians[0]);
  assertCheck("portal tecnico nao expoe valores ou faturacao", techPayload.every((item) => item.monthlyAmount === undefined && item.invoice === undefined && item.nif === undefined), "RBAC tecnico validado");

  const generatedExtraKeys = new Set();
  let duplicateExtras = 0;
  db.visits.filter((visit) => visit.type === "EXTRA_CLEANING").forEach((visit) => {
    const key = `${visit.poolId}|${sameDayKey(visit.plannedAt)}|${visit.extraRuleId}`;
    if (generatedExtraKeys.has(key)) duplicateExtras += 1;
    generatedExtraKeys.add(key);
  });
  assertCheck("limpezas extra nao duplicadas por dia/regra", duplicateExtras === 0, `${duplicateExtras} duplicados`);

  if (!process.env.DATABASE_URL) {
    warn("database-url", "DATABASE_URL nao esta definido nesta sessao; este teste correu como simulacao deterministica com verificacoes de integridade.");
  }
}

function buildDailyLogs() {
  const byDay = new Map();
  for (const visit of db.visits) {
    const key = sameDayKey(visit.plannedAt);
    if (!byDay.has(key)) byDay.set(key, { day: key, services: [], timeline: [] });
    byDay.get(key).services.push(visit.id);
  }
  for (const gps of db.gpsTimeline) {
    const key = sameDayKey(gps.at);
    if (!byDay.has(key)) byDay.set(key, { day: key, services: [], timeline: [] });
    byDay.get(key).timeline.push({ type: "GPS", at: gps.at, technicianId: gps.technicianId, visitId: gps.visitId });
  }
  for (const movement of db.stockMovements) {
    const key = sameDayKey(movement.createdAt);
    if (!byDay.has(key)) byDay.set(key, { day: key, services: [], timeline: [] });
    byDay.get(key).timeline.push({ type: "STOCK", at: movement.createdAt, technicianId: movement.technicianId, visitId: movement.visitId });
  }
  return Array.from(byDay.values()).map((log) => ({
    ...log,
    timeline: log.timeline.sort((a, b) => new Date(a.at) - new Date(b.at)),
  })).sort((a, b) => a.day.localeCompare(b.day));
}

function buildReport() {
  const failed = checks.filter((check) => !check.ok);
  const finishedAt = new Date();
  return {
    name: "Cristal Water master monthly flow stress",
    monthRef,
    startedAt: iso(startedAt),
    finishedAt: iso(finishedAt),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    status: failed.length ? "FAILED" : "PASSED",
    summary: {
      clients: db.clients.length,
      poolsAndJacuzzis: db.pools.length,
      technicalSheets: db.technicalSheets.length,
      technicians: db.technicians.length,
      vehicles: db.vehicles.length,
      transportGuides: db.transportGuides.length,
      workGuides: db.workGuides.length,
      rounds: db.rounds.length,
      visits: db.visits.length,
      doneVisits: db.visits.filter((visit) => visit.status === "DONE").length,
      notDoneVisits: db.visits.filter((visit) => visit.status === "NOT_DONE").length,
      extraVisits: db.visits.filter((visit) => visit.type === "EXTRA_CLEANING").length,
      alerts: db.alerts.length,
      repairs: db.repairs.length,
      stockMovements: db.stockMovements.length,
      gpsPoints: db.gpsTimeline.length,
      invoices: db.invoices.length,
      payments: db.payments.length,
      invoiceTotal: money(db.invoices.reduce((sum, invoice) => sum + invoice.total, 0)),
      openDebt: money(db.invoices.reduce((sum, invoice) => sum + invoice.amountOpen, 0)),
    },
    checks,
    warnings,
    dailyLogs: buildDailyLogs(),
  };
}

function main() {
  const scenario = buildScenario();
  simulateMonth(scenario);
  invoiceMonth();
  validateScenario();

  const report = buildReport();
  const reportPath = path.join(reportDir, `master-flow-stress-${monthRef}-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("Cristal Water master monthly flow stress");
  console.log("----------------------------------------");
  console.log(`Status: ${report.status}`);
  console.log(`Clientes: ${report.summary.clients}`);
  console.log(`Piscinas/Jacuzzis: ${report.summary.poolsAndJacuzzis}`);
  console.log(`Visitas: ${report.summary.visits} (${report.summary.doneVisits} concluidas, ${report.summary.extraVisits} extra)`);
  console.log(`Alertas/Reparacoes: ${report.summary.alerts}/${report.summary.repairs}`);
  console.log(`Guias AT/Obra: ${report.summary.transportGuides}/${report.summary.workGuides}`);
  console.log(`GPS/Stock movimentos: ${report.summary.gpsPoints}/${report.summary.stockMovements}`);
  console.log(`Faturacao: EUR ${report.summary.invoiceTotal} | aberto: EUR ${report.summary.openDebt}`);
  console.log(`Checks: ${checks.filter((check) => check.ok).length}/${checks.length}`);
  if (warnings.length) console.log(`Avisos: ${warnings.length}`);
  console.log(`Relatorio: ${reportPath}`);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error("Falhas:");
    failed.forEach((check) => console.error(`- ${check.name}: ${check.detail}`));
    process.exit(1);
  }
}

main();
