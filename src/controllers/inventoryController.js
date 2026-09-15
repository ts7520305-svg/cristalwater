const fs = require('fs');
const prisma = require('../prismaClient');
const { invalidateDashboardCache } = require('../services/dashboardCacheService');
const { normalizeProductName, normalizeUnit } = require('../utils/stockNormalizer');
const { toPublicUploadUrl } = require('../config/uploadPath');

function n(v, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function s(v) { return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim(); }
function stockName(v) { return normalizeProductName(s(v)); }
function stockUnit(v) { return normalizeUnit(s(v) || 'KG'); }

function parseItems(body) {
  if (Array.isArray(body.items)) return body.items;
  if (typeof body.items === 'string' && body.items.trim()) {
    try {
      const parsed = JSON.parse(body.items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function safeAudit(data) {
  try {
    if (!prisma?.auditTrail?.create) return null;
    return await prisma.auditTrail.create({ data });
  } catch (err) {
    console.error('[AUDIT_TRAIL_BACKGROUND_ERROR]', err.message);
    return null;
  }
}

const { upsertProduct } = require('../dal/InventoryProductRepository');

async function adjustBalance(tx,payload){return require('../dal/EquipmentStockRepository').adjustBalance(tx,{...payload,productName:stockName(payload.productName),unit:stockUnit(payload.unit)});}

async function listProducts(req, res) {
  const q = s(req.query.q);
  const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }] } : {};
  if (req.query.includeInactive !== 'true' && req.query.active !== 'all') where.active = true;
  const products = await prisma.inventoryProduct.findMany({ where, orderBy: [{ active: 'desc' }, { name: 'asc' }], take: 500 });
  res.json({ ok: true, products });
}

async function createProduct(req, res) {
  const product = await upsertProduct(req.body);
  res.status(201).json({ ok: true, product });
}


async function updateProduct(req, res) {
  try {
    const id = Number(req.params.id);
    const allowed = ['name', 'sku', 'brand', 'category', 'unit', 'defaultCost', 'minStockCentral', 'minStockVehicle', 'notes', 'active'];
    const data = {};
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
    if (data.defaultCost !== undefined) data.defaultCost = n(data.defaultCost, 0);
    if (data.minStockCentral !== undefined) data.minStockCentral = n(data.minStockCentral, 0);
    if (data.minStockVehicle !== undefined) data.minStockVehicle = n(data.minStockVehicle, 0);
    const product = await prisma.inventoryProduct.update({ where: { id }, data });
    invalidateDashboardCache('INVENTORY_PRODUCT_UPDATED');
    res.json({ ok: true, product });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function deleteProduct(req, res) {
  try {
    const id = Number(req.params.id);
    const [purchaseItems, balances, movements] = await Promise.all([
      prisma.stockPurchaseItem.count({ where: { productId: id } }).catch(() => 0),
      prisma.stockBalance.count({ where: { productId: id } }).catch(() => 0),
      prisma.stockMovement.count({ where: { productId: id } }).catch(() => 0),
    ]);
    if ((purchaseItems + balances + movements) > 0) {
      const product = await prisma.inventoryProduct.update({ where: { id }, data: { active: false, archiveStatus: 'ARQUIVADO', deletedAt: new Date() } });
      invalidateDashboardCache('INVENTORY_PRODUCT_ARCHIVED');
      return res.json({ ok: true, archived: true, product, message: 'Produto arquivado porque tem histórico de stock associado.' });
    }
    await prisma.inventoryProduct.delete({ where: { id } });
    invalidateDashboardCache('INVENTORY_PRODUCT_DELETED');
    res.json({ ok: true, deleted: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function restoreProduct(req, res) {
  try {
    const id = Number(req.params.id);
    const product = await prisma.inventoryProduct.update({ where: { id }, data: { active: true, archiveStatus: 'ATIVO', deletedAt: null } });
    invalidateDashboardCache('INVENTORY_PRODUCT_RESTORED');
    res.json({ ok: true, product });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}

async function getStock(req, res) {
  const where = {};
  if (req.query.scope) where.scope = String(req.query.scope);
  if (req.query.vehicleId) where.vehicleId = Number(req.query.vehicleId);
  const balances = await prisma.stockBalance.findMany({ where, orderBy: [{ scope: 'asc' }, { productName: 'asc' }] });
  res.json({ ok: true, balances });
}

async function listPurchases(req, res) {
  const purchases = await prisma.stockPurchase.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ ok: true, purchases });
}

async function createPurchase(req,res){
  let saved=false;
  try{
    const upload=req.file?{documentPath:toPublicUploadUrl('inventory',req.file.filename),documentName:req.file.originalname,documentHash:require('crypto').createHash('sha256').update(await fs.promises.readFile(req.file.path)).digest('hex')}:{};
    const result=await require('../business/operations/InventoryWriteBusiness').purchase(req.user,req.body,upload);saved=true;
    if(result.idempotent&&req.file)await fs.promises.unlink(req.file.path).catch(()=>null);
    invalidateDashboardCache('STOCK_PURCHASE_IN');return res.status(201).json(result);
  }catch(error){
    if(!saved&&req.file)await fs.promises.unlink(req.file.path).catch(()=>null);
    return res.status(error.status||(/^STOCK_/.test(error.message)?409:500)).json({ok:false,error:error.status||/^STOCK_/.test(error.message)?error.message:'Não foi possível registar a entrada de stock'});
  }
}

async function transferToVehicle(req,res){
  const items=parseItems(req.body).map(item=>item&&typeof item==='object'?{...item,productName:stockName(item.productName||item.name),unit:stockUnit(item.unit||'KG')}:item);
  try{
    const result=await require('../business/operations/EquipmentStockOsBusiness').transferStock({...req.body,items,direction:'CENTRAL_TO_VEHICLE',userId:req.user?.id},`${req.user?.role}:${req.user?.id}`,req.user);
    if(!result.ok)return res.status(result.status||400).json(result);
    invalidateDashboardCache('STOCK_TRANSFER_TO_VEHICLE');return res.json(result);
  }catch(error){return res.status(/^STOCK_/.test(error.message)?409:500).json({ok:false,error:/^STOCK_/.test(error.message)?error.message:'Não foi possível confirmar a transferência'});}
}

async function consumeMaterial(req,res){
  try{
    const result=await require('../business/operations/InventoryWriteBusiness').consume(req.user,req.body);
    invalidateDashboardCache('STOCK_CONSUMPTION');return res.json(result);
  }catch(error){return res.status(error.status||(/^STOCK_/.test(error.message)?409:500)).json({ok:false,error:error.status||/^STOCK_/.test(error.message)?error.message:'Não foi possível registar o consumo'});}
}

async function auditCount(req,res){
  const vehicleId=Number(req.body.vehicleId),productName=stockName(req.body.productName||req.body.name),unit=stockUnit(req.body.unit);
  try{
    const transactionResult=await require('../business/operations/InventoryCountBusiness').count(req.user,{...req.body,productName,unit});
    if(!transactionResult.ok)return res.status(transactionResult.status||400).json(transactionResult);
    if (!transactionResult.idempotent && transactionResult.desvio !== 0) {
      await safeAudit({
        eventType: 'STOCK_AUDIT',
        entity: 'StockBalance',
        entityId: transactionResult.balance.id,
        vehicleId,
        action: 'V22_STOCK_AUDIT_DEVIATION',
        message: `ALERTA DIVERGÊNCIA: Viatura ${vehicleId}, Produto: ${productName}. Calculado: ${transactionResult.digitalQuantity} ${unit}, Físico: ${transactionResult.physicalQuantity} ${unit}.`,
        metadata: { desvio: transactionResult.desvio },
      });
    }

    invalidateDashboardCache('STOCK_AUDIT_COUNT');
    return res.json({ ok: true, ...transactionResult });
  } catch (err) {
    return res.status(/^STOCK_/.test(err.message)?409:500).json({ ok: false, error: /^STOCK_/.test(err.message)?err.message:'Não foi possível confirmar a contagem' });
  }
}

async function listMovements(req, res) {
  const where = {};
  if (req.query.vehicleId) where.vehicleId = Number(req.query.vehicleId);
  if (req.query.movementType) where.movementType = String(req.query.movementType);
  const movements = await prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
  res.json({ ok: true, movements });
}

async function report(req, res) {
  const [balances, lastPurchases, lastMovements] = await Promise.all([
    prisma.stockBalance.findMany({ orderBy: [{ scope: 'asc' }, { productName: 'asc' }], take: 1000 }),
    prisma.stockPurchase.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, take: 10 }).catch(() => []),
    prisma.stockMovement.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);
  res.json({ ok: true, balances, lastPurchases, lastMovements });
}

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  getStock,
  listPurchases,
  createPurchase,
  transferToVehicle,
  consumeMaterial,
  auditCount,
  listMovements,
  report,
  adjustBalance,
};
