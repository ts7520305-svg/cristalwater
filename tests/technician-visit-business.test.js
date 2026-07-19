import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

describe("TechnicianVisitBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindUnique.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      serviceVisit: {
        findUnique: mockFindUnique,
      },
    };
  });

  it("loads assigned visit with notes, alerts and chemistry targets", async () => {
    mockFindUnique.mockResolvedValue({
      id: 300,
      client: {
        id: 7,
        name: "Cliente Visit OS",
        email: "cliente@cristalwater.pt",
        phone: "910000000",
        zone: "LISBOA",
      },
      notes: "Observacoes da visita",
      internalNotes: "Nota temporaria de campo",
      pool: {
        id: 20,
        name: "Piscina Visit OS",
        location: "Zona Sul",
        address: "Rua A",
        zone: "LISBOA",
        notes: "Nota permanente da piscina",
        technicalSheet: {
          targetPhMin: 7.2,
          targetPhMax: 7.6,
          targetChlorineMin: 1,
          targetChlorineMax: 3,
        },
        technicalAlerts: [{ id: 1, status: "OPEN" }],
        technicalHistory: [{ id: 10 }],
      },
      chemicals: [],
      photos: [],
    });

    const { getVisitById } = require("../src/business/technician/TechnicianVisitBusiness");
    const result = await getVisitById(300);

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 300 },
        include: expect.objectContaining({
          pool: expect.objectContaining({
            include: expect.objectContaining({
              technicalSheet: true,
              technicalAlerts: expect.objectContaining({ where: { status: "OPEN" } }),
            }),
          }),
        }),
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.visit.pool.technicalSheet).toEqual(
      expect.objectContaining({
        targetPhMin: 7.2,
        targetPhMax: 7.6,
      }),
    );
    expect(result.visit.pool.technicalAlerts).toEqual([{ id: 1, status: "OPEN" }]);
    expect(result.context.customer).toEqual(
      expect.objectContaining({
        id: 7,
        name: "Cliente Visit OS",
      }),
    );
    expect(result.context.pool).toEqual(
      expect.objectContaining({
        id: 20,
        name: "Piscina Visit OS",
      }),
    );
    expect(result.context.alertsCount).toBe(1);
    expect(result.visit.notes).toBe("Observacoes da visita");
    expect(result.visit.internalNotes).toBe("Nota temporaria de campo");
  });
});