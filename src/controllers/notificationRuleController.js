const { prisma } = require("../prismaClient");

// ===============================
// LISTAR REGRAS EXISTENTES
// ===============================
async function getRules(req, res, next) {
  try {
    const rules = await prisma.notificationRule.findMany({
      orderBy: { eventType: "asc" },
    });

    res.json(rules);
  } catch (err) {
    next(err);
  }
}

// ===============================
// ATUALIZAR REGRA EXISTENTE
// ===============================
async function updateRule(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { roles, channels, active } = req.body;

    const rule = await prisma.notificationRule.update({
      where: { id },
      data: { roles, channels, active },
    });

    res.json(rule);
  } catch (err) {
    next(err);
  }
}

// These legacy values have no consumer in the current reminder workflows.
// Refuse old forms instead of acknowledging a global policy that is not applied.
function unavailablePaymentPolicy(req,res){
  return res.status(409).json({ok:false,code:'PAYMENT_POLICY_REVIEW_REQUIRED',applied:false,message:'As opções antigas não controlam os lembretes. Consulte /admin-payment-settings e use as configurações operacionais para os avisos no portal.'});
}
async function reviewPaymentPolicy(req,res){
  try{const result=await require('../services/paymentPolicyReviewService').read(req.user,req.query);res.set({'X-CW-Payment-Policy':'payment-policy-review-v1','X-CW-Owner':result.owner});return res.json(result);}
  catch(error){const status=[400,403].includes(error.statusCode)?error.statusCode:503;return res.status(status).json({ok:false,message:status===503?'Não foi possível confirmar a configuração dos lembretes.':error.message});}
}
module.exports={getRules,updateRule,getPaymentPolicy:unavailablePaymentPolicy,updatePaymentPolicy:unavailablePaymentPolicy,reviewPaymentPolicy};
