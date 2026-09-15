(() => {
  'use strict';
  function transaction(key, mode, work) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('cw-inventory-pending-v1', 1);
      let blocked = false;
      open.onupgradeneeded = () => open.result.createObjectStore('requests', { keyPath: 'key' });
      open.onerror = () => reject(Error('Não foi possível abrir os pedidos guardados neste navegador.'));
      open.onblocked = () => { blocked = true; reject(Error('Feche as outras janelas do inventário e volte a tentar.')); };
      open.onsuccess = () => {
        const db = open.result; if (blocked) { db.close(); return; } db.onversionchange = () => db.close();
        const tx = db.transaction('requests', mode), store = tx.objectStore('requests');
        let result, error;
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onabort = tx.onerror = () => { db.close(); reject(error || Error('Não foi possível guardar o pedido. Os dados anteriores foram mantidos.')); };
        const request = store.get(key);
        request.onsuccess = () => { try { result = work(store, request.result || null); } catch (e) { error = e; tx.abort(); } };
      };
    });
  }
  window.CWInventoryPending = {
    read: key => transaction(key, 'readonly', (_store, value) => value),
    create: record => transaction(record.key, 'readwrite', (store, value) => {
      if (value) throw Error('Já existe um pedido pendente. Atualize o inventário antes de continuar.');
      store.add(record); return record;
    }),
    reject: (key, requestId, message) => transaction(key, 'readwrite', (store, value) => {
      if (!value || value.requestId !== requestId) throw Error('O pedido mudou noutra janela. Atualize o inventário.');
      const updated = { ...value, rejection: message }; store.put(updated); return updated;
    }),
    remove: (key, requestId) => transaction(key, 'readwrite', (store, value) => {
      if (!value || value.requestId !== requestId) throw Error('O pedido mudou noutra janela. Atualize o inventário.');
      store.delete(key);
    }),
  };
})();
