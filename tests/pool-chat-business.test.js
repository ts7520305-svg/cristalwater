import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockPoolFindUnique, mockPoolMessageFindMany, mockPoolMessageCreate } = vi.hoisted(() => ({
  mockPoolFindUnique: vi.fn(),
  mockPoolMessageFindMany: vi.fn(),
  mockPoolMessageCreate: vi.fn(),
}));

describe("PoolChatBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPoolFindUnique.mockReset();
    mockPoolMessageFindMany.mockReset();
    mockPoolMessageCreate.mockReset();
    global.__CRISTAL_WATER_PRISMA__ = {
      pool: { findUnique: mockPoolFindUnique },
      poolMessage: {
        findMany: mockPoolMessageFindMany,
        create: mockPoolMessageCreate,
      },
    };
  });

  it("lists pool chat with the same include and ordering used by the controller flow", async () => {
    const pool = { id: 9, client: { id: 3 } };
    const messages = [{ id: 1, poolId: 9 }];
    mockPoolFindUnique.mockResolvedValue(pool);
    mockPoolMessageFindMany.mockResolvedValue(messages);

    const { listPoolMessages } = require("../src/business/pool/PoolChatBusiness");
    const result = await listPoolMessages(9);

    expect(mockPoolFindUnique).toHaveBeenCalledWith({
      where: { id: 9 },
      include: { client: true },
    });
    expect(mockPoolMessageFindMany).toHaveBeenCalledWith({
      where: { poolId: 9 },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual({ pool, messages });
  });

  it("returns null when pool does not exist", async () => {
    mockPoolFindUnique.mockResolvedValue(null);

    const { listPoolMessages } = require("../src/business/pool/PoolChatBusiness");
    const result = await listPoolMessages(999);

    expect(result).toBeNull();
    expect(mockPoolMessageFindMany).not.toHaveBeenCalled();
  });

  it("creates a pool message preserving payload shape", async () => {
    const created = { id: 77, poolId: 12, senderType: "ADMIN", text: "ok" };
    mockPoolFindUnique.mockResolvedValue({ id: 12 });
    mockPoolMessageCreate.mockResolvedValue(created);

    const { sendPoolMessage } = require("../src/business/pool/PoolChatBusiness");
    const result = await sendPoolMessage(12, "ADMIN", "  ok  ");

    expect(mockPoolMessageCreate).toHaveBeenCalledWith({
      data: {
        poolId: 12,
        senderType: "ADMIN",
        text: "ok",
      },
    });
    expect(result).toEqual(created);
  });
});