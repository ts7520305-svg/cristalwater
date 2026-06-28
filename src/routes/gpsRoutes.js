const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");

// ==========================================================
// CRISTAL WATER ENTERPRISE — GPS HYBRID ENGINE V21/V22
// Geofence real por piscina/cliente, anti-jump, modo degradado
// e compatibilidade com o mapa live existente.
// ==========================================================

const GEOFENCE_RADIUS_METERS = Number(process.env.GEOFENCE_RADIUS_METERS || 100);
const ARRIVAL_RADIUS_METERS = Number(process.env.ARRIVAL_RADIUS_METERS || 150);
const ARRIVAL_ALERT_COOLDOWN_MS = Number(process.env.ARRIVAL_ALERT_COOLDOWN_MS || 1000 * 60 * 60 * 3);

// Memória anti-spam para notificações de chegada.
const lastAlerts = Object.create(null);

const logger = {
  info: (msg, ctx = null) => console.log(`[${new Date().toISOString()}] [INFO] [GPS] ${msg}`, ctx || ""),
  warn: (msg, ctx = null) => console.warn(`[${new Date().toISOString()}] [WARN] [GPS] ${msg}`, ctx || ""),
  error: (msg, err = null) => console.error(`[${new Date().toISOString()}] [ERROR] [GPS] ${msg}`, err?.stack || err || "")
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180 &&
    !(Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001)
  );
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isGpsFresh(updatedAt) {
  const time = updatedAt ? new Date(updatedAt).getTime() : 0;
  return Number.isFinite(time) && Date.now() - time <= 15 * 60 * 1000;
}

function activeVisitStatus(status) {
  return ["IN_PROGRESS", "A_CAMINHO", "ON_ROUTE", "STARTED", "EM_EXECUCAO", "EM EXECUCAO"].includes(
    String(status || "").toUpperCase()
  );
}

function openVisitStatus(status) {
  return !["DONE", "CLOSED", "CONCLUIDA", "CONCLUÍDA", "CANCELLED", "CANCELED", "NOT_DONE"].includes(
    String(status || "").toUpperCase()
  );
}

function visitSummary(visit) {
  if (!visit) return null;
  return {
    id: visit.id,
    status: visit.status,
    plannedDate: visit.plannedDate || visit.date || visit.createdAt,
    client: visit.client ? { id: visit.client.id, name: visit.client.name } : null,
    pool: visit.pool ? {
      id: visit.pool.id,
      name: visit.pool.name,
      zone: visit.pool.zone,
      address: visit.pool.address || visit.pool.location,
      latitude: visit.pool.latitude,
      longitude: visit.pool.longitude,
    } : null,
  };
}

function actionTextForTechnician({ currentVisit, nextVisit, gpsActive }) {
  if (currentVisit) {
    return `Em servico: ${currentVisit.pool?.name || "piscina"} - ${currentVisit.client?.name || "cliente"}`;
  }
  if (nextVisit) {
    return `Proxima visita: ${nextVisit.pool?.name || "piscina"} - ${nextVisit.client?.name || "cliente"}`;
  }
  return gpsActive ? "GPS ativo sem visita em execucao" : "Sem GPS ativo neste momento";
}

// Distância real em metros pela fórmula de Haversine.
function distanceMeters(a, b) {
  const R = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const aCalc =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
  return R * c;
}

function canSendArrivalAlert(client) {
  return client?.arrivalAllowed === true && client?.arrivalNotify === true;
}

function getTargetCoordinatesFromPool(pool) {
  const targetLatitude = pool?.latitude ?? pool?.client?.latitude ?? null;
  const targetLongitude = pool?.longitude ?? pool?.client?.longitude ?? null;

  if (targetLatitude === null || targetLatitude === undefined || targetLongitude === null || targetLongitude === undefined) {
    return null;
  }

  const lat = Number(targetLatitude);
  const lng = Number(targetLongitude);

  if (!isValidCoordinate(lat, lng)) return null;

  return { lat, lng };
}

async function safeAuditTrail(data) {
  try {
    await prisma.auditTrail.create({
      data: {
        eventType: data.eventType || "GPS",
        entity: data.entity || null,
        entityId: data.entityId || null,
        userId: data.userId || null,
        technicianId: data.technicianId || null,
        clientId: data.clientId || null,
        poolId: data.poolId || null,
        visitId: data.visitId || null,
        vehicleId: data.vehicleId || null,
        action: data.action,
        message: data.message || null,
        metadata: data.metadata || undefined,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null
      }
    });
  } catch (err) {
    logger.warn("Falha ao gravar AuditTrail GPS", err.message);
  }
}

