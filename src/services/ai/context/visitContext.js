function buildVisitContext(visit = {}) {
  return {
    type: "visit_context",
    customer: visit.customer || null,
    pool: visit.pool || null,
    technician: visit.technician || null,
    visitDate: visit.visitDate || null,
    measurements: visit.measurements || {},
    notes: visit.notes || "",
    photos: visit.photos || [],
    issues: visit.issues || [],
    completedTasks: visit.completedTasks || [],
  };
}

module.exports = {
  buildVisitContext,
};
