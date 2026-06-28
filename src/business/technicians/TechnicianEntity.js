class TechnicianEntity {
  constructor(data = {}) {
    this.id = data.id || `tech_${Date.now()}`;
    this.name = data.name || "";
    this.email = data.email || "";
    this.phone = data.phone || "";
    this.vehicleId = data.vehicleId || null;
    this.status = data.status || "ACTIVE";
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

module.exports = TechnicianEntity;
