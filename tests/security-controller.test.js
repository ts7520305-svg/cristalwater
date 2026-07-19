import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockUserFindMany, mockUserCount, mockAuditCount } = vi.hoisted(() => ({
  mockUserFindMany: vi.fn(),
  mockUserCount: vi.fn(),
  mockAuditCount: vi.fn(),
}));

describe("securityController", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUserFindMany.mockReset();
    mockUserCount.mockReset();
    mockAuditCount.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      user: {
        findMany: mockUserFindMany,
        count: mockUserCount,
      },
      userAuditLog: {
        count: mockAuditCount,
      },
    };
  });

  it("returns a live user panorama for Crystal Brain accompaniment", async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 1,
        name: "Ana",
        email: "ana@example.com",
        role: "ADMIN",
        active: true,
        mustChangePassword: false,
        lockedUntil: null,
        updatedAt: new Date("2026-07-05T10:00:00.000Z"),
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      },
      {
        id: 2,
        name: "Bruno",
        email: "bruno@example.com",
        role: "TECHNICIAN",
        active: true,
        mustChangePassword: true,
        lockedUntil: new Date("2026-07-05T12:00:00.000Z"),
        updatedAt: new Date("2026-07-05T11:00:00.000Z"),
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      },
      {
        id: 3,
        name: "Carla",
        email: "carla@example.com",
        role: "CLIENT",
        active: false,
        mustChangePassword: false,
        lockedUntil: null,
        updatedAt: new Date("2026-07-05T11:00:00.000Z"),
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      },
    ]);
    mockUserCount.mockResolvedValueOnce(1);
    mockUserCount.mockResolvedValueOnce(1);
    mockAuditCount.mockResolvedValue(7);

    global.__CRISTAL_WATER_ONLINE_USERS__ = new Map([
      [1, { socketId: "socket-1", lastSeen: new Date("2026-07-05T11:50:00.000Z") }],
    ]);

    const { securityStatus } = require("../src/controllers/securityController");
    const req = { query: {}, headers: {}, ip: "127.0.0.1" };
    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };

    await securityStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.ok).toBe(true);
    expect(res.payload.users).toBe(3);
    expect(res.payload.onlineUsers).toBe(1);
    expect(res.payload.attentionUsers).toBe(1);
    expect(res.payload.usersDetail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, online: true, accompanimentState: "LIVE" }),
        expect.objectContaining({ id: 2, online: false, accompanimentState: "ATTENTION" }),
        expect.objectContaining({ id: 3, online: false, accompanimentState: "INACTIVE" }),
      ]),
    );
  });
});
