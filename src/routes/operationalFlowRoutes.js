const express = require('express');
const prismaModule = require('../prismaClient');
const auth = require('../middlewares/authMiddleware');
const { getPoolRoundReadiness } = require('../utils/poolReadiness');
const {
  applyClientCreditToInvoice,
  createCreditLedgerPayment,
  invoiceOpen,
  invoicePaid,
  invoiceStatus,
  invoiceTotal,
} = require('../services/clientCreditService');

const prisma = prismaModule.prisma || prismaModule.default || prismaModule;
const router = express.Router();

router.use(auth('ADMIN'));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function optionalText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function technicalSheetPayload(source = {}, pool = {}) {
  const treatment = optionalText(source.disinfectionType || source.treatmentType || pool.disinfectionType || pool.type) || 'CLORO';
  return Object.fromEntries(Object.entries({
    volumeM3: optionalNumber(source.volumeM3 ?? pool.volumeM3) ?? 0,
    disinfectionType: treatment,
    targetPhMin: optionalNumber(source.targetPhMin),
    targetPhMax: optionalNumber(source.targetPhMax),
    targetChlorineMin: optionalNumber(source.targetChlorineMin),
    targetChlorineMax: optionalNumber(source.targetChlorineMax),
    targetAlkalinityMin: optionalNumber(source.targetAlkalinityMin),
    targetAlkalinityMax: optionalNumber(source.targetAlkalinityMax),
    targetOrpMinMv: optionalNumber(source.targetOrpMinMv),
    filterBrandModel: optionalText(source.filterBrandModel),
    pumpHorsePower: optionalNumber(source.pumpHorsePower),
    chlorinatorModel: optionalText(source.chlorinatorModel),
    technicalRoomLocation: optionalText(source.technicalRoomLocation),
    specialObservations: optionalText(source.specialObservations || source.notes),
  }).filter(([, value]) => value !== undefined));
}

function canBillClient(client) {
  return Boolean(client && client.active !== false && client.billingActive === true && String(client.status || '').toUpperCase() === 'ACTIVE');
}

