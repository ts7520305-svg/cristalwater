const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const { DEFAULT_SETTINGS } = require("../src/services/systemSettingService");
const {
  DEFAULT_PERMISSION_POLICY,
  DEFAULT_TEAM_HIERARCHY,
} = require("../src/services/accessControlPolicyService");

const DEFAULT_BOOTSTRAP_CATEGORIES = ["CHEMICAL", "EQUIPMENT", "ACCESSORY"];

const DEFAULT_CLOSURE_TEMPLATES = [
  {
    id: "NATAL",
    title: "Encerramento de Natal",
    messageTitle: "🎄 Aviso de encerramento de Natal",
    messageBody:
      "Informamos que a Cristal Water estará encerrada para férias de Natal entre {startDate} e {endDate}. Em caso urgente, contacte o número habitual. A equipa Cristal Water deseja-lhe um Feliz Natal e um excelente Ano Novo.",
  },
  {
    id: "FERIAS_VERAO",
    title: "Férias de verão",
    messageTitle: "☀️ Aviso de férias da equipa Cristal Water",
    messageBody:
      "Informamos que estaremos encerrados para férias entre {startDate} e {endDate}. Serviços críticos previamente acordados serão mantidos.",
  },
  {
    id: "FERIADO",
    title: "Feriado / encerramento pontual",
    messageTitle: "Aviso de encerramento temporário",
    messageBody:
      "A Cristal Water estará encerrada em {startDate}. Em caso urgente, contacte o número habitual.",
  },
];

const DEFAULT_INVENTORY_PRODUCTS = [
  { name: "Cloro Líquido", sku: "CHEM-CL-001", category: "CHEMICAL", unit: "L", defaultCost: 12.5, minStockCentral: 50, minStockVehicle: 10, notes: "Bootstrap catalog" },
  { name: "Cloro Granulado", sku: "CHEM-CL-002", category: "CHEMICAL", unit: "KG", defaultCost: 18, minStockCentral: 40, minStockVehicle: 8, notes: "Bootstrap catalog" },
  { name: "pH Minus", sku: "CHEM-PH-001", category: "CHEMICAL", unit: "KG", defaultCost: 9.75, minStockCentral: 30, minStockVehicle: 6, notes: "Bootstrap catalog" },
  { name: "pH Plus", sku: "CHEM-PH-002", category: "CHEMICAL", unit: "KG", defaultCost: 10.25, minStockCentral: 30, minStockVehicle: 6, notes: "Bootstrap catalog" },
  { name: "Algicida", sku: "CHEM-ALG-001", category: "CHEMICAL", unit: "L", defaultCost: 14.2, minStockCentral: 20, minStockVehicle: 4, notes: "Bootstrap catalog" },
  { name: "Floculante", sku: "CHEM-FLO-001", category: "CHEMICAL", unit: "L", defaultCost: 13.1, minStockCentral: 20, minStockVehicle: 4, notes: "Bootstrap catalog" },
  { name: "Areia de Filtro", sku: "EQP-FLT-001", category: "EQUIPMENT", unit: "KG", defaultCost: 6.3, minStockCentral: 80, minStockVehicle: 0, notes: "Bootstrap catalog" },
  { name: "Cesto Skimmer", sku: "EQP-SKM-001", category: "EQUIPMENT", unit: "UN", defaultCost: 8.4, minStockCentral: 25, minStockVehicle: 5, notes: "Bootstrap catalog" },
  { name: "Escova de Piscina", sku: "ACC-BRS-001", category: "ACCESSORY", unit: "UN", defaultCost: 7.9, minStockCentral: 25, minStockVehicle: 5, notes: "Bootstrap catalog" },
  { name: "Mangueira de Aspiração", sku: "ACC-HOSE-001", category: "ACCESSORY", unit: "UN", defaultCost: 24.5, minStockCentral: 15, minStockVehicle: 3, notes: "Bootstrap catalog" },
];

