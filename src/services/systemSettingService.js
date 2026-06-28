const { prisma } = require('../prismaClient');

const DEFAULT_SETTINGS = {
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
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  if (setting) return setting.value;
  if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return DEFAULT_SETTINGS[key];
  return fallback;
}

async function getBooleanSetting(key, fallback = false) {
  return normalizeBool(await getSetting(key, fallback ? 'true' : 'false'), fallback);
}

async function setSetting(key, value, notes = null) {
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
  return { defaults: DEFAULT_SETTINGS, rows, map };
}

module.exports = { DEFAULT_SETTINGS, getSetting, getBooleanSetting, setSetting, getAllSettings };
