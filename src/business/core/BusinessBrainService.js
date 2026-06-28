const CrystalBrain = require("../../system/brain/CrystalBrain");
const {
  BusinessEngine,
  ClientService,
  PoolService,
  TechnicianService,
  VisitService,
  BillingService,
} = require("../index");

class BusinessBrainService {
  async ask(question = "") {
    const context = {
      business: BusinessEngine.status(),
      summary: {
        clients: ClientService.list().length,
        pools: PoolService.list().length,
        technicians: TechnicianService.list().length,
        visits: VisitService.list().length,
        billing: BillingService.list().length,
        pendingBilling: BillingService.pending().length,
      },
    };

    return CrystalBrain.ask(question, context);
  }
}

module.exports = new BusinessBrainService();
