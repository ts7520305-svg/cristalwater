const { calculatePoolOptimization } = require("../../services/poolCalculationService");

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calculateChemistry(body = {}) {
  const n = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };

  const volume = n(body.volumeM3) || 0;
  const ph = n(body.phCurrent);
  const targetPh = n(body.targetPh) || 7.4;
  const alkalinity = n(body.alkalinityCurrentPpm);
  const targetAlkalinity = n(body.targetAlkalinityPpm) || 100;
  const orp = n(body.orpCurrentMv);
  const targetOrp = n(body.targetOrpMv) || 720;
  const recommendations = [];
  const result = {
    phCurrent: ph,
    targetPh,
    alkalinityCurrentPpm: alkalinity,
    targetAlkalinityPpm: targetAlkalinity,
    orpCurrentMv: orp,
    targetOrpMv: targetOrp,
  };

  if (alkalinity !== null) {
    const diff = targetAlkalinity - alkalinity;
    result.alkalinityDeltaPpm = diff;
    result.bicarbonateKgToAdd = diff > 0 && volume > 0 ? Math.round(diff * volume * 0.0015 * 100) / 100 : 0;
    if (result.bicarbonateKgToAdd > 0) recommendations.push(`Alcalinidade baixa: adicionar cerca de ${result.bicarbonateKgToAdd} kg de bicarbonato por fases.`);
    if (diff < -20) recommendations.push("Alcalinidade alta: corrigir gradualmente e voltar a medir antes de nova dosagem.");
  }

  if (ph !== null) {
    result.phDelta = Math.round((targetPh - ph) * 100) / 100;
    result.phMinusKgEstimate = ph > 7.6 && volume > 0 ? Math.round((ph - targetPh) * volume * 0.12 * 100) / 100 : 0;
    result.phPlusKgEstimate = ph < 7.2 && volume > 0 ? Math.round((targetPh - ph) * volume * 0.10 * 100) / 100 : 0;
    if (result.phMinusKgEstimate > 0) recommendations.push(`pH alto: adicionar cerca de ${result.phMinusKgEstimate} kg de pH- e voltar a medir.`);
    if (result.phPlusKgEstimate > 0) recommendations.push(`pH baixo: adicionar cerca de ${result.phPlusKgEstimate} kg de pH+ e voltar a medir.`);
  }

  if (orp !== null) {
    result.orpDeltaMv = targetOrp - orp;
    if (orp < 650) recommendations.push("ORP/Redox baixo: verificar pH, cloro livre, estabilizador, célula de sal ou doseadora.");
  }

  return { result, recommendations };
}

function profilePayload(body = {}) {
  return {
    shape: body.shape || "RECTANGULAR",
    lengthM: toNumberOrNull(body.lengthM),
    widthM: toNumberOrNull(body.widthM),
    diameterM: toNumberOrNull(body.diameterM),
    depthMinM: toNumberOrNull(body.depthMinM),
    depthMaxM: toNumberOrNull(body.depthMaxM),
    averageDepthM: toNumberOrNull(body.averageDepthM),
    shapeFactor: toNumberOrNull(body.shapeFactor),
    surfaceM2: toNumberOrNull(body.surfaceM2),
    volumeM3: toNumberOrNull(body.volumeM3),
    pumpFlowM3h: toNumberOrNull(body.pumpFlowM3h),
    pumpPowerHp: toNumberOrNull(body.pumpPowerHp),
    bathersAverage: toNumberOrNull(body.bathersAverage),
    poolLoad: body.poolLoad || "NORMAL",
    saltCurrentPpm: toNumberOrNull(body.saltCurrentPpm),
    targetSalinityPpm: toNumberOrNull(body.targetSalinityPpm) || 3500,
    chlorinatorGph: toNumberOrNull(body.chlorinatorGph),
    chlorineCurrentPpm: toNumberOrNull(body.chlorineCurrentPpm),
    targetChlorinePpm: toNumberOrNull(body.targetChlorinePpm) || 2,
    heatPumpPhase: body.heatPumpPhase || null,
    heatPumpThermalKw: toNumberOrNull(body.heatPumpThermalKw),
    heatPumpElectricalKw: toNumberOrNull(body.heatPumpElectricalKw),
    cop: toNumberOrNull(body.cop) || 5,
    currentWaterTempC: toNumberOrNull(body.currentWaterTempC),
    targetWaterTempC: toNumberOrNull(body.targetWaterTempC) || 27,
    covered: body.covered === true || body.covered === "true" || body.covered === "1" || body.covered === 1,
    ambientLossFactor: toNumberOrNull(body.ambientLossFactor),
    notes: body.notes || null,
  };
}

function buildOptimization(body = {}) {
  const payload = profilePayload(body);
  const calculation = calculatePoolOptimization(payload);
  const chem = calculateChemistry(body);
  calculation.chemistry = chem.result;
  calculation.recommendations = [...(calculation.recommendations || []), ...chem.recommendations];
  return { payload, calculation };
}

module.exports = {
  calculateChemistry,
  profilePayload,
  buildOptimization,
};
