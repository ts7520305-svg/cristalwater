const Kernel = require("../core/Kernel");

const EVENT_TYPES = {
  REPAIR_TICKET_CREATED: "REPAIR_TICKET_CREATED",
  REPAIR_DIAGNOSED: "REPAIR_DIAGNOSED",
  REPAIR_SCHEDULED: "REPAIR_SCHEDULED",
  REPAIR_STOCK_RESERVED: "REPAIR_STOCK_RESERVED",
  REPAIR_STOCK_RELEASED: "REPAIR_STOCK_RELEASED",
  REPAIR_STOCK_CONSUMED: "REPAIR_STOCK_CONSUMED",
  REPAIR_PHOTO_UPLOADED: "REPAIR_PHOTO_UPLOADED",
  REPAIR_QUOTED: "REPAIR_QUOTED",
  REPAIR_APPROVED: "REPAIR_APPROVED",
  REPAIR_INVOICED: "REPAIR_INVOICED",
  REPAIR_INVOICE_GENERATED: "REPAIR_INVOICE_GENERATED",
  REPAIR_PAYMENT_RECORDED: "REPAIR_PAYMENT_RECORDED",
  REPAIR_CLOSED: "REPAIR_CLOSED",
  REPAIR_COMPLETED: "REPAIR_COMPLETED",
  REPAIR_CANCELLED: "REPAIR_CANCELLED",
  REPAIR_MESSAGE_SENT: "REPAIR_MESSAGE_SENT",
  REPAIR_DELETED: "REPAIR_DELETED",
};

function emitSocket(eventName, payload) {
  if (!global.io || typeof global.io.emit !== "function") return;
  global.io.emit(eventName, payload);
  global.io.emit("dashboard-refresh", { reason: eventName, payload });
}

async function emitRepairEvent(eventName, payload = {}, metadata = {}) {
  const finalPayload = {
    ...payload,
    eventType: eventName,
    source: payload.source || "repair-os",
  };

  emitSocket(eventName, finalPayload);

  if (!Kernel?.EventBus || typeof Kernel.EventBus.emit !== "function") {
    return null;
  }

  try {
    return await Kernel.EventBus.emit(eventName, finalPayload, {
      ...metadata,
      module: "repair-os",
    });
  } catch (error) {
    console.warn(`[RepairOS] failed to emit ${eventName}:`, error.message);
    return null;
  }
}

module.exports = {
  EVENT_TYPES,
  emitRepairEvent,
};