const DEFAULT_NOTIFICATION_RULES = [
  { eventType: "MONTHLY_REPORT", roles: "ADMIN,CLIENT", channels: "EMAIL,INTERNAL", active: true, defaultEmail: true, defaultWhatsapp: false, defaultInternal: true },
  { eventType: "STOCK_CRITICAL_FAIL", roles: "ADMIN,TEAM_LEADER,TECHNICIAN", channels: "INTERNAL,EMAIL", active: true, defaultEmail: true, defaultWhatsapp: false, defaultInternal: true },
  { eventType: "STOCK_AUDIT", roles: "ADMIN", channels: "INTERNAL", active: true, defaultEmail: false, defaultWhatsapp: false, defaultInternal: true },
  { eventType: "OPERATIONAL_FLOW", roles: "ADMIN,TEAM_LEADER", channels: "INTERNAL,EMAIL", active: true, defaultEmail: true, defaultWhatsapp: false, defaultInternal: true },
  { eventType: "FIELD_PROBLEM_REPORTED", roles: "ADMIN,TEAM_LEADER,TECHNICIAN", channels: "INTERNAL,EMAIL", active: true, defaultEmail: true, defaultWhatsapp: false, defaultInternal: true },
  { eventType: "SYNC", roles: "ADMIN", channels: "INTERNAL", active: true, defaultEmail: false, defaultWhatsapp: false, defaultInternal: true },
  { eventType: "REPAIR_EVENT", roles: "ADMIN,TEAM_LEADER,TECHNICIAN", channels: "INTERNAL,EMAIL", active: true, defaultEmail: true, defaultWhatsapp: false, defaultInternal: true },
];

const DEFAULT_SEASONAL_RULES = [
  { name: "Verão padrão", season: "VERAO", monthStart: 6, monthEnd: 8, minVisitsPerWeek: 2, idealVisitsPerWeek: 2, filtrationMultiplier: 1.25, chemicalMultiplier: 1.15, saltProductionMultiplier: 1.1, monthlyFeeMultiplier: 1.05, appliesTo: "ALL", notes: "Bootstrap baseline" },
  { name: "Outono padrão", season: "OUTONO", monthStart: 9, monthEnd: 11, minVisitsPerWeek: 1, idealVisitsPerWeek: 1, filtrationMultiplier: 1, chemicalMultiplier: 1, saltProductionMultiplier: 1, monthlyFeeMultiplier: 1, appliesTo: "ALL", notes: "Bootstrap baseline" },
  { name: "Inverno padrão", season: "INVERNO", monthStart: 12, monthEnd: 2, minVisitsPerWeek: 1, idealVisitsPerWeek: 1, filtrationMultiplier: 0.9, chemicalMultiplier: 0.9, saltProductionMultiplier: 0.9, monthlyFeeMultiplier: 0.95, appliesTo: "ALL", notes: "Bootstrap baseline" },
  { name: "Primavera padrão", season: "PRIMAVERA", monthStart: 3, monthEnd: 5, minVisitsPerWeek: 1, idealVisitsPerWeek: 1, filtrationMultiplier: 1, chemicalMultiplier: 1, saltProductionMultiplier: 1, monthlyFeeMultiplier: 1, appliesTo: "ALL", notes: "Bootstrap baseline" },
];

const DEFAULT_VEHICLE_ACCESS_RULES = [
  { accessibilityType: "LIGEIRO", maxVehicleType: "LIGEIRO", notes: "Bootstrap baseline" },
  { accessibilityType: "MISTO", maxVehicleType: "MISTO", notes: "Bootstrap baseline" },
  { accessibilityType: "PESADO", maxVehicleType: "PESADO", notes: "Bootstrap baseline" },
];

function text(value) {
  return String(value || "").trim();
}

async function upsertSetting(key, value, notes = null) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value), notes },
    create: { key, value: String(value), notes },
  });
}

async function upsertNotificationRule(rule) {
  const existing = await prisma.notificationRule.findFirst({ where: { eventType: rule.eventType } });
  if (existing) {
    return prisma.notificationRule.update({ where: { id: existing.id }, data: rule });
  }
  return prisma.notificationRule.create({ data: rule });
}

