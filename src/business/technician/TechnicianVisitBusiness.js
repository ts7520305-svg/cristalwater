const { prisma } = require("../../prismaClient");
const { completeServiceVisit } = require("../../services/serviceVisitCompletionService");
const RepairBusiness = require("../repair/RepairBusiness");
const { emitRouteStopStarted } = require("../../services/routeOsEventService");
const { toPublicUploadUrl } = require("../../config/uploadPath");

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function buildOperationalContext(visit) {
  const client = visit?.client || visit?.pool?.client || null;
  const pool = visit?.pool || {};
  const technicalSheet = pool.technicalSheet || null;
  const openAlerts = Array.isArray(pool.technicalAlerts) ? pool.technicalAlerts : [];

  return {
    customer: client
      ? {
          id: client.id,
          name: client.name || null,
          email: client.email || null,
          phone: client.phone || null,
          zone: client.zone || null,
        }
      : null,
    pool: pool
      ? {
          id: pool.id || null,
          name: pool.name || null,
          location: pool.location || null,
          address: pool.address || null,
          zone: pool.zone || null,
        }
      : null,
    permanentNotes: pool.notes || null,
    temporaryNotes: visit?.internalNotes || null,
    chemistryTargets: technicalSheet
      ? {
          ph: { min: technicalSheet.targetPhMin ?? null, max: technicalSheet.targetPhMax ?? null },
          chlorine: { min: technicalSheet.targetChlorineMin ?? null, max: technicalSheet.targetChlorineMax ?? null },
          alkalinity: { min: technicalSheet.targetAlkalinityMin ?? null, max: technicalSheet.targetAlkalinityMax ?? null },
          orpMinMv: technicalSheet.targetOrpMinMv ?? null,
        }
      : null,
    temporaryAlerts: openAlerts,
    equipment: pool.equipment || null,
    technicalRoom: pool.technicalRoom || null,
    photosCount: Array.isArray(visit?.photos) ? visit.photos.length : 0,
    chemistryCount: Array.isArray(visit?.chemicals) ? visit.chemicals.length : 0,
    alertsCount: openAlerts.length,
  };
}

function appendInternalNote(existing, line) {
  return [existing, line].filter(Boolean).join("\n").slice(-6000);
}

function emitVisitRefresh(visitId, payload = {}) {
  if (!global.io) return;

  global.io.emit("dashboard-refresh", {
    source: payload.source || "VISIT_ACTION",
    visitId,
    poolId: payload.poolId || null,
  });

  global.io.emit("visit-updated", {
    visitId,
    poolId: payload.poolId || null,
    type: payload.source || "VISIT_ACTION",
  });
}

async function getVisitForOperations(visitId) {
  const id = toInt(visitId);
  if (!id) {
    return { ok: false, status: 400, error: "ID inválido" };
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
    include: {
      client: true,
      pool: {
        include: {
          client: true,
          equipment: true,
          technicalRoom: true,
          technicalSheet: true,
        },
      },
    },
  });

  if (!visit) {
    return { ok: false, status: 404, error: "Visita não encontrada" };
  }

  return { ok: true, visit };
}

async function getTodayVisits() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const visits = await prisma.serviceVisit.findMany({
    where: {
      plannedDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      client: true,
      pool: true,
      chemicals: true,
      photos: true,
    },
    orderBy: [{ plannedDate: "asc" }, { id: "asc" }],
  });

  return {
    ok: true,
    visits,
  };
}

async function listVisits() {
  const visits = await prisma.serviceVisit.findMany({
    include: {
      client: true,
      pool: true,
      chemicals: true,
      photos: true,
    },
    orderBy: [{ plannedDate: "desc" }, { id: "desc" }],
  });

  return {
    ok: true,
    visits,
  };
}

