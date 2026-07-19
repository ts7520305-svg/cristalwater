const Kernel = require("../core/Kernel");

const EVENT_TYPES = {
  ADMINISTRATION_MODULE_CREATED: "ADMINISTRATION_MODULE_CREATED",
  ADMINISTRATION_HR_UPDATED: "ADMINISTRATION_HR_UPDATED",
  ADMINISTRATION_VEHICLES_UPDATED: "ADMINISTRATION_VEHICLES_UPDATED",
  ADMINISTRATION_FLEET_UPDATED: "ADMINISTRATION_FLEET_UPDATED",
  ADMINISTRATION_PURCHASE_CREATED: "ADMINISTRATION_PURCHASE_CREATED",
  ADMINISTRATION_SUPPLIERS_UPDATED: "ADMINISTRATION_SUPPLIERS_UPDATED",
  ADMINISTRATION_INTERNAL_TASKS_UPDATED: "ADMINISTRATION_INTERNAL_TASKS_UPDATED",
  ADMINISTRATION_KPIS_UPDATED: "ADMINISTRATION_KPIS_UPDATED",
  ADMINISTRATION_DASHBOARD_UPDATED: "ADMINISTRATION_DASHBOARD_UPDATED",
  ADMINISTRATION_PRODUCTIVITY_UPDATED: "ADMINISTRATION_PRODUCTIVITY_UPDATED",
  ADMINISTRATION_VACATION_REGISTERED: "ADMINISTRATION_VACATION_REGISTERED",
  ADMINISTRATION_ABSENCE_REGISTERED: "ADMINISTRATION_ABSENCE_REGISTERED",
  ADMINISTRATION_MESSAGE_SENT: "ADMINISTRATION_MESSAGE_SENT",
  ADMINISTRATION_APPROVAL_REGISTERED: "ADMINISTRATION_APPROVAL_REGISTERED",
  ADMINISTRATION_REPORT_UPDATED: "ADMINISTRATION_REPORT_UPDATED",
  ADMINISTRATION_AUDIT_REGISTERED: "ADMINISTRATION_AUDIT_REGISTERED",
  ADMINISTRATION_NOTIFICATION_SENT: "ADMINISTRATION_NOTIFICATION_SENT",
  ADMINISTRATION_COMPLETED: "ADMINISTRATION_COMPLETED",
};

function emitSocket(eventName, payload) {
  if (!global.io || typeof global.io.emit !== "function") return;
  global.io.emit(eventName, payload);
  global.io.emit("dashboard-refresh", { reason: eventName, payload });
}

async function emitAdministrationEvent(eventName, payload = {}, metadata = {}) {
  const finalPayload = {
    ...payload,
    eventType: eventName,
    source: payload.source || "administration-os",
  };

  emitSocket(eventName, finalPayload);

  if (!Kernel?.EventBus || typeof Kernel.EventBus.emit !== "function") {
    return null;
  }

  try {
    return await Kernel.EventBus.emit(eventName, finalPayload, {
      ...metadata,
      module: "administration-os",
    });
  } catch (error) {
    console.warn(`[AdministrationOS] failed to emit ${eventName}:`, error.message);
    return null;
  }
}

module.exports = {
  EVENT_TYPES,
  emitAdministrationEvent,
};
