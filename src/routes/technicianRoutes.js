const express = require("express");

const router = express.Router();

const { prisma } =
  require("../prismaClient");
const { createNotifications } =
  require("../services/notificationService");
const auth = require("../middlewares/authMiddleware");
const { roleMatches } = require("../utils/roles");
const { getPermissionPolicy } = require("../services/accessControlPolicyService");
const { emitRouteLoaded } =
  require("../services/routeOsEventService");
const { buildServiceVisitDayQuery } =
  require("../utils/serviceVisitFilters");
const {
  VisitCompletionError,
  validateVisitCompletionPayload
} = require("../services/serviceVisitCompletionService");

router.use(auth("TECHNICIAN"));

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function definedOnly(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function nullableValidated(body, bodyKey, validatedValue, alternateKey) {
  if (!hasOwn(body, bodyKey) && (!alternateKey || !hasOwn(body, alternateKey))) return undefined;
  return validatedValue === undefined ? null : validatedValue;
}

function appendInternalNote(existing, line) {
  return [existing, line].filter(Boolean).join("\n").slice(-6000);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizedVisitStatus(visit = {}) {
  if (visit?.endAt) return "DONE";
  return String(visit?.status || "PENDING").trim().toUpperCase();
}

function canExposeFinancialValues(user, policy) {
  const role = String(user?.role || "").trim().toUpperCase();
  if (roleMatches(role, "ADMIN") || roleMatches(role, "TEAM_LEADER")) return true;
  const rolePolicy = policy?.roles?.[role] || policy?.roles?.TECHNICIAN || null;
  const infoAccess = Array.isArray(rolePolicy?.informationAccess) ? rolePolicy.informationAccess : [];
  return infoAccess.includes("financialValues") || infoAccess.includes("invoicesPayments");
}

function waterText(value) {
  return String(value ?? "").trim();
}

function emitRealtimeNotifications(notifications, eventName = "new-notification") {
  if (!global.io) return;
  (Array.isArray(notifications) ? notifications : [notifications]).filter(Boolean).forEach((notification) => {
    global.io.emit(eventName, {
      id: notification.id,
      message: notification.message,
      title: notification.title,
      type: notification.type,
      eventType: notification.eventType,
      severity: notification.severity,
      createdAt: notification.createdAt,
      clientId: notification.clientId,
      metadata: notification.metadata || {},
    });
  });
}

// ==========================================================
// RONDA DO DIA
// ==========================================================

router.get("/today", async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const scopedQuery = { ...(req.query || {}) };
    if (roleMatches(req.user?.role, "TECHNICIAN") && !roleMatches(req.user?.role, "ADMIN")) {
      scopedQuery.technicianId = req.user?.technicianId || req.user?.id;
    }

    const dayQuery =
      buildServiceVisitDayQuery(scopedQuery);

    const { parseDailyRoutePage, dailyRoutePage } = require('../utils/dailyRoutePagination');
    const page = parseDailyRoutePage(req.query);

    const visits =
      await prisma.serviceVisit.findMany({

        where:
          dayQuery.where,

        include: {

          client: {
            include: {
              accesses: {
                where: {
                  active: true,
                  visibleToTechnician: true
                }
              },

            }
          },

          technician: {
            include: {
              vehicle: true
            }
          },

          pool: {

            include: {

              keyAccesses: {
                where: {
                  active: true,
                  visibleToTechnician: true
                }
              },

              client: {
                include: {
                  accesses: {
                    where: {
                      active: true,
                      visibleToTechnician: true
                    }
                  },

                }
              },



            }
          }

          ,

          photos: true,

          chemicals: true

        },

        orderBy: [{ plannedDate: "asc" }, { id: "asc" }]

      });

    const extraVisitWhere = {
      OR: [{scheduledAt:{gte:dayQuery.start,lt:dayQuery.end}},{startAt:{gte:dayQuery.start,lt:dayQuery.end}},{endAt:{gte:dayQuery.start,lt:dayQuery.end}}],
      status: {
        notIn: [
          "CANCELLED",
          "CANCELED",
          "CANCELADA",
          "CANCELADO",
          "ARCHIVED",
          "ARQUIVADA",
          "ARQUIVADO",
        ],
      },
      ...(dayQuery.technicianId ? { technicianId: dayQuery.technicianId } : {}),
    };

    const extraVisits = await prisma.extraVisit.findMany({
      where: extraVisitWhere,
      include: {
        photos: true,
        technician: {
          include: {
            vehicle: true,
          },
        },
        pool: {
          include: {
            keyAccesses: {
              where: {
                active: true,
                visibleToTechnician: true,
              },
            },
            client: {
              include: {
                accesses: {
                  where: {
                    active: true,
                    visibleToTechnician: true,
                  },
                },

              },
            },

          },
        },
      },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    });

    const permissionPolicy = await getPermissionPolicy().catch(() => null);
    const showFinancialValues = canExposeFinancialValues(req.user, permissionPolicy);

    const briefings = await require('../business/technician/TechnicianBriefingBusiness')
      .loadVisitBriefings([...visits, ...extraVisits]);

    const uniqueRows = (...lists) => {
      const seen = new Set();
      return lists.flat().filter(row => {
        if (!row) return false;
        const key = row.id ? `id:${row.id}` : JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const formatted =
      visits.map(v => ({

        visitType:
          "REGULAR",

        extraVisitId:
          null,

        id: v.id,
        reason: v.reason,
        returnInstructions: v.reason === "INCOMPLETE_RETURN" ? v.internalNotes : null,

        status:
          normalizedVisitStatus(v),

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

        temperature:
          v.temperature,

        orpMv:
          v.orpMv,

        notes:
          v.notes,

        internalNotes:
          v.internalNotes,

        products:
          v.products,

        chemicalsJson:
          v.chemicalsJson,

        cleaned:
          v.cleaned,

        brushed:
          v.brushed,

        vacuumed:
          v.vacuumed,

        basketCleaned:
          v.basketCleaned,

        waterlineClean:
          v.waterlineClean,

        backwashDone:
          v.backwashDone,

        photos:
          v.photos || [],

        chemicals:
          v.chemicals || [],

        technician: {
          id:
            v.technicianId,

          name:
            v.technician?.name || v.technicianName || "Tecnico",

          vehicle:
            v.technician?.vehicle
              ? {
                  id: v.technician.vehicle.id,
                  plate: v.technician.vehicle.plate,
                  name: v.technician.vehicle.name,
                  status: v.technician.vehicle.status
                }
              : null
        },

        pool: {

          id:
            v.pool?.id,

          name:
            v.pool?.name || "-",

          zone:
            v.pool?.zone || "-",

          address:
            v.pool?.address || v.pool?.location || v.pool?.zone || "-",

          latitude:
            v.pool?.latitude ?? null,

          longitude:
            v.pool?.longitude ?? null,

          notes: briefings.get(v).notes,

          keyAccesses:
            v.pool?.keyAccesses || [],

          operationalReminders:
            briefings.get(v).poolOperational,

          generalReminders:
            briefings.get(v).poolGeneral
        },

        client: {

          id:
            v.client?.id || v.pool?.client?.id,

          name:
            v.client?.name || v.pool?.client?.name || "-",

          accesses:
            uniqueRows(v.client?.accesses || [], v.pool?.client?.accesses || []),

          operationalReminders:
            briefings.get(v).clientOperational,

          generalReminders:
            briefings.get(v).clientGeneral
        }
      }));

    const formattedExtra =
      extraVisits.map(v => ({

        visitType:
          "EXTRA",

        extraVisitId:
          v.id,

        id:
          v.id,

        clientId:
          v.clientId || v.pool?.clientId || v.pool?.client?.id || null,

        poolId:
          v.poolId || v.pool?.id || null,

        technicianId:
          v.technicianId || null,

        status:
          normalizedVisitStatus(v),

        plannedDate:
          v.scheduledAt || null,

        scheduledAt:
          v.scheduledAt || null,

        ...require('../services/extraVisitExecutionService').project(v),
        notes: v.execution?.notes ?? v.notes ?? null,
        internalNotes: null,
        reason: v.source === "INCOMPLETE_RETURN" ? "INCOMPLETE_RETURN" : null,
        returnInstructions: v.source === "INCOMPLETE_RETURN" ? v.internalNote : null,
        chemicals: v.execution?.chemicalsJson || [],

        ...(showFinancialValues
          ? {
              unitPrice: v.unitPrice,
              totalPrice: v.totalPrice,
              billingMode: v.billingMode,
            }
          : {
              unitPrice: null,
              totalPrice: null,
              billingMode: null,
            }),

        technician: {
          id:
            v.technicianId,

          name:
            v.technician?.name || "Tecnico",

          vehicle:
            v.technician?.vehicle
              ? {
                  id: v.technician.vehicle.id,
                  plate: v.technician.vehicle.plate,
                  name: v.technician.vehicle.name,
                  status: v.technician.vehicle.status,
                }
              : null,
        },

        pool: {
          id:
            v.pool?.id,

          name:
            v.pool?.name || "-",

          zone:
            v.pool?.zone || "-",

          address:
            v.pool?.address || v.pool?.location || v.pool?.zone || "-",

          latitude:
            v.pool?.latitude ?? null,

          longitude:
            v.pool?.longitude ?? null,

          notes: briefings.get(v).notes,

          keyAccesses:
            v.pool?.keyAccesses || [],

          operationalReminders:
            briefings.get(v).poolOperational,

          generalReminders:
            briefings.get(v).poolGeneral,
        },

        client: {
          id:
            v.pool?.client?.id || v.clientId || null,

          name:
            v.pool?.client?.name || "-",

          accesses:
            uniqueRows(v.pool?.client?.accesses || []),

          operationalReminders:
            briefings.get(v).clientOperational,

          generalReminders:
            briefings.get(v).clientGeneral,
        },
      }));

    const dedupeMap = new Map();
    [...formatted, ...formattedExtra].forEach((visit) => {
      if (!visit) return;
      const dedupeKey = `${visit.visitType}:${visit.id}`;
      if (!dedupeMap.has(dedupeKey)) dedupeMap.set(dedupeKey, visit);
    });
    const combinedVisits = Array.from(dedupeMap.values()).sort((a, b) => {
      const left = new Date(a.plannedDate || a.scheduledAt || 0).getTime() || 0;
      const right = new Date(b.plannedDate || b.scheduledAt || 0).getTime() || 0;
      if (left !== right) return left - right;
      return Number(a.id || 0) - Number(b.id || 0) || (a.visitType === b.visitType ? 0 : a.visitType === 'REGULAR' ? -1 : 1);
    });

    const response = {

      ok: true,

      ...dailyRoutePage(combinedVisits, page),

      date:
        dayQuery.isoDate,

      technicianId:
        dayQuery.technicianId

    };

    emitRouteLoaded(
      {
        technicianId: dayQuery.technicianId || null,
        date: dayQuery.isoDate,
        routeCount: combinedVisits.length,
        route: combinedVisits.map((visit) => ({
          id: visit.id,
          visitType: visit.visitType || "REGULAR",
          extraVisitId: visit.extraVisitId || null,
          poolId: visit.pool?.id || null,
          clientId: visit.client?.id || null,
          status: visit.status,
          plannedDate: visit.plannedDate || null,
        })),
        source: "technician.today",
      },
      {
        technicianId: dayQuery.technicianId || null,
        date: dayQuery.isoDate,
      }
    ).catch((error) => console.warn("ROUTE_LOADED emit failed:", error.message));

    return res.json(response);

  } catch (err) {

    console.error(err);

    return res.status(err.status || 500).json({

      ok: false,

      total: 0,

      visits: []

    });
  }
});

// ==========================================================
// CORRECAO DE VISITA JA FEITA
// ==========================================================

router.patch("/visits/:id/correction", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      error: "ID de visita invalido"
    });
  }

  let validated;
  try {
    validated = validateVisitCompletionPayload(body);
  } catch (error) {
    if (error instanceof VisitCompletionError) {
      return res.status(error.statusCode || 400).json({
        ok: false,
        code: error.code,
        error: error.message
      });
    }
    throw error;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${id} FOR UPDATE`; 
      const currentVisit = await tx.serviceVisit.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          technicianId: true,
          endAt: true,
          internalNotes: true
        }
      });

      if (!currentVisit) {
        const error = new Error("VISIT_NOT_FOUND");
        error.statusCode = 404;
        throw error;
      }

      if (!roleMatches(req.user?.role, "ADMIN") && Number(currentVisit.technicianId) !== Number(req.user?.technicianId || req.user?.id)) {
        throw Object.assign(new Error("VISIT_FORBIDDEN"), {statusCode:403});
      }

      if (!currentVisit.endAt && currentVisit.status !== "DONE") {
        const error = new Error("VISIT_NOT_COMPLETED");
        error.statusCode = 409;
        throw error;
      }

      const hasProducts = hasOwn(body, "products");
      if (hasProducts) await require("../services/visitCorrectionStockService").reconcile(tx, currentVisit, validated.chemicalsJson || []);
      const correctionLine = `[Correcao tecnico] ${new Date().toISOString()} - registo de servico atualizado em campo.`;

      await tx.serviceVisit.update({
        where: { id },
        data: definedOnly({
          cleaned: hasOwn(body, "cleaned") ? toBoolean(body.cleaned) : undefined,
          brushed: hasOwn(body, "brushed") ? toBoolean(body.brushed) : undefined,
          vacuumed: hasOwn(body, "vacuumed") ? toBoolean(body.vacuumed) : undefined,
          basketCleaned: hasOwn(body, "basketCleaned") ? toBoolean(body.basketCleaned) : undefined,
          waterlineClean: hasOwn(body, "waterlineClean") ? toBoolean(body.waterlineClean) : undefined,
          backwashDone: hasOwn(body, "backwashDone") ? toBoolean(body.backwashDone) : undefined,
          ph: nullableValidated(body, "ph", validated.ph),
          chlorine: nullableValidated(body, "chlorine", validated.chlorine),
          alkalinity: nullableValidated(body, "alkalinity", validated.alkalinity),
          salt: nullableValidated(body, "salt", validated.salt),
          temperature: nullableValidated(body, "temperature", validated.temperature),
          orpMv: nullableValidated(body, "orpMv", validated.orpMv, "orp"),
          notes: hasOwn(body, "notes") ? String(body.notes || "") : undefined,
          products: hasProducts ? (validated.productsText || "[]") : undefined,
          chemicalsJson: hasProducts ? (validated.chemicalsJson || []) : undefined,
          internalNotes: appendInternalNote(currentVisit.internalNotes, correctionLine)
        })
      });

      if (hasProducts) {
        await tx.chemicalUsage.deleteMany({ where: { visitId: id } });
        if (Array.isArray(validated.chemicalsJson) && validated.chemicalsJson.length) {
          await tx.chemicalUsage.createMany({
            data: validated.chemicalsJson.map((product) => ({
              visitId: id,
              name: product.name,
              quantity: product.quantity,
              unit: product.unit || null
            }))
          });
        }
      }

      const visit = await tx.serviceVisit.findUnique({
        where: { id },
        include: {
          client: true,
          technician: {
            include: {
              vehicle: true
            }
          },
          pool: {
            include: {
              client: true,
              keyAccesses: {
                where: {
                  active: true,
                  visibleToTechnician: true
                }
              }
            }
          },
          photos: true,
          chemicals: true
        }
      });

      return { visit };
    });

    return res.json({
      ok: true,
      visit: result.visit
    });
  } catch (error) {
    if (error instanceof VisitCompletionError) return res.status(error.statusCode).json({ok:false,code:error.code,error:error.message});
    if (error.message === "VISIT_NOT_FOUND") {
      return res.status(404).json({
        ok: false,
        error: "Visita nao encontrada"
      });
    }

    if (error.message === "VISIT_NOT_COMPLETED") {
      return res.status(409).json({
        ok: false,
        error: "Esta visita ainda nao foi concluida. Use o fluxo normal de conclusao."
      });
    }

    console.error("visit correction error:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: "Erro ao guardar correcao da visita"
    });
  }
});

// ==========================================================
// LEMBRETE DE AGUA ABERTA
// ==========================================================

const waterReminderService = require('../services/waterReminderService');
function waterHandler(action) {
  return async (req, res) => {
    try { res.set('Cache-Control', 'private, no-store'); return res.json(await action(req)); }
    catch (error) {
      if (!error.statusCode) console.error('water reminder error:', error);
      return res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : 'Erro ao guardar estado da água' });
    }
  };
}
router.get('/pump-reminders', waterHandler(req => waterReminderService.list(req.user, 'PUMP_MANUAL')));
router.get('/visit-receipts', waterHandler(req => require('../business/admin/VisitCoverageBusiness').receipts(req.user)));
router.post('/visit-receipts/:id/acknowledge', waterHandler(req => require('../business/admin/VisitCoverageBusiness').acknowledge(req.user,req.params.id)));
router.get('/chemical-shortages/:id/deliveries', waterHandler(req => require('../business/technician/ChemicalDeliveryBusiness').options(req.user,req.params.id)));
router.post('/chemical-shortages/:id/deliveries', waterHandler(req => require('../business/technician/ChemicalDeliveryBusiness').confirm(req.user,req.params.id,req.body)));
router.get('/chemical-shortages', waterHandler(req => require('../business/technician/IncompleteVisitBusiness').shortages(req.user)));
router.get('/incomplete-followups', waterHandler(req => require('../business/technician/IncompleteVisitBusiness').followups(req.user)));
router.post('/visits/:id/schedule-return', waterHandler(req => require('../business/technician/IncompleteVisitBusiness').scheduleReturn(req.user,req.params.id,req.body)));
router.get('/visits/:id/incomplete', waterHandler(req => require('../business/technician/IncompleteVisitBusiness').view(req.user,req.params.id,req.query)));
router.post('/visits/:id/incomplete', waterHandler(req => require('../business/technician/IncompleteVisitBusiness').report(req.user,req.params.id,req.body)));
router.get('/reminder-handovers/targets', waterHandler(() => waterReminderService.handoverTargets()));
router.get('/reminder-handovers/incoming', waterHandler(req => waterReminderService.incomingHandovers(req.user)));
for (const action of ['request','accept','cancel']) router.post(`/reminder-handovers/:id/${action}`, waterHandler(req => waterReminderService.handover(req.user, req.params.id, action, req.body)));
router.post('/pump-reminders', waterHandler(req => waterReminderService.create(req.user, req.body, 'PUMP_MANUAL')));
router.post('/pump-reminders/:id/close', waterHandler(req => waterReminderService.transition(req.user, req.params.id, 'close')));
router.get('/water-reminders', waterHandler(req => waterReminderService.list(req.user)));
router.post('/water-reminders', waterHandler(req => waterReminderService.create(req.user, req.body)));
router.post('/water-reminders/:id/close', waterHandler(req => waterReminderService.transition(req.user, req.params.id, 'close')));
router.post('/water-reminders/:id/alarm', waterHandler(req => waterReminderService.transition(req.user, req.params.id, 'alarm')));

// ==========================================================
// AVISO ADMIN / STOCK EM CAMPO
// ==========================================================

router.post('/stock-reminders', async (req,res) => {
  res.set('Cache-Control','private, no-store');
  try { res.json(await require('../services/fieldStockRequestService').create(req.user,req.body||{})); }
  catch(error) { res.status(error.statusCode||503).json({ok:false,code:error.code||'FIELD_STOCK_REQUEST_UNCONFIRMED',error:error.statusCode?error.message:'Pedido por confirmar. Repita o envio original.'}); }
});

// ==========================================================
// RANKING
// ==========================================================

router.get("/ranking", auth("ADMIN"), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const visits = await prisma.serviceVisit.findMany({
      select: { technicianId: true, technicianName: true, status: true, endAt: true, technician: { select: { name: true } } },
    });
    const stats = new Map();
    for (const visit of visits) {
      const status = String(visit.status || '').trim().toUpperCase();
      if (['CANCELLED', 'CANCELED', 'CANCELADA', 'CANCELADO'].includes(status)) continue;
      const name = visit.technician?.name || visit.technicianName || 'Sem técnico atribuído';
      // Names can repeat or equal object prototype properties. Identity is the
      // technician relation; old unassigned records remain a separate group.
      const key = visit.technicianId ? 'TECH:' + visit.technicianId : 'LEGACY:' + name;
      const row = stats.get(key) || { technicianId: visit.technicianId, name, total: 0, done: 0 };
      row.total++;
      if (visit.endAt || ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUIDO'].includes(status)) row.done++;
      stats.set(key, row);
    }
    const result = [...stats.values()].map(row => ({ ...row, performance: Math.round(row.done / row.total * 100) }))
      .sort((a, b) => b.performance - a.performance || b.done - a.done || a.name.localeCompare(b.name, 'pt') || (a.technicianId || 0) - (b.technicianId || 0));
    return res.json(result);
  } catch (err) {
    console.error('technician ranking error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao carregar ranking.' });
  }
});

// ==========================================================

module.exports = router;
