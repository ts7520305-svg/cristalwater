import { describe, it, expect } from 'vitest';
const rules = require('../frontend/cw-legacy-product-rules');
const row = { name: 'Cloro', quantity: '0,25', unit: 'L', notes: 'Original\nnotes', workGuideId: 7, workGuideItemId: 2 };
const stock = { workGuide: { id: 7, vehicleId: 9 }, stock: [{ id: 2, workGuideId: 7, name: 'Cloro', unit: 'L', quantity: 1 }, { id: 3, workGuideId: 7, name: 'Cloro', unit: 'L', quantity: 2 }] };
describe('Legacy assignment cache keeps identity without duplicate guide catalogues', () => {
  const read = require('../frontend/cw-technician-guide-read-rules'), actor = { owner: 'TECH:3', technicianId: 3 };
  const assignment = () => ({ ok: true, scope: { version: 1, owner: actor.owner, technicianId: 3, vehicleId: 9 }, vehicles: [{ id: 9, plate: 'QA-09', active: true, deletedAt: null, name: 'Literal <vehicle>', assignedTechnicians: [{ id: 3, name: 'Técnico', vehicleId: 9, active: true }], workGuides: [{ id: 7, items: [{ id: 2, name: 'Cloro', unit: 'L' }] }], transportGuides: [{ id: 6, items: [{ id: 8, name: 'Cloro', unit: 'L' }] }] }] });
  it('preserves the account, vehicle and assignment while leaving the input unchanged', () => {
    const value = assignment(), before = JSON.stringify(value), compact = rules.assignmentForCache(value);
    const { workGuides, transportGuides, ...vehicle } = value.vehicles[0];
    expect(compact).toEqual({ ...value, vehicles: [vehicle] }); expect(JSON.stringify(value)).toBe(before);
    expect(read.vehicles(value, actor)).toBe(true); expect(read.vehicles(compact, actor)).toBe(true);
  });
  it('keeps the explicitly unassigned state and old caches compatible', () => {
    const value = { ok: true, scope: { version: 1, owner: actor.owner, technicianId: 3, vehicleId: null }, vehicles: [] };
    expect(rules.assignmentForCache(value)).toEqual(value); expect(read.vehicles(value, actor)).toBe(true);
    expect(read.vehicles(assignment(), actor)).toBe(true);
  });
  it('does not retain 10001 unrelated copies of work/transport guide items', () => {
    const value = assignment(); value.vehicles[0].workGuides[0].items = Array.from({ length: 10001 }, (_, i) => ({ id: i + 1, name: 'Produto grande ' + i, unit: 'KG' }));
    value.vehicles[0].transportGuides[0].items = value.vehicles[0].workGuides[0].items;
    expect(JSON.stringify(value).length).toBeGreaterThan(1000000); expect(JSON.stringify(rules.assignmentForCache(value)).length).toBeLessThan(400);
  });
  for (const change of [{ owner: 'TECH:4' }, { technicianId: 4 }, { vehicleId: 10 }]) it('does not repair or authorize a mismatched scope: ' + JSON.stringify(change), () => {
    const value = assignment(); Object.assign(value.scope, change); expect(read.vehicles(rules.assignmentForCache(value), actor)).toBe(false);
  });
});
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
  for (const labels of [
    {guide:'Guide',line:'line',none:'(none)'}, {guide:'Bon',line:'ligne',none:'(aucun)'},
    {guide:'Guía',line:'línea',none:'(ninguno)'}, {guide:'Beleg',line:'Zeile',none:'(keine)'},
  ]) it('localizes presentation labels without changing original data: '+labels.guide, () => {
    const original='Original <script>raw</script>\nGuia não traduzida', encoded=rules.encode([row],original), before=encoded;
    const text=rules.describe(encoded,labels);
    expect(text).toContain(original);expect(text).toContain('Cloro · 0,25 · L · Original\nnotes');
    expect(text).toContain(labels.guide+' 7 · '+labels.line+' 2');expect(rules.describe('[]',labels)).toBe(labels.none);
    expect(rules.describe('',labels)).toBe(labels.none);expect(rules.describe('[broken',labels)).toBe('[broken');
    expect(encoded).toBe(before);expect(rules.payload(encoded,stock)).toEqual(rules.payload(before,stock));
  });
  it('retains Portuguese defaults when no labels or only one label is supplied', () => {
    const encoded=rules.encode([row],null);
    expect(rules.describe(encoded)).toContain('Guia 7 · linha 2');expect(rules.describe('[]')).toBe('(nenhum)');
    expect(rules.describe(encoded,{guide:'Ticket'})).toContain('Ticket 7 · linha 2');
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
