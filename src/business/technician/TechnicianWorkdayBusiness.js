const { prisma } = require("../../prismaClient");

function businessError(message, statusCode, code, details) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function toDateOnly(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function requestedDate(value, writing = false) {
  const today = toDateOnly();
  if (value === undefined) return today;
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : new Date(NaN);
  if (!Number.isFinite(date.getTime()) || dayKey(date) !== value) throw businessError('Data da jornada inválida', 422, 'INVALID_WORKDAY_DATE');
  if (writing && date.getTime() !== today.getTime()) throw businessError('O dia mudou. O pedido original foi preservado; confirme a jornada indicada com o escritório.', 409, 'WORKDAY_DATE_CHANGED');
  return date;
}

function resultContext(userId, date, workDay) {
  return { userId, date: dayKey(date), dayStart: date.toISOString(), workDay };
}

function checkWorkdayId(value, workDay) {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value <= 0 || value !== workDay?.id) throw businessError('A jornada mudou. Consulte o estado antes de encerrar.', 409, 'WORKDAY_CHANGED');
}

function normalizeUserId(rawUserId) {
  const value = Number(rawUserId);
  if (!Number.isInteger(value) || value <= 0) {
    throw businessError("userId inválido", 422, "INVALID_REFERENCE");
  }
  return value;
}

async function ensureUserExists(tx, userId) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, active: true },
  });

  if (!user) {
    throw businessError("Utilizador não encontrado para jornada", 404, "USER_NOT_FOUND", { userId });
  }

  if (!user.active) {
    throw businessError("Utilizador inativo para jornada", 422, "INACTIVE_USER", { userId });
  }

  return user;
}

async function startWorkday({ userId, date }) {
  const normalizedUserId = normalizeUserId(userId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${normalizedUserId} FOR UPDATE`;
    await ensureUserExists(tx, normalizedUserId);
    const today = requestedDate(date, true);

    const exists = await tx.technicianWorkDay.findFirst({
      where: {
        userId: normalizedUserId,
        date: today,
      },
    });

    if (exists) {
      return {
        ok: true,
        status: 200,
        message: exists.status === 'CLOSED' ? 'Jornada já encerrada' : 'Dia já iniciado',
        idempotent: true,
        ...resultContext(normalizedUserId, today, exists),
      };
    }

    const workDay = await tx.technicianWorkDay.create({
      data: {
        userId: normalizedUserId,
        date: today,
        status: "ACTIVE",
      },
    });

    return { ok: true, status: 201, message: "Jornada iniciada", idempotent: false, ...resultContext(normalizedUserId, today, workDay) };
  });
}

async function endWorkday({ userId, date, workDayId }) {
  const normalizedUserId = normalizeUserId(userId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${normalizedUserId} FOR UPDATE`;
    await ensureUserExists(tx, normalizedUserId);
    const today = requestedDate(date, true);
    const existing = await tx.technicianWorkDay.findUnique({ where: { userId_date: { userId: normalizedUserId, date: today } } });
    checkWorkdayId(workDayId, existing);
    if (!existing || !['ACTIVE', 'CLOSED'].includes(existing.status)) {
      throw businessError("Não existe jornada ativa para encerrar", 409, "NO_ACTIVE_WORKDAY", { userId: normalizedUserId });
    }
    if (existing.status === 'CLOSED') return { ok: true, status: 200, message: 'Jornada já encerrada', updatedCount: 0, idempotent: true, ...resultContext(normalizedUserId, today, existing) };
    const workDay = await tx.technicianWorkDay.update({ where: { id: existing.id }, data: { status: 'CLOSED', endAt: new Date() } });
    return { ok: true, status: 200, message: "Jornada encerrada", updatedCount: 1, idempotent: false, ...resultContext(normalizedUserId, today, workDay) };
  });
}

async function getWorkdayStatus({ userId, date }) {
  const normalizedUserId = normalizeUserId(userId);
  const today = requestedDate(date);

  return prisma.$transaction(async (tx) => {
    await ensureUserExists(tx, normalizedUserId);

    const workDay = await tx.technicianWorkDay.findFirst({
      where: {
        userId: normalizedUserId,
        date: today,
      },
    });

    return { ok: true, status: 200, ...resultContext(normalizedUserId, today, workDay) };
  });
}

module.exports = {
  startWorkday,
  endWorkday,
  getWorkdayStatus,
};
