class RequestContext {
  constructor({ actor = "system", role = "system", language = "pt", source = "backend", metadata = {} } = {}) {
    this.id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.actor = actor;
    this.role = role;
    this.language = language;
    this.source = source;
    this.metadata = metadata;
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      actor: this.actor,
      role: this.role,
      language: this.language,
      source: this.source,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}

module.exports = RequestContext;
