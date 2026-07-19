require("../src/loadEnv")();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const prismaModule = require("../src/prismaClient");
const prisma = prismaModule.prisma || prismaModule;
const {
  createDatabaseBackup,
  disconnectDatabaseBackupService,
} = require("../src/services/databaseBackupService");
const {
  canonicalAdminEmail,
  configuredAdminEmails,
} = require("../src/utils/adminIdentity");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const execute = args.has("--execute");
const REAL_CONFIRM_FLAG = "REAL_FUNCTIONAL_RESET_CONFIRMED";
const REAL_CONFIRM_VALUE = "true";
const RESET_CONFIRM_FLAG = "RESET_CONFIRMATION";
const RESET_CONFIRM_VALUE = "DELETE_ALL_BUSINESS_DATA_KEEP_ADMIN_20260719";

if (!dryRun && !execute) {
  console.error("Usa --dry-run ou --execute.");
  process.exit(1);
}

if (execute) {
  if (process.env[REAL_CONFIRM_FLAG] !== REAL_CONFIRM_VALUE || process.env[RESET_CONFIRM_FLAG] !== RESET_CONFIRM_VALUE) {
    console.error(`Execução real bloqueada. Define ${REAL_CONFIRM_FLAG}=${REAL_CONFIRM_VALUE} e ${RESET_CONFIRM_FLAG}=${RESET_CONFIRM_VALUE}.`);
    process.exit(1);
  }
}

const ROOT_TABLES = [
  "Client",
  "Pool",
  "Technician",
  "Round",
  "ServiceVisit",
  "Visit",
  "Invoice",
  "InventoryProduct",
  "StockPurchase",
  "Vehicle",
  "SupplierAccount",
  "TransportGuide",
  "WorkGuide",
];

