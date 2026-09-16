(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  async function assertHistory(captured = store.session()) {
    if (!store.same(captured)) throw Error('A sessão mudou. Reabra a página com a conta original.');
    // Older records have only a numeric identity, not the authenticated principal type.
    const rows = await new Promise((resolve, reject) => {
      const open = indexedDB.open('cw-field-media', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('photos', { keyPath: 'key' });
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('photos')) { db.close(); reject(Error('Arquivo de fotografias ilegível. Preserve os dados.')); return; }
        const tx = db.transaction('photos'), read = tx.objectStore('photos').getAll();
        read.onsuccess = () => { db.close(); resolve(read.result); }; read.onerror = () => { db.close(); reject(read.error); };
      };
    });
    if (!store.same(captured)) throw Error('A sessão mudou. As fotografias foram preservadas.');
    if (rows.some(row => !row.owner || row.owner === 'none' || String(row.owner) === String(captured.technicianId))) throw Error('Existem fotografias antigas sem conta confirmada. Os ficheiros foram preservados; peça revisão ao escritório antes de enviar.');
  }
  async function save(visitId, photo, captured = store.session()) {
    await assertHistory(captured);
    if (!(photo.file instanceof Blob) || !photo.file.size || photo.file.size > 25 * 1024 * 1024) throw Error('Escolha uma fotografia até 25 MB.');
    const payload = { type: photo.type || 'AFTER', size: photo.file.size, sha256: await store.digest(await photo.file.arrayBuffer()) };
    return store.prepare('VISIT_PHOTO', Number(visitId), payload, { requestId: photo.localId, file: photo.file, fileName: photo.fileName, label: 'Fotografia da visita ' + visitId }, captured);
  }
  async function list(visitId, includeConfirmed = false, captured = store.session()) {
    await assertHistory(captured);
    const rows = await store.records('VISIT_PHOTO', captured, includeConfirmed);
    return rows.filter(row => row.resourceId === Number(visitId)).map(row => ({
      localId: row.requestId, visitId: row.resourceId, type: row.payload.type, file: row.file, fileName: row.fileName,
      status: row.response ? 'uploaded' : 'pending', error: row.failure?.message || '',
      ...(row.response ? { url: row.response.photo.url, serverId: row.response.photo.id } : { previewUrl: URL.createObjectURL(row.file) })
    }));
  }
  async function send(visitId, localId, captured = store.session(), options = {}) {
    await assertHistory(captured);
    const row = await store.get(localId, captured);
    if (row.scope !== 'VISIT_PHOTO' || row.resourceId !== Number(visitId)) throw Error('A fotografia pertence a outra visita. Preserve o envio.');
    return store.send(localId, captured, options);
  }
  async function remove(visitId, localId, captured = store.session()) {
    const row = await store.get(localId, captured);
    if (row.scope !== 'VISIT_PHOTO' || row.resourceId !== Number(visitId) || row.response) throw Error('Esta fotografia já foi confirmada ou pertence a outra visita. Peça revisão ao escritório.');
    return store.remove(localId, captured);
  }
  async function sync(visitId, captured = store.session(), options = {}) {
    await assertHistory(captured);
    for (const row of await store.records('VISIT_PHOTO', captured)) if (row.resourceId === Number(visitId)) await store.send(row.requestId, captured, options);
  }
  async function pendingSummary(captured = store.session()) { await assertHistory(captured); return (await store.records('VISIT_PHOTO', captured)).map(row => ({ visitId: row.resourceId })); }
  window.CWFieldPhotos = { save, remove, list, sync, send, pendingSummary, assertHistory };
})();
