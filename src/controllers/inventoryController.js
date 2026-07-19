const path = require('path');
const fs = require('fs');
const prisma = require('../prismaClient');
const { invalidateDashboardCache } = require('../services/dashboardCacheService');
const { normalizeProductName, normalizeUnit } = require('../utils/stockNormalizer');
const { toPublicUploadUrl } = require('../config/uploadPath');

function n(v, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function s(v) { return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim(); }
function stockName(v) { return normalizeProductName(s(v)); }
function stockUnit(v) { return normalizeUnit(s(v) || 'KG'); }

const STOCK_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable',
  maxWait: 15000,
  timeout: 15000,
};

function isUniqueConstraintError(err) {
  return err && (err.code === 'P2002' || String(err.message || '').includes('Unique constraint'));
}

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

async function upsertProduct(raw, client = prisma) {
  const { name, sku, brand, category, unit, unitCost } = raw || {};
  const productName = stockName(name || raw?.productName);
  const productUnit = stockUnit(unit);
  const cleanSku = s(sku);
  const data = {
    name: productName,
    brand: s(brand) || null,
    category: s(category) || 'CHEMICAL',
    unit: productUnit,
    defaultCost: n(unitCost, 0),
  };

  if (!productName) return null;

  // Tranca lógica por produto/unidade durante a transação PostgreSQL.
  // Evita corrida findFirst -> create quando várias faturas entram em simultâneo.
  if (client?.$executeRawUnsafe) {
    const lockKey = `${productName}:${productUnit}`;
    await client.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', lockKey).catch(() => null);
  }

  try {
    if (cleanSku) {
      return await client.inventoryProduct.upsert({
        where: { sku: cleanSku },
        update: data,
        create: { ...data, sku: cleanSku },
      });
    }

    const existing = await client.inventoryProduct.findFirst({
      where: { name: { equals: productName, mode: 'insensitive' }, unit: productUnit },
    });

    if (existing) {
      return await client.inventoryProduct.update({
        where: { id: existing.id },
        data: {
          category: data.category || existing.category,
          defaultCost: n(unitCost, existing.defaultCost || 0),
          active: true,
            archiveStatus: "ATIVO",
            deletedAt: null,
        },
      });
    }

    return await client.inventoryProduct.create({ data });
  } catch (err) {
    // Fallback defensivo para colisões de concorrência ou constraint única em DBs já migradas.
    if (isUniqueConstraintError(err)) {
      const existing = await client.inventoryProduct.findFirst({
        where: cleanSku
          ? { OR: [{ sku: cleanSku }, { name: { equals: productName, mode: 'insensitive' }, unit: productUnit }] }
          : { name: { equals: productName, mode: 'insensitive' }, unit: productUnit },
      });
      if (existing) {
        return client.inventoryProduct.update({
          where: { id: existing.id },
          data: {
            category: data.category || existing.category,
            defaultCost: n(unitCost, existing.defaultCost || 0),
            active: true,
            archiveStatus: 'ATIVO',
            deletedAt: null,
          },
        });
      }
    }
    throw err;
  }
}

async function adjustBalance(tx, { scope = 'CENTRAL', vehicleId = null, productId = null, productName, category = 'CHEMICAL', unit = 'KG', delta }) {
  const name = stockName(productName);
  const u = stockUnit(unit);
  const sc = s(scope) || 'CENTRAL';
  const vehicleKey = vehicleId ? Number(vehicleId) : null;
  const amount = n(delta, 0);

  if (!name) throw new Error('Produto inválido para movimentação de stock.');

  const existing = await tx.stockBalance.findUnique({
    where: { scope_vehicleId_productName_unit: { scope: sc, vehicleId: vehicleKey, productName: name, unit: u } },
  });

  const available = n(existing?.quantity, 0);
  const nextQuantity = available + amount;

  if (amount < 0 && (!existing || nextQuantity < 0)) {
    throw new Error(`CRITICAL_STOCK_ERROR: Operação negada. Saldo insuficiente para o consumível ${name}. Disponível: ${available} ${u}.`);
  }

  if (existing) {
    return tx.stockBalance.update({
      where: { id: existing.id },
      data: {
        quantity: nextQuantity,
        productId: productId || existing.productId,
        category: category || existing.category,
      },
    });
  }

  if (amount < 0) {
    throw new Error(`CRITICAL_STOCK_ERROR: Operação negada. Produto ${name} não existe no stock ${sc}.`);
  }

  return tx.stockBalance.create({
    data: { scope: sc, vehicleId: vehicleKey, productId, productName: name, category, unit: u, quantity: amount },
  });
}

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

