import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockPoolFindMany, mockPoolEquipmentCreate, mockServiceVisitFindMany, mockTechnicalHistoryFindMany } = vi.hoisted(() => ({
  mockPoolFindMany: vi.fn(),
  mockPoolEquipmentCreate: vi.fn(),
  mockServiceVisitFindMany: vi.fn(),
  mockTechnicalHistoryFindMany: vi.fn(),
}));

describe("PoolDashboardBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPoolFindMany.mockReset();
    global.__CRISTAL_WATER_PRISMA__ = {
      pool: { findMany: mockPoolFindMany },
    };
  });

  it("lists pools with the same include structure as the existing controller flow", async () => {
    const pools = [{ id: 1, name: "Piscina A" }];
    mockPoolFindMany.mockResolvedValue(pools);

    const { listPools } = require("../src/business/pool/PoolDashboardBusiness");
    const result = await listPools({ includeInactive: "false" });

    expect(mockPoolFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true, deletedAt: null, archiveStatus: "ATIVO" } }));
    expect(result).toEqual(pools);
  });
});

describe("PoolEquipmentBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPoolEquipmentCreate.mockReset();
    global.__CRISTAL_WATER_PRISMA__ = {
      poolEquipment: { create: mockPoolEquipmentCreate },
    };
  });

  it("creates equipment records with the same payload shape", async () => {
    const created = { id: 7, type: "PUMP", poolId: 3 };
    mockPoolEquipmentCreate.mockResolvedValue(created);

    const { createEquipment } = require("../src/business/pool/PoolEquipmentBusiness");
    const result = await createEquipment({ type: "PUMP", poolId: 3, notes: "ok" });

    expect(mockPoolEquipmentCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "PUMP", poolId: 3, notes: "ok" }) }));
    expect(result).toEqual(created);
  });
});

describe("PoolChemistryBusiness", () => {
  it("calculates chemistry recommendations from pool measurements", async () => {
    const { calculateChemistry } = require("../src/business/pool/PoolChemistryBusiness");
    const result = await calculateChemistry({ volumeM3: 50, phCurrent: 7.8, alkalinityCurrentPpm: 70, orpCurrentMv: 600 });

    expect(result).toEqual(expect.objectContaining({ result: expect.objectContaining({ phCurrent: 7.8, alkalinityCurrentPpm: 70, orpCurrentMv: 600 }) }));
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe("PoolVisitBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockServiceVisitFindMany.mockReset();
    global.__CRISTAL_WATER_PRISMA__ = {
      serviceVisit: { findMany: mockServiceVisitFindMany },
    };
  });

  it("lists visits for a pool using the existing visit data model", async () => {
    const visits = [{ id: 10, poolId: 3, status: "PLANNED" }];
    mockServiceVisitFindMany.mockResolvedValue(visits);

    const { listVisitsForPool } = require("../src/business/pool/PoolVisitBusiness");
    const result = await listVisitsForPool(3);

    expect(mockServiceVisitFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { poolId: 3 } }));
    expect(result).toEqual(visits);
  });
});