const CANDIDATE_TABLES = [
  { table: "Client", mode: "all", label: "clientes" },
  { table: "ClientAccess", any: ["clientId"], label: "contactos/acessos do cliente" },
  { table: "ClientMessage", any: ["clientId"], label: "conversas de clientes" },
  { table: "ClientReportSetting", any: ["clientId"], label: "configurações de relatórios de cliente" },
  { table: "Pool", mode: "all", label: "piscinas" },
  { table: "PoolCalculationProfile", any: ["poolId"], label: "perfis de cálculo da piscina" },
  { table: "PoolEquipment", any: ["poolId"], label: "equipamentos associados à piscina" },
  { table: "PoolMessage", any: ["poolId", "clientId"], label: "mensagens de piscina" },
  { table: "TechnicalRoom", any: ["poolId"], label: "fichas de casa das máquinas" },
  { table: "TechnicalSheet", any: ["poolId"], label: "fichas técnicas da piscina" },
  { table: "Technician", mode: "all", label: "técnicos" },
  { table: "TechnicianLocation", any: ["technicianId", "userId"], label: "localizações de técnicos" },
  { table: "TechnicianTrack", any: ["technicianId", "userId"], label: "tracks de técnicos" },
  { table: "TechnicianWorkDay", any: ["userId"], label: "jornadas de técnicos" },
  { table: "TechnicianVehicleLog", any: ["technicianId", "vehicleId"], label: "logs técnico-viatura" },
  { table: "ExtraVisit", any: ["poolId", "clientId"], label: "agendamentos/visitas extra" },
  { table: "ExtraVisitRule", any: ["poolId"], label: "regras de visitas extra" },
  { table: "Round", mode: "all", label: "rondas" },
  { table: "RoundPool", any: ["roundId", "poolId"], label: "ordenação de rondas/piscinas" },
  { table: "RoundTechnician", any: ["roundId"], label: "relações ronda-técnico" },
  { table: "ServiceVisit", mode: "all", label: "service visits" },
  { table: "Visit", mode: "all", label: "legacy visits" },
  { table: "VisitPhoto", any: ["visitId"], label: "fotografias de visitas" },
  { table: "ChemicalUsage", any: ["visitId"], label: "produtos usados em visitas" },
  { table: "Attachment", any: ["clientId", "poolId", "serviceVisitId", "invoiceId", "alertId", "repairId"], label: "anexos ligados ao domínio cliente/piscina" },
  { table: "TechnicalHistory", any: ["poolId"], label: "históricos técnicos" },
  { table: "TechnicalAlert", any: ["poolId"], label: "alertas ligados a piscinas" },
  { table: "Notification", any: ["clientId"], label: "notificações operacionais" },
  { table: "OperationalReminder", any: ["clientId", "poolId"], label: "pedidos/lembretes operacionais" },
  { table: "Task", any: ["clientId", "poolId", "serviceId"], label: "tarefas operacionais" },
  { table: "MonthlyReport", any: ["clientId"], label: "relatórios mensais de cliente" },
  { table: "CommunicationLog", any: ["clientId", "invoiceId"], label: "logs de comunicação ligados a clientes/faturação" },
  { table: "ChatMessage", any: ["clientId"], label: "conversas/chat" },
  { table: "DeviceToken", mode: "all", label: "tokens de dispositivos" },
  { table: "LocationLog", mode: "all", label: "logs de localização" },
  { table: "UserAuditLog", mode: "all", label: "auditoria de utilizadores" },
  { table: "AuditTrail", mode: "all", label: "trilha de auditoria" },
  { table: "Invoice", any: ["clientId"], label: "faturas" },
  { table: "InvoiceLine", any: ["invoiceId"], label: "linhas de fatura" },
  { table: "Payment", any: ["invoiceId"], label: "pagamentos" },
  { table: "Repair", any: ["poolId"], label: "pedidos/orçamentos/reparações" },
  { table: "KeyAccess", mode: "all", label: "chaves atribuídas" },
  { table: "RefreshToken", any: ["clientId"], label: "refresh tokens de cliente" },
  { table: "Service", any: ["poolId"], label: "serviços ligados a piscinas" },
  { table: "ServiceMessage", any: ["serviceId"], label: "mensagens de serviço" },
  { table: "VisitLog", any: ["visitId"], label: "logs de visita legacy" },
  { table: "VisitStateLog", any: ["visitId"], label: "histórico de estados de visita" },
  { table: "InventoryProduct", mode: "all", label: "produtos" },
  { table: "StockPurchase", mode: "all", label: "compras de stock" },
  { table: "StockPurchaseItem", mode: "all", label: "itens de compras de stock" },
  { table: "StockBalance", mode: "all", label: "saldos de stock" },
  { table: "StockMovement", mode: "all", label: "movimentos de stock" },
  { table: "SupplierAccount", mode: "all", label: "fornecedores" },
  { table: "SupplierQuickLink", mode: "all", label: "links de fornecedor" },
  { table: "Vehicle", mode: "all", label: "viaturas" },
  { table: "VehicleMaintenanceRecord", mode: "all", label: "manutenção de viaturas" },
  { table: "VehicleStockMovement", mode: "all", label: "movimentos de stock de viatura" },
  { table: "VehicleStockAudit", mode: "all", label: "auditorias de stock em viatura" },
  { table: "VehicleStockAuditItem", mode: "all", label: "itens de auditoria de stock em viatura" },
  { table: "VehicleAccessibilityRule", mode: "all", label: "regras de acessibilidade de viaturas" },
  { table: "TransportGuide", mode: "all", label: "guias de transporte" },
  { table: "TransportGuideItem", mode: "all", label: "itens de guias de transporte" },
  { table: "WorkGuide", mode: "all", label: "guias de trabalho" },
  { table: "WorkGuideItem", mode: "all", label: "itens de guias de trabalho" },
  { table: "EmergencyConsumptionBatch", mode: "all", label: "lotes de consumo de emergência" },
  { table: "EmergencyConsumptionItem", mode: "all", label: "itens de consumo de emergência" },
  { table: "OperationalLock", mode: "all", label: "bloqueios operacionais" },
  { table: "Incident", mode: "all", label: "incidentes" },
  { table: "Appointment", mode: "all", label: "agendamentos" },
  { table: "GeneralReminder", mode: "all", label: "lembretes gerais" },
  { table: "Lead", mode: "all", label: "leads comerciais" },
  { table: "LeadActivity", mode: "all", label: "atividades de lead" },
  { table: "ClientProfitSnapshot", mode: "all", label: "snapshots de rentabilidade" },
  { table: "Alert", mode: "all", label: "alertas gerais" },
  { table: "CompanyClosure", mode: "all", label: "fechos operacionais" },
  { table: "UserNotificationSetting", mode: "all", label: "preferências de notificação de utilizador" },
  { table: "AiConversation", mode: "all", label: "conversas AI" },
  { table: "AiMessage", mode: "all", label: "mensagens AI" },
  { table: "AiAction", mode: "all", label: "ações AI" },
  { table: "AiRecommendation", mode: "all", label: "recomendações AI" },
  { table: "AiOpsConversation", mode: "all", label: "conversas AI Ops" },
  { table: "AiOpsMessage", mode: "all", label: "mensagens AI Ops" },
  { table: "AiOpsAction", mode: "all", label: "ações AI Ops" },
  { table: "AiAssistantThread", mode: "all", label: "threads AI assistant" },
  { table: "AiAssistantMessage", mode: "all", label: "mensagens AI assistant" },
  { table: "AiAssistantAction", mode: "all", label: "ações AI assistant" },
  { table: "EmailLog", mode: "all", label: "logs de email" },
  { table: "_KeyAccessToPool", mode: "all", label: "relação chave-piscina" },
];

