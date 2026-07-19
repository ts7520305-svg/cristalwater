const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

require("../src/loadEnv")();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["warn", "error"] });
const fetchImpl = global.fetch || require("node-fetch");

const BASE_URL = process.env.CW_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`;
const reportDir = path.resolve(__dirname, "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });

const batteryRunId = `INTERLINK-${Date.now()}`;
const checks = [];
let adminToken = null;
let clientToken = null;

function check(name, ok, detail = "") {
  const item = { name, ok: Boolean(ok), detail };
  checks.push(item);
  console.log(`${item.ok ? "OK" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
  return item.ok;
}

async function ensureAdminToken() {
  if (adminToken) return adminToken;
  const email = process.env.ADMIN_EMAIL || "cristal.water@sapo.pt";
  const password = process.env.ADMIN_PASSWORD || "";
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
    data = { raw: text.slice(0, 200) };
  }
  if (!response.ok || !data.token) {
    throw new Error(`Admin login failed: ${response.status} ${data.error || data.message || text.slice(0, 200)}`);
  }
  adminToken = data.token;
  return adminToken;
}

async function ensureClientToken(client) {
  if (clientToken) return clientToken;
  const password = `ClientPortal-${batteryRunId}`;
  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.client.update({
    where: { id: client.id },
    data: { password: hashedPassword },
  });

  const response = await fetchImpl(`${BASE_URL}/api/client-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: client.email, password }),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text.slice(0, 200) };
  }
  if (!response.ok || !data.token) {
    throw new Error(`Client login failed: ${response.status} ${data.message || data.error || text.slice(0, 200)}`);
  }
  clientToken = data.token;
  return clientToken;
}

async function api(method, pathname, body, expected = [200, 201]) {
  const token = await ensureAdminToken();
  const response = await fetchImpl(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-actor": `battery-${batteryRunId}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text.slice(0, 500) };
  }
  if (!expected.includes(response.status) || (response.status < 400 && data.ok === false)) {
    throw new Error(`${method} ${pathname} -> ${response.status}: ${data.error || data.message || text.slice(0, 250)}`);
  }
  return { status: response.status, data };
}

function todayIso() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function runMonthlyFlow() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/test-real-month-flow-api.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, CW_BASE_URL: BASE_URL, NODE_ENV: "test" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(`test-real-month-flow-api terminou com codigo ${code}`));
      const match = output.match(/REAL-MES-\d+/);
      if (!match) return reject(new Error("Nao consegui identificar o runId do teste mensal."));
      resolve(match[0]);
    });
  });
}

async function latestRunContext(monthRunId) {
  const client = await prisma.client.findFirst({
    where: { name: { contains: monthRunId, mode: "insensitive" } },
    include: {
      pools: {
        include: {
          technicalSheet: true,
          equipment: true,
          technicalRoom: true,
          serviceVisits: { orderBy: { plannedDate: "asc" } },
        },
      },
      invoices: { include: { lines: true, payments: true } },
      messages: true,
    },
    orderBy: { id: "asc" },
  });
  if (!client) throw new Error(`Cliente do teste ${monthRunId} nao encontrado.`);

  const pool = client.pools[0];
  const technician = await prisma.technician.findFirst({
    where: { name: { contains: monthRunId, mode: "insensitive" } },
    include: { vehicle: true },
    orderBy: { id: "asc" },
  });
  const round = await prisma.round.findFirst({
    where: { name: { contains: monthRunId, mode: "insensitive" } },
    orderBy: { id: "asc" },
  });
  const workGuide = await prisma.workGuide.findFirst({
    where: { technicianId: technician?.id || undefined },
    include: { guide: { include: { items: true } }, items: true },
    orderBy: { id: "asc" },
  });

  if (!pool || !technician || !round || !workGuide) {
    throw new Error("Contexto operacional incompleto para a bateria de interligacoes.");
  }

  return { client, pool, technician, vehicle: technician.vehicle, round, workGuide };
}

