const express = require('express');
const engine = require('../services/operationalStateEngine');
const { prisma } = require('../prismaClient');

const router = express.Router();

router.get('/locks', async (req, res) => {
  const locks = await prisma.operationalLock.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ ok: true, locks });
});

router.post('/locks/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  const lock = await prisma.operationalLock.update({ where: { id }, data: { status: 'APPROVED', approvedBy: req.body?.approvedBy || 'ADMIN', approvedAt: new Date(), resolvedAt: new Date() } });
  res.json({ ok: true, lock });
});

router.post('/locks/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  const lock = await prisma.operationalLock.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), resolvedAt: new Date() } });
  res.json({ ok: true, lock });
});

router.post('/validate/pool/:poolId/round-ready', async (req, res) => {
  res.json(await engine.validatePoolReadyForRound(req.params.poolId));
});

router.post('/validate/visit/:visitId/stock-ready', async (req, res) => {
  res.json(await engine.validateVisitReadyForStock(req.params.visitId));
});

router.post('/chemical/check', async (req, res) => {
  res.json(await engine.validateChemicalDose(req.body || {}));
});

router.post('/visits/:visitId/state', async (req, res) => {
  try { res.json(await engine.setVisitState({ visitId: req.params.visitId, ...(req.body || {}) })); }
  catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.post('/vehicle-compatibility', async (req, res) => {
  res.json(await engine.checkVehicleCompatibility(req.body || {}));
});

router.post('/emergency-consumption', async (req, res) => {
  const batch = await engine.createEmergencyConsumptionBatch(req.body || {});
  res.json({ ok: true, batch });
});

router.post('/emergency-consumption/:id/distribute', async (req, res) => {
  try { res.json(await engine.distributeEmergencyConsumption(req.params.id)); }
  catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.post('/stock-audit', async (req, res) => {
  const audit = await engine.createVehicleAudit(req.body || {});
  res.json({ ok: true, audit });
});

router.post('/profitability/:clientId', async (req, res) => {
  const snapshot = await engine.computeClientProfit(req.params.clientId, req.body?.monthRef);
  res.json({ ok: true, snapshot });
});

module.exports = router;
