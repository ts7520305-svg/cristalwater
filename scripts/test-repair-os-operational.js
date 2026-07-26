try { require("dotenv").config(); } catch (_) {}

const { prisma } = require("../src/prismaClient");
const RepairBusiness = require("../src/business/repair/RepairBusiness");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

async function main() {
  const s = stamp();
  const cleanup = { attachmentIds: [], invoiceId: null, repairId: null, stockBalanceId: null, technicianId: null, poolId: null, clientId: null };

  try {
    const client = await prisma.client.create({
      data: {
        name: `QA Repair Client ${s}`,
        phone: "910000001",
        zone: "QA",
        monthlyFee: 80,
        monthlyAmount: 80,
        active: true,
        status: "ACTIVE",
      },
    });
    cleanup.clientId = client.id;

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA Repair Pool ${s}`,
        type: "POOL",
        zone: "QA",
        volumeM3: 45,
        monthlyAmount: 80,
        active: true,
        scheduleMode: "PENDING_ROUND",
      },
    });
    cleanup.poolId = pool.id;

    const technician = await prisma.technician.create({
      data: {
        name: `QA Repair Tech ${s}`,
        pin: "2468",
        active: true,
      },
    });
    cleanup.technicianId = technician.id;

    const stockBalance = await prisma.stockBalance.create({
      data: {
        scope: "CENTRAL",
        productName: "BOMBA QA",
        category: "EQUIPMENT",
        unit: "UN",
        quantity: 5,
      },
    });
    cleanup.stockBalanceId = stockBalance.id;

    const repairCreated = await RepairBusiness.createRepairTicket({
      poolId: pool.id,
      problem: `QA Repair Pump Noise ${s}`,
      quantity: 1,
      priority: "HIGH",
      notes: "Operational repair flow acceptance",
    }, "QA-REPAIR", prisma, {
      context: { pool, clientId: client.id },
      source: "test-repair-os-operational",
    });

    assert(repairCreated.ok, `repair create failed: ${repairCreated.error || "unknown"}`);
    cleanup.repairId = repairCreated.repair.id;

    const diagnosed = await RepairBusiness.diagnoseRepair(cleanup.repairId, {
      partsRequired: [{ name: "BOMBA QA", unit: "UN", quantity: 1, category: "EQUIPMENT" }],
    }, prisma, "QA-REPAIR");
    assert(diagnosed.ok, `diagnose failed: ${diagnosed.error || "unknown"}`);

    const quoted = await RepairBusiness.quoteRepair(cleanup.repairId, prisma, "QA-REPAIR");
    assert(quoted?.id === cleanup.repairId || quoted?.repair?.id === cleanup.repairId, "quote failed");

    const scheduled = await RepairBusiness.scheduleRepair(cleanup.repairId, {
      technicianId: technician.id,
      scheduledAt: new Date().toISOString(),
      parts: [{ name: "BOMBA QA", unit: "UN", quantity: 1, category: "EQUIPMENT" }],
    }, prisma, "QA-REPAIR");
    assert(scheduled.ok, `schedule failed: ${scheduled.error || "unknown"}`);

    const photo = await RepairBusiness.recordRepairPhoto(cleanup.repairId, {
      filename: `repair-${s}.jpg`,
      originalname: "before.jpg",
      mimetype: "image/jpeg",
      size: 2048,
    }, {
      type: "BEFORE",
      fileName: `before-${s}.jpg`,
      fileUrl: `/uploads/repairs/before-${s}.jpg`,
    }, prisma, "QA-REPAIR");
    assert(photo.ok, `photo failed: ${photo.error || "unknown"}`);
    if (photo.photo?.id) cleanup.attachmentIds.push(photo.photo.id);

    const approved = await RepairBusiness.approveRepair(cleanup.repairId, prisma, "QA-REPAIR");
    assert(
      approved?.id === cleanup.repairId ||
      approved?.repair?.id === cleanup.repairId ||
      approved?.ok === true,
      "approval failed"
    );

    const completed = await RepairBusiness.completeRepair(cleanup.repairId, prisma, "QA-REPAIR");
    assert(
      completed?.id === cleanup.repairId ||
      completed?.repair?.id === cleanup.repairId ||
      completed?.ok === true,
      "completion failed"
    );

    const invoiced = await RepairBusiness.generateRepairInvoice(cleanup.repairId, {
      notes: "Operational acceptance invoice",
      monthRef: new Date().toISOString().slice(0, 7),
    }, prisma, "QA-REPAIR");
    assert(invoiced.ok, `invoice failed: ${invoiced.error || "unknown"}`);
    cleanup.invoiceId = invoiced.invoice.id;

    const payment = await RepairBusiness.registerRepairPayment(cleanup.repairId, {
      invoiceId: cleanup.invoiceId,
      amount: invoiced.invoice.amountOpen || invoiced.invoice.totalAmount || invoiced.invoice.total || 0,
      method: "CASH",
      notes: "Operational acceptance payment",
    }, prisma, "QA-REPAIR");
    assert(payment.ok, `payment failed: ${payment.error || "unknown"}`);

    const closed = await RepairBusiness.closeRepair(cleanup.repairId, {
      notes: "Operational acceptance closure",
    }, prisma, "QA-REPAIR");
    assert(closed.ok, `close failed: ${closed.error || "unknown"}`);

    const finalRepair = await prisma.repair.findUnique({
      where: { id: cleanup.repairId },
      include: { attachments: true },
    });
    const finalInvoice = await prisma.invoice.findUnique({
      where: { id: cleanup.invoiceId },
      include: { payments: true, lines: true },
    });

    assert(finalRepair?.status === "CLOSED", `repair not closed: ${finalRepair?.status}`);
    assert(Boolean(finalRepair?.paid), "repair payment flag missing");
    assert(finalInvoice?.status === "PAID", `invoice not paid: ${finalInvoice?.status}`);
    assert((finalRepair?.attachments || []).length >= 1, "repair photo not attached");
    assert((finalInvoice?.payments || []).length >= 1, "invoice payment not tracked");

    console.log("✅ REPAIR OS OPERATIONAL ACCEPTANCE OK");
    console.log(JSON.stringify({
      clientId: client.id,
      poolId: pool.id,
      technicianId: technician.id,
      repairId: cleanup.repairId,
      invoiceId: cleanup.invoiceId,
      attachmentCount: (finalRepair?.attachments || []).length,
      paymentCount: (finalInvoice?.payments || []).length,
      repairStatus: finalRepair?.status,
      invoiceStatus: finalInvoice?.status,
    }, null, 2));
  } finally {
    if (cleanup.attachmentIds.length) {
      await prisma.attachment.deleteMany({ where: { id: { in: cleanup.attachmentIds } } }).catch(() => null);
    }
    if (cleanup.invoiceId) {
      await prisma.invoice.delete({ where: { id: cleanup.invoiceId } }).catch(() => null);
    }
    if (cleanup.repairId) {
      await prisma.repair.delete({ where: { id: cleanup.repairId } }).catch(() => null);
    }
    if (cleanup.stockBalanceId) {
      await prisma.stockBalance.delete({ where: { id: cleanup.stockBalanceId } }).catch(() => null);
    }
    if (cleanup.technicianId) {
      await prisma.technician.delete({ where: { id: cleanup.technicianId } }).catch(() => null);
    }
    if (cleanup.poolId) {
      await prisma.pool.delete({ where: { id: cleanup.poolId } }).catch(() => null);
    }
    if (cleanup.clientId) {
      await prisma.client.delete({ where: { id: cleanup.clientId } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error("❌ REPAIR OS OPERATIONAL ACCEPTANCE FAIL");
  console.error(error);
  process.exitCode = 1;
});