async function registerTelemetry({ userId, technicianId, vehicleId, latitude, longitude, trackingMode, batteryLevel, accuracyM }) {
  const mode = trackingMode || "PASSIVE";

  await safeAuditTrail({
    eventType: "GPS_TELEMETRY",
    entity: "TechnicianLocation",
    userId,
    technicianId,
    vehicleId,
    action: `GPS_TELEMETRY_${mode}`,
    message: `Telemetria GPS recebida em modo ${mode}`,
    metadata: {
      trackingMode: mode,
      batteryLevel: batteryLevel ?? null,
      accuracyM: accuracyM ?? null,
      timestamp: new Date().toISOString()
    },
    latitude,
    longitude
  });
}

async function processGpsUpdate(payload) {
  const userId = toNumber(payload.userId ?? payload.technicianId);
  const technicianId = payload.technicianDbId ? toNumber(payload.technicianDbId) : null;
  const vehicleId = payload.vehicleId ? toNumber(payload.vehicleId) : null;
  const latitude = toNumber(payload.latitude);
  const longitude = toNumber(payload.longitude);
  const batteryLevel = payload.batteryLevel !== undefined ? toNumber(payload.batteryLevel) : null;
  const accuracyM = payload.accuracyM !== undefined ? toNumber(payload.accuracyM) : null;
  const trackingMode = payload.trackingMode || payload.mode || "PASSIVE";

  if (!userId || !isValidCoordinate(latitude, longitude)) {
    return {
      statusCode: 200,
      body: {
        ok: false,
        success: false,
        code: "ANTI_JUMP_TRIGGERED",
        message: "Filtro geográfico rejeitou leitura ruidosa ou incompleta de hardware."
      }
    };
  }

  const userExists = await prisma.user.findUnique({ where: { id: userId } });

  if (global.io) {
    global.io.emit("gps-update", {
      id: userId,
      name: userExists?.name || "Técnico",
      latitude,
      longitude,
      trackingMode,
      batteryLevel
    });
  }

  if (userExists) {
    await prisma.technicianLocation.upsert({
      where: { userId },
      update: { latitude, longitude },
      create: { userId, latitude, longitude }
    });

    await prisma.technicianTrack.create({
      data: { userId, latitude, longitude }
    });
  }

  await registerTelemetry({ userId, technicianId, vehicleId, latitude, longitude, trackingMode, batteryLevel, accuracyM });

  const pools = await prisma.pool.findMany({
    where: { active: true },
    include: { client: true }
  });

  for (const pool of pools) {
    if (!pool.client || !canSendArrivalAlert(pool.client)) continue;

    const target = getTargetCoordinatesFromPool(pool);
    if (!target) continue;

    const d = distanceMeters({ lat: latitude, lng: longitude }, target);

    if (d < ARRIVAL_RADIUS_METERS) {
      const key = `${userId}_${pool.id}`;
      const previous = lastAlerts[key] || 0;
      const now = Date.now();

      if (now - previous < ARRIVAL_ALERT_COOLDOWN_MS) {
        continue;
      }

      lastAlerts[key] = now;
      const message = `Técnico chegou a ${pool.name || "Piscina"} (${pool.client.name})`;

      try {
        const notification = await prisma.notification.create({
          data: {
            userId: userExists ? userId : null,
            clientId: pool.client.id,
            message,
            type: "ARRIVAL"
          }
        });

        if (global.io) {
          global.io.emit("new-notification", {
            id: notification.id,
            message: notification.message,
            type: notification.type,
            createdAt: notification.createdAt,
            isRead: false,
            client: pool.client.name,
            technician: userExists?.name || ""
          });
        }
      } catch (err) {
        logger.warn("Falha ao criar notificação de chegada", err.message);
      }

      return {
        statusCode: 200,
        body: {
          ok: true,
          success: true,
          arrivalAlert: true,
          message,
          distance: d
        }
      };
    }
  }

  return {
    statusCode: 200,
    body: {
      ok: true,
      success: true,
      arrivalAlert: false
    }
  };
}

// ==========================================================
// 1. ENDPOINT: COLETA E REGISTO DE COORDENADAS DE TELEMETRIA
// Rotas compatíveis: POST /api/gps/update e POST /api/gps/ping
// ==========================================================

router.post(["/update", "/ping"], async (req, res) => {
  try {
    const result = await processGpsUpdate(req.body || {});
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    logger.error("Erro GPS update/ping", err);
    return res.status(200).json({
      ok: false,
      success: false,
      degradedMode: true,
      message: "Modo degradado ativo. Telemetria retida no dispositivo para retry."
    });
  }
});

// ==========================================================
// 2. ENDPOINT: VALIDAÇÃO DE GEOFENCE REAL POR PISCINA/CLIENTE
// Rota: POST /api/gps/validate-geofence
// ==========================================================

