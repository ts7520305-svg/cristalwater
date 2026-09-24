(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cw-maintenance-material-rules'));
  else root.CWEquipmentMaterialReviewRules = factory(root.CWMaintenanceMaterialRules);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (material) {
  'use strict';
  const scope = 'EQUIPMENT_MATERIAL_REVIEW', basis = 'ADMIN_EQUIPMENT_MATERIAL_REVIEW';
  const { positive, quantity, decimal, normalize, sha, iso } = material;
  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
  const fields = (v, names) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
  const fail = () => { throw Error('A declaração ou a confirmação recebida precisa de revisão. Conserve o pedido original.'); };
  function input(value) {
    if (!fields(value, ['mode','items']) || !['NONE','DECLARED'].includes(value.mode) || !Array.isArray(value.items) || value.items.length > 20 || (value.mode === 'NONE' ? value.items.length !== 0 : value.items.length === 0)) fail();
    const seen = new Set();
    const items = value.items.map(item => {
      if (!fields(item, ['productName','unit','quantity']) || typeof item.productName !== 'string' || item.productName.length > 160 || typeof item.unit !== 'string' || item.unit.length > 24) fail();
      const q = quantity(item.quantity), productName = normalize(item.productName), unit = normalize(item.unit), key = JSON.stringify([productName, unit]);
      if (!productName || !unit || q === null || q <= 0n || q > 100000000000n || seen.has(key)) fail(); seen.add(key);
      return { productName, unit, quantity: decimal(q) };
    });
    return { mode: value.mode, items };
  }
  const origin = o => fields(o, ['visitType','visitId','poolId','clientId','technicianId']) && ['REGULAR','EXTRA'].includes(o.visitType) && ['visitId','poolId','clientId','technicianId'].every(k => positive(o[k]));
  async function record(r, hash) {
    if (!fields(r, ['schema','basis','mode','items','origin',...(r?.schema===2?['originReviewHash']:[])]) || ![1,2].includes(r.schema) || r.schema===2&&!sha(r.originReviewHash) || r.basis !== 'DECLARED_EQUIPMENT_MATERIALS' || !origin(r.origin) || await hash(input({ mode: r.mode, items: r.items })) !== await hash({ mode: r.mode, items: r.items })) fail(); return r;
  }
  const facts = p => { const { available, hash, ...v } = p; return v; };
  async function preview(p, hash) {
    if (p?.available !== true || ![1,2].includes(p.schema) || p.basis !== basis || !positive(p.completionId) || !origin(p.origin) || !sha(p.hash) || await hash(facts(p)) !== p.hash || !sha(p.baseHash) || await hash(p.original) !== p.baseHash || p.original?.id !== p.completionId || !iso(p.original.completedAt) || !sha(p.original.resultHash) || !sha(p.original.receiptHash) || !sha(p.sourceHash) || !sha(p.targetHash) || !p.previous || !(p.previous.headHash === null || sha(p.previous.headHash)) || !['ORIGINAL','REPLACE','WITHDRAW'].includes(p.previous.action) || !['REPLACE','WITHDRAW'].includes(p.proposed?.action)) fail();
    if (p.schema === 2) {
      const rules = typeof module === 'object' && module.exports ? require('./cw-equipment-history-rules') : globalThis.CWEquipmentHistoryRules;
      const proof = await rules.revision(p.originReview, hash), source = proof.revision.preview;
      if (source.completionId !== p.completionId || source.baseHash !== p.baseHash || source.proposed.action !== 'REPLACE' || p.proposed.action === 'REPLACE' && (await hash(source.origin) !== await hash(p.origin) || source.targetHash !== p.targetHash || p.proposed.record?.schema !== 2 || p.proposed.record.originReviewHash !== proof.hash) || p.proposed.action === 'WITHDRAW' && (p.previous.record?.schema !== 2 || p.previous.record.originReviewHash !== proof.hash)) fail();
    } else if (Object.hasOwn(p, 'originReview') || p.previous.record?.schema === 2 || p.proposed.record?.schema === 2) fail();
    if (p.previous.record !== null) await record(p.previous.record, hash);
    if (p.proposed.action === 'WITHDRAW') { if (p.proposed.record !== null || p.previous.record === null) fail(); }
    else { await record(p.proposed.record, hash); if (await hash(p.proposed.record.origin) !== await hash(p.origin) || await hash(p.previous.record) === await hash(p.proposed.record)) fail(); }
    if (!Array.isArray(p.affectedShares) || new Set(p.affectedShares.map(s => s.id)).size !== p.affectedShares.length || p.affectedShares.some(s => !uuid(s.id) || !sha(s.hash) || ![s.expenseId,s.allocationId,s.completionId,s.amountCents].every(positive) || quantity(s.quantity) === null || quantity(s.quantity) <= 0n)) fail();
    if (!['MISSING','NONE','MATCHED','DECLARED','REVIEW','WITHDRAWN'].includes(p.beforeState) || !['NONE','MATCHED','DECLARED','REVIEW','WITHDRAWN'].includes(p.afterState) || !Array.isArray(p.afterReasons)) fail();
    return p;
  }
  async function response(value, body, owner, completionId, hash) {
    const { requestId, ...payload } = body, receipt = value?.receipt;
    if (value?.ok !== true || typeof value.applied !== 'boolean' || !uuid(requestId) || !/^ADMIN:[1-9]\d*$/.test(owner) || !positive(completionId) || receipt?.scope !== scope || receipt.resourceId !== completionId || receipt.owner !== owner || receipt.requestId !== requestId || !iso(receipt.confirmedAt) || receipt.payloadHash !== await hash({ v: 1, scope, resourceId: completionId, payload }) || await hash(value.envelope) !== await hash(body)) fail();
    if (!value.applied) { if (typeof value.code !== 'string' || typeof value.message !== 'string' || value.revision !== undefined || value.revisionHash !== undefined) fail(); return value; }
    const revision = value.revision, p = await preview(revision?.preview, hash);
    if (revision.schema !== 1 || revision.id !== requestId || revision.owner !== owner || revision.completionId !== completionId || !iso(revision.createdAt) || revision.reason !== body.reason || body.reason.trim() !== body.reason || body.reason.length < 3 || body.reason.length > 500 || p.completionId !== completionId || p.hash !== body.previewHash || p.proposed.action !== body.action || body.confirmed !== true || await hash(body.materials) !== await hash(p.proposed.record ? { mode: p.proposed.record.mode, items: p.proposed.record.items } : null) || await hash(revision) !== value.revisionHash) fail();
    if(p.schema===2 && Date.parse(revision.createdAt)<Date.parse(p.originReview.revision.createdAt))fail();
    return value;
  }
  return { scope, basis, fields, positive, uuid, sha, iso, input, origin, record, facts, preview, response };
});
