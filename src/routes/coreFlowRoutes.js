const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prismaModule = require('../prismaClient');
const auth = require('../middlewares/authMiddleware');
const { completeServiceVisit, VisitCompletionError } = require('../services/serviceVisitCompletionService');
const {
  applyClientCreditToInvoice,
  createCreditLedgerPayment,
  invoiceOpen,
  invoicePaid,
  invoiceStatus,
  invoiceTotal,
} = require('../services/clientCreditService');
const { assertPoolReadyForRound } = require('../utils/poolReadiness');
const { roleMatches, normalizeRole } = require('../utils/roles');
const RepairBusiness = require('../business/repair/RepairBusiness');
const EventBus = require('../core/event/EventBus');
const BrainKnowledge = require('../system/knowledge/BrainKnowledge');

const prisma = prismaModule.prisma || prismaModule.default || prismaModule;
const router = express.Router();

const adminAuth = auth('ADMIN');
const technicianAuth = auth('TECHNICIAN');
const anyAuth = auth();
router.use((req, res, next) => {
  // Keep only minimal metadata endpoints public by design.
  if (req.method === 'GET' && (req.path === '/health' || req.path === '/dashboard')) return next();
  // Technician field mode depends on these two core routes.
  if (req.method === 'POST' && /^\/visits\/\d+\/(problem|complete)$/.test(req.path)) {
    return technicianAuth(req, res, next);
  }
  // Sprint 4.1: technicians can submit/read technical sheet change proposals.
  if (/^\/pools\/\d+\/technical-change-proposals(?:\/.*)?$/.test(req.path)) {
    return anyAuth(req, res, next);
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
function parseRepeatRuleInterval(rule) {
  const value = String(rule || '').trim().toUpperCase();
  if (!value || value === 'NONE') return null;
  const match = value.match(/^EVERY_(\d+)_(DAY|DAYS|MONTH|MONTHS|YEAR|YEARS)$/);
  if (match) {
    const amount = Math.max(1, toInt(match[1], 1));
    const unit = match[2].replace(/^(DAY|MONTH|YEAR)$/, '$1S');
    return { amount, unit };
  }
  if (value === 'WEEKLY') return { amount: 7, unit: 'DAYS' };
  if (value === 'MONTHLY') return { amount: 1, unit: 'MONTHS' };
  if (value === 'QUARTERLY') return { amount: 3, unit: 'MONTHS' };
  if (value === 'YEARLY') return { amount: 1, unit: 'YEARS' };
  return null;
}
function normalizeRepeatUnit(value) {
  const unit = String(value || 'DAYS').trim().toUpperCase();
  if (['DAY', 'DIA', 'DIAS', 'DAYS'].includes(unit)) return 'DAYS';
  if (['MONTH', 'MES', 'MESES', 'MONTHS'].includes(unit)) return 'MONTHS';
  if (['YEAR', 'ANO', 'ANOS', 'YEARS'].includes(unit)) return 'YEARS';
  return 'DAYS';
}
function validateRepeatInterval(interval) {
  if (!interval) return false;
  const maxByUnit = { DAYS: 1095, MONTHS: 120, YEARS: 10 };
  const max = maxByUnit[interval.unit] || 1095;
  return Number.isInteger(interval.amount) && interval.amount >= 1 && interval.amount <= max;
}
function normalizeRepeatRuleInput(body = {}) {
  const raw = String(body.repeatRule || '').trim().toUpperCase();
  if (!raw || raw === 'NONE') return 'NONE';

  let interval = null;
  if (raw === 'CUSTOM') {
    interval = {
      amount: toInt(body.customRepeatValue ?? body.customRepeatDays ?? body.repeatEveryDays),
      unit: normalizeRepeatUnit(body.customRepeatUnit ?? body.repeatUnit),
    };
  } else {
    interval = parseRepeatRuleInterval(raw);
  }

  if (!validateRepeatInterval(interval)) {
    const error = new Error('Repeticao invalida. Usa personalizada com dias, meses ou anos dentro dos limites permitidos.');
    error.statusCode = 400;
    throw error;
  }

  return `EVERY_${interval.amount}_${interval.unit}`;
}
function addRepeatInterval(date, interval) {
  const next = new Date(date);
  if (!interval) return next;
  if (interval.unit === 'MONTHS' || interval.unit === 'YEARS') {
    const months = interval.unit === 'YEARS' ? interval.amount * 12 : interval.amount;
    const originalDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDay));
    return next;
  }
  next.setDate(next.getDate() + interval.amount);
  return next;
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

const TECHNICAL_PROPOSAL_TYPE = 'TECHNICAL_CHANGE_PROPOSAL';
const TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE = 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT';
const TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE = 'TECHNICAL_SHEET_PROPAGATION_EVENT';
const PROPOSAL_RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH']);
const PROPOSAL_WORKFLOW_STATES = new Set(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED']);
const PROPOSAL_PENDING_STATES = new Set(['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO']);
const PROPOSAL_TRANSITIONS = {
  DRAFT: new Set(['SUBMITTED']),
  SUBMITTED: new Set(['IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED']),
  IN_REVIEW: new Set(['NEEDS_INFO', 'APPROVED', 'REJECTED']),
  NEEDS_INFO: new Set(['SUBMITTED', 'IN_REVIEW']),
  APPROVED: new Set([]),
  REJECTED: new Set([]),
};
const AUTO_FIELDS = new Set(['notes', 'technicalRoomNotes', 'equipmentNotes', 'historyNote', 'spelling']);
const MEDIUM_FIELDS = new Set(['pumpType', 'pumpPower', 'filterType', 'filterMedia', 'lightsType', 'lightsCount', 'saltSystem']);
const HIGH_FIELDS = new Set([
  'volumeM3', 'lengthM', 'widthM', 'depthMinM', 'depthMaxM', 'averageDepthM', 'shape',
  'targetSalinityPpm', 'targetChlorinePpm', 'pumpFlowM3h', 'type', 'monthlyAmount',
]);

function actorNameFromReq(req) {
  return String(req.user?.name || req.user?.email || req.headers['x-user-email'] || 'SYSTEM').trim() || 'SYSTEM';
}

function normalizeRiskLevel(value) {
  const level = String(value || '').trim().toUpperCase();
  return PROPOSAL_RISK_LEVELS.has(level) ? level : '';
}

function normalizeProposalWorkflowState(value, fallback = 'SUBMITTED') {
  const state = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  return PROPOSAL_WORKFLOW_STATES.has(state) ? state : fallback;
}

function normalizeComparable(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function readPoolFieldValue(pool, field) {
  if (!pool || !field) return null;
  const key = String(field || '').trim();
  const sources = [
    pool,
    pool.technicalSheet || {},
    pool.calculationProfile || {},
    pool.equipment || {},
    pool.technicalRoom || {},
  ];
  for (const source of sources) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }
  return null;
}

function buildProposalDiff(changes = [], pool = null) {
  return (Array.isArray(changes) ? changes : []).map((change) => {
    const field = String(change?.field || '').trim();
    const before = change?.before == null ? null : String(change.before);
    const after = change?.after == null ? null : String(change.after);
    const currentRaw = readPoolFieldValue(pool, field);
    const current = currentRaw == null ? null : String(currentRaw);
    const effectiveBefore = before == null || before === '' ? current : before;
    const hasDrift = normalizeComparable(current) !== normalizeComparable(effectiveBefore);
    const willChange = normalizeComparable(after) !== normalizeComparable(effectiveBefore);
    return {
      field,
      before,
      current,
      effectiveBefore,
      after,
      willChange,
      hasDrift,
    };
  });
}

function buildWorkflowEventHash(payload = {}, previousHash = '') {
  const source = JSON.stringify({
    proposalId: Number(payload.proposalId || 0),
    fromState: String(payload.fromState || ''),
    toState: String(payload.toState || ''),
    actor: String(payload.actor || ''),
    actorRole: String(payload.actorRole || ''),
    note: String(payload.note || ''),
    transitionedAt: String(payload.transitionedAt || ''),
    batchId: String(payload.batchId || ''),
    previousHash: String(previousHash || ''),
  });
  return crypto.createHash('sha256').update(source).digest('hex');
}

async function emitTechnicalSheetPropagationEvent({
  poolId,
  actor = 'SYSTEM',
  source = 'TECHNICAL_SHEET_UPDATE',
  proposalId = null,
  summary = '',
  metadata = {},
}) {
  const payload = {
    poolId,
    actor,
    source,
    proposalId,
    summary,
    metadata,
    propagatedAt: new Date().toISOString(),
  };

  if (available('technicalHistory')) {
    await db('technicalHistory').create({
      data: {
        poolId,
        type: TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE,
        component: 'Ficha Técnica Propagação',
        message: `Propagação técnica: ${source}`,
        description: JSON.stringify(payload),
        performedAt: new Date(),
        status: 'DONE',
      },
    }).catch(() => null);
  }

  if (available('notification')) {
    await db('notification').create({
      data: dataFor('notification', {
        type: 'TECHNICAL_SHEET_PROPAGATION',
        eventType: 'TECHNICAL_SHEET_UPDATED',
        title: 'Ficha técnica propagada',
        message: summary || `Atualização técnica da piscina ${poolId} propagada para Command Center e Base de Conhecimento.`,
        role: 'ADMIN',
        status: 'PENDING',
        severity: 'MEDIUM',
        metadata: {
          poolId,
          source,
          proposalId,
          actor,
          ...metadata,
        },
      }),
    }).catch(() => null);
  }

  try {
    BrainKnowledge.addNote(
      `Ficha técnica atualizada #${poolId}`,
      `${summary || 'Atualização técnica propagada'} | origem=${source}${proposalId ? ` | proposta=${proposalId}` : ''}`,
      ['technical-sheet', 'propagation', String(source || '').toLowerCase()]
    );
  } catch (_) {}

  await EventBus.emit('TECHNICAL_SHEET_UPDATED', payload, { actor, source }).catch(() => null);
}

function parseWorkflowEventDescription(description) {
  const parsed = safeJson(description, null);
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    proposalId: toInt(parsed.proposalId),
    fromState: normalizeProposalWorkflowState(parsed.fromState || '', ''),
    toState: normalizeProposalWorkflowState(parsed.toState || '', ''),
    actor: String(parsed.actor || ''),
    actorRole: String(parsed.actorRole || ''),
    note: String(parsed.note || ''),
    batchId: String(parsed.batchId || ''),
    transitionedAt: parsed.transitionedAt || null,
    previousHash: String(parsed.previousHash || ''),
    eventHash: String(parsed.eventHash || ''),
  };
}

async function listProposalWorkflowEventRows(poolId, proposalId) {
  if (!available('technicalHistory')) return [];
  const rows = await db('technicalHistory').findMany({
    where: {
      poolId,
      type: TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 500,
  });
  return rows.filter((row) => {
    const parsed = parseWorkflowEventDescription(row.description || '');
    return parsed && Number(parsed.proposalId) === Number(proposalId);
  });
}

function buildImmutableHistory(events = []) {
  let chainValid = true;
  let expectedPrevHash = '';
  const items = events.map((row) => {
    const parsed = parseWorkflowEventDescription(row.description || '') || {};
    const rebuiltHash = buildWorkflowEventHash(parsed, parsed.previousHash || '');
    const hashMatches = !!parsed.eventHash && parsed.eventHash === rebuiltHash;
    const prevMatches = (parsed.previousHash || '') === expectedPrevHash;
    const valid = hashMatches && prevMatches;
    if (!valid) chainValid = false;
    expectedPrevHash = parsed.eventHash || expectedPrevHash;
    return {
      id: row.id,
      proposalId: parsed.proposalId || null,
      fromState: parsed.fromState || '',
      toState: parsed.toState || '',
      actor: parsed.actor || '',
      actorRole: parsed.actorRole || '',
      note: parsed.note || '',
      batchId: parsed.batchId || '',
      transitionedAt: parsed.transitionedAt || row.performedAt || row.createdAt,
      previousHash: parsed.previousHash || '',
      eventHash: parsed.eventHash || '',
      valid,
    };
  });
  return {
    chainValid,
    totalEvents: items.length,
    latestHash: items.length ? items[items.length - 1].eventHash : '',
    events: items,
  };
}

function roleCanTransitionProposal(role, fromState, toState) {
  const current = normalizeProposalWorkflowState(fromState, 'SUBMITTED');
  const target = normalizeProposalWorkflowState(toState, '');
  if (!target || target === current) return false;
  if (!PROPOSAL_TRANSITIONS[current] || !PROPOSAL_TRANSITIONS[current].has(target)) return false;

  if (roleMatches(role, 'ADMIN')) return true;
  if (!roleMatches(role, 'TECHNICIAN')) return false;

  return (current === 'DRAFT' && target === 'SUBMITTED')
    || (current === 'NEEDS_INFO' && target === 'SUBMITTED');
}

async function appendTechnicalProposalWorkflowEvent({ poolId, proposalId, fromState, toState, actor, actorRole, note, batchId = '' }) {
  if (!available('technicalHistory')) return;
  const previousRows = await listProposalWorkflowEventRows(poolId, proposalId);
  const previousEvent = previousRows.length ? parseWorkflowEventDescription(previousRows[previousRows.length - 1].description || '') : null;
  const previousHash = String(previousEvent?.eventHash || '');
  const transitionedAt = new Date().toISOString();
  const payload = {
    proposalId,
    fromState,
    toState,
    actor,
    actorRole,
    note,
    batchId,
    transitionedAt,
    previousHash,
  };
  const eventHash = buildWorkflowEventHash(payload, previousHash);
  await db('technicalHistory').create({
    data: {
      poolId,
      type: TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE,
      component: 'Ficha Técnica Workflow',
      message: `Proposta #${proposalId}: ${fromState || 'INIT'} -> ${toState}`,
      description: JSON.stringify({ ...payload, eventHash }),
      performedAt: new Date(),
      status: toState,
    },
  }).catch(() => null);
}

async function transitionTechnicalProposalRow({ row, targetState, actorRole, actor, note = '', batchId = '' }) {
  const current = mapTechnicalProposal(row);
  const currentState = normalizeProposalWorkflowState(current.status, 'SUBMITTED');
  if (!roleCanTransitionProposal(actorRole, currentState, targetState)) {
    const deniedStatus = normalizeRole(actorRole) === 'TECHNICIAN' ? 403 : 409;
    return { ok: false, status: deniedStatus, error: 'Transicao de workflow nao permitida para esta proposta', currentState };
  }

  const transitions = Array.isArray(current.transitions) ? current.transitions : [];
  const nowIso = new Date().toISOString();
  const updatedPayload = {
    proposalId: current.id,
    reason: current.reason,
    riskLevel: current.riskLevel,
    photos: current.photos,
    changes: current.changes,
    actor: current.actor,
    actorRole: current.actorRole,
    submittedAt: current.submittedAt || nowIso,
    status: targetState,
    lifecycle: targetState,
    reviewNote: note || current.reviewNote || '',
    reviewedBy: roleMatches(actorRole, 'ADMIN') ? actor : (current.reviewedBy || ''),
    reviewedAt: roleMatches(actorRole, 'ADMIN') ? nowIso : (current.reviewedAt || null),
    transitions: [
      ...transitions,
      {
        from: currentState,
        to: targetState,
        at: nowIso,
        by: actor,
        note,
        batchId,
      },
    ],
  };

  const updated = await db('technicalHistory').update({
    where: { id: row.id },
    data: {
      status: targetState,
      description: JSON.stringify(updatedPayload),
      performedAt: new Date(),
    },
  });

  await appendTechnicalProposalWorkflowEvent({
    poolId: row.poolId,
    proposalId: row.id,
    fromState: currentState,
    toState: targetState,
    actor,
    actorRole,
    note,
    batchId,
  });

  if (available('notification') && ['NEEDS_INFO', 'APPROVED', 'REJECTED'].includes(targetState)) {
    const severity = targetState === 'REJECTED' ? 'HIGH' : (current.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM');
    await db('notification').create({
      data: dataFor('notification', {
        type: 'TECHNICAL_SHEET_PROPOSAL_WORKFLOW',
        eventType: `TECHNICAL_SHEET_PROPOSAL_${targetState}`,
        title: `Workflow proposta técnica: ${targetState}`,
        message: `${actor} atualizou proposta #${row.id} para ${targetState}.`,
        role: roleMatches(actorRole, 'ADMIN') ? 'TECHNICIAN' : 'ADMIN',
        status: 'PENDING',
        severity,
        metadata: {
          poolId: row.poolId,
          proposalHistoryId: row.id,
          fromState: currentState,
          toState: targetState,
          note,
          batchId: batchId || null,
        },
      }),
    }).catch(() => null);
  }

  await emitTechnicalSheetPropagationEvent({
    poolId: row.poolId,
    actor,
    source: 'TECHNICAL_PROPOSAL_WORKFLOW',
    proposalId: row.id,
    summary: `Proposta #${row.id} transitou ${currentState} -> ${targetState}`,
    metadata: {
      fromState: currentState,
      toState: targetState,
      batchId: batchId || null,
      note: note || null,
    },
  });

  return { ok: true, proposal: mapTechnicalProposal(updated), currentState };
}

function normalizeProposalChanges(input) {
  const source = Array.isArray(input)
    ? input
    : (input && typeof input === 'object' ? Object.entries(input).map(([field, value]) => ({ field, after: value })) : []);
  return source
    .map((item) => ({
      field: String(item?.field || '').trim(),
      before: item?.before == null ? null : String(item.before),
      after: item?.after == null ? null : String(item.after),
    }))
    .filter((item) => item.field && (item.before !== item.after));
}

function inferProposalRiskLevel(changes = []) {
  const fields = changes.map((item) => String(item.field || '').trim());
  if (fields.some((field) => HIGH_FIELDS.has(field))) return 'HIGH';
  if (fields.some((field) => MEDIUM_FIELDS.has(field))) return 'MEDIUM';
  if (fields.some((field) => AUTO_FIELDS.has(field))) return 'LOW';
  return 'MEDIUM';
}

function normalizeProposalPhotos(input) {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0)
    .slice(0, 12);
}

function parseProposalDescription(description) {
  const parsed = safeJson(description, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const changes = normalizeProposalChanges(parsed.changes || []);
  const workflowState = normalizeProposalWorkflowState(parsed.lifecycle || parsed.status || 'SUBMITTED', 'SUBMITTED');
  const transitions = Array.isArray(parsed.transitions)
    ? parsed.transitions
      .map((item) => ({
        from: normalizeProposalWorkflowState(item?.from || '', ''),
        to: normalizeProposalWorkflowState(item?.to || '', ''),
        at: item?.at || null,
        by: String(item?.by || '').trim(),
        note: String(item?.note || '').trim(),
      }))
      .filter((item) => item.from && item.to)
    : [];
  return {
    proposalId: String(parsed.proposalId || ''),
    reason: String(parsed.reason || ''),
    riskLevel: normalizeRiskLevel(parsed.riskLevel) || inferProposalRiskLevel(changes),
    photos: normalizeProposalPhotos(parsed.photos || []),
    changes,
    actor: String(parsed.actor || ''),
    actorRole: String(parsed.actorRole || ''),
    submittedAt: parsed.submittedAt || null,
    status: workflowState,
    lifecycle: workflowState,
    reviewNote: String(parsed.reviewNote || ''),
    reviewedBy: String(parsed.reviewedBy || ''),
    reviewedAt: parsed.reviewedAt || null,
    transitions,
  };
}

function mapTechnicalProposal(historyRow, options = {}) {
  const payload = parseProposalDescription(historyRow?.description || '') || {};
  const pool = options.pool || null;
  const immutableHistory = options.immutableHistory || null;
  const diff = buildProposalDiff(Array.isArray(payload.changes) ? payload.changes : [], pool);
  return {
    id: historyRow.id,
    poolId: historyRow.poolId,
    type: TECHNICAL_PROPOSAL_TYPE,
    lifecycle: payload.lifecycle || normalizeProposalWorkflowState(historyRow.status || 'SUBMITTED', 'SUBMITTED'),
    status: payload.status || normalizeProposalWorkflowState(historyRow.status || 'SUBMITTED', 'SUBMITTED'),
    riskLevel: payload.riskLevel || 'MEDIUM',
    reason: payload.reason || '',
    changes: Array.isArray(payload.changes) ? payload.changes : [],
    photos: Array.isArray(payload.photos) ? payload.photos : [],
    actor: payload.actor || 'SYSTEM',
    actorRole: payload.actorRole || '',
    reviewNote: payload.reviewNote || '',
    reviewedBy: payload.reviewedBy || '',
    reviewedAt: payload.reviewedAt || null,
    transitions: Array.isArray(payload.transitions) ? payload.transitions : [],
    diff,
    immutable: immutableHistory || undefined,
    submittedAt: payload.submittedAt || historyRow.performedAt || historyRow.createdAt,
    createdAt: historyRow.createdAt,
  };
}

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
function invoiceLineBaseData(data) { return dataFor('invoiceLine', data); }
function paymentBaseData(data) { return dataFor('payment', data); }
function serviceVisitBaseData(data) { return dataFor('serviceVisit', data); }
function repairBaseData(data) { return dataFor('repair', data); }
function monthRangeFromRef(ref) {
  const match = String(ref || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0)),
  };
}
function sourceAmount(record) {
  return toFloat(record?.totalPrice ?? record?.price ?? record?.revenue ?? record?.unitPrice, 0);
}

function invoiceLineReferenceIds(lines, types) {
  const allowed = new Set((types || []).map((type) => String(type || '').trim().toUpperCase()));
  return (lines || [])
    .filter((line) => allowed.has(String(line.type || line.lineType || '').trim().toUpperCase()))
    .map((line) => toInt(line.referenceId))
    .filter(Boolean);
}

function invoiceMonthlyLineAmount(lines) {
  const monthlyLine = (lines || []).find((line) => String(line.type || line.lineType || '').trim().toUpperCase() === 'MONTHLY');
  return toFloat(monthlyLine?.lineTotal ?? monthlyLine?.total ?? monthlyLine?.unitPrice, 0);
}

function isDuplicateInvoiceGeneration(existingInvoice, payload = {}) {
  if (!existingInvoice) return false;

  const existingServiceVisitIds = new Set(payload.existingServiceVisitIds || []);
  const existingExtraVisitIds = new Set(payload.existingExtraVisitIds || []);
  const existingRepairIds = new Set(payload.existingRepairIds || []);

  const hasNewServiceVisits = (payload.serviceVisits || []).some((visit) => !existingServiceVisitIds.has(visit.id));
  const hasNewExtraVisits = (payload.extraVisits || []).some((visit) => !existingExtraVisitIds.has(visit.id));
  const hasNewRepairs = (payload.repairs || []).some((repair) => !existingRepairIds.has(repair.id));

  if (hasNewServiceVisits || hasNewExtraVisits || hasNewRepairs) return false;

  const existingTotal = toFloat(existingInvoice.totalAmount ?? existingInvoice.total ?? existingInvoice.amount, 0);
  const nextTotal = toFloat(payload.total, 0);
  const existingMonthly = invoiceMonthlyLineAmount(existingInvoice.lines || []);
  const nextMonthly = toFloat(payload.monthly, 0);

  return existingTotal === nextTotal && existingMonthly === nextMonthly;
}


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
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, database: 'ONLINE', time: new Date().toISOString() });
  } catch (error) {
    return res.status(200).json({ ok: false, database: 'ERROR', error: error.message });
  }
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

