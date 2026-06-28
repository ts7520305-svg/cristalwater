// ====================================================================
// CRISTAL WATER ENTERPRISE — CHEMICAL ADVICE SERVICE V22 ORE
// Gera recomendações determinísticas por códigos semânticos.
// ====================================================================

function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getPoolVolume(pool) {
  return n(pool?.volumeM3 ?? pool?.calculationProfile?.volumeM3, 0);
}

function buildChemicalAdvice({ pool, readings = {} }) {
  const volumeM3 = getPoolVolume(pool);
  const phRead = readings.phRead == null ? null : n(readings.phRead, null);
  const clRead = readings.clRead == null ? null : n(readings.clRead, null);
  const alkalinity = readings.alkalinity == null ? null : n(readings.alkalinity, null);

  const ideal = {
    phMin: n(pool?.calculationProfile?.idealPhMin, 7.2),
    phMax: n(pool?.calculationProfile?.idealPhMax, 7.6),
    clMin: n(pool?.calculationProfile?.idealClMin, 1.0),
    clTarget: n(pool?.calculationProfile?.idealClTarget, 2.0),
    alkalinityMin: n(pool?.calculationProfile?.idealAlkalinityMin, 80),
  };

  const actions = [];
  const warnings = [];

  if (volumeM3 <= 0) {
    warnings.push({ code: 'POOL_VOLUME_MISSING', severity: 'WARNING' });
  }

  if (phRead != null && volumeM3 > 0 && phRead > ideal.phMax) {
    actions.push({
      code: 'REDUTOR_PH',
      productCode: 'REDUTOR_PH',
      quantity: Math.max(0, Math.round((phRead - ideal.phMax) * volumeM3 * 10)),
      unit: 'G',
      reason: 'PH_HIGH',
    });
  }

  if (phRead != null && volumeM3 > 0 && phRead < ideal.phMin) {
    actions.push({
      code: 'INCREMENTADOR_PH',
      productCode: 'INCREMENTADOR_PH',
      quantity: Math.max(0, Math.round((ideal.phMin - phRead) * volumeM3 * 15)),
      unit: 'G',
      reason: 'PH_LOW',
    });
  }

  if (clRead != null && volumeM3 > 0 && clRead < 0.5) {
    actions.push({
      code: 'CLORO_CHOQUE',
      productCode: 'CLORO_CHOQUE',
      quantity: Math.max(0, Math.round((ideal.clTarget - clRead) * volumeM3 * 20)),
      unit: 'G',
      reason: 'LOW_CHLORINE_SHOCK',
    });
  }

  if (alkalinity != null && alkalinity < ideal.alkalinityMin) {
    warnings.push({
      code: 'LOW_ALKALINITY_BUFFER_INSTABILITY',
      severity: 'WARNING',
      value: alkalinity,
      min: ideal.alkalinityMin,
    });
  }

  return {
    status: actions.length ? 'ACTION_REQUIRED' : 'OPTIMAL',
    volumeM3,
    readings: { phRead, clRead, alkalinity },
    ideal,
    actions,
    warnings,
  };
}

module.exports = { buildChemicalAdvice };
