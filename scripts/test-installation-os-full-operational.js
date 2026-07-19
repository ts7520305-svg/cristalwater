try { require("dotenv").config(); } catch (_) {}

const { prisma } = require("../src/prismaClient");
const InstallationBusiness = require("../src/business/installation/InstallationBusiness");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

async function main() {
  const s = stamp();
  const cleanup = { clientId: null, poolId: null, techId: null, balanceId: null, installationId: null, invoiceId: null };

  try {
    const client = await prisma.client.create({
      data: { name: `QA Install Full Client ${s}`, phone: "910000050", zone: "QA", active: true, status: "ACTIVE", monthlyFee: 50 },
    });
    cleanup.clientId = client.id;

    const pool = await prisma.pool.create({
      data: { clientId: client.id, name: `QA Install Full Pool ${s}`, type: "POOL", zone: "QA", volumeM3: 60, active: true, scheduleMode: "PENDING_ROUND" },
    });
    cleanup.poolId = pool.id;

    const technician = await prisma.technician.create({ data: { name: `QA Install Full Tech ${s}`, pin: "8765", active: true } });
    cleanup.techId = technician.id;

    const balance = await prisma.stockBalance.create({
      data: { scope: "CENTRAL", productName: "PUMP KIT QA", unit: "UN", category: "EQUIPMENT", quantity: 10 },
    });
    cleanup.balanceId = balance.id;

    const actorAdmin = { actor: "qa-admin", role: "ADMIN" };
    const actorTech = { actor: "qa-tech", role: "TECHNICIAN" };
    const actorClient = { actor: "qa-client", role: "CLIENT" };

    const requested = await InstallationBusiness.requestInstallation({ poolId: pool.id, reason: "Nova instalação" }, actorAdmin);
    assert(requested.ok, `request failed: ${requested.error || "unknown"}`);
    cleanup.installationId = requested.installation.id;

    assert((await InstallationBusiness.proposeEquipment(cleanup.installationId, { equipment: [{ kind: "PUMP", model: "P-100" }] }, actorAdmin)).ok, "proposal failed");
    assert((await InstallationBusiness.createQuote(cleanup.installationId, { amount: 450 }, actorAdmin)).ok, "quote failed");
    assert((await InstallationBusiness.approveCustomer(cleanup.installationId, { notes: "aprovado" }, actorClient)).ok, "approval failed");
    assert((await InstallationBusiness.scheduleInstallation(cleanup.installationId, { scheduledAt: new Date().toISOString() }, actorAdmin)).ok, "schedule failed");
    assert((await InstallationBusiness.assignTechnician(cleanup.installationId, { technicianId: technician.id }, actorAdmin)).ok, "assign failed");
    assert((await InstallationBusiness.reserveStock(cleanup.installationId, { items: [{ productName: "PUMP KIT QA", unit: "UN", quantity: 2, scope: "CENTRAL" }] }, actorAdmin)).ok, "reserve stock failed");
    assert((await InstallationBusiness.generateWorkOrder(cleanup.installationId, { description: "Ordem instalação QA" }, actorAdmin)).ok, "work order failed");
    assert((await InstallationBusiness.startInstallation(cleanup.installationId, {}, actorTech)).ok, "start failed");
    assert((await InstallationBusiness.gpsCheckIn(cleanup.installationId, { latitude: 38.72, longitude: -9.13 }, actorTech)).ok, "gps failed");
    assert((await InstallationBusiness.installEquipment(cleanup.installationId, { equipment: { type: "PUMP", model: "P-100" } }, actorTech)).ok, "equipment failed");
    assert((await InstallationBusiness.addPhoto(cleanup.installationId, { phase: "BEFORE", fileUrl: `/uploads/inst-before-${s}.jpg`, fileName: `inst-before-${s}.jpg` }, actorTech)).ok, "before photo failed");
    assert((await InstallationBusiness.addPhoto(cleanup.installationId, { phase: "AFTER", fileUrl: `/uploads/inst-after-${s}.jpg`, fileName: `inst-after-${s}.jpg` }, actorTech)).ok, "after photo failed");
    assert((await InstallationBusiness.registerSerialNumbers(cleanup.installationId, { serials: [{ item: "PUMP", serial: `SN-${s}` }] }, actorTech)).ok, "serials failed");
    assert((await InstallationBusiness.registerWarranty(cleanup.installationId, { provider: "QA Warranty", validUntil: "2028-12-31" }, actorTech)).ok, "warranty failed");
    assert((await InstallationBusiness.submitChecklist(cleanup.installationId, { checklist: [{ item: "Ligação elétrica", done: true }] }, actorTech)).ok, "checklist failed");
    assert((await InstallationBusiness.signTechnician(cleanup.installationId, { signature: "tech-signature" }, actorTech)).ok, "tech signature failed");
    assert((await InstallationBusiness.signCustomer(cleanup.installationId, { signature: "customer-signature" }, actorClient)).ok, "customer signature failed");
    assert((await InstallationBusiness.acceptCustomer(cleanup.installationId, { notes: "aceite" }, actorClient)).ok, "acceptance failed");
    assert((await InstallationBusiness.consumeStock(cleanup.installationId, {}, actorAdmin)).ok, "consume failed");

    const invoiceResult = await InstallationBusiness.generateInvoice(cleanup.installationId, { amount: 450, monthRef: new Date().toISOString().slice(0, 7) }, actorAdmin);
    assert(invoiceResult.ok, `invoice failed: ${invoiceResult.error || "unknown"}`);
    cleanup.invoiceId = invoiceResult.invoice.id;

    const payment = await InstallationBusiness.trackPayment(cleanup.installationId, { invoiceId: cleanup.invoiceId, amount: invoiceResult.invoice.amountOpen || 450, method: "CASH" }, actorAdmin);
    assert(payment.ok, `payment failed: ${payment.error || "unknown"}`);

    const completed = await InstallationBusiness.completeInstallation(cleanup.installationId, {}, actorAdmin);
    assert(completed.ok, `complete failed: ${completed.error || "unknown"}`);

    const final = await InstallationBusiness.getInstallation(cleanup.installationId);
    assert(final.ok, "final read failed");
    assert(final.installation.status === "RESOLVED", `installation not resolved: ${final.installation.status}`);
    assert(final.installation.payload?.status === "COMPLETED", `workflow not completed: ${final.installation.payload?.status}`);

    console.log("✅ INSTALLATION OS FULL OPERATIONAL ACCEPTANCE OK");
    console.log(JSON.stringify({
      installationId: cleanup.installationId,
      invoiceId: cleanup.invoiceId,
      finalStatus: final.installation.status,
      workflowStatus: final.installation.payload?.status,
    }, null, 2));
  } finally {
    if (cleanup.clientId) await prisma.clientMessage.deleteMany({ where: { clientId: cleanup.clientId } }).catch(() => null);
    if (cleanup.clientId) await prisma.notification.deleteMany({ where: { clientId: cleanup.clientId } }).catch(() => null);
    if (cleanup.poolId) await prisma.attachment.deleteMany({ where: { poolId: cleanup.poolId } }).catch(() => null);
    if (cleanup.poolId) await prisma.task.deleteMany({ where: { poolId: cleanup.poolId } }).catch(() => null);
    if (cleanup.poolId) await prisma.technicalHistory.deleteMany({ where: { poolId: cleanup.poolId } }).catch(() => null);
    if (cleanup.installationId) {
      await prisma.operationalLock.deleteMany({
        where: {
          OR: [
            { id: cleanup.installationId },
            { entity: "Installation", entityId: cleanup.installationId },
            { lockType: "INSTALLATION_STOCK_RESERVATION", entityId: cleanup.installationId },
          ],
        },
      }).catch(() => null);
    }
    if (cleanup.invoiceId) await prisma.invoice.delete({ where: { id: cleanup.invoiceId } }).catch(() => null);
    if (cleanup.balanceId) await prisma.stockBalance.delete({ where: { id: cleanup.balanceId } }).catch(() => null);
    if (cleanup.techId) await prisma.technician.delete({ where: { id: cleanup.techId } }).catch(() => null);
    if (cleanup.poolId) await prisma.pool.delete({ where: { id: cleanup.poolId } }).catch(() => null);
    if (cleanup.clientId) await prisma.client.delete({ where: { id: cleanup.clientId } }).catch(() => null);
    await prisma.$disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error("❌ INSTALLATION OS FULL OPERATIONAL ACCEPTANCE FAIL");
  console.error(error);
  process.exitCode = 1;
});
