'use strict';
const { createHmac } = require('node:crypto');
const { prisma } = require('../prismaClient');
const { getJwtSecret } = require('../utils/jwtSecret');
const writes = require('./fieldWriteRequestService');
const rules = require('../../frontend/cw-company-closure-rules');
const fail = (message, status = 400, code = 'INVALID_COMPANY_CLOSURE') => writes.fail(message, status, code);
function admin(actor) { if (actor?.role !== 'ADMIN' || !rules.positive(Number(actor.userId || actor.id))) fail('Acesso reservado à administração.', 403); return writes.owner(actor); }
function id(value) { if (typeof value === 'string' && !/^[1-9]\d{0,9}$/.test(value) || !['string', 'number'].includes(typeof value) || !rules.positive(Number(value))) fail('Encerramento inválido.'); return Number(value); }
function snapshot(row) {
  return { closure: JSON.parse(JSON.stringify(row)), version: 'company-closure-v2:' + createHmac('sha256', getJwtSecret()).update(rules.scope + '\0' + writes.hash(JSON.parse(JSON.stringify(row)))).digest('hex'), automaticReplanning: false, timeZone: 'UTC' };
}
function filters(query = {}) {
  if (!rules.object(query) || Object.keys(query).some(k => !['status', 'from', 'to'].includes(k))) fail('Filtros inválidos.');
  const out = { status: query.status ?? '', from: query.from ?? '', to: query.to ?? '' };
  if (out.status && !['PLANNED', 'ACTIVE', 'CANCELLED'].includes(out.status) || typeof out.status !== 'string' || out.from !== '' && !rules.day(out.from) || out.to !== '' && !rules.day(out.to) || out.from && out.to && out.from > out.to) fail('Datas ou estado inválidos.');
  return out;
}
async function list(actor, query) {
  admin(actor); const selection = filters(query), where = {};
  if (selection.status) where.status = selection.status;
  if (selection.from) where.endDate = { gte: new Date(selection.from + 'T00:00:00.000Z') };
  if (selection.to) where.startDate = { lte: new Date(selection.to + 'T23:59:59.999Z') };
  const rows = await prisma.companyClosure.findMany({ where, orderBy: [{ startDate: 'desc' }, { id: 'desc' }], take: 101 });
  return { ok: true, version: 2, filters: selection, complete: rows.length <= 100, limit: 100, closures: rows.slice(0, 100).map(snapshot) };
}
async function read(actor, rawId) { admin(actor); const row = await prisma.companyClosure.findUnique({ where: { id: id(rawId) } }); if (!row) fail('Encerramento não encontrado.', 404); return { ok: true, version: 2, state: snapshot(row) }; }
function publicMessage(closure) {
  const dates = { startDate: new Date(closure.startDate).toISOString().slice(0, 10), endDate: new Date(closure.endDate).toISOString().slice(0, 10) };
  return { title: closure.messageTitle || closure.title, message: (closure.messageBody || 'Informamos que a Cristal Water estará encerrada entre {startDate} e {endDate}.').replace(/\{(startDate|endDate)\}/g, (_, key) => dates[key]) };
}
async function active(actor) {
  admin(actor); const now = new Date();
  const row = await prisma.companyClosure.findFirst({ where: { status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now }, showOnClientPortal: true }, orderBy: [{ startDate: 'asc' }, { id: 'asc' }] });
  return { ok: true, active: !!row, closure: row, publicMessage: row ? publicMessage(row) : null };
}
async function impact(actor, rawId) {
  admin(actor); const closureId = id(rawId);
  return prisma.$transaction(async tx => {
    const row = await tx.companyClosure.findUnique({ where: { id: closureId } }); if (!row) fail('Encerramento não encontrado.', 404);
    const visits = await tx.serviceVisit.findMany({ where: { plannedDate: { gte: row.startDate, lte: row.endDate }, status: { in: ['PLANNED', 'SCHEDULED', 'PENDING'] } }, select: { id: true, plannedDate: true, status: true }, orderBy: [{ plannedDate: 'asc' }, { id: 'asc' }], take: 501 });
    const shown = visits.slice(0, 500);
    // ServiceVisit has no recorded priority/type fields. Do not silently infer
    // criticality from a current pool flag or count every unknown visit as normal.
    return { ok: true, version: 2, state: snapshot(row), impact: { visitType: 'REGULAR', complete: visits.length <= 500, limit: 500, totalVisits: shown.length, normalVisits: null, criticalVisits: null, unclassifiedVisits: shown.length, classification: 'UNCONFIRMED_NO_RECORDED_PRIORITY', visits: shown, recommendation: 'A prioridade destas visitas precisa de revisão. Nenhuma visita foi pausada ou reagendada automaticamente.' } };
  }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 20000 });
}
function storedFields(fields) {
  return { ...fields, startDate: new Date(fields.startDate + 'T00:00:00.000Z'), endDate: new Date(fields.endDate + 'T23:59:59.999Z') };
}
async function write(actor, body, database = prisma) {
  const owner = admin(actor), actorId = Number(actor.userId || actor.id);
  if (!body?.requestId) fail('Reveja a versão atual e conserve um pedido identificável antes de guardar.', 428, 'CLOSURE_REVIEW_REQUIRED');
  if (!rules.command(body)) fail('Conserve o pedido, as datas e a versão revista.');
  const context = rules.intent(body), request = writes.context(actor, rules.scope, body.closureId || 1, body.requestId, context);
  return database.$transaction(async tx => {
    const recovered = await writes.recover(tx, request); if (recovered) return recovered;
    let before = null;
    if (body.closureId) { await tx.$queryRaw`SELECT id FROM "CompanyClosure" WHERE id=${body.closureId} FOR UPDATE`; before = await tx.companyClosure.findUnique({ where: { id: body.closureId } }); }
    const reject = (code, message) => writes.confirm(tx, request, { ok: true, applied: false, context, code, message });
    if (body.operation !== 'CREATE' && !before) return reject('CLOSURE_NOT_FOUND', 'O encerramento já não está disponível. Nenhuma alteração aplicada.');
    if (before && snapshot(before).version !== body.expectedVersion) return reject('CLOSURE_STALE', 'O encerramento mudou. Consulte a versão atual antes de preparar outro pedido.');
    if (before?.status === 'CANCELLED') return reject('CLOSURE_CANCELLED', 'Este encerramento está cancelado. Nenhuma alteração aplicada.');
    let after = before, created = 0;
    if (body.operation === 'CREATE') {
      const fields = storedFields(body.fields), now = new Date();
      after = await tx.companyClosure.create({ data: { ...fields, createdByUserId: actorId, ...(fields.status === 'ACTIVE' ? { approvedByUserId: actorId, approvedAt: now, activatedAt: now } : {}) } });
    } else if (body.operation === 'UPDATE') {
      if (body.fields.status !== before.status) return reject('CLOSURE_STATE_REVIEW', 'Use a ação explícita de ativação ou cancelamento para alterar o estado.');
      after = await tx.companyClosure.update({ where: { id: before.id }, data: storedFields(body.fields) });
    } else if (body.operation === 'ACTIVATE') {
      if (before.status !== 'PLANNED') return reject('CLOSURE_ALREADY_ACTIVE', 'Só pode ativar um encerramento planeado.');
      after = await tx.companyClosure.update({ where: { id: before.id }, data: { status: 'ACTIVE', activatedAt: new Date(), approvedAt: new Date(), approvedByUserId: actorId } });
    } else if (body.operation === 'CANCEL') {
      after = await tx.companyClosure.update({ where: { id: before.id }, data: { status: 'CANCELLED', deactivatedAt: new Date() } });
    } else if (body.operation === 'NOTIFY') {
      if (before.status !== 'ACTIVE') return reject('CLOSURE_NOT_ACTIVE', 'Ative explicitamente este encerramento antes de gerar avisos.');
      const [notice, audit] = await Promise.all([
        tx.notification.findFirst({ where: { type: 'COMPANY_CLOSURE', metadata: { path: ['closureId'], equals: before.id } }, select: { id: true } }),
        tx.userAuditLog.findFirst({ where: { action: 'COMPANY_CLOSURE_NOTIFY', entity: 'CompanyClosure', entityId: String(before.id) }, select: { id: true } }),
      ]);
      if (notice || audit) return reject('CLOSURE_ALREADY_NOTIFIED', 'Já existe uma emissão de avisos para este encerramento. Não foram criados duplicados.');
      const message = publicMessage(before), notifications = [];
      if (before.notifyClients) {
        const clients = await tx.client.findMany({ where: { active: true, deletedAt: null, archiveStatus: 'ATIVO' }, select: { id: true }, orderBy: { id: 'asc' }, take: 10001 });
        if (clients.length > 10000) return reject('CLOSURE_RECIPIENT_LIMIT', 'A lista de destinatários excede o limite seguro. Nenhum aviso criado.');
        for (const client of clients) notifications.push({ clientId: client.id, type: 'COMPANY_CLOSURE', eventType: 'COMPANY_CLOSURE_CLIENT_NOTICE', title: message.title, message: message.message, role: 'CLIENT', status: 'PENDING', severity: 'INFO', metadata: { closureId: before.id, requestId: body.requestId } });
      }
      if (before.notifyTechnicians) notifications.push({ type: 'COMPANY_CLOSURE', eventType: 'COMPANY_CLOSURE_TECH_NOTICE', title: before.title, message: `Encerramento de ${before.startDate.toISOString().slice(0, 10)} a ${before.endDate.toISOString().slice(0, 10)}. Consulte a administração para exceções e rondas.`, role: 'TECHNICIAN', status: 'PENDING', severity: 'INFO', metadata: { closureId: before.id, requestId: body.requestId } });
      if (!notifications.length) return reject('CLOSURE_NO_RECIPIENTS', 'Não existem destinatários selecionados e disponíveis. Nenhum lote de avisos foi criado.');
      created = (await tx.notification.createMany({ data: notifications })).count;
      if (created !== notifications.length) throw Error('Closure notifications not confirmed');
    }
    const audit = await tx.userAuditLog.create({ data: { userId: actorId, actor: owner, action: 'COMPANY_CLOSURE_' + body.operation, entity: 'CompanyClosure', entityId: String(after.id), metadata: { requestId: body.requestId, before: before ? snapshot(before) : null, after: snapshot(after), ...(body.operation === 'CANCEL' ? { reason: body.fields.reason } : {}), createdNotifications: created } } });
    return writes.confirm(tx, request, { ok: true, applied: true, context, state: snapshot(after), auditId: audit.id, createdNotifications: created, automaticReplanning: false });
  }, { maxWait: 15000, timeout: 20000 });
}
async function recover(actor, requestId) {
  const owner = admin(actor); if (!rules.uuid(requestId)) fail('Pedido inválido.');
  const saved = await prisma.fieldWriteRequest.findUnique({ where: { owner_requestId: { owner, requestId } } });
  if (!saved) return { ok: true, found: false };
  if (saved.scope !== rules.scope) fail('O pedido pertence a outra operação.', 409);
  return { ok: true, found: true, result: saved.response };
}
module.exports = { list, read, active, impact, write, recover, snapshot, publicMessage, filters, id };
