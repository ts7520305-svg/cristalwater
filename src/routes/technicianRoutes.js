const express = require("express");

const router = express.Router();

const { prisma } =
  require("../prismaClient");
const { createNotifications } =
  require("../services/notificationService");
const { buildServiceVisitDayQuery } =
  require("../utils/serviceVisitFilters");
const {
  VisitCompletionError,
  validateVisitCompletionPayload
} = require("../services/serviceVisitCompletionService");

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

async function resolveWaterContext(body = {}) {
  const visitId = numberOrNull(body.visitId);
  let visit = null;
  if (visitId) {
    visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        client: true,
        technician: true,
        pool: { include: { client: true } },
      },
    }).catch(() => null);
  }

  const poolId = numberOrNull(body.poolId) || visit?.poolId || null;
  const pool = visit?.pool || (poolId
    ? await prisma.pool.findUnique({ where: { id: poolId }, include: { client: true } }).catch(() => null)
    : null);
  const clientId = numberOrNull(body.clientId) || visit?.clientId || pool?.clientId || pool?.client?.id || null;
  const technicianId = numberOrNull(body.technicianId) || visit?.technicianId || null;
  const technician = visit?.technician || (technicianId
    ? await prisma.technician.findUnique({ where: { id: technicianId } }).catch(() => null)
    : null);
  const client = visit?.client || pool?.client || (clientId
    ? await prisma.client.findUnique({ where: { id: clientId } }).catch(() => null)
    : null);

  return {
    visit,
    pool,
    client,
    technician,
    visitId,
    poolId,
    clientId,
    technicianId,
    poolName: waterText(body.poolName) || pool?.name || "Piscina",
    clientName: waterText(body.clientName) || client?.name || "Cliente",
    technicianName: waterText(body.technicianName) || technician?.name || visit?.technicianName || "",
    location: waterText(body.location) || pool?.address || pool?.location || pool?.zone || client?.address || "",
  };
}

async function recordWaterVisitTrace(tx, context, line) {
  if (!context.visitId) return null;
  const currentVisit = context.visit || await tx.serviceVisit.findUnique({
    where: { id: context.visitId },
    select: { internalNotes: true },
  }).catch(() => null);
  if (!currentVisit) return null;
  return tx.serviceVisit.update({
    where: { id: context.visitId },
    data: { internalNotes: appendInternalNote(currentVisit.internalNotes, line) },
  }).catch(() => null);
}

async function recordWaterTechnicalHistory(tx, context, status, description, dueDate) {
  if (!context.poolId) return null;
  return tx.technicalHistory.create({
    data: {
      poolId: context.poolId,
      type: "WATER_OPEN",
      component: "Agua aberta",
      message: status,
      description,
      performedAt: new Date(),
      nextSuggested: dueDate || null,
      status,
    },
  }).catch(() => null);
}

async function createWaterNotification(tx, context, data) {
  return tx.notification.create({
    data: {
      clientId: context.clientId || null,
      type: "WATER_OPEN",
      eventType: data.eventType,
      title: data.title,
      message: data.message,
      role: data.role || "ADMIN",
      severity: data.severity,
      status: "PENDING",
      metadata: {
        source: "technician-field-mode",
        href: data.href || "/admin-alerts?origin=water-open",
        reminderId: data.reminderId || null,
        alertId: data.alertId || null,
        localId: data.localId || null,
        visitId: context.visitId || null,
        poolId: context.poolId || null,
        poolName: context.poolName,
        clientId: context.clientId || null,
        clientName: context.clientName,
        technicianId: context.technicianId || null,
        technicianName: context.technicianName || "",
        dueAt: data.dueAt || null,
        manual: Boolean(data.manual),
      },
    },
  });
}

// ==========================================================
// RONDA DO DIA
// ==========================================================

