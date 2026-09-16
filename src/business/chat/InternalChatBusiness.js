'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const { createHash } = require('node:crypto');
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const dataPath = path.join(__dirname, '../../data/internalChat.json');
const hash = value => createHash('sha256').update(value).digest('hex');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }

function actor(user) {
  const author = normalizeRole(user?.role);
  if (!['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(author)) fail(403, 'Conversa reservada à equipa.');
  // Stable account namespaces distinguish User IDs from Technician IDs, also
  // across old/new tokens and role changes.
  const actorType = user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN'
    : user.principalType === 'USER' || author === 'ADMIN' ? 'USER' : 'TECHNICIAN';
  const actorId = Number(actorType === 'TECHNICIAN' ? user.technicianId || user.id : user.userId || user.id);
  if (!Number.isSafeInteger(actorId) || actorId < 1 || actorId > 2147483647) fail(403, 'Identidade inválida.');
  const technicianId = author === 'ADMIN' ? null : Number(user.technicianId || (actorType === 'TECHNICIAN' && actorId));
  if (author !== 'ADMIN' && (!Number.isSafeInteger(technicianId) || technicianId < 1 || technicianId > 2147483647)) fail(403, 'Perfil de campo por associar.');
  const subject = actorType === 'ENV_ADMIN' ? hash(String(user.email || '').trim().toLowerCase()) : actorId;
  return { author, actorId, actorType, technicianId, actorKey: `${actorType}:${subject}` };
}

function request(body) {
  if (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 4000) fail(400, 'Indique uma mensagem de 1 a 4000 caracteres.');
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) fail(400, 'Identifique o envio com um UUID e conserve-o ao repetir.');
  return { text: body.text.trim(), requestId: body.requestId.toLowerCase() };
}

function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw Error('Número inválido no histórico; conteúdo preservado.');
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function snapshot() {
  let sourceText;
  try { sourceText = await fs.readFile(dataPath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const rows = JSON.parse(sourceText);
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Histórico inválido; conteúdo preservado.');
  const occurrences = new Map();
  const messages = rows.map(legacyPayload => {
    const fingerprint = hash(canonical(legacyPayload)), occurrence = (occurrences.get(fingerprint) || 0) + 1;
    occurrences.set(fingerprint, occurrence);
    // Preserve even identical historical rows. Reformatting or appending to the
    // old file cannot import its existing prefix again. Never infer its author.
    return { messageId: `legacy-${fingerprint}-${occurrence}`, legacyPayload };
  });
  return { sourceHash: hash(sourceText), sourceText, messages };
}

async function importSnapshot(tx, source) {
  if (!source || await tx.internalChatImport.findUnique({ where: { sourceHash: source.sourceHash } })) return;
  for (let offset = 0; offset < source.messages.length; offset += 500) {
    await tx.internalChatMessage.createMany({ data: source.messages.slice(offset, offset + 500), skipDuplicates: true });
  }
  // The original JSON is retained both on disk and in the database backup.
  await tx.internalChatImport.create({ data: { sourceHash: source.sourceHash, sourceText: source.sourceText, messageCount: source.messages.length } });
}

function present(row) {
  if (row.legacyPayload !== null) return { ...row.legacyPayload, recordId: row.messageId, source: 'LEGACY', identityVerified: false };
  return { id: row.messageId, recordId: row.messageId, author: row.author, actorId: row.actorId, actorType: row.actorType,
    technicianId: row.technicianId, text: row.text, requestId: row.requestId, created_at: row.createdAt.toISOString(), source: 'DATABASE', identityVerified: true };
}

async function execute(user, body, writing) {
  const identity = actor(user), input = writing ? request(body) : null, source = await snapshot();
  return prisma.$transaction(async tx => {
    // One short database lock coordinates imports and writes across processes.
    // Unique database keys also protect both receipts and historical identities.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('internal-staff-chat:v1'))::text`;
    await importSnapshot(tx, source);
    if (!writing) return (await tx.internalChatMessage.findMany({ orderBy: { id: 'asc' } })).map(present);
    const where = { actorKey_requestId: { actorKey: identity.actorKey, requestId: input.requestId } };
    const previous = await tx.internalChatMessage.findUnique({ where });
    if (previous) {
      if (previous.text !== input.text) fail(409, 'Este pedido já foi usado para outra mensagem. Conserve o texto original ao repetir.');
      return { message: present(previous), replayed: true };
    }
    const message = await tx.internalChatMessage.create({ data: { ...identity, ...input } });
    return { message: present(message), replayed: false };
  }, { maxWait: 15000, timeout: 20000 });
}

module.exports = { list: user => execute(user, null, false), create: (user, body) => execute(user, body, true) };
