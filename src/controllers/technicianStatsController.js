// src/controllers/technicianStatsController.js
const { prisma } = require('../db/connection');

// Função auxiliar para calcular stats de um técnico
async function computeStatsForTechnician(techId) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // logs totais
  const totalLogs = await prisma.locationLog.count({
    where: { userId: techId }
  });

  // logs últimos 7 dias
  const logsLast7Days = await prisma.locationLog.count({
    where: {
      userId: techId,
      timestamp: { gte: sevenDaysAgo }
    }
  });

  // logs últimos 30 dias
  const logsLast30Days = await prisma.locationLog.count({
    where: {
      userId: techId,
      timestamp: { gte: thirtyDaysAgo }
    }
  });

  // primeiro e último log
  const minMax = await prisma.locationLog.aggregate({
    _min: { timestamp: true },
    _max: { timestamp: true },
    where: { userId: techId }
  });

  return {
    totalLocationLogs: totalLogs,
    locationLogsLast7Days: logsLast7Days,
    locationLogsLast30Days: logsLast30Days,
    firstLocationAt: minMax._min.timestamp,
    lastLocationAt: minMax._max.timestamp,

    // Campos preparados para o futuro (quando ligarmos serviços / rondas ao técnico)
    totalServices: 0,
    servicesLast30Days: 0,
    totalAlerts: 0
  };
}

// LISTAR ESTATÍSTICAS DE TODOS OS TÉCNICOS
async function listTechnicianStats(req, res) {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: 'TECHNICIAN' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    const statsList = [];
    for (const tech of technicians) {
      const stats = await computeStatsForTechnician(tech.id);
      statsList.push({
        technician: tech,
        stats
      });
    }

    res.json(statsList);
  } catch (err) {
    console.error('Erro ao listar estatísticas dos técnicos:', err);
    res.status(500).json({ error: 'Erro ao listar estatísticas dos técnicos.' });
  }
}

// ESTATÍSTICAS DE UM TÉCNICO ESPECÍFICO
async function getTechnicianStats(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const tech = await prisma.user.findFirst({
      where: {
        id,
        role: 'TECHNICIAN'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!tech) {
      return res.status(404).json({ error: 'Técnico não encontrado.' });
    }

    const stats = await computeStatsForTechnician(tech.id);

    res.json({
      technician: tech,
      stats
    });
  } catch (err) {
    console.error('Erro ao obter estatísticas do técnico:', err);
    res.status(500).json({ error: 'Erro ao obter estatísticas do técnico.' });
  }
}

module.exports = {
  listTechnicianStats,
  getTechnicianStats
};