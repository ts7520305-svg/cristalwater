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

  try {
    const scopedQuery = { ...(req.query || {}) };
    if (roleMatches(req.user?.role, "TECHNICIAN") && !roleMatches(req.user?.role, "ADMIN")) {
      scopedQuery.technicianId = req.user?.technicianId || req.user?.id;
    }

    const dayQuery =
      buildServiceVisitDayQuery(scopedQuery);

    const rawLimit = Number(req.query?.limit || 200);
    const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 300) : 200;

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
              operationalReminders: {
                where: {
                  isCompleted: false
                },
                orderBy: {
                  dueDate: "asc"
                },
                take: 20
              }
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
                  operationalReminders: {
                    where: {
                      isCompleted: false
                    },
                    orderBy: {
                      dueDate: "asc"
                    },
                    take: 20
                  }
                }
              },

              operationalReminders: {
                where: {
                  isCompleted: false
                },
                orderBy: {
                  dueDate: "asc"
                },
                take: 20
              }

            }
          }

          ,

          photos: true,

          chemicals: true

        },

        orderBy: {

          plannedDate: "asc"

        },

        take

      });

    const extraVisitWhere = {
      scheduledAt: {
        gte: dayQuery.start,
        lt: dayQuery.end,
      },
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
                operationalReminders: {
                  where: {
                    isCompleted: false,
                  },
                  orderBy: {
                    dueDate: "asc",
                  },
                  take: 20,
                },
              },
            },
            operationalReminders: {
              where: {
                isCompleted: false,
              },
              orderBy: {
                dueDate: "asc",
              },
              take: 20,
            },
          },
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      take,
    });

    const permissionPolicy = await getPermissionPolicy().catch(() => null);
    const showFinancialValues = canExposeFinancialValues(req.user, permissionPolicy);

    const poolIds = [...new Set([
      ...visits.map(v => v.poolId || v.pool?.id),
      ...extraVisits.map(v => v.poolId || v.pool?.id),
    ].filter(Boolean))];
    const clientIds = [...new Set([
      ...visits.map(v => v.clientId || v.client?.id || v.pool?.clientId || v.pool?.client?.id),
      ...extraVisits.map(v => v.clientId || v.pool?.clientId || v.pool?.client?.id),
    ].filter(Boolean))];
    const closedReminderStatuses = ["DONE", "CLOSED", "COMPLETED", "RESOLVED", "CANCELLED", "CANCELED"];
    const generalReminders = (poolIds.length || clientIds.length)
      ? await prisma.generalReminder.findMany({
          where: {
            status: {
              notIn: closedReminderStatuses
            },
            OR: [
              ...(poolIds.length ? [{ poolId: { in: poolIds } }] : []),
              ...(clientIds.length ? [{ clientId: { in: clientIds } }] : [])
            ]
          },
          orderBy: {
            dueAt: "asc"
          },
          take: 500
        }).catch(() => [])
      : [];

    const relevantGeneralReminders = (visit, scope) => {
      const poolId = visit.poolId || visit.pool?.id;
      const clientId = visit.clientId || visit.client?.id || visit.pool?.clientId || visit.pool?.client?.id;
      return generalReminders.filter(reminder => {
        if (scope === "pool") return reminder.poolId && poolId && reminder.poolId === poolId;
        if (scope === "client") return reminder.clientId && clientId && reminder.clientId === clientId && !reminder.poolId;
        return (reminder.poolId && poolId && reminder.poolId === poolId) || (reminder.clientId && clientId && reminder.clientId === clientId);
      });
    };

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
            v.pool?.latitude || 0,

          longitude:
            v.pool?.longitude || 0,

          keyAccesses:
            v.pool?.keyAccesses || [],

          operationalReminders:
            v.pool?.operationalReminders || [],

          generalReminders:
            relevantGeneralReminders(v, "pool")
        },

        client: {

          id:
            v.client?.id || v.pool?.client?.id,

          name:
            v.client?.name || v.pool?.client?.name || "-",

          accesses:
            uniqueRows(v.client?.accesses || [], v.pool?.client?.accesses || []),

          operationalReminders:
            uniqueRows(v.client?.operationalReminders || [], v.pool?.client?.operationalReminders || []),

          generalReminders:
            relevantGeneralReminders(v, "client")
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

        startAt:
          null,

        endAt:
          null,

        notes:
          v.notes || null,

        internalNotes:
          null,

        products:
          null,

        chemicalsJson:
          null,

        cleaned:
          false,

        brushed:
          false,

        vacuumed:
          false,

        basketCleaned:
          false,

        waterlineClean:
          false,

        backwashDone:
          false,

        photos:
          [],

        chemicals:
          [],

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
            v.pool?.latitude || 0,

          longitude:
            v.pool?.longitude || 0,

          keyAccesses:
            v.pool?.keyAccesses || [],

          operationalReminders:
            v.pool?.operationalReminders || [],

          generalReminders:
            relevantGeneralReminders(v, "pool"),
        },

        client: {
          id:
            v.pool?.client?.id || v.clientId || null,

          name:
            v.pool?.client?.name || "-",

          accesses:
            uniqueRows(v.pool?.client?.accesses || []),

          operationalReminders:
            uniqueRows(v.pool?.client?.operationalReminders || []),

          generalReminders:
            relevantGeneralReminders(v, "client"),
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
      return Number(a.id || 0) - Number(b.id || 0);
    });

    const response = {

      ok: true,

      total:
        combinedVisits.length,

      date:
        dayQuery.isoDate,

      technicianId:
        dayQuery.technicianId,

      visits:
        combinedVisits

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

    return res.status(500).json({

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
    try { return res.json(await action(req)); }
    catch (error) {
      if (!error.statusCode) console.error('water reminder error:', error);
      return res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : 'Erro ao guardar estado da água' });
    }
  };
}
router.get('/pump-reminders', waterHandler(req => waterReminderService.list(req.user, 'PUMP_MANUAL')));
router.post('/pump-reminders', waterHandler(req => waterReminderService.create(req.user, req.body, 'PUMP_MANUAL')));
router.post('/pump-reminders/:id/close', waterHandler(req => waterReminderService.transition(req.user, req.params.id, 'close')));
router.get('/water-reminders', waterHandler(req => waterReminderService.list(req.user)));
router.post('/water-reminders', waterHandler(req => waterReminderService.create(req.user, req.body)));
router.post('/water-reminders/:id/close', waterHandler(req => waterReminderService.transition(req.user, req.params.id, 'close')));
router.post('/water-reminders/:id/alarm', waterHandler(req => waterReminderService.transition(req.user, req.params.id, 'alarm')));

