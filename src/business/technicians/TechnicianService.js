const TechnicianEntity = require("./TechnicianEntity");
const repo = require("./TechnicianRepository");

class TechnicianService {
  create(data) {
    const technician = new TechnicianEntity(data);
    return repo.create(technician);
  }

  list() {
    return repo.list();
  }

  active() {
    return repo.active();
  }
}

module.exports = new TechnicianService();
