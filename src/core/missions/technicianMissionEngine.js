function buildTechnicianMission({
  employeeId,
  employeeName = "Técnico",
  vehicleId = null,
  route = [],
  followups = [],
  alerts = []
}) {
  const totalPools = route.length;
  const totalFollowups = followups.length;
  const totalAlerts = alerts.length;

  const estimatedMinutes =
    route.reduce((sum, item) => sum + (item.estimatedMinutes || 30), 0) +
    followups.reduce((sum, item) => sum + (item.estimatedMinutes || 15), 0);

  return {
    type: "TECHNICIAN_DAILY_MISSION",
    employeeId,
    employeeName,
    vehicleId,
    status: "READY_TO_START",
    generatedAt: new Date().toISOString(),
    summary: {
      totalPools,
      totalFollowups,
      totalAlerts,
      estimatedMinutes,
      estimatedHours: Number((estimatedMinutes / 60).toFixed(2))
    },
    mission: {
      title: `Missão de hoje - ${employeeName}`,
      message: `Hoje tens ${totalPools} piscinas, ${totalFollowups} follow-ups e ${totalAlerts} alertas.`,
      nextAction: "INICIAR_DIA"
    },
    route,
    followups,
    alerts
  };
}

module.exports = {
  buildTechnicianMission
};
