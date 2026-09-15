const { prisma } = require("../prismaClient");
const MonthlyBillingBusiness = require('../business/finance/MonthlyBillingBusiness');

async function generateMonthly(req, res) {
  try {
    return res.json(await MonthlyBillingBusiness.generateMonthly(req.body?.monthRef));
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Não foi possível concluir a faturação mensal. Pode repetir o processamento sem duplicar as mensalidades concluídas.' });
  }
}

async function addCredit(req, res) {

  try {

    const clientId = Number(req.params.id);
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false });
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        creditBalance: {
          increment: amount
        }
      }
    });

    res.json({ ok: true, client });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}

module.exports = {
  generateMonthly,
  addCredit
};