async function extraCommunicationChecks(monthRunId) {
  const ctx = await latestRunContext(monthRunId);
  const day = todayIso();

  const planned = await api("POST", "/api/core/visits", {
    poolId: ctx.pool.id,
    roundId: ctx.round.id,
    technicianId: ctx.technician.id,
    plannedDate: todayAt(11, 30),
    notes: `Bateria interligacoes ${batteryRunId}`,
  });
  const plannedVisit = planned.data.visit;
  check("visita extra de hoje criada para validar campo", Boolean(plannedVisit?.id), `visita ${plannedVisit?.id || "-"}`);

  const keyCode = `KEY-${batteryRunId}`;
  const key = await api("POST", "/api/keys", {
    poolId: ctx.pool.id,
    keyCode,
    description: `Codigo de portao ${batteryRunId}`,
    requiredForVisit: true,
    visibleToTechnician: true,
  });
  check("chave/codigo ligada a piscina", Boolean(key.data.key?.id), key.data.key?.codeValue || key.data.key?.keyCode || keyCode);

  const morning = await api("GET", `/api/keys/required/morning?date=${encodeURIComponent(day)}&technicianId=${ctx.technician.id}`);
  check("lista matinal de chaves comunica com rondas/visitas", JSON.stringify(morning.data).includes(keyCode), keyCode);

  const today = await api("GET", `/api/technician/today?date=${encodeURIComponent(day)}&technicianId=${ctx.technician.id}`);
  const visitInField = (today.data.visits || []).find((visit) => Number(visit.id) === Number(plannedVisit.id));
  const fieldHasKey = JSON.stringify(visitInField || {}).includes(keyCode);
  check("portal tecnico recebe visita e codigo de acesso", Boolean(visitInField && fieldHasKey), `visita ${plannedVisit.id}`);

  const dueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const water = await api("POST", "/api/technician/water-reminders", {
    visitId: plannedVisit.id,
    poolId: ctx.pool.id,
    clientId: ctx.client.id,
    technicianId: ctx.technician.id,
    dueAt,
    note: `Agua aberta ${batteryRunId}`,
  });
  check("agua aberta cria lembrete e notificacao", Boolean(water.data.reminder?.id && water.data.notification?.id), `lembrete ${water.data.reminder?.id || "-"}`);

  const alarm = await api("POST", `/api/technician/water-reminders/${water.data.reminder.id}/alarm`, {
    visitId: plannedVisit.id,
    poolId: ctx.pool.id,
    clientId: ctx.client.id,
    technicianId: ctx.technician.id,
    dueAt,
    manual: true,
    note: `Alarme agua aberta ${batteryRunId}`,
  });
  check("alarme de agua aberta chega a alertas/notificacoes", Boolean(alarm.data.alert?.id && (alarm.data.notifications || []).length >= 2), `alerta ${alarm.data.alert?.id || "-"}`);

  const stockReminder = await api("POST", "/api/technician/stock-reminders", {
    requestType: "STOCK_REQUEST",
    priority: "HIGH",
    productName: "Cloro Shock",
    quantity: 2,
    unit: "KG",
    message: `Pedir reposicao ${batteryRunId}`,
    poolId: ctx.pool.id,
    clientId: ctx.client.id,
    technicianId: ctx.technician.id,
    vehicleId: ctx.vehicle?.id || null,
  });
  check("aviso de stock do tecnico cria lembrete e notificacao", Boolean(stockReminder.data.notification?.id), `notificacao ${stockReminder.data.notification?.id || "-"}`);

  const chat = await api("POST", "/api/chat", {
    clientId: ctx.client.id,
    sender: "client",
    text: `Mensagem cliente bateria ${batteryRunId}`,
  });
  check("chat cliente cria mensagem por ler para admin", Boolean(chat.data.message?.id && chat.data.message?.isReadByAdmin === false), `msg ${chat.data.message?.id || "-"}`);

  const notifications = await api("GET", "/api/notifications");
  const notifText = JSON.stringify(notifications.data);
  check("notificacoes agregam chat, agua e stock", notifText.includes(batteryRunId), "eventos visiveis");

  const portalToken = await ensureClientToken(ctx.client);
  const portalResponse = await fetchImpl(`${BASE_URL}/api/client-portal/${ctx.client.id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${portalToken}`,
      "x-actor": `battery-${batteryRunId}`,
    },
  });
  const portalText = await portalResponse.text();
  let portal = { data: {} };
  try {
    portal = { data: portalText ? JSON.parse(portalText) : {} };
  } catch (_) {
    portal = { data: { raw: portalText.slice(0, 500) } };
  }
  if (!portalResponse.ok || (portal.data && portal.data.ok === false)) {
    throw new Error(`GET /api/client-portal/${ctx.client.id} -> ${portalResponse.status}: ${portal.data.error || portal.data.message || portalText.slice(0, 250)}`);
  }
  const portalPools = Array.isArray(portal.data.pools)
    ? portal.data.pools
    : Array.isArray(portal.data.client?.pools)
      ? portal.data.client.pools
      : [];
  const portalServices = Array.isArray(portal.data.serviceHistory)
    ? portal.data.serviceHistory
    : Array.isArray(portal.data.services)
      ? portal.data.services
      : Array.isArray(portal.data.history)
        ? portal.data.history
        : [];
  check("portal cliente recebe piscinas", portalPools.length >= 1, `${portalPools.length} piscina(s)`);
  check("portal cliente recebe servicos", portalServices.length >= 1, `${portalServices.length} servico(s)`);
  check("portal cliente recebe faturas", Array.isArray(portal.data.invoices) && portal.data.invoices.length >= 1, `${portal.data.invoices?.length || 0} fatura(s)`);

  const search = await api("GET", `/api/search?q=${encodeURIComponent(monthRunId)}`);
  const types = new Set((search.data.results || []).map((item) => item.type));
  check("pesquisa global encontra cliente/piscina/tecnico/guia", ["CLIENT", "POOL", "TECHNICIAN", "TRANSPORT_GUIDE"].every((type) => types.has(type)), Array.from(types).join(", "));

  const gps = await api("POST", "/api/gps/update", {
    userId: Number(process.env.TEST_GPS_USER_ID || 1),
    technicianDbId: ctx.technician.id,
    vehicleId: ctx.vehicle?.id || null,
    latitude: 37.102,
    longitude: -8.672,
    trackingMode: "FIELD_TEST",
    batteryLevel: 90,
  }, [200]);
  check("gps aceita telemetria e liga a tecnico/viatura", gps.data.ok === true || gps.data.success === true, gps.data.message || "");

  return ctx;
}

