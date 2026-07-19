const Kernel = require("../core/Kernel");
const { EVENT_TYPES } = require("../core/crystal/events/EventEngine");

function emitToSocket(eventName, payload) {
  if (!global.io || typeof global.io.emit !== "function") return;
  global.io.emit(eventName, payload);
}

async function emitRouteEvent(eventName, payload = {}, metadata = {}) {
  const finalPayload = {
    ...payload,
    eventType: eventName,
    source: payload.source || "route-os",
  };

  emitToSocket(eventName, finalPayload);

  if (!Kernel?.EventBus || typeof Kernel.EventBus.emit !== "function") {
    return null;
  }

  try {
    return await Kernel.EventBus.emit(eventName, finalPayload, {
      ...metadata,
      module: "route-os",
    });
  } catch (error) {
    console.warn(`[RouteOS] failed to emit ${eventName}:`, error.message);
    return null;
  }
}

function emitRoutePlanned(payload = {}, metadata = {}) {
  return emitRouteEvent(EVENT_TYPES.ROUTE_PLANNED, payload, metadata);
}

function emitRouteLoaded(payload = {}, metadata = {}) {
  return emitRouteEvent(EVENT_TYPES.ROUTE_LOADED, payload, metadata);
}

function emitRouteStopStarted(payload = {}, metadata = {}) {
  return emitRouteEvent(EVENT_TYPES.ROUTE_STOP_STARTED, payload, metadata);
}

function emitRouteStopCompleted(payload = {}, metadata = {}) {
  return emitRouteEvent(EVENT_TYPES.ROUTE_STOP_COMPLETED, payload, metadata);
}

function emitRouteSyncRequired(payload = {}, metadata = {}) {
  return emitRouteEvent(EVENT_TYPES.ROUTE_SYNC_REQUIRED, payload, metadata);
}

module.exports = {
  EVENT_TYPES,
  emitRouteEvent,
  emitRoutePlanned,
  emitRouteLoaded,
  emitRouteStopStarted,
  emitRouteStopCompleted,
  emitRouteSyncRequired,
};