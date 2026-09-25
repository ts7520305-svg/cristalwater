const { prisma } = require('../prismaClient');
// These capabilities are mandatory in this release; stored legacy switches do
// not disable device storage, installation or the human approval workflow.
const FIXED_SETTINGS = { MOBILE_PWA_ENABLED: 'true', OFFLINE_SYNC_ENABLED: 'true', AI_ADMIN_REQUIRE_APPROVAL: 'true' };
function validateSetting(key) {
  if (Object.prototype.hasOwnProperty.call(FIXED_SETTINGS, key)) throw Object.assign(new Error('Esta capacidade está sempre ativa nesta versão e não pode ser desligada.'), { status: 409 });
  if (String(key).startsWith('CLIENT_REPORT_LANGUAGE:')) throw Object.assign(new Error('Altere o idioma nas configurações do relatório do cliente, com revisão da versão atual.'), { status: 409 });
}

const DEFAULT_SETTINGS = {
  AUTO_MONTHLY_BILLING_ENABLED: 'false',
  PAYMENT_REMINDERS_ENABLED: 'false',
  TECHNICIANS_CAN_CREATE_CLIENTS_POOLS: 'false',
  TECHNICIAN_CREATED_RECORDS_REQUIRE_ADMIN_REVIEW: 'true',
  TECHNICIAN_CREATED_POOLS_ACTIVE_BY_DEFAULT: 'false',
  MOBILE_PWA_ENABLED: 'true',
  OFFLINE_SYNC_ENABLED: 'true',
  AI_ADMIN_REQUIRE_APPROVAL: process.env.AI_ADMIN_REQUIRE_APPROVAL || 'true',
};

function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}

async function getSetting(key, fallback = undefined) {
  if (Object.prototype.hasOwnProperty.call(FIXED_SETTINGS, key)) return FIXED_SETTINGS[key];
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  if (setting) return setting.value;
  if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return DEFAULT_SETTINGS[key];
  return fallback;
}

async function getBooleanSetting(key, fallback = false) {
  return normalizeBool(await getSetting(key, fallback ? 'true' : 'false'), fallback);
}

async function setSetting(key, value, notes = null) {
  validateSetting(key);
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value), notes },
    create: { key, value: String(value), notes },
  });
}

async function getAllSettings() {
  const rows = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  const map = { ...DEFAULT_SETTINGS };
  rows.forEach((row) => { map[row.key] = row.value; });
  Object.assign(map, FIXED_SETTINGS);
  return { defaults: DEFAULT_SETTINGS, rows, map, fixed: FIXED_SETTINGS };
}

module.exports = { normalizeBool, DEFAULT_SETTINGS, FIXED_SETTINGS, validateSetting, getSetting, getBooleanSetting, setSetting, getAllSettings };
