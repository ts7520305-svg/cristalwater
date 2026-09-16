(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  function legacy() { const raw = localStorage.getItem('cristalwater_offline_queue'); return !!raw && raw !== '[]'; }
  window.getOfflineQueue = async () => { const rows = await store.records('VISIT_COMPLETION'); if (legacy()) throw Error('Conclusões antigas sem conta confirmada foram preservadas; peça revisão ao escritório.'); return rows; };
  window.addOfflineAction = async (action, captured = store.session()) => {
    const match = /^\/api\/core\/visits\/([1-9][0-9]*)\/complete$/.exec(action.url);
    if (!match || (action.method && action.method !== 'POST') || action.headers) throw Error('Operação offline não reconhecida. Os dados não foram enviados.');
    return store.prepare('VISIT_COMPLETION', Number(match[1]), action.body, { label: 'Conclusão da visita ' + match[1] }, captured);
  };
  window.sendOfflineAction = async (record, captured = store.session(), options = {}) => { for (const photo of (await store.records('VISIT_PHOTO', captured)).filter(item => item.resourceId === record.resourceId)) await store.send(photo.requestId, captured, options); return store.send(record.requestId, captured, options); };
  window.syncOfflineQueue = async () => { const captured = store.session(), confirmed = []; let error = ''; for (const record of await store.records('VISIT_COMPLETION', captured)) { if (record.failure?.blocked || record.failure?.retryAt > Date.now()) continue; try { confirmed.push(await window.sendOfflineAction(record, captured, { automatic: true })); } catch (failure) { error = failure.message; break; } } return { pending: (await store.records('VISIT_COMPLETION', captured)).length, confirmed, error, unattributed: legacy() }; };
})();
