class BusinessRegistry {
  constructor() {
    this.domains = new Map();
  }

  register(name, data = {}) {
    this.domains.set(name, {
      name,
      status: "active",
      registeredAt: new Date().toISOString(),
      ...data,
    });

    return this.domains.get(name);
  }

  get(name) {
    return this.domains.get(name) || null;
  }

  all() {
    return Object.fromEntries(this.domains);
  }
}

module.exports = new BusinessRegistry();
