'use strict';
const r = require('./expenseLedgerRules');
const { cents, sum } = require('./monthlyFinancialProjection');
const stockSelect = { id: true, supplierId: true, supplierName: true, invoiceNumber: true, invoiceDate: true, totalAmount: true, status: true, documentName: true, documentPath: true, items: { select: { id: true, productName: true, quantity: true, unit: true, unitCost: true, totalCost: true }, orderBy: { id: 'asc' } } };
const maintenanceSelect = { id: true, vehicleId: true, title: true, type: true, status: true, dueDate: true, completedAt: true, cost: true };
function project(type, row) {
  const stock = type === 'STOCK_PURCHASE';
  const snapshot = stock ? { id: row.id, supplierId: row.supplierId, supplierName: row.supplierName, invoiceNumber: row.invoiceNumber, invoiceDate: r.day(row.invoiceDate), totalAmount: row.totalAmount, status: row.status, documentName: row.documentName, hasDocument: !!row.documentPath, items: row.items } : { ...row, dueDate: r.day(row.dueDate), completedAt: r.day(row.completedAt) };
  const amount = cents(stock ? row.totalAmount : row.cost);
  const lines = stock ? sum(row.items.map(item => cents(item.totalCost))) : amount;
  const reliable = amount !== null && amount > 0 && (!stock || row.items.length > 0 && lines === amount);
  return { type, id: row.id, hash: r.hash({ type, snapshot }), snapshot, suggested: { title: stock ? 'Compra de stock' : row.title, supplierId: stock ? row.supplierId : null, supplierName: stock ? row.supplierName || '' : '', documentNumber: stock ? row.invoiceNumber || '' : '', expenseDate: stock ? r.day(row.invoiceDate) : r.day(row.completedAt), category: stock ? 'STOCK' : 'VEHICLE', amountCents: reliable ? amount : null }, warning: stock ? 'Confirme o documento e o total devido. Uma compra de stock não equivale ao custo dos produtos consumidos.' : 'O custo da manutenção pode ser uma estimativa. Confirme o documento real; a data da tarefa não é um vencimento financeiro.' };
}
async function source(db, type, id, lock = false) {
  r.id(id);
  if (!['STOCK_PURCHASE', 'VEHICLE_MAINTENANCE'].includes(type)) r.fail('Origem inválida.');
  if (lock) {
    if (type === 'STOCK_PURCHASE') {
      await db.$queryRaw`SELECT id FROM "StockPurchase" WHERE id=${id} FOR UPDATE`;
      await db.$queryRaw`SELECT id FROM "StockPurchaseItem" WHERE "purchaseId"=${id} FOR SHARE`;
    }
    else await db.$queryRaw`SELECT id FROM "VehicleMaintenanceRecord" WHERE id=${id} FOR SHARE`;
  }
  const row = type === 'STOCK_PURCHASE' ? await db.stockPurchase.findUnique({ where: { id }, select: stockSelect }) : await db.vehicleMaintenanceRecord.findUnique({ where: { id }, select: maintenanceSelect });
  return row ? project(type, row) : null;
}
async function fingerprints(db, expenses) {
  const stockIds = expenses.map(e => e.stockPurchaseId).filter(Boolean), vehicleIds = expenses.map(e => e.maintenanceId).filter(Boolean);
  const [stocks, vehicles] = await Promise.all([
    db.stockPurchase.findMany({ where: { id: { in: stockIds } }, select: stockSelect }),
    db.vehicleMaintenanceRecord.findMany({ where: { id: { in: vehicleIds } }, select: maintenanceSelect })
  ]);
  return new Map([...stocks.map(row => ['STOCK_PURCHASE:' + row.id, project('STOCK_PURCHASE', row).hash]), ...vehicles.map(row => ['VEHICLE_MAINTENANCE:' + row.id, project('VEHICLE_MAINTENANCE', row).hash])]);
}
async function list(db, { type, q = '', page = 1 }) {
  if (!['STOCK_PURCHASE', 'VEHICLE_MAINTENANCE'].includes(type)) r.fail('Origem inválida.');
  r.text(q, 160); r.id(page);
  const stock = type === 'STOCK_PURCHASE', model = stock ? db.stockPurchase : db.vehicleMaintenanceRecord;
  const where = q ? { OR: (stock ? ['supplierName', 'invoiceNumber'] : ['title']).map(key => ({ [key]: { contains: q, mode: 'insensitive' } })) } : {};
  const [total, records] = await Promise.all([model.count({ where }), model.findMany({ where, select: stock ? stockSelect : maintenanceSelect, orderBy: { id: 'desc' }, skip: (page - 1) * 10, take: 10 })]);
  const registered = await db.companyExpense.findMany({ where: { [stock ? 'stockPurchaseId' : 'maintenanceId']: { in: records.map(row => row.id) } }, select: { id: true, stockPurchaseId: true, maintenanceId: true } });
  return { type, q, page, pageSize: 10, total, rows: records.map(row => ({ ...project(type, row), registeredExpenseId: registered.find(e => (stock ? e.stockPurchaseId : e.maintenanceId) === row.id)?.id || null })) };
}
module.exports = { source, fingerprints, list };
