const { prisma } = require("../prismaClient");
const {
  buildClientPaymentReference,
  buildPaymentNoticeText,
} = require("../utils/clientPaymentReference");

const DEFAULT_WORK_END_HOUR = 18;
const SUPPORTED_LANGUAGES = new Set(["pt", "en", "fr", "de"]);

const COPY = {
  pt: {
    portalOk: "Estado atualizado",
    portalDelayed: "Estamos atrasados",
    portalAfterHours: "Seguimento prioritario",
    scheduled: {
      label: "Agendada",
      title: "Manutencao agendada",
      message: "A visita esta planeada para a data indicada.",
    },
    inProgress: {
      label: "Em curso",
      title: "Manutencao em curso",
      message: "A equipa tecnica esta a acompanhar esta piscina.",
    },
    delayed: {
      label: "Atrasada",
      title: "Estamos atrasados",
      message: "Estamos atrasados, mas a visita continua planeada e sera acompanhada pela nossa equipa.",
    },
    afterHours: {
      label: "A reagendar",
      title: "Acompanhamento prioritario",
      message: "O dia de trabalho terminou. Faremos a manutencao da piscina assim que possivel.",
    },
    completed: {
      label: "Concluida",
      title: "Manutencao concluida",
      message: "A manutencao foi concluida e fica registada no historico.",
    },
    noSchedule: {
      label: "A confirmar",
      title: "Sem agendamento ativo",
      message: "Estamos a preparar o proximo agendamento desta piscina.",
    },
  },
  en: {
    portalOk: "Status updated",
    portalDelayed: "We are running late",
    portalAfterHours: "Priority follow-up",
    scheduled: {
      label: "Scheduled",
      title: "Service scheduled",
      message: "The visit is planned for the date shown.",
    },
    inProgress: {
      label: "In progress",
      title: "Service in progress",
      message: "The technical team is taking care of this pool.",
    },
    delayed: {
      label: "Delayed",
      title: "We are running late",
      message: "We are running late, but your service remains scheduled and our team is following it.",
    },
    afterHours: {
      label: "To reschedule",
      title: "Priority follow-up",
      message: "The working day has ended. We will service your pool as soon as possible.",
    },
    completed: {
      label: "Completed",
      title: "Service completed",
      message: "The service has been completed and recorded in your history.",
    },
    noSchedule: {
      label: "To confirm",
      title: "No active schedule",
      message: "We are preparing the next schedule for this pool.",
    },
  },
  fr: {
    portalOk: "Statut mis a jour",
    portalDelayed: "Nous avons du retard",
    portalAfterHours: "Suivi prioritaire",
    scheduled: {
      label: "Planifiee",
      title: "Entretien planifie",
      message: "La visite est prevue a la date indiquee.",
    },
    inProgress: {
      label: "En cours",
      title: "Entretien en cours",
      message: "L'equipe technique prend en charge cette piscine.",
    },
    delayed: {
      label: "En retard",
      title: "Nous avons du retard",
      message: "Nous avons du retard, mais l'intervention reste planifiee et suivie par notre equipe.",
    },
    afterHours: {
      label: "A reprogrammer",
      title: "Suivi prioritaire",
      message: "La journee de travail est terminee. Nous interviendrons des que possible.",
    },
    completed: {
      label: "Terminee",
      title: "Entretien termine",
      message: "L'entretien est termine et enregistre dans votre historique.",
    },
    noSchedule: {
      label: "A confirmer",
      title: "Aucun planning actif",
      message: "Nous preparons le prochain planning pour cette piscine.",
    },
  },
  de: {
    portalOk: "Status aktualisiert",
    portalDelayed: "Wir sind verspaetet",
    portalAfterHours: "Priorisierte Nachverfolgung",
    scheduled: {
      label: "Geplant",
      title: "Wartung geplant",
      message: "Der Besuch ist fuer das angezeigte Datum geplant.",
    },
    inProgress: {
      label: "In Arbeit",
      title: "Wartung laeuft",
      message: "Das Technikteam betreut diesen Pool.",
    },
    delayed: {
      label: "Verspaetet",
      title: "Wir sind verspaetet",
      message: "Wir sind verspaetet, aber der Besuch bleibt geplant und wird von unserem Team verfolgt.",
    },
    afterHours: {
      label: "Neu zu planen",
      title: "Priorisierte Nachverfolgung",
      message: "Der Arbeitstag ist beendet. Wir warten Ihren Pool so bald wie moeglich.",
    },
    completed: {
      label: "Abgeschlossen",
      title: "Wartung abgeschlossen",
      message: "Die Wartung wurde abgeschlossen und im Verlauf gespeichert.",
    },
    noSchedule: {
      label: "Zu bestaetigen",
      title: "Kein aktiver Termin",
      message: "Wir bereiten den naechsten Termin fuer diesen Pool vor.",
    },
  },
};

