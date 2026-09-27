import { describe, it, expect } from 'vitest';
const C = require('../frontend/cw-product-catalogue');
const items = Object.freeze(Array.from({ length: 207 }, (_, position) => Object.freeze({ id: position + 101, workGuideId: 7, name: position > 199 ? 'Ácido <b>literal</b> 33%' : 'Cloro ' + position, unit: position === 205 ? null : position === 206 ? 'kg' : 'KG', quantity: position === 203 ? 0 : position === 204 ? -1 : 10 })));
const product = item => ({ workGuideId: 7, workGuideItemId: item.id, name: item.name, unit: item.unit, quantity: '0,25', notes: 'Keep exactly\n<b>notes</b>' });
describe('Guide product search preserves exact row identity', () => {
  it('visits every row once through bounded pages in source order', () => {
    const seen = [];
    for (let offset = 0; offset < items.length; offset += 25) { const view = C.page(items, '', offset); expect(view.entries.length).toBeLessThanOrEqual(25); expect(view.total).toBe(207); expect(view.available).toBe(207); seen.push(...view.entries.map(entry => entry.item.id)); }
    expect(seen).toEqual(items.map(item => item.id)); expect(new Set(seen).size).toBe(207);
  });
  for (const query of ['acido kg', 'ÁCIDO KG', '<b>literal</b>', '33%']) it('searches literal words without changing products: ' + query, () => {
    const view = C.page(items, query); expect(view.total).toBe(query.toLowerCase().includes('kg') ? 6 : 7); expect(view.entries[0].item.name).toBe('Ácido <b>literal</b> 33%');
  });
  it('supports an exact #ID and keeps original row numbers', () => {
    const view = C.page(items, '#301'); expect(view.total).toBe(1); expect(view.entries[0].position).toBe(200); expect(C.page(items, '#30').total).toBe(0);
  });
  it('does not evaluate punctuation as a regular expression', () => { expect(C.page(items, '.*').total).toBe(0); expect(C.page(items, '[').total).toBe(0); });
  it('pins the selected row outside a page and outside an empty search', () => {
    const row = product(items[202]), before = JSON.stringify(row);
    for (const query of ['', 'missing']) { const selected = C.selection(items, 7, row, C.page(items, query)); expect(selected.entries[0].item.id).toBe(303); expect(selected.entries[0].pinned).toBe(true); expect(selected.entries[0].chosen).toBe(true); expect(selected.entries.length).toBeLessThanOrEqual(26); }
    expect(JSON.stringify(row)).toBe(before);
  });
  it('does not duplicate a selected row already on the visible page', () => { const s = C.selection(items, 7, product(items[202]), C.page(items, '', 200)); expect(s.entries).toHaveLength(7); expect(s.entries.filter(entry => entry.chosen)).toHaveLength(1); expect(s.entries.some(entry => entry.pinned)).toBe(false); });
  for (const change of [{ workGuideId: 8 }, { workGuideItemId: 999 }, { name: 'ÁCIDO <b>literal</b> 33%' }, { unit: 'kg' }, { workGuideId: null }]) it('keeps a changed or incomplete identity for review: ' + JSON.stringify(change), () => {
    const s = C.selection(items, 7, { ...product(items[202]), ...change }, C.page(items)); expect(s.saved).toBe(true); expect(s.entries.some(entry => entry.chosen || entry.pinned)).toBe(false);
  });
  it('does not choose a first result for a blank or old unidentified product', () => {
    for (const row of [{}, { name: items[200].name, unit: 'KG' }]) expect(C.selection(items, 7, row, C.page(items, 'acido')).entries.some(entry => entry.chosen)).toBe(false);
  });
  it('retains null units and signed quantities without making missing units selectable', () => {
    const s = C.selection(items, 7, {}, C.page(items, '', 200)); expect(s.entries.find(entry => entry.item.unit === null).valid).toBe(false); expect(s.entries.map(entry => entry.item.quantity)).toContain(-1); expect(s.entries.map(entry => entry.item.quantity)).toContain(0);
  });
  it('clamps an obsolete page after refresh and reports an empty filter accurately', () => {
    expect(C.page(items, '', 999).offset).toBe(200); expect(C.page(items, 'acido', 200).offset).toBe(0); expect(C.page(items, 'missing', 50)).toMatchObject({ from: 0, to: 0, total: 0, available: 207, hasNext: false, hasPrevious: false });
  });
  it('keeps 5001 rows discoverable while bounding rendered options', () => {
    const large = Array.from({ length: 5001 }, (_, i) => ({ ...items[0], id: i + 1 })), row = product(large[5000]), selected = C.selection(large, 7, row, C.page(large));
    expect(selected.entries).toHaveLength(26); expect(C.page(large, '#5001').entries[0].item.id).toBe(5001); expect(C.page(large, '', 5000)).toMatchObject({ from: 5001, to: 5001, total: 5001 });
  });
});
