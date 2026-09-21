'use strict';
const { scope, id } = require('../../utils/clientReadScope');
const documents = require('../../services/customerPortalService');
const fail = (message, statusCode) => { throw Object.assign(Error(message), { statusCode }); };
const present = value => value !== undefined && value !== null && value !== '';
function reference(value, maximum = 2147483647) {
  if (!present(value)) return null;
  if (!['number', 'string'].includes(typeof value)) return NaN;
  try { return id(String(value), maximum); } catch (_) { return NaN; }
}

// Explicit client references must agree. A regular visit supplies historical ownership;
// the current owner of a pool never grants access to a previous customer's documents.
function ownership(row, visits) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const entity = typeof row.entity === 'string' ? row.entity.trim().toUpperCase() : row.entity == null ? '' : '?';
  if (!['', 'CLIENT', 'POOL', 'VISIT', 'SERVICE_VISIT'].includes(entity) || present(row.alertId) || present(row.repairId)) return null;
  const client = reference(row.clientId), pool = reference(row.poolId), visit = reference(row.visitId), entityId = reference(row.entityId);
  if ([client, pool, visit, entityId].some(Number.isNaN) || entity && !entityId || !entity && entityId) return null;
  const owners = [client, entity === 'CLIENT' ? entityId : null].filter(Boolean);
  const poolId = pool || (entity === 'POOL' ? entityId : null), visitId = visit || (['VISIT', 'SERVICE_VISIT'].includes(entity) ? entityId : null);
  if (entity === 'POOL' && pool && pool !== entityId || ['VISIT', 'SERVICE_VISIT'].includes(entity) && visit && visit !== entityId) return null;
  if (visitId) {
    const source = visits.get(visitId);
    if (!source || !reference(source.clientId) || poolId && poolId !== source.poolId) return null;
    owners.push(source.clientId);
  }
  return owners.length && owners.every(owner => owner === owners[0]) ? owners[0] : null;
}

async function snapshot(actor, rawClientId) {
  const clientId = scope(actor, rawClientId);
  if (rawClientId === undefined) fail('Cliente obrigatório.', 400);
  const rows = documents.readDocumentManifest();
  const visitIds = [...new Set(rows.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    return [reference(row.visitId), ['VISIT', 'SERVICE_VISIT'].includes(String(row.entity || '').trim().toUpperCase()) ? reference(row.entityId) : null].filter(Number.isSafeInteger);
  }))];
  const sources = await documents.documentOwnershipSources(clientId, visitIds);
  if (!sources.client) fail('Cliente não encontrado.', 404);
  const visits = new Map(sources.visits.map(visit => [visit.id, visit]));
  const ids = new Map(), filenames = new Map();
  for (const row of rows) {
    const key = reference(row?.id, Number.MAX_SAFE_INTEGER);
    if (key) ids.set(key, (ids.get(key) || 0) + 1);
    if (typeof row?.filename === 'string') filenames.set(row.filename, (filenames.get(row.filename) || 0) + 1);
  }
  const eligible = rows.filter(row => {
    const key = reference(row?.id, Number.MAX_SAFE_INTEGER);
    return key && ids.get(key) === 1 && filenames.get(row.filename) === 1 && documents.validDocumentFilename(row.filename) && ownership(row, visits) === clientId;
  });
  return { clientId, rows: eligible };
}

async function list(actor, rawClientId) {
  const result = await snapshot(actor, rawClientId);
  return { ok: true, documents: result.rows.map(row => {
    const url = `/api/client-portal/${result.clientId}/documents/${row.id}/download`;
    return { ...documents.normalizeDocument(row), url, downloadUrl: url };
  }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || Number(b.id) - Number(a.id)) };
}

async function read(actor, rawClientId, rawDocumentId) {
  const documentId = id(rawDocumentId, Number.MAX_SAFE_INTEGER), result = await snapshot(actor, rawClientId);
  const row = result.rows.find(item => Number(item.id) === documentId);
  if (!row) fail('Documento não encontrado.', 404);
  const file = await documents.openDocumentFile(row.filename);
  const name = typeof row.originalName === 'string' && row.originalName.trim() ? row.originalName : typeof row.title === 'string' && row.title.trim() ? row.title : `documento-${documentId}`;
  return { ...file, clientId: result.clientId, documentId, name: name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 180) };
}

module.exports = { list, read };
