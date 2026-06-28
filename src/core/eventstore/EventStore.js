class EventStore {

  constructor() {
    this.events = [];
  }

  append(event) {

    this.events.push({

      ...event,

      storedAt: new Date().toISOString()

    });

    return event;

  }

  all(limit = 100) {

    return this.events.slice(-limit);

  }

  byName(name) {

    return this.events.filter(e => e.name === name);

  }

  clear() {

    this.events = [];

  }

}

module.exports = new EventStore();
