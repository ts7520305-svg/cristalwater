const { prisma } = require("../prismaClient");
const { buildClientPaymentReference } = require("../utils/clientPaymentReference");
const { invoiceOpen } = require('../services/clientCreditService');
const ClientReceiptBusiness = require('../business/finance/ClientReceiptBusiness');

function getRequestedMonth(req) {
  const month = String(req.query.month || "").trim();
  if (/^\d{4}-\d{2}$/.test(month)) return month;
  return new Date().toISOString().slice(0, 7);
}

function normalizeReportData(data) {
  if (Array.isArray(data)) {
    return { items: data };
  }

  if (data && typeof data === "object") {
    return {
      ...data,
      items: Array.isArray(data.items) ? data.items : [],
    };
  }

  return { items: [] };
}

function getMonthDateRange(month) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return { start, end };
}

// GET /api/admin/payments
async function listClientPayments(req, res, next) {
  try {
    const month = getRequestedMonth(req);
    const { start, end } = getMonthDateRange(month);

    const clients = await prisma.client.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        paymentReminderWhatsappNumber: true,
        paymentReminderEmailAddress: true,
        monthlyFee: true,
        creditBalance: true,
        invoices: { select: { id: true, status: true, amount: true, total: true, totalAmount: true, amountPaid: true, amountOpen: true, dueDate: true } },
        paymentStatus: true,
        lastPaymentAt: true,
        lastReminderAt: true,
        lastReminderMonth: true,
        pools: {
          select: {
            id: true,
            name: true,
            repairs: {
              where: {
                status: "INVOICED",
                createdAt: {
                  gte: start,
                  lte: end,
                },
              },
              select: {
                id: true,
                problem: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
                status: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
        reports: {
          where: {
            month,
            type: "EXTRA_VISITS",
          },
          select: {
            id: true,
            month: true,
            type: true,
            data: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = clients.map((client) => {
      const invoicedRepairs = client.pools.flatMap((pool) =>
        pool.repairs.map((repair) => ({
          ...repair,
          poolId: pool.id,
          poolName: pool.name,
        }))
      );

      const repairsTotal = invoicedRepairs.reduce((sum, repair) => {
        return sum + Number(repair.totalPrice || 0);
      }, 0);

      const extraVisitItems = client.reports.flatMap((report) => {
        const parsed = normalizeReportData(report.data);

        return parsed.items
          .filter((item) => String(item?.source || "") === "EXTRA_VISIT")
          .map((item) => ({
            visitId: item.visitId ?? null,
            poolId: item.poolId ?? null,
            clientId: item.clientId ?? client.id,
            poolName: item.poolName || "-",
            date: item.date || null,
            amount: Number(item.amount || 0),
            billingMode: item.billingMode || "EXTRA",
            status: item.status || "DONE",
            source: item.source || "EXTRA_VISIT",
            notes: item.notes || null,
            paid: Boolean(item.paid),
            paidAt: item.paidAt || null,
          }));
      });

      const extraVisitsTotal = extraVisitItems.reduce((sum, item) => {
        return sum + Number(item.amount || 0);
      }, 0);

      const monthlyFee = Number(client.monthlyFee || 0);
      const creditBalance = Number(client.creditBalance || 0);
      const openInvoices = client.invoices.filter(invoice => invoiceOpen(invoice) > 0);
      const totalDue = openInvoices.reduce((sum, invoice) => sum + Math.round(invoiceOpen(invoice) * 100), 0) / 100;
      const totalBeforeCredit = totalDue;
      const overdueInvoices = openInvoices.filter(invoice => invoice.status === 'OVERDUE' || (invoice.dueDate && invoice.dueDate < new Date()));
      const computedPaymentStatus = totalDue <= 0 ? 'PAID' : overdueInvoices.length ? 'OVERDUE' : 'PENDING';
      const daysOverdue = overdueInvoices.reduce((days, invoice) => Math.max(days, invoice.dueDate ? Math.floor((Date.now() - invoice.dueDate.getTime()) / 86400000) : 0), 0);

      const finalEmail = client.paymentReminderEmailAddress || client.email || null;
      const finalPhone = client.paymentReminderWhatsappNumber || client.phone || null;
      const missingContact = !finalEmail && !finalPhone;

      return {
        id: client.id,
        name: client.name,
        paymentReference: buildClientPaymentReference(client.id),
        email: client.email,
        phone: client.phone,
        paymentReminderWhatsappNumber: client.paymentReminderWhatsappNumber,
        paymentReminderEmailAddress: client.paymentReminderEmailAddress,
        monthlyFee,
        creditBalance,
        totalBeforeCredit,
        paymentStatus: computedPaymentStatus,
        storedPaymentStatus: client.paymentStatus,
        lastPaymentAt: client.lastPaymentAt,
        lastReminderAt: client.lastReminderAt,
        lastReminderMonth: client.lastReminderMonth,
        invoicedRepairs,
        repairsTotal,
        invoicedExtraVisits: extraVisitItems,
        extraVisitsTotal,
        totalDue,
        month,
        daysOverdue,
        openInvoicesCount: openInvoices.length,
        finalEmail,
        finalPhone,
        missingContact,
      };
    });

    res.json({
      month,
      count: result.length,
      clients: result,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/payments/:clientId/manual-received
async function registerManualReceived(req, res, next) {
  try {
    const month = req.query.month === undefined ? new Date().toISOString().slice(0, 7) : req.query.month;
    return res.json(await ClientReceiptBusiness.registerReceived(req.params.clientId, month, req.body || {}, req.user));
  } catch (error) {
    if ([400, 404, 409].includes(error.status)) return res.status(error.status).json({ ok: false, error: error.message, message: error.message });
    next(error);
  }
}

// POST /api/admin/payments/:clientId/mark-paid
function markClientPaid(req, res) {
  return res.status(409).json({ ok: false, message: 'Regista o valor recebido para liquidar as faturas. A marcação sem recebimento foi desativada.' });
}

// POST /api/admin/payments/:clientId/mark-reminded
async function markClientReminded(req, res, next) {
  try {
    const clientId = Number(req.params.clientId);
    const month = getRequestedMonth(req);

    if (Number.isNaN(clientId)) {
      return res.status(400).json({
        ok: false,
        message: "clientId inválido",
      });
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        lastReminderAt: new Date(),
        lastReminderMonth: month,
      },
    });

    res.json({
      ok: true,
      message: "Cliente marcado como avisado",
      client: updated,
      month,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listClientPayments,
  markClientPaid,
  markClientReminded,
  registerManualReceived,
};
