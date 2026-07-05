const EVENT_TYPES = {
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  POOL_CREATED: "pool.created",
  POOL_UPDATED: "pool.updated",
  TECHNICIAN_CREATED: "technician.created",
  VISIT_SCHEDULED: "visit.scheduled",
  VISIT_STARTED: "visit.started",
  VISIT_COMPLETED: "visit.completed",
  EXTRA_CREATED: "extra.created",
  BILLING_PENDING: "billing.pending",
  PAYMENT_RECEIVED: "payment.received",
};

function createEvent(type, payload = {}, context = {}) {
  return {
    type,
    payload,
    context,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  EVENT_TYPES,
  createEvent,
};