const VISIT_COMPLETABLE_STATUSES = new Set(['PLANNED', 'IN_PROGRESS', 'A_CAMINHO', 'ON_ROUTE', 'STARTED', 'EM_EXECUCAO', 'EM EXECUCAO']);
const VISIT_TERMINAL_STATUSES = new Set(['DONE', 'CLOSED', 'CANCELLED', 'CANCELED', 'NOT_DONE', 'FAILED']);

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function monthRef(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function model(name) {
  if (!prisma || !prisma[name]) {
    throw new Error(`Modelo Prisma indisponível: ${name}`);
  }
  return prisma[name];
}

async function safeCount(modelName, args = {}, fallback = 0) {
  try {
    if (!prisma?.[modelName]?.count) return fallback;
    return await prisma[modelName].count(args);
  } catch {
    return fallback;
  }
}

async function getOrCreateRound({ name, dayOfWeek } = {}, db = prisma) {
  const day = Number.isInteger(Number(dayOfWeek)) ? Number(dayOfWeek) : new Date().getDay();
  const targetName = String(name || `Ronda ${day + 1}`).trim();
  const existing = await db.round.findFirst({ where: { name: targetName, dayOfWeek: day } });
  if (existing) return existing;
  return db.round.create({ data: { name: targetName, dayOfWeek: day, active: true } });
}

async function ensureRoundTechnician(roundId, technicianId, db = prisma) {
  if (!roundId || !technicianId) return null;
  return db.roundTechnician.upsert({
    where: { roundId_technicianId: { roundId, technicianId } },
    update: {},
    create: { roundId, technicianId },
  });
}

async function ensureRoundPool(roundId, poolId, db = prisma) {
  if (!roundId || !poolId) return null;
  const count = await db.roundPool.count({ where: { roundId } });
  return db.roundPool.upsert({
    where: { roundId_poolId: { roundId, poolId } },
    update: {},
    create: { roundId, poolId, order: count + 1 },
  });
}

async function createPending(message, clientId, meta = {}) {
  try {
    if (!prisma?.notification?.create) return null;
    return await prisma.notification.create({
      data: {
        clientId: clientId || null,
        type: 'OPERATIONAL_PENDING',
        eventType: 'OPERATIONAL_FLOW',
        title: 'Pendência operacional',
        message,
        role: 'ADMIN',
        severity: meta.severity || 'WARNING',
        metadata: meta,
      },
    });
  } catch {
    return null;
  }
}

router.get('/summary', asyncHandler(async (req, res) => {
  const [clients, pools, technicians, rounds, visitsPlanned, visitsDone, alertsOpen, repairsPending, invoicesPending, payments] = await Promise.all([
    safeCount('client'),
    safeCount('pool'),
    safeCount('technician'),
    safeCount('round'),
    safeCount('serviceVisit', { where: { status: 'PLANNED' } }),
    safeCount('serviceVisit', { where: { status: 'DONE' } }),
    safeCount('technicalAlert', { where: { status: 'OPEN' } }),
    safeCount('repair', { where: { status: { in: ['PENDING', 'QUOTE_REQUESTED', 'QUOTED'] } } }),
    safeCount('invoice', { where: { status: { in: ['PENDING', 'OPEN'] } } }),
    safeCount('payment'),
  ]);

  const poolsWithoutRound = await model('pool').findMany({
    where: { active: true, roundPools: { none: {} } },
    include: { client: true },
    take: 50,
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  const visitsWithoutTechnician = await model('serviceVisit').findMany({
    where: { status: 'PLANNED', technicianId: null },
    include: { client: true, pool: true },
    take: 50,
    orderBy: { plannedDate: 'asc' },
  }).catch(() => []);

  const clientsWithoutPools = await model('client').findMany({
    where: { active: true, pools: { none: {} } },
    take: 50,
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  res.json({
    ok: true,
    metrics: { clients, pools, technicians, rounds, visitsPlanned, visitsDone, alertsOpen, repairsPending, invoicesPending, payments },
    pending: { poolsWithoutRound, visitsWithoutTechnician, clientsWithoutPools },
  });
}));

router.get('/bootstrap', asyncHandler(async (req, res) => {
  const [clients, pools, technicians, rounds] = await Promise.all([
    model('client').findMany({ orderBy: { name: 'asc' }, take: 200 }),
    model('pool').findMany({ include: { client: true, roundPools: { include: { round: true } } }, orderBy: { createdAt: 'desc' }, take: 300 }),
    model('technician').findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    model('round').findMany({ where: { active: true }, orderBy: [{ dayOfWeek: 'asc' }, { name: 'asc' }] }),
  ]);
  res.json({ ok: true, clients, pools, technicians, rounds });
}));

router.post('/onboard', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const clientInput = body.client || {};
  const poolInput = body.pool || {};
  const technicalInput = body.technicalSheet || body.technical || {};
  const techId = body.technicianId ? Number(body.technicianId) : null;
  const roundInput = body.round || {};
  const createVisit = body.createVisit !== false;

  if (!clientInput.name) return res.status(400).json({ ok: false, error: 'Nome do cliente é obrigatório.' });

  const poolAddress = String(poolInput.address || clientInput.address || '').trim();
  const poolLocation = String(poolInput.location || poolInput.zone || clientInput.zone || '').trim();
  const poolType = String(poolInput.type || 'POOL').trim();
  const wantsPool = Boolean(poolInput.name || poolInput.type || poolInput.volumeM3 || poolInput.address || poolInput.location);

  if (wantsPool && poolAddress && poolLocation && poolType) {
    const existingPool = await model('pool').findFirst({
      where: { address: poolAddress, location: poolLocation, type: poolType },
    });
    if (existingPool) {
      return res.status(409).json({ ok: false, error: 'Ja existe uma infraestrutura registada exatamente com este tipo e nesta localizacao/morada.' });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: clientInput.name,
        internalName: clientInput.internalName || null,
        email: clientInput.email || null,
        phone: clientInput.phone || null,
        address: clientInput.address || null,
        zone: clientInput.zone || null,
        notes: clientInput.notes || null,
        status: 'SETUP',
        active: true,
        billingActive: false,
        paymentStatus: 'BILLING_DISABLED',
        monthlyFee: toNumber(clientInput.monthlyFee, 0),
        monthlyAmount: toNumber(clientInput.monthlyAmount ?? clientInput.monthlyFee, 0),
        paymentStatus: 'BILLING_DISABLED',
        source: 'OPERATIONAL_FLOW',
      },
    });

    let pool = null;
    if (poolInput.name || poolInput.type || poolInput.volumeM3) {
      pool = await tx.pool.create({
        data: {
          clientId: client.id,
          name: poolInput.name || `Piscina ${client.name}`,
          type: poolInput.type || 'POOL',
          address: poolInput.address || client.address || null,
          location: poolInput.location || poolInput.zone || client.zone || null,
          zone: poolInput.zone || client.zone || null,
          volumeM3: poolInput.volumeM3 ? toNumber(poolInput.volumeM3) : null,
          monthlyAmount: toNumber(poolInput.monthlyAmount ?? client.monthlyFee, 0),
          serviceFrequency: Math.max(1, parseInt(poolInput.serviceFrequency || '1', 10)),
          estimatedMinutes: Math.max(10, parseInt(poolInput.estimatedMinutes || '30', 10)),
          scheduleMode: 'FLOW_CONTROLLED',
          active: true,
          notes: poolInput.notes || null,
        },
      });

      if (tx.poolCalculationProfile?.create) {
        await tx.poolCalculationProfile.create({
          data: {
            poolId: pool.id,
            shape: poolInput.shape || 'RECTANGULAR',
            volumeM3: pool.volumeM3 || null,
            bathersAverage: toNumber(poolInput.bathersAverage, 0),
            covered: Boolean(poolInput.covered),
            notes: 'Criado pelo fluxo operacional guiado.',
          },
        }).catch(() => null);
      }

      if (tx.technicalSheet?.upsert) {
        const sheetData = technicalSheetPayload(technicalInput, {
          ...poolInput,
          volumeM3: pool.volumeM3,
          type: pool.type,
          disinfectionType: technicalInput.disinfectionType || poolInput.disinfectionType || poolInput.treatmentType,
        });
        await tx.technicalSheet.upsert({
          where: { poolId: pool.id },
          update: sheetData,
          create: {
            poolId: pool.id,
            ...sheetData,
          },
        }).catch(() => null);
      }
    }

    let round = null;
    let roundPool = null;
    let roundTechnician = null;

    if (pool && (roundInput.assign || roundInput.name || roundInput.id)) {
      const readiness = await getPoolRoundReadiness(tx, pool.id);
      if (readiness.ok) {
        if (roundInput.id) round = await tx.round.findUnique({ where: { id: Number(roundInput.id) } });
        if (!round) round = await getOrCreateRound(roundInput, tx);
        const count = await tx.roundPool.count({ where: { roundId: round.id } });
        roundPool = await tx.roundPool.upsert({
          where: { roundId_poolId: { roundId: round.id, poolId: pool.id } },
          update: {},
          create: { roundId: round.id, poolId: pool.id, order: count + 1 },
        });
        if (techId) {
          roundTechnician = await tx.roundTechnician.upsert({
            where: { roundId_technicianId: { roundId: round.id, technicianId: techId } },
            update: {},
            create: { roundId: round.id, technicianId: techId },
          });
        }
      }
    }

    let visit = null;
    if (pool && createVisit) {
      visit = await tx.serviceVisit.create({
        data: {
          clientId: client.id,
          poolId: pool.id,
          technicianId: techId || null,
          roundId: round?.id || null,
          plannedDate: toDate(body.plannedDate),
          date: toDate(body.plannedDate),
          status: techId ? 'PLANNED' : 'PENDING_TECHNICIAN',
          reason: 'FIRST_SERVICE',
          notes: 'Visita criada automaticamente pelo fluxo operacional.',
          revenue: toNumber(pool?.monthlyAmount ?? client.monthlyAmount, 0),
        },
      });
    }

    return { client, pool, round, roundPool, roundTechnician, visit };
  });

  if (!result.pool) await createPending(`Cliente ${result.client.name} sem piscina/jacuzzi.`, result.client.id, { step: 'POOL_REQUIRED' });
  if (result.pool && !result.round) await createPending(`Piscina ${result.pool.name} sem ronda atribuída.`, result.client.id, { step: 'ROUND_REQUIRED', poolId: result.pool.id });
  if (result.pool && result.round && !result.visit?.technicianId) await createPending(`Piscina ${result.pool.name} sem técnico atribuído.`, result.client.id, { step: 'TECHNICIAN_REQUIRED', poolId: result.pool.id, roundId: result.round.id });

  res.json({ ok: true, flowStatus: result.visit?.technicianId ? 'READY_FOR_SERVICE' : 'PENDING_ASSIGNMENT', ...result });
}));

