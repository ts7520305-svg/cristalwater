class BillingRepository {
  constructor() {
    this.items = [];
  }

  create(billing) {
    this.items.push(billing);
    return billing;
  }

  list() {
    return this.items;
  }

  find(id) {
    return this.items.find((b) => b.id === id) || null;
  }

  byClient(clientId) {
    return this.items.filter((b) => b.clientId === clientId);
  }

  pending() {
    return this.items.filter((b) => b.status === "PENDING");
  }

  markPaid(id) {
    const billing = this.find(id);
    if (!billing) return null;
    billing.status = "PAID";
    billing.paidAt = new Date().toISOString();
    return billing;
  }
}

module.exports = new BillingRepository();
