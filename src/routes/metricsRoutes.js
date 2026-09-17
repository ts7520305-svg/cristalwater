const express = require('express');
const router = express.Router();
const { prisma } = require('../prismaClient');
const auth = require('../middlewares/authMiddleware');

const cancelled = new Set(['CANCELLED', 'CANCELED', 'CANCELADA', 'CANCELADO']);
const completed = new Set(['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUIDO']);

router.get('/productivity', auth('ADMIN'), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const visits = await prisma.serviceVisit.findMany({
      select: {
        clientId: true, client: { select: { name: true } },
        technicianId: true, technicianName: true, technician: { select: { name: true } },
        status: true, startAt: true, endAt: true,
      },
    });
    const clients = new Map(), technicians = new Map();
    function add(groups, key, id, name, duration) {
      if (!groups.has(key)) groups.set(key, { id, name, totalVisits: 0, measuredVisits: 0, totalTime: 0 });
      const row = groups.get(key);
      row.totalVisits++;
      if (duration !== null) { row.measuredVisits++; row.totalTime += duration; }
    }
    for (const visit of visits) {
      const status = String(visit.status || '').toUpperCase();
      if (cancelled.has(status) || (!visit.endAt && !completed.has(status))) continue;
      const elapsed = visit.startAt && visit.endAt ? (visit.endAt - visit.startAt) / 60000 : null;
      const duration = elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
      // The visit's client is historical evidence. A pool may belong to a
      // different client now; do not silently transfer old work to that client.
      add(clients, visit.clientId ?? 'UNASSIGNED', visit.clientId, visit.client?.name || 'Sem cliente associado', duration);
      const name = visit.technician?.name || visit.technicianName || 'Sem técnico associado';
      add(technicians, visit.technicianId ?? 'LEGACY:' + name, visit.technicianId, name, duration);
    }
    const rows = groups => [...groups.values()]
      .map(row => ({ ...row, avgTime: row.measuredVisits ? Math.round(row.totalTime / row.measuredVisits) : null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt') || (a.id ?? 0) - (b.id ?? 0));
    return res.json({ ok: true, clients: rows(clients), technicians: rows(technicians) });
  } catch (err) {
    console.error('ERRO PRODUTIVIDADE:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao carregar métricas.' });
  }
});

module.exports = router;
