'use strict';
const r = require('./fieldWriteRequestService'), rules = require('../../frontend/cw-equipment-material-review-rules');
const json = value => JSON.parse(JSON.stringify(value));
function original(row, receipts) {
  return { id: row.id, planId: row.planId, requestId: row.requestId, fingerprint: row.fingerprint, completedAt: row.completedAt.toISOString(), resultHash: r.hash(row.result), receiptHash: r.hash(receipts.filter(p => p.requestId === row.requestId)), record: row.result?.completion?.materials || null };
}
async function read(db, rows, receipts) {
  const states = new Map(rows.map(row => [row.id, { valid: true, headHash: null, action: 'ORIGINAL', record: row.result?.completion?.materials || null, history: [] }]));
  if (!rows.length) return states;
  const events = await db.fieldWriteRequest.findMany({ where: { scope: rules.scope, resourceId: { in: rows.map(row => row.id) } }, orderBy: { id: 'asc' } });
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const e of events) {
    const state = states.get(e.resourceId);
    try {
      const value = await rules.response(e.response, e.response?.envelope, e.owner, e.resourceId, r.hash);
      if (value.receipt.payloadHash !== e.payloadHash || value.receipt.requestId !== e.requestId) throw Error('Changed receipt');
      if (!value.applied) continue;
      const revision = value.revision, p = revision.preview;
      if (p.previous.headHash !== state.headHash || p.previous.action !== state.action || r.hash(p.previous.record) !== r.hash(state.record) || p.baseHash !== r.hash(original(byId.get(e.resourceId), receipts))) throw Error('Changed chain or original');
      state.headHash = value.revisionHash; state.action = p.proposed.action; state.record = p.proposed.record; state.history.push(json({ revision, hash: value.revisionHash }));
    } catch (_) { state.valid = false; }
  }
  return states;
}
module.exports = { original, read, rules };
