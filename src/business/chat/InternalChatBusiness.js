'use strict';
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { normalizeRole } = require('../../utils/roles');
const dataPath = path.join(__dirname, '../../data/internalChat.json');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function actor(user) {
  const role = normalizeRole(user?.role);
  if (!['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(role)) fail(403, 'Conversa reservada à equipa.');
  const actorId = Number(user.userId || user.id);
  if (!Number.isSafeInteger(actorId) || actorId < 1) fail(403, 'Identidade inválida.');
  return { author: role, actorId, actorType: user.principalType || role,
    technicianId: role === 'ADMIN' ? null : Number(user.technicianId || (user.principalType !== 'USER' && user.id)) || null };
}
function load() {
  let raw;
  try { raw = fs.readFileSync(dataPath, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Histórico inválido; conteúdo preservado.');
  return rows;
}
function save(rows) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  const temporary = `${dataPath}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, JSON.stringify(rows, null, 2), { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, dataPath); }
  finally { fs.rmSync(temporary, { force: true }); }
}
function list(user) { actor(user); return load(); }
function create(user, body) {
  const identity = actor(user);
  if (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 4000) fail(400, 'Indique uma mensagem de 1 a 4000 caracteres.');
  // Keep the legacy history; synchronous read/replace is indivisible within one server process.
  const rows = load(), message = { id: randomUUID(), ...identity, text: body.text.trim(), created_at: new Date().toISOString() };
  rows.push(message); save(rows); return message;
}
module.exports = { list, create };
