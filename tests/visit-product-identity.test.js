import { describe, it, expect } from 'vitest';
const R = require('../frontend/cw-visit-product-identity');
const { validateVisitCompletionPayload } = require('../src/services/serviceVisitCompletionService');
const { equivalent } = require('../src/services/visitProductStockReconciliation');
const rows = [
  { id: 1, workGuideId: 7, name: 'Cloro', unit: 'L', quantity: 4 },
  { id: 2, workGuideId: 7, name: 'Cloro', unit: 'KG', quantity: 6 },
  { id: 3, workGuideId: 7, name: 'Cloro', unit: 'KG', quantity: 8 },
];
describe('Visit product identity and incomplete saved values', () => {
  it('selects the exact row among duplicate names and duplicate units', () => {
    for (const row of rows) expect(R.resolve(rows, R.fromItem(row, 7), 7)).toEqual(row);
    expect(R.resolve(rows, { name: 'clóro', unit: 'l' }, 7)).toEqual(rows[0]);
    expect(() => R.resolve(rows, { name: 'Cloro', unit: 'KG' }, 7)).toThrow(/única linha/);
  });
  for (const change of [{ workGuideId: 8 }, { workGuideItemId: 99 }, { name: 'cloro' }, { unit: 'kg' }, { name: 'Cloro ' }]) {
    it('refuses a changed identity or literal label: ' + JSON.stringify(change), () => {
      expect(() => R.resolve(rows, { ...R.fromItem(rows[1], 7), ...change }, 7)).toThrow();
    });
  }
  for (const pair of [{ workGuideId: 7 }, { workGuideItemId: 2 }, { workGuideId: '7', workGuideItemId: 2 }, { workGuideId: 7, workGuideItemId: null }, { workGuideId: 7, workGuideItemId: -2 }]) {
    it('never falls back to a name when the saved identity is invalid: ' + JSON.stringify(pair), () => {
      const product = { name: 'Cloro', quantity: 1, unit: 'L', ...pair };
      expect(() => R.payload(product)).toThrow();
      expect(() => validateVisitCompletionPayload({ products: [product] })).toThrow();
    });
  }
  for (const quantity of ['', ' ', null, undefined, 0, '0', -1, NaN, Infinity, true, [], {}, 'NaN', 100001]) {
    it('keeps incomplete or invalid quantities out of a completion: ' + String(quantity), () => {
      expect(() => R.payload({ ...R.fromItem(rows[0], 7), quantity })).toThrow();
    });
  }
  it('retains literal units, notes and exact IDs while accepting a decimal comma', () => {
    const item = { ...rows[0], name: ' Cloro ', unit: 'l' };
    const payload = R.payload({ ...R.fromItem(item, 7), quantity: '0,25', notes: '<img> saved note' });
    expect(payload).toEqual({ name: ' Cloro ', unit: 'l', quantity: 0.25, notes: '<img> saved note', workGuideId: 7, workGuideItemId: 1 });
    expect(validateVisitCompletionPayload({ products: [payload] }).chemicalsJson).toEqual([payload]);
  });
  it('does not assume a unit or use a row from another guide', () => {
    for (const unit of [null, '', ' ']) expect(() => R.fromItem({ ...rows[0], unit }, 7)).toThrow();
    expect(() => R.fromItem(rows[0], 8)).toThrow();
  });
  it('compares corrections by identity without treating duplicate rows as interchangeable', () => {
    const a = { ...R.fromItem(rows[1], 7), quantity: 1 }, b = { ...R.fromItem(rows[2], 7), quantity: 1 };
    expect(equivalent([a], [b])).toBe(false);
    expect(equivalent([a], [b], false)).toBe(true);
    expect(equivalent([{ ...a, quantity: 0.1 }, { ...a, quantity: 0.2 }], [{ ...a, quantity: 0.3 }])).toBe(true);
  });
});