async function upsertSeasonalRule(rule) {
  const existing = await prisma.seasonalRule.findFirst({ where: { name: rule.name } });
  if (existing) {
    return prisma.seasonalRule.update({ where: { id: existing.id }, data: rule });
  }
  return prisma.seasonalRule.create({ data: rule });
}

async function upsertVehicleAccessibilityRule(rule) {
  const existing = await prisma.vehicleAccessibilityRule.findFirst({
    where: {
      accessibilityType: rule.accessibilityType,
      poolId: null,
      clientId: null,
    },
  });
  if (existing) {
    return prisma.vehicleAccessibilityRule.update({ where: { id: existing.id }, data: rule });
  }
  return prisma.vehicleAccessibilityRule.create({ data: rule });
}

async function upsertInventoryProduct(product) {
  const cleanName = text(product.name);
  const cleanSku = text(product.sku);
  if (!cleanName) return null;

  if (cleanSku) {
    const existing = await prisma.inventoryProduct.findUnique({ where: { sku: cleanSku } }).catch(() => null);
    if (existing) {
      return prisma.inventoryProduct.update({ where: { id: existing.id }, data: product });
    }
    return prisma.inventoryProduct.create({ data: product });
  }

  const existing = await prisma.inventoryProduct.findFirst({
    where: { name: cleanName, unit: text(product.unit) || "KG" },
  });
  if (existing) {
    return prisma.inventoryProduct.update({ where: { id: existing.id }, data: product });
  }
  return prisma.inventoryProduct.create({ data: product });
}

async function main() {
  const enableDemoSeed = String(process.env.ENABLE_DEMO_SEED || "false").toLowerCase() === "true";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@cristalwater.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const password = await bcrypt.hash(String(adminPassword), 12);
  const adminName = process.env.ADMIN_NAME || "Administrador";

  const summary = {
    admin: false,
    settings: 0,
    permissions: 0,
    templates: 0,
    products: 0,
    notificationRules: 0,
    seasonalRules: 0,
    vehicleAccessibilityRules: 0,
  };

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, password, role: "ADMIN", active: true, mustChangePassword: false, passwordChangedAt: new Date() },
    create: {
      email: adminEmail,
      password,
      role: "ADMIN",
      name: adminName,
      active: true,
      mustChangePassword: false,
    },
  }).catch(() => null);
  summary.admin = Boolean(admin?.id);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await upsertSetting(key, value, "Bootstrap default setting");
    summary.settings += 1;
  }

  await upsertSetting("ACCESS_PERMISSION_POLICY", JSON.stringify(DEFAULT_PERMISSION_POLICY), "Bootstrap permission policy");
  await upsertSetting("TEAM_LEADER_HIERARCHY", JSON.stringify(DEFAULT_TEAM_HIERARCHY), "Bootstrap team hierarchy");
  await upsertSetting("BOOTSTRAP_CATEGORIES", JSON.stringify(DEFAULT_BOOTSTRAP_CATEGORIES), "Bootstrap category catalog");
  await upsertSetting("BOOTSTRAP_TEMPLATES", JSON.stringify(DEFAULT_CLOSURE_TEMPLATES), "Bootstrap template catalog");
  summary.permissions += 1;
  summary.templates += 1;

  for (const rule of DEFAULT_NOTIFICATION_RULES) {
    await upsertNotificationRule(rule);
    summary.notificationRules += 1;
  }

  for (const rule of DEFAULT_SEASONAL_RULES) {
    await upsertSeasonalRule(rule);
    summary.seasonalRules += 1;
  }

  for (const rule of DEFAULT_VEHICLE_ACCESS_RULES) {
    await upsertVehicleAccessibilityRule(rule);
    summary.vehicleAccessibilityRules += 1;
  }

  for (const product of DEFAULT_INVENTORY_PRODUCTS) {
    await upsertInventoryProduct(product);
    summary.products += 1;
  }

  if (!enableDemoSeed) {
    console.log(JSON.stringify({ ok: true, mode: "production-bootstrap", summary }, null, 2));
    return;
  }

  console.log("ENABLE_DEMO_SEED=true ativo: podes adaptar este ficheiro para criar dados de teste temporários.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
