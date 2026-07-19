const PoolCalculationBusiness = require('../business/pool/PoolCalculationBusiness');

async function getPoolCalculations(req, res) {
  const poolId = Number(req.params.poolId);
  if (!Number.isInteger(poolId)) return res.status(400).json({ ok: false, error: 'poolId inválido' });

  const result = await PoolCalculationBusiness.getPoolCalculations(poolId, req.query || {});
  if (!result) return res.status(404).json({ ok: false, error: 'Piscina não encontrada' });

  res.json({ ok: true, pool: result.pool, profile: result.profile, calculation: result.calculation });
}

async function savePoolCalculations(req, res) {
  const poolId = Number(req.params.poolId);
  if (!Number.isInteger(poolId)) return res.status(400).json({ ok: false, error: 'poolId inválido' });

  const result = await PoolCalculationBusiness.savePoolCalculations(poolId, req.body || {});
  if (!result) return res.status(404).json({ ok: false, error: 'Piscina não encontrada' });

  res.json({ ok: true, profile: result.profile, calculation: result.calculation });
}

async function previewCalculation(req, res) {
  const result = PoolCalculationBusiness.previewCalculation(req.body || {});
  res.json({ ok: true, calculation: result.calculation });
}

module.exports = { getPoolCalculations, savePoolCalculations, previewCalculation };
