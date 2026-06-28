class PoolEntity {
  constructor(data = {}) {
    this.id = data.id || `pool_${Date.now()}`;
    this.clientId = data.clientId || null;
    this.name = data.name || "";
    this.address = data.address || "";
    this.volumeM3 = data.volumeM3 || 0;
    this.type = data.type || "PRIVATE";
    this.status = data.status || "ACTIVE";
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

module.exports = PoolEntity;
