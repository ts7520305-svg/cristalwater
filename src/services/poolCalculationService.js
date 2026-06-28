function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function positive(v, fallback = 0) {
  const x = n(v, fallback);
  return x > 0 ? x : fallback;
}

function round(value, decimals = 2) {
  const x = Number(value);
  if (!Number.isFinite(x)) return null;
  const factor = 10 ** decimals;
  return Math.round(x * factor) / factor;
}

function clampMin(value, min = 0) {
  const x = Number(value);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, x);
}

function computeSurfaceAndVolume(input = {}) {
  const shape = String(input.shape || 'RECTANGULAR').toUpperCase();
  const lengthM = positive(input.lengthM);
  const widthM = positive(input.widthM);
  const diameterM = positive(input.diameterM);
  const depthMinM = positive(input.depthMinM, positive(input.averageDepthM));
  const depthMaxM = positive(input.depthMaxM, positive(input.averageDepthM, depthMinM));
  const averageDepthM = positive(input.averageDepthM, (depthMinM + depthMaxM) / 2 || 1.5);
  const shapeFactor = positive(input.shapeFactor, shape === 'KIDNEY' || shape === 'FREEFORM' ? 0.8 : 1);
  const customSurfaceM2 = positive(input.surfaceM2);
  const customVolumeM3 = positive(input.volumeM3);

  let surfaceM2 = customSurfaceM2;
  let formula = 'custom';

  if (!surfaceM2) {
    if (shape === 'ROUND' || shape === 'CIRCULAR') {
      const r = diameterM / 2;
      surfaceM2 = Math.PI * r * r;
      formula = 'round: π × r²';
    } else if (shape === 'OVAL') {
      surfaceM2 = Math.PI * (lengthM / 2) * (widthM / 2);
      formula = 'oval: π × (L/2) × (W/2)';
    } else if (shape === 'KIDNEY') {
      surfaceM2 = lengthM * widthM * shapeFactor;
      formula = 'kidney/freeform approximation: L × W × factor';
    } else if (shape === 'FREEFORM') {
      surfaceM2 = lengthM * widthM * shapeFactor;
      formula = 'freeform approximation: L × W × factor';
    } else {
      surfaceM2 = lengthM * widthM;
      formula = 'rectangular: L × W';
    }
  }

  const volumeM3 = customVolumeM3 || surfaceM2 * averageDepthM;

  return {
    shape,
    lengthM: round(lengthM),
    widthM: round(widthM),
    diameterM: round(diameterM),
    averageDepthM: round(averageDepthM),
    depthMinM: round(depthMinM),
    depthMaxM: round(depthMaxM),
    shapeFactor: round(shapeFactor, 3),
    surfaceM2: round(surfaceM2),
    volumeM3: round(volumeM3),
    volumeLitres: round(volumeM3 * 1000, 0),
    formula,
  };
}

function computeFiltration(input = {}, geometry = {}) {
  const volumeM3 = positive(input.volumeM3, geometry.volumeM3 || 0);
  const pumpFlowM3h = positive(input.pumpFlowM3h);
  const bathersAverage = n(input.bathersAverage, 0);
  const highLoad = bathersAverage >= 8 || String(input.poolLoad || '').toUpperCase() === 'HIGH';
  const lowLoad = bathersAverage <= 2 && String(input.poolLoad || '').toUpperCase() === 'LOW';
  const turnoversMin = highLoad ? 2 : lowLoad ? 1.5 : 1.5;
  const turnoversIdeal = highLoad ? 3 : lowLoad ? 2 : 2.5;
  const turnoverHours = pumpFlowM3h ? volumeM3 / pumpFlowM3h : null;
  const minHours = pumpFlowM3h ? (volumeM3 * turnoversMin) / pumpFlowM3h : null;
  const idealHours = pumpFlowM3h ? (volumeM3 * turnoversIdeal) / pumpFlowM3h : null;
  const summerBoostHours = highLoad ? 2 : bathersAverage >= 4 ? 1 : 0;

  return {
    pumpFlowM3h: round(pumpFlowM3h),
    bathersAverage,
    recommendedTurnoversMin: turnoversMin,
    recommendedTurnoversIdeal: turnoversIdeal,
    oneTurnoverHours: round(turnoverHours),
    minimumFiltrationHoursDay: round(minHours),
    idealFiltrationHoursDay: round(idealHours ? idealHours + summerBoostHours : null),
    suggestedProgram: idealHours ? `Dividir em 2-3 períodos/dia. Base: ${round(idealHours + summerBoostHours)}h/dia.` : 'Indicar caudal da bomba para calcular horas.',
    notes: [
      'Valores indicativos; ajustar por temperatura, carga orgânica, pó, vento e histórico da piscina.',
      'Evitar deixar a água demasiadas horas parada; preferir dividir a filtração em vários períodos.',
    ],
  };
}

function computeSalt(input = {}, geometry = {}) {
  const volumeM3 = positive(input.volumeM3, geometry.volumeM3 || 0);
  const current = clampMin(input.saltCurrentPpm);
  const target = positive(input.targetSalinityPpm, 3500);
  const delta = Math.max(0, target - current);
  const kgToAdd = (delta * volumeM3) / 1000;
  return {
    saltCurrentPpm: round(current, 0),
    targetSalinityPpm: round(target, 0),
    saltMissingPpm: round(delta, 0),
    saltKgToAdd: round(kgToAdd, 1),
    formula: 'kg = (ppm alvo - ppm atual) × m³ / 1000',
    note: '1 kg de sal em 1 m³ de água aumenta aproximadamente 1000 ppm.',
  };
}

