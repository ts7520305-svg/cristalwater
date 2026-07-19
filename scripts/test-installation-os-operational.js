try { require("dotenv").config(); } catch (_) {}

const { prisma } = require("../src/prismaClient");
const PoolEquipmentBusiness = require("../src/business/pool/PoolEquipmentBusiness");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

async function main() {
  const s = stamp();
  const cleanup = { clientId: null, poolId: null };

  try {
    const client = await prisma.client.create({
      data: {
        name: `QA Install Client ${s}`,
        phone: "910000002",
        zone: "QA",
        active: true,
        status: "ACTIVE",
      },
    });
    cleanup.clientId = client.id;

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA Install Pool ${s}`,
        type: "POOL",
        zone: "QA",
        volumeM3: 50,
        active: true,
        scheduleMode: "PENDING_ROUND",
      },
    });
    cleanup.poolId = pool.id;

    const result = await PoolEquipmentBusiness.installEquipment({
      poolId: pool.id,
      type: "PUMP",
      brand: "Aquaflow",
      model: "A1",
      notes: "Operational installation acceptance",
      hasLights: true,
      lightsCount: 2,
    }, "QA_INSTALL");

    assert(result.ok, `install failed: ${result.error || "unknown"}`);

    const pump2 = await PoolEquipmentBusiness.addRegistryAsset(pool.id, {
      kind: "PUMP",
      type: "PUMP",
      brand: "Aquaflow",
      model: "A2",
      serialNumber: `P2-${s}`,
    }, "QA_INSTALL");
    assert(pump2.ok, "second pump failed");

    const filter = await PoolEquipmentBusiness.addRegistryAsset(pool.id, {
      kind: "FILTER",
      type: "FILTER",
      brand: "FilterCo",
      model: "F1",
      serialNumber: `F1-${s}`,
    }, "QA_INSTALL");
    assert(filter.ok, "filter failed");

    const chlorinator = await PoolEquipmentBusiness.addRegistryAsset(pool.id, {
      kind: "CHLORINATOR",
      type: "CHLORINATOR",
      brand: "ChloroMax",
      model: "C1",
      serialNumber: `C1-${s}`,
    }, "QA_INSTALL");
    assert(chlorinator.ok, "chlorinator failed");

    const replacement = await PoolEquipmentBusiness.replaceRegistryAsset(pool.id, pump2.asset.assetId, {
      kind: "PUMP",
      type: "PUMP",
      brand: "Aquaflow",
      model: "A3",
      reason: "UPGRADE",
    }, "QA_INSTALL");
    assert(replacement.ok, "replacement failed");

    const warranty = await PoolEquipmentBusiness.updateRegistryAssetWarranty(pool.id, filter.asset.assetId, {
      provider: "FilterCare",
      validUntil: "2028-12-31",
      policyNumber: `W-${s}`,
    }, "QA_INSTALL");
    assert(warranty.ok, "warranty update failed");

    const removed = await PoolEquipmentBusiness.removeRegistryAsset(pool.id, chlorinator.asset.assetId, {
      reason: "CLIENT_REQUEST",
    }, "QA_INSTALL");
    assert(removed.ok, "remove asset failed");

    const registry = await PoolEquipmentBusiness.getEquipmentRegistry(pool.id);
    assert(registry.ok, "registry load failed");

    const equipment = await prisma.poolEquipment.findUnique({ where: { poolId: pool.id } });
    const history = await prisma.technicalHistory.findMany({ where: { poolId: pool.id, type: "EQUIPMENT_INSTALLATION" } });

    assert(Boolean(equipment), "equipment missing after install");
    assert(history.length >= 1, "installation history missing");
    assert(registry.registry.pumps.length >= 2, "multiple pumps missing");
    assert(registry.registry.filters.length >= 1, "filter missing");
    assert(registry.registry.replacementHistory.length >= 1, "replacement history missing");
    assert(registry.registry.warrantyHistory.length >= 1, "warranty history missing");
    assert(registry.registry.removedAssets.length >= 1, "removed asset history missing");

    console.log("✅ INSTALLATION OS OPERATIONAL ACCEPTANCE OK");
    console.log(JSON.stringify({
      clientId: client.id,
      poolId: pool.id,
      equipmentId: equipment.id,
      installationCount: history.length,
      activeAssets: registry.registry.activeAssets.length,
      removedAssets: registry.registry.removedAssets.length,
      replacementHistory: registry.registry.replacementHistory.length,
      warrantyHistory: registry.registry.warrantyHistory.length,
    }, null, 2));
  } finally {
    if (cleanup.poolId) {
      await prisma.poolEquipment.deleteMany({ where: { poolId: cleanup.poolId } }).catch(() => null);
      await prisma.technicalHistory.deleteMany({ where: { poolId: cleanup.poolId, type: "EQUIPMENT_INSTALLATION" } }).catch(() => null);
      await prisma.pool.delete({ where: { id: cleanup.poolId } }).catch(() => null);
    }
    if (cleanup.clientId) {
      await prisma.client.delete({ where: { id: cleanup.clientId } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error("❌ INSTALLATION OS OPERATIONAL ACCEPTANCE FAIL");
  console.error(error);
  process.exitCode = 1;
});