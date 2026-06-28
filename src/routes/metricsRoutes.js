const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");

// ==========================================================
// PRODUTIVIDADE (clientes + técnicos)
// ==========================================================
router.get("/productivity", async (req, res) => {
  try {

    const visits = await prisma.serviceVisit.findMany({
      include: {
        pool: { include: { client: true } }
      }
    });

    const clients = {};
    const technicians = {};

    visits.forEach(v => {

      const duration = (v.startAt && v.endAt)
        ? (new Date(v.endAt) - new Date(v.startAt)) / 60000
        : 0;

      // CLIENTE
      const clientName = v.pool?.client?.name || "Sem cliente";
      if (!clients[clientName]) {
        clients[clientName] = {
          name: clientName,
          totalVisits: 0,
          totalTime: 0
        };
      }
      clients[clientName].totalVisits++;
      clients[clientName].totalTime += duration;

      // TÉCNICO
      const techName = v.technicianName || "Sem técnico";
      if (!technicians[techName]) {
        technicians[techName] = {
          name: techName,
          totalVisits: 0,
          totalTime: 0
        };
      }
      technicians[techName].totalVisits++;
      technicians[techName].totalTime += duration;
    });

    const resultClients = Object.values(clients).map(c => ({
      ...c,
      avgTime: c.totalVisits ? Math.round(c.totalTime / c.totalVisits) : 0
    }));

    const resultTechs = Object.values(technicians).map(t => ({
      ...t,
      avgTime: t.totalVisits ? Math.round(t.totalTime / t.totalVisits) : 0
    }));

    res.json({
      ok: true,
      clients: resultClients,
      technicians: resultTechs
    });

  } catch (err) {
    console.error("ERRO PRODUTIVIDADE:", err);
    res.json({ ok: false });
  }
});

module.exports = router;