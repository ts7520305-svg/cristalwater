const express = require('express');
const router = express.Router();
const { prisma } = require('../prismaClient');
const { getBooleanSetting, getAllSettings } = require('../services/systemSettingService');
const auth = require('../middlewares/authMiddleware');
const { roleMatches } = require('../utils/roles');

router.use(auth());

function roleOf(req) {
  return String(req.user?.role || '').trim().toUpperCase();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const role = roleOf(req);
    if (roles.some((allowed) => roleMatches(role, allowed))) return next();
    return res.status(403).json({ ok: false, error: 'Sem permissão' });
  };
}

function currentTechnicianId(req) {
  return Number(req.user?.technicianId || req.user?.id || 0);
}

function cleanString(value) {
  const s = String(value || '').trim();
  return s || null;
}
function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get('/settings', requireRoles('TECHNICIAN', 'ADMIN'), async (req, res) => {
  try {
    const { map } = await getAllSettings();
    return res.json({
      ok: true,
      techniciansCanCreateClientsPools: map.TECHNICIANS_CAN_CREATE_CLIENTS_POOLS === 'true',
      requireAdminReview: map.TECHNICIAN_CREATED_RECORDS_REQUIRE_ADMIN_REVIEW !== 'false',
      poolsActiveByDefault: map.TECHNICIAN_CREATED_POOLS_ACTIVE_BY_DEFAULT === 'true',
      settings: map,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao obter permissões' });
  }
});

router.post('/client-with-pool', requireRoles('TECHNICIAN', 'ADMIN'), async (req, res) => {
  try {
    const role = roleOf(req);
    const isAdmin = roleMatches(role, 'ADMIN');
    const scopedTechnicianId = currentTechnicianId(req);
    const bodyTechnicianId = numberOrNull(req.body.technicianId);

    if (!isAdmin && !scopedTechnicianId) {
      return res.status(403).json({ ok: false, error: 'Sessão técnica inválida para intake de campo' });
    }

    if (!isAdmin && bodyTechnicianId && bodyTechnicianId !== scopedTechnicianId) {
      return res.status(403).json({ ok: false, error: 'Não pode criar registos em nome de outro técnico' });
    }

    const allowed = await getBooleanSetting('TECHNICIANS_CAN_CREATE_CLIENTS_POOLS', false);
    if (!allowed) {
      return res.status(403).json({
        ok: false,
        error: 'Neste momento os técnicos não têm permissão para adicionar novos clientes/piscinas. Ativa esta opção na Central de Configurações.',
      });
    }

    const requireReview = await getBooleanSetting('TECHNICIAN_CREATED_RECORDS_REQUIRE_ADMIN_REVIEW', true);
    const poolsActiveByDefault = await getBooleanSetting('TECHNICIAN_CREATED_POOLS_ACTIVE_BY_DEFAULT', false);
    const technicianId = isAdmin ? bodyTechnicianId : scopedTechnicianId;
    const name = cleanString(req.body.clientName || req.body.name);
    if (!name) return res.status(400).json({ ok: false, error: 'Nome do cliente obrigatório' });

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name,
          phone: cleanString(req.body.phone),
          email: cleanString(req.body.email),
          address: cleanString(req.body.address),
          zone: cleanString(req.body.zone),
          latitude: numberOrNull(req.body.latitude),
          longitude: numberOrNull(req.body.longitude),
          notes: cleanString(req.body.notes),
          status: requireReview ? 'PENDING_REVIEW' : 'ACTIVE',
          active: !requireReview,
          source: 'TECHNICIAN_FIELD_INTAKE',
          createdByTechnicianId: technicianId,
          pendingReview: requireReview,
          reviewStatus: requireReview ? 'PENDING' : 'APPROVED',
        },
      });

      const pool = await tx.pool.create({
        data: {
          clientId: client.id,
          name: cleanString(req.body.poolName) || 'Piscina principal',
          address: cleanString(req.body.poolAddress || req.body.address),
          zone: cleanString(req.body.zone),
          type: cleanString(req.body.poolType),
          volumeM3: numberOrNull(req.body.volumeM3),
          latitude: numberOrNull(req.body.latitude),
          longitude: numberOrNull(req.body.longitude),
          notes: cleanString(req.body.poolNotes || req.body.notes),
          active: requireReview ? poolsActiveByDefault : true,
          source: 'TECHNICIAN_FIELD_INTAKE',
          createdByTechnicianId: technicianId,
          pendingReview: requireReview,
          reviewStatus: requireReview ? 'PENDING' : 'APPROVED',
        },
      });

      await tx.task.create({
        data: {
          title: `Validar novo cliente: ${client.name}`,
          description: `Cliente/piscina criado em campo por técnico. Completar ficha técnica, validar dados, preço, acessos e ronda.`,
          status: 'PENDING',
          priority: 'HIGH',
          clientId: client.id,
          poolId: pool.id,
        },
      }).catch(() => null);

      await tx.userAuditLog.create({
        data: {
          actor: technicianId ? `technician:${technicianId}` : 'technician',
          action: 'TECHNICIAN_CREATED_CLIENT_POOL_PENDING_REVIEW',
          entity: 'Client',
          entityId: String(client.id),
          metadata: { clientId: client.id, poolId: pool.id, requireReview },
        },
      }).catch(() => null);

      return { client, pool };
    });

    return res.json({ ok: true, ...result, pendingReview: requireReview });
  } catch (err) {
    console.error('technician intake error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao criar cliente/piscina em campo' });
  }
});

router.get('/pending-review', requireRoles('ADMIN'), async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: { pendingReview: true },
      include: { pools: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, clients });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao listar pendentes' });
  }
});

router.post('/clients/:id/approve', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const client = await prisma.client.update({
      where: { id },
      data: { active: true, status: 'ACTIVE', pendingReview: false, reviewStatus: 'APPROVED', reviewedAt: new Date(), reviewedByUserId: numberOrNull(req.body.userId) },
    });
    await prisma.pool.updateMany({
      where: { clientId: id, pendingReview: true },
      data: { active: true, pendingReview: false, reviewStatus: 'APPROVED', reviewedAt: new Date(), reviewedByUserId: numberOrNull(req.body.userId) },
    });
    await prisma.userAuditLog.create({ data: { actor: req.body.actor || 'admin', action: 'APPROVED_FIELD_CREATED_CLIENT', entity: 'Client', entityId: String(id) } }).catch(() => null);
    return res.json({ ok: true, client });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao aprovar cliente' });
  }
});

module.exports = router;
