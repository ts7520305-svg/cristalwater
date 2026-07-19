import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockPoolFindUnique, mockProfileUpsert, mockPoolUpdate } = vi.hoisted(() => ({
  mockPoolFindUnique: vi.fn(),
  mockProfileUpsert: vi.fn(),
  mockPoolUpdate: vi.fn(),
}));

describe("Pool OS chemistry workflow", () => {
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

  it("supports preview and save chemistry decisions in one operational flow", async () => {
    const pool = {
      id: 15,
      type: "RECTANGULAR",
      volumeM3: 55,
      equipment: { saltSystem: true },
      calculationProfile: { shape: "RECTANGULAR", lengthM: 10, widthM: 5, depthMinM: 1, depthMaxM: 2 },
    };
    mockPoolFindUnique.mockResolvedValue(pool);
    mockProfileUpsert.mockResolvedValue({ id: 90, poolId: 15, shape: "RECTANGULAR" });
    mockPoolUpdate.mockResolvedValue({ id: 15 });

    const { getPoolCalculations, previewCalculation, savePoolCalculations } = require("../src/business/pool/PoolCalculationBusiness");

    const loaded = await getPoolCalculations(15, {});
    const preview = previewCalculation({
      shape: "RECTANGULAR",
      lengthM: 10,
      widthM: 5,
      depthMinM: 1,
      depthMaxM: 2,
      phCurrent: 7.9,
      alkalinityCurrentPpm: 65,
      orpCurrentMv: 610,
    });
    const saved = await savePoolCalculations(15, {
      shape: "RECTANGULAR",
      lengthM: 10,
      widthM: 5,
      depthMinM: 1,
      depthMaxM: 2,
      phCurrent: 7.9,
      alkalinityCurrentPpm: 65,
      orpCurrentMv: 610,
    });

    expect(loaded).toEqual(expect.objectContaining({ pool }));
    expect(preview.calculation).toEqual(expect.objectContaining({ chemistry: expect.any(Object) }));
    expect(preview.calculation.recommendations.length).toBeGreaterThan(0);
    expect(saved).toEqual(expect.objectContaining({ profile: expect.objectContaining({ poolId: 15 }) }));
  });
});