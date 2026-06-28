const { prisma } = require("../prismaClient");

// GET /api/client-portal/:clientId/profile
async function getClientProfile(req, res, next) {
  try {
    const clientId = Number(req.params.clientId);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        paymentStatus: true,
        monthlyFee: true,
        lastPaymentAt: true,
      },
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    res.json(client);
  } catch (err) {
    next(err);
  }
}

module.exports = { getClientProfile };