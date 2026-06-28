const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { prisma } = require('../prismaClient');
const { DEFAULT_SETTINGS, getAllSettings, setSetting } = require('../services/systemSettingService');
const auth = require('../middlewares/authMiddleware');
const {
  identityFromPayload,
  getLanguageForIdentity,
  setLanguageForIdentity,
} = require('../services/languagePreferenceService');
const {
  getAccessControlSnapshot,
  savePermissionPolicy,
  saveTeamHierarchy,
} = require('../services/accessControlPolicyService');

const JWT_SECRET = process.env.JWT_SECRET || 'cristalwater_secret';

function parseValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === undefined || value === null) return '';
  return String(value);
}

function getAuthIdentity(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  try {
    return identityFromPayload(jwt.verify(token, JWT_SECRET));
  } catch (error) {
    return null;
  }
}

// ==========================================================
// GLOBAL SYSTEM SETTINGS — Central de Configurações
// ==========================================================
router.get('/global', async (req, res) => {
  try {
    const settings = await getAllSettings();
    return res.json({ ok: true, settings: settings.map, rows: settings.rows, defaults: DEFAULT_SETTINGS });
  } catch (err) {
    console.error('settings global error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao obter configurações globais' });
  }
});

router.get('/global/:key', async (req, res) => {
  try {
    const settings = await getAllSettings();
    return res.json({ ok: true, key: req.params.key, value: settings.map[req.params.key] ?? null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao obter configuração' });
  }
});

router.put('/global/:key', async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ ok: false, error: 'key obrigatório' });
    const row = await setSetting(key, parseValue(req.body.value), req.body.notes || null);
    await prisma.userAuditLog.create({
      data: {
        actor: req.body.actor || 'admin',
        action: 'SYSTEM_SETTING_UPDATE',
        entity: 'SystemSetting',
        entityId: key,
        metadata: { key, value: row.value, notes: row.notes || null },
      },
    }).catch(() => null);
    return res.json({ ok: true, setting: row });
  } catch (err) {
    console.error('settings update error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao gravar configuração' });
  }
});

// ==========================================================
// ACCESS CONTROL - modulos, dados sensiveis e chefes de equipa
// ==========================================================
router.get('/access-control', auth('ADMIN'), async (req, res) => {
  try {
    const snapshot = await getAccessControlSnapshot();
    return res.json({ ok: true, ...snapshot });
  } catch (err) {
    console.error('access control load error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao carregar permissoes' });
  }
});

router.put('/access-control/policy', auth('ADMIN'), async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || 'admin';
    const policy = await savePermissionPolicy(req.body.policy || req.body, actor);
    await prisma.userAuditLog.create({
      data: {
        actor,
        action: 'ACCESS_POLICY_UPDATE',
        entity: 'SystemSetting',
        entityId: 'ACCESS_PERMISSION_POLICY',
        metadata: { roles: Object.keys(policy.roles || {}) },
      },
    }).catch(() => null);
    return res.json({ ok: true, policy });
  } catch (err) {
    console.error('access control policy error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao gravar permissoes' });
  }
});

router.put('/access-control/hierarchy', auth('ADMIN'), async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || 'admin';
    const hierarchy = await saveTeamHierarchy(req.body.hierarchy || req.body, actor);
    await prisma.userAuditLog.create({
      data: {
        actor,
        action: 'TEAM_HIERARCHY_UPDATE',
        entity: 'SystemSetting',
        entityId: 'TEAM_LEADER_HIERARCHY',
        metadata: { leaders: hierarchy.leaders.map((leader) => leader.technicianId) },
      },
    }).catch(() => null);
    return res.json({ ok: true, hierarchy });
  } catch (err) {
    console.error('team hierarchy error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao gravar hierarquia' });
  }
});

router.post('/global/bulk', async (req, res) => {
  try {
    const entries = Object.entries(req.body.settings || {});
    const saved = [];
    for (const [key, value] of entries) saved.push(await setSetting(key, parseValue(value), req.body.notes || null));
    await prisma.userAuditLog.create({
      data: {
        actor: req.body.actor || 'admin',
        action: 'SYSTEM_SETTINGS_BULK_UPDATE',
        entity: 'SystemSetting',
        metadata: { keys: saved.map((item) => item.key) },
      },
    }).catch(() => null);
    return res.json({ ok: true, saved });
  } catch (err) {
    console.error('settings bulk error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao gravar configurações' });
  }
});

// ==========================================================
// USER NOTIFICATION SETTINGS — compatibilidade antiga
// ==========================================================
// ==========================================================
// USER LANGUAGE SETTINGS - PT / EN / FR / DE
// ==========================================================
router.get('/language/me', async (req, res) => {
  try {
    const identity = getAuthIdentity(req);
    if (!identity) return res.status(401).json({ ok: false, error: 'Sessao invalida' });

    const language = await getLanguageForIdentity(identity, 'pt');
    return res.json({ ok: true, language, identity });
  } catch (err) {
    console.error('language get error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao obter idioma' });
  }
});

router.put('/language/me', async (req, res) => {
  try {
    const identity = getAuthIdentity(req);
    if (!identity) return res.status(401).json({ ok: false, error: 'Sessao invalida' });

    const result = await setLanguageForIdentity(identity, req.body?.language);
    await prisma.userAuditLog.create({
      data: {
        actor: identity.email || `${identity.role}:${identity.id}`,
        action: 'USER_LANGUAGE_UPDATE',
        entity: identity.role || 'User',
        entityId: String(identity.id || identity.email || ''),
        metadata: { language: result.language, key: result.key },
      },
    }).catch(() => null);

    return res.json({ ok: true, language: result.language });
  } catch (err) {
    console.error('language update error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao gravar idioma' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const data = await prisma.userNotificationSetting.findMany({ where: { userId: Number(req.params.userId) } });
    return res.json({ ok: true, settings: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao obter configurações do utilizador' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, type, sound } = req.body;
    const data = await prisma.userNotificationSetting.upsert({
      where: { userId_type: { userId: Number(userId), type } },
      update: { sound: Boolean(sound) },
      create: { userId: Number(userId), type, sound: Boolean(sound) },
    });
    return res.json({ ok: true, setting: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao guardar configurações' });
  }
});

module.exports = router;
