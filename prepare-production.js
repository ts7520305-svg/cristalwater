require("./src/loadEnv")();

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");
const prismaModule = require("./src/prismaClient");

const prisma = prismaModule.prisma || prismaModule.default || prismaModule;
const reportsDir = path.resolve(__dirname, "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const ADMIN_EMAIL = "cristal.water@sapo.pt";
const CONFIRM_TEXT = "DELETE TEST DATA";
const SECOND_CONFIRM_PROMPT = "TYPE: DELETE TEST DATA";
const MODE_PROMPT = "Type EXECUTE to run cleanup, or press Enter for DRY RUN";
const DRY_RUN_MODE = "DRY RUN";
const EXECUTE_MODE = "EXECUTE";
const DRY_RUN_REPORT_FILE = path.join(reportsDir, "PRODUCTION_DRY_RUN_REPORT.md");
const EXECUTION_REPORT_FILE = path.join(reportsDir, "PRODUCTION_CLEAN_EXECUTION_REPORT.md");

const STRONG_RULES = {
  domains: [
    "@example.com",
    "@cliente.test",
    "@cristalwater.test",
    "@stress.cristalwater.local",
  ],
  contains: [
    "customer-os-",
    "fin-ops-",
    "fin-acc-",
    "real-mes-",
    "fatura mensal do teste final final2y_",
    "criado por teste integral stress_",
    "cliente criado pelo teste real mensal real-mes-",
    "equipamento real qa real-mes-",
    "visita real mensal real-mes-",
    "servico concluido no teste real mensal real-mes-",
    "problema real qa real-mes-",
    "edge ph invalido real-mes-",
    "smoke customer message",
    "smoke visit request",
    "admin fin-ops-",
    "admin fin-acc-",
    "cw-stress-client-",
  ],
  startsWith: [
    "cw-stress-client-",
    "qa-",
    "stress_",
    "real-mes-",
    "at-qa-",
  ],
  exact: [
    "qa-admin",
    "qa-tech",
    "qa-client",
    "qa-lead",
    "qa-repair",
    "qa-core-flow",
  ],
};

const WEAK_REVIEW_MARKERS = ["test", "demo", "qa", "fake", "stress", "wow", "lorem"];

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function uniqueNumbers(values) {
  return [...new Set((values || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function hasDelegate(name) {
  return Boolean(prisma?.[name]);
}

async function findMany(delegate, args) {
  if (!hasDelegate(delegate) || !prisma[delegate]?.findMany) return [];
  return prisma[delegate].findMany(args);
}

async function deleteMany(delegate, where) {
  if (!hasDelegate(delegate) || !prisma[delegate]?.deleteMany) return { count: 0 };
  return prisma[delegate].deleteMany({ where });
}

function exactStrongMatch(value) {
  const normalized = lower(value);
  if (!normalized) return null;
  const domain = STRONG_RULES.domains.find((item) => normalized.endsWith(item));
  if (domain) return `domain:${domain}`;
  const prefix = STRONG_RULES.startsWith.find((item) => normalized.startsWith(item));
  if (prefix) return `prefix:${prefix}`;
  const snippet = STRONG_RULES.contains.find((item) => normalized.includes(item));
  if (snippet) return `contains:${snippet}`;
  if (STRONG_RULES.exact.includes(normalized)) return `exact:${normalized}`;
  return null;
}

function weakReviewMatch(value) {
  const normalized = lower(value);
  if (!normalized) return null;
  const marker = WEAK_REVIEW_MARKERS.find((item) => normalized.includes(item));
  return marker ? `weak:${marker}` : null;
}

function objectStrongMatch(value) {
  if (value == null) return null;
  if (typeof value === "string") return exactStrongMatch(value);
  try {
    return exactStrongMatch(JSON.stringify(value));
  } catch {
    return null;
  }
}

function objectWeakMatch(value) {
  if (value == null) return null;
  if (typeof value === "string") return weakReviewMatch(value);
  try {
    return weakReviewMatch(JSON.stringify(value));
  } catch {
    return null;
  }
}

function collectEvidence(values) {
  const strong = [];
  const weak = [];
  for (const value of values || []) {
    const strongHit = typeof value === "object" && value !== null ? objectStrongMatch(value) : exactStrongMatch(value);
    if (strongHit) strong.push(`${strongHit}:${text(typeof value === "object" ? JSON.stringify(value) : value).slice(0, 120)}`);
    const weakHit = typeof value === "object" && value !== null ? objectWeakMatch(value) : weakReviewMatch(value);
    if (weakHit) weak.push(`${weakHit}:${text(typeof value === "object" ? JSON.stringify(value) : value).slice(0, 120)}`);
  }
  return { strong: [...new Set(strong)], weak: [...new Set(weak)] };
}

function createReviewCollector() {
  return {
    automatic: {
      userIds: new Set(),
      clientIds: new Set(),
      poolIds: new Set(),
      serviceVisitIds: new Set(),
      visitIds: new Set(),
      repairIds: new Set(),
      invoiceIds: new Set(),
      notificationIds: new Set(),
      technicianIds: new Set(),
      vehicleIds: new Set(),
      roundIds: new Set(),
      transportGuideIds: new Set(),
      workGuideIds: new Set(),
      operationalLockIds: new Set(),
    },
    manual: {
      users: [],
      clients: [],
      pools: [],
      technicians: [],
      vehicles: [],
      rounds: [],
      transportGuides: [],
      workGuides: [],
      visits: [],
      repairs: [],
      invoices: [],
      notifications: [],
      operationalLocks: [],
    },
  };
}

function pushManual(bucket, row, evidence) {
  bucket.push({ id: row.id, evidence: evidence.weak.length ? evidence.weak : evidence.strong });
}

function finalizeReview(collector) {
  return {
    automatic: Object.fromEntries(Object.entries(collector.automatic).map(([key, value]) => [key, uniqueNumbers([...value])])),
    manual: collector.manual,
  };
}

async function collectReview() {
  const collector = createReviewCollector();

  const users = await findMany("user", { select: { id: true, email: true, name: true, role: true } });
  for (const user of users) {
    if (lower(user.email) === ADMIN_EMAIL) continue;
    const evidence = collectEvidence([user.email, user.name, user.role]);
    if (evidence.strong.length) collector.automatic.userIds.add(user.id);
    else if (evidence.weak.length) pushManual(collector.manual.users, user, evidence);
  }

  const clients = await findMany("client", {
    select: { id: true, name: true, internalName: true, email: true, address: true, notes: true, fiscalEmail: true, source: true },
  });
  for (const client of clients) {
    const evidence = collectEvidence([client.name, client.internalName, client.email, client.address, client.notes, client.fiscalEmail, client.source]);
    if (evidence.strong.length) collector.automatic.clientIds.add(client.id);
    else if (evidence.weak.length) pushManual(collector.manual.clients, client, evidence);
  }

  const pools = await findMany("pool", {
    select: { id: true, clientId: true, name: true, location: true, address: true, notes: true, source: true },
  });
  for (const pool of pools) {
    const evidence = collectEvidence([pool.name, pool.location, pool.address, pool.notes, pool.source]);
    if (collector.automatic.clientIds.has(pool.clientId) || evidence.strong.length) collector.automatic.poolIds.add(pool.id);
    else if (evidence.weak.length) pushManual(collector.manual.pools, pool, evidence);
  }

  const technicians = await findMany("technician", { select: { id: true, name: true, email: true, zone: true } });
  for (const technician of technicians) {
    const evidence = collectEvidence([technician.name, technician.email, technician.zone]);
    if (evidence.strong.length) collector.automatic.technicianIds.add(technician.id);
    else if (evidence.weak.length) pushManual(collector.manual.technicians, technician, evidence);
  }

  const vehicles = await findMany("vehicle", { select: { id: true, plate: true, name: true, notes: true } });
  for (const vehicle of vehicles) {
    const evidence = collectEvidence([vehicle.plate, vehicle.name, vehicle.notes]);
    if (evidence.strong.length) collector.automatic.vehicleIds.add(vehicle.id);
    else if (evidence.weak.length) pushManual(collector.manual.vehicles, vehicle, evidence);
  }

  const rounds = await findMany("round", { select: { id: true, name: true } });
  for (const round of rounds) {
    const evidence = collectEvidence([round.name]);
    if (evidence.strong.length) collector.automatic.roundIds.add(round.id);
    else if (evidence.weak.length) pushManual(collector.manual.rounds, round, evidence);
  }

  const serviceVisits = await findMany("serviceVisit", {
    select: { id: true, clientId: true, poolId: true, technicianId: true, roundId: true, technicianName: true, reason: true, notes: true, internalNotes: true, alerts: true, products: true },
  });
  for (const visit of serviceVisits) {
    const evidence = collectEvidence([visit.technicianName, visit.reason, visit.notes, visit.internalNotes, visit.alerts, visit.products]);
    if (collector.automatic.clientIds.has(visit.clientId) || collector.automatic.poolIds.has(visit.poolId) || evidence.strong.length) {
      collector.automatic.serviceVisitIds.add(visit.id);
    } else if (evidence.weak.length) {
      pushManual(collector.manual.visits, visit, evidence);
    }
  }

  const visits = await findMany("visit", { select: { id: true, clientId: true, poolId: true, technicianId: true, notes: true, status: true } });
  for (const visit of visits) {
    const evidence = collectEvidence([visit.notes, visit.status]);
    if (collector.automatic.clientIds.has(visit.clientId) || collector.automatic.poolIds.has(visit.poolId) || evidence.strong.length) {
      collector.automatic.visitIds.add(visit.id);
    } else if (evidence.weak.length) {
      pushManual(collector.manual.visits, visit, evidence);
    }
  }

  const repairs = await findMany("repair", { select: { id: true, poolId: true, problem: true, notes: true, status: true } });
  for (const repair of repairs) {
    const evidence = collectEvidence([repair.problem, repair.notes, repair.status]);
    if (collector.automatic.poolIds.has(repair.poolId) || evidence.strong.length) {
      collector.automatic.repairIds.add(repair.id);
    } else if (evidence.weak.length) {
      pushManual(collector.manual.repairs, repair, evidence);
    }
  }

  const invoices = await findMany("invoice", {
    select: { id: true, clientId: true, monthRef: true, month: true, notes: true, externalInvoiceNo: true, invoiceNumber: true },
  });
  for (const invoice of invoices) {
    const evidence = collectEvidence([invoice.monthRef, invoice.month, invoice.notes, invoice.externalInvoiceNo, invoice.invoiceNumber]);
    if (collector.automatic.clientIds.has(invoice.clientId) || evidence.strong.length) {
      collector.automatic.invoiceIds.add(invoice.id);
    } else if (evidence.weak.length) {
      pushManual(collector.manual.invoices, invoice, evidence);
    }
  }

  const notifications = await findMany("notification", {
    select: { id: true, userId: true, clientId: true, type: true, eventType: true, title: true, message: true, role: true, status: true, severity: true, metadata: true },
  });
  for (const notification of notifications) {
    const evidence = collectEvidence([notification.type, notification.eventType, notification.title, notification.message, notification.role, notification.status, notification.severity, notification.metadata]);
    if (collector.automatic.userIds.has(notification.userId) || collector.automatic.clientIds.has(notification.clientId) || evidence.strong.length) {
      collector.automatic.notificationIds.add(notification.id);
    } else if (evidence.weak.length) {
      pushManual(collector.manual.notifications, notification, evidence);
    }
  }

  const transportGuides = await findMany("transportGuide", { select: { id: true, vehicleId: true, codeAT: true, origin: true, destination: true, notes: true } });
  for (const guide of transportGuides) {
    const evidence = collectEvidence([guide.codeAT, guide.origin, guide.destination, guide.notes]);
    if (collector.automatic.vehicleIds.has(guide.vehicleId) || evidence.strong.length) collector.automatic.transportGuideIds.add(guide.id);
    else if (evidence.weak.length) pushManual(collector.manual.transportGuides, guide, evidence);
  }

  const workGuides = await findMany("workGuide", { select: { id: true, guideId: true, vehicleId: true, technicianId: true, notes: true } });
  for (const guide of workGuides) {
    const evidence = collectEvidence([guide.notes]);
    if (collector.automatic.transportGuideIds.has(guide.guideId) || collector.automatic.vehicleIds.has(guide.vehicleId) || collector.automatic.technicianIds.has(guide.technicianId) || evidence.strong.length) {
      collector.automatic.workGuideIds.add(guide.id);
    } else if (evidence.weak.length) {
      pushManual(collector.manual.workGuides, guide, evidence);
    }
  }

  const operationalLocks = await findMany("operationalLock", {
    select: { id: true, lockType: true, entity: true, entityId: true, clientId: true, poolId: true, visitId: true, technicianId: true, vehicleId: true, title: true, message: true, payload: true, requestedBy: true },
  });
  for (const lock of operationalLocks) {
    const evidence = collectEvidence([lock.lockType, lock.entity, lock.title, lock.message, lock.payload, lock.requestedBy]);
    const linkedAuto = collector.automatic.clientIds.has(lock.clientId) || collector.automatic.poolIds.has(lock.poolId) || collector.automatic.serviceVisitIds.has(lock.visitId) || collector.automatic.technicianIds.has(lock.technicianId) || collector.automatic.vehicleIds.has(lock.vehicleId);
    if (linkedAuto || evidence.strong.length) {
      collector.automatic.operationalLockIds.add(lock.id);
    } else if (evidence.weak.length || ["installation", "constructionproject"].includes(lower(lock.entity))) {
      pushManual(collector.manual.operationalLocks, lock, evidence.weak.length ? evidence : { strong: [], weak: ["manual:installation_or_construction_without_strong_provenance"] });
    }
  }

  return finalizeReview(collector);
}

function countSummary(targets) {
  return {
    users: targets.userIds.length,
    clients: targets.clientIds.length,
    pools: targets.poolIds.length,
    serviceVisits: targets.serviceVisitIds.length,
    visits: targets.visitIds.length,
    repairs: targets.repairIds.length,
    invoices: targets.invoiceIds.length,
    notifications: targets.notificationIds.length,
    technicians: targets.technicianIds.length,
    vehicles: targets.vehicleIds.length,
    rounds: targets.roundIds.length,
    transportGuides: targets.transportGuideIds.length,
    workGuides: targets.workGuideIds.length,
    operationalLocks: targets.operationalLockIds.length,
  };
}

function manualSummary(manual) {
  return Object.fromEntries(Object.entries(manual).map(([key, rows]) => [key, rows.length]));
}

function buildDeletionCounts(summary) {
  return {
    customers: summary.clients,
    pools: summary.pools,
    visits: summary.visits + summary.serviceVisits,
    invoices: summary.invoices,
    repairs: summary.repairs,
    notifications: summary.notifications,
  };
}

function backupDatabase(runId) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao definido.");
  }

  let pgDumpUrl = databaseUrl;
  try {
    const parsed = new URL(databaseUrl);
    const keep = new URLSearchParams();
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      const value = parsed.searchParams.get(key);
      if (value) keep.set(key, value);
    }
    parsed.search = keep.toString();
    pgDumpUrl = parsed.toString();
  } catch {
    pgDumpUrl = databaseUrl.split("?")[0];
  }

  const file = path.join(reportsDir, `backup-before-production-clean-${runId}.sql`);
  const candidates = [process.env.PG_DUMP_PATH, "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe", "pg_dump"].filter(Boolean);
  let lastError = null;

  for (const command of candidates) {
    try {
      execFileSync(command, ["--no-owner", "--no-privileges", "--file", file, pgDumpUrl], {
        stdio: "pipe",
        windowsHide: true,
      });
      if (!fs.existsSync(file)) {
        throw new Error(`Backup nao encontrado: ${file}`);
      }
      const stats = fs.statSync(file);
      if (!stats.isFile() || stats.size <= 0) {
        throw new Error(`Backup invalido ou vazio: ${file}`);
      }
      return { ok: true, file, bytes: stats.size, command };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Falha ao criar backup completo antes da limpeza: ${lastError?.message || "pg_dump indisponivel"}`);
}

function formatEntityList(items, limit = 20) {
  if (!Array.isArray(items) || items.length === 0) return "- none";
  return items
    .slice(0, limit)
    .map((item) => `- ${JSON.stringify(item)}`)
    .join("\n");
}

function writeExecutionReport({ runId, startedAt, finishedAt, backup, deletionCounts, automaticSummary, manualReviewSummary, manualReview, deleted, preserved }) {
  const executionTimeMs = finishedAt.getTime() - startedAt.getTime();
  const warnings = [];
  if (Object.values(manualReviewSummary).some((value) => value > 0)) warnings.push("Existem entidades em manual review.");
  if (!backup?.ok) warnings.push("Backup nao confirmado.");

  const content = [
    "# PRODUCTION_CLEAN_EXECUTION_REPORT",
    "",
    `- runId: ${runId}`,
    `- startedAt: ${startedAt.toISOString()}`,
    `- finishedAt: ${finishedAt.toISOString()}`,
    `- executionTimeMs: ${executionTimeMs}`,
    `- backupFilename: ${backup?.file || "UNKNOWN"}`,
    `- backupBytes: ${backup?.bytes || 0}`,
    "",
    "## Deleted Entities",
    `- customers: ${deleted.clients || 0}`,
    `- pools: ${deleted.pools || 0}`,
    `- visits: ${(deleted.visits || 0) + (deleted.serviceVisits || 0)}`,
    `- invoices: ${deleted.invoices || 0}`,
    `- repairs: ${deleted.repairs || 0}`,
    `- notifications: ${deleted.notifications || 0}`,
    `- automaticSummary: ${JSON.stringify(automaticSummary)}`,
    "",
    "## Preserved Entities",
    `- admin: ${preserved.admin}`,
    `- countsScreen: ${JSON.stringify(deletionCounts)}`,
    "",
    "## Manual Review Entities",
    `- summary: ${JSON.stringify(manualReviewSummary)}`,
    `- users:\n${formatEntityList(manualReview.users)}`,
    `- clients:\n${formatEntityList(manualReview.clients)}`,
    `- pools:\n${formatEntityList(manualReview.pools)}`,
    `- technicians:\n${formatEntityList(manualReview.technicians)}`,
    `- vehicles:\n${formatEntityList(manualReview.vehicles)}`,
    `- rounds:\n${formatEntityList(manualReview.rounds)}`,
    `- transportGuides:\n${formatEntityList(manualReview.transportGuides)}`,
    `- workGuides:\n${formatEntityList(manualReview.workGuides)}`,
    `- visits:\n${formatEntityList(manualReview.visits)}`,
    `- repairs:\n${formatEntityList(manualReview.repairs)}`,
    `- invoices:\n${formatEntityList(manualReview.invoices)}`,
    `- notifications:\n${formatEntityList(manualReview.notifications)}`,
    `- operationalLocks:\n${formatEntityList(manualReview.operationalLocks)}`,
    "",
    "## Warnings",
    warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "- none",
    "",
  ].join("\n");

  fs.writeFileSync(EXECUTION_REPORT_FILE, content, "utf8");
  return EXECUTION_REPORT_FILE;
}

function writeDryRunReport({ runId, startedAt, finishedAt, deletionCounts, automaticSummary, manualReviewSummary, manualReview }) {
  const executionTimeMs = finishedAt.getTime() - startedAt.getTime();
  const safeToDelete = [
    `- Customers to delete: ${deletionCounts.customers}`,
    `- Pools to delete: ${deletionCounts.pools}`,
    `- Visits to delete: ${deletionCounts.visits}`,
    `- Repairs to delete: ${deletionCounts.repairs}`,
    `- Invoices to delete: ${deletionCounts.invoices}`,
    `- Notifications to delete: ${deletionCounts.notifications}`,
  ].join("\n");

  const content = [
    "# PRODUCTION_DRY_RUN_REPORT",
    "",
    `- runId: ${runId}`,
    `- startedAt: ${startedAt.toISOString()}`,
    `- finishedAt: ${finishedAt.toISOString()}`,
    `- executionTimeMs: ${executionTimeMs}`,
    `- mode: ${DRY_RUN_MODE}`,
    "",
    "## SAFE TO DELETE",
    safeToDelete,
    "",
    "## MANUAL REVIEW",
    `- summary: ${JSON.stringify(manualReviewSummary)}`,
    `- users:\n${formatEntityList(manualReview.users)}`,
    `- clients:\n${formatEntityList(manualReview.clients)}`,
    `- pools:\n${formatEntityList(manualReview.pools)}`,
    `- technicians:\n${formatEntityList(manualReview.technicians)}`,
    `- vehicles:\n${formatEntityList(manualReview.vehicles)}`,
    `- rounds:\n${formatEntityList(manualReview.rounds)}`,
    `- transportGuides:\n${formatEntityList(manualReview.transportGuides)}`,
    `- workGuides:\n${formatEntityList(manualReview.workGuides)}`,
    `- visits:\n${formatEntityList(manualReview.visits)}`,
    `- repairs:\n${formatEntityList(manualReview.repairs)}`,
    `- invoices:\n${formatEntityList(manualReview.invoices)}`,
    `- notifications:\n${formatEntityList(manualReview.notifications)}`,
    `- operationalLocks:\n${formatEntityList(manualReview.operationalLocks)}`,
    "",
    "## NEVER DELETE",
    `- admin: ${ADMIN_EMAIL}`,
    "- any entity without strong provenance",
    "- any entity flagged only by weak review markers",
    "",
    "## Notes",
    `- automaticSummary: ${JSON.stringify(automaticSummary)}`,
    "- no deletion was executed in DRY RUN mode",
    "",
  ].join("\n");

  fs.writeFileSync(DRY_RUN_REPORT_FILE, content, "utf8");
  return DRY_RUN_REPORT_FILE;
}

async function cleanup(targets) {
  const result = {};
  const userIds = targets.userIds;
  const clientIds = targets.clientIds;
  const poolIds = targets.poolIds;
  const serviceVisitIds = targets.serviceVisitIds;
  const visitIds = targets.visitIds;
  const repairIds = targets.repairIds;
  const invoiceIds = targets.invoiceIds;
  const notificationIds = targets.notificationIds;
  const technicianIds = targets.technicianIds;
  const vehicleIds = targets.vehicleIds;
  const roundIds = targets.roundIds;
  const transportGuideIds = targets.transportGuideIds;
  const workGuideIds = targets.workGuideIds;
  const operationalLockIds = targets.operationalLockIds;

  result.chatMessages = (await deleteMany("chatMessage", { OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }, { clientId: { in: clientIds } }] })).count || 0;
  result.clientMessages = (await deleteMany("clientMessage", { clientId: { in: clientIds } })).count || 0;
  result.communicationLogs = (await deleteMany("communicationLog", { clientId: { in: clientIds } })).count || 0;
  result.notifications = (await deleteMany("notification", { id: { in: notificationIds } })).count || 0;
  result.attachments = (await deleteMany("attachment", { OR: [{ clientId: { in: clientIds } }, { poolId: { in: poolIds } }, { serviceVisitId: { in: serviceVisitIds } }, { repairId: { in: repairIds } }, { invoiceId: { in: invoiceIds } }] })).count || 0;
  result.visitPhotos = (await deleteMany("visitPhoto", { visitId: { in: serviceVisitIds } })).count || 0;
  result.chemicalUsage = (await deleteMany("chemicalUsage", { visitId: { in: serviceVisitIds } })).count || 0;
  result.invoiceLines = (await deleteMany("invoiceLine", { invoiceId: { in: invoiceIds } })).count || 0;
  result.payments = (await deleteMany("payment", { invoiceId: { in: invoiceIds } })).count || 0;
  result.visitLogs = (await deleteMany("visitLog", { visitId: { in: visitIds } })).count || 0;
  result.visitStateLogs = (await deleteMany("visitStateLog", { visitId: { in: serviceVisitIds } })).count || 0;
  result.operationalReminders = (await deleteMany("operationalReminder", { OR: [{ clientId: { in: clientIds } }, { poolId: { in: poolIds } }, { assignedTechnicianId: { in: technicianIds } }] })).count || 0;
  result.tasks = (await deleteMany("task", { OR: [{ clientId: { in: clientIds } }, { poolId: { in: poolIds } }, { technicianId: { in: technicianIds } }] })).count || 0;
  result.monthlyReports = (await deleteMany("monthlyReport", { clientId: { in: clientIds } })).count || 0;
  result.technicalHistory = (await deleteMany("technicalHistory", { poolId: { in: poolIds } })).count || 0;
  result.technicalAlerts = (await deleteMany("technicalAlert", { poolId: { in: poolIds } })).count || 0;
  result.auditTrail = (await deleteMany("auditTrail", { OR: [{ userId: { in: userIds } }, { technicianId: { in: technicianIds } }, { clientId: { in: clientIds } }, { poolId: { in: poolIds } }, { visitId: { in: serviceVisitIds } }, { vehicleId: { in: vehicleIds } }] })).count || 0;
  result.operationalLocks = (await deleteMany("operationalLock", { id: { in: operationalLockIds } })).count || 0;
  result.workGuideItems = (await deleteMany("workGuideItem", { workGuideId: { in: workGuideIds } })).count || 0;
  result.transportGuideItems = (await deleteMany("transportGuideItem", { guideId: { in: transportGuideIds } })).count || 0;
  result.workGuides = (await deleteMany("workGuide", { id: { in: workGuideIds } })).count || 0;
  result.transportGuides = (await deleteMany("transportGuide", { id: { in: transportGuideIds } })).count || 0;
  result.technicianVehicleLogs = (await deleteMany("technicianVehicleLog", { OR: [{ technicianId: { in: technicianIds } }, { vehicleId: { in: vehicleIds } }] })).count || 0;
  result.roundPools = (await deleteMany("roundPool", { OR: [{ roundId: { in: roundIds } }, { poolId: { in: poolIds } }] })).count || 0;
  result.roundTechnicians = (await deleteMany("roundTechnician", { roundId: { in: roundIds } })).count || 0;
  result.locationLogs = (await deleteMany("locationLog", { userId: { in: userIds } })).count || 0;
  result.technicianLocations = (await deleteMany("technicianLocation", { OR: [{ userId: { in: userIds } }, { technicianId: { in: technicianIds } }] })).count || 0;
  result.technicianTracks = (await deleteMany("technicianTrack", { OR: [{ userId: { in: userIds } }, { technicianId: { in: technicianIds } }] })).count || 0;
  result.technicianWorkDays = (await deleteMany("technicianWorkDay", { userId: { in: userIds } })).count || 0;
  result.refreshTokens = (await deleteMany("refreshToken", { clientId: { in: clientIds } })).count || 0;
  result.poolMessages = (await deleteMany("poolMessage", { poolId: { in: poolIds } })).count || 0;
  result.extraVisits = (await deleteMany("extraVisit", { OR: [{ clientId: { in: clientIds } }, { poolId: { in: poolIds } }, { technicianId: { in: technicianIds } }, { userId: { in: userIds } }] })).count || 0;
  result.services = (await deleteMany("service", { OR: [{ poolId: { in: poolIds } }, { technicianId: { in: technicianIds } }] })).count || 0;
  result.serviceVisits = (await deleteMany("serviceVisit", { id: { in: serviceVisitIds } })).count || 0;
  result.visits = (await deleteMany("visit", { id: { in: visitIds } })).count || 0;
  result.repairs = (await deleteMany("repair", { id: { in: repairIds } })).count || 0;
  result.invoices = (await deleteMany("invoice", { id: { in: invoiceIds } })).count || 0;
  result.pools = (await deleteMany("pool", { id: { in: poolIds } })).count || 0;
  result.rounds = (await deleteMany("round", { id: { in: roundIds } })).count || 0;
  result.vehicles = (await deleteMany("vehicle", { id: { in: vehicleIds } })).count || 0;
  result.technicians = (await deleteMany("technician", { id: { in: technicianIds } })).count || 0;
  result.clients = (await deleteMany("client", { id: { in: clientIds } })).count || 0;
  result.users = (await deleteMany("user", { id: { in: userIds }, NOT: { email: ADMIN_EMAIL } })).count || 0;
  return result;
}

async function ensureAdminStillExists() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error(`Administrador obrigatório ausente: ${ADMIN_EMAIL}`);
  return admin;
}

async function main() {
  await ensureAdminStillExists();

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const startedAt = new Date();
  const runId = `PRODUCTION_CLEAN_${startedAt.getTime()}`;
  try {
    const review = await collectReview();
    const automaticSummary = countSummary(review.automatic);
    const manualReviewSummary = manualSummary(review.manual);
    const finishedAt = new Date();
    const deletionCounts = buildDeletionCounts(automaticSummary);

    console.log(`Mode: ${DRY_RUN_MODE}`);
    console.log(MODE_PROMPT);
    const modeChoice = text(await rl.question("> ")).toUpperCase();

    console.log(`Customers to delete: ${deletionCounts.customers}`);
    console.log(`Pools to delete: ${deletionCounts.pools}`);
    console.log(`Visits to delete: ${deletionCounts.visits}`);
    console.log(`Repairs to delete: ${deletionCounts.repairs}`);
    console.log(`Invoices to delete: ${deletionCounts.invoices}`);
    console.log(`Notifications to delete: ${deletionCounts.notifications}`);
    console.log("SAFE TO DELETE");
    console.log(JSON.stringify(deletionCounts, null, 2));
    console.log("MANUAL REVIEW");
    console.log(JSON.stringify(manualReviewSummary, null, 2));
    console.log("NEVER DELETE");
    console.log(JSON.stringify({ admin: ADMIN_EMAIL }, null, 2));

    const dryRunReportFile = writeDryRunReport({
      runId,
      startedAt,
      finishedAt,
      deletionCounts,
      automaticSummary,
      manualReviewSummary,
      manualReview: review.manual,
    });

    if (modeChoice !== EXECUTE_MODE) {
      console.log(`Dry run complete. Report: ${dryRunReportFile}`);
      return;
    }

    console.log("ARE YOU SURE?");
    console.log(`Type: ${CONFIRM_TEXT}`);
    const answer = text(await rl.question("> "));
    if (answer !== CONFIRM_TEXT) {
      console.log(`Aborted. No data was deleted. Report: ${dryRunReportFile}`);
      return;
    }

    const backup = backupDatabase(runId);

    console.log(`Backup created: ${backup.file}`);
    console.log(`Backup verified: ${backup.bytes} bytes`);
    console.log("Deletion counts:");
    console.log(JSON.stringify(deletionCounts, null, 2));
    console.log("Manual review required:");
    console.log(JSON.stringify(manualReviewSummary, null, 2));

    console.log(SECOND_CONFIRM_PROMPT);
    const secondAnswer = text(await rl.question("> "));
    if (secondAnswer !== CONFIRM_TEXT) {
      const reportFile = writeExecutionReport({
        runId,
        startedAt,
        finishedAt: new Date(),
        backup,
        deletionCounts,
        automaticSummary,
        manualReviewSummary,
        manualReview: review.manual,
        deleted: { clients: 0, pools: 0, serviceVisits: 0, visits: 0, repairs: 0, invoices: 0, notifications: 0 },
        preserved: { admin: ADMIN_EMAIL },
      });
      console.log(`Aborted. No data was deleted. Report: ${reportFile}`);
      return;
    }

    const result = await cleanup(review.automatic);
    await ensureAdminStillExists();

    const executionFinishedAt = new Date();
    const reportFile = writeExecutionReport({
      runId,
      startedAt,
      finishedAt: executionFinishedAt,
      backup,
      deletionCounts,
      automaticSummary,
      manualReviewSummary,
      manualReview: review.manual,
      deleted: result,
      preserved: { admin: ADMIN_EMAIL },
    });

    console.log("Cleanup complete.");
    console.log(JSON.stringify({ automaticSummary, manualReviewSummary, deleted: result, keptAdmin: ADMIN_EMAIL, reportFile }, null, 2));
  } finally {
    rl.close();
    await prisma.$disconnect().catch(() => null);
  }
}

main().catch(async (error) => {
  console.error(`prepare-production failed: ${error.message}`);
  await prisma.$disconnect().catch(() => null);
  process.exit(1);
});