router.post("/validate-geofence", async (req, res) => {
  const visitId = toNumber(req.body.visitId);
  const currentLatitude = toNumber(req.body.currentLatitude ?? req.body.latitude);
  const currentLongitude = toNumber(req.body.currentLongitude ?? req.body.longitude);

  if (!visitId || !isValidCoordinate(currentLatitude, currentLongitude)) {
    return res.status(400).json({
      success: false,
      error: "Parâmetros para validação de Geofencing insuficientes ou inválidos."
    });
  }

  try {
    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        pool: {
          include: { client: true }
        }
      }
    });

    if (!visit) {
      return res.status(404).json({ success: false, error: "Visita não encontrada." });
    }

    const target = getTargetCoordinatesFromPool(visit.pool);

    if (!target) {
      await safeAuditTrail({
        eventType: "GPS_GEOFENCE",
        entity: "ServiceVisit",
        entityId: visitId,
        technicianId: visit.technicianId || null,
        clientId: visit.clientId || visit.pool?.clientId || null,
        poolId: visit.poolId || null,
        visitId,
        action: "GEOFENCE_TARGET_MISSING",
        message: `Visita ${visitId} sem coordenadas alvo configuradas na piscina ou cliente.`,
        latitude: currentLatitude,
        longitude: currentLongitude
      });

      return res.status(200).json({
        success: true,
        inside: true,
        degradedMode: true,
        message: "Coordenadas da piscina/cliente em falta. Operação autorizada em modo degradado com auditoria."
      });
    }

    const distance = distanceMeters(
      { lat: currentLatitude, lng: currentLongitude },
      target
    );

    const inside = distance <= GEOFENCE_RADIUS_METERS;

    await safeAuditTrail({
      eventType: "GPS_GEOFENCE",
      entity: "ServiceVisit",
      entityId: visitId,
      technicianId: visit.technicianId || null,
      clientId: visit.clientId || visit.pool?.clientId || null,
      poolId: visit.poolId || null,
      visitId,
      action: inside ? "GEOFENCE_SUCCESS" : "GEOFENCE_MISMATCH",
      message: inside
        ? `Presença validada dentro do raio operacional. Distância: ${distance.toFixed(2)}m.`
        : `Tentativa fora do raio operacional. Distância: ${distance.toFixed(2)}m.`,
      metadata: {
        distanceMeters: distance,
        radiusMeters: GEOFENCE_RADIUS_METERS,
        targetLatitude: target.lat,
        targetLongitude: target.lng
      },
      latitude: currentLatitude,
      longitude: currentLongitude
    });

    if (inside) {
      await prisma.serviceVisit.update({
        where: { id: visitId },
        data: {
          status: visit.status === "PLANNED" ? "IN_PROGRESS" : visit.status,
          startAt: visit.startAt || new Date()
        }
      }).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      inside,
      distance,
      radius: GEOFENCE_RADIUS_METERS,
      message: inside
        ? "Presença física confirmada dentro do raio operacional do cliente."
        : "Aviso: localização atual diverge do raio geométrico cadastrado na piscina/cliente."
    });
  } catch (err) {
    logger.error(`Falha no motor de Geofencing para a visita ${visitId}`, err);

    await safeAuditTrail({
      eventType: "GPS_GEOFENCE",
      entity: "Visit",
      entityId: visitId,
      visitId,
      action: "GEOFENCE_DEGRADED_MODE",
      message: `Falha no motor espacial. Operação autorizada em modo degradado. Erro: ${err.message}`,
      latitude: currentLatitude,
      longitude: currentLongitude
    });

    return res.status(200).json({
      success: true,
      inside: true,
      degradedMode: true,
      message: "Serviço de validação espacial indisponível. Operação autorizada em modo degradado de emergência."
    });
  }
});

// ==========================================================
// POSIÇÕES ATUAIS
// ==========================================================

