const stock = require('./visitProductStockReconciliation');
async function reconcile(tx, visit, products) {
  const recorded = await tx.chemicalUsage.findMany({ where: { visitId: visit.id } });
  const previous = Array.isArray(visit.chemicalsJson) ? visit.chemicalsJson : recorded;
  if (!stock.equivalent(previous, recorded, false)) throw Object.assign(Error('Os registos de produtos divergem. Peça revisão ao escritório.'), { statusCode: 409, code: 'STOCK_CORRECTION_REVIEW' });
  return stock.reconcile(tx, visit, previous, products);
}
module.exports = { reconcile };
