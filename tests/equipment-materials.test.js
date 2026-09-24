import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const materials = require('../src/services/equipmentMaterialsService');
const { hash } = require('../src/services/fieldWriteRequestService');
const date = n => new Date(Date.UTC(2004, 0, 1) + n * 1000);
const visit = { id: 1, poolId: 2, clientId: 3, technicianId: 4, startAt: date(0), endAt: date(20), status: 'DONE' };
const input = (quantity = '0.1', name = 'Cloro', unit = 'KG') => ({ mode: 'DECLARED', items: [{ productName: name, unit, quantity }] });
function fixture(inputs = [input()], type = 'REGULAR') {
  const rows = inputs.map((value, i) => {
    const row = { id: i + 1, planId: i + 1, requestId: 'request-' + i, fingerprint: hash({ i, value }), completedAt: date(10) };
    row.result = { applied: true, completion: { id: row.id, planId: row.planId, requestId: row.requestId, completedAt: row.completedAt.toISOString(), ...(value ? { materials: materials.create(materials.parse(value), visit, type) } : {}) }, receipt: { owner: 'TECH:4', scope: 'EQUIPMENT_MAINTENANCE', requestId: row.requestId, resourceId: row.planId, payloadHash: row.fingerprint } };
    return row;
  });
  const receipts = rows.map(row => ({ owner: 'TECH:4', requestId: row.requestId, resourceId: row.planId, payloadHash: row.fingerprint, response: structuredClone(row.result) }));
  return { rows, receipts };
}
const movement = (quantity = 1, extra = {}) => ({ id: 1, movementType: 'CONSUMPTION', productId: null, productName: 'CLORO', unit: 'KG', quantity, visitId: 1, extraVisitId: null, poolId: 2, clientId: 3, technicianId: 4, createdAt: date(15), ...extra });
function views(f, movements = [movement()], parent = visit, type = 'REGULAR') { return materials.assess(f.rows, parent, type, f.receipts, movements); }
describe('equipment material declarations and current net visit consumption', () => {
  it('normalizes names and exact six-decimal quantities without implicit unit conversion', () => {
    expect(materials.parse(input('00000.123456', '  Clóro  líquido ', ' l '))).toEqual(input('0.123456', 'CLORO LIQUIDO', 'L'));
    expect(materials.parse(input('100000'))).toEqual(input('100000', 'CLORO'));
    expect(materials.parse({ mode: 'NONE', items: [] })).toEqual({ mode: 'NONE', items: [] });
  });
  it('rejects malformed, negative, zero, imprecise, excessive and repeated product/unit declarations', () => {
    for (const value of [null, [], {}, { mode: 'NONE', items: [input().items[0]] }, { mode: 'DECLARED', items: [] }, { ...input(), extra: true }, ...['0', '-1', '1e2', '0.0000001', '100000.000001', '1,2', '', 'NaN'].map(q => input(q)), input(1), input('1', '<>'), input('1', 'CLORO', ''), { mode: 'DECLARED', items: [...input().items, ...input('0.2', 'clóro').items] }, { mode: 'DECLARED', items: Array.from({ length: 21 }, (_, i) => input('1', 'product-' + i).items[0]) }]) expect(() => materials.parse(value)).toThrow();
  });
  it('uses the same canonical schema in the browser and backend', () => {
    const window = {}; vm.runInNewContext(fs.readFileSync(new URL('../frontend/cw-field-write-store.js', import.meta.url), 'utf8'), { window });
    const parse = window.CWFieldWriteStore.equipmentMaterials;
    for (const value of [input(), input('0.000001', '  Clóro   líquido ', ' l '), input('00002.100000'), { mode: 'NONE', items: [] }]) expect(JSON.parse(JSON.stringify(parse(value)))).toEqual(materials.parse(value));
    for (const value of [null, input('1e3'), input('0'), input('100000.1'), input(2), { ...input(), unsafe: true }]) expect(() => parse(value)).toThrow();
  });
  it('does not confuse an old missing record, explicit none and a declaration awaiting closure', () => {
    const f = fixture([null, { mode: 'NONE', items: [] }, input()]);
    const state = views(f, [], { ...visit, status: 'IN_PROGRESS', endAt: null });
    expect([...state.values()].map(v => v.state)).toEqual(['MISSING', 'NONE', 'DECLARED']);
    expect(state.get(3).comparison).toBe(null);
  });
  it('conserves micro-units across siblings, deducts returns, and leaves the unassigned remainder explicit', () => {
    const state = views(fixture([input('0.1'), input('0.2')]), [movement(0.5), movement(0.1, { id: 2, movementType: 'RETURN', createdAt: date(30) })]);
    expect([...state.values()].map(v => v.state)).toEqual(['MATCHED', 'MATCHED']);
    const comparison = state.get(1).comparison;
    expect(comparison.lines[0]).toMatchObject({ quantity: '0.1', visitQuantity: '0.4', declaredMaintenanceQuantity: '0.3', unassignedQuantity: '0.1' });
    expect(comparison.sourceHash).toBe(hash(comparison.source));
    expect(views(fixture([input('0.1'), input('0.2')]), [movement(0.3)]).get(1).comparison.lines[0].unassignedQuantity).toBe('0');
  });
  it('does not count the same whole consumption separately for each sibling', () => {
    const state = views(fixture([input('0.2'), input('0.2')]), [movement(0.3)]);
    for (const view of state.values()) { expect(view.state).toBe('REVIEW'); expect(view.reasons).toContain('DECLARATIONS_EXCEED_NET_CONSUMPTION'); expect(view.comparison.lines[0].unassignedQuantity).toBe(null); }
  });
  it('keeps regular and extra visits with equal numbers separate', () => {
    const f = fixture([input()], 'EXTRA');
    expect(views(f, [movement(1, { visitId: null, extraVisitId: 1 })], visit, 'EXTRA').get(1).state).toBe('MATCHED');
    expect(views(f, [movement()], visit, 'EXTRA').get(1).state).toBe('REVIEW');
    expect(views(f, [movement(1, { extraVisitId: 1 })], visit, 'EXTRA').get(1).reasons).toContain('MOVEMENT_REVIEW');
  });
  it('fails closed for changed or removed sibling declarations, without silently freeing quantities', () => {
    for (const mutation of ['changed', 'removed', 'receipt']) {
      const f = fixture([input(), input()]);
      if (mutation === 'removed') delete f.rows[1].result.completion.materials;
      else if (mutation === 'changed') f.rows[1].result.completion.materials.items[0].quantity = '0.01';
      else f.receipts.pop();
      const state = views(f); expect(state.get(2).state).toBe('REVIEW'); expect(state.get(1).reasons).toContain('SIBLING_DECLARATION_REVIEW');
    }
  });
  it('reviews movement identities, unknown types, invalid quantities, products and unit mismatches', () => {
    const f = fixture();
    for (const changed of [{ clientId: 9 }, { poolId: 9 }, { technicianId: 9 }, { createdAt: date(-1) }, { movementType: 'UNKNOWN' }, { quantity: -1 }, { quantity: 0.0000001 }, { extraVisitId: 1 }, { unit: 'L' }, { productName: 'OUTRO' }]) expect(views(f, [movement(1, changed)]).get(1).state).toBe('REVIEW');
    expect(views(f, [movement(1, { productId: 1 }), movement(1, { id: 2, productId: 2 })]).get(1).reasons).toContain('PRODUCT_IDENTITY');
  });
  it('preserves original records after parent changes and does not attach to the current pool owner', () => {
    const f = fixture(), record = structuredClone(f.rows[0].result.completion.materials);
    for (const parent of [{ ...visit, clientId: 9 }, { ...visit, technicianId: 8 }, { ...visit, poolId: 8 }, { ...visit, endAt: date(9) }, { ...visit, startAt: date(11) }, { ...visit, startAt: date(11), endAt: null, status: 'IN_PROGRESS' }, { ...visit, status: 'CANCELLED' }]) { const view = views(f, [movement()], parent).get(1); expect(view.state).toBe('REVIEW'); expect(view.record).toEqual(record); }
  });
  it('reviews a completed visit with no stock proof rather than inventing zero consumption', () => {
    const view = views(fixture(), []).get(1); expect(view.state).toBe('REVIEW'); expect(view.reasons).toContain('NO_POSITIVE_NET_CONSUMPTION');
    expect(views(fixture(), [movement(0.1), movement(0.2, { id: 2, movementType: 'RETURN' })]).get(1).comparison.lines[0].visitQuantity).toBe(null);
  });
  it('propagates read failures instead of displaying an unverified declaration as matched', async () => {
    const f = fixture(), db = { fieldWriteRequest: { findMany: vi.fn(async () => f.receipts) }, stockMovement: { findMany: vi.fn(async () => { throw Error('unavailable'); }) } };
    await expect(materials.describe(db, f.rows, visit, 'REGULAR')).rejects.toThrow('unavailable');
  });
});
