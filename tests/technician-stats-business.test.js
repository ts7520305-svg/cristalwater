import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockUserFindUnique,
  mockLocationLogCount,
  mockLocationLogAggregate,
  mockServiceVisitCount,
  mockTechnicianFindMany,
  mockTechnicianFindUnique,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockLocationLogCount: vi.fn(),
  mockLocationLogAggregate: vi.fn(),
  mockServiceVisitCount: vi.fn(),
  mockTechnicianFindMany: vi.fn(),
  mockTechnicianFindUnique: vi.fn(),
}));

describe("TechnicianStatsBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUserFindUnique.mockReset();
    mockLocationLogCount.mockReset();
    mockLocationLogAggregate.mockReset();
    mockServiceVisitCount.mockReset();
    mockTechnicianFindMany.mockReset();
    mockTechnicianFindUnique.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      locationLog: {
        count: mockLocationLogCount,
        aggregate: mockLocationLogAggregate,
      },
      serviceVisit: {
        count: mockServiceVisitCount,
      },
      user: { findUnique: mockUserFindUnique },
      technician: {
        findMany: mockTechnicianFindMany,
        findUnique: mockTechnicianFindUnique,
      },
    };
  });

  it("reflects completed visits in technician stats", async () => {
    const locationCounts = [12, 4, 9, 12, 4, 9];
    const serviceCounts = [18, 6, 11, 4, 3, 18, 6, 11, 4, 3];

    mockLocationLogCount.mockImplementation(() => Promise.resolve(locationCounts.shift()));
    mockLocationLogAggregate.mockImplementation(() => Promise.resolve({
      _min: { timestamp: new Date("2026-07-01T08:00:00.000Z") },
      _max: { timestamp: new Date("2026-07-05T08:00:00.000Z") },
    }));
    mockServiceVisitCount.mockImplementation(() => Promise.resolve(serviceCounts.shift()));
    mockTechnicianFindMany.mockResolvedValue([
      { id: 5, name: "Tiago", email: "tiago@cristalwater.pt", role: "TECHNICIAN", createdAt: new Date() },
    ]);
    mockTechnicianFindUnique.mockResolvedValue({ id: 5, name: "Tiago", email: "tiago@cristalwater.pt", role: "TECHNICIAN", createdAt: new Date() });

    mockUserFindUnique.mockResolvedValue({ id: 50 });
    const { computeStatsForTechnician, getTechnicianStats } = require("../src/business/technician/TechnicianStatsBusiness");

    const stats = await computeStatsForTechnician(5, 50);
    const response = await getTechnicianStats(5);

    expect(stats).toEqual(
      expect.objectContaining({
        totalLocationLogs: 12,
        locationLogsLast7Days: 4,
        locationLogsLast30Days: 9,
        totalServices: 18,
        servicesLast30Days: 6,
        completedServices: 11,
        completedServicesLast30Days: 4,
        totalAlerts: 3,
      }),
    );
    expect(mockLocationLogCount).toHaveBeenCalledWith({ where: { userId: 50 } });
    expect(mockServiceVisitCount).toHaveBeenCalledWith({ where: { technicianId: 5 } });
    expect(response.ok).toBe(true);
    expect(response.payload.stats.completedServices).toBe(11);
  });
});