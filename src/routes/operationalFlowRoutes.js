const CoreInvoicePaymentBusiness = require('../business/finance/CoreInvoicePaymentBusiness');
const invoiceGenerationController = require('../controllers/invoiceGenerationController');
const express = require('express');
const prismaModule = require('../prismaClient');
const auth = require('../middlewares/authMiddleware');
const { getPoolRoundReadiness } = require('../utils/poolReadiness');
const {
  invoiceOpen,
} = require('../services/clientCreditService');

const prisma = prismaModule.prisma || prismaModule.default || prismaModule;
const router = express.Router();

router.use((req,res,next)=>{if(req.path.startsWith('/onboard')){res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.vary('Authorization');}next();});
router.use(auth('ADMIN'));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(error => {
    if ([400,404,409].includes(error.status)) return res.status(error.status).json({ok:false,error:error.message});
    next(error);
  });
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

const onboarding = require('../controllers/adminOnboardingController');
router.get('/onboard/options', onboarding.options);
router.post('/onboard/review', onboarding.review);
router.get('/onboard/result/:requestId', onboarding.result);
router.post('/onboard', onboarding.create);

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

router.post('/generate-monthly-invoice', invoiceGenerationController.operational);

router.post('/pay-invoice', asyncHandler(async (req, res) => {
  const invoiceId = Number(req.body.invoiceId);
  const amount = toNumber(req.body.amount, 0);
  if (!invoiceId || amount <= 0) return res.status(400).json({ ok: false, error: 'invoiceId e amount obrigatórios' });

  const result = await CoreInvoicePaymentBusiness.registerPayment(prisma, invoiceId, req.body.requestId !== undefined ? req.body : {
    amount, method: req.body.method || 'MANUAL', notes: req.body.notes || 'Pagamento registado no fluxo operacional.',
  }, req.user);

  res.json({
    ok: true,
    payment: result.payment,
    invoice: result.invoice,
    appliedAmount: result.appliedAmount,
    creditAdded: result.creditAdded,
    creditBalance: result.creditBalance,
    ...(result.requestReceipt ? { requestReceipt: result.requestReceipt, idempotent: result.idempotent === true } : {}),
    flowStatus: invoiceOpen(result.invoice) <= 0 ? 'CLOSED' : 'PARTIAL_PAYMENT',
  });
}));

// Fluxos de demonstração removidos da produção.

module.exports = router;
