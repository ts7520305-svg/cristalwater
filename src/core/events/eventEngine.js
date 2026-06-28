const eventStore = [];

function createEvent({
  type,
  entityType = null,
  entityId = null,
  actorType = null,
  actorId = null,
  payload = {},
  source = "system",
}) {
  if (!type) {
    throw new Error("Event type is required");
  }

  const event = {
    id: Date.now().toString(),
    type,
    entityType,
    entityId,
    actorType,
    actorId,
    payload,
    source,
    createdAt: new Date().toISOString(),
  };

  eventStore.push(event);

  return event;
}

function listEvents(filters = {}) {
  return eventStore.filter((event) => {
    if (filters.type && event.type !== filters.type) return false;
    if (filters.entityType && event.entityType !== filters.entityType) return false;
    if (filters.entityId && event.entityId !== filters.entityId) return false;
    return true;
  });
}

module.exports = {
  createEvent,
  listEvents,
};
