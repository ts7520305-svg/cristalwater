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

async function startWorkday({ userId }) {
  const normalizedUserId = normalizeUserId(userId);
  const today = toDateOnly(new Date());

  return prisma.$transaction(async (tx) => {
    await ensureUserExists(tx, normalizedUserId);

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
        message: "Dia já iniciado",
        idempotent: true,
        workDay: exists,
      };
    }

    const workDay = await tx.technicianWorkDay.create({
      data: {
        userId: normalizedUserId,
        date: today,
        status: "ACTIVE",
      },
    });

    return { ok: true, status: 201, message: "Jornada iniciada", idempotent: false, workDay };
  });
}

async function endWorkday({ userId }) {
  const normalizedUserId = normalizeUserId(userId);
  const today = toDateOnly(new Date());

  return prisma.$transaction(async (tx) => {
    await ensureUserExists(tx, normalizedUserId);

    const workDay = await tx.technicianWorkDay.updateMany({
      where: {
        userId: normalizedUserId,
        date: today,
        status: "ACTIVE",
      },
      data: {
        status: "CLOSED",
        endAt: new Date(),
      },
    });

    if (!workDay.count) {
      throw businessError("Não existe jornada ativa para encerrar", 409, "NO_ACTIVE_WORKDAY", { userId: normalizedUserId });
    }

    return { ok: true, status: 200, message: "Jornada encerrada", updatedCount: workDay.count };
  });
}

async function getWorkdayStatus({ userId }) {
  const normalizedUserId = normalizeUserId(userId);
  const today = toDateOnly(new Date());

  return prisma.$transaction(async (tx) => {
    await ensureUserExists(tx, normalizedUserId);

    const workDay = await tx.technicianWorkDay.findFirst({
      where: {
        userId: normalizedUserId,
        date: today,
      },
    });

    return { ok: true, status: 200, workDay };
  });
}

module.exports = {
  startWorkday,
  endWorkday,
  getWorkdayStatus,
};
