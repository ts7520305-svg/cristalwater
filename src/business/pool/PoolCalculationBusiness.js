const prismaClient = require("../../prismaClient");
const PoolChemistryBusiness = require("./PoolChemistryBusiness");
const { calculatePoolOptimization } = require("../../services/poolCalculationService");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

function inputFromPool(pool, profile, extra = {}) {
  const eq = pool?.equipment || {};
  return {
    volumeM3: pool?.volumeM3 || profile?.volumeM3,
    shape: profile?.shape || pool?.type || "RECTANGULAR",
    lengthM: profile?.lengthM,
    widthM: profile?.widthM,
    diameterM: profile?.diameterM,
    depthMinM: profile?.depthMinM,
    depthMaxM: profile?.depthMaxM,
    averageDepthM: profile?.averageDepthM,
    shapeFactor: profile?.shapeFactor,
    surfaceM2: profile?.surfaceM2,
    pumpFlowM3h: profile?.pumpFlowM3h,
    pumpPowerHp: profile?.pumpPowerHp,
    bathersAverage: profile?.bathersAverage,
    poolLoad: profile?.poolLoad,
    saltCurrentPpm: profile?.saltCurrentPpm,
    targetSalinityPpm: profile?.targetSalinityPpm || 3500,
    chlorinatorGph: profile?.chlorinatorGph,
    chlorineCurrentPpm: profile?.chlorineCurrentPpm,
    targetChlorinePpm: profile?.targetChlorinePpm || 2,
    heatPumpPhase: profile?.heatPumpPhase,
    heatPumpThermalKw: profile?.heatPumpThermalKw,
    heatPumpElectricalKw: profile?.heatPumpElectricalKw,
    cop: profile?.cop || 5,
    currentWaterTempC: profile?.currentWaterTempC,
    targetWaterTempC: profile?.targetWaterTempC || 27,
    covered: profile?.covered,
    ambientLossFactor: profile?.ambientLossFactor,
    notes: profile?.notes,
    saltSystem: eq?.saltSystem,
    ...extra,
  };
}

async function getPoolCalculations(poolId, query = {}) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { client: true, equipment: true, calculationProfile: true },
  });

  if (!pool) {
    return null;
  }

  const input = inputFromPool(pool, pool.calculationProfile, query || {});
  const calculation = calculatePoolOptimization(input);

  return {
    pool,
    profile: pool.calculationProfile,
    calculation,
  };
}

async function savePoolCalculations(poolId, body = {}) {
  const existingPool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { equipment: true },
  });

  if (!existingPool) {
    return null;
  }

  const payload = PoolChemistryBusiness.profilePayload(body);
  const calculation = calculatePoolOptimization(payload);
  const chem = PoolChemistryBusiness.calculateChemistry(body);
  calculation.chemistry = chem.result;
  calculation.recommendations = [...(calculation.recommendations || []), ...chem.recommendations];
  payload.lastResultJson = calculation;

  const profile = await prisma.poolCalculationProfile.upsert({
    where: { poolId },
    update: payload,
    create: { poolId, ...payload },
  });

  if (calculation.geometry?.volumeM3) {
    await prisma.pool.update({
      where: { id: poolId },
      data: { volumeM3: calculation.geometry.volumeM3, type: payload.shape },
    });
  }

  return {
    profile,
    calculation,
  };
}

function previewCalculation(body = {}) {
  const calculation = calculatePoolOptimization(PoolChemistryBusiness.profilePayload(body));
  const chem = PoolChemistryBusiness.calculateChemistry(body);
  calculation.chemistry = chem.result;
  calculation.recommendations = [...(calculation.recommendations || []), ...chem.recommendations];
  return { calculation };
}

module.exports = {
  getPoolCalculations,
  savePoolCalculations,
  previewCalculation,
};