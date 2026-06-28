// src/controllers/locationLogController.js
const { prisma } = require('../db/connection');

// LISTAR TODOS OS LOGS
async function listLocationLogs(req, res) {
  try {
    const logs = await prisma.locationLog.findMany({
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    res.json(logs);
  } catch (err) {
    console.error('Erro ao listar logs de localização:', err);
    res.status(500).json({ error: 'Erro ao listar logs de localização.' });
  }
}

// LISTAR LOGS DE UM UTILIZADOR
async function listLocationLogsByUser(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'userId inválido.' });
    }

    const logs = await prisma.locationLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' }
    });

    res.json(logs);
  } catch (err) {
    console.error('Erro ao listar logs do utilizador:', err);
    res.status(500).json({ error: 'Erro ao listar logs do utilizador.' });
  }
}

// CRIAR LOG DE LOCALIZAÇÃO
// body: { userId, latitude, longitude, accuracyM?, timestamp? }
async function createLocationLog(req, res) {
  try {
    const { userId, latitude, longitude, accuracyM, timestamp } = req.body;

    if (!userId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Campos "userId", "latitude" e "longitude" são obrigatórios.'
      });
    }

    const userIdNum = Number(userId);
    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    const accNum = accuracyM !== undefined ? Number(accuracyM) : null;

    if (Number.isNaN(userIdNum) || Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      return res.status(400).json({ error: 'Valores numéricos inválidos.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userIdNum } });
    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    const log = await prisma.locationLog.create({
      data: {
        userId: userIdNum,
        latitude: latNum,
        longitude: lonNum,
        accuracyM: accNum,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      }
    });

    res.status(201).json(log);
  } catch (err) {
    console.error('Erro ao criar log de localização:', err);
    res.status(500).json({ error: 'Erro ao criar log de localização.' });
  }
}

// SEED: criar alguns logs de exemplo
async function seedLocationLogs(req, res) {
  try {
    const count = await prisma.locationLog.count();
    if (count > 0) {
      return res.json({
        message: 'Já existem logs de localização. Seed não foi executado.',
        existingCount: count
      });
    }

    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      take: 2
    });

    if (users.length === 0) {
      return res.status(400).json({
        error: 'Não há utilizadores na base de dados para associar logs.'
      });
    }

    const now = new Date();
    const data = [];

    // Logs de exemplo para o primeiro utilizador
    data.push(
      {
        userId: users[0].id,
        latitude: 37.0902,
        longitude: -8.6690,
        accuracyM: 10,
        timestamp: new Date(now.getTime() - 30 * 60 * 1000) // -30 min
      },
      {
        userId: users[0].id,
        latitude: 37.0915,
        longitude: -8.6705,
        accuracyM: 8,
        timestamp: new Date(now.getTime() - 15 * 60 * 1000) // -15 min
      }
    );

    // Se houver segundo utilizador
    if (users[1]) {
      data.push({
        userId: users[1].id,
        latitude: 37.0888,
        longitude: -8.6650,
        accuracyM: 12,
        timestamp: now
      });
    }

    const created = await prisma.locationLog.createMany({ data });

    res.json({
      message: 'Logs de localização de exemplo criados com sucesso.',
      inserted: created.count
    });
  } catch (err) {
    console.error('Erro ao fazer seed de logs de localização:', err);
    res.status(500).json({ error: 'Erro ao criar logs de localização de exemplo.' });
  }
}

module.exports = {
  listLocationLogs,
  listLocationLogsByUser,
  createLocationLog,
  seedLocationLogs
};