const COMPLETED_STATUSES = new Set(["DONE", "COMPLETED", "CONCLUIDA", "FINALIZADA", "FINISHED", "CLOSED"]);
const CANCELLED_STATUSES = new Set(["CANCELLED", "CANCELED", "CANCELADA", "ANULADA", "REAGENDADA"]);
const IN_PROGRESS_STATUSES = new Set(["IN_PROGRESS", "EM_EXECUCAO", "A_CAMINHO", "ON_THE_WAY", "STARTED"]);

function normalizeLanguage(value) {
  const lang = String(value || "pt").trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.has(lang) ? lang : "pt";
}

function normalizeStatus(value) {
  return String(value || "PLANNED")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function visitTimestamp(visit) {
  const date = new Date(visit?.plannedDate || visit?.completedAt || 0);
  const time = date.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const first = new Date(a);
  const second = new Date(b);
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function isCompleted(visit) {
  return Boolean(visit?.completedAt) || COMPLETED_STATUSES.has(normalizeStatus(visit?.status));
}

function isCancelled(visit) {
  return CANCELLED_STATUSES.has(normalizeStatus(visit?.status));
}

function isInProgress(visit) {
  return IN_PROGRESS_STATUSES.has(normalizeStatus(visit?.status)) || Boolean(visit?.startedAt);
}

function endOfWorkday(date) {
  const end = new Date(date);
  end.setHours(DEFAULT_WORK_END_HOUR, 0, 0, 0);
  return end;
}

function statusKeyForVisit(visit, now) {
  if (!visit) return "noSchedule";
  if (isCompleted(visit)) return "completed";
  if (isInProgress(visit)) return "inProgress";

  const planned = visit.plannedDate ? new Date(visit.plannedDate) : null;
  if (!planned || Number.isNaN(planned.getTime())) return "scheduled";

  if (sameDay(planned, now) && now >= endOfWorkday(now)) return "afterHours";
  if (planned < now) return "delayed";
  return "scheduled";
}

function normalizeServiceVisit(visit) {
  return {
    id: `service-${visit.id}`,
    source: "serviceVisit",
    numericId: visit.id,
    poolId: visit.poolId || visit.pool?.id || null,
    plannedDate: toIso(visit.plannedDate || visit.date || visit.startAt || visit.createdAt),
    completedAt: toIso(visit.endAt),
    startedAt: toIso(visit.startAt),
    status: visit.status || "PLANNED",
  };
}

function normalizeVisit(visit) {
  return {
    id: `visit-${visit.id}`,
    source: "visit",
    numericId: visit.id,
    poolId: visit.poolId || visit.pool?.id || null,
    plannedDate: toIso(visit.plannedDate || visit.createdAt),
    completedAt: toIso(visit.executedAt),
    startedAt: null,
    status: visit.status || "PLANNED",
  };
}

async function safeFindMany(modelName, options) {
  try {
    if (!prisma[modelName]?.findMany) return [];
    return await prisma[modelName].findMany(options);
  } catch (error) {
    console.warn(`client portal ${modelName} schedule unavailable:`, error.message);
    return [];
  }
}

async function loadClientVisits(clientId, now) {
  const since = new Date(now);
  since.setDate(since.getDate() - 21);
  since.setHours(0, 0, 0, 0);

  const until = new Date(now);
  until.setDate(until.getDate() + 60);
  until.setHours(23, 59, 59, 999);

  const clientFilter = {
    OR: [
      { clientId },
      { pool: { is: { clientId } } },
    ],
  };

  const serviceVisits = await safeFindMany("serviceVisit", {
    where: {
      AND: [
        clientFilter,
        {
          OR: [
            { plannedDate: { gte: since, lte: until } },
            { date: { gte: since, lte: until } },
          ],
        },
      ],
    },
    select: {
      id: true,
      poolId: true,
      plannedDate: true,
      date: true,
      startAt: true,
      endAt: true,
      status: true,
      createdAt: true,
      pool: { select: { id: true, clientId: true } },
    },
    orderBy: [{ plannedDate: "asc" }, { date: "asc" }],
  });

  const visits = await safeFindMany("visit", {
    where: {
      AND: [
        clientFilter,
        { plannedDate: { gte: since, lte: until } },
      ],
    },
    select: {
      id: true,
      poolId: true,
      plannedDate: true,
      executedAt: true,
      status: true,
      createdAt: true,
      pool: { select: { id: true, clientId: true } },
    },
    orderBy: [{ plannedDate: "asc" }],
  });

  return [
    ...serviceVisits.map(normalizeServiceVisit),
    ...visits.map(normalizeVisit),
  ].filter((visit) => visit.poolId);
}

function buildPoolSchedules(pools, visits, language, now) {
  const copy = COPY[language];

  return (pools || []).map((pool) => {
    const poolVisits = visits
      .filter((visit) => Number(visit.poolId) === Number(pool.id))
      .sort((a, b) => visitTimestamp(a) - visitTimestamp(b));

    const activeVisit = poolVisits.find((visit) => !isCompleted(visit) && !isCancelled(visit));
    const latestCompletedToday = [...poolVisits]
      .filter((visit) => isCompleted(visit) && sameDay(visit.completedAt || visit.plannedDate, now))
      .sort((a, b) => visitTimestamp(b) - visitTimestamp(a))[0];
    const visit = activeVisit || latestCompletedToday || null;
    const key = statusKeyForVisit(visit, now);
    const text = copy[key] || copy.noSchedule;

    return {
      poolId: pool.id,
      poolName: pool.name || pool.location || "Piscina",
      poolType: pool.type || "Piscina",
      zone: pool.zone || pool.location || "",
      state: key,
      label: text.label,
      title: text.title,
      message: text.message,
      plannedDate: visit?.plannedDate || null,
      source: visit?.source || null,
      visitId: visit?.numericId || null,
      status: visit?.status || null,
    };
  });
}

function portalStatus(poolSchedules, language) {
  const copy = COPY[language];
  if (poolSchedules.some((item) => item.state === "afterHours")) {
    return { state: "afterHours", label: copy.portalAfterHours };
  }
  if (poolSchedules.some((item) => item.state === "delayed")) {
    return { state: "delayed", label: copy.portalDelayed };
  }
  return { state: "ok", label: copy.portalOk };
}

function nextVisitFromSchedules(poolSchedules) {
  const candidates = poolSchedules
    .filter((item) => item.plannedDate && !["completed", "noSchedule"].includes(item.state))
    .sort((a, b) => visitTimestamp(a) - visitTimestamp(b));

  const next = candidates[0] || null;
  if (!next) return null;

  return {
    plannedDate: next.plannedDate,
    poolId: next.poolId,
    poolName: next.poolName,
    state: next.state,
    label: next.label,
    message: next.message,
  };
}

function parseProducts(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeServiceHistory(visit) {
  const products = parseProducts(visit.products || visit.chemicalsJson);
  return {
    id: visit.id,
    poolId: visit.poolId,
    poolName: visit.pool?.name || "Piscina",
    poolType: visit.pool?.type || "POOL",
    technicianName: visit.technician?.name || visit.technicianName || "Cristal Water",
    plannedDate: toIso(visit.plannedDate || visit.date || visit.createdAt),
    startAt: toIso(visit.startAt),
    endAt: toIso(visit.endAt),
    status: visit.status || "DONE",
    reason: visit.reason || null,
    notes: visit.notes || null,
    checklist: {
      cleaned: Boolean(visit.cleaned),
      brushed: Boolean(visit.brushed),
      vacuumed: Boolean(visit.vacuumed),
      basketCleaned: Boolean(visit.basketCleaned),
      waterlineClean: Boolean(visit.waterlineClean),
      backwashDone: Boolean(visit.backwashDone),
    },
    readings: {
      ph: visit.ph,
      chlorine: visit.chlorine,
      alkalinity: visit.alkalinity,
      salt: visit.salt,
      temperature: visit.temperature,
      orpMv: visit.orpMv,
    },
    products,
    photos: (visit.photos || []).map((photo) => ({
      id: photo.id,
      url: photo.url,
      type: photo.type,
      createdAt: toIso(photo.createdAt),
    })),
  };
}

function normalizeInvoice(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    monthRef: invoice.monthRef || invoice.month,
    status: invoice.status,
    total: invoice.total || invoice.totalAmount || invoice.amount || 0,
    amountPaid: invoice.amountPaid || 0,
    amountOpen: invoice.amountOpen || 0,
    dueDate: toIso(invoice.dueDate),
    issueDate: toIso(invoice.issueDate || invoice.createdAt),
    lines: (invoice.lines || []).map((line) => ({
      id: line.id,
      type: line.type || line.lineType,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total || line.lineTotal || 0,
    })),
    payments: (invoice.payments || []).map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      paidAt: toIso(payment.paidAt || payment.createdAt),
    })),
  };
}

function cleanPhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function companyWhatsappNumber() {
  return cleanPhoneNumber(
    process.env.COMPANY_WHATSAPP_NUMBER
    || process.env.WHATSAPP_BUSINESS_NUMBER
    || process.env.WHATSAPP_NUMBER
    || process.env.PUBLIC_WHATSAPP_NUMBER
    || ""
  );
}

function buildClientPaymentInstructions(client, summary) {
  const paymentReference = buildClientPaymentReference(client.id);
  const amountOpen = Number(summary?.totalOpen || 0);
  const creditBalance = Number(summary?.creditBalance || 0);
  const message = [
    `Referencia: ${paymentReference}`,
    creditBalance > 0 ? `Credito positivo: ${creditBalance.toFixed(2)} EUR` : null,
    amountOpen > 0 ? `Valor em aberto: ${amountOpen.toFixed(2)} EUR` : "Valor em aberto: 0.00 EUR",
    "Depois de pagar, envie uma mensagem no portal ou por WhatsApp com esta referencia.",
  ].filter(Boolean).join("\n");

  return {
    paymentReference,
    amountOpen,
    creditBalance,
    whatsappNumber: companyWhatsappNumber(),
    systemMessageTemplate: message,
    whatsappText: `Ola Cristal Water. Informo pagamento efetuado. ${message.replace(/\n/g, " | ")}`,
    instructions: "Use sempre esta referencia ao pagar. Se nao conseguir usar o portal, envie a mesma referencia por WhatsApp ou contacte a administracao.",
  };
}

