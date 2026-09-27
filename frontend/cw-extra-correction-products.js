(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cw-visit-product-identity') : root.CWVisitProductIdentity);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CWExtraCorrectionProducts = api;
}(typeof globalThis === 'object' ? globalThis : this, function (R) {
  'use strict';
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const instant = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
  function packet(p, context) {
    if (!object(p) || p.version !== 1 || p.owner !== context.owner || p.visitId !== context.id || p.poolId !== context.poolId || p.baseVersion !== context.baseVersion || !/^[a-f0-9]{64}$/.test(p.baseVersion) || !instant(p.asOf) || !Array.isArray(p.guides)) return false;
    if (p.state !== 'AVAILABLE') return ['NO_ORIGINAL_GUIDE', 'REVIEW_REQUIRED'].includes(p.state) && p.guides.length === 0;
    if (!p.guides.length) return false;
    const ids = new Set(), items = new Set();
    return p.guides.every(g => {
      if (!object(g) || !R.positive(g.id) || ids.has(g.id) || !R.positive(g.vehicleId) || g.status !== 'OPEN' || !(g.technicianId === null || g.technicianId === context.technicianId) || !Array.isArray(g.items) || g.itemCount !== g.items.length) return false;
      ids.add(g.id);
      return g.items.every((r, i) => {
        if (!object(r) || !R.positive(r.id) || items.has(r.id) || r.workGuideId !== g.id || typeof r.name !== 'string' || !(r.unit === null || typeof r.unit === 'string') || !['quantity', 'initialQty', 'usedQty'].every(k => Number.isFinite(r[k])) || i > 0 && g.items[i - 1].id >= r.id) return false;
        items.add(r.id); return true;
      });
    });
  }
  const items = p => p?.state === 'AVAILABLE' ? p.guides.flatMap(g => g.items) : [];
  const exact = (item, row) => item.id === row.workGuideItemId && item.workGuideId === row.workGuideId && item.name === row.name && item.unit === row.unit;
  const selectable = item => R.text(item.name) && R.text(item.unit);
  function choices(all, row, view) {
    const selected = all.find(item => selectable(item) && exact(item, row));
    const entries = view.entries.map(entry => ({ ...entry, valid: selectable(entry.item), chosen: entry.item === selected, pinned: false }));
    if (selected && !entries.some(e => e.chosen)) entries.unshift({ item: selected, position: all.indexOf(selected), valid: true, chosen: true, pinned: true });
    return { entries, saved: !selected && !!(row.name || row.unit || R.hasIdentity(row)) };
  }
  function allowed(row, baseline, catalogue) {
    try {
      R.payload(row);
      const same = before => before.name === row.name && before.unit === row.unit && JSON.stringify(R.identity(before)) === JSON.stringify(R.identity(row));
      return (baseline.chemicalsJson || []).some(same) || !!R.identity(row) && items(catalogue).some(item => selectable(item) && exact(item, row));
    } catch (_) { return false; }
  }
  return { packet, items, choices, allowed };
}));