const DELETE_ORDER = [
  "TransportGuideItem",
  "WorkGuideItem",
  "VehicleStockAuditItem",
  "EmergencyConsumptionItem",
  "StockPurchaseItem",
  "_KeyAccessToPool",
  "VisitPhoto",
  "ChemicalUsage",
  "ServiceMessage",
  "VisitLog",
  "VisitStateLog",
  "Attachment",
  "DeviceToken",
  "Notification",
  "Alert",
  "OperationalReminder",
  "ClientMessage",
  "ChatMessage",
  "ClientAccess",
  "ClientReportSetting",
  "PoolMessage",
  "CommunicationLog",
  "MonthlyReport",
  "Task",
  "UserNotificationSetting",
  "LocationLog",
  "UserAuditLog",
  "AuditTrail",
  "TechnicalHistory",
  "TechnicalAlert",
  "InvoiceLine",
  "Payment",
  "RefreshToken",
  "Repair",
  "ExtraVisit",
  "ExtraVisitRule",
  "VehicleStockMovement",
  "VehicleMaintenanceRecord",
  "StockMovement",
  "StockBalance",
  "SupplierQuickLink",
  "LeadActivity",
  "GeneralReminder",
  "Appointment",
  "Incident",
  "ClientProfitSnapshot",
  "EmergencyConsumptionBatch",
  "VehicleStockAudit",
  "RoundPool",
  "RoundTechnician",
  "TechnicianVehicleLog",
  "TechnicianTrack",
  "TechnicianLocation",
  "TechnicianWorkDay",
  "AiAction",
  "AiMessage",
  "AiRecommendation",
  "AiConversation",
  "AiOpsAction",
  "AiOpsMessage",
  "AiOpsConversation",
  "AiAssistantAction",
  "AiAssistantMessage",
  "AiAssistantThread",
  "EmailLog",
  "ServiceVisit",
  "Visit",
  "Service",
  "Invoice",
  "WorkGuide",
  "TransportGuide",
  "StockPurchase",
  "PoolEquipment",
  "PoolCalculationProfile",
  "TechnicalRoom",
  "TechnicalSheet",
  "KeyAccess",
  "CompanyClosure",
  "VehicleAccessibilityRule",
  "OperationalLock",
  "Round",
  "Pool",
  "Client",
  "Lead",
  "InventoryProduct",
  "SupplierAccount",
  "Technician",
  "Vehicle",
  "User",
];

