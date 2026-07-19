import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockFindMany, mockJson } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockJson: vi.fn(),
}));

describe("RouteController", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindMany.mockReset();
    mockJson.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      serviceVisit: {
        findMany: mockFindMany,
      },
    };

    global.io = {
      emit: vi.fn(),
    };
  });

  it("orders planned visits by proximity from the provided coordinates", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 1,
        technicianId: 10,
        plannedDate: new Date("2026-07-05T08:00:00.000Z"),
        status: "PLANNED",
        client: { id: 101 },
        pool: { id: 201, latitude: 0.1, longitude: 0 },
      },
      {
        id: 2,
        technicianId: 10,
        plannedDate: new Date("2026-07-05T09:00:00.000Z"),
        status: "PLANNED",
        client: { id: 102 },
        pool: { id: 202, latitude: 10, longitude: 0 },
      },
      {
        id: 3,
        technicianId: 10,
        plannedDate: new Date("2026-07-05T10:00:00.000Z"),
        status: "PLANNED",
        client: { id: 103 },
        pool: { id: 203, latitude: 0.2, longitude: 0 },
      },
    ]);

    const { optimizeRoute } = require("../src/controllers/routeController");
    const req = { query: { lat: 0, lng: 0 } };
    const res = { json: mockJson };

    await optimizeRoute(req, res);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PLANNED" },
      })
    );
    expect(mockJson).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 3 }),
      expect.objectContaining({ id: 2 }),
    ]);
  });
});