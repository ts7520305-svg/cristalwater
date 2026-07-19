import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockRoundFindMany, mockVisitFindMany } = vi.hoisted(() => ({
  mockRoundFindMany: vi.fn(),
  mockVisitFindMany: vi.fn(),
}));

describe("AdminWeeklyPlanningBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRoundFindMany.mockReset();
    mockVisitFindMany.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      round: {
        findMany: mockRoundFindMany,
      },
      serviceVisit: {
        findMany: mockVisitFindMany,
      },
    };
  });

  it("builds a weekly plan grouped by day with rounds and visits", async () => {
    mockRoundFindMany.mockResolvedValue([
      {
        id: 1,
        name: "Segunda Norte",
        dayOfWeek: 1,
        active: true,
        technicians: [{ technician: { id: 10, name: "Ana", vehicleId: 2 } }],
        pools: [{ pool: { id: 20, name: "Piscina A", client: { name: "Cliente A" } }, order: 1 }],
      },
      {
        id: 2,
        name: "Quarta Sul",
        dayOfWeek: 3,
        active: true,
        technicians: [{ technician: { id: 11, name: "Bruno", vehicleId: 3 } }],
        pools: [{ pool: { id: 21, name: "Piscina B", client: { name: "Cliente B" } }, order: 1 }],
      },
    ]);

    mockVisitFindMany.mockResolvedValue([
      {
        id: 100,
        poolId: 20,
        roundId: 1,
        technicianId: 10,
        technician: { name: "Ana" },
        status: "PLANNED",
        plannedDate: new Date("2026-07-06T09:00:00.000Z"),
        pool: { name: "Piscina A", client: { name: "Cliente A" } },
      },
      {
        id: 101,
        poolId: 21,
        roundId: 2,
        technicianId: 11,
        technician: { name: "Bruno" },
        status: "PLANNED",
        plannedDate: new Date("2026-07-08T10:00:00.000Z"),
        pool: { name: "Piscina B", client: { name: "Cliente B" } },
      },
    ]);

    const { getWeeklyPlan } = require("../src/business/admin/AdminWeeklyPlanningBusiness");
    const plan = await getWeeklyPlan({ date: "2026-07-05T12:00:00.000Z" });

    expect(mockRoundFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          technicians: expect.any(Object),
          pools: expect.any(Object),
        }),
      }),
    );
    expect(mockVisitFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plannedDate: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
        }),
      }),
    );

    expect(plan.totalRounds).toBe(2);
    expect(plan.totalVisits).toBe(2);
    expect(plan.days).toHaveLength(7);
    expect(plan.days[1].rounds).toHaveLength(1);
    expect(plan.days[1].visits).toHaveLength(1);
    expect(plan.days[3].rounds).toHaveLength(1);
    expect(plan.days[3].visits).toHaveLength(1);
  });
});