async function createPurchase(req, res) {
  const items = parseItems(req.body);
  if (!items.length) return res.status(400).json({ ok: false, error: 'Sem linhas de produto para adicionar ao stock.' });

    const upload = req.file ? { documentPath: toPublicUploadUrl('inventory', req.file.filename), documentName: req.file.originalname } : {};

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.stockPurchase.create({
      data: {
        supplierName: s(req.body.supplierName) || null,
        invoiceNumber: s(req.body.invoiceNumber) || null,
        invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : null,
        totalAmount: n(req.body.totalAmount, 0),
        notes: s(req.body.notes) || null,
        createdBy: s(req.body.createdBy) || 'admin',
        ...upload,
      },
    });

    const createdItems = [];
    for (const raw of items) {
      const product = await upsertProduct(raw, tx);
      const productName = stockName(raw.productName || raw.name || (product && product.name));
      const unit = stockUnit(raw.unit || (product && product.unit) || 'KG');
      const category = s(raw.category) || (product && product.category) || 'CHEMICAL';
      const qty = n(raw.quantity, 0);
      if (!productName || qty <= 0) continue;
      const unitCost = n(raw.unitCost, 0);

      const item = await tx.stockPurchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productId: product ? product.id : null,
          productName,
          category,
          unit,
          quantity: qty,
          unitCost,
          totalCost: n(raw.totalCost, qty * unitCost),
          lot: s(raw.lot) || null,
          notes: s(raw.notes) || null,
        },
      });

      await adjustBalance(tx, { scope: 'CENTRAL', productId: product ? product.id : null, productName, category, unit, delta: qty });
      await tx.stockMovement.create({
        data: {
          movementType: 'PURCHASE_IN',
          scopeTo: 'CENTRAL',
          productId: product ? product.id : null,
          productName,
          category,
          unit,
          quantity: qty,
          purchaseId: purchase.id,
          documentPath: upload.documentPath || null,
          notes: `Entrada por fatura ${purchase.invoiceNumber || ''}`.trim(),
          createdBy: s(req.body.createdBy) || 'admin',
        },
      });
      createdItems.push(item);
    }

    return { purchase, items: createdItems };
  }, STOCK_TRANSACTION_OPTIONS);

  invalidateDashboardCache('STOCK_PURCHASE_IN');
  res.status(201).json({ ok: true, ...result });
}

async function transferToVehicle(req, res) {
  const vehicleId = Number(req.body.vehicleId);
  const items = parseItems(req.body);
  if (!vehicleId || !items.length) return res.status(400).json({ ok: false, error: 'vehicleId e items são obrigatórios.' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const raw of items) {
        const productName = stockName(raw.productName || raw.name);
        const unit = stockUnit(raw.unit || 'KG');
        const category = s(raw.category) || 'CHEMICAL';
        const qty = n(raw.quantity, 0);
        if (!productName || qty <= 0) continue;

        await adjustBalance(tx, { scope: 'CENTRAL', productName, category, unit, delta: -qty });
        await adjustBalance(tx, { scope: 'VEHICLE', vehicleId, productName, category, unit, delta: qty });
        const mov = await tx.stockMovement.create({
          data: { movementType: 'TRANSFER_TO_VEHICLE', scopeFrom: 'CENTRAL', scopeTo: 'VEHICLE', vehicleId, productName, category, unit, quantity: qty, notes: s(req.body.notes) || null, createdBy: s(req.body.createdBy) || 'admin' },
        });
        out.push(mov);
      }
      return out;
    }, STOCK_TRANSACTION_OPTIONS);

    invalidateDashboardCache('STOCK_TRANSFER_TO_VEHICLE');
    res.json({ ok: true, movements: result });
  } catch (err) {
    await safeAudit({
      eventType: 'STOCK_CRITICAL_FAIL',
      entity: 'StockBalance',
      vehicleId,
      action: 'V22_STOCK_TRANSFER_FAILED',
      message: err.message,
      metadata: { items },
    });
    res.status(409).json({ ok: false, error: err.message });
  }
}

