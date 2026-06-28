class VisitRepository {
  constructor() {
    this.items = [];
  }

  create(visit) {
    this.items.push(visit);
    return visit;
  }

  list() {
    return this.items;
  }

  find(id) {
    return this.items.find((v) => v.id === id) || null;
  }

  byTechnician(technicianId) {
    return this.items.filter((v) => v.technicianId === technicianId);
  }

  byPool(poolId) {
    return this.items.filter((v) => v.poolId === poolId);
  }
}

module.exports = new VisitRepository();
