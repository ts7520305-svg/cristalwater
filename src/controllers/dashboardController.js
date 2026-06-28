const { prisma } = require("../prismaClient");

const CLOSED_STATUSES = ["RESOLVED", "DONE", "CLOSED", "CANCELLED", "CANCELED", "ARCHIVED"];
const ALERT_NOTIFICATION_TYPES = [
  "ALERT",
  "CRITICAL",
  "WARNING",
  "STOCK",
  "STOCK_CRITICAL",
  "WATER_OPEN",
  "OPERATIONAL_PENDING",
  "GPS_OFFLINE",
];
const ALERT_EVENT_TYPES = [
  "FIELD_PROBLEM_REPORTED",
  "TECHNICIAN_STOCK_REQUEST",
  "WATER_OPEN_OVERDUE",
  "OPERATIONAL_FLOW",
  "GPS_OFFLINE",
];

function getMonthRef(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isValidMonthRef(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ""));
}

function getMonthWindow(monthRef) {
  const [year, month] = String(monthRef).split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function moneyFromRecord(record, fields, centsFields = []) {
  for (const field of fields) {
    const value = numberValue(record?.[field]);
    if (value) return value;
  }
  for (const field of centsFields) {
    const value = numberValue(record?.[field]);
    if (value) return value / 100;
  }
  return 0;
}

function invoiceMonthRef(invoice) {
  if (isValidMonthRef(invoice?.monthRef)) return invoice.monthRef;
  if (isValidMonthRef(invoice?.month)) return invoice.month;
  if (invoice?.year && invoice?.month) {
    const month = String(invoice.month).padStart(2, "0");
    if (/^\d{2}$/.test(month)) return `${invoice.year}-${month}`;
  }
  return getMonthRef(new Date(invoice?.issueDate || invoice?.createdAt || Date.now()));
}

function paymentAmount(payment) {
  return moneyFromRecord(payment, ["amount"], ["amountCents"]);
}

function invoiceTotal(invoice) {
  return moneyFromRecord(invoice, ["total", "totalAmount", "amount"], ["totalCents", "amountCents"]);
}

function invoicePaid(invoice) {
  const direct = moneyFromRecord(invoice, ["amountPaid"], []);
  if (direct) return direct;
  return (invoice?.payments || []).reduce((sum, payment) => sum + paymentAmount(payment), 0);
}

function invoiceOpen(invoice) {
  const direct = moneyFromRecord(invoice, ["amountOpen"], []);
  if (direct) return direct;
  return Math.max(invoiceTotal(invoice) - invoicePaid(invoice), 0);
}

function normalizeStatus(status) {
  return String(status || "").toUpperCase();
}

function isOpenAlertStatus(status) {
  return !CLOSED_STATUSES.includes(normalizeStatus(status || "OPEN"));
}

function alertPriority(priority, fallback = "NORMAL") {
  const value = normalizeStatus(priority || fallback || "NORMAL");
  if (["CRITICAL", "HIGH", "URGENT"].includes(value)) return "CRITICAL";
  if (["WARNING", "WARN", "MEDIUM"].includes(value)) return "WARNING";
  if (value === "LOW") return "LOW";
  return "NORMAL";
}

function mapTechnicalAlert(alert) {
  return {
    id: `technical-${alert.id}`,
    source: "technical",
    type: alert.type || "TECHNICAL_ALERT",
    message: alert.message || "",
    priority: alertPriority(alert.priority),
    status: alert.status || "OPEN",
    createdAt: alert.createdAt,
    poolId: alert.poolId,
    clientId: alert.pool?.clientId || null,
    pool: alert.pool || null,
    client: alert.pool?.client || null,
    href: alert.poolId ? `/admin-pool-technical?poolId=${alert.poolId}` : "/admin-alerts",
  };
}

function mapNotification(notification) {
  const metadata = notification.metadata && typeof notification.metadata === "object" ? notification.metadata : {};
  return {
    id: `notification-${notification.id}`,
    source: "notification",
    type: notification.type || "ALERT",
    eventType: notification.eventType || null,
    message: notification.message || "",
    priority: alertPriority(notification.severity, notification.type),
    status: notification.status || (notification.isRead ? "READ" : "PENDING"),
    createdAt: notification.createdAt,
    poolId: metadata.poolId || null,
    clientId: notification.clientId || null,
    pool: metadata.poolId ? { id: metadata.poolId, name: metadata.poolName || "", zone: metadata.zone || "" } : null,
    client: notification.client || null,
    href: metadata.href || (metadata.poolId ? `/admin-pool-technical?poolId=${metadata.poolId}` : notification.clientId ? `/admin-clients?clientId=${notification.clientId}` : "/admin-alerts"),
  };
}

function mapVisitAlert(visit) {
  return {
    id: `visit-${visit.id}`,
    source: "visit",
    type: "VISIT_ALERT",
    message: visit.alerts || visit.reason || "Visita com alerta",
    priority: normalizeStatus(visit.status) === "NOT_DONE" ? "WARNING" : "NORMAL",
    status: visit.status || "OPEN",
    createdAt: visit.updatedAt || visit.date || visit.plannedDate,
    poolId: visit.poolId || null,
    clientId: visit.clientId || visit.pool?.clientId || null,
    technicianId: visit.technicianId || null,
    pool: visit.pool || null,
    client: visit.client || visit.pool?.client || null,
    href: visit.poolId ? `/admin-pool-technical?poolId=${visit.poolId}` : "/admin-visits",
  };
}

function mapVisit(visit) {
  return {
    id: visit.id,
    clientId: visit.clientId || visit.pool?.clientId || null,
    poolId: visit.poolId || null,
    technicianId: visit.technicianId || null,
    technicianName: visit.technician?.name || visit.technicianName || "",
    plannedDate: visit.plannedDate,
    date: visit.date,
    status: visit.status || "PLANNED",
    alerts: visit.alerts || null,
    pool: visit.pool || null,
    client: visit.client || visit.pool?.client || null,
    technician: visit.technician || null,
  };
}

async function getAdminDashboardData(req = {}) {
  const requestedMonth = String(req.query?.monthRef || getMonthRef()).trim();
  const currentMonth = isValidMonthRef(requestedMonth) ? requestedMonth : getMonthRef();
  const { start, end } = getMonthWindow(currentMonth);

  const [
    clients,
    pools,
    technicians,
    invoices,
    payments,
    technicalAlerts,
    notificationAlerts,
    visits,
    visitAlerts,
  ] = await Promise.all([
    prisma.client.findMany({
      include: { pools: true, invoices: true },
      orderBy: { name: "asc" },
    }),
    prisma.pool.findMany({
      include: { client: true },
      orderBy: { id: "asc" },
    }),
    prisma.technician.findMany({
      orderBy: { name: "asc" },
    }).catch(() => []),
    prisma.invoice.findMany({
      include: { client: true, payments: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      include: { invoice: { include: { client: true } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.technicalAlert.findMany({
      where: { status: { notIn: CLOSED_STATUSES } },
      include: { pool: { include: { client: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }).catch(() => []),
    prisma.notification.findMany({
      where: {
        OR: [
          { type: { in: ALERT_NOTIFICATION_TYPES } },
          { eventType: { in: ALERT_EVENT_TYPES } },
          { severity: { in: ["HIGH", "CRITICAL", "WARNING", "WARN"] } },
        ],
        NOT: { status: { in: CLOSED_STATUSES } },
      },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }).catch(() => []),
    prisma.serviceVisit.findMany({
      where: {
        OR: [
          { plannedDate: { gte: start, lte: end } },
          { date: { gte: start, lte: end } },
        ],
      },
      include: {
        client: true,
        pool: { include: { client: true } },
        technician: true,
      },
      orderBy: [{ plannedDate: "asc" }, { date: "asc" }],
    }).catch(() => []),
    prisma.serviceVisit.findMany({
      where: {
        OR: [
          { alerts: { not: null } },
          { status: { in: ["NOT_DONE", "BLOCKED", "RETAINED", "IMPEDIDO"] } },
        ],
      },
      include: {
        client: true,
        pool: { include: { client: true } },
        technician: true,
      },
      orderBy: [{ updatedAt: "desc" }, { date: "desc" }],
      take: 200,
    }).catch(() => []),
  ]);

  const totalClients = clients.length;
  const totalPools = pools.length;

  const totalBilledAll = invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const totalPaidAll = payments.reduce((sum, payment) => sum + paymentAmount(payment), 0);
  const totalOpenAll = invoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);
  const openInvoicesAll = invoices.filter((invoice) => invoiceOpen(invoice) > 0);
  const overdueClientIds = new Set(openInvoicesAll.map((invoice) => invoice.clientId).filter(Boolean));
  const officialInvoiceClients = clients.filter((client) => client.requiresInvoice);
  const officialInvoicesAll = invoices.filter((invoice) => invoice.requiresInvoice || invoice.client?.requiresInvoice);
  const officialPendingInvoices = officialInvoicesAll.filter((invoice) => (
    invoiceTotal(invoice) > 0 &&
    !invoice.invoiceIssued &&
    !invoice.externalInvoiceNo
  ));

  const monthInvoices = invoices.filter((invoice) => invoiceMonthRef(invoice) === currentMonth);
  const monthBilled = monthInvoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const monthPaid = payments.reduce((sum, payment) => {
    const ref = getMonthRef(new Date(payment.paidAt || payment.createdAt));
    return ref === currentMonth ? sum + paymentAmount(payment) : sum;
  }, 0);
  const monthOpen = monthInvoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);

  const paidInvoices = monthInvoices.filter((invoice) => ["PAID", "PAGO"].includes(normalizeStatus(invoice.status)) || invoiceOpen(invoice) <= 0).length;
  const partialInvoices = monthInvoices.filter((invoice) => {
    const paid = invoicePaid(invoice);
    const open = invoiceOpen(invoice);
    return paid > 0 && open > 0;
  }).length;
  const pendingInvoices = monthInvoices.filter((invoice) => invoiceOpen(invoice) > 0 && invoicePaid(invoice) <= 0).length;

  const topDebtors = invoices
    .map((invoice) => ({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      clientName: invoice.client?.name || "-",
      monthRef: invoiceMonthRef(invoice),
      total: invoiceTotal(invoice),
      amountPaid: invoicePaid(invoice),
      amountOpen: invoiceOpen(invoice),
      status: invoice.status,
    }))
    .filter((invoice) => invoice.amountOpen > 0)
    .sort((a, b) => b.amountOpen - a.amountOpen)
    .slice(0, 15);

  const zoneMap = {};
  pools.forEach((pool) => {
    const zone = pool.zone || pool.location || "Sem zona";
    if (!zoneMap[zone]) zoneMap[zone] = { zone, count: 0 };
    zoneMap[zone].count += 1;
  });

  const latestPayments = payments.slice(0, 15).map((payment) => ({
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    clientId: payment.invoice?.clientId,
    clientName: payment.invoice?.client?.name || "-",
    amount: paymentAmount(payment),
    method: payment.method || "-",
    notes: payment.notes || "",
    paidAt: payment.paidAt,
  }));

  const alertsMapped = [
    ...technicalAlerts.filter((alert) => isOpenAlertStatus(alert.status)).map(mapTechnicalAlert),
    ...notificationAlerts.filter((alert) => isOpenAlertStatus(alert.status)).map(mapNotification),
    ...visitAlerts
      .filter((visit) => String(visit.alerts || visit.reason || visit.status || "").trim())
      .map(mapVisitAlert),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const visitsThisMonth = visits.map(mapVisit);
  const visitsDoneThisMonth = visitsThisMonth.filter((visit) => ["DONE", "COMPLETED", "CONCLUIDA", "CONCLUIDO"].includes(normalizeStatus(visit.status))).length;
  const visitsNotDoneThisMonth = visitsThisMonth.filter((visit) => ["NOT_DONE", "BLOCKED", "RETAINED", "IMPEDIDO"].includes(normalizeStatus(visit.status))).length;
  const visitsPlannedThisMonth = visitsThisMonth.filter((visit) => !["DONE", "COMPLETED", "CONCLUIDA", "CONCLUIDO", "CANCELLED", "CANCELED"].includes(normalizeStatus(visit.status))).length;

  const monthlyMap = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ref = getMonthRef(d);
    monthlyMap[ref] = { billed: 0, paid: 0, open: 0 };
  }

  invoices.forEach((invoice) => {
    const ref = invoiceMonthRef(invoice);
    if (!monthlyMap[ref]) return;
    monthlyMap[ref].billed += invoiceTotal(invoice);
    monthlyMap[ref].open += invoiceOpen(invoice);
  });

  payments.forEach((payment) => {
    const ref = getMonthRef(new Date(payment.paidAt || payment.createdAt));
    if (!monthlyMap[ref]) return;
    monthlyMap[ref].paid += paymentAmount(payment);
  });

  const monthlyEvolution = Object.entries(monthlyMap).map(([month, values]) => ({
    month,
    billed: values.billed,
    paid: values.paid,
    open: values.open,
  }));

  return {
    monthRef: currentMonth,
    summary: {
      totalClients,
      totalPools,
      totalBilledAll,
      totalPaidAll,
      totalOpenAll,
      totalInvoicesAll: invoices.length,
      openInvoicesAll: openInvoicesAll.length,
      overdueInvoices: openInvoicesAll.length,
      overdueClients: overdueClientIds.size,
      overdueAmount: totalOpenAll,
      officialInvoiceClients: officialInvoiceClients.length,
      officialInvoiceTotal: officialInvoicesAll.length,
      officialInvoicePending: officialPendingInvoices.length,
      officialInvoicePendingAmount: officialPendingInvoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0),
      monthBilled,
      monthPaid,
      monthOpen,
      totalInvoices: monthInvoices.length,
      paidInvoices,
      pendingInvoices,
      partialInvoices,
      openAlerts: alertsMapped.length,
      visitsThisMonth: visitsThisMonth.length,
      visitsDoneThisMonth,
      visitsPlannedThisMonth,
      visitsNotDoneThisMonth,
      operationalCost: visitsThisMonth.length * 12,
    },
    technicians,
    visits: visitsThisMonth,
    monthlyEvolution,
    topDebtors,
    latestPayments,
    poolsByZone: Object.values(zoneMap),
    alerts: alertsMapped,
  };
}

async function getAdminDashboard(req, res) {
  try {
    const data = await getAdminDashboardData(req);
    return res.json({ ok: true, ...data });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao obter dashboard",
    });
  }
}

module.exports = {
  getAdminDashboard,
  getAdminDashboardData,
};