// ==========================================================
// AVISO ADMIN / STOCK EM CAMPO
// ==========================================================

router.post("/stock-reminders", async (req, res) => {
  try {
    const body = req.body || {};
    const productName = String(body.productName || "").trim();
    const message = String(body.message || "").trim();

    if (!productName && !message) {
      return res.status(400).json({
        ok: false,
        error: "Indique o material em falta ou uma nota para o administrador"
      });
    }

    const requestType = String(body.requestType || "STOCK_REQUEST").toUpperCase();
    const priority = String(body.priority || "NORMAL").toUpperCase();
    const quantityText = [body.quantity, body.unit].filter(Boolean).join(" ");
    const title = requestType === "ADMIN_NOTE"
      ? "Nota do tecnico para administracao"
      : requestType === "PURCHASE_REMINDER"
        ? `Comprar material: ${productName || "material"}`
        : `Stock em falta: ${productName || "material"}`;
    const finalMessage = [
      productName ? `Material: ${productName}` : "",
      quantityText ? `Quantidade: ${quantityText}` : "",
      message ? `Nota: ${message}` : "",
      body.poolName ? `Piscina: ${body.poolName}` : "",
      body.clientName ? `Cliente: ${body.clientName}` : "",
      body.vehicleId ? `Viatura: ${body.vehicleId}` : "",
    ].filter(Boolean).join("\n");

    const reminder = await prisma.operationalReminder.create({
      data: {
        title,
        description: finalMessage,
        dueDate: new Date(),
        clientId: body.clientId ? Number(body.clientId) : null,
        poolId: body.poolId ? Number(body.poolId) : null,
        assignedToTechnicianId: body.technicianId ? Number(body.technicianId) : null,
      },
    }).catch(() => null);

    const notification = await prisma.notification.create({
      data: {
        clientId: body.clientId ? Number(body.clientId) : null,
        type: priority === "HIGH" ? "STOCK_CRITICAL" : "STOCK",
        eventType: "TECHNICIAN_STOCK_REQUEST",
        title,
        message: finalMessage || title,
        role: "ADMIN",
        severity: priority,
        status: "PENDING",
        metadata: {
          source: "technician-field-mode",
          requestType,
          productName,
          quantity: body.quantity || null,
          unit: body.unit || null,
          visitId: body.visitId || null,
          poolId: body.poolId || null,
          clientId: body.clientId || null,
          vehicleId: body.vehicleId || null,
          technicianId: body.technicianId || null,
          reminderId: reminder?.id || null,
        },
      },
    });

    createNotifications("TECHNICIAN_STOCK_REQUEST", title, finalMessage || title)
      .catch((error) => console.warn("stock reminder push warning:", error.message));

    if (global.io) {
      global.io.emit("new-notification", {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
        clientId: notification.clientId,
      });
    }

    return res.json({ ok: true, reminder, notification });
  } catch (err) {
    console.error("stock reminder create error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao enviar aviso de stock" });
  }
});

// ==========================================================
// RANKING
// ==========================================================

router.get("/ranking", async (req, res) => {

  try {

    const visits =
      await prisma.serviceVisit.findMany();

    const stats = {};

    visits.forEach(v => {

      const name =
        v.technicianName ||
        "Sem nome";

      if (!stats[name]) {

        stats[name] = {

          name,

          total: 0,

          done: 0
        };
      }

      stats[name].total++;

      if (v.endAt) {
        stats[name].done++;
      }
    });

    const result =
      Object.values(stats)

      .map(t => ({

        ...t,

        performance:
          t.total > 0

            ? Math.round(
                (t.done / t.total) * 100
              )

            : 0
      }))

      .sort(
        (a,b)=>
          b.performance - a.performance
      );

    return res.json(result);

  } catch (err) {

    console.error(err);

    return res.status(500).json([]);
  }
});

// ==========================================================

module.exports = router;
