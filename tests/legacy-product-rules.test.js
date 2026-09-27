import { describe, it, expect } from 'vitest';
const rules = require('../frontend/cw-legacy-product-rules');
const row = { name: 'Cloro', quantity: '0,25', unit: 'L', notes: 'Original\nnotes', workGuideId: 7, workGuideItemId: 2 };
const stock = { workGuide: { id: 7, vehicleId: 9 }, stock: [{ id: 2, workGuideId: 7, name: 'Cloro', unit: 'L', quantity: 1 }, { id: 3, workGuideId: 7, name: 'Cloro', unit: 'L', quantity: 2 }] };
describe('Legacy product draft conversion without losing original text', () => {
  for (const original of ['2 kg de cloro\n confirmar unidade', '<img src=x> 1 L', '[broken', '{"rows":[]}', '[{"name":"X","private":true}]']) {
    it('preserves opaque original bytes during explicit conversion: ' + original, () => {
      expect(rules.read(original)).toEqual({ kind: 'text', rows: [], originalText: original });
      expect(() => rules.payload(original, stock)).toThrow(/texto anterior/);
      const encoded = rules.encode([row], original), restored = rules.read(encoded);
      expect(restored.rows).toEqual([row]); expect(restored.originalText).toBe(original);
      expect(rules.read(rules.encode([], restored.originalText)).originalText).toBe(original);
      expect(rules.describe(encoded)).toContain(original);
    });
  }
  it('sends structured IDs and decimal quantities without altering the saved draft', () => {
    const encoded = rules.encode([row], 'Cloro usado'), before = encoded;
    const payload = rules.payload(encoded, stock);
    expect(JSON.parse(payload.products)).toEqual([{ ...row, quantity: 0.25 }]);
    expect(payload.workGuideId).toBe(7); expect(payload.vehicleId).toBe(9);
    expect(encoded).toBe(before); expect(rules.describe(encoded)).toContain('Guia 7 · linha 2');
  });
  it('does not require a guide for an explicitly empty product list', () => {
    expect(rules.payload('', null)).toEqual({ products: '[]' }); expect(rules.payload('[]', null)).toEqual({ products: '[]' });
  });
  it('preserves old structured rows but requires reselection of a missing identity', () => {
    const old = JSON.stringify([{ name: 'Cloro', quantity: 1, unit: 'L' }]);
    expect(rules.read(old).kind).toBe('rows'); expect(() => rules.payload(old, stock)).toThrow(/Selecione novamente/);
  });
  for (const change of [{ quantity: '' }, { quantity: 0 }, { quantity: -1 }, { unit: null }, { workGuideId: 8 }, { workGuideItemId: 99 }, { name: 'cloro' }]) {
    it('refuses incomplete or changed original product details: ' + JSON.stringify(change), () => {
      expect(() => rules.payload(rules.encode([{ ...row, ...change }], null), stock)).toThrow();
    });
  }
  it('checks the total per exact row, including decimal fractions', () => {
    expect(() => rules.payload(rules.encode([{ ...row, quantity: 0.6 }, { ...row, quantity: 0.6 }], null), stock)).toThrow(/Stock insuficiente/);
    const decimal = { ...stock, stock: [{ ...stock.stock[0], quantity: 0.3 }] };
    expect(() => rules.payload(rules.encode([{ ...row, quantity: 0.1 }, { ...row, quantity: 0.2 }], null), decimal)).not.toThrow();
  });
  it('blocks a nonempty list without a confirmed guide and enforces 50 rows', () => {
    expect(() => rules.payload(rules.encode([row], null), null)).toThrow(/Consulte a guia/);
    expect(() => rules.encode(Array.from({ length: 51 }, () => row), null)).toThrow();
  });
});
