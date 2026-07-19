const { prisma } = require("../../prismaClient");

async function computeStatsForTechnician(techId) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalLogs, logsLast7Days, logsLast30Days, minMax, totalServices, servicesLast30Days, completedServices, completedServicesLast30Days, totalAlerts] = await Promise.all([
    prisma.locationLog.count({ where: { userId: techId } }),
    prisma.locationLog.count({ where: { userId: techId, timestamp: { gte: sevenDaysAgo } } }),
    prisma.locationLog.count({ where: { userId: techId, timestamp: { gte: thirtyDaysAgo } } }),
    prisma.locationLog.aggregate({
      _min: { timestamp: true },
      _max: { timestamp: true },
      where: { userId: techId },
    }),
    prisma.serviceVisit.count({ where: { technicianId: techId } }),
    prisma.serviceVisit.count({ where: { technicianId: techId, plannedDate: { gte: thirtyDaysAgo } } }),
    prisma.serviceVisit.count({ where: { technicianId: techId, status: "DONE" } }),
    prisma.serviceVisit.count({ where: { technicianId: techId, status: "DONE", endAt: { gte: thirtyDaysAgo } } }),
    prisma.serviceVisit.count({ where: { technicianId: techId, alerts: { not: null } } }),
  ]);

  return {
    totalLocationLogs: totalLogs,
    locationLogsLast7Days: logsLast7Days,
    locationLogsLast30Days: logsLast30Days,
    firstLocationAt: minMax._min.timestamp,
    lastLocationAt: minMax._max.timestamp,
    totalServices,
    servicesLast30Days,
    completedServices,
    completedServicesLast30Days,
    totalAlerts,
  };
}

async function listTechnicianStats() {
  const technicians = await prisma.user.findMany({
    where: { role: "TECHNICIAN" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const statsList = [];
  for (const tech of technicians) {
    const stats = await computeStatsForTechnician(tech.id);
    statsList.push({ technician: tech, stats });
  }

  return statsList;
}

async function getTechnicianStats(id) {
  const tech = await prisma.user.findFirst({
    where: { id, role: "TECHNICIAN" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (!tech) {
    return { ok: false, status: 404, error: "Técnico não encontrado." };
  }

  const stats = await computeStatsForTechnician(tech.id);
  return { ok: true, payload: { technician: tech, stats } };
}

module.exports = {
  computeStatsForTechnician,
  listTechnicianStats,
  getTechnicianStats,
};
