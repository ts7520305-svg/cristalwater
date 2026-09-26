(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CWFieldMaterials = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = key => `<span data-doc-copy="${key}"></span>`;
  const hasUnit = value => typeof value === 'string' && value.trim().length > 0;
  const unit = value => hasUnit(value) ? esc(value) : label('unit');
  const quantity = value => numeric(value) ? esc(value) : label('quantityUnknown');

  // Add the decimal representations supplied by the API, without a second
  // floating-point rounding step. Never infer missing values or convert units.
  function decimal(value) {
    const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
    const fraction = (mantissa.split('.')[1] || '').length;
    const scale = fraction - Number(exponent);
    const integer = BigInt(mantissa.replace('.', ''));
    return scale < 0 ? { integer: integer * 10n ** BigInt(-scale), scale: 0 } : { integer, scale };
  }
  function sum(values) {
    if (!values.length || !values.every(numeric)) return null;
    const parts = values.map(decimal), scale = parts.reduce((max, p) => Math.max(max, p.scale), 0);
    const integer = parts.reduce((s, p) => s + p.integer * 10n ** BigInt(scale - p.scale), 0n);
    const digits = (integer < 0n ? -integer : integer).toString().padStart(scale + 1, '0');
    const result = scale ? (digits.slice(0, -scale) + '.' + digits.slice(-scale)).replace(/\.?0+$/, '') : digits;
    return (integer < 0n ? '-' : '') + result;
  }
  function totals(items, field) {
    if (!Array.isArray(items)) return null;
    const groups = new Map(); let ungrouped = 0;
    for (const item of items) {
      if (!hasUnit(item?.unit)) { ungrouped++; continue; }
      if (!groups.has(item.unit)) groups.set(item.unit, []);
      groups.get(item.unit).push(item[field]);
    }
    return { groups: [...groups].map(([unit, values]) => ({ unit, value: sum(values) })), ungrouped };
  }
  function rows(items, field, kind) {
    if (!Array.isArray(items)) return `<p data-doc-copy="materialsUnavailable"></p>`;
    if (!items.length) return `<p data-doc-copy="materialsEmpty"></p>`;
    return `<div class="doc-items" data-material-rows="${kind}">${items.map((item, index) => `
      <div class="doc-item" data-material-index="${index}" data-material-id="${esc(item?.id ?? '')}">
        <span class="material-name">${typeof item?.name === 'string' && item.name.length ? esc(item.name) : label('materialNameUnknown')}</span>
        <strong data-material-value>${quantity(item?.[field])} ${unit(item?.unit)}</strong>
      </div>`).join('')}</div>`;
  }
  function list(items, kind) {
    const usage = kind === 'usage';
    return `<section data-material-section="${kind}" data-cw-no-i18n>
      ${kind === 'transport' ? '' : `<h3 class="doc-subtitle" data-doc-copy="${usage ? 'guideUsage' : 'guideBalance'}"></h3>`}
      ${usage ? '<p data-doc-copy="guideUsageHelp"></p>' : ''}
      ${rows(items, usage ? 'usedQty' : 'quantity', kind)}
    </section>`;
  }
  function totalRows(items, field) {
    const result = totals(items, field);
    if (!result) return label('materialsUnavailable');
    if (!items.length) return label('materialsEmpty');
    return result.groups.map(group => `<div class="material-total"><strong>${group.value === null ? label('quantityUnknown') : esc(group.value)}</strong> <span class="material-unit">${esc(group.unit)}</span></div>`).join('')
      + (result.ungrouped ? '<p data-doc-copy="ungroupedUnits"></p>' : '');
  }
  function summary(items) {
    return `<section class="doc-summary" data-material-summary data-cw-no-i18n>
      <h3 class="doc-subtitle" data-doc-copy="materialTotals"></h3>
      <p data-doc-copy="materialTotalsHelp"></p>
      <h4 data-doc-copy="guideBalance"></h4><div data-material-totals="quantity">${totalRows(items, 'quantity')}</div>
      <h4 data-doc-copy="guideUsage"></h4><div data-material-totals="usedQty">${totalRows(items, 'usedQty')}</div>
    </section>`;
  }
  return { sum, totals, list, summary };
}));
