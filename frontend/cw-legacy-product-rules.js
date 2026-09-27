(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cw-visit-product-identity') : root.CWVisitProductIdentity,
    typeof module === 'object' && module.exports ? require('./cw-field-materials') : root.CWFieldMaterials);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CWLegacyProductRules = api;
}(typeof globalThis === 'object' ? globalThis : this, function (R, materials) {
  'use strict';
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const fields = ['name', 'productName', 'quantity', 'unit', 'notes', 'workGuideId', 'workGuideItemId'];
  const editable = rows => Array.isArray(rows) && rows.length <= 50 && rows.every(row => object(row) && Object.keys(row).every(key => fields.includes(key) && (row[key] === null || ['string', 'number'].includes(typeof row[key]))));
  function read(raw) {
    if (typeof raw !== 'string') throw Error('O registo anterior de produtos precisa de revisão.');
    if (!raw.trim()) return { kind: 'rows', rows: [], originalText: null };
    let value; try { value = JSON.parse(raw); } catch (_) { return { kind: 'text', rows: [], originalText: raw }; }
    if (editable(value)) return { kind: 'rows', rows: value, originalText: null };
    if (object(value) && Object.keys(value).length === 3 && value.v === 1 && typeof value.originalText === 'string' && editable(value.rows)) return { kind: 'rows', rows: value.rows, originalText: value.originalText };
    return { kind: 'text', rows: [], originalText: raw };
  }
  function encode(rows, originalText) {
    if (!editable(rows) || !(originalText === null || typeof originalText === 'string')) throw Error('Reveja a lista de produtos antes de guardar.');
    return JSON.stringify(originalText === null ? rows : { v: 1, originalText, rows });
  }
  function payload(raw, stock) {
    const saved = read(raw);
    if (saved.kind !== 'rows') throw Error('Reveja o texto anterior e prepare a lista dos produtos utilizados antes de concluir.');
    const products = saved.rows.map(R.payload), totals = new Map();
    for (const product of products) {
      if (!R.hasIdentity(product)) throw Error('Selecione novamente cada produto para confirmar a linha e a unidade da guia. O rascunho foi conservado.');
      if (!stock?.workGuide || !Array.isArray(stock.stock)) throw Error('Consulte a guia de produtos desta conta antes de concluir.');
      const item = R.resolve(stock.stock, product, stock.workGuide.id), quantities = [...(totals.get(item.id) || []), product.quantity]; totals.set(item.id, quantities);
      if (!Number.isFinite(item.quantity) || Number(materials.sum(quantities)) > item.quantity) throw Error('Stock insuficiente para ' + product.name + '. Reveja a quantidade total desta linha.');
    }
    return { products: JSON.stringify(products), ...(products.length ? { workGuideId: stock.workGuide.id, vehicleId: stock.workGuide.vehicleId } : {}) };
  }
  function describe(raw) {
    const value = read(raw); if (value.kind === 'text') return raw;
    const rows = value.rows.map(row => [row.name ?? row.productName ?? '', row.quantity ?? '', row.unit ?? '', row.notes ?? '', ...(R.hasIdentity(row) ? ['Guia ' + (row.workGuideId ?? '?') + ' · linha ' + (row.workGuideItemId ?? '?')] : [])].join(' · '));
    return [value.originalText, ...rows].filter(v => v !== null && v !== '').join('\n') || '(nenhum)';
  }
  return { read, encode, payload, describe };
}));
