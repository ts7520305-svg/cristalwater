class AuditTrail {
  constructor() {
    this.records = [];
  }

  record({ action, actor = "system", entityId = null, entityType = null, before = null, after = null, metadata = {} } = {}) {
    if (!action) throw new Error("AuditTrail: action obrigatório.");

    const item = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      action,
      actor,
      entityId,
      entityType,
      before,
      after,
      metadata,
      at: new Date().toISOString(),
    };

    this.records.push(item);
    return item;
  }

  list(limit = 100) {
    return this.records.slice(-limit);
  }
}

module.exports = new AuditTrail();
