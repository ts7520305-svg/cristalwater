'use strict';
const { normalizeRole } = require('./roles');
const fail = (message, statusCode) => { throw Object.assign(Error(message), { statusCode }); };
const id = (value, maximum = 2147483647) => typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= maximum
  ? Number(value) : fail('Identificador inválido.', 400);

function principalClient(actor) {
  const role = normalizeRole(actor?.role);
  if (role === 'ADMIN') return null;
  // A User/Technician ID cannot establish a Client identity, even if IDs collide.
  if (role !== 'CLIENT' || actor.principalType && actor.principalType !== 'CLIENT') fail('Acesso reservado ao cliente autenticado.', 403);
  const clientId = Number(actor.clientId ?? actor.id);
  if (!Number.isSafeInteger(clientId) || clientId < 1 || clientId > 2147483647) fail('Cliente não confirmado.', 403);
  return clientId;
}

function scope(actor, rawClientId) {
  const ownClientId = principalClient(actor);
  if (rawClientId === undefined) return ownClientId;
  const clientId = id(rawClientId);
  if (ownClientId !== null && clientId !== ownClientId) fail('Acesso reservado ao cliente autenticado.', 403);
  return clientId;
}

module.exports = { scope, id };
