class TechnicianRepository {
  constructor() {
    this.items = [];
  }

  create(technician) {
    this.items.push(technician);
    return technician;
  }

  list() {
    return this.items;
  }

  find(id) {
    return this.items.find((t) => t.id === id) || null;
  }

  active() {
    return this.items.filter((t) => t.status === "ACTIVE");
  }
}

module.exports = new TechnicianRepository();
