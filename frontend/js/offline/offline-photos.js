(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  // Presentation follows the original Error identity; persisted/server text is literal.
  const errors = new WeakMap();
  function problem(key, message) {
    const error = Error(message);
    errors.set(error, Object.freeze({ key, params: Object.freeze({}) }));
    return error;
  }
  window.CWLegacyPhotoErrors = Object.freeze({ copy: error => errors.get(error) });
  function legacy() { const raw = localStorage.getItem('cristalwater_offline_photos'); return !!raw && raw !== '[]'; }
  window.getOfflinePhotos = async () => { const rows = await store.records('VISIT_PHOTO'); if (legacy()) throw problem('legacyPhotoHistory', 'Fotografias antigas sem conta confirmada foram preservadas; peça revisão ao escritório.'); return rows; };
  window.saveOfflinePhoto = async (photo, captured = store.session()) => {
    if (!store.same(captured)) throw problem('legacyPhotoSession', 'A sessão mudou.');
    const file = photo.file;
    if (!(file instanceof Blob) || !file.type.startsWith('image/') || !file.size || file.size > 25 * 1024 * 1024) throw problem('legacyPhotoFile', 'Escolha uma fotografia válida, até 25 MB.');
    return store.prepare('VISIT_PHOTO', Number(photo.visitId), { type: photo.type || 'AFTER', sha256: await store.digest(await file.arrayBuffer()), size: file.size }, { file, fileName: file.name || 'photo', label: 'Fotografia da visita ' + photo.visitId }, captured);
  };
  window.syncOfflinePhotos = async () => { const result = await store.flush('VISIT_PHOTO'); return { ...result, unattributed: legacy() }; };
})();