router.post('/assign-pool', asyncHandler(async (req, res) => {
  const poolId = Number(req.body.poolId);
  const technicianId = req.body.technicianId ? Number(req.body.technicianId) : null;
  if (!poolId) return res.status(400).json({ ok: false, error: 'poolId obrigatório' });

  const pool = await model('pool').findUnique({ where: { id: poolId }, include: { client: true } });
  if (!pool) return res.status(404).json({ ok: false, error: 'Piscina não encontrada' });

  const readiness = await getPoolRoundReadiness(prisma, poolId);
  if (!readiness.ok) {
    return res.status(readiness.status).json({
      ok: false,
      error: readiness.message,
      missing: readiness.missing,
    });
  }

  const round = req.body.roundId ? await model('round').findUnique({ where: { id: Number(req.body.roundId) } }) : await getOrCreateRound(req.body.round || {});
  await ensureRoundPool(round.id, pool.id);
  if (technicianId) await ensureRoundTechnician(round.id, technicianId);

  const visit = await model('serviceVisit').create({
    data: {
      clientId: pool.clientId,
      poolId: pool.id,
      technicianId,
      roundId: round.id,
      plannedDate: toDate(req.body.plannedDate),
      date: toDate(req.body.plannedDate),
      status: technicianId ? 'PLANNED' : 'PENDING_TECHNICIAN',
      reason: 'ROUTE_ASSIGNMENT',
      notes: 'Criada por atribuição operacional.',
      revenue: pool.monthlyAmount || pool.client?.monthlyAmount || 0,
    },
  });

  res.json({ ok: true, pool, round, visit });
}));