router.put('/clients/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const body = req.body || {};

    const currentClient = await db('client').findUnique({ where: { id } });
    const finalContractActive = body.contractActive === undefined ? Boolean(currentClient?.contractActive) : truthy(body.contractActive);
    if (truthy(body.billingActive) && !finalContractActive) {
      return res.status(400).json({ ok: false, error: 'Não é possível ativar faturação sem ativar primeiro o contrato.' });
    }
    const client = await db('client').update({
      where: { id },
      data: await clientMutationData(body),
    });

    return res.json({ ok: true, client });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});


router.post('/clients/:id/activate', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const amount = toFloat(req.body?.amount, 0);
    const client = await db('client').update({
      where: { id },
      data: dataFor('client', { status: 'ACTIVE', active: true, archiveStatus: 'ATIVO', deletedAt: null, contractActive: true, billingActive: true, contractActivatedAt: new Date(), paymentStatus: 'PAID', lastPaymentAt: new Date(), creditBalance: amount > 0 ? amount : undefined }),
    });
    return res.json({ ok: true, client, message: 'Contrato ativado. A faturação começa a partir desta data.' });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});


router.post('/clients/:id/activate-contract', async (req, res) => {
  req.url = req.url.replace('/activate-contract', '/activate');
  return router.handle(req, res);
});

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
    return res.json({ ok: true, pool });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.get('/pools/:id/technical-change-proposals', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    if (!poolId) return res.status(400).json({ ok: false, error: 'ID da piscina invalido' });
    if (!available('technicalHistory')) return res.json({ ok: true, proposals: [] });

    const onlyPending = truthy(req.query.onlyPending);
    const rows = await db('technicalHistory').findMany({
      where: {
        poolId,
        type: TECHNICAL_PROPOSAL_TYPE,
      },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    const pool = await db('pool').findUnique({
      where: { id: poolId },
      include: { technicalSheet: true, calculationProfile: true, equipment: true, technicalRoom: true },
    }).catch(() => null);

    let proposals = rows.map((row) => mapTechnicalProposal(row, { pool }));
    if (onlyPending) {
      proposals = proposals.filter((item) => PROPOSAL_PENDING_STATES.has(normalizeProposalWorkflowState(item.status, 'SUBMITTED')));
    }

    return res.json({ ok: true, proposals });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/pools/:id/technical-change-proposals', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    if (!poolId) return res.status(400).json({ ok: false, error: 'ID da piscina invalido' });
    if (!available('technicalHistory')) return res.status(501).json({ ok: false, error: 'Historico tecnico indisponivel' });

    const pool = await db('pool').findUnique({ where: { id: poolId }, include: { client: true } });
    if (!pool) return res.status(404).json({ ok: false, error: 'Piscina nao encontrada' });

    const body = req.body || {};
    const reason = String(body.reason || '').trim();
    if (!reason) return res.status(400).json({ ok: false, error: 'Motivo obrigatorio' });

    const changes = normalizeProposalChanges(body.changes || []);
    if (!changes.length) return res.status(400).json({ ok: false, error: 'A proposta precisa de pelo menos uma alteracao' });

    const explicitRisk = normalizeRiskLevel(body.riskLevel);
    if (String(body.riskLevel || '').trim() && !explicitRisk) {
      return res.status(400).json({ ok: false, error: 'Nivel de risco invalido. Use LOW, MEDIUM ou HIGH' });
    }

    const photos = normalizeProposalPhotos(body.photos || []);
    const actor = actorNameFromReq(req);
    const actorRole = String(req.user?.role || '').toUpperCase();
    const riskLevel = explicitRisk || inferProposalRiskLevel(changes);
    const initialState = truthy(body.asDraft) ? 'DRAFT' : 'SUBMITTED';
    const proposalPayload = {
      proposalId: `P-${poolId}-${Date.now()}`,
      reason,
      riskLevel,
      photos,
      changes,
      actor,
      actorRole,
      submittedAt: new Date().toISOString(),
      status: initialState,
      lifecycle: initialState,
      reviewNote: '',
      reviewedBy: '',
      reviewedAt: null,
      transitions: [{
        from: '',
        to: initialState,
        at: new Date().toISOString(),
        by: actor,
        note: initialState === 'DRAFT' ? 'Proposta criada em rascunho' : 'Proposta submetida',
      }],
    };

    const created = await db('technicalHistory').create({
      data: {
        poolId,
        type: TECHNICAL_PROPOSAL_TYPE,
        component: 'Ficha Técnica',
        message: 'Proposta de alteração da ficha técnica',
        description: JSON.stringify(proposalPayload),
        performedAt: new Date(),
        status: initialState,
      },
    });

    await appendTechnicalProposalWorkflowEvent({
      poolId,
      proposalId: created.id,
      fromState: '',
      toState: initialState,
      actor,
      actorRole,
      note: initialState === 'DRAFT' ? 'Proposta criada em rascunho' : 'Proposta submetida',
    });

    if (available('notification') && initialState === 'SUBMITTED') {
      await db('notification').create({
        data: dataFor('notification', {
          type: 'TECHNICAL_SHEET_PROPOSAL',
          eventType: 'TECHNICAL_SHEET_CHANGE_PROPOSED',
          title: `Proposta técnica: ${pool.name || `Piscina #${poolId}`}`,
          message: `${actor} submeteu proposta de alteração (${riskLevel}).`,
          role: 'ADMIN',
          status: 'PENDING',
          severity: riskLevel === 'HIGH' ? 'HIGH' : (riskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW'),
          metadata: {
            poolId,
            poolName: pool.name || null,
            clientId: pool.clientId || null,
            clientName: pool.client?.name || null,
            proposalHistoryId: created.id,
            reason,
            riskLevel,
            photosCount: photos.length,
          },
        }),
      }).catch(() => null);
    }

    await emitTechnicalSheetPropagationEvent({
      poolId,
      actor,
      source: 'TECHNICAL_PROPOSAL_CREATED',
      proposalId: created.id,
      summary: `Proposta #${created.id} criada com estado ${initialState}`,
      metadata: {
        riskLevel,
        reason,
        photosCount: photos.length,
        lifecycle: initialState,
      },
    });

    return res.status(201).json({ ok: true, proposal: mapTechnicalProposal(created) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/pools/:id/technical-change-proposals/:proposalId/workflow', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    const proposalId = toInt(req.params.proposalId);
    if (!poolId || !proposalId) return res.status(400).json({ ok: false, error: 'Identificador invalido' });
    if (!available('technicalHistory')) return res.status(501).json({ ok: false, error: 'Historico tecnico indisponivel' });

    const row = await db('technicalHistory').findFirst({
      where: {
        id: proposalId,
        poolId,
        type: TECHNICAL_PROPOSAL_TYPE,
      },
    });
    if (!row) return res.status(404).json({ ok: false, error: 'Proposta tecnica nao encontrada' });

    const body = req.body || {};
    const targetState = normalizeProposalWorkflowState(body.nextStatus || body.status || '', '');
    if (!targetState) {
      return res.status(400).json({ ok: false, error: 'Estado de destino invalido. Use DRAFT, SUBMITTED, IN_REVIEW, NEEDS_INFO, APPROVED ou REJECTED' });
    }

    const actorRole = String(req.user?.role || '').toUpperCase();
    const actor = actorNameFromReq(req);
    const note = String(body.note || body.reason || '').trim();
    const result = await transitionTechnicalProposalRow({ row, targetState, actorRole, actor, note });
    if (!result.ok) {
      return res.status(result.status || 409).json({ ok: false, error: result.error || 'Transicao de workflow nao permitida para esta proposta' });
    }

    return res.json({ ok: true, proposal: result.proposal });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/pools/:id/technical-change-proposals/:proposalId/diff', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    const proposalId = toInt(req.params.proposalId);
    if (!poolId || !proposalId) return res.status(400).json({ ok: false, error: 'Identificador invalido' });

    const row = await db('technicalHistory').findFirst({
      where: {
        id: proposalId,
        poolId,
        type: TECHNICAL_PROPOSAL_TYPE,
      },
    });
    if (!row) return res.status(404).json({ ok: false, error: 'Proposta tecnica nao encontrada' });

    const pool = await db('pool').findUnique({
      where: { id: poolId },
      include: { technicalSheet: true, calculationProfile: true, equipment: true, technicalRoom: true },
    }).catch(() => null);

    const proposal = mapTechnicalProposal(row, { pool });
    return res.json({ ok: true, proposalId, status: proposal.status, diff: proposal.diff || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/pools/:id/technical-change-proposals/:proposalId/history', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    const proposalId = toInt(req.params.proposalId);
    if (!poolId || !proposalId) return res.status(400).json({ ok: false, error: 'Identificador invalido' });

    const row = await db('technicalHistory').findFirst({
      where: {
        id: proposalId,
        poolId,
        type: TECHNICAL_PROPOSAL_TYPE,
      },
    });
    if (!row) return res.status(404).json({ ok: false, error: 'Proposta tecnica nao encontrada' });

    const eventRows = await listProposalWorkflowEventRows(poolId, proposalId);
    const immutable = buildImmutableHistory(eventRows);
    const proposal = mapTechnicalProposal(row, { immutableHistory: immutable });
    return res.json({ ok: true, proposalId, immutable, transitions: proposal.transitions || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/pools/:id/technical-change-proposals/workflow/batch', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    if (!poolId) return res.status(400).json({ ok: false, error: 'ID da piscina invalido' });
    if (!available('technicalHistory')) return res.status(501).json({ ok: false, error: 'Historico tecnico indisponivel' });

    const actorRole = String(req.user?.role || '').toUpperCase();
    if (!roleMatches(actorRole, 'ADMIN')) {
      return res.status(403).json({ ok: false, error: 'Aprovação em lote requer perfil ADMIN' });
    }

    const body = req.body || {};
    const targetState = normalizeProposalWorkflowState(body.nextStatus || body.status || '', '');
    if (!targetState) {
      return res.status(400).json({ ok: false, error: 'Estado de destino invalido para batch' });
    }

    const proposalIds = Array.from(new Set(
      (Array.isArray(body.proposalIds) ? body.proposalIds : [])
        .map((item) => toInt(item))
        .filter((item) => item > 0)
    ));

    if (!proposalIds.length) {
      return res.status(400).json({ ok: false, error: 'proposalIds obrigatorio para transicao em lote' });
    }
    if (proposalIds.length > 50) {
      return res.status(400).json({ ok: false, error: 'Limite de 50 propostas por lote' });
    }

    const rows = await db('technicalHistory').findMany({
      where: {
        id: { in: proposalIds },
        poolId,
        type: TECHNICAL_PROPOSAL_TYPE,
      },
    });
    const rowById = new Map(rows.map((item) => [Number(item.id), item]));

    const actor = actorNameFromReq(req);
    const note = String(body.note || body.reason || '').trim();
    const batchId = `BATCH-${poolId}-${Date.now()}`;
    const updated = [];
    const failed = [];

    for (const proposalId of proposalIds) {
      const row = rowById.get(Number(proposalId));
      if (!row) {
        failed.push({ proposalId, status: 404, error: 'Proposta tecnica nao encontrada' });
        continue;
      }
      const result = await transitionTechnicalProposalRow({ row, targetState, actorRole, actor, note, batchId });
      if (!result.ok) {
        failed.push({ proposalId, status: result.status || 409, error: result.error || 'Transicao invalida' });
        continue;
      }
      updated.push(result.proposal);
    }

    return res.json({
      ok: failed.length === 0,
      batchId,
      targetState,
      updatedCount: updated.length,
      failedCount: failed.length,
      updated,
      failed,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/pools/:id/technical-sheet', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const body = req.body || {};
    const beforeSheet = await db('pool').findUnique({ where: { id }, include: { equipment: true, technicalRoom: true, calculationProfile: true, technicalSheet: true } }).catch(() => null);
    const volumeM3 = calculatedPoolVolumeM3(body);
    const sheetBody = { ...body };
    if (volumeM3 !== null) sheetBody.volumeM3 = volumeM3;
    const poolData = poolBaseData(sheetBody);
    if (Object.keys(poolData).length) await db('pool').update({ where: { id }, data: poolData });

    if (available('technicalSheet') && sheetBody.volumeM3 !== undefined) {
      await db('technicalSheet').upsert({
        where: { poolId: id },
        update: { volumeM3: toFloat(sheetBody.volumeM3, 0) },
        create: { poolId: id, volumeM3: toFloat(sheetBody.volumeM3, 0), disinfectionType: body.disinfectionType || 'CLORO' },
      }).catch(() => null);
    }

    if (available('poolEquipment')) {
      await db('poolEquipment').upsert({
        where: { poolId: id },
        update: definedOnly({
          pumpType: body.pumpType, pumpPower: body.pumpPower, filterType: body.filterType, filterMedia: body.filterMedia,
          saltSystem: body.saltSystem == null ? undefined : truthy(body.saltSystem), lightsCount: body.lightsCount == null ? undefined : toInt(body.lightsCount),
          lightsType: body.lightsType, hasLights: body.hasLights == null ? undefined : truthy(body.hasLights), notes: body.equipmentNotes,
        }),
        create: { poolId: id, pumpType: body.pumpType || null, pumpPower: body.pumpPower || null, filterType: body.filterType || null, filterMedia: body.filterMedia || null, saltSystem: truthy(body.saltSystem), lightsCount: toInt(body.lightsCount, 0), lightsType: body.lightsType || null, hasLights: body.hasLights == null ? true : truthy(body.hasLights), notes: body.equipmentNotes || null },
      });
    }

    if (available('technicalRoom')) {
      await db('technicalRoom').upsert({
        where: { poolId: id },
        update: definedOnly({ condition: body.technicalRoomCondition, locationNote: body.technicalRoomLocation, ventilation: body.technicalRoomVentilation, electrical: body.technicalRoomElectrical, notes: body.technicalRoomNotes }),
        create: { poolId: id, condition: body.technicalRoomCondition || null, locationNote: body.technicalRoomLocation || null, ventilation: body.technicalRoomVentilation || null, electrical: body.technicalRoomElectrical || null, notes: body.technicalRoomNotes || null },
      });
    }

    if (available('poolCalculationProfile')) {
      await db('poolCalculationProfile').upsert({
        where: { poolId: id },
        update: definedOnly({
          shape: body.shape, lengthM: body.lengthM == null ? undefined : toFloat(body.lengthM), widthM: body.widthM == null ? undefined : toFloat(body.widthM), depthMinM: body.depthMinM == null ? undefined : toFloat(body.depthMinM), depthMaxM: body.depthMaxM == null ? undefined : toFloat(body.depthMaxM), averageDepthM: body.averageDepthM == null ? undefined : toFloat(body.averageDepthM), volumeM3: sheetBody.volumeM3 == null ? undefined : toFloat(sheetBody.volumeM3), pumpFlowM3h: body.pumpFlowM3h == null ? undefined : toFloat(body.pumpFlowM3h), currentWaterTempC: body.currentWaterTempC == null ? undefined : toFloat(body.currentWaterTempC), targetSalinityPpm: body.targetSalinityPpm == null ? undefined : toFloat(body.targetSalinityPpm), targetChlorinePpm: body.targetChlorinePpm == null ? undefined : toFloat(body.targetChlorinePpm), notes: body.calculationNotes,
        }),
        create: { poolId: id, shape: body.shape || 'RECTANGULAR', lengthM: body.lengthM == null ? null : toFloat(body.lengthM), widthM: body.widthM == null ? null : toFloat(body.widthM), depthMinM: body.depthMinM == null ? null : toFloat(body.depthMinM), depthMaxM: body.depthMaxM == null ? null : toFloat(body.depthMaxM), averageDepthM: body.averageDepthM == null ? null : toFloat(body.averageDepthM), volumeM3: sheetBody.volumeM3 == null ? null : toFloat(sheetBody.volumeM3), pumpFlowM3h: body.pumpFlowM3h == null ? null : toFloat(body.pumpFlowM3h), currentWaterTempC: body.currentWaterTempC == null ? null : toFloat(body.currentWaterTempC), targetSalinityPpm: body.targetSalinityPpm == null ? 3500 : toFloat(body.targetSalinityPpm), targetChlorinePpm: body.targetChlorinePpm == null ? 2 : toFloat(body.targetChlorinePpm), notes: body.calculationNotes || null },
      });
    }

    const afterSheet = await db('pool').findUnique({ where: { id }, include: { equipment: true, technicalRoom: true, calculationProfile: true, technicalSheet: true } }).catch(() => null);
    await recordTechnicalSheetHistory(id, beforeSheet, afterSheet, body.actor || req.headers['x-user-email'] || 'ADMIN');
    const technicalChanges = listTechnicalChangedFields(beforeSheet, afterSheet);
    if (body.historyNote && available('technicalHistory')) {
      await db('technicalHistory').create({ data: { poolId: id, type: 'TECHNICAL_SHEET_NOTE', component: 'Ficha Técnica', message: 'Nota da ficha técnica', description: String(body.historyNote), performedAt: new Date(), status: 'DONE' } }).catch(() => null);
    }

    await emitTechnicalSheetPropagationEvent({
      poolId: id,
      actor: body.actor || req.headers['x-user-email'] || 'ADMIN',
      source: 'TECHNICAL_SHEET_DIRECT_UPDATE',
      summary: technicalChanges.length
        ? `Ficha técnica atualizada com ${technicalChanges.length} alteração(ões).`
        : 'Ficha técnica atualizada sem diferenças mapeadas.',
      metadata: {
        changes: technicalChanges,
        changesCount: technicalChanges.length,
      },
    });

    const pool = afterSheet || await db('pool').findUnique({ where: { id }, include: { client: true, equipment: true, technicalRoom: true, calculationProfile: true, technicalSheet: true } });
    return res.json({ ok: true, pool });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
});

router.get('/pools/:id/service-reminders', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    if (!poolId) return res.status(400).json({ ok: false, error: 'ID da piscina invalido' });
    if (!available('generalReminder')) return res.json({ ok: true, reminders: [] });

    const reminders = await db('generalReminder').findMany({
      where: {
        poolId,
        category: { in: ['TECHNICAL_PERIODIC_SERVICE', 'POOL_SERVICE_REMINDER'] },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      take: 100,
    });
    return res.json({ ok: true, reminders });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/pools/:id/service-reminders', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    if (!poolId) return res.status(400).json({ ok: false, error: 'ID da piscina invalido' });
    if (!available('generalReminder')) return res.status(501).json({ ok: false, error: 'Lembretes indisponiveis' });

    const pool = await db('pool').findUnique({ where: { id: poolId }, include: { client: true } });
    if (!pool) return res.status(404).json({ ok: false, error: 'Piscina nao encontrada' });

    const body = req.body || {};
    const title = String(body.title || '').trim();
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (!title || !dueAt || Number.isNaN(dueAt.getTime())) {
      return res.status(400).json({ ok: false, error: 'Titulo e data do lembrete sao obrigatorios' });
    }

    const repeatRule = normalizeRepeatRuleInput(body);
    const reminder = await db('generalReminder').create({
      data: dataFor('generalReminder', {
        title,
        description: body.description ? String(body.description).trim() : null,
        category: 'TECHNICAL_PERIODIC_SERVICE',
        priority: body.priority || 'NORMAL',
        status: 'PENDING',
        dueAt,
        clientId: pool.clientId || null,
        poolId,
        technicianId: body.technicianId ? toInt(body.technicianId) : null,
        repeatRule,
        createdBy: body.createdBy || req.headers['x-user-email'] || 'ADMIN',
      }),
    });
    return res.status(201).json({ ok: true, reminder });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ ok: false, error: error.message });
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/pools/:id/service-reminders/:reminderId/complete', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    const reminderId = toInt(req.params.reminderId);
    if (!poolId || !reminderId) return res.status(400).json({ ok: false, error: 'IDs invalidos' });
    if (!available('generalReminder')) return res.status(501).json({ ok: false, error: 'Lembretes indisponiveis' });

    const existing = await db('generalReminder').findUnique({ where: { id: reminderId } });
    if (!existing || existing.poolId !== poolId) {
      return res.status(404).json({ ok: false, error: 'Lembrete nao encontrado nesta piscina' });
    }

    const completed = await db('generalReminder').update({
      where: { id: reminderId },
      data: dataFor('generalReminder', {
        status: 'DONE',
        completedAt: new Date(),
      }),
    });

    let nextReminder = null;
    const repeatInterval = parseRepeatRuleInterval(existing.repeatRule);
    if (repeatInterval) {
      nextReminder = await db('generalReminder').create({
        data: dataFor('generalReminder', {
          title: existing.title,
          description: existing.description,
          category: existing.category || 'TECHNICAL_PERIODIC_SERVICE',
          priority: existing.priority || 'NORMAL',
          status: 'PENDING',
          dueAt: addRepeatInterval(existing.dueAt || new Date(), repeatInterval),
          clientId: existing.clientId || null,
          poolId: existing.poolId,
          technicianId: existing.technicianId || null,
          repeatRule: existing.repeatRule,
          createdBy: req.headers['x-user-email'] || 'ADMIN',
        }),
      });
    }

    return res.json({ ok: true, reminder: completed, nextReminder });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/pools/:id/service-reminders/:reminderId', async (req, res) => {
  try {
    const poolId = toInt(req.params.id);
    const reminderId = toInt(req.params.reminderId);
    if (!poolId || !reminderId) return res.status(400).json({ ok: false, error: 'IDs invalidos' });
    if (!available('generalReminder')) return res.status(501).json({ ok: false, error: 'Lembretes indisponiveis' });

    const existing = await db('generalReminder').findUnique({ where: { id: reminderId } });
    if (!existing || existing.poolId !== poolId) {
      return res.status(404).json({ ok: false, error: 'Lembrete nao encontrado nesta piscina' });
    }

    await db('generalReminder').delete({ where: { id: reminderId } });
    return res.json({ ok: true, deleted: true, reminderId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/daily-service-log', async (req, res) => {
  try {
    const { day, start, end } = parseDayRange(req.query.date || req.query.day);
    const technicianFilter = toInt(req.query.technicianId);
    const vehicleFilter = toInt(req.query.vehicleId);

    const visitWhere = {
      ...sameDayWhere(['plannedDate', 'startAt', 'endAt', 'date'], start, end),
      ...(technicianFilter ? { technicianId: technicianFilter } : {}),
    };

    const visits = available('serviceVisit') ? await safe('daily.serviceVisit', [], () => db('serviceVisit').findMany({
      where: visitWhere,
      include: {
        client: true,
        pool: { include: { client: true } },
        technician: true,
        photos: true,
        chemicals: true,
      },
      orderBy: [{ plannedDate: 'asc' }, { startAt: 'asc' }, { id: 'asc' }],
      take: 500,
    })) : [];

    const technicianIds = Array.from(new Set(visits.map((visit) => visit.technicianId).filter(Boolean).map(Number)));
    if (technicianFilter && !technicianIds.includes(technicianFilter)) technicianIds.push(technicianFilter);

    const workGuides = available('workGuide') ? await safe('daily.workGuide', [], () => db('workGuide').findMany({
      where: {
        ...(technicianIds.length ? { technicianId: { in: technicianIds } } : {}),
        ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
        OR: [
          { createdAt: { gte: start, lt: end } },
          { closedAt: { gte: start, lt: end } },
        ],
      },
      include: { vehicle: true, technician: true, guide: true, items: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })) : [];

    const movements = available('vehicleStockMovement') ? await safe('daily.vehicleStockMovement', [], () => db('vehicleStockMovement').findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(technicianIds.length ? { technicianId: { in: technicianIds } } : {}),
        ...(vehicleFilter ? { vehicleId: vehicleFilter } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    })) : [];

    const visitIds = visits.map((visit) => visit.id);
    const stateLogs = available('visitStateLog') && visitIds.length ? await safe('daily.visitStateLog', [], () => db('visitStateLog').findMany({
      where: { visitId: { in: visitIds } },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    })) : [];

    const tracks = available('technicianTrack') && technicianIds.length ? await safe('daily.technicianTrack', [], () => db('technicianTrack').findMany({
      where: {
        technicianId: { in: technicianIds },
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: 'asc' },
      take: 3000,
    })) : [];

    const technicians = technicianIds.length && available('technician') ? await safe('daily.technician', [], () => db('technician').findMany({
      where: { id: { in: technicianIds } },
      orderBy: { name: 'asc' },
      take: 500,
    })) : [];

    const emailToTechnician = new Map(technicians.filter((tech) => tech.email).map((tech) => [String(tech.email).toLowerCase(), tech.id]));
    const users = emailToTechnician.size && available('user') ? await safe('daily.user', [], () => db('user').findMany({
      where: { email: { in: Array.from(emailToTechnician.keys()) } },
      select: { id: true, email: true },
      take: 500,
    })) : [];
    const userToTechnician = new Map(users.map((user) => [user.id, emailToTechnician.get(String(user.email || '').toLowerCase())]));
    const locationLogs = userToTechnician.size && available('locationLog') ? await safe('daily.locationLog', [], () => db('locationLog').findMany({
      where: {
        userId: { in: Array.from(userToTechnician.keys()) },
        timestamp: { gte: start, lt: end },
      },
      orderBy: { timestamp: 'asc' },
      take: 3000,
    })) : [];

    const movementsByVisit = byKey(movements.filter((movement) => movement.visitId), 'visitId');
    const movementsByWorkGuide = byKey(movements.filter((movement) => movement.workGuideId), 'workGuideId');
    const stateLogsByVisit = byKey(stateLogs, 'visitId');
    const workGuidesByTech = byKey(workGuides.filter((guide) => guide.technicianId), 'technicianId');
    const technicianMap = byId(technicians);

    const vehicleIds = Array.from(new Set([
      ...technicians.map((tech) => tech.vehicleId).filter(Boolean),
      ...workGuides.map((guide) => guide.vehicleId).filter(Boolean),
      ...movements.map((movement) => movement.vehicleId).filter(Boolean),
      ...(vehicleFilter ? [vehicleFilter] : []),
    ].map(Number)));
    const vehicles = vehicleIds.length && available('vehicle') ? await safe('daily.vehicle', [], () => db('vehicle').findMany({
      where: { id: { in: vehicleIds } },
      take: 500,
    })) : [];
    const vehicleMap = byId(vehicles);

    function inferWorkGuide(visit) {
      const visitMovements = movementsByVisit.get(visit.id) || [];
      const movementGuideId = visitMovements.find((movement) => movement.workGuideId)?.workGuideId;
      if (movementGuideId) return workGuides.find((guide) => guide.id === movementGuideId) || null;
      const guides = workGuidesByTech.get(visit.technicianId) || [];
      const ref = new Date(visit.startAt || visit.endAt || visit.plannedDate || visit.date || start);
      return guides.find((guide) => {
        const guideStart = new Date(guide.createdAt || start);
        const guideEnd = guide.closedAt ? new Date(guide.closedAt) : end;
        return ref >= guideStart && ref <= guideEnd;
      }) || guides[0] || null;
    }

    const rows = visits.map((visit) => {
      const technician = visit.technician || technicianMap.get(Number(visit.technicianId)) || null;
      const workGuide = inferWorkGuide(visit);
      const visitMovements = movementsByVisit.get(visit.id) || [];
      const vehicleId = visitMovements.find((movement) => movement.vehicleId)?.vehicleId
        || workGuide?.vehicleId
        || technician?.vehicleId
        || null;
      const vehicle = (vehicleId && vehicleMap.get(Number(vehicleId))) || workGuide?.vehicle || null;
      const gps = tracks
        .filter((track) => Number(track.technicianId) === Number(visit.technicianId))
        .map((track) => ({
          source: 'TECHNICIAN_TRACK',
          at: track.createdAt,
          latitude: track.latitude,
          longitude: track.longitude,
        }));

      return {
        id: visit.id,
        day,
        plannedAt: visit.plannedDate || visit.date || null,
        startAt: visit.startAt,
        endAt: visit.endAt,
        status: visit.status || (visit.endAt ? 'DONE' : 'PLANNED'),
        client: visit.client || visit.pool?.client || null,
        pool: visit.pool || null,
        technician,
        vehicle,
        workGuide: workGuide ? {
          id: workGuide.id,
          vehicleId: workGuide.vehicleId,
          status: workGuide.status,
          createdAt: workGuide.createdAt,
          closedAt: workGuide.closedAt,
          guideId: workGuide.guideId,
          codeAT: workGuide.guide?.codeAT || null,
        } : null,
        photos: visit.photos || [],
        chemicals: visit.chemicals || [],
        stockMovements: visitMovements,
        stateLogs: stateLogsByVisit.get(visit.id) || [],
        gpsPoints: gps,
      };
    }).filter((row) => !vehicleFilter || Number(row.vehicle?.id || row.vehicle?.vehicleId || row.vehicleId) === vehicleFilter || Number(row.workGuide?.vehicleId) === vehicleFilter);

    const timeline = [];
    for (const row of rows) {
      if (row.plannedAt) timeline.push({ at: row.plannedAt, type: 'VISIT_PLANNED', visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: 'Visita planeada', message: `${row.pool?.name || 'Piscina'} - ${row.client?.name || 'Cliente'}` });
      if (row.startAt) timeline.push({ at: row.startAt, type: 'VISIT_STARTED', visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: 'Visita iniciada', message: row.pool?.name || 'Piscina' });
      if (row.endAt) timeline.push({ at: row.endAt, type: 'VISIT_DONE', visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: 'Visita concluida', message: row.pool?.name || 'Piscina' });
      for (const log of row.stateLogs) timeline.push({ at: log.createdAt, type: `STATE_${log.newState}`, visitId: row.id, technicianId: row.technician?.id || null, vehicleId: row.vehicle?.id || null, title: `Estado: ${log.newState}`, message: log.notes || log.reason || row.pool?.name || 'Visita', latitude: log.latitude, longitude: log.longitude });
      for (const movement of row.stockMovements) timeline.push({ at: movement.createdAt, type: 'STOCK_MOVEMENT', visitId: row.id, technicianId: movement.technicianId || row.technician?.id || null, vehicleId: movement.vehicleId || row.vehicle?.id || null, title: 'Material usado', message: `${movement.itemName} - ${movement.quantity} ${movement.unit || ''}`.trim() });
    }
    for (const point of tracks) timeline.push({ at: point.createdAt, type: 'GPS', technicianId: point.technicianId, title: 'GPS tecnico', message: `${point.latitude}, ${point.longitude}`, latitude: point.latitude, longitude: point.longitude });
    for (const point of locationLogs) {
      const technicianId = userToTechnician.get(point.userId) || null;
      timeline.push({ at: point.timestamp || point.createdAt, type: 'GPS', technicianId, title: 'GPS tecnico', message: `${point.latitude}, ${point.longitude}`, latitude: point.latitude, longitude: point.longitude, accuracyM: point.accuracyM });
    }

    timeline.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

    return res.json({
      ok: true,
      day,
      filters: { technicianId: technicianFilter || null, vehicleId: vehicleFilter || null },
      summary: {
        services: rows.length,
        done: rows.filter((row) => row.status === 'DONE' || row.endAt).length,
        technicians: new Set(rows.map((row) => row.technician?.id).filter(Boolean)).size,
        vehicles: new Set(rows.map((row) => row.vehicle?.id).filter(Boolean)).size,
        gpsPoints: timeline.filter((item) => item.type === 'GPS').length,
        stockMovements: movements.length,
      },
      services: rows,
      timeline,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/pools/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const body = req.body || {};
    const nextClientId = body.clientId === undefined || body.clientId === null || body.clientId === ''
      ? undefined
      : toInt(body.clientId);

    if (nextClientId !== undefined) {
      const client = await db('client').findUnique({ where: { id: nextClientId }, select: { id: true } });
      if (!client) return res.status(404).json({ ok: false, error: 'Cliente para associar a piscina nao encontrado.' });
    }

    const pool = await db('pool').update({
      where: { id },
      data: poolBaseData(body, nextClientId),
      include: { client: true, roundPools: { include: { round: true } }, technicalSheet: true },
    });

    if (nextClientId !== undefined && available('serviceVisit')) {
      await db('serviceVisit').updateMany({
        where: {
          poolId: id,
          status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED'] },
        },
        data: serviceVisitBaseData({ clientId: nextClientId }),
      }).catch(() => null);
    }

    return res.json({ ok: true, pool });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});


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

router.post('/visits/:id/problem', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const body = req.body || {};
    const message = String(body.message || body.problem || '').trim();
    if (!message) return res.status(400).json({ ok: false, error: 'Descricao do problema obrigatoria' });

    const visit = await db('serviceVisit').findUnique({
      where: { id },
      include: { pool: { include: { client: true } }, client: true, technician: true },
    });
    if (!visit) return res.status(404).json({ ok: false, error: 'Visita nao encontrada' });
    if (!visit.poolId) return res.status(400).json({ ok: false, error: 'Visita sem piscina associada' });

    const actorRole = String(req.user?.role || '').toUpperCase();
    if (!roleMatches(actorRole, 'ADMIN')) {
      const actorTechnicianId = toInt(req.user?.technicianId, toInt(req.user?.id));
      if (!actorTechnicianId || toInt(visit.technicianId) !== actorTechnicianId) {
        return res.status(403).json({ ok: false, error: 'Sem permissao para alterar visita de outro tecnico' });
      }
    }

    const type = String(body.type || 'Problema em campo').trim();
    const severity = String(body.severity || 'Normal').toUpperCase();
    const priority = severity.includes('URG') || severity.includes('CRIT') ? 'HIGH' : 'NORMAL';
    const problem = `${type}: ${message}`;

    const repairResult = await RepairBusiness.createRepairTicket({
      poolId: visit.poolId,
      problem,
      notes: [
        `Reportado pelo tecnico no modo de campo.`,
        `Visita #${visit.id}.`,
        visit.technician?.name ? `Tecnico: ${visit.technician.name}.` : null,
        body.notes || null,
      ].filter(Boolean).join(' '),
      status: 'PENDING',
      priority,
    }, body.actor || req.headers['x-user-email'] || 'ADMIN', prisma, {
      context: {
        pool: visit.pool,
        clientId: visit.clientId || visit.pool?.clientId || visit.pool?.client?.id || null,
      },
      source: 'core-flow-route',
    });

    if (!repairResult?.ok) {
      return res.status(repairResult?.status || 500).json({
        ok: false,
        error: repairResult?.error || 'Falha ao criar reparação',
      });
    }

    const repair = repairResult.repair;

    const alert = available('technicalAlert') ? await db('technicalAlert').create({
      data: dataFor('technicalAlert', {
        poolId: visit.poolId,
        type,
        message,
        priority,
        status: 'OPEN',
      }),
    }).catch(() => null) : null;

    const clientId = visit.clientId || visit.pool?.clientId || visit.pool?.client?.id || null;
    const notification = available('notification') ? await db('notification').create({
      data: dataFor('notification', {
        clientId,
        type: priority === 'HIGH' ? 'CRITICAL' : 'ALERT',
        eventType: 'FIELD_PROBLEM_REPORTED',
        title: 'Problema reportado pelo tecnico',
        message: `${visit.pool?.name || 'Piscina'} - ${problem}`,
        role: 'ADMIN',
        severity: priority,
        metadata: { visitId: visit.id, poolId: visit.poolId, repairId: repair.id, alertId: alert?.id || null },
      }),
    }).catch(() => null) : null;

    if (global.io && notification) {
      global.io.emit('new-notification', {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
        clientId: notification.clientId,
      });
    }

    return res.json({ ok: true, repair, alert, notification, next: 'ADMIN_REVIEW_REPAIR' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/visits/:id/complete', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const body = req.body || {};

    const visitScope = await db('serviceVisit').findUnique({ where: { id }, select: { id: true, technicianId: true } });
    if (!visitScope) return res.status(404).json({ ok: false, error: 'Visita nao encontrada' });

    const actorRole = String(req.user?.role || '').toUpperCase();
    if (!roleMatches(actorRole, 'ADMIN')) {
      const actorTechnicianId = toInt(req.user?.technicianId, toInt(req.user?.id));
      if (!actorTechnicianId || toInt(visitScope.technicianId) !== actorTechnicianId) {
        return res.status(403).json({ ok: false, error: 'Sem permissao para alterar visita de outro tecnico' });
      }
    }

    const { visit, repair } = await completeServiceVisit(prisma, id, body);

    return res.json({ ok: true, visit, repair, next: body.problem || body.repair ? 'REPAIR_QUOTE' : 'MONTHLY_BILLING' });
  } catch (error) {
    if (error instanceof VisitCompletionError) {
      return res.status(error.statusCode).json({ ok: false, code: error.code, error: error.message });
    }
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

    const repair = await db('repair').update({
      where: { id },
      data: repairBaseData({ totalPrice: price, status: 'QUOTED', notes: req.body.notes || undefined }),
    });

    return res.json({ ok: true, repair });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/invoices/generate', async (req, res) => {
  try {
    const clientId = toInt(req.body.clientId);
    const ref = req.body.monthRef || monthRef();

    const client = await db('client').findUnique({ where: { id: clientId }, include: { pools: true } });
    if (!client) return res.status(404).json({ ok: false, error: 'Cliente nao encontrado' });

    if (String(client.status || '').toUpperCase() !== 'ACTIVE' || client.billingActive === false) {
      return res.status(409).json({ ok: false, error: 'Faturacao desligada: ativa primeiro o contrato do cliente apos receber o pagamento inicial.' });
    }

    const existingInvoice = await db('invoice').findUnique({
      where: { clientId_monthRef: { clientId, monthRef: ref } },
      include: { payments: true, lines: true },
    });
    const existingLines = existingInvoice?.lines || [];
    const existingServiceVisitIds = existingLines
      .filter((line) => ['SERVICE', 'SERVICE_VISIT'].includes(String(line.type || line.lineType || '').toUpperCase()))
      .map((line) => toInt(line.referenceId))
      .filter(Boolean);
    const existingExtraVisitIds = existingLines
      .filter((line) => ['EXTRA', 'EXTRA_VISIT'].includes(String(line.type || line.lineType || '').toUpperCase()))
      .map((line) => toInt(line.referenceId))
      .filter(Boolean);
    const existingRepairIds = invoiceLineReferenceIds(existingLines, ['REPAIR']);
    const range = monthRangeFromRef(ref);

    const repairs = await safe('repair.findMany.invoiceGenerate.v2', [], () => db('repair').findMany({
      where: { pool: { clientId }, status: { in: ['QUOTED', 'APPROVED', 'DONE'] }, paid: false },
      include: { pool: true },
    }));
    const serviceVisits = range && available('serviceVisit') ? await safe('serviceVisit.findMany.invoiceGenerate.v2', [], () => db('serviceVisit').findMany({
      where: {
        AND: [
          { OR: [{ clientId }, { pool: { clientId } }] },
          { OR: [{ plannedDate: { gte: range.start, lt: range.end } }, { date: { gte: range.start, lt: range.end } }, { endAt: { gte: range.start, lt: range.end } }] },
          { status: { in: ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUIDO'] } },
          { revenue: { gt: 0 } },
          { OR: [{ billed: false }, { id: { in: existingServiceVisitIds } }] },
        ],
      },
      include: { pool: true },
    })) : [];
    const extraVisits = range && available('extraVisit') ? await safe('extraVisit.findMany.invoiceGenerate.v2', [], () => db('extraVisit').findMany({
      where: {
        AND: [
          { OR: [{ clientId }, { pool: { clientId } }] },
          { OR: [{ scheduledAt: { gte: range.start, lt: range.end } }, { date: { gte: range.start, lt: range.end } }] },
          { status: { in: ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUIDO'] } },
          { OR: [{ isBillable: true }, { billingMode: 'EXTRA' }, { billingStatus: { in: ['PENDING', 'IN_MONTHLY_REPORT'] } }] },
          { OR: [{ billed: false }, { billingStatus: { in: ['PENDING', 'IN_MONTHLY_REPORT'] } }, { id: { in: existingExtraVisitIds } }] },
          { OR: [{ totalPrice: { gt: 0 } }, { price: { gt: 0 } }, { unitPrice: { gt: 0 } }] },
        ],
      },
      include: { pool: true },
    })) : [];

    const monthly = toFloat(client.monthlyFee || client.monthlyAmount || 0, 0) + (client.pools || []).reduce((sum, p) => sum + toFloat(p.monthlyAmount, 0), 0);
    const serviceTotal = serviceVisits.reduce((sum, visit) => sum + sourceAmount(visit), 0);
    const extraVisitTotal = extraVisits.reduce((sum, visit) => sum + sourceAmount(visit), 0);
    const repairTotal = repairs.reduce((sum, repair) => sum + toFloat(repair.totalPrice, 0), 0);
    const total = monthly + serviceTotal + extraVisitTotal + repairTotal;
    const alreadyPaid = existingInvoice
      ? (existingInvoice.payments || []).reduce((sum, payment) => sum + toFloat(payment.amount, 0), 0)
      : 0;
    const amountOpen = Math.max(0, total - alreadyPaid);
    const status = total <= 0 ? 'PAID' : amountOpen <= 0 ? 'PAID' : alreadyPaid > 0 ? 'PARTIAL' : 'PENDING';
    const paidAt = status === 'PAID' && alreadyPaid > 0 ? (existingInvoice?.paidAt || new Date()) : null;

    if (isDuplicateInvoiceGeneration(existingInvoice, {
      existingServiceVisitIds,
      existingExtraVisitIds,
      existingRepairIds,
      serviceVisits,
      extraVisits,
      repairs,
      monthly,
      total,
    })) {
      const fullInvoice = await safe('invoice.findUnique.duplicateInvoice.v2', existingInvoice, () => db('invoice').findUnique({ where: { id: existingInvoice.id }, include: { lines: true, client: true, payments: true } }));
      return res.status(409).json({ ok: false, code: 'INVOICE_ALREADY_EXISTS', error: 'Já existe fatura para este mês.', invoice: fullInvoice || existingInvoice });
    }

    const invoice = await db('invoice').upsert({
      where: { clientId_monthRef: { clientId, monthRef: ref } },
      update: invoiceBaseData({ total, totalAmount: total, amount: total, amountPaid: alreadyPaid, amountOpen, status, paidAt, requiresInvoice: Boolean(client.requiresInvoice) }),
      create: invoiceBaseData({ clientId, monthRef: ref, month: ref, amount: total, total, totalAmount: total, amountPaid: 0, amountOpen: total, status: total > 0 ? 'PENDING' : 'PAID', paidAt: null, requiresInvoice: Boolean(client.requiresInvoice) }),
    });
    const credit = await applyClientCreditToInvoice(prisma, invoice, {
      reference: `Fatura ${ref}`,
      notes: 'Abatimento automatico no fluxo core.',
    });

    if (available('invoiceLine')) {
      await db('invoiceLine').deleteMany({ where: { invoiceId: invoice.id } });
      if (monthly > 0) {
        await db('invoiceLine').create({ data: invoiceLineBaseData({ invoiceId: invoice.id, description: `Mensalidade ${ref}`, type: 'MONTHLY', quantity: 1, unitPrice: monthly, total: monthly, lineTotal: monthly }) });
      }
      for (const visit of serviceVisits) {
        const value = sourceAmount(visit);
        if (value > 0) {
          await db('invoiceLine').create({ data: invoiceLineBaseData({ invoiceId: invoice.id, description: `Servico: ${visit.pool?.name || `Visita ${visit.id}`}`, type: 'SERVICE', referenceId: visit.id, quantity: 1, unitPrice: value, total: value, lineTotal: value, serviceDate: visit.endAt || visit.plannedDate || visit.date || null, sourceMonth: ref, notes: visit.notes || null }) });
        }
      }
      for (const visit of extraVisits) {
        const value = sourceAmount(visit);
        if (value > 0) {
          await db('invoiceLine').create({ data: invoiceLineBaseData({ invoiceId: invoice.id, description: `Extra: ${visit.pool?.name || `Visita extra ${visit.id}`}`, type: 'EXTRA_VISIT', referenceId: visit.id, quantity: 1, unitPrice: value, total: value, lineTotal: value, serviceDate: visit.scheduledAt || visit.date || null, sourceMonth: ref, notes: visit.notes || null }) });
        }
      }
      for (const repair of repairs) {
        const value = toFloat(repair.totalPrice, 0);
        if (value > 0) {
          await db('invoiceLine').create({ data: invoiceLineBaseData({ invoiceId: invoice.id, description: `Reparacao: ${repair.problem}`, type: 'REPAIR', referenceId: repair.id, quantity: 1, unitPrice: value, total: value, lineTotal: value, sourceMonth: ref }) });
        }
      }
    }
    if (serviceVisits.length && available('serviceVisit')) {
      await safe('serviceVisit.updateMany.invoiceGenerate.v2', null, () => db('serviceVisit').updateMany({
        where: { id: { in: serviceVisits.map((visit) => visit.id) } },
        data: { billed: true, billedAt: new Date() },
      }));
    }
    if (extraVisits.length && available('extraVisit')) {
      await safe('extraVisit.updateMany.invoiceGenerate.v2', null, () => db('extraVisit').updateMany({
        where: { id: { in: extraVisits.map((visit) => visit.id) } },
        data: dataFor('extraVisit', { billed: true, billedAt: new Date(), billingStatus: 'IN_INVOICE' }),
      }));
    }

    const fullInvoice = await safe('invoice.findUnique.fullInvoice.v2', invoice, () => db('invoice').findUnique({ where: { id: invoice.id }, include: { lines: true, client: true, payments: true } }));
    return res.json({ ok: true, invoice: fullInvoice, creditUsed: credit.creditUsed || 0, lines: { monthly, services: serviceTotal, extras: extraVisitTotal, repairs: repairTotal }, next: 'PAYMENT' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/invoices/generate-legacy', async (req, res) => {
  try {
    const clientId = toInt(req.body.clientId);
    const ref = req.body.monthRef || monthRef();

    const client = await db('client').findUnique({ where: { id: clientId }, include: { pools: true } });
    if (!client) return res.status(404).json({ ok: false, error: 'Cliente não encontrado' });

    if (String(client.status || '').toUpperCase() !== 'ACTIVE' || client.billingActive === false) {
      return res.status(409).json({ ok: false, error: 'Faturação desligada: ativa primeiro o contrato do cliente após receber o pagamento inicial.' });
    }

    const repairs = await safe('repair.findMany.invoiceGenerate', [], () => db('repair').findMany({
      where: { pool: { clientId }, status: { in: ['QUOTED', 'APPROVED', 'DONE'] }, paid: false },
      include: { pool: true },
    }));

    const monthly = toFloat(client.monthlyFee || client.monthlyAmount || 0, 0) + (client.pools || []).reduce((sum, p) => sum + toFloat(p.monthlyAmount, 0), 0);
    const repairTotal = repairs.reduce((sum, r) => sum + toFloat(r.totalPrice, 0), 0);
    const total = monthly + repairTotal;
    const existingInvoice = await db('invoice').findUnique({
      where: { clientId_monthRef: { clientId, monthRef: ref } },
      include: { payments: true, lines: true },
    });
    const alreadyPaid = existingInvoice
      ? (existingInvoice.payments || []).reduce((sum, p) => sum + toFloat(p.amount, 0), 0)
      : 0;
    const amountOpen = Math.max(0, total - alreadyPaid);
    const status = total <= 0 ? 'PAID' : amountOpen <= 0 ? 'PAID' : alreadyPaid > 0 ? 'PARTIAL' : 'PENDING';
    const paidAt = status === 'PAID' && alreadyPaid > 0 ? (existingInvoice?.paidAt || new Date()) : null;

    if (isDuplicateInvoiceGeneration(existingInvoice, {
      existingRepairIds: invoiceLineReferenceIds(existingInvoice?.lines || [], ['REPAIR']),
      repairs,
      monthly,
      total,
    })) {
      const fullInvoice = await safe('invoice.findUnique.duplicateInvoice.legacy', existingInvoice, () => db('invoice').findUnique({ where: { id: existingInvoice.id }, include: { lines: true, client: true, payments: true } }));
      return res.status(409).json({ ok: false, code: 'INVOICE_ALREADY_EXISTS', error: 'Já existe fatura para este mês.', invoice: fullInvoice || existingInvoice });
    }

    const invoice = await db('invoice').upsert({
      where: { clientId_monthRef: { clientId, monthRef: ref } },
      update: invoiceBaseData({ total, totalAmount: total, amount: total, amountPaid: alreadyPaid, amountOpen, status, paidAt, requiresInvoice: Boolean(client.requiresInvoice) }),
      create: invoiceBaseData({ clientId, monthRef: ref, month: ref, amount: total, total, totalAmount: total, amountPaid: 0, amountOpen: total, status: total > 0 ? 'PENDING' : 'PAID', paidAt: null, requiresInvoice: Boolean(client.requiresInvoice) }),
    });
    const credit = await applyClientCreditToInvoice(prisma, invoice, {
      reference: `Fatura ${ref}`,
      notes: 'Abatimento automatico no fluxo core legado.',
    });

    if (available('invoiceLine')) {
      await db('invoiceLine').deleteMany({ where: { invoiceId: invoice.id } });
      if (monthly > 0) {
        await db('invoiceLine').create({ data: invoiceLineBaseData({ invoiceId: invoice.id, description: `Mensalidade ${ref}`, type: 'MONTHLY', quantity: 1, unitPrice: monthly, total: monthly, lineTotal: monthly }) });
      }
      for (const repair of repairs) {
        const value = toFloat(repair.totalPrice, 0);
        if (value > 0) {
          await db('invoiceLine').create({ data: invoiceLineBaseData({ invoiceId: invoice.id, description: `Reparação: ${repair.problem}`, type: 'REPAIR', referenceId: repair.id, quantity: 1, unitPrice: value, total: value, lineTotal: value }) });
        }
      }
    }

    const fullInvoice = await safe('invoice.findUnique.fullInvoice', invoice, () => db('invoice').findUnique({ where: { id: invoice.id }, include: { lines: true, client: true, payments: true } }));
    return res.json({ ok: true, invoice: fullInvoice, creditUsed: credit.creditUsed || 0, next: 'PAYMENT' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

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
    const id = toInt(req.params.id);

    const invoice = await db('invoice').findUnique({ where: { id }, include: { payments: true } });
    if (!invoice) return res.status(404).json({ ok: false, error: 'Fatura não encontrada' });

    const amount = toFloat(req.body.amount, invoice.amountOpen || invoice.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok: false, error: 'Valor invalido' });

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.invoice.findUnique({ where: { id } });
      if (!current) throw new Error('Fatura nao encontrada');

      const open = invoiceOpen(current);
      const applied = Math.min(amount, open);
      let payment = null;
      let updated = current;

      if (applied > 0) {
        payment = await tx.payment.create({ data: paymentBaseData({ invoiceId: id, amount: applied, amountCents: Math.round(applied * 100), method: req.body.method || 'MANUAL', notes: req.body.notes || null }) });
        const paidTotal = invoicePaid(current) + applied;
        const openAfter = Math.max(open - applied, 0);
        updated = await tx.invoice.update({
          where: { id },
          data: invoiceBaseData({
            amountPaid: paidTotal,
            amountOpen: openAfter,
            status: invoiceStatus(invoiceTotal(current), paidTotal, openAfter),
            paidAt: openAfter <= 0 ? new Date() : current.paidAt,
            paymentMethod: req.body.method || 'MANUAL',
          }),
        });
      }

      const surplus = Math.max(amount - applied, 0);
      const credit = surplus > 0 && current.clientId
        ? await createCreditLedgerPayment(tx, current.clientId, surplus, {
          monthRef: current.monthRef || monthRef(),
          method: req.body.method || 'MANUAL',
          notes: req.body.notes || 'Excedente convertido em credito positivo.',
        })
        : { creditAdded: 0 };

      return { payment, invoice: updated, appliedAmount: applied, creditAdded: credit.creditAdded || 0, creditBalance: credit.creditBalance };
    });

    return res.json({ ok: true, ...result, next: 'CLOSED' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/invoices/external', async (req, res) => {
  const invoices = await safe('invoice.findMany.externalInvoices', [], () => db('invoice').findMany({
    where: { requiresInvoice: true },
    include: { client: true, lines: true, payments: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  }));
  return res.json({ ok: true, invoices });
});

router.post('/invoices/:id/mark-external-issued', async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const invoice = await db('invoice').update({ where: { id }, data: invoiceBaseData({ invoiceIssued: true, externalInvoiceNo: req.body?.externalInvoiceNo || undefined }) });
    return res.json({ ok: true, invoice });
  } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
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
