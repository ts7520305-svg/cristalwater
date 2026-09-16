(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  function legacy() { const raw = localStorage.getItem('cristalwater_offline_photos'); return !!raw && raw !== '[]'; }
  window.getOfflinePhotos = async () => { const rows = await store.records('VISIT_PHOTO'); if (legacy()) throw Error('Fotografias antigas sem conta confirmada foram preservadas; peça revisão ao escritório.'); return rows; };
  window.saveOfflinePhoto = async (photo, captured = store.session()) => {
    if (!store.same(captured)) throw Error('A sessão mudou.');
    const file = photo.file;
    if (!(file instanceof Blob) || !file.type.startsWith('image/') || !file.size || file.size > 25 * 1024 * 1024) throw Error('Escolha uma fotografia válida, até 25 MB.');
    return store.prepare('VISIT_PHOTO', Number(photo.visitId), { type: photo.type || 'AFTER', sha256: await store.digest(await file.arrayBuffer()), size: file.size }, { file, fileName: file.name || 'photo', label: 'Fotografia da visita ' + photo.visitId }, captured);
  };
  window.syncOfflinePhotos = async () => { const result = await store.flush('VISIT_PHOTO'); return { ...result, unattributed: legacy() }; };
})();
