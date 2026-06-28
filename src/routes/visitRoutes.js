const express = require("express");

const router = express.Router();

const { prisma } =
  require("../prismaClient");

const multer = require("multer");
const { completeServiceVisit, VisitCompletionError } = require("../services/serviceVisitCompletionService");
const {
  buildServiceVisitDayQuery,
  toPositiveInt
} = require("../utils/serviceVisitFilters");

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

// ======================================================
// TODAY VISITS
// ======================================================

router.get("/today", async (req, res) => {

  try {
    const dayQuery =
      buildServiceVisitDayQuery(req.query || {});

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
        }
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
    const visitId = Number(req.params.id);
    if (!Number.isInteger(visitId) || visitId <= 0) {
      return res.status(400).json({
        ok: false,
        error: "ID de visita invalido"
      });
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        client: true,
        technician: true,
        pool: {
          include: {
            client: true,
            equipment: true,
            technicalRoom: true
          }
        },
        photos: true,
        chemicals: true,
        attachments: true
      }
    });

    if (!visit) {
      return res.status(404).json({
        ok: false,
        error: "Visita nao encontrada"
      });
    }

    return res.json({
      ok: true,
      visit
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
    const scheduledAt =
      plannedDate ? new Date(plannedDate) : new Date();
    const shouldStartNow =
      startNow === true || String(startNow || "").toLowerCase() === "true";

    const visit =
      await prisma.serviceVisit.create({

        data: {

          poolId:
            Number(poolId),

          technicianId:
            parsedTechnicianId,

          technicianName:
            technicianName || "Tecnico",

          plannedDate:
            Number.isNaN(scheduledAt.getTime()) ? new Date() : scheduledAt,

          date:
            Number.isNaN(scheduledAt.getTime()) ? new Date() : scheduledAt,

          status:
            shouldStartNow ? "IN_PROGRESS" : "PLANNED",

          startAt:
            shouldStartNow ? new Date() : null
        }
      });

    return res.json({

      ok: true,

      visit
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

  return res.redirect(307, `/api/core/visits/${visitId}/complete`);
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

      if (!req.file){

        return res.json({

          ok: false,

          message:
            "Sem ficheiro"
        });
      }

      const type =
        req.body.type || "AFTER";

      const photo =
        await prisma.visitPhoto.create({

          data: {

            visitId:
              Number(req.params.id),

            url:
              `/uploads/${req.file.filename}`,

            type
          }
        });

      return res.json({

        ok: true,

        photo
      });

    } catch (err) {

      console.error(err);

      return res.json({

        ok: false
      });
    }
  }
);

// ======================================================
// FIELD PROBLEM ALERT
// ======================================================

router.post("/alert", async (req, res) => {

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

    const visit =
      await prisma.serviceVisit.findUnique({
        where: {
          id: Number(visitId)
        },
        include: {
          pool: {
            include: {
              client: true
            }
          }
        }
      });

    if (!visit || !visit.poolId){

      return res.status(404).json({
        ok: false,
        error: "Visita ou piscina não encontrada"
      });
    }

    const finalPriority =
      priority || "NORMAL";

    const repair =
      await prisma.repair.create({
        data: {
          poolId: visit.poolId,
          problem: String(message),
          status: "PENDING",
          priority: finalPriority,
          notes: `Reportado pelo técnico em campo na visita #${visit.id}.`
        }
      });

    const technicalAlert =
      await prisma.technicalAlert.create({
        data: {
          poolId: visit.poolId,
          type: type || "FIELD_PROBLEM",
          message: String(message),
          priority: finalPriority,
          status: "OPEN"
        }
      }).catch(() => null);

    const notification =
      await prisma.notification.create({
        data: {
          clientId: visit.pool?.client?.id || null,
          type: finalPriority === "HIGH" ? "CRITICAL" : "ALERT",
          eventType: "FIELD_PROBLEM_REPORTED",
          title: "Problema reportado pelo técnico",
          message: `${visit.pool?.name || "Piscina"} - ${message}`,
          role: "ADMIN",
          severity: finalPriority,
          metadata: {
            visitId: visit.id,
            poolId: visit.poolId,
            repairId: repair.id,
            alertId: technicalAlert?.id || null
          }
        }
      }).catch(() => null);

    if (global.io && notification){

      global.io.emit(
        "new-notification",
        {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          createdAt: notification.createdAt,
          clientId: notification.clientId
        }
      );
    }

    return res.json({
      ok: true,
      repair,
      alert: technicalAlert,
      notification
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ======================================================

module.exports = router;
