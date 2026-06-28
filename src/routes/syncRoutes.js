const crypto = require('crypto');
const express = require('express');
const prisma = require('../prismaClient');
const { buildChemicalAdvice } = require('../services/chemicalAdviceService');
const { invalidateDashboardCache } = require('../services/dashboardCacheService');

const router = express.Router();

const SYNC_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable',
  maxWait: 15000,
  timeout: 15000,
};

function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function s(value) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function buildSyncHash(payload) {
  const clone = {
    id: Number(payload.id ?? payload.visitId ?? payload.serviceVisitId),
    phRead: payload.phRead ?? payload.ph ?? payload.pH ?? null,
    clRead: payload.clRead ?? payload.chlorine ?? payload.cl ?? null,
    alkalinity: payload.alkalinity ?? null,
    checklistJson: payload.checklistJson || {},
    consumos: payload.consumos || payload.checklistJson?.consumos || [],
  };
  return crypto.createHash('sha256').update(stableStringify(clone)).digest('hex');
}

function normalizeChecklist(payload, syncHash, chemicalAdvice) {
  const raw = payload.checklistJson || {};
  const checklist = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const consumos = Array.isArray(payload.consumos)
    ? payload.consumos
    : Array.isArray(checklist.consumos)
      ? checklist.consumos
      : [];

  return {
    ...checklist,
    consumos,
    aiChemicalAdvice: chemicalAdvice,
    inputMethod: 'DIGITAL_WHEEL_PICKER_V22',
    lastSyncHash: syncHash,
    lastSyncAt: new Date().toISOString(),
  };
}

async function safeAudit(tx, data) {
  try {
    if (!tx.auditTrail?.create) return null;
    return await tx.auditTrail.create({
      data: {
        eventType: data.eventType || 'SYNC',
        entity: data.entity || 'ServiceVisit',
        entityId: data.entityId || null,
        technicianId: data.technicianId || null,
        vehicleId: data.vehicleId || null,
        action: data.action,
        message: data.message || null,
        metadata: data.metadata || undefined,
      },
    });
  } catch (err) {
    console.error('[V22-SYNC-AUDIT-ERROR]', err.message);
    return null;
  }
}

async function findVisit(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;

  const serviceVisit = await prisma.serviceVisit.findUnique({
    where: { id: numericId },
    include: { pool: { include: { calculationProfile: true } } },
  });
  if (serviceVisit) return { kind: 'ServiceVisit', record: serviceVisit };

  if (prisma.visit?.findUnique) {
    const visit = await prisma.visit.findUnique({
      where: { id: numericId },
      include: { pool: { include: { calculationProfile: true } } },
    }).catch(() => null);
    if (visit) return { kind: 'Visit', record: visit };
  }

  return null;
}

function makeStockKey({ vehicleId, productName, unit }) {
  return `${vehicleId}::${stockSafeName(productName)}::${stockSafeUnit(unit)}`;
}

function stockSafeName(value) {
  return s(value).replace(/\s+/g, ' ').trim();
}

function stockSafeUnit(value) {
  return (s(value) || 'KG').toUpperCase();
}

async function processVehicleStockBulk(tx, { consumos, context }) {
  const grouped = new Map();

  for (const raw of consumos || []) {
    const vehicleId = raw.vehicleId ? Number(raw.vehicleId) : context.vehicleId ? Number(context.vehicleId) : null;
    const quantity = n(raw.quantity, 0);
    if (!vehicleId || quantity <= 0) continue;

    const productName = stockSafeName(raw.productName || raw.name);
    const unit = stockSafeUnit(raw.unit || 'KG');
    const category = s(raw.category || 'CHEMICAL') || 'CHEMICAL';
    if (!productName) continue;

    const key = makeStockKey({ vehicleId, productName, unit });
    const current = grouped.get(key) || { vehicleId, productName, unit, category, quantity: 0, raws: [] };
    current.quantity += quantity;
    current.raws.push(raw);
    grouped.set(key, current);
  }

  const stockResults = [];
  const movementRows = [];

  for (const item of grouped.values()) {
    const balance = await tx.stockBalance.findUnique({
      where: { scope_vehicleId_productName_unit: { scope: 'VEHICLE', vehicleId: item.vehicleId, productName: item.productName, unit: item.unit } },
    });

    const available = n(balance?.quantity, 0);
    if (!balance || available < item.quantity) {
      await safeAudit(tx, {
        eventType: 'STOCK_CRITICAL_FAIL',
        entity: 'StockBalance',
        technicianId: context.technicianId,
        vehicleId: item.vehicleId,
        action: 'V22_STOCK_NEGATIVE_PREVENTED',
        message: `BLOQUEIO DE SEGURANÇA: Falta de stock para ${item.productName} na viatura ${item.vehicleId}. Disponível: ${available}, Solicitado: ${item.quantity}`,
        metadata: { available, requested: item.quantity, unit: item.unit },
      });
      throw new Error(`CRITICAL_STOCK_ERROR: Abate inválido para o produto ${item.productName}. Saldo insuficiente.`);
    }

    await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { decrement: item.quantity } } });

    movementRows.push({
      movementType: 'V22_SYNC_CONSUMPTION',
      scopeFrom: 'VEHICLE',
      vehicleId: item.vehicleId,
      productId: balance.productId || null,
      productName: item.productName,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      visitId: context.visitId,
      technicianId: context.technicianId,
      notes: 'Consumo offline sincronizado V22 ORE em bulk.',
      createdBy: 'sync-v22',
    });

    stockResults.push({ skipped: false, productName: item.productName, quantity: item.quantity, unit: item.unit, vehicleId: item.vehicleId });
  }

  if (movementRows.length > 0) {
    await tx.stockMovement.createMany({ data: movementRows });
  }

  return stockResults;
}

