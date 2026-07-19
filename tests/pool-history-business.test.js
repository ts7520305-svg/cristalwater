import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockFindMany,
  mockFindUnique,
  mockCreate,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

describe("PoolHistoryBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    global.__CRISTAL_WATER_PRISMA__ = {
      technicalHistory: {
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
      },
    };
  });

  it("lists all technical history with the same include shape", async () => {
    mockFindMany.mockResolvedValue([]);
    const { listAllTechnicalHistory } = require("../src/business/pool/PoolHistoryBusiness");
    await listAllTechnicalHistory();

    expect(mockFindMany).toHaveBeenCalledWith({
      orderBy: { performedAt: "desc" },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
      },
    });
  });

  it("creates technical history entry preserving field mapping", async () => {
    mockCreate.mockResolvedValue({ id: 1 });
    const { createTechnicalHistory } = require("../src/business/pool/PoolHistoryBusiness");
    await createTechnicalHistory({
      poolId: "8",
      component: " Pump ",
      description: " Replaced seal ",
      performedAt: "2026-06-01T10:00:00.000Z",
      nextSuggested: null,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        poolId: 8,
        component: "Pump",
        description: "Replaced seal",
        nextSuggested: null,
      }),
    });
  });

  it("returns null on update when entry does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    const { updateTechnicalHistory } = require("../src/business/pool/PoolHistoryBusiness");
    const result = await updateTechnicalHistory(123, { description: "x" });
    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns false on remove when entry does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    const { removeTechnicalHistory } = require("../src/business/pool/PoolHistoryBusiness");
    const result = await removeTechnicalHistory(55);
    expect(result).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});