const PRESERVED_TECHNICAL_TABLES = [
  { table: "SystemSetting", label: "configurações essenciais do sistema", sampleFields: ["id", "key", "updatedAt"] },
  { table: "NotificationRule", label: "regras técnicas de notificação", sampleFields: ["id", "eventType", "active", "updatedAt"] },
  { table: "Zone", label: "zonas base", sampleFields: ["id", "name", "updatedAt"] },
  { table: "SeasonalRule", label: "regras sazonais base", sampleFields: ["id", "name", "season", "active"] },
];

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function qualifiedTable(table) {
  return `public.${quoteIdent(table)}`;
}

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    table
  );
  return rows.length > 0;
}

async function getTableColumns(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    table
  );
  return rows.map((row) => row.column_name);
}

async function countAll(table) {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM ${qualifiedTable(table)}`);
  return Number(rows[0]?.count || 0);
}

async function countScoped(table, columns) {
  const available = await getTableColumns(table);
  const usable = columns.filter((column) => available.includes(column));
  if (!usable.length) {
    return { count: await countAll(table), scope: "table-total-no-scoped-column" };
  }

  const where = usable.map((column) => `${quoteIdent(column)} IS NOT NULL`).join(" OR ");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM ${qualifiedTable(table)} WHERE ${where}`
  );
  return { count: Number(rows[0]?.count || 0), scope: `scoped:${usable.join(",")}` };
}

async function listForeignKeys() {
  return prisma.$queryRawUnsafe(`
    SELECT
      tc.table_name AS child_table,
      kcu.column_name AS child_column,
      ccu.table_name AS parent_table,
      ccu.column_name AS parent_column,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY ccu.table_name, tc.table_name, kcu.column_name
  `);
}

function closureFromRoots(fks, roots) {
  const seen = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fk of fks) {
      if (seen.has(fk.parent_table) && !seen.has(fk.child_table)) {
        seen.add(fk.child_table);
        changed = true;
      }
    }
  }
  return [...seen].sort();
}