async function auditDatabase(monthRunId) {
  const poolIds = (await prisma.pool.findMany({
    where: { name: { contains: monthRunId, mode: "insensitive" } },
    select: { id: true },
  })).map((row) => row.id);
  const clientIds = (await prisma.client.findMany({
    where: { name: { contains: monthRunId, mode: "insensitive" } },
    select: { id: true },
  })).map((row) => row.id);
  const technicianIds = (await prisma.technician.findMany({
    where: { name: { contains: monthRunId, mode: "insensitive" } },
    select: { id: true },
  })).map((row) => row.id);
  const visitIds = (await prisma.serviceVisit.findMany({
    where: {
      OR: [
        { poolId: { in: poolIds } },
        { clientId: { in: clientIds } },
        { technicianId: { in: technicianIds } },
      ],
    },
    select: { id: true },
  })).map((row) => row.id);

  const counts = {
    clients: clientIds.length,
    pools: poolIds.length,
    technicians: technicianIds.length,
    visits: visitIds.length,
    technicalSheets: await prisma.technicalSheet.count({ where: { poolId: { in: poolIds } } }),
    equipment: await prisma.poolEquipment.count({ where: { poolId: { in: poolIds } } }),
    technicalRooms: await prisma.technicalRoom.count({ where: { poolId: { in: poolIds } } }),
    chemicals: await prisma.chemicalUsage.count({ where: { visitId: { in: visitIds } } }),
    repairs: await prisma.repair.count({ where: { poolId: { in: poolIds } } }),
    alerts: await prisma.technicalAlert.count({ where: { poolId: { in: poolIds } } }),
    invoices: await prisma.invoice.count({ where: { clientId: { in: clientIds } } }),
    messages: await prisma.clientMessage.count({ where: { clientId: { in: clientIds } } }),
    notifications: await prisma.notification.count({
      where: {
        OR: [
          { clientId: { in: clientIds } },
          { message: { contains: monthRunId, mode: "insensitive" } },
          { message: { contains: batteryRunId, mode: "insensitive" } },
        ],
      },
    }),
  };

  const issues = [];
  if (counts.clients < 5) issues.push("clientes insuficientes");
  if (counts.pools < 9) issues.push("piscinas/jacuzzis insuficientes");
  if (counts.technicalSheets !== counts.pools) issues.push("piscinas sem ficha tecnica completa");
  if (counts.equipment !== counts.pools) issues.push("piscinas sem equipamento");
  if (counts.technicalRooms !== counts.pools) issues.push("piscinas sem casa tecnica");
  if (counts.visits < 50) issues.push("visitas insuficientes");
  if (counts.chemicals < 50) issues.push("consumos quimicos insuficientes");
  if (counts.repairs < 2 || counts.alerts < 2) issues.push("alertas/reparacoes insuficientes");
  if (counts.invoices < counts.clients) issues.push("faturacao incompleta");
  if (counts.messages < counts.clients) issues.push("mensagens incompletas");

  check("auditoria final nao encontrou dados soltos", issues.length === 0, issues.join("; ") || "sem falhas");
  return { counts, issues };
}

async function main() {
  console.log(`Cristal Water - bateria real de interligacoes (${batteryRunId})`);
  console.log(`Servidor: ${BASE_URL}`);
  await api("GET", "/api/system/health");
  const monthRunId = await runMonthlyFlow();
  await extraCommunicationChecks(monthRunId);
  const audit = await auditDatabase(monthRunId);

  const failed = checks.filter((item) => !item.ok);
  const report = {
    batteryRunId,
    monthRunId,
    baseUrl: BASE_URL,
    createdAt: new Date().toISOString(),
    status: failed.length ? "FAILED" : "PASSED",
    checks,
    audit,
  };
  const file = path.join(reportDir, `system-interconnections-${batteryRunId}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`Relatorio: ${file}`);

  if (failed.length) {
    failed.forEach((item) => console.error(`FAIL ${item.name}: ${item.detail}`));
    process.exit(1);
  }
}

main()
  .catch((error) => {
    const file = path.join(reportDir, `system-interconnections-${batteryRunId}-FAILED.json`);
    fs.writeFileSync(file, JSON.stringify({
      batteryRunId,
      status: "ERROR",
      error: error.stack || error.message,
      checks,
    }, null, 2));
    console.error(error.stack || error.message);
    console.error(`Relatorio: ${file}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
