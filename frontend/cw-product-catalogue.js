(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cw-visit-product-identity') : root.CWVisitProductIdentity);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CWProductCatalogue = api;
}(typeof globalThis === 'object' ? globalThis : this, function (R) {
  'use strict';
  const size = 25;
  const indexes = new WeakMap();
  function index(items) {
    if (!indexes.has(items)) indexes.set(items, items.map((item, position) => ({ item, position, search: R.normalize([item.name, item.unit].join(' ')) })));
    return indexes.get(items);
  }
  function page(items, query = '', offset = 0) {
    const tokens = R.normalize(query).split(/\s+/).filter(Boolean);
    const matches = index(items).filter(row => tokens.every(token => /^#\d+$/.test(token) ? String(row.item.id) === token.slice(1) : row.search.includes(token) || String(row.item.id).includes(token)));
    const start = Math.min(Math.max(0, Math.floor((Number.isSafeInteger(offset) ? offset : 0) / size) * size), Math.max(0, Math.ceil(matches.length / size) - 1) * size);
    return { entries: matches.slice(start, start + size), offset: start, total: matches.length, available: items.length, from: matches.length ? start + 1 : 0, to: Math.min(start + size, matches.length), hasPrevious: start > 0, hasNext: start + size < matches.length };
  }
  function selection(items, guideId, row, view) {
    const valid = item => R.positive(item.id) && item.workGuideId === guideId && R.text(item.name) && R.text(item.unit) && Number.isFinite(item.quantity);
    const selected = index(items).filter(entry => valid(entry.item) && row.workGuideId === guideId && row.workGuideItemId === entry.item.id && row.name === entry.item.name && row.unit === entry.item.unit);
    const exact = selected.length === 1 ? selected[0] : null;
    const entries = view.entries.map(entry => ({ ...entry, valid: valid(entry.item), chosen: entry === exact, pinned: false }));
    if (exact && !view.entries.includes(exact)) entries.unshift({ ...exact, valid: true, chosen: true, pinned: true });
    return { entries, saved: !exact && !!(row.name || row.productName || row.unit || R.hasIdentity(row)) };
  }
  function mount(host, changed, states = new Map()) {
    const node = tag => document.createElement(tag), box = node('section');
    box.dataset.productCatalogue = ''; box.dataset.cwNoI18n = ''; box.dataset.cwStateManaged = 'manual'; box.dataset.cwFormMemory = 'managed';
    const label = node('label'), title = node('span'), search = node('input'), count = node('p'), help = node('p'), actions = node('div'), previous = node('button'), next = node('button'), clear = node('button');
    search.type = 'search'; search.maxLength = 200; search.autocomplete = 'off'; search.dataset.catalogueSearch = ''; label.append(title, search);
    count.dataset.catalogueCount = ''; count.setAttribute('aria-live', 'polite');
    previous.dataset.cataloguePrevious = ''; next.dataset.catalogueNext = ''; clear.dataset.catalogueClear = '';
    for (const button of [previous, next, clear]) button.type = 'button'; actions.append(previous, next, clear); box.append(label, count, help, actions); host.append(box);
    let state = { query: '', offset: 0 }, items = [], language = 'pt', disabled = true, available = false, view = page(items);
    const text = (key, values) => window.CWFieldDocumentCopy.text(key, values, language);
    function paint() {
      view = page(items, state.query, state.offset); if (available) state.offset = view.offset;
      title.textContent = text('catalogueSearch'); search.placeholder = text('cataloguePlaceholder'); if (search.value !== state.query) search.value = state.query;
      search.disabled = disabled || !available; count.textContent = available ? text('catalogueCount', view) : text('catalogueUnavailable'); help.textContent = text('catalogueHelp');
      previous.textContent = text('cataloguePrevious'); next.textContent = text('catalogueNext'); clear.textContent = text('catalogueClear');
      previous.disabled = disabled || !available || !view.hasPrevious; next.disabled = disabled || !available || !view.hasNext; clear.disabled = disabled || !available || !state.query && !state.offset;
    }
    function change(action) { if (disabled || !available) return; action(); paint(); changed(); }
    search.addEventListener('input', () => change(() => { state.query = search.value; state.offset = 0; }));
    previous.onclick = () => change(() => { state.offset -= size; }); next.onclick = () => change(() => { state.offset += size; }); clear.onclick = () => change(() => { state.query = ''; state.offset = 0; search.focus(); });
    if (!document.getElementById('cwProductCatalogueStyle')) {
      const style = node('style'); style.id = 'cwProductCatalogueStyle'; style.textContent = '[data-product-catalogue]{margin:14px 0;padding:12px;border:1px solid #91aaa8;border-radius:10px;background:#f4f9f8;color:#173c32;min-width:0}[data-product-catalogue] *{box-sizing:border-box;max-width:100%;overflow-wrap:anywhere}[data-product-catalogue] label{display:grid;gap:8px;font-weight:700}[data-product-catalogue] input{display:block;width:100%;min-width:0;min-height:44px;margin:0;padding:10px;border:1px solid #789b8f;border-radius:7px;background:white;color:#173c32;font:16px/1.4 system-ui}[data-product-catalogue] p{margin:10px 0;font:14px/1.5 system-ui;color:#30564d}[data-product-catalogue]>div{display:flex;flex-wrap:wrap;gap:8px}[data-product-catalogue] button{width:auto;min-height:44px;padding:10px 14px;margin:0;border:1px solid #075c4c;border-radius:8px;background:#075c4c;color:white;font:16px/1.4 system-ui;white-space:normal}[data-product-catalogue] button:disabled{opacity:.6}[data-product-catalogue] :focus-visible{outline:3px solid #0079ba;outline-offset:3px}@media(max-width:450px){[data-product-catalogue]>div{display:grid;grid-template-columns:minmax(0,1fr)}}'; document.head.append(style);
    }
    return { update(config) { const key = String(config.key); if (!config.active) { states.clear(); state = { query: '', offset: 0 }; } else { if (!states.has(key)) states.set(key, { query: '', offset: 0 }); state = states.get(key); } items = config.active && Array.isArray(config.items) ? config.items : []; language = config.language; disabled = !config.active || !!config.disabled; available = config.active && !!config.available; paint(); return view; }, get view() { return view; }, box, states };
  }
  return { size, page, selection, mount };
}));
