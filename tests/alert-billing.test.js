import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { cents, input, convert } = require('../src/business/admin/AlertBillingBusiness');
it.each([undefined, null, true, false, {}, [], [1], '', '1e2', '1.234', 1.234, -1, 0, '01', '1,2,3', 'Infinity', 21474836.48])('rejects unsafe money %j', value => {
  expect(() => cents(value)).toThrow();
});
it('uses exact cents and accepts the Portuguese decimal separator', () => {
  expect(cents('12,34')).toBe(1234); expect(cents(0.01)).toBe(1);
  expect(cents(' 10.1 ')).toBe(1010); expect(cents('21474836.47')).toBe(2147483647);
});
it('rejects contradictory amounts and coerced client identities', () => {
  expect(() => input({ price: 10, amount: 20 })).toThrow();
  for (const expectedClientId of ['1', true, [], 1.5, 0, -1]) expect(() => input({ price: 10, expectedClientId })).toThrow();
  expect(input({ price: '10,00', amount: 10, expectedClientId: 1 })).toEqual({ amountCents: 1000, clientId: 1, version: null });
});
it('rejects invalid bodies, versions and non-administrative actors before any database operation', async () => {
  for (const body of [null, [], true, { price: 1, expectedVersion: null }]) expect(() => input(body)).toThrow();
  for (const actor of [null, { id: 1, role: 'CLIENT' }, { id: 1, role: 'TECHNICIAN' }, { id: '1', role: 'ADMIN' }]) {
    await expect(convert(actor, 'technical-1', { price: 10 })).rejects.toMatchObject({ statusCode: 403 });
  }
});
