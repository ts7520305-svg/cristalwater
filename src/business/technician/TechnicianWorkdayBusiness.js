const { prisma } = require("../../prismaClient");

function toDateOnly(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function startWorkday({ userId }) {
  if (!userId) {
    return { ok: false, message: "userId obrigatório" };
  }

  const today = toDateOnly(new Date());
  const exists = await prisma.technicianWorkDay.findFirst({
    where: {
      userId: Number(userId),
      date: today,
    },
  });

  if (exists) {
    return {
      ok: true,
      message: "Dia já iniciado",
      workDay: exists,
    };
  }

  const workDay = await prisma.technicianWorkDay.create({
    data: {
      userId: Number(userId),
      date: today,
      status: "ACTIVE",
    },
  });

  return { ok: true, workDay };
}

async function endWorkday({ userId }) {
  const today = toDateOnly(new Date());
  const workDay = await prisma.technicianWorkDay.updateMany({
    where: {
      userId: Number(userId),
      date: today,
      status: "ACTIVE",
    },
    data: {
      status: "CLOSED",
      endAt: new Date(),
    },
  });

  return { ok: true, workDay };
}

async function getWorkdayStatus({ userId }) {
  const today = toDateOnly(new Date());
  const workDay = await prisma.technicianWorkDay.findFirst({
    where: {
      userId: Number(userId),
      date: today,
    },
  });

  return { ok: true, workDay };
}

module.exports = {
  startWorkday,
  endWorkday,
  getWorkdayStatus,
};
