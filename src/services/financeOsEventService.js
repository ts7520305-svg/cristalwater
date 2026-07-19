const Kernel = require("../core/Kernel");

const EVENT_TYPES = {
  FINANCE_INVOICE_DRAFT: "FINANCE_INVOICE_DRAFT",
  FINANCE_INVOICE_ISSUED: "FINANCE_INVOICE_ISSUED",
  FINANCE_INVOICE_SENT: "FINANCE_INVOICE_SENT",
  FINANCE_INVOICE_CANCELLED: "FINANCE_INVOICE_CANCELLED",
  FINANCE_PAYMENT_CONFIRMED: "FINANCE_PAYMENT_CONFIRMED",
  FINANCE_OVERDUE_DETECTED: "FINANCE_OVERDUE_DETECTED",
  FINANCE_CREDIT_NOTE_CREATED: "FINANCE_CREDIT_NOTE_CREATED",
  FINANCE_REMINDER_SENT: "FINANCE_REMINDER_SENT",
};

function emitSocket(eventName, payload) {
  if (!global.io || typeof global.io.emit !== "function") return;
  global.io.emit(eventName, payload);
  global.io.emit("dashboard-refresh", { reason: eventName, payload });
}

async function emitFinanceEvent(eventName, payload = {}, metadata = {}) {
  const finalPayload = {
    ...payload,
    eventType: eventName,
    source: payload.source || "finance-os",
  };

  emitSocket(eventName, finalPayload);

  if (!Kernel?.EventBus || typeof Kernel.EventBus.emit !== "function") {
    return null;
  }

  try {
    return await Kernel.EventBus.emit(eventName, finalPayload, {
      ...metadata,
      module: "finance-os",
    });
  } catch (error) {
    console.warn(`[FinanceOS] failed to emit ${eventName}:`, error.message);
    return null;
  }
}

module.exports = {
  EVENT_TYPES,
  emitFinanceEvent,
};
