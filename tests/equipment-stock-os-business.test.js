import { describe, it, expect, beforeEach, vi } from "vitest";

describe("EquipmentStockOsBusiness", () => {
  let mockEventBusEmit;

  beforeEach(() => {
    vi.resetModules();
    mockEventBusEmit = vi.fn().mockResolvedValue(true);
    global.io = { emit: vi.fn() };

    global.__CRISTAL_WATER_PRISMA__ = {
      poolEquipment: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ id: 11, poolId: 10, type: "PUMP", notes: "" }),
        update: vi.fn().mockResolvedValue({ id: 11 }),
      },
      inventoryProduct: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, name: "CLORO", sku: "CL-1", unit: "KG", category: "CHEMICAL", minStockCentral: 5, minStockVehicle: 2, active: true }]),
      },
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 999, productName: "CLORO", unit: "KG", quantity: 2 }),
      },
      stockBalance: {
        findMany: vi.fn().mockResolvedValue([{ id: 20, scope: "VEHICLE", vehicleId: 2, productName: "CLORO", unit: "KG", quantity: 0 }]),
        findFirst: vi.fn().mockResolvedValue({ id: 20, scope: "VEHICLE", vehicleId: 2, productName: "CLORO", unit: "KG", quantity: 6 }),
        update: vi.fn().mockResolvedValue({ id: 20, quantity: 4 }),
        create: vi.fn().mockResolvedValue({ id: 21 }),
      },
      technicalHistory: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 80 }),
      },
      attachment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      repair: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 70 }),
      },
      serviceVisit: {
        findUnique: vi.fn().mockResolvedValue({ id: 90, clientId: 8, poolId: 10, technicianId: 6, technician: { vehicleId: 2 }, pool: { client: { id: 8 } } }),
        findMany: vi.fn().mockResolvedValue([
          { id: 1, products: JSON.stringify([{ name: "Cloro", quantity: 2, unit: "KG" }]), chemicals: [] },
          { id: 2, products: JSON.stringify([{ name: "Cloro", quantity: 4, unit: "KG" }, { name: "PH-", quantity: 1, unit: "L" }]), chemicals: [] },
        ]),
      },
      auditTrail: {
        create: vi.fn().mockResolvedValue({ id: 44 }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => callback(global.__CRISTAL_WATER_PRISMA__)),
      prisma: null,
    };

    global.__CRISTAL_WATER_PRISMA__.prisma = global.__CRISTAL_WATER_PRISMA__;

    global.__CRISTAL_WATER_PRISMA__.serviceVisit.findUnique.mockImplementation(async ({ where }) => {
      if (where?.id === 77) return { id: 77, poolId: 10 };
      return { id: 90, clientId: 8, poolId: 10, technicianId: 6, technician: { vehicleId: 2 }, pool: { client: { id: 8 } } };
    });

    global.__CRISTAL_WATER_PRISMA__.EventBus = { emit: mockEventBusEmit };
  });

  it("suggests products for a visit based on historical consumption", async () => {
    const business = require("../src/business/operations/EquipmentStockOsBusiness");
    const result = await business.suggestProductsForVisit(77);

    expect(result.ok).toBe(true);
    expect(result.suggestedProducts[0]).toEqual(expect.objectContaining({ name: "Cloro", averageQuantity: 3 }));
    expect(result.suggestedProducts.some((item) => item.name === "PH-")).toBe(true);
  });

  it("transfers stock and creates movement rows", async () => {
    const business = require("../src/business/operations/EquipmentStockOsBusiness");
    const result = await business.transferStock({
      vehicleId: 2,
      direction: "CENTRAL_TO_VEHICLE",
      items: [{ productName: "Cloro", quantity: 2, unit: "KG" }],
    }, "QA_USER");

    expect(result.ok).toBe(true);
    expect(global.__CRISTAL_WATER_PRISMA__.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ movementType: "TRANSFER_TO_VEHICLE", vehicleId: 2 }) })
    );
  });

  it("consumes visit products and persists stock + notification safeguards", async () => {
    const business = require("../src/business/operations/EquipmentStockOsBusiness");
    const result = await business.consumeProductsForVisit(90, {
      vehicleId: 2,
      items: [{ productName: "Cloro", quantity: 2, unit: "KG" }],
    }, "TECH_TEST");

    expect(result.ok).toBe(true);
    expect(global.__CRISTAL_WATER_PRISMA__.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ movementType: "CONSUMPTION", visitId: 90, vehicleId: 2 }) })
    );
  });
});
