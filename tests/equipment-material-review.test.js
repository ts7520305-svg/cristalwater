import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url), materials = require('../src/services/equipmentMaterialsService'), journal = require('../src/services/equipmentMaterialReviewJournal');
const r = require('../src/services/fieldWriteRequestService'), rules = journal.rules;
const at = n => new Date(Date.UTC(2026, 0, 5, 10) + n * 1000), uuid = n => '11111111-1111-4111-8111-' + String(n).padStart(12, '0');
const visit = { id:7,poolId:2,clientId:3,technicianId:4,status:'DONE',startAt:at(0),endAt:at(30) };
const input = q => ({ mode:'DECLARED',items:[{ productName:'CLORO',unit:'KG',quantity:q }] });
function fixture() {
  const rows = [1,2].map(id => { const row = { id,planId:id,requestId:uuid(id),fingerprint:r.hash({ id }),completedAt:at(10) };
    row.result = { applied:true,completion:{ id,planId:id,requestId:row.requestId,completedAt:at(10).toISOString(),materials:materials.create(input('0.1'), visit, 'REGULAR') },receipt:{ owner:'ADMIN:4',scope:'EQUIPMENT_MAINTENANCE',requestId:row.requestId,resourceId:id,payloadHash:row.fingerprint } }; return row; });
  const receipts = rows.map(row => ({ owner:'ADMIN:4',requestId:row.requestId,resourceId:row.planId,payloadHash:row.fingerprint,response:structuredClone(row.result) }));
  const movements = [{ id:1,movementType:'CONSUMPTION',productId:null,productName:'CLORO',unit:'KG',quantity:0.3,visitId:7,extraVisitId:null,poolId:2,clientId:3,technicianId:4,createdAt:at(15) }];
  return { rows,receipts,movements };
}
function preview(f = fixture(), q = '0.2', previous) {
  const original = journal.original(f.rows[0], f.receipts), value = { schema:1,basis:rules.basis,completionId:1,origin:{ visitType:'REGULAR',visitId:7,poolId:2,clientId:3,technicianId:4 },original,baseHash:r.hash(original),previous:previous || { headHash:null,action:'ORIGINAL',record:original.record },proposed:q === null ? { action:'WITHDRAW',record:null } : { action:'REPLACE',record:materials.create(input(q), visit, 'REGULAR') },sourceHash:'1'.repeat(64),targetHash:'2'.repeat(64),beforeState:'MATCHED',afterState:q === null ? 'WITHDRAWN' : 'MATCHED',afterReasons:[],affectedShares:[] };
  return { available:true,...value,hash:r.hash(value) };
}
function event(p = preview(), n = 10) {
  const body = { requestId:uuid(n),action:p.proposed.action,materials:p.proposed.record ? { mode:p.proposed.record.mode,items:p.proposed.record.items } : null,previewHash:p.hash,reason:'Conferência administrativa',confirmed:true };
  const { requestId, ...payload } = body, request = r.context({ id:4,role:'ADMIN' }, rules.scope, 1, requestId, payload);
  const revision = { schema:1,id:requestId,owner:'ADMIN:4',completionId:1,reason:body.reason,createdAt:at(40).toISOString(),preview:p };
  return { id:n,...request,response:{ ok:true,applied:true,envelope:body,receipt:{ ...request,confirmedAt:at(41).toISOString() },revision,revisionHash:r.hash(revision) } };
}
const db = events => ({ fieldWriteRequest:{ findMany:async () => events } });
describe('administrative equipment material corrections', () => {
  it('keeps browser and backend material normalization identical', () => {
    const sandbox = {}; for (const file of ['cw-maintenance-material-rules','cw-equipment-material-review-rules']) vm.runInNewContext(fs.readFileSync(new URL('../frontend/' + file + '.js', import.meta.url), 'utf8'), sandbox);
    const value = { mode:'DECLARED',items:[{ productName:' Clóro  líquido ',unit:' l ',quantity:'0000.123456' }] };
    expect(JSON.parse(JSON.stringify(sandbox.CWEquipmentMaterialReviewRules.input(value)))).toEqual(materials.parse(value));
  });
  it('rejects zero, excess precision, huge, duplicate, or malformed lines', () => {
    for (const v of [input('0'),input('0.0000001'),input('100000.1'),input('1e2'),input(2),{ mode:'NONE',items:input('1').items },{ ...input('1'),unexpected:true },{ mode:'DECLARED',items:[...input('1').items,...input('2').items] }]) expect(() => rules.input(v)).toThrow();
  });
  it('verifies a preview and an exact response independently of JSON property order', async () => {
    const e = event(); expect(await rules.preview(e.response.revision.preview, r.hash)).toBe(e.response.revision.preview);
    expect(await rules.response(e.response, e.response.envelope, e.owner, 1, async v => r.hash(v))).toBe(e.response);
  });
  it('refuses a quantity or identity changed inside a preview, even with its outer hash recalculated', async () => {
    for (const change of [p => { p.proposed.record.items[0].quantity = '100001'; },p => { p.proposed.record.origin.visitType = 'EXTRA'; },p => { p.original.id = 8; p.baseHash = r.hash(p.original); }]) { const p = preview(); change(p); p.hash = r.hash(rules.facts(p)); await expect(rules.preview(p, r.hash)).rejects.toThrow(); }
  });
  it('refuses a forged receipt, owner, reason, or request identity', async () => {
    for (const change of [v => { v.receipt.owner = 'ADMIN:5'; },v => { v.receipt.requestId = uuid(99); },v => { v.revision.reason = 'Alterado'; },v => { v.revisionHash = '0'.repeat(64); }]) { const e = event(); change(e.response); await expect(rules.response(e.response, e.response.envelope, e.owner, 1, r.hash)).rejects.toThrow(); }
  });
  it('does not treat a missing declaration as an explicit withdrawal or zero', async () => {
    const p = preview(fixture(), null); p.previous.record = null; p.hash = r.hash(rules.facts(p)); await expect(rules.preview(p, r.hash)).rejects.toThrow();
    expect(rules.input({ mode:'NONE',items:[] })).toEqual({ mode:'NONE',items:[] });
  });
  it('replays corrections and withdrawals while preserving the original bytes', async () => {
    const f = fixture(), original = structuredClone(f.rows), first = event(preview(f)), second = event(preview(f, null, { headHash:first.response.revisionHash,action:'REPLACE',record:first.response.revision.preview.proposed.record }), 11);
    const states = await journal.read(db([first,second]), f.rows, f.receipts); expect(states.get(1)).toMatchObject({ valid:true,headHash:second.response.revisionHash,action:'WITHDRAW',record:null }); expect(states.get(1).history).toHaveLength(2); expect(f.rows).toEqual(original);
  });
  it('detects a missing predecessor, duplicate successor, or changed original', async () => {
    const f = fixture(), first = event(preview(f)), second = event(preview(f, null, { headHash:first.response.revisionHash,action:'REPLACE',record:first.response.revision.preview.proposed.record }), 11);
    for (const events of [[second],[first,event(preview(f), 12)]]) expect((await journal.read(db(events), f.rows, f.receipts)).get(1).valid).toBe(false);
    f.rows[0].result.completion.materials.items[0].quantity = '0.3'; expect((await journal.read(db([first]), f.rows, f.receipts)).get(1).valid).toBe(false);
  });
  it('conservatively reviews a declaration when its durable receipt is damaged', async () => {
    const f = fixture(), e = event(preview(f)); e.payloadHash = '0'.repeat(64); const revisions = await journal.read(db([e]), f.rows, f.receipts);
    const values = materials.assess(f.rows, visit, 'REGULAR', f.receipts, f.movements, revisions); expect(values.get(1).state).toBe('REVIEW'); expect(values.get(2).state).toBe('REVIEW'); expect(values.get(2).reasons).toContain('SIBLING_DECLARATION_REVIEW');
  });
  it('uses corrected quantities in the common sibling budget and keeps stock unchanged', async () => {
    const f = fixture(), before = structuredClone(f.movements), e = event(preview(f, '0.25')), revisions = await journal.read(db([e]), f.rows, f.receipts);
    const values = materials.assess(f.rows, visit, 'REGULAR', f.receipts, f.movements, revisions); expect(values.get(1).state).toBe('REVIEW'); expect(values.get(2).reasons).toContain('DECLARATIONS_EXCEED_NET_CONSUMPTION'); expect(values.get(1).original.items[0].quantity).toBe('0.1'); expect(f.movements).toEqual(before);
  });
  it('marks withdrawal distinctly and changes the sibling source hash even after restoring the original quantity', async () => {
    const f = fixture(), before = materials.assess(f.rows, visit, 'REGULAR', f.receipts, f.movements), first = event(preview(f, null));
    const revisions = await journal.read(db([first]), f.rows, f.receipts), after = materials.assess(f.rows, visit, 'REGULAR', f.receipts, f.movements, revisions); expect(after.get(1).state).toBe('WITHDRAWN'); expect(after.get(1).record).toBe(null); expect(after.get(2).comparison.sourceHash).not.toBe(before.get(2).comparison.sourceHash);
    const second = event(preview(f, '0.1', { headHash:first.response.revisionHash,action:'WITHDRAW',record:null }), 11), restored = materials.assess(f.rows, visit, 'REGULAR', f.receipts, f.movements, await journal.read(db([first,second]), f.rows, f.receipts)); expect(restored.get(1).state).toBe('MATCHED'); expect(restored.get(2).comparison.sourceHash).not.toBe(before.get(2).comparison.sourceHash);
  });
  it('fails closed when the correction journal cannot be read', async () => {
    const f = fixture(); await expect(journal.read({ fieldWriteRequest:{ findMany:async () => { throw Error('Unavailable'); } } }, f.rows, f.receipts)).rejects.toThrow('Unavailable');
  });
});
