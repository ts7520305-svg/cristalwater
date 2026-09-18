'use strict';
const { createHmac } = require('node:crypto');
const { prisma } = require('../prismaClient');
const { getJwtSecret } = require('../utils/jwtSecret');
const { roleMatches } = require('../utils/roles');
const requests = require('./fieldWriteRequestService');
const fields = require('./clientReportSettingsDefaults');
const scope = 'CLIENT_REPORT_SETTINGS';
const versionPattern = /^report-settings-v1:[a-f0-9]{64}$/;
const fail = (message, status = 400, code = 'INVALID_REPORT_SETTINGS') => requests.fail(message, status, code);
function clientId(value) {
  if (!['string', 'number'].includes(typeof value)) fail('Cliente inválido.');
  if (typeof value === 'string' && !/^[1-9]\d{0,9}$/.test(value)) fail('Cliente inválido.');
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail('Cliente inválido.');
  return id;
}
function admin(actor) { if (!roleMatches(actor?.role, 'ADMIN')) fail('Sem permissão para configurar relatórios.', 403); }
const select = { id: true, name: true, active: true, archiveStatus: true, deletedAt: true, reportSetting: true };
function snapshot(client) {
  const setting = fields.effective(client.reportSetting);
  if (!fields.valid(setting)) throw Error('Invalid stored report settings');
  const savedAt = client.reportSetting?.updatedAt.toISOString() || null;
  const state = { ok: true, reportSettingsVersion: 1, client: { id: client.id, name: client.name, active: client.active }, editable: !client.deletedAt && client.archiveStatus === 'ATIVO', source: client.reportSetting ? 'SAVED' : 'DEFAULT', setting, savedAt };
  const identity = { state, recordId: client.reportSetting?.id || null, archiveStatus: client.archiveStatus, deletedAt: client.deletedAt };
  return { ...state, version: 'report-settings-v1:' + createHmac('sha256', getJwtSecret()).update(scope + '\0' + requests.hash(identity)).digest('hex') };
}
async function read(actor, rawId) {
  admin(actor); const id = clientId(rawId);
  return prisma.$transaction(async tx => {
    const client = await tx.client.findUnique({ where: { id }, select });
    if (!client) fail('Cliente não encontrado.', 404, 'REPORT_SETTINGS_NOT_FOUND');
    return snapshot(client);
  }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 15000 });
}
async function write(actor, rawId, body) {
  admin(actor); const id = clientId(rawId);
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Configuração inválida.');
  if (body.requestId === undefined) fail('Carregue a configuração atual antes de guardar.', 428, 'REPORT_SETTINGS_REVIEW_REQUIRED');
  if (Object.keys(body).length !== 4 || Object.keys(body).some(key => !['requestId', 'clientId', 'expectedVersion', 'setting'].includes(key)) || body.clientId !== id || typeof body.expectedVersion !== 'string' || !versionPattern.test(body.expectedVersion) || !fields.valid(body.setting)) fail('Conserve o cliente, a versão e as opções revistas.');
  const context = { clientId: id, expectedVersion: body.expectedVersion, setting: body.setting };
  const request = requests.context(actor, scope, id, body.requestId, context);
  return prisma.$transaction(async tx => {
    const recovered = await requests.recover(tx, request); if (recovered) return recovered;
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${id} FOR UPDATE`;
    const client = await tx.client.findUnique({ where: { id }, select });
    const before = client ? snapshot(client) : null;
    const reject = (code, message) => requests.confirm(tx, request, { ok: true, applied: false, context, code, message, currentVersion: before?.version || null });
    if (!before?.editable) return reject('REPORT_SETTINGS_UNAVAILABLE', 'Este cliente já não está disponível para alteração. O pedido não foi aplicado.');
    if (before.version !== context.expectedVersion) return reject('REPORT_SETTINGS_STALE', 'A configuração ou a ficha do cliente mudou. Reveja as opções atuais antes de preparar outra gravação.');
    await tx.clientReportSetting.upsert({ where: { clientId: id }, create: { clientId: id, ...context.setting }, update: context.setting });
    const after = snapshot(await tx.client.findUniqueOrThrow({ where: { id }, select }));
    if (requests.hash(after.setting) !== requests.hash(context.setting) || after.source !== 'SAVED') throw Error('Report settings write unconfirmed');
    const audit = await tx.userAuditLog.create({ data: {
      userId: Number(actor.userId || actor.id), actor: request.owner, action: 'CLIENT_REPORT_SETTINGS_UPDATED', entity: 'Client', entityId: String(id),
      metadata: { requestId: request.requestId, before: { source: before.source, version: before.version, setting: before.setting }, after: { source: after.source, version: after.version, setting: after.setting } },
    } });
    return requests.confirm(tx, request, { ok: true, applied: true, context, state: after, auditId: audit.id, savedAt: after.savedAt });
  }, { maxWait: 15000, timeout: 20000 });
}
module.exports = { read, write, snapshot, clientId };
