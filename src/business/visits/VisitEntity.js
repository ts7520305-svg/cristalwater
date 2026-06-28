class VisitEntity {
  constructor(data = {}) {
    this.id = data.id || `visit_${Date.now()}`;
    this.clientId = data.clientId || null;
    this.poolId = data.poolId || null;
    this.technicianId = data.technicianId || null;
    this.scheduledDate = data.scheduledDate || new Date().toISOString();
    this.status = data.status || "SCHEDULED";
    this.notes = data.notes || "";
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

module.exports = VisitEntity;
