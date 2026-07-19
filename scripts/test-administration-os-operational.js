try { require("dotenv").config(); } catch (_) {}

const { prisma } = require("../src/prismaClient");
const AdministrationBusiness = require("../src/business/admin/AdministrationBusiness");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

async function main() {
  const s = stamp();
  const marker = `ADMIN-QA-${s}`;
  const cleanup = {
    moduleId: null,
    clientId: null,
    supplierId: null,
    vehiclePlates: [`QA-${s.slice(-6)}-A`],
    purchaseId: null,
    notificationId: null,
  };

  try {
    const client = await prisma.client.create({
      data: {
        name: `QA Admin Client ${s}`,
        phone: "910000070",
        zone: "QA",
        active: true,
        status: "ACTIVE",
        monthlyFee: 70,
      },
    });
    cleanup.clientId = client.id;

    const actorAdmin = { actor: "qa-admin", role: "ADMIN" };
    const actorLead = { actor: "qa-lead", role: "TEAM_LEADER" };

    const created = await AdministrationBusiness.createModule({ title: `${marker} Module` }, actorAdmin);
    assert(created.ok, `create module failed: ${created.error || "unknown"}`);
    cleanup.moduleId = created.module.id;

    assert((await AdministrationBusiness.updateHr(cleanup.moduleId, { entries: [{ employee: "Tech QA", action: "HIRING", notes: marker }] }, actorAdmin)).ok, "hr failed");

    assert((await AdministrationBusiness.updateVehicles(cleanup.moduleId, {
      vehicles: [
        { plate: cleanup.vehiclePlates[0], name: `${marker} Van`, brand: "QA", model: "V1", year: 2025, currentKm: 1000 },
      ],
    }, actorAdmin)).ok, "vehicles failed");

    const dbVehicle = await prisma.vehicle.findUnique({ where: { plate: cleanup.vehiclePlates[0] } });
    assert(dbVehicle, "vehicle not created");

    assert((await AdministrationBusiness.updateFleet(cleanup.moduleId, {
      maintenance: [
        { vehicleId: dbVehicle.id, title: `${marker} Oil Change`, type: "PREVENTIVE", dueDate: new Date(Date.now() + 86400000 * 7).toISOString() },
      ],
    }, actorLead)).ok, "fleet failed");

    const supplierStep = await AdministrationBusiness.updateSuppliers(cleanup.moduleId, {
      suppliers: [{ name: `${marker} Supplier`, category: "MATERIAL", email: `${marker.toLowerCase()}@qa.local` }],
    }, actorAdmin);
    assert(supplierStep.ok, "suppliers failed");

    const supplier = await prisma.supplierAccount.findFirst({ where: { name: `${marker} Supplier` } });
    assert(supplier, "supplier not created");
    cleanup.supplierId = supplier.id;

    const purchaseStep = await AdministrationBusiness.registerPurchase(cleanup.moduleId, {
      supplierId: supplier.id,
      supplierName: supplier.name,
      invoiceNumber: `${marker}-INV`,
      totalAmount: 500,
      items: [{ productName: `${marker} Product`, category: "MATERIAL", unit: "UN", quantity: 10, unitCost: 50, totalCost: 500 }],
    }, actorAdmin);
    assert(purchaseStep.ok, `purchase failed: ${purchaseStep.error || "unknown"}`);
    cleanup.purchaseId = purchaseStep.purchase.id;

    assert((await AdministrationBusiness.updateInternalTasks(cleanup.moduleId, {
      tasks: [{ title: `${marker} Internal Task`, description: "Task QA", priority: "HIGH" }],
    }, actorLead)).ok, "internal tasks failed");

    assert((await AdministrationBusiness.updateKpis(cleanup.moduleId, { monthRef: new Date().toISOString().slice(0, 7), productivityScore: 82, tasksOpen: 3, absencesOpen: 1, vacationsPlanned: 2 }, actorAdmin)).ok, "kpis failed");
    assert((await AdministrationBusiness.updateCompanyDashboard(cleanup.moduleId, { monthRef: new Date().toISOString().slice(0, 7) }, actorAdmin)).ok, "dashboard failed");
    assert((await AdministrationBusiness.updateProductivity(cleanup.moduleId, { monthRef: new Date().toISOString().slice(0, 7) }, actorAdmin)).ok, "productivity failed");

    assert((await AdministrationBusiness.registerVacation(cleanup.moduleId, { technicianId: null, startDate: "2026-08-01", endDate: "2026-08-15", reason: marker }, actorAdmin)).ok, "vacation failed");
    assert((await AdministrationBusiness.registerAbsence(cleanup.moduleId, { technicianId: null, date: "2026-07-10", reason: marker }, actorAdmin)).ok, "absence failed");

    assert((await AdministrationBusiness.sendInternalMessage(cleanup.moduleId, { message: `${marker} Internal Message`, channel: "ADMIN_INTERNAL" }, actorLead)).ok, "internal messaging failed");
    assert((await AdministrationBusiness.registerApproval(cleanup.moduleId, { title: `${marker} Approval`, message: "Approved QA", type: "PROCUREMENT" }, actorAdmin)).ok, "approval failed");

    assert((await AdministrationBusiness.updateCompanyReports(cleanup.moduleId, { monthRef: new Date().toISOString().slice(0, 7) }, actorAdmin)).ok, "reports failed");
    assert((await AdministrationBusiness.registerAudit(cleanup.moduleId, { action: "ADMIN_QA_AUDIT", message: marker, metadata: { marker } }, actorAdmin)).ok, "audit failed");

    const notificationStep = await AdministrationBusiness.sendNotification(cleanup.moduleId, {
      clientId: cleanup.clientId,
      title: `${marker} Notification`,
      message: `${marker} operational notice`,
      role: "ADMIN",
      type: "ADMIN_NOTICE",
      metadata: { marker },
    }, actorAdmin);
    assert(notificationStep.ok, "notification failed");
    cleanup.notificationId = notificationStep.notification.id;

    const completed = await AdministrationBusiness.completeModule(cleanup.moduleId, {}, actorAdmin);
    assert(completed.ok, `complete failed: ${completed.error || "unknown"}`);

    const final = await AdministrationBusiness.getModule(cleanup.moduleId);
    assert(final.ok, "final read failed");
    assert(final.module.status === "RESOLVED", `module status invalid: ${final.module.status}`);
    assert(final.module.payload?.status === "COMPLETED", `workflow status invalid: ${final.module.payload?.status}`);

    const kpiScore = final.module.payload?.kpis?.productivityScore || 0;

    console.log("✅ ADMINISTRATION OS OPERATIONAL ACCEPTANCE OK");
    console.log(JSON.stringify({
      moduleId: cleanup.moduleId,
      purchaseId: cleanup.purchaseId,
      supplierId: cleanup.supplierId,
      notificationId: cleanup.notificationId,
      finalStatus: final.module.status,
      workflowStatus: final.module.payload?.status,
      kpiProductivityScore: kpiScore,
    }, null, 2));
  } finally {
    if (cleanup.notificationId) await prisma.notification.deleteMany({ where: { id: cleanup.notificationId } }).catch(() => null);
    if (cleanup.clientId) await prisma.notification.deleteMany({ where: { clientId: cleanup.clientId, title: { contains: marker } } }).catch(() => null);

    await prisma.chatMessage.deleteMany({ where: { OR: [{ text: { contains: marker } }, { message: { contains: marker } }] } }).catch(() => null);
    await prisma.task.deleteMany({ where: { title: { contains: marker } } }).catch(() => null);
    await prisma.vehicleMaintenanceRecord.deleteMany({ where: { title: { contains: marker } } }).catch(() => null);
    if (cleanup.purchaseId) await prisma.stockPurchase.delete({ where: { id: cleanup.purchaseId } }).catch(() => null);
    if (cleanup.supplierId) await prisma.supplierAccount.delete({ where: { id: cleanup.supplierId } }).catch(() => null);
    await prisma.vehicle.deleteMany({ where: { plate: { in: cleanup.vehiclePlates } } }).catch(() => null);

    if (cleanup.moduleId) {
      await prisma.operationalLock.deleteMany({
        where: {
          OR: [
            { id: cleanup.moduleId },
            { entity: "AdministrationModule", entityId: cleanup.moduleId },
            { lockType: "ADMIN_APPROVAL", entityId: cleanup.moduleId },
          ],
        },
      }).catch(() => null);
    }

    await prisma.auditTrail.deleteMany({ where: { OR: [{ entity: "AdministrationModule", entityId: cleanup.moduleId || undefined }, { message: { contains: marker } }] } }).catch(() => null);

    if (cleanup.clientId) await prisma.client.delete({ where: { id: cleanup.clientId } }).catch(() => null);

    await prisma.$disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error("❌ ADMINISTRATION OS OPERATIONAL ACCEPTANCE FAIL");
  console.error(error);
  process.exitCode = 1;
});
