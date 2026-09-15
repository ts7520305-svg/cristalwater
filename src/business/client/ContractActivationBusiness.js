'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { paymentDetails, executePaymentRequest } = require('../../services/invoicePaymentRequestService');
const receipts = require('../finance/ClientReceiptBusiness');
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
async function activate(rawId, body = {}, user = null) {
  const actorId = Number(user?.id), actorRole = normalizeRole(user?.role);
  if (actorRole !== 'ADMIN' || !Number.isSafeInteger(actorId) || actorId <= 0) fail('Só a administração pode ativar contratos.', 403);
  const id = Number(rawId);
  if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail('Cliente inválido.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Dados de ativação inválidos.');
  const month = body.monthRef === undefined ? new Date().toISOString().slice(0, 7) : body.monthRef;
  if (typeof month !== 'string' || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(month)) fail('Mês inválido; use AAAA-MM.');
  const empty = body.amount === undefined || body.amount === '' || body.amount === 0 || body.amount === '0' || body.amount === '0.00';
  const details = empty ? { amountCents: 0, method: 'MANUAL', notes: '' } : paymentDetails(body);
  let request = null;
  if (body.requestId !== undefined) {
    if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) fail('Identificador da ativação inválido.');
    request = { scope: 'CONTRACT_ACTIVATION', requestId: body.requestId.toLowerCase(), clientId: id, month, ...details, actorId, actorRole };
  }
  return prisma.$transaction(tx => executePaymentRequest(tx, request, async () => {
    const key = `client-receipt:${id}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
    // Receipts lock invoices before the client. Take the same locks before
    // deciding whether this is the initial activation, then reuse that writer.
    if (details.amountCents > 0) await tx.$queryRaw`SELECT id FROM "Invoice" WHERE "clientId" = ${id} ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${id} FOR NO KEY UPDATE`;
    const current = await tx.client.findUnique({ where: { id } });
    if (!current) fail('Cliente não encontrado.', 404);
    const alreadyActive = current.contractActive && current.billingActive && current.active && current.status === 'ACTIVE' && !current.deletedAt;
    if (alreadyActive && details.amountCents > 0) fail('Contrato já ativo. Para outro recebimento, use o registo de pagamentos.', 409);
    if (alreadyActive) return { ok: true, client: current, alreadyActive: true, appliedAmount: 0, creditAdded: 0, creditBalance: current.creditBalance, message: 'Contrato já ativo.' };
    const receipt = details.amountCents > 0 ? await receipts.registerReceived(id, month, {
      amount: details.amountCents / 100, method: details.method, notes: details.notes,
    }, user, tx) : null;
    const client = await tx.client.update({ where: { id }, data: {
      contractActive: true, billingActive: true, contractActivatedAt: new Date(),
      status: 'ACTIVE', active: true, archiveStatus: 'ATIVO', deletedAt: null,
    } });
    await tx.userAuditLog.create({ data: {
      action: 'CONTRACT_ACTIVATED', actor: `ADMIN:${actorId}`, entity: 'Client', entityId: String(id),
      metadata: { clientId: id, month, amountCents: details.amountCents, requestId: request?.requestId || null, receipt },
    } });
    await tx.communicationLog.create({ data: { clientId: id, channel: 'CONTRACT_ACTIVATED',
      message: details.amountCents > 0 ? `Contrato ativado com recebimento de ${(details.amountCents / 100).toFixed(2)} EUR registado no histórico.` : 'Contrato ativado sem registo de novo recebimento.',
    } });
    return { ok: true, client, receipt, appliedAmount: receipt?.appliedAmount || 0, creditAdded: receipt?.creditAdded || 0,
      creditBalance: client.creditBalance, message: 'Contrato ativado. A faturação começa a partir desta data.' };
  }), { maxWait: 15000, timeout: 15000 });
}
module.exports = { activate };
