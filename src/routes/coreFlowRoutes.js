const ReminderListBusiness = require('../business/admin/ReminderListBusiness');
const ReminderCompletionBusiness = require('../business/admin/ReminderCompletionBusiness');
const ReminderCreationBusiness = require('../business/admin/ReminderCreationBusiness');
const ReminderDeletionBusiness = require('../business/admin/ReminderDeletionBusiness');
const invoiceGenerationController = require('../controllers/invoiceGenerationController');
const {checkDatabaseHealth}=require('../services/databaseHealthService');
const express = require('express');
const bcrypt = require('bcryptjs');
const prismaModule = require('../prismaClient');
const auth = require('../middlewares/authMiddleware');
const { completeServiceVisit, VisitCompletionError } = require('../services/serviceVisitCompletionService');
const CoreInvoicePaymentBusiness = require('../business/finance/CoreInvoicePaymentBusiness');
const finance = require('../business/finance/FinanceOsBusiness');
const { assertPoolReadyForRound } = require('../utils/poolReadiness');
const { roleMatches, normalizeRole } = require('../utils/roles');
const RepairBusiness = require('../business/repair/RepairBusiness');
const BrainKnowledge = require('../system/knowledge/BrainKnowledge');

const prisma = prismaModule.prisma || prismaModule.default || prismaModule;
const router = express.Router();

const adminAuth = auth('ADMIN');
const technicianAuth = auth('TECHNICIAN');
router.use((req, res, next) => {
  // Only the minimal health endpoint is public; dashboards contain operational data.
  if (req.method === 'GET' && req.path === '/health') return next();
  // Technician field mode depends on these two core routes.
  if (req.method === 'POST' && /^\/visits\/\d+\/(problem|complete)$/.test(req.path)) {
    return technicianAuth(req, res, next);
  }
  // Sprint 4.1: technicians can submit/read technical sheet change proposals.
  if (/^\/pools\/\d+\/technical-change-proposals(?:\/.*)?$/.test(req.path)) {
    return technicianAuth(req, res, next);
  }
  return adminAuth(req, res, next);
});

