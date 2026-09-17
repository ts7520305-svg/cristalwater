const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { roleIn, roleMatches } = require('../utils/roles');
const { parseLocalDay, serviceVisitDayWhere } = require('../utils/serviceVisitFilters');
const prisma = require('../prismaClient');

const router = express.Router();

function allowRoles(...roles) {
  return (req, res, next) => {
    if (roleIn(req.user?.role, roles)) return next();
    return res.status(403).json({ ok: false, message: 'Sem permissão' });
  };
}

router.use(auth());
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}
function toBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}
function dayWindow(dateLike) {
  if (dateLike !== undefined && (typeof dateLike !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateLike))) fail('Data inválida. Indique AAAA-MM-DD.');
  const window = parseLocalDay(dateLike);
  if (dateLike !== undefined && window.isoDate !== dateLike) fail('Data de calendário inválida.');
  return window;
}
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
const pendingVisit = { endAt: null, status: { notIn: ['DONE','COMPLETED','CONCLUIDA','CONCLUIDO','CANCELLED','CANCELED','CANCELADA','CANCELADO','SKIPPED','ARCHIVED','ARQUIVADA','ARQUIVADO'] } };
function technicianScope(req) {
  const value = req.query.technicianId;
  let requested = null;
  if (value !== undefined) {
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) fail('Técnico inválido.');
    requested = Number(value);
  }
  if (roleMatches(req.user?.role, 'ADMIN')) return requested;
  const own = Number(req.user?.technicianId || req.user?.id);
  if (!Number.isSafeInteger(own) || own <= 0 || (requested && requested !== own)) fail('Sem permissão para as chaves deste técnico.', 403);
  return own;
}
function assignedPool(technicianId) {
  return { OR: [{ serviceVisits: { some: { ...pendingVisit, technicianId } } }, { extraVisits: { some: { ...pendingVisit, technicianId } } }] };
}
function clientKeyPayload(body = {}) {
  return {
    clientId: toInt(body.clientId),
    title: body.title || body.keyName || body.code || 'Chave',
    accessType: 'KEY',
    codeValue: body.codeValue || body.code || body.keyCode || null,
    instructions: body.instructions || body.notes || null,
    visibleToTechnician: toBool(body.visibleToTechnician, true),
    active: toBool(body.active, true)
  };
}
function poolKeyPayload(body = {}) {
  return {
    keyCode: body.codeValue || body.code || body.keyCode || null,
    description: body.instructions || body.notes || body.description || body.title || null,
    requiredForVisit: toBool(body.requiredForVisit, true),
    visibleToTechnician: toBool(body.visibleToTechnician, true),
    active: toBool(body.active, true)
  };
}
function clientKeyWhere(query = {}) {
  const where = { accessType: 'KEY' };
  if (!toBool(query.includeInactive, false)) where.active = true;
  if (query.clientId) where.clientId = toInt(query.clientId);
  if (query.code) where.codeValue = { contains: String(query.code), mode: 'insensitive' };
  return where;
}
function actionRef(raw) {
  const value = String(raw || '');
  if (value.startsWith('pool-')) return { source: 'pool', id: toInt(value.slice(5)) };
  if (value.startsWith('client-')) return { source: 'client', id: toInt(value.slice(7)) };
  return { source: null, id: toInt(value) };
}
function clientKeyDto(key) {
  return {
    ...key,
    uid: `client-${key.id}`,
    source: 'client',
    keyCode: key.codeValue,
    keyName: key.title || 'Chave',
    pool: null,
    poolName: null,
    clientName: key.client?.name || null
  };
}
function poolKeyDto(key) {
  const pools = key.pools || [];
  const pool = pools[0] || null;
  return {
    ...key,
    uid: `pool-${key.id}`,
    source: 'pool',
    codeValue: key.keyCode,
    title: key.description || 'Chave da piscina',
    instructions: key.description || null,
    keyName: key.description || 'Chave da piscina',
    pool,
    pools,
    poolName: pool?.name || null,
    client: pool?.client || null,
    clientName: pool?.client?.name || null
  };
}
async function resolveAction(ref) {
  const parsed = actionRef(ref);
  if (!parsed.id) return parsed;
  if (parsed.source) return parsed;

  const clientRecord = await prisma.clientAccess.findUnique({ where: { id: parsed.id } }).catch(() => null);
  if (clientRecord) return { source: 'client', id: parsed.id };
  return { source: 'pool', id: parsed.id };
}
function modelFor(source) {
  return source === 'pool' ? prisma.keyAccess : prisma.clientAccess;
}

