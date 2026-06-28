const CrystalBrain = require("../../system/brain/CrystalBrain");

const ClientService = require("../clients/ClientService");
const PoolService = require("../pools/PoolService");
const TechnicianService = require("../technicians/TechnicianService");
const VisitService = require("../visits/VisitService");
const BillingService = require("../billing/BillingService");

class BusinessBrainService {

    async ask(question=""){

        const context={

            summary:{

                clients:ClientService.list().length,

                pools:PoolService.list().length,

                technicians:TechnicianService.list().length,

                visits:VisitService.list().length,

                billing:BillingService.list().length,

                pendingBilling:BillingService.pending().length

            }

        };

        return CrystalBrain.ask(question,context);

    }

}

module.exports=new BusinessBrainService();
