import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { calculate } = require('../src/business/repair/CommercialQuoteBusiness');
const line = { type: 'MATERIAL', description: 'Bomba', quantity: 2, unitCost: 80, marginPercent: 20 };
const payload = { lines: [line], taxPercent: 23 };
describe('commercial quote arithmetic', () => {
 it('uses gross margin, explicit tax, and discount before tax', () => {
  const q = calculate({ ...payload, discountPercent: 10 });
  expect(q.lines[0].unitPrice).toBe(100); expect(q.totalCost).toBe(160);
  expect(q.net).toBe(180); expect(q.tax).toBe(41.4); expect(q.total).toBe(221.4); expect(q.profit).toBe(20);
 });
 it('supports fractional labor, zero tax and detects loss after discount', () => {
  const q = calculate({ ...payload, lines: [{ ...line, type: 'LABOR', quantity: 1.5 }], taxPercent: 0, discountPercent: 50 });
  expect(q.total).toBe(75); expect(q.totalCost).toBe(120); expect(q.belowCost).toBe(true);
 });
 it.each([null, '', true, 'abc', -1, Infinity])('rejects invalid costs: %s', unitCost => {
  expect(() => calculate({ ...payload, lines: [{ ...line, unitCost }] })).toThrow();
 });
 it('rejects missing tax, invalid margin, empty lines and zero-value quotes', () => {
  expect(() => calculate({ lines: [line] })).toThrow();
  expect(() => calculate({ ...payload, lines: [{ ...line, marginPercent: 100 }] })).toThrow();
  expect(() => calculate({ ...payload, lines: [] })).toThrow();
  expect(() => calculate({ ...payload, discountPercent: 100 })).toThrow();
 });
});
