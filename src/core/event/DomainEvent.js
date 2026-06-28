class DomainEvent {
  constructor({ name, entityId = null, entityType = null, payload = {}, metadata = {} } = {}) {
    if (!name) throw new Error("DomainEvent: name é obrigatório.");

    this.id = DomainEvent.generateId();
    this.name = name;
    this.entityId = entityId;
    this.entityType = entityType;
    this.payload = payload;
    this.metadata = metadata;
    this.createdAt = new Date().toISOString();
  }

  static generateId() {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      entityId: this.entityId,
      entityType: this.entityType,
      payload: this.payload,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}

module.exports = DomainEvent;
