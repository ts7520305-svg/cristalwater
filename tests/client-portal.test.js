import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockClientFindFirst, mockServiceVisitFindMany, mockInvoiceFindMany } = vi.hoisted(() => ({
  mockClientFindFirst: vi.fn(),
  mockServiceVisitFindMany: vi.fn(),
  mockInvoiceFindMany: vi.fn(),
}));

describe("clientPortalController", () => {
  beforeEach(() => {
    vi.resetModules();
    mockClientFindFirst.mockReset();
    mockServiceVisitFindMany.mockReset();
    mockInvoiceFindMany.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      client: {
        findFirst: mockClientFindFirst,
      },
      serviceVisit: {
        findMany: mockServiceVisitFindMany,
      },
      invoice: {
        findMany: mockInvoiceFindMany,
      },
    };
  });

  it("returns a pool timeline so the customer can follow each pool from portal", async () => {
    mockClientFindFirst.mockResolvedValue({
      id: 7,
      name: "Cliente Teste",
      email: "cliente@teste.com",
      phone: "123",
      zone: "Centro",
      status: "ACTIVE",
      creditBalance: 0,
      pools: [
        { id: 20, name: "Piscina A", location: "Moradia A", zone: "Norte" },
        { id: 21, name: "Piscina B", location: "Moradia B", zone: "Sul" },
      ],
    });

    mockServiceVisitFindMany
      .mockResolvedValueOnce([
        {
          id: 100,
          poolId: 20,
          plannedDate: new Date("2026-07-07T09:00:00.000Z"),
          date: new Date("2026-07-07T09:00:00.000Z"),
          startAt: new Date("2026-07-07T09:15:00.000Z"),
          endAt: null,
          status: "PLANNED",
          createdAt: new Date("2026-07-01T10:00:00.000Z"),
          pool: { id: 20, clientId: 7 },
        },
        {
          id: 101,
          poolId: 21,
          plannedDate: new Date("2026-07-08T09:00:00.000Z"),
          date: new Date("2026-07-08T09:00:00.000Z"),
          startAt: new Date("2026-07-08T09:15:00.000Z"),
          endAt: null,
          status: "PLANNED",
          createdAt: new Date("2026-07-01T10:00:00.000Z"),
          pool: { id: 21, clientId: 7 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 900,
          poolId: 20,
          pool: { name: "Piscina A", type: "Privada" },
          technician: { name: "Ana" },
          plannedDate: new Date("2026-07-07T09:00:00.000Z"),
          date: new Date("2026-07-07T09:00:00.000Z"),
          startAt: new Date("2026-07-07T09:15:00.000Z"),
          endAt: new Date("2026-07-07T10:30:00.000Z"),
          status: "DONE",
          reason: null,
          notes: "Tudo ok",
          cleaned: true,
          brushed: true,
          vacuumed: true,
          basketCleaned: true,
          waterlineClean: true,
          backwashDone: false,
          ph: 7.4,
          chlorine: 2,
          alkalinity: 100,
          salt: 3500,
          temperature: 26,
          orpMv: 720,
          products: JSON.stringify([{ name: "Cloro", quantity: 2, unit: "KG" }]),
          photos: [{ id: 1, url: "/photo-before.jpg", type: "BEFORE", createdAt: new Date("2026-07-07T09:20:00.000Z") }],
        },
        {
          id: 901,
          poolId: 21,
          pool: { name: "Piscina B", type: "Comercial" },
          technician: { name: "Bruno" },
          plannedDate: new Date("2026-07-08T09:00:00.000Z"),
          date: new Date("2026-07-08T09:00:00.000Z"),
          startAt: new Date("2026-07-08T09:15:00.000Z"),
          endAt: null,
          status: "PLANNED",
          reason: null,
          notes: null,
          cleaned: false,
          brushed: false,
          vacuumed: false,
          basketCleaned: false,
          waterlineClean: false,
          backwashDone: false,
          ph: null,
          chlorine: null,
          alkalinity: null,
          salt: null,
          temperature: null,
          orpMv: null,
          products: null,
          photos: [],
        },
      ]);
    mockInvoiceFindMany.mockResolvedValue([]);

    const { getClientPortal } = require("../src/controllers/clientPortalController");
    const req = { params: { clientId: "7" }, query: {}, headers: {} };
    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };

    await getClientPortal(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.ok).toBe(true);
    expect(res.payload.poolTimeline).toHaveLength(2);
    expect(res.payload.poolTimeline[0]).toEqual(
      expect.objectContaining({
        poolId: 20,
        poolName: "Piscina A",
        latestReport: expect.objectContaining({
          technicianName: "Ana",
          readings: expect.objectContaining({ ph: 7.4, chlorine: 2 }),
          products: [{ name: "Cloro", quantity: 2, unit: "KG" }],
          photos: expect.arrayContaining([
            expect.objectContaining({ id: 1, url: "/photo-before.jpg", type: "BEFORE" }),
          ]),
        }),
        timeline: expect.arrayContaining([
          expect.objectContaining({ type: "SERVICE_COMPLETED", title: "Relatorio de manutencao" }),
        ]),
      }),
    );
    expect(res.payload.poolTimeline[1]).toEqual(
      expect.objectContaining({
        poolId: 21,
        status: "inProgress",
        nextVisit: expect.objectContaining({ state: "inProgress" }),
      }),
    );
  });
});
