// ==========================================
// CRISTAL WATER - HISTORY CONTROLLER
// src/controllers/historyController.js
// ==========================================

const { prisma } = require("../prismaClient");

// GET /api/history/pool/:poolId
async function getHistoryByPool(req, res, next) {
  try {
    const poolId = Number(req.params.poolId);
    if (!poolId) return res.status(400).json({ error: "poolId inválido" });

    const visits = await prisma.serviceVisit.findMany({
      where: { poolId },
      orderBy: { date: "desc" },
      include: {
        technician: true,
        round: true,
        pool: { include: { client: true } },
      },
    });

    return res.json({ poolId, count: visits.length, visits });
  } catch (err) {
    return next(err);
  }
}

// GET /api/history/client/:clientId
async function getHistoryByClient(req, res, next) {
  try {
    const clientId = Number(req.params.clientId);
    if (!clientId) return res.status(400).json({ error: "clientId inválido" });

    const visits = await prisma.serviceVisit.findMany({
      where: { pool: { is: { clientId } } },
      orderBy: { date: "desc" },
      include: {
        pool: true,
        technician: true,
        round: true,
      },
    });

    return res.json({ clientId, count: visits.length, visits });
  } catch (err) {
    return next(err);
  }
}

// GET /api/history/technician/:technicianId
async function getHistoryByTechnician(req, res, next) {
  try {
    const technicianId = Number(req.params.technicianId);
    if (!technicianId) return res.status(400).json({ error: "technicianId inválido" });

    const visits = await prisma.serviceVisit.findMany({
      where: { technicianId },
      orderBy: { date: "desc" },
      include: {
        pool: { include: { client: true } },
        round: true,
      },
    });

    return res.json({ technicianId, count: visits.length, visits });
  } catch (err) {
    return next(err);
  }
}

// GET /api/history/failures
async function getFailures(req, res, next) {
  try {
    const visits = await prisma.serviceVisit.findMany({
      where: { status: "NOT_DONE" },
      orderBy: { date: "desc" },
      include: {
        pool: { include: { client: true } },
        technician: true,
        round: true,
      },
    });

    return res.json({ count: visits.length, visits });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getHistoryByPool,
  getHistoryByClient,
  getHistoryByTechnician,
  getFailures,
};