router.post('/complete-visit', asyncHandler(async (req, res) => {
  const visitId = Number(req.body.visitId);
  if (!visitId) return res.status(400).json({ ok: false, error: 'visitId obrigatório' });

  const currentVisit = await model('serviceVisit').findUnique({ where: { id: visitId } });
  if (!currentVisit) return res.status(404).json({ ok: false, error: 'Visita não encontrada' });

  const currentStatus = normalizeStatus(currentVisit.status);
  if (VISIT_TERMINAL_STATUSES.has(currentStatus) || currentVisit.endAt) {
    return res.status(409).json({ ok: false, error: 'Visita já concluída/cancelada.' });
  }
  if (!VISIT_COMPLETABLE_STATUSES.has(currentStatus)) {
    return res.status(409).json({ ok: false, error: `Estado inválido para conclusão: ${currentStatus || 'UNKNOWN'}` });
  }

  const updated = await model('serviceVisit').updateMany({
    where: { id: visitId, endAt: null, status: { notIn: ['DONE', 'CLOSED', 'CANCELLED', 'CANCELED', 'NOT_DONE', 'FAILED'] } },
    data: {
      status: 'DONE',
      cleaned: req.body.cleaned !== false,
      brushed: Boolean(req.body.brushed),
      vacuumed: Boolean(req.body.vacuumed),
      basketCleaned: req.body.basketCleaned !== false,
      waterlineClean: Boolean(req.body.waterlineClean),
      backwashDone: Boolean(req.body.backwashDone),
      ph: req.body.ph ? toNumber(req.body.ph) : undefined,
      chlorine: req.body.chlorine ? toNumber(req.body.chlorine) : undefined,
      alkalinity: req.body.alkalinity ? toNumber(req.body.alkalinity) : undefined,
      salt: req.body.salt ? toNumber(req.body.salt) : undefined,
      temperature: req.body.temperature ? toNumber(req.body.temperature) : undefined,
      notes: req.body.notes || 'Visita concluída pelo fluxo operacional.',
      endAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    return res.status(409).json({ ok: false, error: 'Visita já concluída por outro processo.' });
  }

  const visit = await model('serviceVisit').findUnique({ where: { id: visitId }, include: { pool: true, client: true } });

  let repair = null;
  let alert = null;
  if (req.body.reportPumpIssue && visit.poolId) {
    alert = await model('technicalAlert').create({ data: { poolId: visit.poolId, type: 'PUMP_ISSUE', priority: 'HIGH', message: req.body.issueDescription || 'Problema reportado na bomba.' } });
    repair = await model('repair').create({ data: { poolId: visit.poolId, problem: req.body.issueDescription || 'Verificar bomba', priority: 'HIGH', status: 'QUOTE_REQUESTED', notes: 'Criado automaticamente após visita.' } });
  }

  res.json({ ok: true, visit, alert, repair, nextStep: repair ? 'QUOTE_REQUIRED' : 'BILLING_READY' });
}));

router.post('/generate-monthly-invoice', asyncHandler(async (req, res) => {
  const clientId = Number(req.body.clientId);
  if (!clientId) return res.status(400).json({ ok: false, error: 'clientId obrigatório' });

  const client = await model('client').findUnique({ where: { id: clientId }, include: { pools: true } });
  if (!client) return res.status(404).json({ ok: false, error: 'Cliente não encontrado' });
  if (!canBillClient(client)) return res.status(409).json({ ok: false, error: 'Faturação desligada: ativa primeiro o contrato do cliente após receber o pagamento inicial.' });

  const ref = req.body.monthRef || monthRef();
  const visits = await model('serviceVisit').findMany({ where: { clientId, status: 'DONE', billed: false } });
  const repairs = await model('repair').findMany({ where: { pool: { clientId }, status: { in: ['DONE', 'QUOTED', 'APPROVED', 'QUOTE_REQUESTED'] }, paid: false } });
  const monthly = toNumber(client.monthlyAmount || client.monthlyFee, 0);
  const repairTotal = repairs.reduce((sum, r) => sum + toNumber(r.totalPrice || r.unitPrice, 0), 0);
  const total = monthly + repairTotal;

  const invoice = await model('invoice').upsert({
    where: { clientId_monthRef: { clientId, monthRef: ref } },
    update: { total, amount: total, totalAmount: total, amountOpen: total, status: 'PENDING', requiresInvoice: Boolean(client.requiresInvoice) },
    create: { clientId, monthRef: ref, amount: total, total, totalAmount: total, amountOpen: total, status: 'PENDING', requiresInvoice: Boolean(client.requiresInvoice), notes: 'Gerada pelo fluxo operacional.' },
  });

  await model('invoiceLine').deleteMany({ where: { invoiceId: invoice.id } });
  if (monthly > 0) await model('invoiceLine').create({ data: { invoiceId: invoice.id, type: 'MONTHLY', description: `Mensalidade ${ref}`, quantity: 1, unitPrice: monthly, total: monthly, lineTotal: monthly } });
  for (const r of repairs) {
    const value = toNumber(r.totalPrice || r.unitPrice, 0);
    if (value > 0) await model('invoiceLine').create({ data: { invoiceId: invoice.id, type: 'REPAIR', description: r.problem, referenceId: r.id, quantity: r.quantity || 1, unitPrice: value, total: value, lineTotal: value } });
  }

  const credit = await applyClientCreditToInvoice(prisma, invoice, {
    reference: `Fatura ${ref}`,
    notes: 'Abatimento automatico no fluxo operacional.',
  });
  const finalInvoice = credit.creditUsed > 0
    ? await model('invoice').findUnique({ where: { id: invoice.id }, include: { lines: true, payments: true, client: true } })
    : invoice;

  await model('serviceVisit').updateMany({ where: { id: { in: visits.map((v) => v.id) } }, data: { billed: true, billedAt: new Date() } });
  res.json({ ok: true, invoice: finalInvoice, creditUsed: credit.creditUsed || 0, lines: { monthly, repairs: repairTotal }, nextStep: 'PAYMENT' });
}));

router.post('/pay-invoice', asyncHandler(async (req, res) => {
  const invoiceId = Number(req.body.invoiceId);
  const amount = toNumber(req.body.amount, 0);
  if (!invoiceId || amount <= 0) return res.status(400).json({ ok: false, error: 'invoiceId e amount obrigatórios' });

  const invoice = await model('invoice').findUnique({ where: { id: invoiceId } });
  if (!invoice) return res.status(404).json({ ok: false, error: 'Fatura não encontrada' });

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!current) throw new Error('Fatura nao encontrada');

    const open = invoiceOpen(current);
    const applied = Math.min(amount, open);
    let payment = null;
    let updated = current;

    if (applied > 0) {
      payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: applied,
          amountCents: Math.round(applied * 100),
          method: req.body.method || 'MANUAL',
          notes: req.body.notes || 'Pagamento registado no fluxo operacional.',
        },
      });
      const paid = invoicePaid(current) + applied;
      const amountOpen = Math.max(open - applied, 0);
      updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: paid,
          amountOpen,
          status: invoiceStatus(invoiceTotal(current), paid, amountOpen),
          paidAt: amountOpen <= 0 ? new Date() : current.paidAt,
          paymentMethod: req.body.method || 'MANUAL',
        },
      });
    }

    const surplus = Math.max(amount - applied, 0);
    const credit = surplus > 0 && current.clientId
      ? await createCreditLedgerPayment(tx, current.clientId, surplus, {
        monthRef: current.monthRef || monthRef(),
        method: req.body.method || 'MANUAL',
        notes: req.body.notes || 'Excedente de pagamento convertido em credito positivo.',
      })
      : { creditAdded: 0 };

    return { payment, invoice: updated, appliedAmount: applied, creditAdded: credit.creditAdded || 0, creditBalance: credit.creditBalance };
  });

  res.json({
    ok: true,
    payment: result.payment,
    invoice: result.invoice,
    appliedAmount: result.appliedAmount,
    creditAdded: result.creditAdded,
    creditBalance: result.creditBalance,
    flowStatus: invoiceOpen(result.invoice) <= 0 ? 'CLOSED' : 'PARTIAL_PAYMENT',
  });
}));

// Fluxos de demonstração removidos da produção.

module.exports = router;