function computeChlorination(input = {}, geometry = {}) {
  const volumeM3 = positive(input.volumeM3, geometry.volumeM3 || 0);
  const chlorinatorGph = positive(input.chlorinatorGph);
  const current = clampMin(input.chlorineCurrentPpm);
  const target = positive(input.targetChlorinePpm, 2);
  const bathersAverage = n(input.bathersAverage, 0);
  const delta = Math.max(0, target - current);
  const gramsToReachTarget = delta * volumeM3;
  const hoursToReachTarget = chlorinatorGph ? gramsToReachTarget / chlorinatorGph : null;
  const dailyPpmDemand = Math.min(4, 1.2 + bathersAverage * 0.12 + (String(input.poolLoad || '').toUpperCase() === 'HIGH' ? 0.5 : 0));
  const dailyChlorineGrams = dailyPpmDemand * volumeM3;
  const dailyProductionHours = chlorinatorGph ? dailyChlorineGrams / chlorinatorGph : null;
  const idealGphFor8h = dailyChlorineGrams / 8;
  const idealGphFor10h = dailyChlorineGrams / 10;

  return {
    chlorinatorGph: round(chlorinatorGph),
    chlorineCurrentPpm: round(current, 2),
    targetChlorinePpm: round(target, 2),
    chlorineMissingPpm: round(delta, 2),
    chlorineGramsToReachTarget: round(gramsToReachTarget, 1),
    chlorinatorHoursToReachTarget: round(hoursToReachTarget, 2),
    estimatedDailyPpmDemand: round(dailyPpmDemand, 2),
    estimatedDailyChlorineGrams: round(dailyChlorineGrams, 1),
    estimatedDailyProductionHours: round(dailyProductionHours, 2),
    idealChlorinatorRangeGph: `${round(idealGphFor10h, 1)} - ${round(idealGphFor8h, 1)} g/h`,
    note: 'Regra técnica aproximada: 1 ppm em 1 m³ equivale a cerca de 1 g de cloro disponível.',
  };
}

function computeHeatPump(input = {}, geometry = {}) {
  const volumeM3 = positive(input.volumeM3, geometry.volumeM3 || 0);
  const currentWaterTempC = n(input.currentWaterTempC, 20);
  const targetWaterTempC = n(input.targetWaterTempC, 27);
  const deltaT = Math.max(0, targetWaterTempC - currentWaterTempC);
  const heatPumpThermalKw = positive(input.heatPumpThermalKw || input.heatPumpPowerKw);
  const cop = positive(input.cop, 5);
  const covered = Boolean(input.covered);
  const ambientLossFactor = positive(input.ambientLossFactor, covered ? 1.08 : 1.25);
  const waterEnergyKwh = volumeM3 * 1.163 * deltaT;
  const adjustedThermalKwh = waterEnergyKwh * ambientLossFactor;
  const electricKwh = cop ? adjustedThermalKwh / cop : null;
  const hoursToTarget = heatPumpThermalKw ? adjustedThermalKwh / heatPumpThermalKw : null;

  return {
    currentWaterTempC: round(currentWaterTempC, 1),
    targetWaterTempC: round(targetWaterTempC, 1),
    deltaT: round(deltaT, 1),
    covered,
    heatPumpThermalKw: round(heatPumpThermalKw, 2),
    cop: round(cop, 2),
    ambientLossFactor: round(ambientLossFactor, 2),
    thermalEnergyKwhWithoutLoss: round(waterEnergyKwh, 1),
    thermalEnergyKwhAdjusted: round(adjustedThermalKwh, 1),
    estimatedElectricKwh: round(electricKwh, 1),
    estimatedHoursToTarget: round(hoursToTarget, 1),
    formula: 'kWh térmicos = m³ × 1,163 × ΔT; horas = kWh térmicos ajustados / kW térmicos da bomba de calor',
    note: 'Estimativa; vento, humidade, temperatura ambiente, cobertura, perdas por evaporação e potência real alteram bastante o resultado.',
  };
}

function buildRecommendations(calc) {
  const recs = [];
  if (calc.salt?.saltKgToAdd > 0) recs.push(`Adicionar aproximadamente ${calc.salt.saltKgToAdd} kg de sal para atingir ${calc.salt.targetSalinityPpm} ppm.`);
  if (calc.filtration?.idealFiltrationHoursDay) recs.push(`Programar filtração ideal perto de ${calc.filtration.idealFiltrationHoursDay} h/dia, dividida em 2-3 blocos.`);
  if (calc.chlorination?.estimatedDailyProductionHours) recs.push(`Máquina de sal: estimativa diária ${calc.chlorination.estimatedDailyProductionHours} h/dia para compensar consumo normal.`);
  if (calc.heatPump?.estimatedHoursToTarget) recs.push(`Bomba de calor: cerca de ${calc.heatPump.estimatedHoursToTarget} h para subir de ${calc.heatPump.currentWaterTempC}°C para ${calc.heatPump.targetWaterTempC}°C.`);
  if (!recs.length) recs.push('Preencher medidas, caudal, salinidade, máquina de sal e bomba de calor para obter recomendações completas.');
  return recs;
}

function calculatePoolOptimization(input = {}) {
  const geometry = computeSurfaceAndVolume(input);
  const merged = { ...input, volumeM3: input.volumeM3 || geometry.volumeM3, bathersAverage: input.bathersAverage };
  const filtration = computeFiltration(merged, geometry);
  const salt = computeSalt(merged, geometry);
  const chlorination = computeChlorination(merged, geometry);
  const heatPump = computeHeatPump(merged, geometry);
  const result = {
    generatedAt: new Date().toISOString(),
    geometry,
    filtration,
    salt,
    chlorination,
    heatPump,
  };
  result.recommendations = buildRecommendations(result);
  return result;
}

module.exports = { calculatePoolOptimization };
