const Kernel = require("../core/Kernel");

const EVENT_TYPES = {
  EQUIPMENT_INSTALLATION: "EQUIPMENT_INSTALLATION",
  EQUIPMENT_STATUS_CHANGED: "EQUIPMENT_STATUS_CHANGED",
  EQUIPMENT_MAINTENANCE_SCHEDULED: "EQUIPMENT_MAINTENANCE_SCHEDULED",
  EQUIPMENT_WARRANTY_UPDATED: "EQUIPMENT_WARRANTY_UPDATED",
  STOCK_TRANSFERRED: "STOCK_TRANSFERRED",
  STOCK_RESERVED: "STOCK_RESERVED",
  STOCK_RELEASED: "STOCK_RELEASED",
  STOCK_CONSUMED: "STOCK_CONSUMED",
  STOCK_MIN_ALERT: "STOCK_MIN_ALERT",
  STOCK_PURCHASE_SUGGESTION: "STOCK_PURCHASE_SUGGESTION",
};

function emitSocket(eventName, payload) {
  if (!global.io || typeof global.io.emit !== "function") return;
  global.io.emit(eventName, payload);
}

async function emitEquipmentStockEvent(eventName, payload = {}, metadata = {}) {
  const body = {
    ...payload,
    eventType: eventName,
    source: payload.source || "equipment-stock-os",
  };

  emitSocket(eventName, body);

  if (!Kernel?.EventBus || typeof Kernel.EventBus.emit !== "function") {
    return null;
  }

  try {
    return await Kernel.EventBus.emit(eventName, body, {
      ...metadata,
      module: "equipment-stock-os",
    });
  } catch (error) {
    console.warn(`[EquipmentStockOS] failed to emit ${eventName}:`, error.message);
    return null;
  }
}

module.exports = {
  EVENT_TYPES,
  emitEquipmentStockEvent,
};
