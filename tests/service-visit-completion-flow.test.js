import { describe, it, expect, vi } from "vitest";

const { completeServiceVisit } = require("../src/services/serviceVisitCompletionService");

function buildTx(overrides = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
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
      updateMany: vi.fn(),
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
      updateMany: vi.fn().mockResolvedValue({count:1}),
      ...overrides.notification,
    },
    operationalReminder: {findMany:vi.fn().mockImplementation(async query=>query.where.isCompleted===false&&query.where.sourceKey.startsWith==='incomplete:91:'?[{id:321,metadata:{visitId:91}}]:[]),update:vi.fn().mockResolvedValue({}),updateMany:vi.fn().mockResolvedValue({count:1})},
  };
}

describe("Service visit completion real operation flow", () => {
  for (const change of [{status:'CLOSED'}, {guideId:401}, {vehicleId:11}, {technicianId:6}]) {
    it('refuses stock writes when the selected work changes before its lock: '+JSON.stringify(change), async () => {
      const tx=buildTx(), selected={id:700,vehicleId:10,guideId:400,technicianId:5,status:'OPEN'};
      tx.serviceVisit.findUnique.mockResolvedValue({id:91,status:'PLANNED',endAt:null,technicianId:5});
      tx.serviceVisit.updateMany.mockResolvedValue({count:1});
      tx.chemicalUsage.deleteMany.mockResolvedValue({count:0});
      tx.chemicalUsage.createMany.mockResolvedValue({count:1});
      tx.workGuide.findFirst.mockResolvedValue(selected);
      tx.workGuide.findUnique.mockResolvedValue({...selected,...change});
      await expect(completeServiceVisit({$transaction:fn=>fn(tx)},91,{vehicleId:10,products:[{name:'Salt',quantity:1,unit:'KG'}]})).rejects.toMatchObject({statusCode:409,code:'WORK_GUIDE_CHANGED'});
      expect(tx.workGuideItem.findMany).not.toHaveBeenCalled();
      expect(tx.workGuideItem.updateMany).not.toHaveBeenCalled();
      expect(tx.vehicleStockMovement.create).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });
  }
  it("completes a field visit with chemistry, products and stock/history traceability", async () => {
    const tx = buildTx();

    tx.serviceVisit.findUnique
      .mockResolvedValueOnce({
        id: 91,
        status: "INCOMPLETE",
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
    tx.workGuide.findUnique.mockImplementation(() => tx.workGuide.findFirst());
    tx.workGuideItem.findMany.mockResolvedValue([
      { id: 1, name: "Cloro", type: "CHEMICAL", unit: "KG", quantity: 10, usedQty: 0 },
      { id: 2, name: "pH-", type: "CHEMICAL", unit: "KG", quantity: 6, usedQty: 1 },
    ]);
    tx.workGuideItem.updateMany.mockResolvedValue({count:1});
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

    expect(tx.workGuideItem.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.calls.some(([sql]) => String(sql).includes('"WorkGuide"') && String(sql).includes('FOR UPDATE'))).toBe(true);
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
    expect(tx.operationalReminder.update).toHaveBeenCalledWith({where:{id:321},data:expect.objectContaining({isCompleted:true,metadata:expect.objectContaining({visitId:91,resolvedByReturnVisitId:91,resolvedByReturnVisitType:'REGULAR'})})});
    expect(tx.notification.updateMany).toHaveBeenCalledWith({where:{eventType:'VISIT_INCOMPLETE',metadata:{path:['reminderId'],equals:321},status:'PENDING'},data:{status:'RESOLVED'}});
  });
});
