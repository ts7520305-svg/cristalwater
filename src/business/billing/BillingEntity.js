class BillingEntity {
  constructor(data = {}) {
    this.id = data.id || `billing_${Date.now()}`;
    this.clientId = data.clientId || null;
    this.poolId = data.poolId || null;
    this.description = data.description || "";
    this.amount = Number(data.amount || 0);
    this.currency = data.currency || "EUR";
    this.status = data.status || "PENDING";
    this.dueDate = data.dueDate || null;
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

module.exports = BillingEntity;
