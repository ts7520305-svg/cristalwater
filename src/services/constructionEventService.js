const Kernel = require("../core/Kernel");

const EVENT_TYPES = {
  CONSTRUCTION_PROJECT_CREATED: "CONSTRUCTION_PROJECT_CREATED",
  CONSTRUCTION_CUSTOMER_APPROVED: "CONSTRUCTION_CUSTOMER_APPROVED",
  CONSTRUCTION_BUDGET_DEFINED: "CONSTRUCTION_BUDGET_DEFINED",
  CONSTRUCTION_PLANNED: "CONSTRUCTION_PLANNED",
  CONSTRUCTION_PHASE_UPDATED: "CONSTRUCTION_PHASE_UPDATED",
  CONSTRUCTION_MATERIALS_PLANNED: "CONSTRUCTION_MATERIALS_PLANNED",
  CONSTRUCTION_STOCK_RESERVED: "CONSTRUCTION_STOCK_RESERVED",
  CONSTRUCTION_TEAM_ASSIGNED: "CONSTRUCTION_TEAM_ASSIGNED",
  CONSTRUCTION_DAILY_LOG_ADDED: "CONSTRUCTION_DAILY_LOG_ADDED",
  CONSTRUCTION_PHOTO_ADDED: "CONSTRUCTION_PHOTO_ADDED",
  CONSTRUCTION_PROGRESS_UPDATED: "CONSTRUCTION_PROGRESS_UPDATED",
  CONSTRUCTION_VARIATION_CREATED: "CONSTRUCTION_VARIATION_CREATED",
  CONSTRUCTION_VARIATION_APPROVED: "CONSTRUCTION_VARIATION_APPROVED",
  CONSTRUCTION_BILLING_MILESTONE: "CONSTRUCTION_BILLING_MILESTONE",
  CONSTRUCTION_FINAL_INSPECTION: "CONSTRUCTION_FINAL_INSPECTION",
  CONSTRUCTION_FINAL_HANDOVER: "CONSTRUCTION_FINAL_HANDOVER",
  CONSTRUCTION_WARRANTY_REGISTERED: "CONSTRUCTION_WARRANTY_REGISTERED",
  CONSTRUCTION_CUSTOMER_NOTIFIED: "CONSTRUCTION_CUSTOMER_NOTIFIED",
  CONSTRUCTION_DASHBOARD_SYNCED: "CONSTRUCTION_DASHBOARD_SYNCED",
  CONSTRUCTION_COMPLETED: "CONSTRUCTION_COMPLETED",
};

function emitSocket(eventName, payload) {
  if (!global.io || typeof global.io.emit !== "function") return;
  global.io.emit(eventName, payload);
  global.io.emit("dashboard-refresh", { reason: eventName, payload });
}

async function emitConstructionEvent(eventName, payload = {}, metadata = {}) {
  const finalPayload = {
    ...payload,
    eventType: eventName,
    source: payload.source || "construction-os",
  };

  emitSocket(eventName, finalPayload);

  if (!Kernel?.EventBus || typeof Kernel.EventBus.emit !== "function") {
    return null;
  }

  try {
    return await Kernel.EventBus.emit(eventName, finalPayload, {
      ...metadata,
      module: "construction-os",
    });
  } catch (error) {
    console.warn(`[ConstructionOS] failed to emit ${eventName}:`, error.message);
    return null;
  }
}

module.exports = {
  EVENT_TYPES,
  emitConstructionEvent,
};