router.post('/text', async (req, res) => {
  const visits = Array.isArray(req.body?.visits) ? req.body.visits : [];
  if (!visits.length) return res.status(400).json({ ok: false, error: 'Payload vazio.' });

  const started = process.hrtime.bigint();
  const results = [];

  for (const payload of visits) {
    const id = payload.id ?? payload.visitId ?? payload.serviceVisitId;
    const syncHash = buildSyncHash(payload);

    try {
      const found = await findVisit(id);
      if (!found) {
        results.push({ id, status: 'FAILED', error: 'Visita não encontrada.' });
        continue;
      }

      const dbVisit = found.record;
      const existingChecklist = dbVisit.chemicalsJson || {};
      const existingHash = existingChecklist.lastSyncHash || null;

      if (existingHash && existingHash === syncHash) {
        results.push({ id, status: 'SYNCED', idempotent: true, message: 'Payload protegido contra duplicação. Stock intacto.' });
        continue;
      }

      const phRead = payload.phRead ?? payload.ph ?? payload.pH ?? null;
      const clRead = payload.clRead ?? payload.chlorine ?? payload.cl ?? null;
      const alkalinity = payload.alkalinity ?? null;
      const chemicalAdvice = buildChemicalAdvice({ pool: dbVisit.pool, readings: { phRead, clRead, alkalinity } });
      const mergedChecklist = normalizeChecklist(payload, syncHash, chemicalAdvice);
      const consumos = Array.isArray(mergedChecklist.consumos) ? mergedChecklist.consumos : [];

      const txResult = await prisma.$transaction(async (tx) => {
        const context = {
          visitId: Number(id),
          technicianId: dbVisit.technicianId || null,
          vehicleId: payload.vehicleId || payload.checklistJson?.vehicleId || null,
        };

        const stockResults = await processVehicleStockBulk(tx, { consumos, context });

        if (found.kind === 'ServiceVisit') {
          await tx.serviceVisit.update({
            where: { id: Number(id) },
            data: {
              ph: phRead === null ? dbVisit.ph : n(phRead),
              chlorine: clRead === null ? dbVisit.chlorine : n(clRead),
              alkalinity: alkalinity === null ? dbVisit.alkalinity : n(alkalinity),
              chemicalsJson: mergedChecklist,
              status: 'SYNCED',
            },
          });
        } else if (tx.visit?.update) {
          await tx.visit.update({ where: { id: Number(id) }, data: { status: 'SYNCED' } });
        }

        await safeAudit(tx, {
          eventType: 'SYNC',
          entity: found.kind,
          entityId: Number(id),
          action: 'V22_SYNC_CHEMICAL_WHEEL_SUCCESS',
          message: 'Sincronização atómica V22 executada com sucesso.',
          metadata: { syncHash, chemicalAdvice },
        });

        return { stockResults };
      }, SYNC_TRANSACTION_OPTIONS);

      results.push({ id, status: 'SYNCED', kind: found.kind, stock: txResult.stockResults, advice: chemicalAdvice });
    } catch (error) {
      if (global.metricCounters) {
        global.metricCounters.sync_retry_total = (global.metricCounters.sync_retry_total || 0) + 1;
      }
      results.push({ id, status: 'FAILED', error: error.message });
    }
  }

  global.syncLatencyBuffer = global.syncLatencyBuffer || [];
  const latencyMs = Number((Number(process.hrtime.bigint() - started) / 1000000).toFixed(3));
  global.syncLatencyBuffer.push(latencyMs);
  if (global.syncLatencyBuffer.length > 1000) global.syncLatencyBuffer.shift();
  global.metricCounters = global.metricCounters || {};
  global.metricCounters.sync_success_total = (global.metricCounters.sync_success_total || 0) + 1;

  invalidateDashboardCache('V22_SYNC_SUCCESS');
  return res.status(200).json({ ok: true, success: true, results });
});

module.exports = router;
