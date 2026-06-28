const { prisma } = require("../prismaClient");

// ==========================================
// LISTAR HISTÓRICO
// ==========================================

async function listCommunications(req, res) {
  try {
    const logs = await prisma.communicationLog.findMany({
      orderBy: { createdAt: "desc" }
    });

    res.json({
      ok: true,
      logs
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listCommunications
};