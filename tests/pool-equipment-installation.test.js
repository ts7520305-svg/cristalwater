import { describe, it, expect, beforeEach, vi } from "vitest";

describe("PoolEquipmentBusiness installation flow", () => {
  beforeEach(() => {
    vi.resetModules();
    global.io = { emit: vi.fn() };
    const Kernel = require("../src/core/Kernel");
    const historyRows = [];
    global.__CRISTAL_WATER_PRISMA__ = {
      pool: {
        findUnique: vi.fn().mockResolvedValue({ id: 10, client: { id: 3 } }),
      },
      poolEquipment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 21, poolId: 10, type: "FILTER" }),
        update: vi.fn(),
      },
      technicalHistory: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          const row = { id: 99 + historyRows.length, createdAt: new Date(), ...data };
          historyRows.push(row);
          return row;
        }),
        findMany: vi.fn().mockImplementation(async () => historyRows),
      },
      userAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 77 }),
      },
    };
    Kernel.EventBus = { emit: vi.fn().mockResolvedValue(true) };
  });

  it("installs pool equipment and records installation history", async () => {
    const business = require("../src/business/pool/PoolEquipmentBusiness");
    const result = await business.installEquipment({
      poolId: 10,
      type: "FILTER",
      brand: "Hayward",
      model: "Pro",
      notes: "Initial installation",
    }, "QA_INSTALLER");

    expect(result.ok).toBe(true);
    expect(global.__CRISTAL_WATER_PRISMA__.poolEquipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ poolId: 10, type: "FILTER", brand: "Hayward", model: "Pro" }),
      }),
    );
    expect(global.__CRISTAL_WATER_PRISMA__.technicalHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poolId: 10,
          type: "EQUIPMENT_INSTALLATION",
          status: "DONE",
        }),
      }),
    );
    const Kernel = require("../src/core/Kernel");
    expect(Kernel.EventBus.emit).toHaveBeenCalled();
  });

  it("supports multiple assets and lifecycle updates in the registry", async () => {
    const business = require("../src/business/pool/PoolEquipmentBusiness");

    const pump = await business.addRegistryAsset(10, {
      kind: "PUMP",
      type: "PUMP",
      brand: "Aqua",
      model: "P1",
      serialNumber: "PUMP-1",
    }, "QA_INSTALLER");

    const filter = await business.addRegistryAsset(10, {
      kind: "FILTER",
      type: "FILTER",
      brand: "Aqua",
      model: "F1",
      serialNumber: "FILTER-1",
    }, "QA_INSTALLER");

    const chlorinator = await business.addRegistryAsset(10, {
      kind: "CHLORINATOR",
      type: "CHLORINATOR",
      brand: "Aqua",
      model: "C1",
      serialNumber: "CHL-1",
    }, "QA_INSTALLER");

    expect(pump.ok).toBe(true);
    expect(filter.ok).toBe(true);
    expect(chlorinator.ok).toBe(true);

    const replacement = await business.replaceRegistryAsset(10, pump.asset.assetId, {
      kind: "PUMP",
      type: "PUMP",
      brand: "Aqua",
      model: "P2",
      reason: "UPGRADE",
    }, "QA_INSTALLER");
    expect(replacement.ok).toBe(true);

    const warranty = await business.updateRegistryAssetWarranty(10, filter.asset.assetId, {
      provider: "AquaCare",
      validUntil: "2028-01-01",
      policyNumber: "W-100",
    }, "QA_INSTALLER");
    expect(warranty.ok).toBe(true);

    const removed = await business.removeRegistryAsset(10, chlorinator.asset.assetId, {
      reason: "REMOVED_BY_CLIENT",
    }, "QA_INSTALLER");
    expect(removed.ok).toBe(true);

    const registry = await business.getEquipmentRegistry(10);
    expect(registry.ok).toBe(true);
    expect(registry.registry.pumps.length).toBeGreaterThanOrEqual(1);
    expect(registry.registry.filters.length).toBeGreaterThanOrEqual(1);
    expect(registry.registry.chlorinators.length).toBe(0);
    expect(registry.registry.removedAssets.some((item) => item.assetId === chlorinator.asset.assetId)).toBe(true);
    expect(registry.registry.replacementHistory.length).toBe(1);
    expect(registry.registry.warrantyHistory.length).toBe(1);
  });
});