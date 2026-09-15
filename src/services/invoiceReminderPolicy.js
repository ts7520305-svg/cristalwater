'use strict';
const { invoiceOpen } = require('./clientCreditService');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function requestId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail(400, 'Identificador do pedido de lembrete inválido.');
  return value.toLowerCase();
}
function assertEligible(invoice) {
  const client = invoice.client;
  if (!client?.active || String(client.status).toUpperCase() === 'PAUSED' || (client.pauseUntil && new Date(client.pauseUntil) > new Date()) || String(client.paymentReminderMode).toUpperCase() === 'DISABLED') fail(409, 'Os lembretes deste cliente estão desativados ou em pausa.');
  if (String(invoice.status).toUpperCase() === 'PAID' || Math.round(invoiceOpen(invoice) * 100) <= 0) fail(409, 'O documento não tem valor a cobrar.');
}
function modes(client) {
  const result = [];
  if (client.paymentReminderEmail !== false && (client.paymentReminderEmailAddress || client.fiscalEmail || client.email)) result.push('email');
  if (client.paymentReminderWhatsapp !== false && (client.paymentReminderWhatsappNumber || client.phone)) result.push('browser');
  return result;
}
module.exports = { requestId, assertEligible, modes };
