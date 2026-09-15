'use strict';
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const dataPath = path.join(__dirname, '../../data/clientChatMessages.json');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function actor(user, rawId) {
  const role = normalizeRole(user?.role), client = role === 'CLIENT';
  if (!['ADMIN', 'TEAM_LEADER', 'CLIENT'].includes(role)) fail(403, 'Sem permissão para esta conversa.');
  const id = Number(rawId);
  if (!/^[1-9]\d*$/.test(String(rawId)) || !Number.isSafeInteger(id) || id > 2147483647) fail(400, 'Cliente inválido.');
  if (client && id !== Number(user.clientId || user.id)) fail(403, 'Sem permissão para esta conversa.');
  return { id: String(id), role: client ? 'CLIENT' : 'ADMIN' };
}
function load() {
  let raw;
  try { raw = fs.readFileSync(dataPath, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object')) throw Error('Histórico inválido; conteúdo preservado.');
  return rows;
}
function save(rows) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  const temporary = `${dataPath}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, JSON.stringify(rows, null, 2), { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, dataPath); }
  finally { fs.rmSync(temporary, { force: true }); }
}
function list(user, rawId) {
  const { id } = actor(user, rawId);
  return load().filter(m => String(m.clientId) === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}
function unread(user) {
  if (!['ADMIN', 'TEAM_LEADER'].includes(normalizeRole(user?.role))) fail(403, 'Sem permissão para esta consulta.');
  return { unreadCount: load().filter(m => m.from === 'CLIENT' && !m.readByAdmin).length };
}
async function create(user, rawId, body = {}) {
  const { id, role } = actor(user, rawId);
  if (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 10000) fail(400, 'Mensagem inválida.');
  if (!await prisma.client.findUnique({ where: { id: Number(id) }, select: { id: true } })) fail(404, 'Cliente não encontrado.');
  const rows = load();
  const message = { id: randomUUID(), clientId: id, from: role, text: body.text.trim(), created_at: new Date().toISOString(), readByAdmin: role === 'ADMIN', readByClient: role === 'CLIENT' };
  rows.push(message); save(rows); return message;
}
function markRead(user, rawId) {
  const { id, role } = actor(user, rawId), key = role === 'CLIENT' ? 'readByClient' : 'readByAdmin';
  save(load().map(m => String(m.clientId) === id ? { ...m, [key]: true } : m));
  return { ok: true };
}
module.exports = { list, unread, create, markRead };
