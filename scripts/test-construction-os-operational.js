try { require("dotenv").config(); } catch (_) {}

const { prisma } = require("../src/prismaClient");
const ConstructionBusiness = require("../src/business/construction/ConstructionBusiness");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

async function main() {
  const s = stamp();
  const cleanup = {
    clientId: null,
    poolId: null,
    technicianIds: [],
    balanceId: null,
    projectId: null,
    invoiceId: null,
  };

  try {
    const client = await prisma.client.create({
      data: {
        name: `QA Construction Client ${s}`,
        phone: "910000060",
        zone: "QA",
        active: true,
        status: "ACTIVE",
        monthlyFee: 60,
      },
    });
    cleanup.clientId = client.id;

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA Construction Pool ${s}`,
        type: "POOL",
        zone: "QA",
        volumeM3: 90,
        active: true,
        scheduleMode: "PENDING_ROUND",
      },
    });
    cleanup.poolId = pool.id;

    const tech1 = await prisma.technician.create({ data: { name: `QA Construction Tech 1 ${s}`, pin: `91${s.slice(-2)}`, active: true } });
    const tech2 = await prisma.technician.create({ data: { name: `QA Construction Tech 2 ${s}`, pin: `92${s.slice(-2)}`, active: true } });
    cleanup.technicianIds = [tech1.id, tech2.id];

    const balance = await prisma.stockBalance.create({
      data: {
        scope: "CENTRAL",
        productName: "CONSTRUCTION CEMENT BAG",
        unit: "UN",
        category: "MATERIAL",
        quantity: 50,
      },
    });
    cleanup.balanceId = balance.id;

    const actorAdmin = { actor: "qa-admin", role: "ADMIN" };
    const actorTech = { actor: "qa-tech", role: "TECHNICIAN" };
    const actorClient = { actor: "qa-client", role: "CLIENT" };

    const project = await ConstructionBusiness.createProject({ poolId: pool.id, title: "Obra total QA" }, actorAdmin);
    assert(project.ok, `create project failed: ${project.error || "unknown"}`);
    cleanup.projectId = project.project.id;

    assert((await ConstructionBusiness.approveCustomer(cleanup.projectId, { notes: "cliente aprovou" }, actorClient)).ok, "customer approval failed");
    assert((await ConstructionBusiness.defineBudget(cleanup.projectId, { total: 12500, currency: "EUR" }, actorAdmin)).ok, "budget failed");
    assert((await ConstructionBusiness.definePlanning(cleanup.projectId, { startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000 * 30).toISOString() }, actorAdmin)).ok, "planning failed");
    assert((await ConstructionBusiness.updatePhase(cleanup.projectId, { phaseName: "Estrutura", status: "IN_PROGRESS" }, actorAdmin)).ok, "phase failed");
    assert((await ConstructionBusiness.planMaterials(cleanup.projectId, { materials: [{ productName: "CONSTRUCTION CEMENT BAG", quantity: 20, unit: "UN" }] }, actorAdmin)).ok, "material planning failed");
    assert((await ConstructionBusiness.reserveStock(cleanup.projectId, { items: [{ productName: "CONSTRUCTION CEMENT BAG", quantity: 20, unit: "UN", scope: "CENTRAL" }] }, actorAdmin)).ok, "stock reservation failed");
    assert((await ConstructionBusiness.assignTeam(cleanup.projectId, { technicianIds: cleanup.technicianIds }, actorAdmin)).ok, "team assignment failed");
    assert((await ConstructionBusiness.addDailyLog(cleanup.projectId, { log: "Dia 1: preparação do terreno" }, actorTech)).ok, "daily log failed");
    assert((await ConstructionBusiness.addPhoto(cleanup.projectId, { fileUrl: `/uploads/construction-${s}.jpg`, fileName: `construction-${s}.jpg` }, actorTech)).ok, "photo failed");
    assert((await ConstructionBusiness.trackProgress(cleanup.projectId, { progress: 55, notes: "obra a meio" }, actorTech)).ok, "progress failed");

    const variation = await ConstructionBusiness.createVariationOrder(cleanup.projectId, { title: "Reforço estrutural", amount: 850, reason: "solo" }, actorAdmin);
    assert(variation.ok, "variation failed");
    const variationId = variation.project.payload?.variationOrders?.[0]?.id;
    assert(variationId, "variation id missing");

    assert((await ConstructionBusiness.approveVariationOrder(cleanup.projectId, { variationId }, actorClient)).ok, "variation approval failed");

    const invoice = await ConstructionBusiness.createBillingMilestone(cleanup.projectId, {
      title: "Milestone 1",
      amount: 3500,
      monthRef: new Date().toISOString().slice(0, 7),
    }, actorAdmin);
    assert(invoice.ok, `billing milestone failed: ${invoice.error || "unknown"}`);
    cleanup.invoiceId = invoice.invoice.id;

    assert((await ConstructionBusiness.finalInspection(cleanup.projectId, { passed: true, notes: "sem pendencias" }, actorAdmin)).ok, "final inspection failed");
    assert((await ConstructionBusiness.finalHandover(cleanup.projectId, { notes: "entrega oficial" }, actorClient)).ok, "handover failed");
    assert((await ConstructionBusiness.registerWarranty(cleanup.projectId, { provider: "QA Warranty", validUntil: "2029-12-31" }, actorAdmin)).ok, "warranty failed");
    assert((await ConstructionBusiness.notifyCustomer(cleanup.projectId, { message: "Obra concluida com sucesso" }, actorAdmin)).ok, "notify failed");
    assert((await ConstructionBusiness.syncDashboard(cleanup.projectId, { widget: "construction-overview" }, actorAdmin)).ok, "dashboard sync failed");

    const complete = await ConstructionBusiness.completeProject(cleanup.projectId, {}, actorAdmin);
    assert(complete.ok, `complete failed: ${complete.error || "unknown"}`);

    const final = await ConstructionBusiness.getProject(cleanup.projectId);
    assert(final.ok, "final read failed");
    assert(final.project.status === "RESOLVED", `project not resolved: ${final.project.status}`);
    assert(final.project.payload?.status === "COMPLETED", `project workflow not completed: ${final.project.payload?.status}`);

    console.log("✅ CONSTRUCTION OS OPERATIONAL ACCEPTANCE OK");
    console.log(JSON.stringify({
      projectId: cleanup.projectId,
      invoiceId: cleanup.invoiceId,
      finalStatus: final.project.status,
      workflowStatus: final.project.payload?.status,
      progress: final.project.payload?.progress,
    }, null, 2));
  } finally {
    if (cleanup.clientId) await prisma.clientMessage.deleteMany({ where: { clientId: cleanup.clientId } }).catch(() => null);
    if (cleanup.clientId) await prisma.notification.deleteMany({ where: { clientId: cleanup.clientId } }).catch(() => null);
    if (cleanup.poolId) await prisma.attachment.deleteMany({ where: { poolId: cleanup.poolId } }).catch(() => null);
    if (cleanup.poolId) await prisma.task.deleteMany({ where: { poolId: cleanup.poolId } }).catch(() => null);
    if (cleanup.poolId) await prisma.technicalHistory.deleteMany({ where: { poolId: cleanup.poolId } }).catch(() => null);
    if (cleanup.invoiceId) await prisma.invoice.delete({ where: { id: cleanup.invoiceId } }).catch(() => null);

    if (cleanup.projectId) {
      await prisma.operationalLock.deleteMany({
        where: {
          OR: [
            { id: cleanup.projectId },
            { entity: "ConstructionProject", entityId: cleanup.projectId },
            { lockType: "CONSTRUCTION_STOCK_RESERVATION", entityId: cleanup.projectId },
          ],
        },
      }).catch(() => null);
    }

    if (cleanup.balanceId) await prisma.stockBalance.delete({ where: { id: cleanup.balanceId } }).catch(() => null);

    if (cleanup.technicianIds.length) {
      await prisma.technician.deleteMany({ where: { id: { in: cleanup.technicianIds } } }).catch(() => null);
    }

    if (cleanup.poolId) await prisma.pool.delete({ where: { id: cleanup.poolId } }).catch(() => null);
    if (cleanup.clientId) await prisma.client.delete({ where: { id: cleanup.clientId } }).catch(() => null);

    await prisma.$disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error("❌ CONSTRUCTION OS OPERATIONAL ACCEPTANCE FAIL");
  console.error(error);
  process.exitCode = 1;
});