router.get("/live", async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [locations, technicians, visits] = await Promise.all([
      prisma.technicianLocation.findMany({
        include: { user: true, technician: true },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.technician.findMany({
        where: { active: true, deletedAt: null },
        include: { vehicle: true },
        orderBy: { name: "asc" }
      }).catch(() => []),
      prisma.serviceVisit.findMany({
        where: {
          OR: [
            { plannedDate: { gte: todayStart, lte: todayEnd } },
            { date: { gte: todayStart, lte: todayEnd } },
            { status: { in: ["IN_PROGRESS", "A_CAMINHO", "ON_ROUTE", "STARTED", "EM_EXECUCAO"] } }
          ]
        },
        include: { client: true, pool: true, technician: true },
        orderBy: [{ plannedDate: "asc" }, { date: "asc" }, { createdAt: "asc" }]
      }).catch(() => [])
    ]);

    const locationByTechId = new Map();
    const locationByUserEmail = new Map();
    const consumedLocationIds = new Set();

    for (const location of locations) {
      if (location.technicianId && !locationByTechId.has(location.technicianId)) {
        locationByTechId.set(location.technicianId, location);
      }
      if (location.user?.email && !locationByUserEmail.has(String(location.user.email).toLowerCase())) {
        locationByUserEmail.set(String(location.user.email).toLowerCase(), location);
      }
    }

    const visitsByTechnician = new Map();
    for (const visit of visits.filter((item) => openVisitStatus(item.status))) {
      if (!visit.technicianId) continue;
      const list = visitsByTechnician.get(visit.technicianId) || [];
      list.push(visit);
      visitsByTechnician.set(visit.technicianId, list);
    }

    const rows = technicians.map((technician) => {
      const location =
        locationByTechId.get(technician.id) ||
        (technician.email ? locationByUserEmail.get(String(technician.email).toLowerCase()) : null) ||
        null;

      if (location?.id) consumedLocationIds.add(location.id);

      const techVisits = visitsByTechnician.get(technician.id) || [];
      const currentVisit = techVisits.find((visit) => activeVisitStatus(visit.status)) || null;
      const nextVisit = techVisits.find((visit) => !activeVisitStatus(visit.status)) || null;
      const latitude = location?.latitude ?? null;
      const longitude = location?.longitude ?? null;
      const gpsActive = isValidCoordinate(Number(latitude), Number(longitude)) && isGpsFresh(location?.updatedAt);

      return {
        id: technician.id,
        userId: location?.userId || null,
        technicianId: technician.id,
        name: technician.name || location?.user?.name || "Tecnico",
        email: technician.email || location?.user?.email || null,
        phone: technician.phone || null,
        vehicle: technician.vehicle ? {
          id: technician.vehicle.id,
          plate: technician.vehicle.plate,
          name: technician.vehicle.name,
          status: technician.vehicle.status
        } : null,
        latitude,
        longitude,
        updatedAt: location?.updatedAt || null,
        gpsActive,
        status: currentVisit ? "BUSY" : gpsActive ? "AVAILABLE" : "OFFLINE",
        currentVisit: visitSummary(currentVisit),
        nextVisit: visitSummary(nextVisit),
        actionText: actionTextForTechnician({
          currentVisit: visitSummary(currentVisit),
          nextVisit: visitSummary(nextVisit),
          gpsActive
        })
      };
    });

    for (const location of locations) {
      if (location.id && consumedLocationIds.has(location.id)) continue;
      const latitude = location.latitude ?? null;
      const longitude = location.longitude ?? null;
      const gpsActive = isValidCoordinate(Number(latitude), Number(longitude)) && isGpsFresh(location.updatedAt);
      rows.push({
        id: location.userId || location.technicianId,
        userId: location.userId || null,
        technicianId: location.technicianId || null,
        name: location.user?.name || location.technician?.name || "Tecnico",
        email: location.user?.email || null,
        phone: null,
        vehicle: null,
        latitude,
        longitude,
        updatedAt: location.updatedAt,
        gpsActive,
        status: gpsActive ? "AVAILABLE" : "OFFLINE",
        currentVisit: null,
        nextVisit: null,
        actionText: gpsActive ? "GPS ativo sem ficha de tecnico associada" : "Sem GPS ativo neste momento"
      });
    }

    return res.json(rows);
  } catch (err) {
    logger.warn("Falha ao carregar posicoes live enriquecidas", err.message);
    return res.json([]);
  }
});

router.get("/live-legacy", async (req, res) => {
  try {
    const data = await prisma.technicianLocation.findMany({
      include: { user: true, technician: true }
    });

    return res.json(data.map(t => ({
      id: t.userId || t.technicianId,
      name: t.user?.name || t.technician?.name || "Técnico",
      latitude: t.latitude,
      longitude: t.longitude,
      updatedAt: t.updatedAt
    })));
  } catch (err) {
    logger.warn("Falha ao carregar posições live", err.message);
    return res.json([]);
  }
});

// ==========================================================
// HISTÓRICO GPS
// ==========================================================

router.get("/history/:id", async (req, res) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) return res.json([]);

    const data = await prisma.technicianTrack.findMany({
      where: { userId: id },
      orderBy: { createdAt: "asc" }
    });

    return res.json(data);
  } catch (err) {
    logger.warn("Falha ao carregar histórico GPS", err.message);
    return res.json([]);
  }
});

module.exports = router;
