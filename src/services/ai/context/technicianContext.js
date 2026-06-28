function buildTechnicianContext(technician = {}) {
  return {
    type: "technician_context",
    technicianId: technician.id || null,
    name: technician.name || null,
    role: technician.role || "technician",
    phone: technician.phone || null,
    active: technician.active ?? true,
    assignedPools: technician.assignedPools || [],
    lastVisits: technician.lastVisits || [],
    performance: technician.performance || {
      totalVisits: 0,
      completedVisits: 0,
      missedVisits: 0,
      averageVisitMinutes: null,
    },
    notes: technician.notes || "",
  };
}

module.exports = {
  buildTechnicianContext,
};
