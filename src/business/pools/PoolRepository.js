class PoolRepository {
  constructor() {
    this.items = [];
  }

  create(pool) {
    this.items.push(pool);
    return pool;
  }

  list() {
    return this.items;
  }

  find(id) {
    return this.items.find((p) => p.id === id) || null;
  }

  findByClient(clientId) {
    return this.items.filter((p) => p.clientId === clientId);
  }
}

module.exports = new PoolRepository();
