import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockClientFindUnique, mockPoolFindMany, mockServiceVisitFindMany, mockNotificationFindMany, mockClientMessageFindMany, mockClientMessageCreate, mockNotificationCreate, mockCommunicationCreate } = vi.hoisted(() => ({
  mockClientFindUnique: vi.fn(),
  mockPoolFindMany: vi.fn(),
  mockServiceVisitFindMany: vi.fn(),
  mockNotificationFindMany: vi.fn(),
  mockClientMessageFindMany: vi.fn(),
  mockClientMessageCreate: vi.fn(),
  mockNotificationCreate: vi.fn(),
  mockCommunicationCreate: vi.fn(),
}));

describe("customerPortalService", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.UPLOAD_DIR = "uploads/qa/tests";
    process.env.QA_ENVIRONMENT_SAFE = "true";

    vi.resetModules();
    mockClientFindUnique.mockReset();
    mockPoolFindMany.mockReset();
    mockServiceVisitFindMany.mockReset();
    mockNotificationFindMany.mockReset();
    mockClientMessageFindMany.mockReset();
    mockClientMessageCreate.mockReset();
    mockNotificationCreate.mockReset();
    mockCommunicationCreate.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      client: { findUnique: mockClientFindUnique },
      pool: { findMany: mockPoolFindMany },
      serviceVisit: { findMany: mockServiceVisitFindMany },
      notification: {
        findMany: mockNotificationFindMany,
        create: mockNotificationCreate,
      },
      clientMessage: {
        findMany: mockClientMessageFindMany,
        create: mockClientMessageCreate,
      },
      communicationLog: { create: mockCommunicationCreate },
      $transaction: async (input) => {
        if (typeof input === "function") {
          return input(global.__CRISTAL_WATER_PRISMA__);
        }
        return Promise.all(input);
      },
    };
  });

  it("builds customer permissions with read-only isolation", async () => {
    const { customerPermissions } = require("../src/services/customerPortalService");

    expect(customerPermissions({ id: 9, status: "ACTIVE", active: true, billingActive: true, contractActive: true })).toEqual(
      expect.objectContaining({
        readOnly: true,
        canRequestVisit: true,
        canViewDocuments: true,
        isolation: expect.objectContaining({ clientId: 9, scope: "client-owned-data-only" }),
      })
    );
  });

  it("groups customer history by pool and keeps chemistry details", async () => {
    mockPoolFindMany.mockResolvedValue([{ id: 20 }, { id: 21 }]);
    mockServiceVisitFindMany.mockResolvedValue([
      {
        id: 1,
        poolId: 20,
        date: new Date("2026-07-01T10:00:00.000Z"),
        plannedDate: new Date("2026-07-01T10:00:00.000Z"),
        startAt: new Date("2026-07-01T10:05:00.000Z"),
        endAt: new Date("2026-07-01T10:30:00.000Z"),
        status: "DONE",
        technicianName: "Ana",
        notes: "Tudo ok",
        internalNotes: "Sem problemas",
        alerts: "Sem alertas",
        products: JSON.stringify([{ name: "Cloro", quantity: 2, unit: "KG" }]),
        ph: 7.4,
        chlorine: 2,
        alkalinity: 100,
        salt: 3500,
        temperature: 26,
        orpMv: 720,
        pool: { id: 20, name: "Piscina A", zone: "Norte" },
        technician: { name: "Ana" },
        photos: [{ id: 1, url: "/photo.jpg", type: "BEFORE", createdAt: new Date("2026-07-01T10:15:00.000Z") }],
        chemicals: [{ id: 1, name: "Cloro", quantity: 2, unit: "KG" }],
      },
    ]);

    const { listCustomerHistory } = require("../src/services/customerPortalService");
    const result = await listCustomerHistory(7);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        poolId: 20,
        poolName: "Piscina A",
        serviceVisits: [expect.objectContaining({
          id: 1,
          technicianName: "Ana",
          ph: 7.4,
          chlorine: 2,
          chemicals: [expect.objectContaining({ name: "Cloro" })],
        })],
      })
    );
  });

  it("creates a visit request message and notification", async () => {
    mockClientFindUnique.mockResolvedValue({ id: 7, name: "Cliente Teste", status: "ACTIVE", active: true, billingActive: true, contractActive: true });
    mockPoolFindMany.mockResolvedValue([{ id: 20 }]);
    mockServiceVisitFindMany.mockResolvedValue([{ id: 30, poolId: 20 }]);
    mockClientMessageCreate.mockResolvedValue({ id: 123, clientId: 7, message: "Pedido de visita: preciso de apoio" });
    mockNotificationCreate.mockResolvedValue({ id: 321, clientId: 7 });
    mockCommunicationCreate.mockResolvedValue({ id: 222 });

    const { createVisitRequest } = require("../src/services/customerPortalService");
    const result = await createVisitRequest(7, { message: "preciso de apoio" });

    expect(result.ok).toBe(true);
    expect(mockClientMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 7,
          senderType: "CLIENT",
          messageType: "VISIT_REQUEST",
        }),
      })
    );
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 7,
          type: "VISIT_REQUEST",
          eventType: "CLIENT_VISIT_REQUEST",
        }),
      })
    );
  });
});
