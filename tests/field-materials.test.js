import { describe, it, expect } from 'vitest';
const materials = require('../frontend/cw-field-materials');

describe('field material quantities and totals', () => {
  it('sums decimal quantities and signed corrections without introducing floating-point noise', () => {
    expect(materials.sum([0.1, 0.2])).toBe('0.3');
    expect(materials.sum([0.3, -0.2, -0.1])).toBe('0');
    expect(materials.sum([1.000001, -0.000001])).toBe('1');
    expect(materials.sum([-0, 0])).toBe('0');
    expect(materials.sum([1e-7, -2e-7])).toBe('-0.0000001');
    expect(materials.sum([1e21, 1])).toBe('1000000000000000000001');
  });
  it.each([null, undefined, '', '0', false, NaN, Infinity])('never converts unconfirmed %s to zero in a total', value => {
    expect(materials.sum([1, value])).toBeNull();
  });
  it('keeps literal units separate and never adds rows with unknown units', () => {
    const rows = [{ unit: 'L', quantity: 0.1 }, { unit: 'L', quantity: 0.2 }, { unit: 'l', quantity: 3 }, { unit: ' L ', quantity: 4 }, { unit: null, quantity: 5 }, { unit: '', quantity: 6 }, { quantity: 7 }];
    const original = JSON.stringify(rows);
    expect(materials.totals(rows, 'quantity')).toEqual({ groups: [{ unit: 'L', value: '0.3' }, { unit: 'l', value: '3' }, { unit: ' L ', value: '4' }], ungrouped: 3 });
    expect(JSON.stringify(rows)).toBe(original);
  });
  it('does not show an incomplete unit total when one row has no quantity', () => {
    expect(materials.totals([{ unit: 'L', quantity: 5 }, { unit: 'L', initialQty: 20 }, { unit: 'kg', quantity: 0 }], 'quantity').groups).toEqual([{ unit: 'L', value: null }, { unit: 'kg', value: '0' }]);
  });
  it('retains duplicate names, zero and negative usage, exact labels and escaped text', () => {
    const rows = [0, -0.25, 2].map((usedQty, i) => ({ id: i + 1, name: ' Exact <img> ', unit: ' kg ', usedQty }));
    const html = materials.list(rows, 'usage');
    expect(html.match(/data-material-index=/g)).toHaveLength(3);
    expect(html).toContain('>-0.25  kg </strong>');
    expect(html).toContain('>0  kg </strong>');
    expect(html).toContain(' Exact &lt;img&gt; ');
    expect(html).not.toContain('<img>');
    expect(html).toContain('data-doc-copy="guideUsageHelp"');
  });
  it('does not substitute initial stock, a missing quantity, or a missing unit', () => {
    const html = materials.list([{ name: 'Old row', initialQty: 29, unit: null }], 'balance');
    expect(html).toContain('data-doc-copy="quantityUnknown"');
    expect(html).toContain('data-doc-copy="unit"');
    expect(html).not.toContain('29');
    expect(html).not.toContain(' UN');
  });
  it('distinguishes an absent list from a confirmed empty list', () => {
    expect(materials.list(undefined, 'usage')).toContain('materialsUnavailable');
    expect(materials.list([], 'usage')).toContain('materialsEmpty');
    expect(materials.totals(undefined, 'usedQty')).toBeNull();
    expect(materials.sum([])).toBeNull();
  });
});
