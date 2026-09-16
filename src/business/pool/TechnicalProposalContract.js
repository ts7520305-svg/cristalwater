'use strict';
const crypto = require('node:crypto');
const { roleMatches } = require('../../utils/roles');
const { getJwtSecret } = require('../../utils/jwtSecret');
const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch (_) { return fallback; } };
const toInt = value => Number.isSafeInteger(Number(value)) ? Number(value) : 0;

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
  'volumeM3', 'lengthM', 'widthM', 'diameterM', 'depthMinM', 'depthMaxM', 'averageDepthM', 'shape', 'shapeFactor', 'disinfectionType',
  'targetSalinityPpm', 'targetChlorinePpm', 'pumpFlowM3h', 'type', 'monthlyAmount',
]);



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
  const aliases = { equipmentNotes: ['equipment', 'notes'], technicalRoomNotes: ['technicalRoom', 'notes'], technicalRoomCondition: ['technicalRoom', 'condition'], technicalRoomLocation: ['technicalRoom', 'locationNote'], technicalRoomVentilation: ['technicalRoom', 'ventilation'], technicalRoomElectrical: ['technicalRoom', 'electrical'], calculationNotes: ['calculationProfile', 'notes'] };
  if (Object.hasOwn(aliases, key)) { const [source, column] = aliases[key]; return pool[source]?.[column] ?? null; }
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

function buildProposalDiff(changes = [], pool = null, baselineCaptured = false) {
  return (Array.isArray(changes) ? changes : []).map((change) => {
    const field = String(change?.field || '').trim();
    const before = change?.before == null ? null : String(change.before);
    const after = change?.after == null ? null : String(change.after);
    const currentRaw = readPoolFieldValue(pool, field);
    const current = currentRaw == null ? null : String(currentRaw);
    const effectiveBefore = baselineCaptured ? before : (before == null || before === '' ? current : before);
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
    ...(payload.eventVersion === 2 ? { eventVersion: 2, actorKey: String(payload.actorKey || '') } : {}),
  });
  return crypto.createHash('sha256').update(source).digest('hex');
}

function parseWorkflowEventDescription(description) {
  const parsed = safeJson(description, null);
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    proposalId: toInt(parsed.proposalId),
    eventVersion: parsed.eventVersion,
    actorKey: String(parsed.actorKey || ''),
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

function buildImmutableHistory(events = []) {
  let chainValid = events.length > 0;
  let previousState = '';
  let expectedPrevHash = '';
  const items = events.map((row) => {
    const parsed = parseWorkflowEventDescription(row.description || '') || {};
    const rebuiltHash = buildWorkflowEventHash(parsed, parsed.previousHash || '');
    const hashMatches = !!parsed.eventHash && parsed.eventHash === rebuiltHash;
    const prevMatches = (parsed.previousHash || '') === expectedPrevHash;
    const valid = hashMatches && prevMatches && parsed.fromState === previousState && !!parsed.toState;
    previousState = parsed.toState;
    if (!valid) chainValid = false;
    expectedPrevHash = parsed.eventHash || expectedPrevHash;
    return {
      id: row.id,
      proposalId: parsed.proposalId || null,
      fromState: parsed.fromState || '',
      toState: parsed.toState || '',
      actor: parsed.actor || '',
      actorRole: parsed.actorRole || '',
      actorKey: parsed.actorKey || '',
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
        batchId: String(item?.batchId || ''),
        actorKey: String(item?.actorKey || ''),
      }))
      .filter((item) => item.to)
    : [];
  return {
    proposalId: String(parsed.proposalId || ''),
    creatorKey: parsed.creatorKey || null,
    creatorTechnicianId: parsed.creatorTechnicianId || null,
    baselineCaptured: parsed.baselineCaptured === true,
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
  const diff = buildProposalDiff(Array.isArray(payload.changes) ? payload.changes : [], pool, payload.baselineCaptured);
  return {
    id: historyRow.id,
    version: proposalVersion(historyRow),
    decisionOnly: true,
    creatorKey: payload.creatorKey,
    creatorTechnicianId: payload.creatorTechnicianId,
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

function proposalVersion(row) { return 'technical-proposal-v1:' + crypto.createHmac('sha256', getJwtSecret()).update(JSON.stringify({ id: row.id, poolId: row.poolId, status: row.status, description: row.description, updatedAt: row.updatedAt })).digest('hex'); }
function safePhoto(value) {
  if (typeof value !== 'string' || /[\\\x00-\x20]/.test(value)) return false;
  try { const url = new URL(value, 'https://local.invalid'); return (value.startsWith('/uploads/') || /^https?:\/\//i.test(value)) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch (_) { return false; }
}
module.exports = { TECHNICAL_PROPOSAL_TYPE, TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE, TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE, PROPOSAL_PENDING_STATES,
 normalizeProposalWorkflowState, normalizeRiskLevel, inferProposalRiskLevel, normalizeProposalChanges, normalizeProposalPhotos, parseProposalDescription,
 buildWorkflowEventHash, parseWorkflowEventDescription, buildImmutableHistory, roleCanTransitionProposal, mapTechnicalProposal, readPoolFieldValue, proposalVersion, safePhoto };