async function sampleRows(table, fields, limit = 10) {
  const available = await getTableColumns(table);
  const selected = fields.filter((field) => available.includes(field));
  if (!selected.length) return [];
  const sql = `SELECT ${selected.map(quoteIdent).join(", ")} FROM ${qualifiedTable(table)} ORDER BY 1 ASC LIMIT ${limit}`;
  return prisma.$queryRawUnsafe(sql);
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function buildInventoryCounts() {
  const rows = [];
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  for (const row of tables) {
    const table = row.table_name;
    rows.push({ table, count: await countAll(table) });
  }

  return rows;
}

async function getIdList(table) {
  if (!(await tableExists(table))) return [];
  const columns = await getTableColumns(table);
  if (!columns.includes("id")) return [];
  const rows = await prisma.$queryRawUnsafe(`SELECT id::int AS id FROM ${qualifiedTable(table)} ORDER BY id ASC`);
  return rows.map((row) => Number(row.id)).filter(Number.isInteger);
}

function intArray(values) {
  return [...new Set((values || []).map((value) => Number(value)).filter(Number.isInteger))];
}

function sqlIntArray(values) {
  const safe = intArray(values);
  if (!safe.length) return null;
  return `ARRAY[${safe.join(",")}]::int[]`;
}

async function deleteByColumns(tx, table, mapping) {
  if (!(await tableExists(table))) return 0;
  const available = await getTableColumns(table);
  const clauses = [];
  for (const [column, ids] of Object.entries(mapping)) {
    if (!available.includes(column)) continue;
    const arr = sqlIntArray(ids);
    if (!arr) continue;
    clauses.push(`${quoteIdent(column)} = ANY(${arr})`);
  }
  if (!clauses.length) return 0;
  return tx.$executeRawUnsafe(`DELETE FROM ${qualifiedTable(table)} WHERE ${clauses.join(" OR ")}`);
}

async function deleteAll(tx, table) {
  if (!(await tableExists(table))) return 0;
  return tx.$executeRawUnsafe(`DELETE FROM ${qualifiedTable(table)}`);
}

async function deleteUserRowsExcept(tx, table, preservedUserIds, columnName = "userId") {
  if (!(await tableExists(table))) return 0;
  const available = await getTableColumns(table);
  if (!available.includes(columnName)) return 0;
  const arr = sqlIntArray(preservedUserIds);
  if (!arr) return 0;
  return tx.$executeRawUnsafe(`DELETE FROM ${qualifiedTable(table)} WHERE NOT (${quoteIdent(columnName)} = ANY(${arr}))`);
}

async function deleteNonPreservedUsers(tx, preservedUserIds) {
  if (!(await tableExists("User"))) return 0;
  const arr = sqlIntArray(preservedUserIds);
  if (!arr) return 0;
  return tx.$executeRawUnsafe(`DELETE FROM ${qualifiedTable("User")} WHERE NOT (id = ANY(${arr}))`);
}

async function deleteNotifications(tx, context) {
  if (!(await tableExists("Notification"))) return 0;
  const clientArr = sqlIntArray(context.clientIds);
  const poolArr = sqlIntArray(context.poolIds);
  const visitArr = sqlIntArray(context.serviceVisitIds);
  const invoiceArr = sqlIntArray(context.invoiceIds);
  const repairArr = sqlIntArray(context.repairIds);
  const clauses = [];
  if (clientArr) clauses.push(`"clientId" = ANY(${clientArr})`);
  if (poolArr) clauses.push(`NULLIF(metadata->>'poolId','')::int = ANY(${poolArr})`);
  if (visitArr) clauses.push(`NULLIF(metadata->>'visitId','')::int = ANY(${visitArr})`);
  if (invoiceArr) clauses.push(`NULLIF(metadata->>'invoiceId','')::int = ANY(${invoiceArr})`);
  if (repairArr) clauses.push(`NULLIF(metadata->>'repairId','')::int = ANY(${repairArr})`);
  if (!clauses.length) return 0;
  return tx.$executeRawUnsafe(`DELETE FROM ${qualifiedTable("Notification")} WHERE ${clauses.join(" OR ")}`);
}

async function buildExecutionContext() {
  const clientIds = await getIdList("Client");
  const poolIds = await getIdList("Pool");
  const roundIds = await getIdList("Round");
  const technicianIds = await getIdList("Technician");
  const serviceVisitIds = await getIdList("ServiceVisit");
  const visitIds = await getIdList("Visit");
  const invoiceIds = await getIdList("Invoice");
  const serviceIds = await getIdList("Service");
  const repairIds = await getIdList("Repair");
  const productIds = await getIdList("InventoryProduct");
  const purchaseIds = await getIdList("StockPurchase");
  const vehicleIds = await getIdList("Vehicle");
  const supplierIds = await getIdList("SupplierAccount");
  const transportGuideIds = await getIdList("TransportGuide");
  const workGuideIds = await getIdList("WorkGuide");
  const emergencyBatchIds = await getIdList("EmergencyConsumptionBatch");
  const vehicleStockAuditIds = await getIdList("VehicleStockAudit");
  let keyAccessIds = [];
  if (await tableExists("_KeyAccessToPool")) {
    const poolArr = sqlIntArray(poolIds);
    if (poolArr) {
      const rows = await prisma.$queryRawUnsafe(`SELECT "A"::int AS id FROM public."_KeyAccessToPool" WHERE "B" = ANY(${poolArr})`);
      keyAccessIds = rows.map((row) => Number(row.id)).filter(Number.isInteger);
    }
  }
  return {
    clientIds,
    poolIds,
    roundIds,
    technicianIds,
    serviceVisitIds,
    visitIds,
    invoiceIds,
    serviceIds,
    repairIds,
    productIds,
    purchaseIds,
    vehicleIds,
    supplierIds,
    transportGuideIds,
    workGuideIds,
    emergencyBatchIds,
    vehicleStockAuditIds,
    keyAccessIds,
  };
}

async function executeCleanup(context, preservedUserIds) {
  return prisma.$transaction(async (tx) => {
    const results = [];
    const push = async (table, action) => {
      const deleted = Number(await action()) || 0;
      results.push({ table, deleted });
    };

    await push("TransportGuideItem", () => deleteAll(tx, "TransportGuideItem"));
    await push("WorkGuideItem", () => deleteAll(tx, "WorkGuideItem"));
    await push("VehicleStockAuditItem", () => deleteAll(tx, "VehicleStockAuditItem"));
    await push("EmergencyConsumptionItem", () => deleteAll(tx, "EmergencyConsumptionItem"));
    await push("StockPurchaseItem", () => deleteAll(tx, "StockPurchaseItem"));
    await push("_KeyAccessToPool", () => deleteAll(tx, "_KeyAccessToPool"));
    await push("VisitPhoto", () => deleteAll(tx, "VisitPhoto"));
    await push("ChemicalUsage", () => deleteAll(tx, "ChemicalUsage"));
    await push("ServiceMessage", () => deleteAll(tx, "ServiceMessage"));
    await push("VisitLog", () => deleteAll(tx, "VisitLog"));
    await push("VisitStateLog", () => deleteAll(tx, "VisitStateLog"));
    await push("Attachment", () => deleteAll(tx, "Attachment"));
    await push("DeviceToken", () => deleteAll(tx, "DeviceToken"));
    await push("Notification", () => deleteAll(tx, "Notification"));
    await push("Alert", () => deleteAll(tx, "Alert"));
    await push("OperationalReminder", () => deleteAll(tx, "OperationalReminder"));
    await push("ClientMessage", () => deleteAll(tx, "ClientMessage"));
    await push("ChatMessage", () => deleteAll(tx, "ChatMessage"));
    await push("ClientAccess", () => deleteAll(tx, "ClientAccess"));
    await push("ClientReportSetting", () => deleteAll(tx, "ClientReportSetting"));
    await push("PoolMessage", () => deleteAll(tx, "PoolMessage"));
    await push("CommunicationLog", () => deleteAll(tx, "CommunicationLog"));
    await push("MonthlyReport", () => deleteAll(tx, "MonthlyReport"));
    await push("Task", () => deleteAll(tx, "Task"));
    await push("UserNotificationSetting", () => deleteUserRowsExcept(tx, "UserNotificationSetting", preservedUserIds));
    await push("LocationLog", () => deleteAll(tx, "LocationLog"));
    await push("UserAuditLog", () => deleteAll(tx, "UserAuditLog"));
    await push("AuditTrail", () => deleteAll(tx, "AuditTrail"));
    await push("TechnicalHistory", () => deleteAll(tx, "TechnicalHistory"));
    await push("TechnicalAlert", () => deleteAll(tx, "TechnicalAlert"));
    await push("InvoiceLine", () => deleteAll(tx, "InvoiceLine"));
    await push("Payment", () => deleteAll(tx, "Payment"));
    await push("RefreshToken", () => deleteAll(tx, "RefreshToken"));
    await push("Repair", () => deleteAll(tx, "Repair"));
    await push("ExtraVisit", () => deleteAll(tx, "ExtraVisit"));
    await push("ExtraVisitRule", () => deleteAll(tx, "ExtraVisitRule"));
    await push("VehicleStockMovement", () => deleteAll(tx, "VehicleStockMovement"));
    await push("VehicleMaintenanceRecord", () => deleteAll(tx, "VehicleMaintenanceRecord"));
    await push("StockMovement", () => deleteAll(tx, "StockMovement"));
    await push("StockBalance", () => deleteAll(tx, "StockBalance"));
    await push("SupplierQuickLink", () => deleteAll(tx, "SupplierQuickLink"));
    await push("LeadActivity", () => deleteAll(tx, "LeadActivity"));
    await push("GeneralReminder", () => deleteAll(tx, "GeneralReminder"));
    await push("Appointment", () => deleteAll(tx, "Appointment"));
    await push("Incident", () => deleteAll(tx, "Incident"));
    await push("ClientProfitSnapshot", () => deleteAll(tx, "ClientProfitSnapshot"));
    await push("EmergencyConsumptionBatch", () => deleteAll(tx, "EmergencyConsumptionBatch"));
    await push("VehicleStockAudit", () => deleteAll(tx, "VehicleStockAudit"));
    await push("RoundPool", () => deleteAll(tx, "RoundPool"));
    await push("RoundTechnician", () => deleteAll(tx, "RoundTechnician"));
    await push("TechnicianVehicleLog", () => deleteAll(tx, "TechnicianVehicleLog"));
    await push("TechnicianTrack", () => deleteAll(tx, "TechnicianTrack"));
    await push("TechnicianLocation", () => deleteAll(tx, "TechnicianLocation"));
    await push("TechnicianWorkDay", () => deleteAll(tx, "TechnicianWorkDay"));
    await push("AiAction", () => deleteAll(tx, "AiAction"));
    await push("AiMessage", () => deleteAll(tx, "AiMessage"));
    await push("AiRecommendation", () => deleteAll(tx, "AiRecommendation"));
    await push("AiConversation", () => deleteAll(tx, "AiConversation"));
    await push("AiOpsAction", () => deleteAll(tx, "AiOpsAction"));
    await push("AiOpsMessage", () => deleteAll(tx, "AiOpsMessage"));
    await push("AiOpsConversation", () => deleteAll(tx, "AiOpsConversation"));
    await push("AiAssistantAction", () => deleteAll(tx, "AiAssistantAction"));
    await push("AiAssistantMessage", () => deleteAll(tx, "AiAssistantMessage"));
    await push("AiAssistantThread", () => deleteAll(tx, "AiAssistantThread"));
    await push("EmailLog", () => deleteAll(tx, "EmailLog"));
    await push("ServiceVisit", () => deleteAll(tx, "ServiceVisit"));
    await push("Visit", () => deleteAll(tx, "Visit"));
    await push("Service", () => deleteAll(tx, "Service"));
    await push("Invoice", () => deleteAll(tx, "Invoice"));
    await push("WorkGuide", () => deleteAll(tx, "WorkGuide"));
    await push("TransportGuide", () => deleteAll(tx, "TransportGuide"));
    await push("StockPurchase", () => deleteAll(tx, "StockPurchase"));
    await push("PoolEquipment", () => deleteAll(tx, "PoolEquipment"));
    await push("PoolCalculationProfile", () => deleteAll(tx, "PoolCalculationProfile"));
    await push("TechnicalRoom", () => deleteAll(tx, "TechnicalRoom"));
    await push("TechnicalSheet", () => deleteAll(tx, "TechnicalSheet"));
    await push("KeyAccess", () => deleteAll(tx, "KeyAccess"));
    await push("CompanyClosure", () => deleteAll(tx, "CompanyClosure"));
    await push("VehicleAccessibilityRule", () => deleteAll(tx, "VehicleAccessibilityRule"));
    await push("OperationalLock", () => deleteAll(tx, "OperationalLock"));
    await push("Round", () => deleteAll(tx, "Round"));
    await push("Pool", () => deleteAll(tx, "Pool"));
    await push("Client", () => deleteAll(tx, "Client"));
    await push("Lead", () => deleteAll(tx, "Lead"));
    await push("InventoryProduct", () => deleteAll(tx, "InventoryProduct"));
    await push("SupplierAccount", () => deleteAll(tx, "SupplierAccount"));
    await push("Technician", () => deleteAll(tx, "Technician"));
    await push("Vehicle", () => deleteAll(tx, "Vehicle"));
    await push("User", () => deleteNonPreservedUsers(tx, preservedUserIds));

    return results;
  }, {
    maxWait: 10000,
    timeout: 120000,
  });
}

async function main() {
  const backupResult = await createDatabaseBackup();
  const checksum = sha256File(backupResult.backup.file);
  const inventory = await buildInventoryCounts();
  const fks = await listForeignKeys();
  const closure = closureFromRoots(fks, ROOT_TABLES);
  const executionContext = await buildExecutionContext();

  const adminEmails = configuredAdminEmails();
  const canonicalEmail = canonicalAdminEmail();
  const preservedAdmins = adminEmails.length
    ? await prisma.user.findMany({
        where: {
          email: { in: adminEmails },
        },
        select: { id: true, email: true, role: true, active: true, name: true },
      })
    : [];

  const canonicalAdmin = canonicalEmail
    ? await prisma.user.findFirst({
        where: { email: canonicalEmail },
        select: { id: true, email: true, role: true, active: true, name: true },
      })
    : null;

  if (!canonicalAdmin) {
    throw new Error(`Administrador canónico não encontrado: ${canonicalEmail || "(email vazio)"}`);
  }

  if (!canonicalAdmin.active) {
    throw new Error(`Administrador canónico está inativo: ${canonicalAdmin.email}`);
  }

  const preservedUserIds = [canonicalAdmin.id];

  const preservedTechnicalResources = [];
  for (const item of PRESERVED_TECHNICAL_TABLES) {
    if (!(await tableExists(item.table))) continue;
    preservedTechnicalResources.push({
      table: item.table,
      label: item.label,
      count: await countAll(item.table),
      sample: await sampleRows(item.table, item.sampleFields, 10),
    });
  }

  const affectedTables = [];
  for (const item of CANDIDATE_TABLES) {
    if (!(await tableExists(item.table))) continue;
    const result = item.mode === "all"
      ? { count: await countAll(item.table), scope: "all-rows" }
      : await countScoped(item.table, item.any || []);
    affectedTables.push({
      table: item.table,
      label: item.label,
      count: result.count,
      scope: result.scope,
      inDependencyClosure: closure.includes(item.table),
    });
  }

  for (const table of closure) {
    if (affectedTables.some((item) => item.table === table)) continue;
    if (!(await tableExists(table))) continue;
    affectedTables.push({
      table,
      label: `dependência adicional descoberta por FK (${table})`,
      count: await countAll(table),
      scope: "all-rows",
      inDependencyClosure: true,
    });
  }

  affectedTables.sort((a, b) => a.table.localeCompare(b.table));

  const dependencyRows = fks.filter((row) => closure.includes(row.parent_table) || closure.includes(row.child_table));
  const estimatedTotalRecords = affectedTables.reduce((sum, item) => sum + Number(item.count || 0), 0);

  let executionPreview = null;
  let executionResult = null;
  if (execute) {
    executionPreview = {
      requested: true,
      envConfirmed: true,
      transactionStrategy: "single prisma.$transaction with ordered delete steps where possible",
      command: `${REAL_CONFIRM_FLAG}=${REAL_CONFIRM_VALUE} ${RESET_CONFIRM_FLAG}=${RESET_CONFIRM_VALUE} node scripts/cleanup-client-pool-domain.js --execute`,
      note: "Prepared but not executed in this session unless user explicitly runs the command.",
    };
    executionResult = await executeCleanup(executionContext, preservedUserIds);
  }

  const report = {
    ok: true,
    dryRun,
    execute,
    createdAt: new Date().toISOString(),
    backup: {
      ...backupResult.backup,
      fallback: backupResult.fallback,
      sha256: checksum,
      verifiedExists: fs.existsSync(backupResult.backup.file),
    },
    preserve: {
      canonicalAdminEmail: canonicalEmail || null,
      configuredAdminEmails: adminEmails,
      canonicalAdministrator: canonicalAdmin,
      preservedUserIds,
      administrators: preservedAdmins,
      preservedTechnicalResources,
    },
    inventory,
    rootsForCleanup: ROOT_TABLES,
    affectedTables,
    deleteOrder: DELETE_ORDER,
    estimatedTotalRecords,
    dependencyClosure: closure,
    dependenciesFound: dependencyRows,
    executionContext,
    executionPreview,
    executionResult,
    safety: {
      realDeletionExecuted: false,
      requiredEnv: {
        [REAL_CONFIRM_FLAG]: REAL_CONFIRM_VALUE,
        [RESET_CONFIRM_FLAG]: RESET_CONFIRM_VALUE,
      },
      message: dryRun ? "Dry-run only. Nenhum delete executado." : "Modo real preparado mas não executado nesta sessão.",
    },
  };

  if (execute) {
    report.safety.realDeletionExecuted = true;
    report.safety.message = "Execução real efetuada com guardas de confirmação e transação.";
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, dryRun, error: error.message }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
    await disconnectDatabaseBackupService().catch(() => null);
  });