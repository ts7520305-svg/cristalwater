'use strict';
// Historical material declarations depend on the exact administrative origin
// attestation. A later attestation never silently reauthorizes an older one.
const history = require('./equipmentHistoryService'), r = require('./fieldWriteRequestService');
const proofOf = state => state?.history.at(-1)?.revision.preview.originReview || null;
async function current(db, id) {
  const c = await history.context(db, id);
  return c.available && c.legacy && c.eligible && c.journalValid && c.current.state === 'ATTESTED'
    ? { context: c, proof: c.history.at(-1) } : { context: c, proof: null };
}
async function qualify(db, revisions) {
  for (const [id, state] of revisions) {
    const proof = proofOf(state); if (!proof) continue;
    const live = await current(db, id);
    state.originReviewValid = !!live.proof && live.proof.hash === proof.hash;
    state.originReview = proof;
  }
  return revisions;
}
async function selection(db, row, state) {
  const live = await current(db, row.id), previous = proofOf(state);
  const withdraw = state?.valid && previous && live.context?.legacy && live.context?.journalValid
    && r.hash(live.context.original) === previous.revision.preview.baseHash ? previous : null;
  return { current: live.proof, withdraw, context: live.context };
}
module.exports = { proofOf, current, qualify, selection };