// Simulação desativada em produção: todas as ações core usam dados reais via Prisma.

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toFloat(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalFloat(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calculatedPoolVolumeM3(body = {}) {
  const lengthM = optionalFloat(body.lengthM);
  const widthM = optionalFloat(body.widthM);
  const diameterM = optionalFloat(body.diameterM);
  const depthMinM = optionalFloat(body.depthMinM);
  const depthMaxM = optionalFloat(body.depthMaxM);
  const explicitAverage = optionalFloat(body.averageDepthM);
  const averageDepthM = explicitAverage || (depthMinM > 0 && depthMaxM > 0 ? (depthMinM + depthMaxM) / 2 : null);
  const shapeFactor = optionalFloat(body.shapeFactor) || 1;
  let volume = null;

  if (lengthM > 0 && widthM > 0 && averageDepthM > 0) {
    volume = lengthM * widthM * averageDepthM * shapeFactor;
  } else if (diameterM > 0 && averageDepthM > 0) {
    const radius = diameterM / 2;
    volume = Math.PI * radius * radius * averageDepthM * shapeFactor;
  } else {
    const fallbackVolume = optionalFloat(body.volumeM3);
    if (fallbackVolume > 0) volume = fallbackVolume;
  }

  return volume > 0 ? Math.round(volume * 10) / 10 : null;
}

function safeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthRef(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function available(modelName) {
  return Boolean(prisma && prisma[modelName]);
}

function db(modelName) {
  if (!available(modelName)) {
    throw new Error(`Modelo Prisma indisponível: ${modelName}`);
  }
  return prisma[modelName];
}

async function safe(label, fallback, fn) {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[CORE_FLOW_SAFE_FALLBACK] ${label}: ${error.message}`);
    return fallback;
  }
}



function definedOnly(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function truthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}


let PRISMA_MODEL_FIELDS_CACHE = null;
function lowerFirst(value) { return value ? value.charAt(0).toLowerCase() + value.slice(1) : value; }
function prismaModelFields(modelName) {
  if (!PRISMA_MODEL_FIELDS_CACHE) {
    PRISMA_MODEL_FIELDS_CACHE = {};
    try {
      const { Prisma } = require('@prisma/client');
      const models = Prisma?.dmmf?.datamodel?.models || [];
      for (const model of models) {
        const delegate = lowerFirst(model.name);
        PRISMA_MODEL_FIELDS_CACHE[delegate] = new Set(
          (model.fields || [])
            .filter((field) => field.kind === 'scalar' || field.kind === 'enum')
            .map((field) => field.name)
        );
      }
    } catch (error) {
      console.warn('[CORE_FLOW_SCHEMA_FIELDS_UNAVAILABLE]', error.message);
    }
  }
  return PRISMA_MODEL_FIELDS_CACHE[modelName] || null;
}
function dataFor(modelName, data) {
  const fields = prismaModelFields(modelName);
  const clean = definedOnly(data || {});
  if (!fields) return clean;
  const out = {};
  for (const [key, value] of Object.entries(clean)) {
    if (fields.has(key)) out[key] = value;
  }
  return out;
}
function parseDayRange(dayValue) {
  const raw = String(dayValue || '').trim();
  const base = raw ? new Date(`${raw.slice(0, 10)}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    const end = new Date(fallback);
    end.setDate(end.getDate() + 1);
    return { day: fallback.toISOString().slice(0, 10), start: fallback, end };
  }
  base.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setDate(end.getDate() + 1);
  return { day: base.toISOString().slice(0, 10), start: base, end };
}
function sameDayWhere(fieldNames, start, end) {
  return {
    OR: fieldNames.map((field) => ({
      [field]: { gte: start, lt: end },
    })),
  };
}
function byId(items) {
  const map = new Map();
  for (const item of items || []) {
    if (item?.id != null) map.set(Number(item.id), item);
  }
  return map;
}
function byKey(items, key) {
  const map = new Map();
  for (const item of items || []) {
    const value = item?.[key];
    if (value == null) continue;
    const id = Number(value);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(item);
  }
  return map;
}
function isPrismaUnknownFieldError(error) {
  const msg = String(error?.message || '');
  return msg.includes('Unknown argument') || msg.includes('Unknown field') || msg.includes('Invalid `');
}
function clientBaseData(body) {
  return dataFor('client', {
    name: body.name == null ? undefined : String(body.name).trim(),
    internalName: body.internalName || null,
    phone: body.phone || null,
    email: body.email || null,
    address: body.address || null,
    zone: body.zone || null,
    notes: body.notes || null,
    monthlyFee: body.monthlyFee == null ? undefined : toFloat(body.monthlyFee, 0),
    monthlyAmount: body.monthlyFee == null ? undefined : toFloat(body.monthlyFee, 0),
    requiresInvoice: body.requiresInvoice == null ? undefined : truthy(body.requiresInvoice),
    contractActive: false,
    billingActive: false,
    archiveStatus: body.archiveStatus || 'ATIVO',
    deletedAt: body.deletedAt === undefined ? null : body.deletedAt,
    fiscalName: body.fiscalName || null,
    fiscalNif: body.fiscalNif || body.nif || null,
    fiscalAddress: body.fiscalAddress || null,
    fiscalEmail: body.fiscalEmail || body.email || null,
    externalBillingNotes: body.externalBillingNotes || null,
    status: body.status || 'SETUP',
    active: body.active == null ? true : truthy(body.active),
    paymentStatus: body.paymentStatus || 'BILLING_DISABLED',
  });
}

async function clientMutationData(body) {
  const data = clientBaseData(body);
  if (Object.prototype.hasOwnProperty.call(body || {}, 'password')) {
    const password = String(body.password || '').trim();
    if (password) data.password = await bcrypt.hash(password, 12);
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'pin')) {
    const pin = String(body.pin || '').trim();
    if (pin) data.pin = await bcrypt.hash(pin, 12);
  }
  return data;
}

async function recordTechnicalSheetHistory(poolId, before, after, actor = 'SYSTEM') {
  if (!available('technicalHistory')) return null;
  const snapshot = {
    actor,
    changedAt: new Date().toISOString(),
    before: before || null,
    after: after || null
  };
  return db('technicalHistory').create({
    data: {
      poolId,
      type: 'TECHNICAL_SHEET_CHANGE',
      component: 'Ficha Técnica',
      message: 'Alteração imutável da ficha técnica',
      description: JSON.stringify(snapshot),
      performedAt: new Date(),
      status: 'DONE'
    }
  }).catch(() => null);
}

function listTechnicalChangedFields(before = null, after = null) {
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  const changed = [];
  for (const key of keys) {
    if (['updatedAt', 'createdAt'].includes(key)) continue;
    const left = JSON.stringify(before?.[key] ?? null);
    const right = JSON.stringify(after?.[key] ?? null);
    if (left !== right) changed.push(key);
  }
  return changed;
}

const TechnicalProposals = require('../business/pool/TechnicalProposalBusiness');
const { TECHNICAL_PROPOSAL_TYPE, TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE, TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE } = require('../business/pool/TechnicalProposalContract');

function poolBaseData(body, clientId = undefined, options = {}) {
  const forCreate = Boolean(options.forCreate);
  const has = (key) => Object.prototype.hasOwnProperty.call(body || {}, key);
  return dataFor('pool', {
    clientId,
    name: body.name == null ? undefined : String(body.name).trim(),
    type: body.type == null ? (forCreate ? 'POOL' : undefined) : body.type,
    zone: has('zone') ? (body.zone || null) : undefined,
    location: has('location') ? (body.location || null) : undefined,
    address: has('address') ? (body.address || null) : undefined,
    serialNumber: has('serialNumber') ? (body.serialNumber ? String(body.serialNumber).trim() : null) : undefined,
    volumeM3: body.volumeM3 === undefined ? undefined : (body.volumeM3 === null || body.volumeM3 === '' ? null : toFloat(body.volumeM3, null)),
    notes: has('notes') ? (body.notes || null) : undefined,
    monthlyAmount: body.monthlyAmount == null ? undefined : toFloat(body.monthlyAmount, 0),
    serviceFrequency: body.serviceFrequency == null ? undefined : (toInt(body.serviceFrequency, 1) || 1),
    estimatedMinutes: body.estimatedMinutes == null ? undefined : (toInt(body.estimatedMinutes, 30) || 30),
    scheduleMode: body.scheduleMode == null ? (forCreate ? 'PENDING_ROUND' : undefined) : body.scheduleMode,
    active: body.active == null ? (forCreate ? true : undefined) : truthy(body.active),
    archiveStatus: body.archiveStatus == null ? (forCreate ? 'ATIVO' : undefined) : body.archiveStatus,
    deletedAt: body.deletedAt === undefined ? (forCreate ? null : undefined) : body.deletedAt,
  });
}
function technicianBaseData(body) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body || {}, key);
  return dataFor('technician', {
    name: body.name == null ? undefined : String(body.name).trim(),
    email: body.email || null,
    phone: body.phone || null,
    pin: has('pin') ? (body.pin || null) : undefined,
    zone: body.zone || null,
    vehicleId: body.vehicleId == null ? undefined : toInt(body.vehicleId),
    active: body.active == null ? true : truthy(body.active),
  });
}
function invoiceBaseData(data) { return dataFor('invoice', data); }
function serviceVisitBaseData(data) { return dataFor('serviceVisit', data); }
function repairBaseData(data) { return dataFor('repair', data); }
async function hasOperationalHistory(modelName, id) {
  try {
    if (modelName === 'client') {
      const [pools, visits, invoices, messages] = await Promise.all([
        safeCount('pool', { where: { clientId: id } }),
        safeCount('serviceVisit', { where: { clientId: id } }),
        safeCount('invoice', { where: { clientId: id } }),
        safeCount('clientMessage', { where: { clientId: id } }),
      ]);
      return (pools + visits + invoices + messages) > 0;
    }
    if (modelName === 'pool') {
      const [visits, alerts, repairs] = await Promise.all([
        safeCount('serviceVisit', { where: { poolId: id } }),
        safeCount('technicalAlert', { where: { poolId: id } }),
        safeCount('repair', { where: { poolId: id } }),
      ]);
      return (visits + alerts + repairs) > 0;
    }
    if (modelName === 'technician') {
      const [visits, locations] = await Promise.all([
        safeCount('serviceVisit', { where: { technicianId: id } }),
        safeCount('technicianLocation', { where: { technicianId: id } }),
      ]);
      return (visits + locations) > 0;
    }
    if (modelName === 'vehicle') {
      const [workGuides, transportGuides, logs] = await Promise.all([
        safeCount('workGuide', { where: { vehicleId: id } }),
        safeCount('transportGuide', { where: { vehicleId: id } }),
        safeCount('technicianVehicleLog', { where: { vehicleId: id } }),
      ]);
      return (workGuides + transportGuides + logs) > 0;
    }
    if (modelName === 'inventoryProduct') {
      const [purchases, balances, movements] = await Promise.all([
        safeCount('stockPurchaseItem', { where: { productId: id } }),
        safeCount('stockBalance', { where: { productId: id } }),
        safeCount('stockMovement', { where: { productId: id } }),
      ]);
      return (purchases + balances + movements) > 0;
    }
    return true;
  } catch { return true; }
}

async function safeCount(modelName, args = {}) {

  if (!available(modelName) || !prisma[modelName].count) return 0;
  return safe(`${modelName}.count`, 0, () => prisma[modelName].count(args));
}

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addLocalDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dayWindow(date = new Date()) {
  return {
    start: startOfLocalDay(date),
    end: endOfLocalDay(date),
  };
}

function getMorningCheckWindow(reference = new Date()) {
  const today = dayWindow(reference);
  const isFriday = today.start.getDay() === 5;
  if (isFriday) {
    const nextMonday = startOfLocalDay(addLocalDays(today.start, 3));
    const nextFriday = endOfLocalDay(addLocalDays(nextMonday, 4));
    return {
      today,
      next: {
        start: nextMonday,
        end: nextFriday,
        label: 'Proxima semana',
        mode: 'NEXT_WEEK',
      },
      isFriday,
    };
  }

  const tomorrow = addLocalDays(today.start, 1);
  return {
    today,
    next: {
      ...dayWindow(tomorrow),
      label: 'Amanha',
      mode: 'TOMORROW',
    },
    isFriday,
  };
}

function isClosedVisitStatus(status) {
  return ['DONE', 'CANCELLED', 'CANCELED', 'CANCELADA', 'NAO_REALIZADA', 'NOT_DONE'].includes(
    String(status || '').toUpperCase()
  );
}

