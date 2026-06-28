const DomainEvent = require("./DomainEvent");

class EventBus {
  constructor() {
    this.handlers = {};
    this.history = [];
    this.eventStore = null;
    this.metrics = {
      emitted: 0,
      handled: 0,
      failed: 0,
    };
  }

  attachEventStore(eventStore) {
    this.eventStore = eventStore;
    return true;
  }

  on(eventName, handler) {
    if (!eventName) throw new Error("EventBus: eventName obrigatório.");
    if (typeof handler !== "function") throw new Error("EventBus: handler inválido.");

    if (!this.handlers[eventName]) this.handlers[eventName] = [];
    this.handlers[eventName].push(handler);

    return true;
  }

  off(eventName) {
    delete this.handlers[eventName];
    return true;
  }

  async emit(eventName, payload = {}, metadata = {}) {
    const event = new DomainEvent({
      name: eventName,
      payload,
      metadata,
    });

    this.metrics.emitted += 1;
    this.history.push(event.toJSON());

    if (this.eventStore && typeof this.eventStore.append === "function") {
      this.eventStore.append(event.toJSON());
    }

    const specificHandlers = this.handlers[eventName] || [];
    const wildcardHandlers = this.handlers["*"] || [];
    const handlers = [...specificHandlers, ...wildcardHandlers];

    const results = [];

    for (const handler of handlers) {
      try {
        const result = await handler(event);
        this.metrics.handled += 1;
        results.push({
          ok: true,
          event: eventName,
          result,
        });
      } catch (error) {
        this.metrics.failed += 1;
        results.push({
          ok: false,
          event: eventName,
          error: error.message,
        });
      }
    }

    return {
      ok: results.every((r) => r.ok),
      event: event.toJSON(),
      handlers: handlers.length,
      results,
    };
  }

  getHistory(limit = 100) {
    return this.history.slice(-limit);
  }

  getMetrics() {
    return {
      ...this.metrics,
      handlers: Object.keys(this.handlers).reduce((acc, key) => {
        acc[key] = this.handlers[key].length;
        return acc;
      }, {}),
    };
  }

  clearHistory() {
    this.history = [];
    return true;
  }

  reset() {
    this.handlers = {};
    this.history = [];
    this.metrics = {
      emitted: 0,
      handled: 0,
      failed: 0,
    };
    return true;
  }
}

module.exports = new EventBus();
