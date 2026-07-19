import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockPoolFindUnique,
  mockTechnicalAlertFindMany,
  mockServiceVisitFindMany,
  mockTechnicalHistoryFindMany,
  mockTechnicalHistoryCreate,
} = vi.hoisted(() => ({
  mockPoolFindUnique: vi.fn(),
  mockTechnicalAlertFindMany: vi.fn(),
  mockServiceVisitFindMany: vi.fn(),
  mockTechnicalHistoryFindMany: vi.fn(),
  mockTechnicalHistoryCreate: vi.fn(),
}));

describe("Pool OS maintenance flow", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPoolFindUnique.mockReset();
    mockTechnicalAlertFindMany.mockReset();
    mockServiceVisitFindMany.mockReset();
    mockTechnicalHistoryFindMany.mockReset();
    mockTechnicalHistoryCreate.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      pool: {
        findUnique: mockPoolFindUnique,
      },
      technicalAlert: {
        findMany: mockTechnicalAlertFindMany,
      },
      serviceVisit: {
        findMany: mockServiceVisitFindMany,
      },
      technicalHistory: {
        findMany: mockTechnicalHistoryFindMany,
        create: mockTechnicalHistoryCreate,
      },
    };
  });

  it("allows a technician maintenance cycle using only Pool OS business modules", async () => {
    const poolId = 12;
    const maintenanceAlerts = [{ id: 30, poolId, message: "Verificar filtro" }];
    const visits = [{ id: 40, poolId, status: "PLANNED" }];
    const existingHistory = [{ id: 50, poolId, component: "Filtro" }];
    const createdHistory = { id: 51, poolId, component: "Filtro", description: "Limpeza concluida" };
    const pool = {
      id: poolId,
      name: "Piscina Centro",
      technicalSheet: { id: 5, volumeM3: 48, targetPhMin: 7.2, targetPhMax: 7.6 },
      technicalAlerts: maintenanceAlerts,
      serviceVisits: visits,
      technicalHistory: existingHistory,
    };

    mockPoolFindUnique.mockResolvedValue(pool);
    mockTechnicalAlertFindMany.mockResolvedValue(maintenanceAlerts);
    mockServiceVisitFindMany.mockResolvedValue(visits);
    mockTechnicalHistoryFindMany.mockResolvedValue(existingHistory);
    mockTechnicalHistoryCreate.mockResolvedValue(createdHistory);

    const { getPoolById } = require("../src/business/pool/PoolDashboardBusiness");
    const { listMaintenanceForPool } = require("../src/business/pool/PoolMaintenanceBusiness");
    const { listVisitsForPool } = require("../src/business/pool/PoolVisitBusiness");
    const { calculateChemistry } = require("../src/business/pool/PoolChemistryBusiness");
    const {
      listTechnicalHistoryByPool,
      createTechnicalHistory,
    } = require("../src/business/pool/PoolHistoryBusiness");

    const loadedPool = await getPoolById(poolId);
    const loadedMaintenance = await listMaintenanceForPool(poolId);
    const loadedVisits = await listVisitsForPool(poolId);
    const chemistry = calculateChemistry({
      volumeM3: 48,
      phCurrent: 7.8,
      alkalinityCurrentPpm: 70,
      orpCurrentMv: 610,
    });
    const beforeHistory = await listTechnicalHistoryByPool(poolId);
    const savedHistory = await createTechnicalHistory({
      poolId,
      component: " Filtro ",
      description: " Limpeza concluida ",
      performedAt: "2026-07-05T10:00:00.000Z",
      nextSuggested: null,
    });

    expect(loadedPool).toEqual(
      expect.objectContaining({
        ...pool,
        healthScore: 80,
        healthStatus: "GOOD",
      }),
    );
    expect(loadedMaintenance).toEqual(maintenanceAlerts);
    expect(loadedVisits).toEqual(visits);
    expect(beforeHistory).toEqual(existingHistory);
    expect(savedHistory).toEqual(createdHistory);

    expect(chemistry.recommendations.length).toBeGreaterThan(0);
    expect(chemistry.result).toEqual(
      expect.objectContaining({
        phCurrent: 7.8,
        alkalinityCurrentPpm: 70,
        orpCurrentMv: 610,
      }),
    );

    expect(mockTechnicalHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        poolId,
        component: "Filtro",
        description: "Limpeza concluida",
      }),
    });
  });
});