async function consumeMaterial(req, res) {
  const vehicleId = req.body.vehicleId ? Number(req.body.vehicleId) : null;
  const productName = stockName(req.body.productName || req.body.name);
  const unit = stockUnit(req.body.unit || 'KG');
  const category = s(req.body.category) || 'CHEMICAL';
  const qty = n(req.body.quantity, 0);

  if (!productName || qty <= 0) return res.status(400).json({ ok: false, error: 'Produto e quantidade são obrigatórios.' });

  try {
    const mov = await prisma.$transaction(async (tx) => {
      await adjustBalance(tx, { scope: vehicleId ? 'VEHICLE' : 'CENTRAL', vehicleId, productName, category, unit, delta: -qty });
      return tx.stockMovement.create({
        data: {
          movementType: 'CONSUMPTION',
          scopeFrom: vehicleId ? 'VEHICLE' : 'CENTRAL',
          vehicleId,
          productName,
          category,
          unit,
          quantity: qty,
          workGuideId: req.body.workGuideId ? Number(req.body.workGuideId) : null,
          visitId: req.body.visitId ? Number(req.body.visitId) : null,
          clientId: req.body.clientId ? Number(req.body.clientId) : null,
          poolId: req.body.poolId ? Number(req.body.poolId) : null,
          technicianId: req.body.technicianId ? Number(req.body.technicianId) : null,
          notes: s(req.body.notes) || null,
          createdBy: s(req.body.createdBy) || 'system',
        },
      });
    }, STOCK_TRANSACTION_OPTIONS);

    invalidateDashboardCache('STOCK_CONSUMPTION');
    res.json({ ok: true, movement: mov });
  } catch (err) {
    await safeAudit({
      eventType: 'STOCK_CRITICAL_FAIL',
      entity: 'StockBalance',
      vehicleId,
      action: 'V22_STOCK_NEGATIVE_PREVENTED',
      message: `Operação abortada para evitar saldo negativo. ${err.message}`,
      metadata: { productName, unit, qty },
    });
    res.status(409).json({ ok: false, error: err.message });
  }
}

async function auditCount(req, res) {
  const vehicleId = req.body.vehicleId ? Number(req.body.vehicleId) : null;
  const productName = stockName(req.body.productName || req.body.name);
  const unit = stockUnit(req.body.unit || 'KG');
  const physicalQuantity = n(req.body.physicalQuantity, NaN);
  const createdBy = s(req.body.createdBy) || 'admin';

  if (!vehicleId || !productName || !Number.isFinite(physicalQuantity)) {
    return res.status(400).json({ ok: false, error: 'Campos obrigatórios em falta.' });
  }

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findUnique({
        where: { scope_vehicleId_productName_unit: { scope: 'VEHICLE', vehicleId, productName, unit } },
      });

      const digitalQuantity = n(balance?.quantity, 0);
      const desvio = physicalQuantity - digitalQuantity;

      const updatedBalance = balance
        ? await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: physicalQuantity } })
        : await tx.stockBalance.create({ data: { scope: 'VEHICLE', vehicleId, productName, unit, quantity: physicalQuantity, category: 'CHEMICAL' } });

      const movement = await tx.stockMovement.create({
        data: {
          movementType: desvio === 0 ? 'AUDIT_COUNT_CONFIRMED' : 'AUDIT_COUNT_ADJUSTMENT',
          scopeFrom: 'VEHICLE',
          scopeTo: 'VEHICLE',
          vehicleId,
          productName,
          category: balance?.category || 'CHEMICAL',
          unit,
          quantity: desvio,
          notes: `Auditoria física V22 ORE. Diferença: ${desvio} ${unit}.`,
          createdBy,
        },
      });

      return { balance: updatedBalance, movement, digitalQuantity, physicalQuantity, desvio };
    }, STOCK_TRANSACTION_OPTIONS);

    if (transactionResult.desvio !== 0) {
      await safeAudit({
        eventType: 'STOCK_AUDIT',
        entity: 'StockBalance',
        entityId: transactionResult.balance.id,
        vehicleId,
        action: 'V22_STOCK_AUDIT_DEVIATION',
        message: `ALERTA DIVERGÊNCIA: Viatura ${vehicleId}, Produto: ${productName}. Calculado: ${transactionResult.digitalQuantity} ${unit}, Físico: ${physicalQuantity} ${unit}.`,
        metadata: { desvio: transactionResult.desvio },
      });
    }

    invalidateDashboardCache('STOCK_AUDIT_COUNT');
    return res.json({ ok: true, ...transactionResult });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
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
