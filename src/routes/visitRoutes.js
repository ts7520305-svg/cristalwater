const express = require("express");

const router = express.Router();

const { prisma } =
  require("../prismaClient");

const multer = require("multer");
const TechnicianVisitBusiness = require("../business/technician/TechnicianVisitBusiness");
const { completeServiceVisit, VisitCompletionError } = require("../services/serviceVisitCompletionService");
const {
  buildServiceVisitDayQuery,
  toPositiveInt
} = require("../utils/serviceVisitFilters");
const auth = require("../middlewares/authMiddleware");
const { roleMatches } = require("../utils/roles");

router.use(auth("TECHNICIAN"));

// ======================================================
// UPLOAD
// ======================================================

const storage =
  multer.diskStorage({

    destination:
      (req, file, cb) => {

        cb(null, "uploads/");
      },

    filename:
      (req, file, cb) => {

        cb(
          null,
          Date.now() + "-" + file.originalname
        );
      }
  });

const upload =
  multer({ storage });

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

async function loadScopedVisit(req, visitId) {
  const id = Number(visitId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, status: 400, error: "ID de visita invalido" };
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id },
    select: {
      id: true,
      technicianId: true,
      poolId: true,
      clientId: true,
      status: true,
      endAt: true,
    },
  });

  if (!visit) {
    return { ok: false, status: 404, error: "Visita nao encontrada" };
  }

  if (roleMatches(req.user?.role, "TECHNICIAN") && !roleMatches(req.user?.role, "ADMIN")) {
    const authTechId = Number(req.user?.technicianId || req.user?.id || 0);
    if (!authTechId || Number(visit.technicianId || 0) !== authTechId) {
      return { ok: false, status: 403, error: "Acesso negado" };
    }
  }

  return { ok: true, visit };
}

// ======================================================
// TODAY VISITS
// ======================================================

router.get("/today", async (req, res) => {

  try {
    const scopedQuery = { ...(req.query || {}) };
    if (roleMatches(req.user?.role, "TECHNICIAN") && !roleMatches(req.user?.role, "ADMIN")) {
      scopedQuery.technicianId = req.user?.technicianId || req.user?.id;
    }
    const dayQuery =
      buildServiceVisitDayQuery(scopedQuery);

    const take = Math.min(toPositiveInt(req.query?.limit) || 200, 300);

    const visits =
      await prisma.serviceVisit.findMany({

        where:
          dayQuery.where,

        include: {

          technician: true,

          pool: {

            include: {

              client: true
            }
          },

          photos: true
        },

        orderBy: {

          plannedDate: "asc"
        },

        take
      });

    const formatted =
      visits.map(v => ({

        id: v.id,

        technicianName:
          v.technician?.name || v.technicianName,

        technicianId:
          v.technicianId,

        plannedDate:
          v.plannedDate || v.date || v.startAt || v.endAt,

        startAt:
          v.startAt,

        endAt:
          v.endAt,

        ph:
          v.ph,

        chlorine:
          v.chlorine,

        alkalinity:
          v.alkalinity,

        salt:
          v.salt,

        notes:
          v.notes,

        products:
          v.products,

        photos:
          v.photos || [],

        status:
          v.endAt
            ? "DONE"
            : v.status || "IN_PROGRESS",

        pool: {

          id:
            v.pool?.id,

          name:
            v.pool?.name || "-",

          latitude:
            v.pool?.latitude || 0,

          longitude:
            v.pool?.longitude || 0
        },

        client: {

          id:
            v.pool?.client?.id,

          name:
            v.pool?.client?.name || "-"
        }
      }));

    return res.json({

      ok: true,

      total:
        formatted.length,

      date:
        dayQuery.isoDate,

      technicianId:
        dayQuery.technicianId,

      visits:
        formatted
    });

  } catch (err) {

    console.error(err);

    return res.json({

      ok: false
    });
  }
});

// ======================================================
// VISIT DETAIL
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const scoped = await loadScopedVisit(req, req.params.id);
    if (!scoped.ok) {
      return res.status(scoped.status).json({ ok: false, error: scoped.error });
    }

    const result = await TechnicianVisitBusiness.getVisitById(scoped.visit.id);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    return res.json({
      ok: true,
      visit: result.visit,
      context: result.context,
    });
  } catch (err) {
    console.error("visit detail error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Erro ao obter visita"
    });
  }
});

