import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const P = require('../frontend/cw-field-guide-projection');
const copy = require('../frontend/cw-field-document-copy');
const context = { window: { CWFieldWriteStore: { same: () => true }, CWFieldRouteCache: { today: () => '2026-09-26' }, CWFieldGuideProjection: P }, Date };
vm.runInNewContext(fs.readFileSync(new URL('../frontend/cw-field-documents.js', import.meta.url), 'utf8'), context);
const api = context.window.CWFieldDocuments;
const scope = { session: { owner: 'TECH:7', technicianId: 7 }, vehicleId: 2, role: 'TECHNICIAN', day: '2026-09-26' };
const item = { id: 4, workGuideId: 3, name: ' Exact ', unit: null, quantity: 0, initialQty: 0, usedQty: -0.000001 };
function packet() {
  return P.packet('work', { ok: true, scope: { version: 1, owner: 'TECH:7', technicianId: 7, vehicleId: 2 }, workGuide: { id: 3, vehicleId: 2, technicianId: 7, items: [item] }, stock: [item], itemCount: 1, movementsIncluded: true, consumptionCount: 10, movements: Array.from({ length: 10 }, (_, i) => P.movement({ id: i + 1, workGuideId: 3, vehicleId: 2, technicianId: i % 2 ? 7 : null, itemName: ' Exact ', unit: i % 2 ? ' kg ' : null, quantity: i % 2 ? -0.000001 : 0, movementType: 'CONSUMPTION', createdAt: '2026-09-26T08:00:00.000Z', notes: ' Exact note ' })), transportGuideDocument: null, missingTransportGuide: true });
}
describe('field document summary and confirmed counts', () => {
  it('keeps the last eight consumptions in reverse creation/ID order without altering signed values, units or the packet', () => {
    const p = packet(), original = JSON.stringify(p);
    expect(api.validateData('work', p, scope, true)).toBe(p);
    const result = api.consumptionSummary(p);
    expect(result.total).toBe(10); expect(result.available).toBe(10);
    expect(result.rows.map(r => r.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3]);
    expect(result.rows[0]).toMatchObject({ quantity: -0.000001, unit: ' kg ' });
    expect(result.rows[1]).toMatchObject({ quantity: 0, unit: null });
    expect(JSON.stringify(p)).toBe(original);
  });
  it('retains older v3 copies but does not infer a complete guide count from their length', () => {
    const p = packet(); for (const k of ['itemCount', 'movementsIncluded', 'consumptionCount']) delete p[k];
    expect(api.validateData('work', p, scope)).toBe(p);
    expect(api.consumptionSummary(p)).toMatchObject({ total: null, available: 10 });
    expect(() => api.validateData('work', p, scope, true)).toThrow();
  });
  it('distinguishes confirmed zero from an empty legacy copy', () => {
    const p = packet(); p.movements = []; p.consumptionCount = 0;
    expect(api.validateData('work', p, scope, true)).toBe(p);
    expect(api.consumptionSummary(p).total).toBe(0);
    for (const k of ['itemCount', 'movementsIncluded', 'consumptionCount']) delete p[k];
    expect(api.consumptionSummary(p)).toMatchObject({ total: null, available: 0, rows: [] });
  });
  it.each(['count', 'truncated', 'duplicate', 'order', 'type', 'quantity', 'unit', 'itemCount', 'stockMismatch', 'lean', 'scope', 'owner'])('refuses misleading or incomplete %s responses', mode => {
    const p = packet();
    if (mode === 'count') p.consumptionCount = '10';
    if (mode === 'truncated') p.movements.pop();
    if (mode === 'duplicate') p.movements[1] = p.movements[0];
    if (mode === 'order') p.movements.reverse();
    if (mode === 'type') p.movements[0].movementType = 'LOAD';
    if (mode === 'quantity') delete p.movements[0].quantity;
    if (mode === 'unit') delete p.movements[0].unit;
    if (mode === 'itemCount') p.itemCount++;
    if (mode === 'stockMismatch') p.stock[0].quantity = 1;
    if (mode === 'lean') { p.movementsIncluded = false; p.movements = []; p.consumptionCount = null; }
    if (mode === 'scope') delete p.scope;
    if (mode === 'owner') p.scope.owner = 'USER:7:TECH:7';
    expect(() => api.validateData('work', p, scope, true)).toThrow();
  });
  it('requires scope on live transport and insurance even when they explicitly contain no document', () => {
    for (const [kind, p] of [['transport', P.packet('transport', { ok: true, guide: null, items: [] })], ['insurance', P.packet('insurance', { ok: true, vehicle: null, insurance: null })]]) expect(() => api.validateData(kind, p, scope, true)).toThrow();
  });
  it('covers all new labels in five languages and renders the original consultation time in Lisbon', () => {
    for (const lang of Object.keys(copy.locales)) {
      for (const key of copy.keys) expect(copy.text(key, { date: 'DATE', shown: 8, total: 105, available: 105 }, lang)).not.toMatch(/undefined|\{/);
      expect(copy.text('confirmed', { shown: 8, total: 105 }, lang)).toContain('105');
      expect(copy.date('2026-09-26T08:00:00Z', lang)).toMatch(/\b0?9:00:00\b/);
    }
  });
});
