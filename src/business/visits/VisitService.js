const VisitEntity = require("./VisitEntity");
const repo = require("./VisitRepository");

class VisitService {
  create(data) {
    const visit = new VisitEntity(data);
    return repo.create(visit);
  }

  list() {
    return repo.list();
  }

  byTechnician(technicianId) {
    return repo.byTechnician(technicianId);
  }

  byPool(poolId) {
    return repo.byPool(poolId);
  }
}

module.exports = new VisitService();
