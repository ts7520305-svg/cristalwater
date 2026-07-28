const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { roleIn } = require('../utils/roles');
const engine = require('../services/operationalStateEngine');
const { prisma } = require('../prismaClient');

const router = express.Router();

function allowRoles(...roles) {
  return (req, res, next) => {
    if (roleIn(req.user?.role, roles)) return next();
    return res.status(403).json({ ok: false, message: 'Sem permissão' });
  };
}

router.use(auth());

router.get('/locks', allowRoles('ADMIN', 'TEAM_LEADER'), async (req, res) => {
  const locks = await prisma.operationalLock.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ ok: true, locks });
});

router.post('/locks/:id/approve', allowRoles('ADMIN', 'TEAM_LEADER'), async (req, res) => {
  const id = Number(req.params.id);
  const lock = await prisma.operationalLock.update({ where: { id }, data: { status: 'APPROVED', approvedBy: req.body?.approvedBy || 'ADMIN', approvedAt: new Date(), resolvedAt: new Date() } });
  res.json({ ok: true, lock });
});

router.post('/locks/:id/reject', allowRoles('ADMIN', 'TEAM_LEADER'), async (req, res) => {
  const id = Number(req.params.id);
  const lock = await prisma.operationalLock.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), resolvedAt: new Date() } });
  res.json({ ok: true, lock });
});

router.post('/validate/pool/:poolId/round-ready', allowRoles('ADMIN', 'TECHNICIAN', 'TEAM_LEADER'), async (req, res) => {
  res.json(await engine.validatePoolReadyForRound(req.params.poolId));
});

router.post('/validate/visit/:visitId/stock-ready', allowRoles('ADMIN', 'TECHNICIAN', 'TEAM_LEADER'), async (req, res) => {
  res.json(await engine.validateVisitReadyForStock(req.params.visitId));
});

router.post('/chemical/check', allowRoles('ADMIN', 'TECHNICIAN', 'TEAM_LEADER'), async (req, res) => {
  res.json(await engine.validateChemicalDose(req.body || {}));
});

router.post('/visits/:visitId/state', allowRoles('ADMIN', 'TECHNICIAN', 'TEAM_LEADER'), async (req, res) => {
  try { res.json(await engine.setVisitState({ visitId: req.params.visitId, ...(req.body || {}) })); }
  catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.post('/vehicle-compatibility', allowRoles('ADMIN', 'TECHNICIAN', 'TEAM_LEADER'), async (req, res) => {
  res.json(await engine.checkVehicleCompatibility(req.body || {}));
});

router.post('/emergency-consumption', allowRoles('ADMIN', 'TEAM_LEADER'), async (req, res) => {
  const batch = await engine.createEmergencyConsumptionBatch(req.body || {});
  res.json({ ok: true, batch });
});

router.post('/emergency-consumption/:id/distribute', allowRoles('ADMIN', 'TEAM_LEADER'), async (req, res) => {
  try { res.json(await engine.distributeEmergencyConsumption(req.params.id)); }
  catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.post('/stock-audit', allowRoles('ADMIN', 'TEAM_LEADER'), async (req, res) => {
  const audit = await engine.createVehicleAudit(req.body || {});
  res.json({ ok: true, audit });
});

router.post('/profitability/:clientId', allowRoles('ADMIN', 'TEAM_LEADER'), async (req, res) => {
  const snapshot = await engine.computeClientProfit(req.params.clientId, req.body?.monthRef);
  res.json({ ok: true, snapshot });
});

module.exports = router;