async function getVisitById(visitId) {
  const id = toInt(visitId);

  if (!id) {
    return { ok: false, status: 400, error: "ID inválido" };
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
    include: {
      client: true,
      pool: {
        include: {
          equipment: true,
          technicalRoom: true,
          technicalSheet: true,
          calculationProfile: true,
          technicalAlerts: {
            where: { status: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          technicalHistory: {
            orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
            take: 20,
          },
        },
      },
      chemicals: true,
      photos: true,
    },
  });

  if (!visit) {
    return { ok: false, status: 404, error: "Visita não encontrada" };
  }

  return {
    ok: true,
    visit,
    context: buildOperationalContext(visit),
  };
}

async function createVisit(payload = {}) {
  const clientId = toInt(payload.clientId);
  const poolId = toInt(payload.poolId);

  if (!clientId || !poolId) {
    return { ok: false, status: 400, error: "clientId e poolId são obrigatórios" };
  }

  const plannedDate = payload.plannedDate ? new Date(payload.plannedDate) : new Date();

  const created = await prisma.serviceVisit.create({
    data: {
      clientId,
      poolId,
      technicianName: payload.technicianName || null,
      plannedDate,
      status: "PLANNED",
      notes: payload.notes || null,
      internalNotes: payload.internalNotes || null,
    },
    include: {
      client: true,
      pool: true,
    },
  });

  return {
    ok: true,
    visit: created,
  };
}

async function recordVisitObservation(visitId, payload = {}) {
  const loaded = await getVisitForOperations(visitId);
  if (!loaded.ok) return loaded;

  const visit = loaded.visit;
  const observation = String(payload.observation || payload.notes || "").trim();
  const internalNotes = payload.internalNotes !== undefined ? String(payload.internalNotes || "").trim() : observation;

  const updated = await prisma.serviceVisit.update({
    where: { id: visit.id },
    data: {
      notes: observation || undefined,
      internalNotes: internalNotes ? appendInternalNote(visit.internalNotes, internalNotes) : undefined,
    },
    include: {
      client: true,
      technician: true,
      pool: {
        include: {
          client: true,
          equipment: true,
          technicalRoom: true,
          technicalSheet: true,
          technicalAlerts: {
            where: { status: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          technicalHistory: {
            orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
            take: 20,
          },
        },
      },
      photos: true,
      chemicals: true,
      attachments: true,
    },
  });

  await prisma.auditTrail?.create?.({
    data: {
      eventType: "VISIT_OBSERVATION_RECORDED",
      entity: "ServiceVisit",
      entityId: updated.id,
      visitId: updated.id,
      poolId: updated.poolId,
      clientId: updated.clientId || updated.pool?.client?.id || null,
      action: "VISIT_OBSERVATION_RECORDED",
      message: `Observação registada na visita #${updated.id}.`,
      metadata: {
        observation: observation || null,
      },
    },
  }).catch(() => null);

  emitVisitRefresh(updated.id, { source: "VISIT_OBSERVATION_RECORDED", poolId: updated.poolId });

  return {
    ok: true,
    visit: updated,
  };
}

async function recordVisitPhoto(visitId, file, type = "AFTER") {
  const loaded = await getVisitForOperations(visitId);
  if (!loaded.ok) return loaded;

  if (!file) {
    return { ok: false, status: 400, error: "Sem ficheiro" };
  }

  const photo = await prisma.visitPhoto.create({
    data: {
      visitId: loaded.visit.id,
      url: toPublicUploadUrl(file.filename),
      type: type || "AFTER",
    },
  });

  await prisma.auditTrail?.create?.({
    data: {
      eventType: "VISIT_PHOTO_UPLOADED",
      entity: "VisitPhoto",
      entityId: photo.id,
      visitId: loaded.visit.id,
      poolId: loaded.visit.poolId,
      clientId: loaded.visit.clientId || loaded.visit.pool?.client?.id || null,
      action: "VISIT_PHOTO_UPLOAD",
      message: `Foto registada para a visita #${loaded.visit.id}.`,
      metadata: { type: type || "AFTER", url: photo.url },
    },
  }).catch(() => null);

  emitVisitRefresh(loaded.visit.id, { source: "VISIT_PHOTO_UPLOADED", poolId: loaded.visit.poolId });

  return {
    ok: true,
    photo,
  };
}

async function recordVisitIncident({ visitId, message, type, priority }) {
  const loaded = await getVisitForOperations(visitId);
  if (!loaded.ok) return loaded;

  const trimmedMessage = String(message || "").trim();
  if (!trimmedMessage) {
    return { ok: false, status: 400, error: "Mensagem obrigatória" };
  }

  const finalPriority = priority || "NORMAL";

  const repairResult = await RepairBusiness.createRepairTicket(
    {
      poolId: loaded.visit.poolId,
      problem: trimmedMessage,
      status: "PENDING",
      priority: finalPriority,
      notes: `Reportado pelo técnico em campo na visita #${loaded.visit.id}.`,
    },
    `visit-${loaded.visit.id}`,
    null,
    {
      context: {
        pool: loaded.visit.pool,
        clientId: loaded.visit.pool?.client?.id || null,
      },
      source: "visit-incident",
      contextNotes: `Incidente técnico registado na visita #${loaded.visit.id}.`,
    }
  );

  const repair = repairResult.repair;
  const technicalAlert = await prisma.technicalAlert.create({
    data: {
      poolId: loaded.visit.poolId,
      type: type || "FIELD_PROBLEM",
      message: trimmedMessage,
      priority: finalPriority,
      status: "OPEN",
    },
  }).catch(() => null);

  const notification = await prisma.notification.create({
    data: {
      clientId: loaded.visit.pool?.client?.id || null,
      type: finalPriority === "HIGH" ? "CRITICAL" : "ALERT",
      eventType: "FIELD_PROBLEM_REPORTED",
      title: "Problema reportado pelo técnico",
      message: `${loaded.visit.pool?.name || "Piscina"} - ${trimmedMessage}`,
      role: "ADMIN",
      severity: finalPriority,
      metadata: {
        visitId: loaded.visit.id,
        poolId: loaded.visit.poolId,
        repairId: repair.id,
        alertId: technicalAlert?.id || null,
      },
    },
  }).catch(() => null);

  emitVisitRefresh(loaded.visit.id, { source: "VISIT_FIELD_ALERT", poolId: loaded.visit.poolId });

  return {
    ok: true,
    repair,
    alert: technicalAlert,
    notification,
  };
}

async function startVisit(visitId) {
  const id = toInt(visitId);

  if (!id) {
    return { ok: false, status: 400, error: "ID inválido" };
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
  });

  if (!visit) {
    return { ok: false, status: 404, error: "Visita não encontrada" };
  }

  const updated = await prisma.serviceVisit.update({
    where: { id },
    data: {
      startAt: new Date(),
      status: "IN_PROGRESS",
    },
  });

  emitRouteStopStarted({
    visitId: updated.id,
    technicianId: updated.technicianId || null,
    poolId: updated.poolId || null,
    plannedDate: updated.plannedDate || updated.date || null,
    source: "visit.start",
  }).catch((error) => console.warn("ROUTE_STOP_STARTED emit failed:", error.message));

  return {
    ok: true,
    visit: updated,
  };
}

async function completeVisit(visitId, body = {}) {
  const id = toInt(visitId);

  if (!id) {
    return { ok: false, status: 400, error: "ID inválido" };
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
  });

  if (!visit) {
    return { ok: false, status: 404, error: "Visita não encontrada" };
  }

  const result = await completeServiceVisit(prisma, id, body);

  return {
    ok: true,
    visit: result.visit,
    repair: result.repair,
    notifications: result.notifications,
  };
}

async function markVisitNotDone({ visitId, notes, internalNotes }) {
  const id = toInt(visitId);

  if (!id) {
    return { ok: false, status: 400, error: "ID inválido" };
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
    include: {
      client: true,
      pool: {
        include: {
          client: true,
        },
      },
    },
  });

  if (!visit) {
    return { ok: false, status: 404, error: "Visita não encontrada" };
  }

  const reason = String(notes || "").trim();
  const internalReason = String(internalNotes || reason || "").trim();

  if (!reason) {
    return { ok: false, status: 400, error: "Motivo obrigatório" };
  }

  const status = String(visit.status || "").trim().toUpperCase();
  if (status === "NOT_DONE") {
    return {
      ok: true,
      visit,
      idempotent: true,
    };
  }

  if (["DONE", "CLOSED", "CANCELLED", "CANCELED", "FAILED"].includes(status) || visit.endAt) {
    return { ok: false, status: 409, error: "Visita já fechada e não pode ser marcada como não feita" };
  }

  const updated = await prisma.serviceVisit.update({
    where: { id },
    data: {
      status: "NOT_DONE",
      reason,
      notes: reason,
      internalNotes: appendInternalNote(visit.internalNotes, internalReason),
      endAt: new Date(),
    },
  });

  await prisma.auditTrail?.create?.({
    data: {
      eventType: "VISIT_MARKED_NOT_DONE",
      entity: "ServiceVisit",
      entityId: updated.id,
      visitId: updated.id,
      poolId: updated.poolId || null,
      clientId: updated.clientId || visit.pool?.client?.id || null,
      action: "VISIT_NOT_DONE",
      message: `Visita #${updated.id} marcada como não feita.`,
      metadata: {
        reason,
      },
    },
  }).catch(() => null);

  if (updated.poolId) {
    await prisma.technicalHistory?.create?.({
      data: {
        poolId: updated.poolId,
        type: "VISIT_NOT_DONE",
        component: "Service Visit",
        message: "Visita marcada como não realizada",
        description: JSON.stringify({ visitId: updated.id, reason }),
        status: "NOT_DONE",
        performedAt: new Date(),
        doneAt: new Date(),
      },
    }).catch(() => null);
  }

  emitVisitRefresh(updated.id, { source: "VISIT_NOT_DONE", poolId: updated.poolId });

  return {
    ok: true,
    visit: updated,
    idempotent: false,
  };
}

async function createAlert({ visitId, message }) {
  return recordVisitIncident({ visitId, message });
}

module.exports = {
  getTodayVisits,
  listVisits,
  getVisitById,
  createVisit,
  startVisit,
  completeVisit,
  markVisitNotDone,
  recordVisitObservation,
  recordVisitPhoto,
  recordVisitIncident,
  createAlert,
};
