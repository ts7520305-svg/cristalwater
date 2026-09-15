'use strict';
const { createHash } = require('crypto');
function fail(statusCode, message, code) { throw Object.assign(new Error(message), { statusCode, code }); }
function parseReference(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') fail(400, 'Referencia de alerta invalida');
  const match = /^(?:(notification|technical|visit|generic)-)?([1-9]\d*)$/.exec(String(raw));
  if (!match || Number(match[2]) > 2147483647) fail(400, 'Referencia de alerta invalida');
  return { source: match[1] || 'notification', id: Number(match[2]) };
}
const fields = {
  technical: ['id', 'poolId', 'type', 'message', 'priority', 'status', 'createdAt', 'resolvedAt'],
  generic: ['id', 'title', 'message', 'type', 'status', 'active', 'createdAt', 'resolvedAt'],
  notification: ['id', 'userId', 'clientId', 'type', 'eventType', 'title', 'message', 'role', 'severity', 'metadata', 'status', 'createdAt', 'updatedAt', 'isRead', 'readAt'],
  visit: ['id', 'poolId', 'clientId', 'technicianId', 'status', 'alerts', 'reason', 'notes', 'internalNotes', 'startAt', 'endAt', 'updatedAt', 'plannedDate', 'date'],
};
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value === undefined ? null : value;
}
function resolutionVersion(source, row) {
  if (!fields[source]) fail(400, 'Origem de alerta invalida');
  return createHash('sha256').update(JSON.stringify([source, fields[source].map(key => canonical(row[key]))])).digest('hex');
}
function expectedVersion(value) {
  if (value === undefined) return null; // Existing API clients may still omit the version.
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(400, 'Versao de alerta invalida');
  return value;
}
const WATER = ['AGUA_ABERTA', 'BOMBA_MANUAL', 'WATER_OPEN', 'PUMP_MANUAL'];
function requirement(source, row) {
  if (WATER.includes(String(row.type || '').toUpperCase()) || /^(WATER_OPEN|PUMP_MANUAL)_/.test(row.eventType || '')) {
    return { code: 'PHYSICAL_CONFIRMATION_REQUIRED', message: 'Confirme primeiro o fecho da agua ou o regresso da bomba a automatico no respetivo lembrete. Este botao apenas trata o aviso.' };
  }
  if ((source === 'visit' && ['NOT_DONE', 'BLOCKED', 'RETAINED', 'IMPEDIDO', 'INCOMPLETE'].includes(String(row.status).toUpperCase())) ||
    (source === 'notification' && ['VISIT_INCOMPLETE', 'VISIT_COVERAGE'].includes(row.eventType))) {
    return { code: 'VISIT_ACTION_REQUIRED', message: 'Trate o impedimento ou agende o regresso no fluxo da visita. Resolver este alerta nao conclui a manutencao.' };
  }
  if (source === 'notification' && row.eventType === 'EQUIPMENT_MAINTENANCE_DUE') {
    return { code: 'MAINTENANCE_ACTION_REQUIRED', message: 'Registe o servico no plano de manutencao do equipamento para concluir este aviso.' };
  }
  return null;
}
module.exports = { parseReference, resolutionVersion, expectedVersion, requirement, fail };
