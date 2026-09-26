(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CWVisitProductIdentity = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const own = (v, k) => Object.hasOwn(v || {}, k);
  const positive = v => Number.isSafeInteger(v) && v > 0 && v <= 2147483647;
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const normalize = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const hasIdentity = v => own(v, 'workGuideItemId') || own(v, 'workGuideId');
  function identity(v) {
    if (!hasIdentity(v)) return null;
    if (!positive(v.workGuideId) || !positive(v.workGuideItemId)) throw Error('Confirme a linha e a guia do produto.');
    return { workGuideId: v.workGuideId, workGuideItemId: v.workGuideItemId };
  }
  const key = v => JSON.stringify([normalize(v.name ?? v.itemName), normalize(v.unit)]);
  function resolve(items, product, guideId) {
    const selected = identity(product);
    if (!text(product.name) || !text(product.unit)) throw Error('Confirme o nome e a unidade do produto.');
    const matches = selected
      ? (selected.workGuideId === guideId ? items.filter(row => row.id === selected.workGuideItemId && row.name === product.name && row.unit === product.unit) : [])
      : items.filter(row => text(row.unit) && key(row) === key(product));
    if (matches.length !== 1) throw Error('O produto e a unidade não identificam uma única linha da guia. Atualize ou peça revisão ao escritório.');
    return matches[0];
  }
  function fromItem(row, guideId) {
    if (!positive(row?.id) || !positive(guideId) || row.workGuideId !== guideId || !text(row.name) || !text(row.unit)) throw Error('Esta linha precisa de nome e unidade confirmados na guia.');
    return { name: row.name, unit: row.unit, workGuideId: guideId, workGuideItemId: row.id };
  }
  function quantity(value) {
    if (!['string', 'number'].includes(typeof value) || typeof value === 'string' && !value.trim()) throw Error('Indique uma quantidade positiva em cada linha, ou remova a linha.');
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 100000) throw Error('Indique uma quantidade positiva até 100000, ou remova a linha.');
    return n;
  }
  function payload(row) {
    const selected = identity(row);
    if (!text(row?.name) || !text(row?.unit)) throw Error('Selecione o produto e confirme a unidade em cada linha, ou remova a linha.');
    return { name: row.name, unit: row.unit, quantity: quantity(row.quantity), notes: typeof row.notes === 'string' ? row.notes : '', ...(selected || {}) };
  }
  return { identity, hasIdentity, positive, normalize, key, resolve, fromItem, payload, quantity, text };
}));
