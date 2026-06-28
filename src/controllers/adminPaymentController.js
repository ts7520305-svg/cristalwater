const { prisma } = require("../prismaClient");
const { buildClientPaymentReference } = require("../utils/clientPaymentReference");
const {
  createCreditLedgerPayment,
  invoiceOpen,
  invoicePaid,
  invoiceStatus,
  invoiceTotal,
  moneyLabel: creditMoneyLabel,
} = require("../services/clientCreditService");

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

function moneyLabel(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

async function updateClientFinancialState(clientId) {
  const openCount = await prisma.invoice.count({
    where: {
      clientId,
      OR: [
        { amountOpen: { gt: 0 } },
        { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      ],
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: {
      lastPaymentAt: new Date(),
      paymentStatus: openCount > 0 ? "PARTIAL" : "PAID",
    },
  });
}

function getComputedPaymentStatus({
  monthlyFee,
  repairsTotal,
  extraVisitsTotal,
  lastPaymentAt,
  selectedMonth,
  storedPaymentStatus,
}) {
  const totalDue = Number(monthlyFee || 0) + Number(repairsTotal || 0) + Number(extraVisitsTotal || 0);

  if (totalDue <= 0) {
    return "PAID";
  }

  if (!lastPaymentAt) {
    const nowMonth = new Date().toISOString().slice(0, 7);
    return selectedMonth < nowMonth ? "OVERDUE" : "PENDING";
  }

  const paidMonth = new Date(lastPaymentAt).toISOString().slice(0, 7);

  if (paidMonth === selectedMonth) {
    return "PAID";
  }

  const nowMonth = new Date().toISOString().slice(0, 7);

  if (selectedMonth < nowMonth) {
    return "OVERDUE";
  }

  if (storedPaymentStatus === "PAID" && paidMonth > selectedMonth) {
    return "PAID";
  }

  return "PENDING";
}

function getMonthDifference(fromMonth, toMonth) {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) {
    return 0;
  }

  const [fromYear, fromM] = fromMonth.split("-").map(Number);
  const [toYear, toM] = toMonth.split("-").map(Number);

  return (toYear - fromYear) * 12 + (toM - fromM);
}

function getDaysOverdue(paymentStatus, selectedMonth, lastPaymentAt) {
  if (paymentStatus !== "OVERDUE") return 0;

  const startOfSelectedMonth = new Date(`${selectedMonth}-01T00:00:00.000Z`);
  const now = new Date();

  if (Number.isNaN(startOfSelectedMonth.getTime())) return 0;

  const diffMs = now.getTime() - startOfSelectedMonth.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (!lastPaymentAt) return Math.max(days, 0);

  const lastPaidMonth = new Date(lastPaymentAt).toISOString().slice(0, 7);
  const monthsLate = getMonthDifference(lastPaidMonth, selectedMonth);

  if (monthsLate <= 0) return Math.max(days, 0);

  return Math.max(days, 0);
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
      const totalBeforeCredit = monthlyFee + repairsTotal + extraVisitsTotal;
      const creditBalance = Number(client.creditBalance || 0);
      const totalDue = Math.max(totalBeforeCredit - creditBalance, 0);

      const computedPaymentStatus = totalDue <= 0 ? "PAID" : getComputedPaymentStatus({
        monthlyFee,
        repairsTotal,
        extraVisitsTotal,
        lastPaymentAt: client.lastPaymentAt,
        selectedMonth: month,
        storedPaymentStatus: client.paymentStatus,
      });

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
        daysOverdue: getDaysOverdue(computedPaymentStatus, month, client.lastPaymentAt),
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
    const clientId = Number(req.params.clientId);
    const month = getRequestedMonth(req);
    const amount = Number(req.body?.amount || 0);
    const method = String(req.body?.method || "MANUAL").trim() || "MANUAL";
    const notes = String(req.body?.notes || "").trim();

    if (!clientId || Number.isNaN(clientId)) {
      return res.status(400).json({ ok: false, message: "clientId invalido" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, message: "Indica um valor recebido valido." });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return res.status(404).json({ ok: false, message: "Cliente nao encontrado." });
    }

    const paymentReference = buildClientPaymentReference(client.id);
    const result = await prisma.$transaction(async (tx) => {
      const openInvoices = await tx.invoice.findMany({
        where: {
          clientId: client.id,
          OR: [
            { amountOpen: { gt: 0 } },
            { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          ],
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });

      let remaining = amount;
      let applied = 0;
      const payments = [];
      const invoices = [];

      for (const invoice of openInvoices) {
        if (remaining <= 0) break;
        const open = invoiceOpen(invoice);
        if (open <= 0) continue;

        const payAmount = Math.min(remaining, open);
        const total = invoiceTotal(invoice);
        const paidAfter = invoicePaid(invoice) + payAmount;
        const openAfter = Math.max(open - payAmount, 0);
        const status = invoiceStatus(total, paidAfter, openAfter);

        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: payAmount,
            amountCents: Math.round(payAmount * 100),
            method,
            notes: [paymentReference, notes, `Aplicado a fatura #${invoice.id}`].filter(Boolean).join(" | "),
          },
        });

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: paidAfter,
            amountOpen: openAfter,
            status,
            paidAt: status === "PAID" ? new Date() : invoice.paidAt,
            paymentMethod: method,
          },
        });

        payments.push(payment);
        invoices.push(updatedInvoice);
        applied += payAmount;
        remaining -= payAmount;
      }

      const credit = remaining > 0
        ? await createCreditLedgerPayment(tx, client.id, remaining, { monthRef: month, method, notes, paymentReference })
        : { creditAdded: 0, creditBalance: undefined };

      await tx.communicationLog.create({
        data: {
          clientId: client.id,
          channel: "ADMIN_MANUAL_PAYMENT",
          message: [
            `Pagamento confirmado pelo administrador. Ref. ${paymentReference}. Valor ${moneyLabel(amount)}. Metodo ${method}.`,
            applied > 0 ? `Aplicado em faturas: ${moneyLabel(applied)}.` : "Sem faturas em aberto para abater.",
            credit.creditAdded > 0 ? `Credito positivo criado: ${creditMoneyLabel(credit.creditAdded)}.` : "",
            notes ? `Nota: ${notes}` : "",
          ].filter(Boolean).join(" "),
          referenceId: payments[0]?.id || credit.payment?.id || null,
        },
      });

      return {
        payments,
        invoices,
        appliedAmount: applied,
        creditAdded: credit.creditAdded || 0,
        creditBalance: credit.creditBalance,
      };
    });

    await updateClientFinancialState(client.id);

    return res.json({
      ok: true,
      message: result.creditAdded > 0
        ? `Pagamento registado. ${moneyLabel(result.appliedAmount)} abatido e ${creditMoneyLabel(result.creditAdded)} ficou em credito positivo.`
        : `Pagamento registado em ${client.name} com referencia ${paymentReference}.`,
      paymentReference,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/payments/:clientId/mark-paid
async function markClientPaid(req, res, next) {
  try {
    const clientId = Number(req.params.clientId);
    const month = getRequestedMonth(req);
    const { start, end } = getMonthDateRange(month);

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        paymentStatus: "PAID",
        lastPaymentAt: new Date(),
      },
    });

    const pools = await prisma.pool.findMany({
      where: { clientId },
      select: { id: true },
    });

    const poolIds = pools.map((p) => p.id);

    if (poolIds.length > 0) {
      await prisma.repair.updateMany({
        where: {
          poolId: { in: poolIds },
          status: "INVOICED",
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        data: {
          status: "DONE",
          doneAt: new Date(),
        },
      });
    }

    const report = await prisma.monthlyReport.findFirst({
      where: {
        clientId,
        month,
        type: "EXTRA_VISITS",
      },
    });

    if (report) {
      const parsed = normalizeReportData(report.data);

      const nextItems = parsed.items.map((item) => {
        if (String(item?.source || "") === "EXTRA_VISIT") {
          return {
            ...item,
            paid: true,
            paidAt: new Date().toISOString(),
          };
        }
        return item;
      });

      await prisma.monthlyReport.update({
        where: { id: report.id },
        data: {
          data: {
            ...parsed,
            items: nextItems,
          },
        },
      });
    }

    res.json({
      ok: true,
      message: "Pagamento marcado como pago",
      client,
      month,
    });
  } catch (err) {
    next(err);
  }
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
