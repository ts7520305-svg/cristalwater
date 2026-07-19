import { describe, it, expect, beforeEach, vi } from "vitest";

const Kernel = require("../src/core/Kernel");

describe("Route OS events", () => {
  beforeEach(() => {
    Kernel.EventBus.clearHistory();
    global.io = {
      emit: vi.fn(),
    };
  });

  it("emits the exact Route OS event names through the Kernel EventBus", async () => {
    const {
      EVENT_TYPES,
      emitRoutePlanned,
      emitRouteLoaded,
      emitRouteStopStarted,
      emitRouteStopCompleted,
      emitRouteSyncRequired,
    } = require("../src/services/routeOsEventService");

    expect(EVENT_TYPES.ROUTE_PLANNED).toBe("ROUTE_PLANNED");
    expect(EVENT_TYPES.ROUTE_LOADED).toBe("ROUTE_LOADED");
    expect(EVENT_TYPES.ROUTE_STOP_STARTED).toBe("ROUTE_STOP_STARTED");
    expect(EVENT_TYPES.ROUTE_STOP_COMPLETED).toBe("ROUTE_STOP_COMPLETED");
    expect(EVENT_TYPES.ROUTE_SYNC_REQUIRED).toBe("ROUTE_SYNC_REQUIRED");

    await emitRoutePlanned({ routeCount: 2, source: "test" });
    await emitRouteLoaded({ technicianId: 11, routeCount: 2, source: "test" });
    await emitRouteStopStarted({ visitId: 101, technicianId: 11, source: "test" });
    await emitRouteStopCompleted({ visitId: 101, technicianId: 11, source: "test" });
    await emitRouteSyncRequired({ technicianId: 11, reason: "offline", source: "test" });

    const history = Kernel.EventBus.getHistory(10);
    expect(history.map((event) => event.name)).toEqual([
      "ROUTE_PLANNED",
      "ROUTE_LOADED",
      "ROUTE_STOP_STARTED",
      "ROUTE_STOP_COMPLETED",
      "ROUTE_SYNC_REQUIRED",
    ]);

    expect(global.io.emit).toHaveBeenCalledWith(
      "ROUTE_PLANNED",
      expect.objectContaining({ routeCount: 2, eventType: "ROUTE_PLANNED" })
    );
    expect(global.io.emit).toHaveBeenCalledWith(
      "ROUTE_STOP_COMPLETED",
      expect.objectContaining({ visitId: 101, eventType: "ROUTE_STOP_COMPLETED" })
    );
  });
});
