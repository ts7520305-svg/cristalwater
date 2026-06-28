const PoolEntity = require("./PoolEntity");
const repo = require("./PoolRepository");

class PoolService {
  create(data) {
    const pool = new PoolEntity(data);
    return repo.create(pool);
  }

  list() {
    return repo.list();
  }

  findByClient(clientId) {
    return repo.findByClient(clientId);
  }
}

module.exports = new PoolService();
