const PoolBusiness = require("../business/pool/PoolBusiness");
const PoolDashboardBusiness = require("../business/pool/PoolDashboardBusiness");

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}
function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function numberOrDefault(value, fallback) {
  const n = numberOrNull(value);
  return n === null ? fallback : n;
}
function boolFrom(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
}
function cleanString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const v = String(value).trim();
  return v || null;
}
function definedOnly(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
function poolUniqueErrorMessage(err) {
  if (err?.code !== "P2002") return null;
  const target = Array.isArray(err.meta?.target) ? err.meta.target.join(",") : String(err.meta?.target || "");
  if (target.includes("address") || target.includes("pool_physical_location_unique")) {
    return "Ja existe uma infraestrutura registada exatamente com este tipo e nesta localizacao/morada.";
  }
  return "Ja existe um registo duplicado para esta piscina ou jacuzzi.";
}
function cleanPoolPayload(body = {}, isCreate = false) {
  return definedOnly({
    clientId: isCreate ? toInt(body.clientId) : undefined,
    name: cleanString(body.name),
    location: cleanString(body.location),
    address: cleanString(body.address),
    zone: cleanString(body.zone),
    zoneId: body.zoneId === undefined ? undefined : numberOrNull(body.zoneId),
    volumeM3: body.volumeM3 === undefined ? undefined : numberOrNull(body.volumeM3),
    type: cleanString(body.type),
    priority: body.priority === undefined ? undefined : numberOrDefault(body.priority, 0),
    active: body.active === undefined ? undefined : boolFrom(body.active),
    notes: cleanString(body.notes),
    latitude: body.latitude === undefined ? undefined : numberOrNull(body.latitude),
    longitude: body.longitude === undefined ? undefined : numberOrNull(body.longitude),
    monthlyAmount: body.monthlyAmount === undefined ? undefined : numberOrDefault(body.monthlyAmount, 0),
    serviceFrequency: body.serviceFrequency === undefined ? undefined : Math.max(1, numberOrDefault(body.serviceFrequency, 1)),
    preferredDays: cleanString(body.preferredDays),
    scheduleMode: cleanString(body.scheduleMode),
    estimatedMinutes: body.estimatedMinutes === undefined ? undefined : Math.max(1, numberOrDefault(body.estimatedMinutes, 30)),
    hasLights: body.hasLights === undefined ? undefined : boolFrom(body.hasLights),
    archiveStatus: body.archiveStatus || undefined,
    deletedAt: body.deletedAt === undefined ? undefined : body.deletedAt,
  });
}
async function listPools(req, res) {
  try {
    const pools = await PoolDashboardBusiness.listPools(req.query);
    return res.json({ ok: true, pools });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro listar piscinas" });
  }
}

async function getPoolById(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const pool = await PoolDashboardBusiness.getPoolById(id);
    return res.json({ ok: true, pool });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro obter piscina" });
  }
}

async function createPool(req, res) {
  try {
    const data = cleanPoolPayload(req.body, true);
    if (!data.clientId) return res.status(400).json({ ok: false, error: "clientId obrigatório" });
    if (!data.name) return res.status(400).json({ ok: false, error: "Nome da piscina obrigatório" });

    const result = await PoolBusiness.create(data, req.body);

    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    const duplicateMessage = poolUniqueErrorMessage(err);
    if (duplicateMessage) return res.status(409).json({ ok: false, error: duplicateMessage });
    return res.status(500).json({ error: "Erro criar piscina" });
  }
}

async function getPoolEditState(req, res) {
  try { return res.json(await require("../business/pool/PoolEditBusiness").getState(req.params.id, req.user)); }
  catch (err) { return res.status(err.statusCode || 500).json({ ok: false, code: err.publicCode || "POOL_EDIT_FAILED", error: err.statusCode ? err.message : "Não foi possível carregar os dados atuais." }); }
}

async function updatePool(req, res) {
  try {
    const result = await require("../business/pool/PoolEditBusiness").update(req.params.id, req.body, req.user);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("updatePool error:", err.code || err.statusCode || "POOL_UPDATE_FAILED");
    const duplicateMessage = poolUniqueErrorMessage(err);
    if (duplicateMessage) return res.status(409).json({ ok: false, error: duplicateMessage });
    return res.status(err.statusCode || 500).json({ ok: false, code: err.publicCode || "POOL_EDIT_FAILED",
      error: err.statusCode ? err.message : "Alteração não confirmada. Conserve o pedido e repita a confirmação." });
  }
}

async function archivePool(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const pool = await PoolBusiness.archive(id);
    return res.json({ ok: true, archived: true, pool });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro arquivar piscina" });
  }
}

async function restorePool(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const restored = await PoolBusiness.restore(id);
    return res.json({ ok: true, restored: true, pool: restored });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro restaurar piscina" });
  }
}

async function deletePool(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const result = await PoolBusiness.delete(id);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(409).json({ error: err.message || "Piscina protegida por histórico. Arquive em vez de eliminar fisicamente." });
  }
}

module.exports = {
  listPools,
  getPoolById,
  createPool,
  updatePool,
  getPoolEditState,
  archivePool,
  restorePool,
  deletePool,
};