router.get('/', allowRoles('ADMIN'), async (req, res) => {
  try {
    const [clientKeys, poolKeys] = await Promise.all([
      prisma.clientAccess.findMany({
        where: clientKeyWhere(req.query),
        include: { client: { select: { id: true, name: true, zone: true, address: true } } },
        orderBy: [{ active: 'desc' }, { codeValue: 'asc' }, { title: 'asc' }],
        take: 1000
      }),
      prisma.keyAccess.findMany({
        where: toBool(req.query.includeInactive, false) ? {} : { active: true },
        include: {
          pools: {
            include: { client: { select: { id: true, name: true, zone: true, address: true } } },
            take: 5
          }
        },
        orderBy: [{ active: 'desc' }, { keyCode: 'asc' }],
        take: 1000
      }).catch(() => [])
    ]);

    const keys = [...clientKeys.map(clientKeyDto), ...poolKeys.map(poolKeyDto)]
      .sort((a, b) => Number(b.active) - Number(a.active) || String(a.codeValue || '').localeCompare(String(b.codeValue || '')));
    res.json({ ok: true, keys });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/', allowRoles('ADMIN'), async (req, res) => {
  try {
    const poolId = toInt(req.body?.poolId);
    if (poolId) {
      const data = poolKeyPayload(req.body);
      if (!data.keyCode) return res.status(400).json({ ok: false, error: 'Codigo da chave obrigatorio.' });
      const key = await prisma.keyAccess.upsert({
        where: { keyCode: String(data.keyCode).trim() },
        update: {
          description: data.description,
          requiredForVisit: data.requiredForVisit,
          visibleToTechnician: data.visibleToTechnician,
          active: data.active,
          pools: { connect: { id: poolId } }
        },
        create: {
          ...data,
          keyCode: String(data.keyCode).trim(),
          pools: { connect: { id: poolId } }
        },
        include: { pools: { include: { client: true } } }
      });
      return res.status(201).json({ ok: true, key: poolKeyDto(key) });
    }

    const data = clientKeyPayload(req.body);
    if (!data.clientId) return res.status(400).json({ ok: false, error: 'clientId ou poolId obrigatorio.' });
    if (!data.codeValue) return res.status(400).json({ ok: false, error: 'Codigo da chave obrigatorio.' });
    const key = await prisma.clientAccess.create({ data });
    res.status(201).json({ ok: true, key: clientKeyDto(key) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/:id', allowRoles('ADMIN'), async (req, res) => {
  try {
    const ref = await resolveAction(req.params.id);
    if (ref.source === 'pool') {
      const data = poolKeyPayload(req.body);
      if (data.keyCode) data.keyCode = String(data.keyCode).trim();
      const key = await prisma.keyAccess.update({
        where: { id: ref.id },
        data,
        include: { pools: { include: { client: true } } }
      });
      return res.json({ ok: true, key: poolKeyDto(key) });
    }

    const data = clientKeyPayload(req.body);
    delete data.clientId;
    const key = await prisma.clientAccess.update({ where: { id: ref.id }, data });
    res.json({ ok: true, key: clientKeyDto(key) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/:id/archive', allowRoles('ADMIN'), async (req, res) => {
  try {
    const ref = await resolveAction(req.params.id);
    const key = await modelFor(ref.source).update({ where: { id: ref.id }, data: { active: false } });
    res.json({ ok: true, archived: true, key });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/:id/restore', allowRoles('ADMIN'), async (req, res) => {
  try {
    const ref = await resolveAction(req.params.id);
    const key = await modelFor(ref.source).update({ where: { id: ref.id }, data: { active: true } });
    res.json({ ok: true, restored: true, key });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/:id', allowRoles('ADMIN'), async (req, res) => {
  try {
    const ref = await resolveAction(req.params.id);
    const model = modelFor(ref.source);
    const mode = String(req.query.mode || '').toLowerCase();
    if (mode === 'hard') {
      await model.delete({ where: { id: ref.id } });
      return res.json({ ok: true, deleted: true });
    }
    const key = await model.update({ where: { id: ref.id }, data: { active: false } });
    res.json({ ok: true, archived: true, key, message: 'Chave arquivada.' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/required/morning', allowRoles('ADMIN', 'TECHNICIAN', 'TEAM_LEADER'), async (req, res) => {
  try {
    const { start, end, isoDate } = dayWindow(req.query.date);
    const technicianId = technicianScope(req);
    const visitWhere = {
      ...serviceVisitDayWhere(start, end),
      ...pendingVisit
    };
    if (technicianId) visitWhere.technicianId = technicianId;

    const include = {
        technician: { select: { id: true, name: true } },
        pool: {
          select: {
            id: true,
            name: true,
            zone: true,
            location: true,
            address: true,
            keyAccesses: { where: { active: true, visibleToTechnician: true, requiredForVisit: true } },
            client: {
              select: {
                id: true,
                name: true,
                zone: true,
                accesses: { where: { accessType: 'KEY', active: true, visibleToTechnician: true } }
              }
            }
          }
        },
        client: {
          select: {
            id: true,
            name: true,
            zone: true,
            accesses: { where: { accessType: 'KEY', active: true, visibleToTechnician: true } }
          }
        }
      };
    const [regular, extras] = await Promise.all([
      prisma.serviceVisit.findMany({ where: visitWhere, include: { ...include, round: { select: { id: true, name: true, dayOfWeek: true } } }, orderBy: [{ technicianId: 'asc' }, { plannedDate: 'asc' }, { date: 'asc' }, { id: 'asc' }] }),
      prisma.extraVisit.findMany({ where: { ...pendingVisit, ...(technicianId ? { technicianId } : {}), OR: [{ scheduledAt: { gte: start, lt: end } }, { startAt: { gte: start, lt: end } }] }, include, orderBy: [{ technicianId: 'asc' }, { scheduledAt: 'asc' }, { id: 'asc' }] })
    ]);
    const visits = [...regular.map(visit => ({ ...visit, visitType: 'REGULAR' })), ...extras.map(visit => ({ ...visit, visitType: 'EXTRA', plannedDate: visit.scheduledAt }))]
      .sort((a, b) => (a.technicianId || 0) - (b.technicianId || 0) || new Date(a.plannedDate || a.date) - new Date(b.plannedDate || b.date) || a.id - b.id);

    const seen = new Set();
    const requiredKeys = [];
    for (const visit of visits) {
      const client = visit.pool?.client || visit.client;
      const accesses = [
        ...(visit.pool?.keyAccesses || []).map((key) => ({
          id: `pool-${key.id}`,
          code: key.keyCode,
          name: key.description || 'Chave da piscina',
          instructions: key.description || null
        })),
        ...(client?.accesses || []).map((key) => ({
          id: `client-${key.id}`,
          code: key.codeValue,
          name: key.title || 'Chave',
          instructions: key.instructions || null
        }))
      ];
      for (const key of accesses) {
        const k = `${key.id}:${visit.visitType}:${visit.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        requiredKeys.push({
          visitId: visit.id,
          visitType: visit.visitType,
          visitKey: `${visit.visitType}:${visit.id}`,
          technicianId: visit.technicianId,
          technicianName: visit.technician?.name || visit.technicianName || null,
          clientId: client?.id || null,
          clientName: client?.name || null,
          poolId: visit.pool?.id || visit.poolId || null,
          poolName: visit.pool?.name || null,
          poolZone: visit.pool?.zone || visit.pool?.location || null,
          poolAddress: visit.pool?.address || null,
          roundId: visit.round?.id || visit.roundId || null,
          roundName: visit.round?.name || null,
          keyId: key.id,
          keyCode: key.code,
          keyName: key.name,
          instructions: key.instructions || null,
          plannedDate: visit.plannedDate || visit.date,
          alertText: `${visit.technician?.name || visit.technicianName || 'Tecnico'} precisa da chave ${key.code || key.name || 'indicada'} para ${visit.pool?.name || 'piscina'}${visit.round?.name ? ` na ronda ${visit.round.name}` : ''}.`
        });
      }
    }

    res.json({ ok: true, date: isoDate, technicianId, count: requiredKeys.length, keys: requiredKeys });
  } catch (error) {
    res.status(error.status || 503).json({ ok: false, error: error.status ? error.message : 'Não foi possível consultar as chaves. Tente novamente.' });
  }
});

router.get('/holder/:code', allowRoles('ADMIN', 'TECHNICIAN', 'TEAM_LEADER'), async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code || code.length > 250) fail('Código inválido.');
    const administrator = roleMatches(req.user?.role, 'ADMIN');
    const poolScope = administrator ? null : assignedPool(technicianScope(req));
    const [clientHolders, poolHolders] = await Promise.all([
      prisma.clientAccess.findMany({
        where: { accessType: 'KEY', codeValue: { equals: code, mode: 'insensitive' }, active: true, ...(poolScope ? { visibleToTechnician: true, client: { pools: { some: poolScope } } } : {}) },
        include: { client: { select: { id: true, name: true, zone: true, address: true } } },
        orderBy: { id: 'asc' }
      }),
      prisma.keyAccess.findMany({
        where: { keyCode: { equals: code, mode: 'insensitive' }, active: true, ...(poolScope ? { visibleToTechnician: true, pools: { some: poolScope } } : {}) },
        include: { pools: { ...(poolScope ? { where: poolScope } : {}), include: { client: { select: { id: true, name: true, zone: true, address: true } } } } },
        orderBy: { id: 'asc' }
      })
    ]);
    const holders = [...clientHolders.map(clientKeyDto), ...poolHolders.map(poolKeyDto)];
    res.json({ ok: true, code, holders });
  } catch (error) {
    res.status(error.status || 503).json({ ok: false, error: error.status ? error.message : 'Não foi possível consultar a chave. Tente novamente.' });
  }
});

module.exports = router;
