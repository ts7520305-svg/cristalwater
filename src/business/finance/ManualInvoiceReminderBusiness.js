'use strict';
const documents = require('./InvoiceDocumentAccessBusiness');
const outbound = require('./InvoiceOutboundDeliveryBusiness');
const gate = require('../../config/externalIntegrations');
const policy = require('../../services/invoiceReminderPolicy');
async function send(rawId, user, baseUrl, body = {}) {
  gate.assertExternalOperationAllowed('external_notifications');
  const requestId = policy.requestId(body?.requestId);
  const invoice = await documents.sendable(rawId, user);
  policy.assertEligible(invoice);
  const modes = policy.modes(invoice.client);
  if (!modes.length) throw Object.assign(new Error('O cliente não tem um canal externo de lembrete ativo com contacto registado.'), { statusCode: 409 });
  const channels = {};
  for (const mode of modes) {
    const channel = mode === 'email' ? 'email' : 'whatsapp';
    try { channels[channel] = await outbound.send(rawId, user, mode, baseUrl, {}, { purpose: 'payment-reminder', requestId }); }
    catch (error) { channels[channel] = { ok: false, prepared: false, deliveryStatus: 'NOT_SENT', requiresReview: true,
      error: error.statusCode && error.statusCode < 500 ? error.message : 'Não foi possível preparar este canal. Verifique a configuração antes de repetir o pedido.' }; }
  }
  const results = Object.values(channels), accepted = results.filter(row => row.deliveryStatus === 'PROVIDER_ACCEPTED').length;
  const unknown = results.some(row => ['UNKNOWN', 'PENDING_CONFIRMATION'].includes(row.deliveryStatus));
  const deliveryStatus = unknown ? 'REVIEW_REQUIRED' : accepted === results.length ? 'PROVIDER_ACCEPTED' : accepted ? 'PARTIAL' : results.every(row => row.ok && row.prepared) ? 'PREPARED' : 'NOT_SENT';
  return { ok: results.every(row => row.ok) && !unknown, invoiceId: invoice.id, requestId, channels, deliveryStatus, delivered: false,
    requiresReview: results.some(row => row.requiresReview || !row.ok),
    message: deliveryStatus === 'PREPARED' ? 'Lembrete preparado. Conclua o envio no WhatsApp.' : 'Consulte o resultado de cada canal. A entrega ao cliente ainda não está confirmada.' };
}
module.exports = { send };
