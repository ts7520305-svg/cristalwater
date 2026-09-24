import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url), rules = require('../frontend/cw-maintenance-material-rules');
const service = require('../src/services/maintenanceMaterialShareService'), r = require('../src/services/expenseLedgerRules');
const at = '2004-01-02T12:00:00.000Z', start = '2004-01-02T11:00:00.000Z';
const empty = () => ({ quantity: '0', amountCents: 0, shares: [] }), ownEmpty = () => ({ quantity: '0', shares: [] });
function preview({ expenseId = 1, allocationId = 1, amountCents = 100, completionId = 11, quantity = '0.1', used = empty(), maintenanceUsed = ownEmpty() } = {}) {
  const origin = { visitType: 'REGULAR', visitId: 7, poolId: 2, clientId: 3, technicianId: 4 };
  const materials = { schema: 1, basis: 'DECLARED_EQUIPMENT_MATERIALS', mode: 'DECLARED', items: [{ productName: 'CLORO', unit: 'KG', quantity: '0.3' }], origin };
  const source = { kind: 'MATERIAL', service: { id: 7, poolId: 2, clientId: 3, technicianId: 4, startAt: start, endAt: at }, item: { id: 9, purchaseId: 8, productName: 'Clóro', unit: 'KG', quantity: 0.3, totalCost: 1 }, movements: [{ id: 1, productName: 'CLORO', unit: 'KG', quantity: 0.6 }] };
  const a = { ...Object.fromEntries(rules.fields.map(k => [k, null])), id: allocationId, expenseId, monthRef: '2004-01', amountCents, targetType: 'REGULAR', clientId: 3, visitId: 7, targetSnapshot: { type: 'REGULAR', id: 7, clientId: 3, poolId: 2, startAt: start, endAt: at }, valuationType: 'MATERIAL', quantity: '0.3', quantityUnit: 'KG', purchaseItemId: 9, valuationSnapshot: { source, calculation: { quantity: '0.3', quantityUnit: 'KG', amountCents } } };
  const snapshot = { type: 'MAINTENANCE_EQUIPMENT', id: completionId, clientId: 3, poolId: 2, status: 'CONFIRMED', startAt: null, endAt: at, executionBasis: 'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION', decisionId: 12, decisionFingerprint: 'a'.repeat(64), executionFingerprint: 'b'.repeat(64), originVisitType: 'REGULAR', originVisitId: 7 };
  const target = { type: snapshot.type, id: completionId, clientId: 3, valid: true, label: 'Revisão', clientName: 'Cliente histórico', hash: r.hash(snapshot), snapshot: { ...snapshot, label: 'Revisão', clientName: 'Cliente histórico' } };
  const consumptionSource = { schema: 1, basis: 'CURRENT_NET_VISIT_CONSUMPTION', visit: { ...origin, startAt: start, endAt: at, status: 'DONE' }, declarations: [{ id: completionId, fingerprint: 'c'.repeat(64), materials }], movements: source.movements };
  const value = { version: 1, basis: rules.basis, expenseId, expenseVersion: 2, allocationId, completionId, monthRef: a.monthRef, allocationBefore: a, allocationHash: r.hash(a), parentQuantity: '0.3', quantity, material: { productName: 'CLORO', unit: 'KG', declaredQuantity: '0.3' }, used, maintenanceUsed, materials, materialsHash: r.hash(materials), consumptionSource, consumptionHash: r.hash(consumptionSource), target, ...rules.calculation(amountCents, '0.3', used, maintenanceUsed, '0.3', quantity) };
  return { available: true, ...value, hash: r.hash(value) };
}
const uuid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
function event(p = preview(), i = 1) {
  const requestId = uuid(i), reason = 'Conferido', request = { requestId, command: rules.commands[0], expenseId: p.expenseId, expectedVersion: p.expenseVersion, data: { allocationId: p.allocationId, completionId: p.completionId, quantity: p.quantity, amountCents: p.amountCents, previewHash: p.hash, reason, confirmed: true } };
  const payloadHash = r.hash({ v: 1, ...request }), share = { schema: 1, id: requestId, expenseId: p.expenseId, allocationId: p.allocationId, completionId: p.completionId, preview: p, reason, createdAt: at, createdById: 4 };
  return { id: i, requestId, command: request.command, expenseId: p.expenseId, actorId: 4, request, payloadHash, result: { ok: true, applied: true, expenseId: p.expenseId, version: p.expenseVersion + 1, share, shareHash: r.hash(share), reason, receipt: { owner: 'ADMIN:4', requestId, command: request.command, requestedExpenseId: p.expenseId, expectedVersion: p.expenseVersion, payloadHash, confirmedAt: at } } };
}
const db = events => ({ expenseEvent: { findMany: vi.fn(async () => events) } });
describe('secondary maintenance material cost attribution', () => {
  it('uses the stock normalizer without implicit unit conversion', () => {
    const normalizer = require('../src/utils/stockNormalizer');
    for (const s of [' Clóro   líquido ', 'kg', 'produto-á_1', '<script>']) expect(rules.normalize(s)).toBe(normalizer.normalizeProductName(s));
    expect(rules.sameProduct({ productName: 'CLORO', unit: 'KG' }, { productName: 'Clóro', unit: 'L' })).toBe(false);
  });
  it('requires exact decimal strings and preserves six-decimal micro-units', () => {
    for (const s of ['0.000001','00001.010000','999999999999.999999']) expect(rules.quantity(s)).toBe(require('../src/services/expenseValuationSources').quantity(s));
    for (const s of [0.1, null, undefined, '-1', '1e2', '0,1', '0.0000001', '1000000000000']) expect(rules.quantity(s)).toBe(null);
    expect(rules.decimal(rules.quantity('0.1') + rules.quantity('0.2'))).toBe('0.3');
  });
  it('conserves cents and gives the final parent remainder exactly once', () => {
    const amounts = []; let quantity = '0', amountCents = 0;
    for (let i = 0; i < 3; i++) { const c = rules.calculation(100, '0.3', { quantity, amountCents }, ownEmpty(), '0.1', '0.1'); amounts.push(c.amountCents); quantity = rules.decimal(rules.quantity(quantity) + 100000n); amountCents += c.amountCents; }
    expect(amounts).toEqual([33,33,34]); expect(amountCents).toBe(100); expect(quantity).toBe('0.3');
  });
  it('handles sub-unit quantities without floating-point rounding', () => {
    expect(rules.calculation(100, '0.000003', empty(), ownEmpty(), '0.000001', '0.000001').amountCents).toBe(33);
    expect(rules.calculation(100, '0.000003', { quantity: '0.000002', amountCents: 66 }, ownEmpty(), '0.000001', '0.000001')).toMatchObject({ amountCents: 34, remainingQuantity: '0', rounding: 'FINAL_PARENT_REMAINDER' });
  });
  it('enforces both the allocation quantity and the cross-document declaration budget', () => {
    expect(rules.calculation(100, '0.3', { quantity: '0.2', amountCents: 67 }, ownEmpty(), '0.3', '0.2')).toBe(null);
    expect(rules.calculation(200, '0.3', empty(), { quantity: '0.2' }, '0.3', '0.2')).toBe(null);
    expect(rules.calculation(200, '0.3', empty(), { quantity: '0.2' }, '0.3', '0.1')).toMatchObject({ amountCents: 67, remainingMaintenanceQuantity: '0', remainingQuantity: '0.2' });
  });
  it('rejects zero-cost, invalid and overdrawn selections', () => {
    for (const args of [[0,'1',empty(),ownEmpty(),'1','1'],[1,'100',empty(),ownEmpty(),'1','0.1'],[10,'1',{quantity:'2',amountCents:1},ownEmpty(),'1','1'],[10,'1',{quantity:'0',amountCents:11},ownEmpty(),'1','1'],[10,'1',empty(),{quantity:'2'},'1','1'],[10,'1',empty(),ownEmpty(),'1','0']]) expect(rules.calculation(...args)).toBe(null);
  });
  it('keeps typed parent identities separate across purchases', () => {
    const a = preview().allocationBefore, b = structuredClone(a); b.targetType = 'EXTRA'; b.extraVisitId = a.visitId; b.visitId = null;
    expect(rules.materialKey(a)).not.toBe(rules.materialKey(b)); b.targetType = 'REGULAR'; b.visitId = a.visitId; b.extraVisitId = null; b.expenseId = 88; b.purchaseItemId = 99;
    expect(rules.materialKey(a)).toBe(rules.materialKey(b));
  });
  it('verifies canonical source, target, declaration, allocation and calculation hashes', async () => {
    const p = preview(); await expect(rules.verify(p, r.hash, p.allocationBefore)).resolves.toBe(p);
    const changed = { ...p.allocationBefore, amountCents: 101 }; await expect(rules.verify(p, r.hash, changed)).rejects.toThrow();
  });
  it('rejects altered quantities, costs, periods and typed origins', async () => {
    const changes = [p => p.quantity = '0.2', p => p.amountCents++, p => p.material.declaredQuantity = '0.9', p => p.maintenanceUsed.quantity = '0.3', p => p.monthRef = '2004-02', p => p.material.unit = 'L', p => p.target.id++, p => p.materials.origin.visitType = 'EXTRA', p => p.materials.origin.clientId++, p => p.materials.origin.technicianId++, p => p.consumptionSource.visit.visitId++, p => p.consumptionSource.declarations = [], p => p.hash = '0'.repeat(64)];
    for (const change of changes) { const p = structuredClone(preview()); change(p); await expect(rules.verify(p, r.hash)).rejects.toThrow(); }
  });
  it('uses exactly the same verifier and arithmetic in a browser context', async () => {
    const context = {}; vm.runInNewContext(fs.readFileSync(new URL('../frontend/cw-maintenance-material-rules.js', import.meta.url), 'utf8'), context);
    const browser = context.CWMaintenanceMaterialRules, p = preview(); await expect(browser.verify(p, r.hash)).resolves.toBe(p);
    expect(JSON.parse(JSON.stringify(browser.calculation(100, '0.3', empty(), ownEmpty(), '0.1', '0.1')))).toEqual(rules.calculation(100, '0.3', empty(), ownEmpty(), '0.1', '0.1'));
  });
  it('does not release a quantity when another document omits prior shares', async () => {
    const one = event(preview({ quantity: '0.2' })), two = event(preview({ expenseId: 2, allocationId: 2, amountCents: 200, quantity: '0.2' }), 2);
    const state = await service.journal(db([one, two])); expect(state.review).toBe(true); expect(state.records).toHaveLength(1); expect(service.budget(state.records).quantity).toBe('0.2');
  });
  it('reviews altered event envelopes and receipts conservatively', async () => {
    for (const change of [e => e.payloadHash = 'f'.repeat(64), e => e.result.receipt.owner = 'ADMIN:9', e => e.result.shareHash = 'f'.repeat(64), e => e.request.data.quantity = '0.01']) { const e = event(); change(e); expect((await service.journal(db([e]))).review).toBe(true); }
  });
  it('accepts unapplied requests without inventing a share or corrupting the journal', async () => {
    const e = event(); e.expenseId = null; e.result.applied = false; delete e.result.share; delete e.result.shareHash; e.result.code = 'NOT_FOUND';
    expect(await service.journal(db([e]))).toEqual({ records: [], review: false });
  });
  it('undoes only a sound original share and keeps its record', async () => {
    const e = event(), requestId = uuid(2), request = { requestId, command: rules.commands[1], expenseId: 1, expectedVersion: 3, data: { allocationId: 1, shareId: e.requestId, shareHash: e.result.shareHash, reason: 'Repor', confirmed: true } }, payloadHash = r.hash({ v: 1, ...request });
    const undone = { id: 2, requestId, command: request.command, expenseId: 1, actorId: 4, request, payloadHash, result: { ...e.result, version: 4, reason: 'Repor', voidedAt: at, receipt: { owner: 'ADMIN:4', requestId, command: request.command, requestedExpenseId: 1, expectedVersion: 3, payloadHash, confirmedAt: at } } };
    const state = await service.journal(db([e, undone])); expect(state.review).toBe(false); expect(state.records[0].voidedAt).toBe(at); expect(state.records[0].share).toEqual(e.result.share); expect(service.budget(state.records).quantity).toBe('0');
  });
  it('projects shares without duplicating the parent amount or quantity', () => {
    const e = event(), a = { ...e.result.share.preview.allocationBefore, targetId: 7, needsReview: false, reviewReasons: [], maintenanceMaterialShares: [{ share: e.result.share, hash: e.result.shareHash, voidedAt: null, needsReview: false }] };
    const rows = service.project([a]); expect(rows).toHaveLength(2); expect(rows.reduce((n, row) => n + row.amountCents, 0)).toBe(100); expect(rows.reduce((n, row) => n + rules.quantity(row.quantity), 0n)).toBe(300000n); expect(rows[1]).toMatchObject({ targetType: 'MAINTENANCE_EQUIPMENT', maintenanceCompletionId: 11, visitId: null, extraVisitId: null, sourceAllocationId: 1, maintenanceShareId: e.requestId, purchaseItemId: 9 });
    a.maintenanceMaterialShares[0].voidedAt = at; expect(service.project([a])).toEqual([a]);
  });
  it('propagates journal read failures instead of confirming empty budgets', async () => {
    await expect(service.journal({ expenseEvent: { findMany: async () => { throw Error('Unavailable'); } } })).rejects.toThrow('Unavailable');
  });
});
