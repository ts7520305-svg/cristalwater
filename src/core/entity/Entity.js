class Entity {
  constructor({ id, type, props = {}, createdAt, updatedAt } = {}) {
    if (!type) throw new Error("Entity: type é obrigatório.");

    this.id = id || Entity.generateId(type);
    this.type = type;
    this.props = props;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;
  }

  static generateId(type = "entity") {
    return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  update(changes = {}) {
    this.props = {
      ...this.props,
      ...changes,
    };
    this.updatedAt = new Date().toISOString();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      props: this.props,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Entity;
