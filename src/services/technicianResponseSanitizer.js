const { normalizeRole } = require("../utils/roles");

function safeClient(client) {
  if (!client || typeof client !== "object") return client || null;

  return {
    id: client.id ?? null,
    name: client.name ?? null,
    address: client.address ?? null,
    zone: client.zone ?? null,
    latitude: client.latitude ?? null,
    longitude: client.longitude ?? null,
    arrivalNotify: client.arrivalNotify ?? false,
    arrivalAllowed: client.arrivalAllowed ?? true,
    accesses: Array.isArray(client.accesses)
      ? client.accesses.filter((item) => item && item.active !== false && item.visibleToTechnician !== false)
      : undefined,
    operationalReminders: Array.isArray(client.operationalReminders)
      ? client.operationalReminders.filter((item) => item && item.isCompleted !== true)
      : undefined,
  };
}

function safeTechnician(technician) {
  if (!technician || typeof technician !== "object") return technician || null;
  return {
    id: technician.id ?? null,
    name: technician.name ?? null,
    role: technician.role ?? null,
    zone: technician.zone ?? null,
    vehicleId: technician.vehicleId ?? null,
    vehicle: technician.vehicle
      ? {
          id: technician.vehicle.id ?? null,
          plate: technician.vehicle.plate ?? null,
          name: technician.vehicle.name ?? null,
          status: technician.vehicle.status ?? null,
        }
      : undefined,
  };
}

function safePool(pool) {
  if (!pool || typeof pool !== "object") return pool || null;
  const copy = { ...pool };
  if (Object.prototype.hasOwnProperty.call(copy, "client")) copy.client = safeClient(copy.client);
  delete copy.monthlyAmount;
  return copy;
}

function safeVisit(visit) {
  if (!visit || typeof visit !== "object") return visit || null;
  const copy = { ...visit };

  // Financial and billing fields never belong in the field-technician payload.
  ["cost", "revenue", "profit", "billed", "billedAt"].forEach((key) => delete copy[key]);

  if (Object.prototype.hasOwnProperty.call(copy, "client")) copy.client = safeClient(copy.client);
  if (Object.prototype.hasOwnProperty.call(copy, "pool")) copy.pool = safePool(copy.pool);
  if (Object.prototype.hasOwnProperty.call(copy, "technician")) copy.technician = safeTechnician(copy.technician);

  return copy;
}

function safeContext(context) {
  if (!context || typeof context !== "object") return context || null;
  const copy = { ...context };

  if (copy.customer && typeof copy.customer === "object") {
    copy.customer = {
      id: copy.customer.id ?? null,
      name: copy.customer.name ?? null,
      zone: copy.customer.zone ?? null,
    };
  }

  return copy;
}

function sanitizeTechnicianVisitDetailPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    ...payload,
    visit: safeVisit(payload.visit),
    context: safeContext(payload.context),
  };
}

function shouldSanitizeTechnicianVisitDetail(req, role) {
  if (normalizeRole(role) !== "TECHNICIAN") return false;
  if (String(req?.method || "").toUpperCase() !== "GET") return false;
  const path = String(req?.originalUrl || req?.url || "").split("?")[0];
  return /^\/api\/visits\/\d+\/?$/.test(path);
}

module.exports = {
  safeClient,
  safeTechnician,
  safePool,
  safeVisit,
  safeContext,
  sanitizeTechnicianVisitDetailPayload,
  shouldSanitizeTechnicianVisitDetail,
};
