// ==========================================
// CRISTAL WATER - ADMIN EMAIL LOG CONTROLLER
// ==========================================

const prismaModule = require("../prismaClient");
const prisma = prismaModule.prisma;

async function listEmailLogs(req, res, next) {
  try {
    const {
      status,
      type,
      mode,
      recipient,
      q,
      from,
      to,
      page = "1",
      pageSize = "25",
    } = req.query;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 100);

    const AND = [];

    if (status) AND.push({ status });
    if (type) AND.push({ type });
    if (mode) AND.push({ mode });

    if (recipient) {
      AND.push({
        toEmail: { contains: recipient, mode: "insensitive" },
      });
    }

    if (q) {
      AND.push({
        OR: [
          { subject: { contains: q, mode: "insensitive" } },
          { error: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (from) {
      AND.push({ createdAt: { gte: new Date(from + "T00:00:00") } });
    }

    if (to) {
      AND.push({ createdAt: { lte: new Date(to + "T23:59:59") } });
    }

    const where = AND.length ? { AND } : {};

    const total = await prisma.emailLog.count({ where });

    const items = await prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });

    res.json({
      ok: true,
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize),
      items,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listEmailLogs };