const {
  sanitizeTechnicianVisitDetailPayload,
  shouldSanitizeTechnicianVisitDetail,
} = require("../src/services/technicianResponseSanitizer");

describe("technicianResponseSanitizer", () => {
  test("removes contact and financial data from technician visit detail", () => {
    const payload = sanitizeTechnicianVisitDetailPayload({
      ok: true,
      visit: {
        id: 42,
        cost: 12,
        revenue: 80,
        profit: 68,
        billed: true,
        billedAt: "2026-09-14T10:00:00.000Z",
        client: {
          id: 8,
          name: "Cliente Teste",
          email: "private@example.com",
          phone: "900000000",
          nif: "123456789",
          address: "Rua Operacional",
          zone: "Lagos",
          monthlyAmount: 80,
          creditBalance: 20,
          notes: "nota privada",
        },
        pool: {
          id: 9,
          name: "Piscina Teste",
          address: "Rua Operacional",
          client: {
            id: 8,
            name: "Cliente Teste",
            email: "private@example.com",
            phone: "900000000",
            address: "Rua Operacional",
            zone: "Lagos",
          },
        },
      },
      context: {
        customer: {
          id: 8,
          name: "Cliente Teste",
          email: "private@example.com",
          phone: "900000000",
          zone: "Lagos",
        },
        permanentNotes: "Fechar portão",
      },
    });

    expect(payload.visit.cost).toBeUndefined();
    expect(payload.visit.revenue).toBeUndefined();
    expect(payload.visit.profit).toBeUndefined();
    expect(payload.visit.billed).toBeUndefined();
    expect(payload.visit.client.email).toBeUndefined();
    expect(payload.visit.client.phone).toBeUndefined();
    expect(payload.visit.client.monthlyAmount).toBeUndefined();
    expect(payload.visit.client.creditBalance).toBeUndefined();
    expect(payload.visit.client.notes).toBeUndefined();
    expect(payload.visit.client.name).toBe("Cliente Teste");
    expect(payload.visit.client.address).toBe("Rua Operacional");
    expect(payload.visit.pool.client.email).toBeUndefined();
    expect(payload.context.customer.email).toBeUndefined();
    expect(payload.context.customer.phone).toBeUndefined();
    expect(payload.context.permanentNotes).toBe("Fechar portão");
  });

  test("only applies to technician GET visit detail", () => {
    expect(shouldSanitizeTechnicianVisitDetail({ method: "GET", originalUrl: "/api/visits/42" }, "TECHNICIAN")).toBe(true);
    expect(shouldSanitizeTechnicianVisitDetail({ method: "GET", originalUrl: "/api/visits/42?x=1" }, "TECNICO")).toBe(true);
    expect(shouldSanitizeTechnicianVisitDetail({ method: "POST", originalUrl: "/api/visits/42" }, "TECHNICIAN")).toBe(false);
    expect(shouldSanitizeTechnicianVisitDetail({ method: "GET", originalUrl: "/api/visits/42" }, "ADMIN")).toBe(false);
  });
});