async function getClientPortal(req, res) {
  try {
    const requestedId = Number(req.params.clientId);
    const language = normalizeLanguage(req.query.lang || req.query.language || req.headers["accept-language"]);
    const now = new Date();

    if (!Number.isInteger(requestedId) || requestedId <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Cliente invalido",
      });
    }

    const client = await prisma.client.findFirst({
      where: { id: requestedId },
      include: { pools: { orderBy: { name: "asc" } } },
    });

    if (!client) {
      return res.status(404).json({
        ok: false,
        error: "Cliente nao encontrado",
      });
    }

    const [visits, serviceHistory, invoices] = await Promise.all([
      loadClientVisits(client.id, now),
      safeFindMany("serviceVisit", {
        where: {
          OR: [
            { clientId: client.id },
            { pool: { is: { clientId: client.id } } },
          ],
        },
        include: {
          pool: true,
          technician: true,
          photos: true,
          chemicals: true,
        },
        orderBy: [
          { plannedDate: "desc" },
          { date: "desc" },
          { createdAt: "desc" },
        ],
        take: 500,
      }),
      safeFindMany("invoice", {
        where: { clientId: client.id },
        include: {
          lines: true,
          payments: true,
        },
        orderBy: [
          { issueDate: "desc" },
          { createdAt: "desc" },
        ],
        take: 12,
      }),
    ]);
    const pools = client.pools || [];
    const poolSchedules = buildPoolSchedules(pools, visits, language, now);
    const nextVisit = nextVisitFromSchedules(poolSchedules);
    const normalizedInvoices = invoices.map(normalizeInvoice);
    const normalizedServices = serviceHistory.map(normalizeServiceHistory);
    const totalInvoices = normalizedInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const totalPaid = normalizedInvoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0);
    const totalOpenBeforeCredit = normalizedInvoices.reduce((sum, invoice) => sum + Number(invoice.amountOpen || 0), 0);
    const creditBalance = Number(client.creditBalance || 0);
    const totalOpen = Math.max(totalOpenBeforeCredit - creditBalance, 0);
    const completedServices = normalizedServices.filter((visit) => isCompleted(visit)).length;

    const summary = {
      totalPools: pools.length,
      totalInvoices,
      totalPaid,
      totalOpen,
      totalOpenBeforeCredit,
      creditBalance,
      completedServices,
      lastServiceAt: normalizedServices[0]?.endAt || normalizedServices[0]?.plannedDate || null,
      delayedSchedules: poolSchedules.filter((item) => item.state === "delayed").length,
      afterHoursSchedules: poolSchedules.filter((item) => item.state === "afterHours").length,
    };

    return res.json({
      ok: true,
      language,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        zone: client.zone,
        status: client.status,
        creditBalance,
        paymentReference: buildClientPaymentReference(client.id),
        pools,
      },
      paymentInstructions: buildClientPaymentInstructions(client, summary),
      summary,
      pools,
      poolSchedules,
      services: normalizedServices,
      history: normalizedServices,
      serviceHistory: normalizedServices,
      invoices: normalizedInvoices,
      nextVisit,
      portalStatus: portalStatus(poolSchedules, language),
      operationRules: {
        workEndHour: DEFAULT_WORK_END_HOUR,
        technicianAfterHoursAllowed: true,
      },
    });
  } catch (err) {
    console.error("getClientPortal error:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Erro ao obter portal do cliente",
    });
  }
}

