import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockLocationLogCount,
  mockLocationLogAggregate,
  mockServiceVisitCount,
  mockUserFindMany,
  mockUserFindFirst,
} = vi.hoisted(() => ({
  mockLocationLogCount: vi.fn(),
  mockLocationLogAggregate: vi.fn(),
  mockServiceVisitCount: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockUserFindFirst: vi.fn(),
}));

describe("TechnicianStatsBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLocationLogCount.mockReset();
    mockLocationLogAggregate.mockReset();
    mockServiceVisitCount.mockReset();
    mockUserFindMany.mockReset();
    mockUserFindFirst.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      locationLog: {
        count: mockLocationLogCount,
        aggregate: mockLocationLogAggregate,
      },
      serviceVisit: {
        count: mockServiceVisitCount,
      },
      user: {
        findMany: mockUserFindMany,
        findFirst: mockUserFindFirst,
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
    mockUserFindMany.mockResolvedValue([
      { id: 5, name: "Tiago", email: "tiago@cristalwater.pt", role: "TECHNICIAN", createdAt: new Date() },
    ]);
    mockUserFindFirst.mockResolvedValue({ id: 5, name: "Tiago", email: "tiago@cristalwater.pt", role: "TECHNICIAN", createdAt: new Date() });

    const { computeStatsForTechnician, getTechnicianStats } = require("../src/business/technician/TechnicianStatsBusiness");

    const stats = await computeStatsForTechnician(5);
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
    expect(response.ok).toBe(true);
    expect(response.payload.stats.completedServices).toBe(11);
  });
});