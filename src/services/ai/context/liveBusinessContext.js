const prisma = require("../../../prismaClient");

async function buildLiveBusinessContext() {
  const clientsCount = await prisma.client.count();
  const poolsCount = await prisma.pool.count();
  const techniciansCount = await prisma.technician.count();
  const visitsCount = await prisma.serviceVisit.count();
  const invoicesCount = await prisma.invoice.count();
  const paymentsCount = await prisma.payment.count();
  const alertsCount = await prisma.alert.count();

  const recentClients = await prisma.client.findMany({
    take: 5,
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });

  return {
    type: "live_business_context",
    generatedAt: new Date().toISOString(),
    totals: {
      clients: clientsCount,
      pools: poolsCount,
      technicians: techniciansCount,
      visits: visitsCount,
      invoices: invoicesCount,
      payments: paymentsCount,
      alerts: alertsCount,
    },
    recentClients,
  };
}

module.exports = {
  buildLiveBusinessContext,
};