async function notifyPayment(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    if (!clientId) {
      return res.status(400).json({ ok: false, error: "Cliente invalido" });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!client) {
      return res.status(404).json({ ok: false, error: "Cliente nao encontrado" });
    }

    const amount = Number(req.body?.amount || 0);
    const method = String(req.body?.method || "Nao indicado").trim();
    const channel = String(req.body?.channel || "PORTAL_CLIENTE").trim();
    const note = String(req.body?.note || req.body?.message || "").trim();
    const paymentReference = buildClientPaymentReference(client.id);
    const text = buildPaymentNoticeText({ client, amount, method, note, channel });

    const [message] = await prisma.$transaction([
      prisma.clientMessage.create({
        data: {
          clientId: client.id,
          sender: "Cliente",
          senderType: "CLIENT",
          message: text,
          text,
          messageType: "PAYMENT_NOTICE",
          isReadByAdmin: false,
          seen: false,
        },
      }),
      prisma.notification.create({
        data: {
          clientId: client.id,
          type: "PAYMENT_NOTICE",
          eventType: "CLIENT_PAYMENT_NOTICE",
          title: `Pagamento comunicado - ${paymentReference}`,
          message: `${client.name}: comunicou pagamento${amount > 0 ? ` de ${amount.toFixed(2)} EUR` : ""}. Ref. ${paymentReference}`,
          role: "ADMIN",
          severity: "WARN",
          metadata: {
            href: `/chat?clientId=${client.id}&filter=unread`,
            clientId: client.id,
            paymentReference,
            amount,
            method,
            channel,
          },
          isRead: false,
        },
      }),
      prisma.communicationLog.create({
        data: {
          clientId: client.id,
          channel,
          message: text,
          referenceId: client.id,
        },
      }),
    ]);

    if (global.io) {
      global.io.to(`client_${client.id}`).emit("newMessage", message);
      global.io.emit("new-notification", {
        type: "PAYMENT_NOTICE",
        clientId: client.id,
        message: `${client.name}: pagamento comunicado. Ref. ${paymentReference}`,
        createdAt: message.createdAt,
      });
    }

    return res.json({
      ok: true,
      paymentReference,
      message,
    });
  } catch (err) {
    console.error("notifyPayment error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Erro ao comunicar pagamento",
    });
  }
}

module.exports = {
  getClientPortal,
  notifyPayment,
};
