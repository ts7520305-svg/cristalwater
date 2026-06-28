/*
  V21 concurrency simulation.
  This is a deterministic local safety test for the expected stock behavior:
  10 simultaneous consumers, limited stock for 1 operation, result must be:
  1 success, 9 conflicts, stock never negative.
*/
class ConflictError extends Error { constructor(msg){ super(msg); this.code = 409; } }
function delay(ms){ return new Promise(r => setTimeout(r, ms)); }
async function withLock(lock, fn){
  while (lock.busy) await delay(1);
  lock.busy = true;
  try { return await fn(); }
  finally { lock.busy = false; }
}
async function consumeStock(state, lock, qty){
  return withLock(lock, async () => {
    await delay(2);
    if (state.qty < qty) throw new ConflictError('STOCK_INSUFFICIENT_FOR_OPERATION');
    state.qty -= qty;
    return { ok:true, status:'SYNCHRONIZED' };
  });
}
(async () => {
  const state = { qty: 1 };
  const lock = { busy:false };
  const results = await Promise.allSettled(Array.from({length:10}, () => consumeStock(state, lock, 1)));
  const success = results.filter(r => r.status === 'fulfilled').length;
  const rejected409 = results.filter(r => r.status === 'rejected' && r.reason.code === 409).length;
  if (success !== 1 || rejected409 !== 9 || state.qty !== 0) {
    console.error({ success, rejected409, finalStock: state.qty });
    process.exit(1);
  }
  console.log('V21 concurrency simulation OK: 1 success, 9 conflicts, 0 negative stock');
})();