router.get("/today", async (req, res) => {

  try {
    const dayQuery =
      buildServiceVisitDayQuery(req.query || {});

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

        }

      });

    const poolIds = [...new Set(visits.map(v => v.poolId || v.pool?.id).filter(Boolean))];
    const clientIds = [...new Set(visits.map(v => v.clientId || v.client?.id || v.pool?.clientId || v.pool?.client?.id).filter(Boolean))];
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

        id: v.id,

        status:
          v.endAt
            ? "DONE"
            : v.status || "PENDING",

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
      const currentVisit = await tx.serviceVisit.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          endAt: true,
          internalNotes: true
        }
      });

      if (!currentVisit) {
        const error = new Error("VISIT_NOT_FOUND");
        error.statusCode = 404;
        throw error;
      }

      if (!currentVisit.endAt && currentVisit.status !== "DONE") {
        const error = new Error("VISIT_NOT_COMPLETED");
        error.statusCode = 409;
        throw error;
      }

      const hasProducts = hasOwn(body, "products");
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
        await tx.chemicalUsage.deleteMany({ where: { visitId: id } }).catch(() => null);
        if (Array.isArray(validated.chemicalsJson) && validated.chemicalsJson.length) {
          await tx.chemicalUsage.createMany({
            data: validated.chemicalsJson.map((product) => ({
              visitId: id,
              name: product.name,
              quantity: product.quantity,
              unit: product.unit || null
            }))
          }).catch(() => null);
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

router.post("/water-reminders", async (req, res) => {
  try {
    const body = req.body || {};
    const minutes =
      numberOrNull(body.minutes) ||
      numberOrNull(body.delayMinutes) ||
      numberOrNull(body.afterMinutes) ||
      numberOrNull(body.closeInMinutes);

    let dueDate = body.dueAt ? new Date(body.dueAt) : null;
    if ((!dueDate || Number.isNaN(dueDate.getTime())) && minutes) {
      dueDate = new Date(Date.now() + minutes * 60 * 1000);
    }
    if ((!dueDate || Number.isNaN(dueDate.getTime())) && body.time) {
      const match = String(body.time).match(/^(\d{1,2}):(\d{2})$/);
      if (match) {
        dueDate = new Date();
        dueDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
        if (dueDate.getTime() <= Date.now()) dueDate.setDate(dueDate.getDate() + 1);
      }
    }
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ ok: false, error: "Indique uma hora valida para fechar/verificar a agua" });
    }

    const context = await resolveWaterContext(body);
    const description = [
      `Cliente: ${context.clientName}`,
      `Piscina: ${context.poolName}`,
      context.location ? `Local: ${context.location}` : "",
      context.technicianName ? `Tecnico: ${context.technicianName}` : "",
      body.note ? `Nota: ${body.note}` : "",
      body.localId ? `Local ID: ${body.localId}` : "",
    ].filter(Boolean).join("\n");

    const result = await prisma.$transaction(async (tx) => {
      const reminder = await tx.operationalReminder.create({
        data: {
          title: `Agua aberta - ${context.poolName}`,
          description,
          dueDate,
          clientId: context.clientId,
          poolId: context.poolId,
          assignedToTechnicianId: context.technicianId,
        },
      });

      const line = `[Agua aberta] ${new Date().toISOString()} - lembrete criado para ${dueDate.toISOString()} em ${context.poolName}. ${body.note ? `Nota: ${body.note}` : ""}`.trim();
      await recordWaterVisitTrace(tx, context, line);
      await recordWaterTechnicalHistory(tx, context, "OPEN", description, dueDate);

      const notification = await createWaterNotification(tx, context, {
        eventType: "WATER_OPEN_CREATED",
        title: "Agua aberta marcada",
        message: `Agua aberta em ${context.poolName} (${context.clientName}). Fechar/verificar ate ${dueDate.toLocaleString("pt-PT")}.`,
        severity: "WARNING",
        reminderId: reminder.id,
        localId: body.localId || null,
        dueAt: dueDate.toISOString(),
      });

      return { reminder, notification };
    });

    emitRealtimeNotifications(result.notification);
    return res.json({ ok: true, reminder: result.reminder, notification: result.notification });
  } catch (err) {
    console.error("water reminder create error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao criar lembrete de agua aberta" });
  }
});

router.post("/water-reminders/:id/close", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const context = await resolveWaterContext(body);
    let reminder = null;

    await prisma.$transaction(async (tx) => {
      if (id) {
        reminder = await tx.operationalReminder.update({
          where: { id },
          data: { isCompleted: true },
        }).catch(() => null);
      }

      const line = `[Agua fechada] ${new Date().toISOString()} - agua fechada/verificada em ${context.poolName}.`;
      await recordWaterVisitTrace(tx, context, line);
      await recordWaterTechnicalHistory(tx, context, "CLOSED", line, null);

      const alertId = numberOrNull(body.alertId);
      if (alertId) {
        await tx.technicalAlert.update({
          where: { id: alertId },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        }).catch(() => null);
      }
    });

    return res.json({ ok: true, reminder });
  } catch (err) {
    console.error("water reminder close error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao fechar lembrete de agua aberta" });
  }
});

router.post("/water-reminders/:id/alarm", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const context = await resolveWaterContext(body);
    const message = `ALERTA GERAL: agua aberta por fechar em ${context.poolName} (${context.clientName}). Verificar imediatamente.`;

    const result = await prisma.$transaction(async (tx) => {
      let reminder = null;
      if (id) {
        reminder = await tx.operationalReminder.update({
          where: { id },
          data: { isCompleted: false },
        }).catch(() => null);
      }

      const line = `[ALARME agua aberta] ${new Date().toISOString()} - ${message}`;
      await recordWaterVisitTrace(tx, context, line);
      await recordWaterTechnicalHistory(tx, context, "OVERDUE", line, body.dueAt ? new Date(body.dueAt) : null);

      let alert = null;
      if (context.poolId) {
        alert = await tx.technicalAlert.create({
          data: {
            poolId: context.poolId,
            type: "AGUA_ABERTA",
            message: [
              message,
              context.technicianName ? `Tecnico: ${context.technicianName}` : "",
              context.visitId ? `Visita ${context.visitId}` : "",
              body.note ? `Nota: ${body.note}` : "",
            ].filter(Boolean).join("\n"),
            priority: "CRITICAL",
            status: "OPEN",
          },
        }).catch(() => null);
      }

      const notifications = await Promise.all(["ADMIN", "TECHNICIAN"].map((role) =>
        createWaterNotification(tx, context, {
          eventType: "WATER_OPEN_OVERDUE",
          title: "Agua aberta por fechar",
          message,
          role,
          severity: "CRITICAL",
          reminderId: id || reminder?.id || null,
          alertId: alert?.id || null,
          localId: body.localId || req.params.id,
          dueAt: body.dueAt || null,
          manual: Boolean(body.manual),
        })
      ));

      return { reminder, alert, notifications };
    });

    createNotifications("WATER_OPEN_OVERDUE", "Agua aberta por fechar", message)
      .catch((error) => console.warn("water reminder push warning:", error.message));

    emitRealtimeNotifications(result.notifications);
    if (global.io) {
      global.io.emit("water-open-alarm", {
        message,
        reminderId: id || null,
        alertId: result.alert?.id || null,
        visitId: context.visitId || null,
        poolId: context.poolId || null,
        technicianId: context.technicianId || null,
      });
    }

    return res.json({ ok: true, reminder: result.reminder, alert: result.alert, notifications: result.notifications });
  } catch (err) {
    console.error("water reminder alarm error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao enviar alerta de agua aberta" });
  }
});

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
