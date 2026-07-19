import { describe, it, expect, vi } from "vitest";

const { completeServiceVisit } = require("../src/services/serviceVisitCompletionService");

function buildTx(overrides = {}) {
  return {
    serviceVisit: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      ...overrides.serviceVisit,
    },
    technician: {
      findUnique: vi.fn(),
      ...overrides.technician,
    },
    repair: {
      create: vi.fn(),
      ...overrides.repair,
    },
    chemicalUsage: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      ...overrides.chemicalUsage,
    },
    workGuide: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      ...overrides.workGuide,
    },
    workGuideItem: {
      findMany: vi.fn(),
      update: vi.fn(),
      ...overrides.workGuideItem,
    },
    vehicleStockMovement: {
      create: vi.fn(),
      ...overrides.vehicleStockMovement,
    },
    stockMovement: {
      create: vi.fn(),
      ...overrides.stockMovement,
    },
    technicalHistory: {
      create: vi.fn(),
      ...overrides.technicalHistory,
    },
    notification: {
      create: vi.fn(),
      ...overrides.notification,
    },
  };
}

describe("Service visit completion real operation flow", () => {
  it("completes a field visit with chemistry, products and stock/history traceability", async () => {
    const tx = buildTx();

    tx.serviceVisit.findUnique
      .mockResolvedValueOnce({
        id: 91,
        status: "IN_PROGRESS",
        endAt: null,
        poolId: 12,
        clientId: 3,
        technicianId: 5,
        technicianName: "Tiago",
        internalNotes: "",
      })
      .mockResolvedValueOnce({
        id: 91,
        status: "DONE",
        poolId: 12,
        clientId: 3,
        pool: { id: 12, client: { id: 3 } },
        client: { id: 3 },
        technician: { id: 5, name: "Tiago" },
        chemicals: [],
        photos: [],
      });

    tx.serviceVisit.updateMany.mockResolvedValue({ count: 1 });
    tx.chemicalUsage.deleteMany.mockResolvedValue({ count: 0 });
    tx.chemicalUsage.createMany.mockResolvedValue({ count: 2 });
    tx.workGuide.findFirst.mockResolvedValue({
      id: 700,
      vehicleId: 10,
      guideId: 400,
      technicianId: 5,
      status: "OPEN",
      createdAt: new Date(),
    });
    tx.workGuideItem.findMany.mockResolvedValue([
      { id: 1, name: "Cloro", type: "CHEMICAL", unit: "KG", quantity: 10, usedQty: 0 },
      { id: 2, name: "pH-", type: "CHEMICAL", unit: "KG", quantity: 6, usedQty: 1 },
    ]);
    tx.workGuideItem.update.mockResolvedValue({});
    tx.vehicleStockMovement.create.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    tx.technicalHistory.create.mockResolvedValue({ id: 7000 });
    tx.notification.create
      .mockResolvedValueOnce({ id: 9001, type: "VISIT_DONE" })
      .mockResolvedValueOnce({ id: 9002, type: "VISIT_REPORT", clientId: 3 });

    const prisma = {
      $transaction: async (callback) => callback(tx),
    };

    const result = await completeServiceVisit(prisma, 91, {
      ph: 7.4,
      chlorine: 1.8,
      alkalinity: 100,
      orpMv: 720,
      products: [
        { name: "Cloro", quantity: 2, unit: "KG" },
        { name: "pH-", quantity: 1, unit: "KG" },
      ],
      notes: "Visita concluida com sucesso",
      vehicleId: 10,
    });

    expect(tx.serviceVisit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 91 }),
        data: expect.objectContaining({
          status: "DONE",
          ph: 7.4,
          chlorine: 1.8,
          alkalinity: 100,
          orpMv: 720,
          notes: "Visita concluida com sucesso",
        }),
      }),
    );

    expect(tx.chemicalUsage.createMany).toHaveBeenCalledWith({
      data: [
        { visitId: 91, name: "Cloro", quantity: 2, unit: "KG" },
        { visitId: 91, name: "pH-", quantity: 1, unit: "KG" },
      ],
    });

    expect(tx.workGuideItem.update).toHaveBeenCalledTimes(2);
    expect(tx.vehicleStockMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.technicalHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        poolId: 12,
        type: "VISIT_COMPLETED",
        message: "Visita de manutencao concluida",
      }),
    });
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(tx.notification.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          type: "VISIT_DONE",
          eventType: "VISIT_COMPLETED",
          role: "ADMIN",
        }),
      }),
    );
    expect(tx.notification.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 3,
          type: "VISIT_REPORT",
          role: "CLIENT",
        }),
      }),
    );
    expect(result.visit).toEqual(expect.objectContaining({ id: 91, status: "DONE" }));
  });
});