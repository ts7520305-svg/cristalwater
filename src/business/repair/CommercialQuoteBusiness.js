const repository = require('../../dal/RepairRepository');

function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function number(value, label, min, max) {
  if (value === null || value === '' || typeof value === 'boolean' || !['string','number'].includes(typeof value)) invalid(`${label}: valor obrigatório`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) invalid(`${label}: valor inválido`);
  return n;
}
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
function calculate(payload = {}) {
  if (!Array.isArray(payload.lines) || !payload.lines.length || payload.lines.length > 100) invalid('Indique entre 1 e 100 linhas');
  const lines = payload.lines.map((line, i) => {
    if (!line || typeof line !== 'object') invalid(`Linha ${i + 1} inválida`);
    const description = String(line.description || '').trim();
    if (!description || description.length > 300) invalid('Descrição obrigatória, até 300 caracteres');
    if (!['MATERIAL','LABOR','OTHER'].includes(line.type)) invalid('Tipo de linha inválido');
    const quantity = number(line.quantity, 'Quantidade', 0.001, 100000);
    const unitCost = money(number(line.unitCost, 'Custo unitário', 0, 1000000));
    const marginPercent = number(line.marginPercent, 'Margem', 0, 95);
    // Gross margin on selling price; 20% margin on cost 80 gives selling price 100.
    const unitPrice = money(unitCost / (1 - marginPercent / 100));
    const cost = money(quantity * unitCost), total = money(quantity * unitPrice);
    return { type: line.type, description, quantity, unitCost, marginPercent, unitPrice, cost, total };
  });
  const subtotal = money(lines.reduce((n, l) => n + l.total, 0));
  const totalCost = money(lines.reduce((n, l) => n + l.cost, 0));
  const discountPercent = number(payload.discountPercent ?? 0, 'Desconto', 0, 100);
  const taxPercent = number(payload.taxPercent, 'Taxa de IVA', 0, 100);
  const discount = money(subtotal * discountPercent / 100), net = money(subtotal - discount);
  if (net <= 0 || net > 10000000) invalid('Total deve ser positivo e não exceder 10 milhões');
  const tax = money(net * taxPercent / 100), total = money(net + tax), profit = money(net - totalCost);
  const validityDays = number(payload.validityDays ?? 15, 'Validade em dias', 1, 365);
  if (!Number.isInteger(validityDays)) invalid('Validade deve ser um número inteiro');
  const terms = String(payload.terms || '').trim();
  if (terms.length > 3000) invalid('Condições demasiado longas');
  return { currency: 'EUR', lines, subtotal, totalCost, discountPercent, discount, net, taxPercent, tax, total, profit,
    effectiveMarginPercent: money(profit / net * 100), validityDays, terms, belowCost: net < totalCost };
}
async function list(repairId) {
  const id = number(repairId, 'Reparação', 1, 2147483647);
  if (!Number.isInteger(id)) invalid('Reparação inválida');
  return repository.prisma.repairQuote.findMany({ where: { repairId: id }, orderBy: { version: 'desc' } });
}
async function save(repairId, payload, actor) {
  let snapshot, id;
  try {
    snapshot = calculate(payload); id = number(repairId, 'Reparação', 1, 2147483647);
    if (!Number.isInteger(id) || !Number.isInteger(payload.expectedVersion) || payload.expectedVersion < 0) invalid('Versão ou reparação inválida');
    if (snapshot.belowCost && payload.confirmBelowCost !== true) invalid('Total abaixo do custo: confirme explicitamente');
  } catch (error) { if (error.status === 400) return { ok: false, status: 400, error: error.message }; throw error; }
  return repository.transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Repair" WHERE id = ${id} FOR UPDATE`;
    const repair = await tx.repair.findUnique({ where: { id } });
    if (!repair) return { ok: false, status: 404, error: 'Reparação não encontrada' };
    if (!['PENDING','DIAGNOSED','QUOTE_REQUESTED','QUOTED'].includes(repair.status)) return { ok: false, status: 409, error: 'Reparação já aprovada ou encerrada; orçamento bloqueado' };
    const latest = await tx.repairQuote.findFirst({ where: { repairId: id }, orderBy: { version: 'desc' } });
    if ((latest?.version || 0) !== payload.expectedVersion) return { ok: false, status: 409, error: 'Orçamento alterado por outra sessão. Recarregue antes de gravar.' };
    const createdAt = new Date();
    snapshot.validUntil = new Date(createdAt.getTime() + snapshot.validityDays * 86400000).toISOString();
    const quote = await tx.repairQuote.create({ data: { repairId: id, version: payload.expectedVersion + 1, snapshot, createdBy: actor, createdAt } });
    const updated = await tx.repair.update({ where: { id }, data: { status: 'QUOTED', unitPrice: snapshot.net / Math.max(1, repair.quantity), totalPrice: snapshot.net } });
    await tx.userAuditLog.create({ data: { action: 'REPAIR_QUOTE_SAVED', metadata: { repairId: id, quoteId: quote.id, version: quote.version, actor } } });
    return { ok: true, repair: updated, quote };
  });
}
module.exports = { calculate, list, save };