// ======================================================
// START VISIT
// ======================================================

router.post("/start", async (req, res) => {

  try {

    const {
      poolId,
      technicianId,
      technicianName,
      plannedDate,
      startNow
    } = req.body;

    if (!poolId){

      return res.json({

        ok: false,

        message:
          "Pool obrigatória"
      });
    }

    const parsedTechnicianId =
      toPositiveInt(technicianId);
    const parsedRoundId =
      toPositiveInt(req.body?.roundId);
    const scheduledAt =
      plannedDate ? new Date(plannedDate) : new Date();
    const shouldStartNow =
      startNow === true || String(startNow || "").toLowerCase() === "true";

    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        ok: false,
        message: "Data planeada inválida",
      });
    }

    const dedupeWindowMs = 60 * 1000;
    const windowStart = new Date(scheduledAt.getTime() - dedupeWindowMs);
    const windowEnd = new Date(scheduledAt.getTime() + dedupeWindowMs);
    const poolLockKey = Number(poolId) || 0;
    const slotBucket = Math.floor(scheduledAt.getTime() / 60000);
    const techBucket = (parsedTechnicianId || 0) % 100000;
    const roundBucket = (parsedRoundId || 0) % 100000;
    const slotLockKey = Number((slotBucket + techBucket * 101 + roundBucket * 1009) % 2147483647);
    const lockKey = Number(poolLockKey) * 2147483647 + Number(slotLockKey);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(CAST(${lockKey} AS bigint))`;

      const existingVisit = await tx.serviceVisit.findFirst({
        where: {
          poolId: Number(poolId),
          technicianId: parsedTechnicianId ?? null,
          roundId: parsedRoundId ?? null,
          status: { in: ["PLANNED", "IN_PROGRESS", "OPEN", "PENDING"] },
          OR: [
            { plannedDate: { gte: windowStart, lte: windowEnd } },
            { date: { gte: windowStart, lte: windowEnd } },
          ],
        },
        orderBy: { id: "desc" },
      });

      if (existingVisit) {
        return {
          visit: existingVisit,
          idempotent: true,
        };
      }

      const poolRecord = await tx.pool.findUnique({
        where: { id: Number(poolId) },
        select: { clientId: true },
      });

      const createdVisit =
        await tx.serviceVisit.create({

          data: {

            clientId:
              poolRecord?.clientId || null,

            poolId:
              Number(poolId),

            technicianId:
              parsedTechnicianId,

            roundId:
              parsedRoundId,

            technicianName:
              technicianName || "Tecnico",

            plannedDate:
              scheduledAt,

            date:
              scheduledAt,

            status:
              shouldStartNow ? "IN_PROGRESS" : "PLANNED",

            startAt:
              shouldStartNow ? new Date() : null
          }
        });

      return {
        visit: createdVisit,
        idempotent: false,
      };
    }, { isolationLevel: "Serializable" });

    return res.json({

      ok: true,

      visit: result.visit,

      idempotent: result.idempotent,

      message: result.idempotent ? "Visita equivalente já existe (idempotente)" : undefined,
    });

  } catch (err) {

    console.error(err);

    return res.json({

      ok: false
    });
  }
});

// ======================================================
// COMPLETE VISIT
// ======================================================

router.post("/complete", (req, res) => {
  const visitId = Number(req.body?.visitId);

  if (!Number.isInteger(visitId) || visitId <= 0) {
    return res.status(400).json({
      ok: false,
      error: "visitId obrigatorio"
    });
  }

  return loadScopedVisit(req, visitId)
    .then((scoped) => {
      if (!scoped.ok) {
        return res.status(scoped.status).json({ ok: false, error: scoped.error });
      }
      return res.redirect(307, `/api/core/visits/${visitId}/complete`);
    })
    .catch((err) => {
      console.error("visit complete scope error:", err);
      return res.status(500).json({ ok: false, error: err.message || "Erro ao validar visita" });
    });
});

router.post("/:id/start", async (req, res) => {
  try {
    const result = await TechnicianVisitBusiness.startVisit(req.params.id);

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    return res.json({
      ok: true,
      visit: result.visit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message || "Erro ao iniciar visita" });
  }
});

router.post("/:id/not-done", async (req, res) => {
  try {
    const scoped = await loadScopedVisit(req, req.params.id);
    if (!scoped.ok) {
      return res.status(scoped.status).json({ ok: false, error: scoped.error });
    }

    const result = await TechnicianVisitBusiness.markVisitNotDone({
      visitId: scoped.visit.id,
      notes: req.body?.notes,
      internalNotes: req.body?.internalNotes,
    });

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    return res.json({ ok: true, visit: result.visit, idempotent: Boolean(result.idempotent) });
  } catch (err) {
    console.error("markVisitNotDone route error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Erro ao marcar visita como não feita" });
  }
});

router.post("/complete-disabled", async (req, res) => {

  try {

    const {
      visitId
    } = req.body;

    if (!visitId){

      return res.status(400).json({

        ok: false,

        message:
          "visitId obrigatório"
      });
    }

    const { visit } =
      await completeServiceVisit(
        prisma,
        Number(visitId),
        req.body || {}
      );

    // ====================================================
    // NOTIFICAÇÃO ADMIN
    // ====================================================

    const notification =
      await prisma.notification.create({

        data: {

          message:
            `Visita concluída em ${visit.poolId}`,

          type:
            "VISIT_DONE"
        }
      });

    // ====================================================
    // CLIENTE
    // ====================================================

    const fullVisit = visit;

    if (
      fullVisit?.pool?.client?.id
    ){

      const clientNotification =
        await prisma.notification.create({

          data: {

            clientId:
              fullVisit.pool.client.id,

            message:
              `Relatório disponível para ${fullVisit.pool.name}`,

            type:
              "VISIT_REPORT"
          }
        });

      if (global.io){

        global.io.emit(
          "new-notification",
          {
            id: clientNotification.id,
            message: clientNotification.message,
            type: clientNotification.type,
            createdAt: clientNotification.createdAt,
            clientId: clientNotification.clientId
          }
        );
      }
    }

    // ====================================================
    // SOCKET REALTIME ADMIN
    // ====================================================

    if (global.io){

      global.io.emit(
        "new-notification",
        {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          createdAt: notification.createdAt
        }
      );
    }

    return res.json({

      ok: true,

      visit
    });

  } catch (err) {

    console.error(err);

    if (err instanceof VisitCompletionError) {
      return res.status(err.statusCode).json({

        ok: false,

        code:
          err.code,

        error:
          err.message
      });
    }

    return res.status(500).json({

      ok: false,

      error:
        err.message || "Erro ao concluir visita"
    });
  }
});

// ======================================================
// PHOTO
// ======================================================

router.post(
  "/:id/photo",
  upload.single("photo"),

  async (req, res) => {

    try {

      const result = await TechnicianVisitBusiness.recordVisitPhoto(req.params.id, req.file, req.body.type || "AFTER");

      if (!result.ok) {
        return res.status(result.status).json({ ok: false, error: result.error });
      }

      return res.json({

        ok: true,

        photo: result.photo
      });

    } catch (err) {

      console.error(err);

      return res.json({

        ok: false
      });
    }
  }
);

router.post("/:id/observation", async (req, res) => {
  try {
    const result = await TechnicianVisitBusiness.recordVisitObservation(req.params.id, req.body || {});

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    return res.json({ ok: true, visit: result.visit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message || "Erro ao registar observação" });
  }
});

// ======================================================
// FIELD PROBLEM ALERT
// ======================================================

async function handleIncident(req, res) {

  try {

    const {
      visitId,
      message,
      type,
      priority
    } = req.body;

    if (!visitId || !message){

      return res.status(400).json({
        ok: false,
        error: "visitId e message obrigatórios"
      });
    }

    const result = await TechnicianVisitBusiness.recordVisitIncident({
      visitId,
      message,
      type,
      priority,
    });

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    return res.json({
      ok: true,
      repair: result.repair,
      alert: result.alert,
      notification: result.notification,
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}

router.post("/alert", handleIncident);
router.post("/incident", handleIncident);

// ======================================================

module.exports = router;
