class InMemoryRepository {
  constructor(entityType = "entity") {
    this.entityType = entityType;
    this.items = new Map();
  }

  save(entity) {
    if (!entity || !entity.id) {
      throw new Error("Repository: entidade inválida.");
    }

    this.items.set(entity.id, entity);
    return entity;
  }

  findById(id) {
    return this.items.get(id) || null;
  }

  findAll() {
    return Array.from(this.items.values());
  }

  delete(id) {
    return this.items.delete(id);
  }

  count() {
    return this.items.size;
  }
}

module.exports = InMemoryRepository;
