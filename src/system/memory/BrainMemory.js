class BrainMemory {
  constructor() {
    this.items = [];
  }

  add(entry = {}) {
    const item = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };

    this.items.push(item);
    return item;
  }

  list(limit = 50) {
    return this.items.slice(-limit);
  }

  clear() {
    this.items = [];
    return true;
  }
}

module.exports = new BrainMemory();
