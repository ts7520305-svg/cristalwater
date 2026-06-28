class Metrics {
  constructor() {
    this.counters = {};
    this.timings = [];
  }

  increment(name, value = 1) {
    if (!name) throw new Error("Metrics: name obrigatório.");
    this.counters[name] = (this.counters[name] || 0) + value;
    return this.counters[name];
  }

  timing(name, ms, metadata = {}) {
    const item = {
      name,
      ms,
      metadata,
      at: new Date().toISOString(),
    };

    this.timings.push(item);
    return item;
  }

  snapshot() {
    return {
      counters: this.counters,
      timings: this.timings.slice(-100),
      createdAt: new Date().toISOString(),
    };
  }
}

module.exports = new Metrics();