function isOpenAppointmentStatus(status) {
  return !['DONE', 'COMPLETED', 'CANCELLED', 'CANCELED', 'CANCELADA'].includes(
    String(status || '').toUpperCase()
  );
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isChemicalGuideItem(item) {
  const raw = normalizeSearchText(`${item?.type || ''} ${item?.name || ''} ${item?.productName || ''}`);
  return /chemical|quim|cloro|ph|sal|bromo|alcal|floc|algic|algicida|estabil|redutor|aumentador|orp/.test(raw);
}

function parseSystemDocument(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && parsed.url ? parsed : null;
  } catch (_) {
    return null;
  }
}

function checkStatus(hasBad, hasWarn) {
  if (hasBad) return 'BAD';
  if (hasWarn) return 'WARN';
  return 'OK';
}

function compactList(list, formatter, limit = 5) {
  return (list || []).slice(0, limit).map(formatter).filter(Boolean);
}

function collectVisitKeys(visit) {
  const client = visit.pool?.client || visit.client || null;
  return [
    ...(visit.pool?.keyAccesses || []).map((key) => ({
      id: `pool-${key.id}`,
      code: key.keyCode,
      name: key.description || 'Chave da piscina',
      scope: 'Piscina',
    })),
    ...(client?.accesses || []).map((key) => ({
      id: `client-${key.id}`,
      code: key.codeValue,
      name: key.title || 'Chave geral',
      scope: 'Cliente',
    })),
  ].filter((key) => key.code || key.name);
}

