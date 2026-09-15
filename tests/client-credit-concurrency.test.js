import { describe, it, expect } from 'vitest';
const { applyClientCreditToInvoice } = require('../src/services/clientCreditService');

// Both invoice reads deliberately capture the same old joined client balance.
// The database double models row lock lifetime; assertions concern conserved money.
function creditDatabase(balance) {
  const client = { id: 1, creditBalance: balance }, payments = [], invoices = new Map([1, 2].map(id => [id, { id, clientId: 1, status: 'PENDING', total: 10, amount: 10, totalAmount: 10, amountPaid: 0, amountOpen: 10 }]));
  let reads = 0, releaseReads, clientLock = Promise.resolve();
  const joinedReads = new Promise(resolve => { releaseReads = resolve; });
  return { client, payments, invoices, $transaction: async work => {
    let unlock = () => {};
    const tx = {
      $queryRaw: async (strings) => {
        if (strings.join('').includes('"Client"')) {
          const previous = clientLock; clientLock = new Promise(resolve => { unlock = resolve; }); await previous;
        }
        return [];
      },
      invoice: {
        findUnique: async ({ where }) => {
          const snapshot = { ...invoices.get(where.id), client: { ...client } };
          if (++reads === 2) releaseReads(); await joinedReads; return snapshot;
        },
        update: async ({ where, data }) => { const row = { ...invoices.get(where.id), ...data }; invoices.set(where.id, row); return row; },
        count: async () => [...invoices.values()].filter(row => row.amountOpen > 0).length,
        findMany: async () => [...invoices.values()],
      },
      client: {
        findUnique: async () => ({ ...client }),
        update: async ({ data }) => { client.creditBalance = typeof data.creditBalance === 'number' ? data.creditBalance : client.creditBalance - data.creditBalance.decrement; return { ...client }; },
      },
      payment: { create: async ({ data }) => { const payment = { id: payments.length + 1, ...data }; payments.push(payment); return payment; } },
      communicationLog: { create: async () => ({ id: 1 }) },
    };
    try { return await work(tx); } finally { unlock(); }
  } };
}

describe('client credit conservation', () => {
  it('does not spend a shared balance twice after two simultaneous invoice reads', async () => {
    const db = creditDatabase(10);
    const results = await Promise.all([applyClientCreditToInvoice(db, 1), applyClientCreditToInvoice(db, 2)]);
    expect(results.reduce((sum, row) => sum + row.creditUsed, 0)).toBe(10);
    expect(db.client.creditBalance).toBe(0);
    expect(db.payments.reduce((sum, row) => sum + row.amountCents, 0)).toBe(1000);
    expect([...db.invoices.values()].reduce((sum, row) => sum + row.amountOpen, 0)).toBe(10);
  });
});
