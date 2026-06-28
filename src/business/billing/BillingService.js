const BillingEntity = require("./BillingEntity");
const repo = require("./BillingRepository");

class BillingService {
  create(data) {
    const billing = new BillingEntity(data);
    return repo.create(billing);
  }

  list() {
    return repo.list();
  }

  byClient(clientId) {
    return repo.byClient(clientId);
  }

  pending() {
    return repo.pending();
  }

  markPaid(id) {
    return repo.markPaid(id);
  }
}

module.exports = new BillingService();
