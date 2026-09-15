'use strict';

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function text(value, limit, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > limit) fail('Dados do pagamento inválidos.');
  return value.trim();
}

function paymentDetails(body) {
  if (!['number', 'string'].includes(typeof body.amount) || (typeof body.amount === 'string' && !/^\d+(\.\d{1,2})?$/.test(body.amount.trim()))) fail('Indica um valor válido, com até dois decimais.');
  const amount = Number(body.amount), amountCents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(amountCents) || amountCents <= 0 || Math.abs(amount * 100 - amountCents) > 0.000001) fail('Indica um valor válido, com até dois decimais.');
  return { amountCents, method: text(body.method, 40, 'MANUAL').toUpperCase() || 'MANUAL', notes: text(body.notes, 2000) };
}

function preparePaymentRequest(invoiceId, body, user) {
  if (body.requestId === undefined) return null; // Existing integrations remain compatible.
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) fail('Identificador do pagamento inválido.');
  const id = Number(invoiceId), actorId = Number(user?.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(actorId) || actorId <= 0 || !user?.role) fail('Fatura ou responsável inválido.');
  return {
    requestId: body.requestId.toLowerCase(), invoiceId: id, ...paymentDetails(body),
    actorId, actorRole: String(user.role).toUpperCase(),
  };
}

function prepareClientPaymentRequest(clientId, month, body, user) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) === 0) fail('Mês do recebimento inválido.');
  const request = preparePaymentRequest(clientId, body, user);
  if (!request) return null;
  const { invoiceId, ...details } = request;
  return { scope: 'CLIENT', ...details, clientId: invoiceId, month };
}

async function executePaymentRequest(tx, request, work) {
  if (!request) return work();
  const sourceKey = `invoice-payment:${request.requestId}`, fingerprint = JSON.stringify(request);
  // A global key also prevents reuse on another invoice, account or API.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
  const previous = await tx.operationalReminder.findUnique({ where: { sourceKey } });
  if (previous) {
    if (previous.metadata?.fingerprint !== fingerprint) fail('Identificador já utilizado com outros dados ou responsável.', 409);
    return { ...previous.metadata.result, idempotent: true };
  }
  const result = await work();
  if (result?.ok === false) return result;
  const credit = Number(result.creditAdded ?? result.surplusAmount ?? 0);
  const saved = JSON.parse(JSON.stringify({
    ...result, ok: true, method: result.method || request.method, creditAdded: credit, surplusAmount: credit,
    requestReceipt: { version: 1, ...request, appliedCents: Math.round(Number(result.appliedAmount) * 100), creditCents: Math.round(credit * 100) },
  }));
  await tx.operationalReminder.create({ data: {
    sourceKey, title: 'Pagamento registado', dueDate: new Date(), isCompleted: true,
    metadata: { fingerprint, result: saved },
  } });
  return saved;
}

module.exports = { preparePaymentRequest, prepareClientPaymentRequest, paymentDetails, executePaymentRequest };
