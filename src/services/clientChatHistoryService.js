'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), { createHash } = require('node:crypto');
const { prisma } = require('../prismaClient');
const dataPath = path.join(__dirname, '../data/clientChatMessages.json');
const hash = value => createHash('sha256').update(value).digest('hex');
function clientId(value) { const id = Number(value); return /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(id) && id <= 2147483647 ? id : null; }
function historicalDate(value) {
  if (typeof value !== 'string') return null;
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const calendar = `${parts[1]}.${(parts[2] || '').padEnd(3, '0')}Z`, local = new Date(calendar), date = new Date(value);
  return Number.isFinite(local.getTime()) && local.toISOString() === calendar && Number.isFinite(date.getTime()) ? date : null;
}
function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw Error('Histórico inválido; conteúdo preservado.');
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function snapshot() {
  let sourceBytes;
  try { sourceBytes = await fs.readFile(dataPath); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  // Retain exact bytes, including old encoding defects. The decoded view follows
  // the legacy reader, but is never presented as a verified author or file link.
  let rows;
  try { rows = JSON.parse(sourceBytes.toString('utf8')); } catch { throw Error('Histórico inválido; conteúdo preservado.'); }
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Histórico inválido; conteúdo preservado.');
  const occurrences = new Map();
  const records = rows.map(payload => {
    const fingerprint = hash(canonical(payload)), ordinal = (occurrences.get(fingerprint) || 0) + 1; occurrences.set(fingerprint, ordinal);
    return { recordKey: `legacy-${fingerprint}-${ordinal}`, clientId: clientId(payload.clientId), payload, readByAdmin: payload.readByAdmin === true, readByClient: payload.readByClient === true };
  });
  return { sourceHash: hash(sourceBytes), sourceBytes, records };
}
async function importSnapshot(tx, source) {
  if (!source || await tx.clientChatImport.findUnique({ where: { sourceHash: source.sourceHash } })) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('client-chat-history:v1'))::text`;
  if (await tx.clientChatImport.findUnique({ where: { sourceHash: source.sourceHash } })) return;
  for (let offset = 0; offset < source.records.length; offset += 500) {
    const batch = source.records.slice(offset, offset + 500);
    const old = new Set((await tx.clientChatLegacyRecord.findMany({ where: { recordKey: { in: batch.map(r => r.recordKey) } }, select: { recordKey: true } })).map(r => r.recordKey));
    const fresh = batch.filter(r => !old.has(r.recordKey));
    if (!fresh.length) continue;
    await tx.clientChatLegacyRecord.createMany({ data: fresh });
    const ids = [...new Set(fresh.map(r => r.clientId).filter(Boolean))];
    const clients = new Set((await tx.client.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(r => r.id));
    const messages = fresh.flatMap(record => {
      const row = record.payload, createdAt = historicalDate(row.created_at);
      // Unassignable records remain archived. Never attach them later merely
      // because a new client happens to acquire the old numeric identifier.
      if (!clients.has(record.clientId) || typeof row.text !== 'string' || !createdAt || !Number.isFinite(createdAt.getTime())) return [];
      return [{ legacyKey: record.recordKey, clientId: record.clientId, sender: 'Histórico · autor não verificado', senderType: 'LEGACY', text: row.text, message: row.text,
        messageType: 'TEXT', createdAt, isReadByAdmin: record.readByAdmin, isReadByClient: record.readByClient, seen: record.readByAdmin || record.readByClient }];
    });
    if (messages.length) await tx.clientMessage.createMany({ data: messages });
  }
  await tx.clientChatImport.create({ data: { sourceHash: source.sourceHash, sourceBytes: source.sourceBytes, messageCount: source.records.length } });
}
async function ensure() {
  const source = await snapshot();
  if (!source || await prisma.clientChatImport.findUnique({ where: { sourceHash: source.sourceHash } })) return;
  await prisma.$transaction(tx => importSnapshot(tx, source), { maxWait: 15000, timeout: 20000 });
}
const adminUnreadWhere = id => ({ ...(id ? { clientId: id } : {}), isReadByAdmin: false, OR: [{ senderType: 'CLIENT' }, { sender: 'Cliente' }, { senderType: 'LEGACY' }] });
module.exports = { snapshot, importSnapshot, ensure, adminUnreadWhere };
