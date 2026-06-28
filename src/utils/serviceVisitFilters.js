function parseLocalDay(value) {
  const raw = value || new Date();
  const date =
    typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T00:00:00`)
      : new Date(raw);

  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const start = new Date(
    safeDate.getFullYear(),
    safeDate.getMonth(),
    safeDate.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start,
    end,
    isoDate: [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      String(start.getDate()).padStart(2, "0")
    ].join("-")
  };
}

function toPositiveInt(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serviceVisitDayWhere(start, end) {
  return {
    OR: [
      { plannedDate: { gte: start, lt: end } },
      { date: { gte: start, lt: end } },
      { startAt: { gte: start, lt: end } },
      { endAt: { gte: start, lt: end } }
    ]
  };
}

function serviceVisitActiveWhere() {
  return {
    status: {
      notIn: [
        "CANCELLED",
        "CANCELED",
        "CANCELADA",
        "CANCELADO",
        "ARCHIVED",
        "ARQUIVADA",
        "ARQUIVADO"
      ]
    }
  };
}

function buildServiceVisitDayQuery(query = {}) {
  const { start, end, isoDate } = parseLocalDay(
    query.date || query.day || query.plannedDate
  );
  const technicianId = toPositiveInt(
    query.technicianId || query.techId || query.userId
  );
  const and = [
    serviceVisitDayWhere(start, end),
    serviceVisitActiveWhere()
  ];

  if (technicianId) {
    and.push({ technicianId });
  }

  return {
    where: { AND: and },
    start,
    end,
    isoDate,
    technicianId
  };
}

module.exports = {
  buildServiceVisitDayQuery,
  parseLocalDay,
  serviceVisitDayWhere,
  toPositiveInt
};