function keyRequirementRows(visits) {
  const seen = new Set();
  const rows = [];
  for (const visit of visits || []) {
    for (const key of collectVisitKeys(visit)) {
      const dedupeKey = `${visit.id}:${key.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      rows.push({
        visit,
        key,
        technicianName: visit.technician?.name || visit.technicianName || 'sem tecnico',
        poolName: visit.pool?.name || 'Piscina',
        clientName: visit.pool?.client?.name || visit.client?.name || 'Cliente',
        roundName: visit.round?.name || null,
      });
    }
  }
  return rows;
}

async function findVisitsInWindow(window) {
  return safe('serviceVisit.findMany.morningWindow', [], () => db('serviceVisit').findMany({
    where: {
      OR: [
        { plannedDate: { gte: window.start, lte: window.end } },
        { date: { gte: window.start, lte: window.end } },
      ],
    },
    include: {
      client: {
        include: {
          accesses: {
            where: { accessType: 'KEY', active: true, visibleToTechnician: true },
          },
        },
      },
      pool: {
        include: {
          keyAccesses: {
            where: { active: true, visibleToTechnician: true },
          },
          client: {
            include: {
              accesses: {
                where: { accessType: 'KEY', active: true, visibleToTechnician: true },
              },
            },
          },
        },
      },
      technician: true,
      round: true,
    },
    orderBy: [{ plannedDate: 'asc' }, { date: 'asc' }, { createdAt: 'asc' }],
    take: 250,
  }));
}

async function findAppointmentsInWindow(window) {
  if (!available('appointment')) return [];
  const rows = await safe('appointment.findMany.morningWindow', [], () => db('appointment').findMany({
    where: { startsAt: { gte: window.start, lte: window.end } },
    orderBy: { startsAt: 'asc' },
    take: 200,
  }));
  return rows.filter((row) => isOpenAppointmentStatus(row.status));
}

async function findGeneralRemindersInWindow(window) {
  if (!available('generalReminder')) return [];
  return safe('generalReminder.findMany.morningWindow', [], () => db('generalReminder').findMany({
    where: {
      dueAt: { gte: window.start, lte: window.end },
      status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED', 'CANCELED'] },
    },
    orderBy: { dueAt: 'asc' },
    take: 200,
  }));
}

async function findOperationalRemindersInWindow(window) {
  if (!available('operationalReminder')) return [];
  return safe('operationalReminder.findMany.morningWindow', [], () => db('operationalReminder').findMany({
    where: {
      dueDate: { gte: window.start, lte: window.end },
      isCompleted: false,
    },
    include: { client: true, pool: true, assignedTechnician: true },
    orderBy: { dueDate: 'asc' },
    take: 200,
  }));
}

async function buildMorningCheck() {
  const windows = getMorningCheckWindow();
  const [vehicles, transportGuides, openWorkGuides, stockBalances, visitsToday, visitsNext, appointmentsToday, appointmentsNext, remindersToday, remindersNext, operationalRemindersToday, operationalRemindersNext, overdueOperationalReminders] = await Promise.all([
    safe('vehicle.findMany.morningCheck', [], () => db('vehicle').findMany({
      where: { active: true, deletedAt: null },
      include: { assignedTechnicians: true },
      orderBy: { plate: 'asc' },
    })),
    safe('transportGuide.findMany.morningCheck', [], () => db('transportGuide').findMany({
      where: { status: 'ACTIVE' },
      include: { vehicle: true, items: true },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    })),
    safe('workGuide.findMany.morningCheck', [], () => db('workGuide').findMany({
      where: { status: 'OPEN' },
      include: { vehicle: true, technician: true, guide: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })),
    safe('stockBalance.findMany.vehicleChemicalMorningCheck', [], () => available('stockBalance') ? db('stockBalance').findMany({
      where: { scope: 'VEHICLE', category: { contains: 'CHEMICAL' } },
      orderBy: [{ vehicleId: 'asc' }, { productName: 'asc' }],
      take: 500,
    }) : []),
    findVisitsInWindow(windows.today),
    findVisitsInWindow(windows.next),
    findAppointmentsInWindow(windows.today),
    findAppointmentsInWindow(windows.next),
    findGeneralRemindersInWindow(windows.today),
    findGeneralRemindersInWindow(windows.next),
    findOperationalRemindersInWindow(windows.today),
    findOperationalRemindersInWindow(windows.next),
    safe('operationalReminder.findMany.overdueMorningCheck', [], () => available('operationalReminder') ? db('operationalReminder').findMany({
      where: { dueDate: { lt: windows.today.start }, isCompleted: false },
      include: { client: true, pool: true, assignedTechnician: true },
      orderBy: { dueDate: 'asc' },
      take: 100,
    }) : []),
  ]);

  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const guideByVehicle = new Map();
  for (const guide of transportGuides) {
    if (!guide.vehicleId || guideByVehicle.has(guide.vehicleId)) continue;
    guideByVehicle.set(guide.vehicleId, guide);
  }

  const workGuideByVehicle = new Map();
  for (const guide of openWorkGuides) {
    if (!guide.vehicleId || workGuideByVehicle.has(guide.vehicleId)) continue;
    workGuideByVehicle.set(guide.vehicleId, guide);
  }

  const activeGuideIds = Array.from(new Set(Array.from(guideByVehicle.values()).map((guide) => guide.id)));
  const documentKeys = activeGuideIds.map((id) => `transport_guide_at_document_${id}`);
  const documentRows = documentKeys.length && available('systemSetting')
    ? await safe('systemSetting.findMany.transportGuideDocumentsMorningCheck', [], () => db('systemSetting').findMany({
        where: { key: { in: documentKeys } },
      }))
    : [];
  const documentByGuideId = new Map();
  for (const row of documentRows) {
    const guideId = Number(String(row.key || '').replace('transport_guide_at_document_', ''));
    const document = parseSystemDocument(row.value);
    if (guideId && document) documentByGuideId.set(guideId, document);
  }

  const missingTransportGuideVehicles = vehicles.filter((vehicle) => !guideByVehicle.has(vehicle.id));
  const expiredGuideVehicles = vehicles.filter((vehicle) => {
    const guide = guideByVehicle.get(vehicle.id);
    return guide?.validUntil && new Date(guide.validUntil) < windows.today.start;
  });
  const missingOfficialDocuments = Array.from(guideByVehicle.values()).filter((guide) => !documentByGuideId.has(guide.id));
  const missingWorkGuideVehicles = vehicles.filter((vehicle) => guideByVehicle.has(vehicle.id) && !workGuideByVehicle.has(vehicle.id));

  const workGuidesWithoutChemicals = openWorkGuides.filter((guide) => !(guide.items || []).some(isChemicalGuideItem));
  const chemicalRows = openWorkGuides.flatMap((guide) => (guide.items || [])
    .filter(isChemicalGuideItem)
    .map((item) => ({ ...item, guide, vehicle: guide.vehicle })));
  const lowChemicalRows = chemicalRows.filter((item) => {
    const quantity = toFloat(item.quantity, 0);
    const initialQty = toFloat(item.initialQty, quantity);
    return quantity <= 0 || (initialQty > 0 && quantity <= Math.max(1, initialQty * 0.15));
  });
  const lowVehicleStockRows = (stockBalances || []).filter((item) => toFloat(item.quantity, 0) <= 0);

  const openVisitsToday = visitsToday.filter((visit) => !isClosedVisitStatus(visit.status));
  const openVisitsNext = visitsNext.filter((visit) => !isClosedVisitStatus(visit.status));
  const visitsTodayWithoutTechnician = openVisitsToday.filter((visit) => !visit.technicianId);
  const visitsNextWithoutTechnician = openVisitsNext.filter((visit) => !visit.technicianId);
  const keyRowsToday = keyRequirementRows(openVisitsToday);

  const reminderRowsToday = [...remindersToday, ...operationalRemindersToday];
  const reminderRowsNext = [...remindersNext, ...operationalRemindersNext];

  const checks = [
    {
      key: 'transportGuides',
      label: 'Guias de transporte AT',
      status: checkStatus(missingTransportGuideVehicles.length || expiredGuideVehicles.length, missingOfficialDocuments.length),
      href: '/admin-vehicles',
      count: guideByVehicle.size,
      message: missingTransportGuideVehicles.length
        ? `${missingTransportGuideVehicles.length} viatura(s) sem guia AT ativa.`
        : expiredGuideVehicles.length
          ? `${expiredGuideVehicles.length} guia(s) AT fora da validade.`
          : missingOfficialDocuments.length
            ? `${missingOfficialDocuments.length} guia(s) AT sem ficheiro oficial carregado.`
            : 'Todas as viaturas ativas tem guia AT operacional.',
      details: [
        ...compactList(missingTransportGuideVehicles, (vehicle) => `Sem guia: ${vehicle.plate || vehicle.name || `Viatura ${vehicle.id}`}`),
        ...compactList(expiredGuideVehicles, (vehicle) => `Validade expirada: ${vehicle.plate || vehicle.name || `Viatura ${vehicle.id}`}`),
        ...compactList(missingOfficialDocuments, (guide) => `Falta upload AT: ${guide.vehicle?.plate || `Guia ${guide.id}`} ${guide.codeAT || ''}`.trim()),
      ],
    },
    {
      key: 'workGuides',
      label: 'Guias de obra',
      status: checkStatus(missingWorkGuideVehicles.length, false),
      href: '/admin-vehicles',
      count: openWorkGuides.length,
      message: missingWorkGuideVehicles.length
        ? `${missingWorkGuideVehicles.length} viatura(s) com guia AT mas sem guia de obra aberta.`
        : 'Guias de obra abertas para as viaturas preparadas.',
      details: compactList(missingWorkGuideVehicles, (vehicle) => `Abrir guia de obra: ${vehicle.plate || vehicle.name || `Viatura ${vehicle.id}`}`),
    },
    {
      key: 'chemicals',
      label: 'Quimicos / stock em campo',
      status: checkStatus(lowChemicalRows.length || lowVehicleStockRows.length, workGuidesWithoutChemicals.length || !chemicalRows.length),
      href: '/admin-inventory',
      count: chemicalRows.length,
      message: lowChemicalRows.length || lowVehicleStockRows.length
        ? `${lowChemicalRows.length + lowVehicleStockRows.length} linha(s) de quimicos em ruptura ou perto de ruptura.`
        : workGuidesWithoutChemicals.length || !chemicalRows.length
          ? 'Confirmar quimicos nas viaturas antes de sair.'
          : 'Quimicos carregados nas guias de obra.',
      details: [
        ...compactList(lowChemicalRows, (item) => `${item.vehicle?.plate || 'Viatura'}: ${item.name} ${toFloat(item.quantity, 0)} ${item.unit || ''}`.trim()),
        ...compactList(lowVehicleStockRows, (item) => `${item.vehicleId ? `Viatura ${item.vehicleId}` : 'Stock viatura'}: ${item.productName} ${toFloat(item.quantity, 0)} ${item.unit || ''}`.trim()),
        ...compactList(workGuidesWithoutChemicals, (guide) => `Sem quimicos na guia: ${guide.vehicle?.plate || `Guia obra ${guide.id}`}`),
      ],
    },
    {
      key: 'todaySchedule',
      label: 'Agendamentos de hoje',
      status: checkStatus(visitsTodayWithoutTechnician.length, !openVisitsToday.length),
      href: '/admin-visits',
      count: openVisitsToday.length + appointmentsToday.length,
      message: visitsTodayWithoutTechnician.length
        ? `${visitsTodayWithoutTechnician.length} visita(s) de hoje sem tecnico.`
        : openVisitsToday.length || appointmentsToday.length
          ? `${openVisitsToday.length} visita(s) e ${appointmentsToday.length} agendamento(s) para hoje.`
          : 'Sem visitas/agendamentos para hoje. Confirmar se e intencional.',
      details: compactList(openVisitsToday, (visit) => `${visit.pool?.name || 'Piscina'} - ${visit.client?.name || 'Cliente'} - ${visit.technician?.name || 'sem tecnico'}`),
    },
    {
      key: 'roundKeys',
      label: 'Chaves da ronda',
      status: keyRowsToday.length ? 'WARN' : 'OK',
      href: '/admin-keys',
      count: keyRowsToday.length,
      message: keyRowsToday.length
        ? `${keyRowsToday.length} chave(s)/codigo(s) devem sair com as equipas hoje.`
        : 'Nenhuma chave obrigatoria nas rondas abertas de hoje.',
      details: compactList(keyRowsToday, (row) => `${row.technicianName}: ${row.key.code || row.key.name} para ${row.poolName}${row.roundName ? ` (${row.roundName})` : ''}`, 8),
    },
    {
      key: 'nextSchedule',
      label: windows.next.label,
      status: checkStatus(visitsNextWithoutTechnician.length, windows.isFriday || !openVisitsNext.length),
      href: '/admin-rounds',
      count: openVisitsNext.length + appointmentsNext.length,
      message: windows.isFriday
        ? `${openVisitsNext.length} visita(s) e ${appointmentsNext.length} agendamento(s) na proxima semana. Rever antes do fim do dia.`
        : openVisitsNext.length || appointmentsNext.length
          ? `${openVisitsNext.length} visita(s) e ${appointmentsNext.length} agendamento(s) para amanha.`
          : 'Sem visitas/agendamentos para amanha. Confirmar planeamento.',
      details: compactList(openVisitsNext, (visit) => `${visit.pool?.name || 'Piscina'} - ${visit.client?.name || 'Cliente'} - ${visit.technician?.name || 'sem tecnico'}`),
    },
    {
      key: 'reminders',
      label: 'Lembretes operacionais',
      status: checkStatus(overdueOperationalReminders.length, false),
      href: '/admin-crm',
      count: reminderRowsToday.length + reminderRowsNext.length + overdueOperationalReminders.length,
      message: overdueOperationalReminders.length
        ? `${overdueOperationalReminders.length} lembrete(s) atrasado(s).`
        : `${reminderRowsToday.length} lembrete(s) hoje e ${reminderRowsNext.length} no proximo periodo.`,
      details: [
        ...compactList(overdueOperationalReminders, (reminder) => `Atrasado: ${reminder.title}`),
        ...compactList(reminderRowsToday, (reminder) => `Hoje: ${reminder.title}`),
        ...compactList(reminderRowsNext, (reminder) => `${windows.next.label}: ${reminder.title}`),
      ],
    },
  ];

  const bad = checks.filter((check) => check.status === 'BAD').length;
  const warn = checks.filter((check) => check.status === 'WARN').length;
  return {
    generatedAt: new Date().toISOString(),
    today: { start: windows.today.start.toISOString(), end: windows.today.end.toISOString() },
    next: { start: windows.next.start.toISOString(), end: windows.next.end.toISOString(), label: windows.next.label, mode: windows.next.mode },
    isFriday: windows.isFriday,
    status: bad ? 'BAD' : warn ? 'WARN' : 'OK',
    title: bad ? 'Arranque bloqueado' : warn ? 'Arranque com avisos' : 'Pronto para iniciar o dia',
    message: bad
      ? 'Existem pontos criticos antes das equipas sairem para o terreno.'
      : warn
        ? 'Ha avisos para rever antes de deixar a operacao correr.'
        : 'Guias, quimicos, agenda e lembretes estao controlados.',
    counts: {
      bad,
      warn,
      ok: checks.filter((check) => check.status === 'OK').length,
      vehicles: vehicles.length,
      activeTransportGuides: guideByVehicle.size,
      openWorkGuides: openWorkGuides.length,
      visitsToday: openVisitsToday.length,
      visitsNext: openVisitsNext.length,
      requiredKeysToday: keyRowsToday.length,
      remindersToday: reminderRowsToday.length,
      remindersNext: reminderRowsNext.length,
    },
    checks,
  };
}

async function getCoreCounts() {
  const last24h = new Date(Date.now() - (24 * 60 * 60 * 1000));
  const [
    clients,
    pools,
    technicians,
    rounds,
    visitsPlanned,
    visitsDone,
    repairsOpen,
    invoicesOpen,
    messagesUnread,
    notificationsUnread,
    technicalSheetEvents24h,
  ] = await Promise.all([
    safeCount('client'),
    safeCount('pool'),
    safeCount('technician'),
    safeCount('round'),
    safeCount('serviceVisit', { where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
    safeCount('serviceVisit', { where: { status: 'DONE' } }),
    safeCount('repair', { where: { status: { in: ['PENDING', 'QUOTED', 'APPROVED'] } } }),
    safeCount('invoice', { where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } } }),
    safeCount('clientMessage', {
      where: {
        isReadByAdmin: false,
        OR: [
          { senderType: 'CLIENT' },
          { sender: 'Cliente' },
        ],
      },
    }),
    safeCount('notification', {
      where: {
        isRead: false,
        OR: [
          { role: null },
          { role: 'ADMIN' },
        ],
      },
    }),
    safeCount('technicalHistory', {
      where: {
        type: { in: ['TECHNICAL_SHEET_CHANGE', TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE, TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE] },
        createdAt: { gte: last24h },
      },
    }),
  ]);

  return {
    clients,
    pools,
    technicians,
    rounds,
    visitsPlanned,
    visitsDone,
    repairsOpen,
    invoicesOpen,
    messagesUnread,
    notificationsUnread,
    technicalSheetEvents24h,
  };
}

router.get('/health', async (req, res) => {
  const health=await checkDatabaseHealth();
  return res.status(health.ok?200:503).json({...health,time:new Date().toISOString()});
});

router.get('/dashboard', async (req, res) => {
  const counts = await getCoreCounts();
  const morningCheck = await buildMorningCheck();
  const technicalPropagation = await safe('technicalHistory.findMany.propagationDashboard', [], () => available('technicalHistory') ? db('technicalHistory').findMany({
    where: {
      type: { in: ['TECHNICAL_SHEET_CHANGE', TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE, TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE] },
    },
    orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
    take: 20,
  }) : []);

  const pendingPoolsWithoutRound = await safe('pool.findMany.pendingPoolsWithoutRound', [], () => db('pool').findMany({
    where: { active: true, roundPools: { none: {} } },
    include: { client: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  }));

  const nextVisits = await safe('serviceVisit.findMany.nextVisits', [], () => db('serviceVisit').findMany({
    where: { status: { in: ['PLANNED', 'IN_PROGRESS', 'PENDING_TECHNICIAN'] } },
    include: {
      client: {
        include: {
          accesses: {
            where: { active: true, visibleToTechnician: true },
            orderBy: [{ title: 'asc' }, { id: 'asc' }],
          },
        },
      },
      pool: {
        include: {
          keyAccesses: {
            where: { active: true, visibleToTechnician: true },
            orderBy: [{ requiredForVisit: 'desc' }, { keyCode: 'asc' }],
          },
        },
      },
      technician: true,
      round: true,
    },
    orderBy: [{ plannedDate: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  }));

  return res.json({
    ok: true,
    counts,
    pendingPoolsWithoutRound,
    nextVisits,
    morningCheck,
    technicalPropagation: technicalPropagation.map((row) => ({
      id: row.id,
      poolId: row.poolId,
      type: row.type,
      message: row.message,
      at: row.performedAt || row.createdAt,
      status: row.status,
      component: row.component,
    })),
  });
});

router.get('/timeline/technical-sheet-events', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, toInt(req.query.limit, 80) || 80));
    const rows = await safe('technicalHistory.findMany.technicalTimeline', [], () => available('technicalHistory') ? db('technicalHistory').findMany({
      where: {
        type: { in: ['TECHNICAL_SHEET_CHANGE', TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE, TECHNICAL_PROPOSAL_TYPE, TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE] },
      },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    }) : []);

    const timeline = rows.map((row) => {
      const parsed = safeJson(row.description, {});
      return {
        id: row.id,
        poolId: row.poolId,
        at: row.performedAt || row.createdAt,
        type: row.type,
        status: row.status,
        title: row.component || 'Evento técnico',
        message: row.message || '',
        actor: parsed?.actor || parsed?.by || null,
        source: parsed?.source || null,
      };
    });

    return res.json({ ok: true, timeline });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/knowledge/technical-sheet', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, toInt(req.query.limit, 50) || 50));
    const notes = BrainKnowledge.listNotes(limit)
      .filter((note) => Array.isArray(note.tags) && note.tags.includes('technical-sheet'))
      .map((note) => ({
        id: note.id,
        title: note.title,
        body: note.body,
        tags: note.tags,
        createdAt: note.createdAt,
      }));
    return res.json({ ok: true, notes });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/clients', async (req, res) => {
  const clients = await safe('client.findMany.withRelations', [], async () => {
    return db('client').findMany({
      where: truthy(req.query.includeInactive) ? {} : { active: true, deletedAt: null, archiveStatus: 'ATIVO', status: { not: 'ARCHIVED' } },
      include: {
        pools: { include: { roundPools: { include: { round: true } } } },
        invoices: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 1000,
    });
  });

  return res.json({ ok: true, clients });
});

router.post('/clients', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: 'Nome do cliente obrigatório' });

    const client = await db('client').create({
      data: await clientMutationData({ ...body, status: 'SETUP', active: true, archiveStatus: 'ATIVO', deletedAt: null, paymentStatus: 'BILLING_DISABLED' }),
    });

    return res.json({ ok: true, client, next: 'CREATE_POOL' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/clients/:id/edit-state', require('../controllers/clientController').getClientEditState);
router.put('/clients/:id', require('../controllers/clientController').updateClient);


router.post('/clients/:id/activate', require('../controllers/clientController').activateClient);


router.post('/clients/:id/activate-contract', require('../controllers/clientController').activateClient);

router.post('/clients/:id/archive', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const client = await db('client').update({ where: { id }, data: dataFor('client', { status: 'ARCHIVED', active: false, archiveStatus: 'ARQUIVADO', deletedAt: new Date(), billingActive: false, paymentStatus: 'BILLING_DISABLED' }) });
    return res.json({ ok: true, client });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/clients/:id/restore', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const client = await db('client').update({ where: { id }, data: dataFor('client', { status: 'SETUP', active: true, archiveStatus: 'ATIVO', deletedAt: null, billingActive: false, paymentStatus: 'BILLING_DISABLED' }) });
    return res.json({ ok: true, client, message: 'Cliente restaurado em configuração. A faturação continua desligada até ativar contrato.' });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (await hasOperationalHistory('client', id)) {
      const client = await db('client').update({ where: { id }, data: dataFor('client', { status: 'ARCHIVED', active: false, archiveStatus: 'ARQUIVADO', deletedAt: new Date(), billingActive: false, paymentStatus: 'BILLING_DISABLED' }) });
      return res.json({ ok: true, archived: true, client, message: 'Cliente arquivado porque tem histórico associado.' });
    }
    await db('client').delete({ where: { id } });
    return res.json({ ok: true, deleted: true });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/clients/:clientId/pools', async (req, res) => {
  try {
    const clientId = toInt(req.params.clientId);
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: 'Nome da piscina/jacuzzi obrigatório' });

    const pool = await prisma.$transaction(async (tx) => {
      const poolData = poolBaseData({ ...body, active: true, archiveStatus: 'ATIVO', deletedAt: null, scheduleMode: 'PENDING_ROUND' }, clientId, { forCreate: true });
      const duplicateFilters = [];

      if (poolData.address && poolData.location && poolData.type) {
        duplicateFilters.push({
          address: poolData.address,
          location: poolData.location,
          type: poolData.type,
        });
      }

      if (duplicateFilters.length) {
        const duplicate = await tx.pool.findFirst({
          where: { OR: duplicateFilters },
          select: { id: true, clientId: true, name: true, address: true, location: true, type: true },
        });

        if (duplicate) {
          const duplicateError = new Error('Possivel duplicacao: ja existe equipamento com esta localizacao, tipo ou numero de serie.');
          duplicateError.statusCode = 400;
          duplicateError.code = 'DUPLICATE_POOL';
          duplicateError.duplicate = duplicate;
          throw duplicateError;
        }
      }

      const createdPool = await tx.pool.create({
        data: poolData,
      });
      if (tx.technicalSheet) {
        await tx.technicalSheet.upsert({
          where: { poolId: createdPool.id },
          update: {},
          create: {
            poolId: createdPool.id,
            volumeM3: body.volumeM3 == null ? 0 : toFloat(body.volumeM3, 0),
            disinfectionType: body.disinfectionType || body.type || 'CLORO',
          },
        }).catch(() => null);
      }
      return createdPool;
    });

    return res.json({ ok: true, pool, next: 'ASSIGN_ROUND_OR_PENDING' });
  } catch (error) {
    if (error.code === 'DUPLICATE_POOL' || error.code === 'P2002') {
      return res.status(400).json({
        ok: false,
        code: 'DUPLICATE_POOL',
        error: 'Possivel duplicacao: ja existe equipamento com esta localizacao, tipo ou numero de serie.',
        duplicate: error.duplicate || undefined,
      });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ ok: false, code: error.code, error: error.message });
    }
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/pools', async (req, res) => {
  const pools = await safe('pool.findMany.withClient', [], () => db('pool').findMany({
    where: truthy(req.query.includeInactive) ? {} : { active: true, deletedAt: null, archiveStatus: 'ATIVO' },
    include: {
      client: true,
      technicalSheet: true,
      roundPools: {
        include: { round: true },
        orderBy: [{ roundId: 'asc' }, { order: 'asc' }],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  }));
  return res.json({ ok: true, pools });
});

router.get('/pools/:id/technical-sheet/edit-state', async (req, res) => {
  try { return res.json(await require('../business/pool/PoolTechnicalSheetBusiness').getState(req.params.id, req.user)); }
  catch (error) { return res.status(error.statusCode || 500).json({ ok: false, code: error.publicCode, error: error.statusCode ? error.message : 'Não foi possível carregar a ficha técnica.' }); }
});

router.get('/pools/:id/technical-sheet', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const pool = await db('pool').findUnique({
      where: { id },
      include: {
        client: {
          include: {
            accesses: {
              where: { accessType: 'KEY', active: true, visibleToTechnician: true },
              orderBy: [{ title: 'asc' }, { id: 'asc' }],
            },
          },
        },
        equipment: true,
        technicalRoom: true,
        calculationProfile: true,
        technicalSheet: true,
        keyAccesses: {
          where: { active: true },
          orderBy: [{ requiredForVisit: 'desc' }, { keyCode: 'asc' }],
        },
        technicalHistory: { orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }], take: 20 },
      },
    });
    if (!pool) return res.status(404).json({ ok: false, error: 'Piscina não encontrada' });
    if (pool.client) { delete pool.client.password; delete pool.client.pin; }
    return res.json({ ok: true, pool });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

// Every proposal read/write is scoped and uses the same business contract.
function proposalHandler(action, status = 200) {
  return async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { return res.status(status).json(await action(req)); }
    catch (error) { return res.status(error.statusCode || 500).json({ ok: false, code: error.publicCode || 'TECHNICAL_PROPOSAL_WRITE_FAILED', error: error.statusCode ? error.message : 'Não foi possível confirmar a operação da proposta. Consulte o estado antes de repetir.' }); }
  };
}
router.get('/pools/:id/technical-change-proposals', proposalHandler(req => TechnicalProposals.list(req.params.id, req.user, truthy(req.query.onlyPending))));
router.post('/pools/:id/technical-change-proposals', proposalHandler(req => TechnicalProposals.create(req.params.id, req.body, req.user), 201));
router.post('/pools/:id/technical-change-proposals/:proposalId/workflow', proposalHandler(req => TechnicalProposals.transition(req.params.id, req.params.proposalId, req.body, req.user)));
router.get('/pools/:id/technical-change-proposals/:proposalId/diff', proposalHandler(req => TechnicalProposals.detail(req.params.id, req.params.proposalId, req.user, 'diff')));
router.get('/pools/:id/technical-change-proposals/:proposalId/history', proposalHandler(req => TechnicalProposals.detail(req.params.id, req.params.proposalId, req.user, 'history')));
router.post('/pools/:id/technical-change-proposals/workflow/batch', proposalHandler(req => TechnicalProposals.batch(req.params.id, req.body, req.user)));
router.get('/pools/:id/technical-change-proposals/:proposalId/application-preview', proposalHandler(req => TechnicalProposals.applicationPreview(req.params.id, req.params.proposalId, req.user)));
router.post('/pools/:id/technical-change-proposals/:proposalId/application-preview', proposalHandler(req => TechnicalProposals.applicationPreview(req.params.id, req.params.proposalId, req.user, req.body)));
router.post('/pools/:id/technical-change-proposals/:proposalId/apply', proposalHandler(req => TechnicalProposals.apply(req.params.id, req.params.proposalId, req.body, req.user)));

router.put('/pools/:id/technical-sheet', async (req, res) => {
  try { return res.json(await require('../business/pool/PoolTechnicalSheetBusiness').update(req.params.id, req.body, req.user)); }
  catch (error) { return res.status(error.statusCode || 500).json({ ok: false, code: error.publicCode, error: error.statusCode ? error.message : 'Alteração não confirmada. Conserve o pedido e repita a confirmação.' }); }
});

router.get('/pools/:id/service-reminders', async (req, res) => {
  try {
    return res.json(await ReminderListBusiness.list({ poolId: req.params.id }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, error: error.message });
  }
});

router.post('/pools/:id/service-reminders', async (req, res) => {
  try {
    return res.status(201).json(await ReminderCreationBusiness.create(req.user, req.body || {}, req.params.id));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, error: error.message });
  }
});

router.post('/pools/:id/service-reminders/:reminderId/complete', async (req, res) => {
  try {
    return res.json(await ReminderCompletionBusiness.complete({
      poolId: req.params.id, reminderId: req.params.reminderId,
      createdBy: req.user?.email || 'ADMIN',
    }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, error: error.message });
  }
});

router.delete('/pools/:id/service-reminders/:reminderId', async (req, res) => {
  try {
    return res.json(await ReminderDeletionBusiness.remove(req.user, {
      poolId: req.params.id, reminderId: req.params.reminderId, expectedUpdatedAt: req.body?.expectedUpdatedAt,
    }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, error: error.message });
  }
});

router.get('/daily-service-log', async (req, res) => {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  try {
    const result = await require('../services/dailyServiceLogService').read(req.query);
    res.set({ 'X-CW-Report-Type': 'daily-service-log', 'X-CW-Report-Version': '2', 'X-CW-Day': result.day });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 503).json({ ok: false, error: error.statusCode ? error.message : 'Não foi possível confirmar o registo diário. Tente novamente.' });
  }
});

router.put('/pools/:id', require('../controllers/poolController').updatePool);
router.get('/pools/:id/edit-state', require('../controllers/poolController').getPoolEditState);


router.post('/pools/:id/archive', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const pool = await db('pool').update({ where: { id }, data: dataFor('pool', { active: false, archiveStatus: 'ARQUIVADO', deletedAt: new Date(), scheduleMode: 'ARCHIVED' }) });
    return res.json({ ok: true, pool });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/pools/:id/restore', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const pool = await db('pool').update({ where: { id }, data: dataFor('pool', { active: true, archiveStatus: 'ATIVO', deletedAt: null, scheduleMode: 'PENDING_ROUND' }) });
    return res.json({ ok: true, pool });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.delete('/pools/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (await hasOperationalHistory('pool', id)) {
      const pool = await db('pool').update({ where: { id }, data: dataFor('pool', { active: false, archiveStatus: 'ARQUIVADO', deletedAt: new Date(), scheduleMode: 'ARCHIVED' }) });
      return res.json({ ok: true, archived: true, pool, message: 'Piscina arquivada porque tem histórico associado.' });
    }
    await db('pool').delete({ where: { id } });
    return res.json({ ok: true, deleted: true });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.get('/technicians', async (req, res) => {
  const technicians = await safe('technician.findMany', [], () => db('technician').findMany({
    where: truthy(req.query.includeInactive) ? {} : { active: true }, orderBy: { name: 'asc' } }));
  return res.json({ ok: true, technicians });
});

router.post('/technicians', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: 'Nome do técnico obrigatório' });

    const technician = await db('technician').create({
      data: technicianBaseData({ ...body, active: true }),
    });

    return res.json({ ok: true, technician });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});


router.put('/technicians/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const body = req.body || {};
    const technician = await db('technician').update({ where: { id }, data: technicianBaseData(body) });
    return res.json({ ok: true, technician });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/technicians/:id/restore', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const technician = await db('technician').update({ where: { id }, data: dataFor('technician', { active: true }) });
    return res.json({ ok: true, technician });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.delete('/technicians/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (await hasOperationalHistory('technician', id)) {
      const technician = await db('technician').update({ where: { id }, data: dataFor('technician', { active: false }) });
      return res.json({ ok: true, archived: true, technician, message: 'Técnico desativado porque tem histórico associado.' });
    }
    await db('technician').delete({ where: { id } });
    return res.json({ ok: true, deleted: true });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.get('/rounds', async (req, res) => {
  const rounds = await safe('round.findMany.withRelations', [], () => db('round').findMany({
    include: {
      pools: { include: { pool: { include: { client: true } } }, orderBy: { order: 'asc' } },
      technicians: { include: { technician: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { name: 'asc' }],
  }));

  return res.json({ ok: true, rounds });
});

router.post('/rounds', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: 'Nome da ronda obrigatório' });

    const round = await db('round').create({
      data: { name: String(body.name).trim(), dayOfWeek: toInt(body.dayOfWeek, 1), active: true },
    });

    return res.json({ ok: true, round });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/rounds/:roundId/technicians', async (req, res) => {
  try {
    const roundId = toInt(req.params.roundId);
    const technicianId = toInt(req.body.technicianId);

    const relation = await db('roundTechnician').upsert({
      where: { roundId_technicianId: { roundId, technicianId } },
      update: {},
      create: { roundId, technicianId },
    });

    return res.json({ ok: true, relation });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/rounds/:roundId/pools', async (req, res) => {
  try {
    const roundId = toInt(req.params.roundId);
    const poolId = toInt(req.body.poolId);

    await assertPoolReadyForRound(prisma, poolId);

    const maxOrder = await db('roundPool').aggregate({ where: { roundId }, _max: { order: true } });
    const order = toInt(req.body.order, (maxOrder._max.order || 0) + 1);

    const relation = await db('roundPool').upsert({
      where: { roundId_poolId: { roundId, poolId } },
      update: { order },
      create: { roundId, poolId, order },
    });

    await db('pool').update({ where: { id: poolId }, data: dataFor('pool', { scheduleMode: 'ROUND_ASSIGNED' }) }).catch(() => null);

    return res.json({ ok: true, relation, next: 'CREATE_VISIT' });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.readiness?.message || error.message,
      missing: error.readiness?.missing || undefined
    });
  }
});

router.post('/visits', async (req, res) => {
  try {
    const body = req.body || {};
    const poolId = toInt(body.poolId);

    const pool = await db('pool').findUnique({ where: { id: poolId }, include: { client: true, roundPools: { take: 1 } } });
    if (!pool) return res.status(404).json({ ok: false, error: 'Piscina não encontrada' });

    const visit = await db('serviceVisit').create({
      data: serviceVisitBaseData({
        clientId: pool.clientId,
        poolId: pool.id,
        roundId: body.roundId ? toInt(body.roundId) : (pool.roundPools[0]?.roundId || null),
        technicianId: body.technicianId ? toInt(body.technicianId) : null,
        plannedDate: body.plannedDate ? new Date(body.plannedDate) : todayStart(),
        status: body.technicianId ? 'PLANNED' : 'PENDING_TECHNICIAN',
        notes: body.notes || null,
      }),
    });

    return res.json({ ok: true, visit, next: 'TECHNICIAN_EXECUTES_VISIT' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/visits/:id/problem', async (req,res) => {
  res.set('Cache-Control','private, no-store');
  try { res.json(await require('../services/fieldProblemReportService').create(req.user,Number(req.params.id),req.body||{})); }
  catch(error) { res.status(error.statusCode||503).json({ok:false,code:error.code||'FIELD_PROBLEM_UNCONFIRMED',error:error.statusCode?error.message:'Ocorrência por confirmar. Repita o envio original.'}); }
});

router.post('/visits/:id/complete', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const body = req.body || {};

    if (body.requestId !== undefined) {
      const result = await completeServiceVisit(prisma, id, body, req.user);
      const { idempotent, ...response } = result;
      return res.json(response);
    }

    const visitScope = await db('serviceVisit').findUnique({ where: { id }, select: { id: true, technicianId: true } });
    if (!visitScope) return res.status(404).json({ ok: false, error: 'Visita nao encontrada' });

    const actorRole = String(req.user?.role || '').toUpperCase();
    if (!roleMatches(actorRole, 'ADMIN')) {
      const actorTechnicianId = toInt(req.user?.technicianId, toInt(req.user?.id));
      if (!actorTechnicianId || toInt(visitScope.technicianId) !== actorTechnicianId) {
        return res.status(403).json({ ok: false, error: 'Sem permissao para alterar visita de outro tecnico' });
      }
      const technician = await db('technician').findUnique({where:{id:actorTechnicianId},select:{vehicleId:true}});
      const workGuideId = toInt(body.workGuideId || body.guideWorkId);
      const workGuide = workGuideId ? await db('workGuide').findUnique({where:{id:workGuideId},select:{vehicleId:true,status:true}}) : null;
      if ((body.vehicleId && toInt(body.vehicleId) !== technician?.vehicleId) || (workGuideId && (!workGuide || workGuide.vehicleId !== technician?.vehicleId || workGuide.status !== 'OPEN'))) {
        return res.status(403).json({ok:false,error:'Guia ou viatura não pertence ao técnico autenticado.'});
      }
      body.performedByTechnicianId = actorTechnicianId;
      body.performedByUserId = req.user?.userId || null;
      delete body.userId;
    }

    const { visit, repair } = await completeServiceVisit(prisma, id, body);

    return res.json({ ok: true, visit, repair, next: body.problem || body.repair ? 'REPAIR_QUOTE' : 'MONTHLY_BILLING' });
  } catch (error) {
    if (error instanceof VisitCompletionError) {
      return res.status(error.statusCode).json({ ok: false, code: error.code, error: error.message });
    }
    if (req.body?.requestId !== undefined) return res.status(error.statusCode || 503).json({ ok: false, code: error.code || 'FIELD_COMPLETION_UNCONFIRMED', error: error.statusCode ? error.message : 'Conclusão por confirmar. Repita o pedido original.' });
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/repairs', async (req, res) => {
  const repairs = await safe('repair.findMany', [], () => db('repair').findMany({
    include: { pool: { include: { client: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }));

  return res.json({ ok: true, repairs });
});

router.post('/repairs/:id/quote', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const price = toFloat(req.body.totalPrice, 0);

    const repository = require('../dal/RepairRepository');
    const repair = await repository.transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Repair" WHERE id = ${id} FOR UPDATE`;
      if (await tx.repairQuote.count({ where: { repairId: id } })) return null;
      return tx.repair.update({ where: { id }, data: repairBaseData({ totalPrice: price, status: 'QUOTED', notes: req.body.notes || undefined }) });
    });
    if (!repair) return res.status(409).json({ ok: false, error: 'Use o editor detalhado para rever este orçamento' });

    return res.json({ ok: true, repair });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/invoices/generate', invoiceGenerationController.core);

router.post('/invoices/generate-legacy', invoiceGenerationController.legacy);

router.get('/invoices', async (req, res) => {
  const invoices = await safe('invoice.findMany', [], () => db('invoice').findMany({
    include: { client: true, lines: true, payments: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }));

  return res.json({ ok: true, invoices });
});

router.post('/invoices/:id/pay', async (req, res) => {
  try {
    const result = await CoreInvoicePaymentBusiness.registerPayment(prisma, req.body?.requestId !== undefined ? req.params.id : toInt(req.params.id), req.body || {}, req.user);
    return res.json({ ok: true, ...result, next: 'CLOSED' });
  } catch (error) {
    return res.status([400, 404, 409].includes(error.status) ? error.status : 500).json({ ok: false, error: error.message });
  }
});

router.get('/invoices/external', async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { return res.json(await finance.listExternalInvoices({ status: 'all' }, true)); }
  catch (error) { return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível consultar a faturação externa.' }); }
});

router.post('/invoices/:id/mark-external-issued', async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { return res.json(await finance.registerExternalInvoice(req.params.id, req.body, req.user)); }
  catch (error) { return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível guardar o número externo. Consulte o histórico antes de repetir.' }); }
});

router.post('/invoices/:id/review-external-reference', async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { return res.json(await finance.reviewExternalReference(req.params.id, req.body, req.user)); }
  catch (error) { return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível confirmar a revisão. Consulte o histórico antes de repetir.' }); }
});

router.post('/simulate-full-flow', async (req, res) => {
  const counts = await buildDashboardCounts();
  return res.json({
    ok: true,
    mode: 'dry-run',
    steps: ['clients', 'pools', 'technicians', 'rounds', 'visits', 'stock', 'billing'],
    counts,
    message: 'Fluxo validado em modo seguro, sem criar dados de demonstracao.'
  });
});

// Compatibility endpoints for older/front-end probes. They intentionally return stable payloads instead of 500.
router.get('/leads', async (req, res) => res.json({ ok: true, leads: [] }));
router.get('/reminders', async (req, res) => res.json({ ok: true, reminders: [] }));
router.get('/status', async (req, res) => res.json({ ok: true, status: 'CORE_FLOW_READY' }));

module.exports = router;
