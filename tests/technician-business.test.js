import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

let getDashboard;
let getTodayRoute;

describe("TechnicianDashboardBusiness", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    vi.resetModules();
    global.__CRISTAL_WATER_PRISMA__ = {
      serviceVisit: {
        findMany: mockFindMany,
      },
    };
    ({ getDashboard } = require("../src/business/technician/TechnicianDashboardBusiness"));
  });

  it("returns dashboard metrics and the next pending visit", async () => {
    const visits = [
      {
        id: 1,
        endAt: null,
        scheduledStart: new Date("2024-01-01T10:00:00.000Z"),
        client: { id: 10 },
        pool: { id: 20 },
      },
      {
        id: 2,
        endAt: new Date("2024-01-01T11:00:00.000Z"),
        scheduledStart: new Date("2024-01-01T09:00:00.000Z"),
        client: { id: 11 },
        pool: { id: 21 },
      },
    ];

    mockFindMany.mockResolvedValue(visits);

    const result = await getDashboard(42);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { technicianId: 42 },
        include: {
          client: true,
          pool: true,
        },
        orderBy: {
          scheduledStart: "asc",
        },
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        total: 2,
        completed: 1,
        pending: 1,
        nextVisit: visits[0],
        visits,
      })
    );
  });
});

describe("TechnicianRouteBusiness", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    vi.resetModules();
    global.__CRISTAL_WATER_PRISMA__ = {
      serviceVisit: {
        findMany: mockFindMany,
      },
    };
    ({ getTodayRoute } = require("../src/business/technician/TechnicianRouteBusiness"));
  });

  it("falls back to planned visits when none are scheduled for today", async () => {
    const fallbackVisit = {
      id: 7,
      plannedDate: new Date("2024-01-02T08:00:00.000Z"),
      client: {
        id: 99,
        accesses: [
          { id: 2, sortOrder: 2 },
          { id: 1, sortOrder: 1 },
        ],
      },
      pool: {
        notes: null,
        temporaryNotes: null,
        temporaryNotesActive: false,
      },
    };

    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([fallbackVisit]);

    const result = await getTodayRoute({ technicianId: 77 });

    expect(mockFindMany).toHaveBeenCalledTimes(2);
    expect(mockFindMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: {
          plannedDate: {
            gte: expect.any(Date),
            lt: expect.any(Date),
          },
        },
      })
    );
    expect(mockFindMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: { status: "PLANNED" },
        take: 50,
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        mode: "FALLBACK",
        total: 1,
      })
    );
    expect(result.visits[0].client.accesses).toEqual([
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ]);
    expect(result.visits[0].pool.notes).toBeNull();
    expect(result.visits[0].pool.temporaryNotes).toBeNull();
    expect(result.visits[0].pool.temporaryNotesActive).toBe(false);
  });

  it("returns today's planned route when visits exist", async () => {
    const todayVisit = {
      id: 8,
      plannedDate: new Date(),
      client: {
        id: 100,
        accesses: [
          { id: 2, sortOrder: 2 },
          { id: 1, sortOrder: 1 },
        ],
      },
      pool: {
        notes: undefined,
        temporaryNotes: undefined,
        temporaryNotesActive: undefined,
      },
    };

    mockFindMany.mockResolvedValueOnce([todayVisit]);

    const result = await getTodayRoute({ technicianId: 77 });

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          plannedDate: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
        }),
        orderBy: [
          { plannedDate: "asc" },
          { id: "asc" },
        ],
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        mode: "TODAY",
        total: 1,
      })
    );
    expect(result.visits[0].client.accesses).toEqual([
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ]);
    expect(result.visits[0].pool.notes).toBeNull();
    expect(result.visits[0].pool.temporaryNotes).toBeNull();
    expect(result.visits[0].pool.temporaryNotesActive).toBe(false);
  });
});

describe("TechnicianPortalBusiness", () => {
  it("registers a normal visit through the business layer", async () => {
    const mockTechnicianFindUnique = vi.fn().mockResolvedValue({ id: 5, name: "Ana" });
    const mockPoolFindUnique = vi.fn().mockResolvedValue({ id: 8, name: "Piscina A", clientId: 10, client: { name: "Cliente A" } });
    const mockServiceVisitCreate = vi.fn().mockResolvedValue({ id: 99, status: "DONE" });

    const mockPrisma = {
      technician: { findUnique: mockTechnicianFindUnique },
      pool: { findUnique: mockPoolFindUnique },
      serviceVisit: { create: mockServiceVisitCreate },
    };

    vi.resetModules();
    global.__CRISTAL_WATER_PRISMA__ = mockPrisma;

    const { registerVisit } = require("../src/business/technician/TechnicianPortalBusiness");

    const result = await registerVisit({
      technicianId: 5,
      poolId: 8,
      status: "DONE",
      notes: "OK",
    });

    expect(mockTechnicianFindUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(mockPoolFindUnique).toHaveBeenCalledWith({ where: { id: 8 }, include: { client: true } });
    expect(mockServiceVisitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          technicianId: 5,
          poolId: 8,
          status: "DONE",
          notes: "OK",
        }),
      })
    );
    expect(result.ok).toBe(true);
    expect(result.visit.id).toBe(99);
  });
});
