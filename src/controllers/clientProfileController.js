const { prisma } = require("../prismaClient");
const { normalizeRole } = require('../utils/roles');

// GET /api/client-portal/:clientId/profile
async function getClientProfile(req, res, next) {
  try {
    const clientId = Number(req.params.clientId);
    res.set('Cache-Control', 'private, no-store');
    if (!/^[1-9]\d*$/.test(req.params.clientId) || !Number.isSafeInteger(clientId) || clientId > 2147483647) return res.status(400).json({ error: 'Cliente inválido.' });
    const role = normalizeRole(req.user?.role);
    if (role !== 'ADMIN' && (role !== 'CLIENT' || clientId !== Number(req.user.clientId || req.user.id))) return res.status(403).json({ error: 'Acesso reservado ao cliente autenticado.' });

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
