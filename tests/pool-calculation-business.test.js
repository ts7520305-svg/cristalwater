import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockPoolFindUnique, mockProfileUpsert, mockPoolUpdate } = vi.hoisted(() => ({
  mockPoolFindUnique: vi.fn(),
  mockProfileUpsert: vi.fn(),
  mockPoolUpdate: vi.fn(),
}));

describe("PoolCalculationBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPoolFindUnique.mockReset();
    mockProfileUpsert.mockReset();
    mockPoolUpdate.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      pool: {
        findUnique: mockPoolFindUnique,
        update: mockPoolUpdate,
      },
      poolCalculationProfile: {
        upsert: mockProfileUpsert,
      },
    };
  });

  it("loads pool calculations with existing include structure", async () => {
    const pool = { id: 7, type: "RECTANGULAR", equipment: {}, calculationProfile: { shape: "RECTANGULAR" } };
    mockPoolFindUnique.mockResolvedValue(pool);

    const { getPoolCalculations } = require("../src/business/pool/PoolCalculationBusiness");
    const result = await getPoolCalculations(7, {});

    expect(mockPoolFindUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      include: { client: true, equipment: true, calculationProfile: true },
    });
    expect(result).toEqual(expect.objectContaining({ pool, profile: pool.calculationProfile }));
    expect(result.calculation).toBeTruthy();
  });

  it("saves chemistry/calculation profile and persists lastResultJson", async () => {
    mockPoolFindUnique.mockResolvedValue({ id: 11, equipment: {} });
    mockProfileUpsert.mockResolvedValue({ id: 21, poolId: 11 });
    mockPoolUpdate.mockResolvedValue({ id: 11 });

    const { savePoolCalculations } = require("../src/business/pool/PoolCalculationBusiness");
    const result = await savePoolCalculations(11, {
      shape: "RECTANGULAR",
      lengthM: 8,
      widthM: 4,
      depthMinM: 1,
      depthMaxM: 2,
      phCurrent: 7.8,
      alkalinityCurrentPpm: 70,
      orpCurrentMv: 620,
    });

    expect(mockProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { poolId: 11 },
        update: expect.objectContaining({
          shape: "RECTANGULAR",
          lastResultJson: expect.any(Object),
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ profile: { id: 21, poolId: 11 } }));
  });
});