import { describe, it, expect, beforeEach, vi } from "vitest";

const mockProcessReminders = vi.hoisted(() => vi.fn());

vi.mock("../src/services/paymentService", () => ({
  processPaymentReminders: mockProcessReminders,
}));

vi.mock("../src/services/clientCreditService", () => ({
  applyClientCreditToInvoice: vi.fn(),
  invoiceOpen: (invoice = {}) => Number(invoice.amountOpen || 0),
  invoicePaid: (invoice = {}) => Number(invoice.amountPaid || 0),
  invoiceStatus: (total, paid, open) => {
    if (total <= 0 || open <= 0) return "PAID";
    if (paid > 0) return "PARTIAL";
    return "PENDING";
  },
  invoiceTotal: (invoice = {}) => Number(invoice.totalAmount || invoice.total || invoice.amount || 0),
}));

vi.mock("../src/services/financeOsEventService", () => ({
  EVENT_TYPES: {},
  emitFinanceEvent: vi.fn(),
}));

describe("FinanceOsBusiness", () => {
  beforeEach(() => {
    vi.resetModules();
    mockProcessReminders.mockReset();

    global.__CRISTAL_WATER_PRISMA__ = {
      client: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 10, creditBalance: 0 }),
      },
      invoice: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 200 }),
        update: vi.fn().mockResolvedValue({ id: 200 }),
      },
      invoiceLine: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      payment: {
        create: vi.fn().mockResolvedValue({ id: 501, amount: 20 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      communicationLog: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      auditTrail: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      serviceVisit: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      technician: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      inventoryProduct: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => callback(global.__CRISTAL_WATER_PRISMA__)),
    };
  });

  it("returns invalid amount for payment when amount is zero", async () => {
    const business = require("../src/business/finance/FinanceOsBusiness");
    const result = await business.registerPayment(22, { amount: 0 }, "QA");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns invalid client id when requesting customer balance", async () => {
    const business = require("../src/business/finance/FinanceOsBusiness");
    const result = await business.getCustomerBalance(0);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 404 when requesting history for unknown invoice", async () => {
    const business = require("../src/business/finance/FinanceOsBusiness");
    const result = await business.getInvoiceHistory(99999);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

});
