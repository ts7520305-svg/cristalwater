// src/controllers/technicianStatsController.js
const TechnicianStatsBusiness = require('../business/technician/TechnicianStatsBusiness');

async function listTechnicianStats(req, res) {
  try {
    const data = await TechnicianStatsBusiness.listTechnicianStats();
    res.json(data);
  } catch (err) {
    console.error('Erro ao listar estatísticas dos técnicos:', err);
    res.status(500).json({ error: 'Erro ao listar estatísticas dos técnicos.' });
  }
}

async function getTechnicianStats(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const data = await TechnicianStatsBusiness.getTechnicianStats(id);
    if (!data.ok) {
      return res.status(data.status).json({ error: data.error });
    }

    res.json(data.payload);
  } catch (err) {
    console.error('Erro ao obter estatísticas do técnico:', err);
    res.status(500).json({ error: 'Erro ao obter estatísticas do técnico.' });
  }
}

module.exports = {
  listTechnicianStats,
  getTechnicianStats
};