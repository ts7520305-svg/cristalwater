import { describe, it, expect } from 'vitest';
const P = require('../frontend/cw-extra-correction-products'), C = require('../frontend/cw-product-catalogue');
const context = { owner: 'USER:2:TECH:7', technicianId: 7, id: 4, poolId: 6, baseVersion: 'a'.repeat(64) };
const item = { id: 11, workGuideId: 8, name: ' Ácido <b>literal</b> ', unit: 'l', quantity: -1, initialQty: 3, usedQty: 4 };
const guide = { id: 8, vehicleId: 9, technicianId: 7, status: 'OPEN', itemCount: 1, items: [item] };
const packet = { version: 1, owner: context.owner, visitId: 4, poolId: 6, baseVersion: context.baseVersion, asOf: '2026-09-27T23:00:00.000Z', state: 'AVAILABLE', guides: [guide] };
const row = { name: item.name, unit: item.unit, quantity: '0.25', notes: ' Keep exactly ', workGuideId: 8, workGuideItemId: 11 };
describe('Original extra-visit correction products', () => {
  it('binds a complete literal catalogue to account, typed visit, pool and baseline', () => { expect(P.packet(packet, context)).toBe(true); expect(P.items(packet)).toEqual([item]); });
  for (const patch of [{ owner: 'TECH:7' }, { visitId: 5 }, { poolId: 5 }, { baseVersion: 'b'.repeat(64) }, { version: 2 }, { asOf: 'yesterday' }]) it('rejects a different context: ' + JSON.stringify(patch), () => expect(P.packet({ ...packet, ...patch }, context)).toBe(false));
  it('rejects incomplete, duplicated and mismatched guide rows', () => {
    for (const patch of [{ itemCount: 2 }, { items: [] }, { status: 'CLOSED' }, { technicianId: 9 }, { vehicleId: null }, { items: [{ ...item, workGuideId: 9 }] }, { items: [{ ...item, quantity: '3' }] }, { items: [item, item], itemCount: 2 }]) expect(P.packet({ ...packet, guides: [{ ...guide, ...patch }] }, context)).toBe(false);
    expect(P.packet({ ...packet, guides: [guide, guide] }, context)).toBe(false);
  });
  it('accepts no original guide or review states only without material data', () => { for (const state of ['NO_ORIGINAL_GUIDE', 'REVIEW_REQUIRED']) { expect(P.packet({ ...packet, state, guides: [] }, context)).toBe(true); expect(P.packet({ ...packet, state }, context)).toBe(false); } expect(P.packet({ ...packet, state: 'AVAILABLE', guides: [] }, context)).toBe(false); });
  it('supports several original guides without admitting duplicate item IDs', () => { const other = { ...guide, id: 9, items: [{ ...item, id: 12, workGuideId: 9 }] }; expect(P.packet({ ...packet, guides: [guide, other] }, context)).toBe(true); expect(P.packet({ ...packet, guides: [guide, { ...other, items: [{ ...item, workGuideId: 9 }] }] }, context)).toBe(false); });
  it('retains null units and signed balances but never selects a missing unit', () => { const value = { ...packet, guides: [{ ...guide, items: [{ ...item, unit: null }] }] }; expect(P.packet(value, context)).toBe(true); const all = P.items(value); expect(P.choices(all, {}, C.page(all)).entries[0].valid).toBe(false); });
  it('pins exact IDs across guides and does not infer an identity from matching text', () => {
    const all = Array.from({ length: 60 }, (_, i) => ({ ...item, id: i + 1, workGuideId: i > 25 ? 9 : 8 })), picked = { ...row, workGuideId: 9, workGuideItemId: 60 };
    const before = JSON.stringify(picked), selection = P.choices(all, picked, C.page(all)); expect(selection.entries).toHaveLength(26); expect(selection.entries[0]).toMatchObject({ chosen: true, pinned: true, item: { id: 60, workGuideId: 9 } });
    expect(P.choices(all, { name: item.name, unit: item.unit }, C.page(all)).entries.some(e => e.chosen)).toBe(false); expect(JSON.stringify(picked)).toBe(before);
  });
  it('preserves historical rows without assigning IDs or accepting new free text', () => { const historical = { name: 'Legacy', unit: 'KG', quantity: 1 }, baseline = { chemicalsJson: [historical] }; expect(P.allowed({ ...historical, quantity: '2' }, baseline, null)).toBe(true); expect(P.allowed({ ...historical, name: 'New' }, baseline, null)).toBe(false); expect(P.allowed({ ...historical, quantity: '' }, baseline, null)).toBe(false); expect(baseline.chemicalsJson[0]).toEqual(historical); });
  it('requires exact original identity and literal name/unit for added products', () => { expect(P.allowed(row, {}, packet)).toBe(true); for (const patch of [{ workGuideId: 9 }, { workGuideItemId: 12 }, { unit: 'L' }, { name: item.name.trim() }, { quantity: 0 }]) expect(P.allowed({ ...row, ...patch }, {}, packet)).toBe(false); expect(P.allowed({ name: item.name, unit: item.unit, quantity: 1 }, {}, packet)).toBe(false); });
  it('preserves an existing identified row when the catalogue cannot be consulted', () => { expect(P.allowed(row, { chemicalsJson: [row] }, null)).toBe(true); expect(P.allowed(row, {}, null)).toBe(false); });
});
