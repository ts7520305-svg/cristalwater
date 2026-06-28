// ====================================================================
// CRISTAL WATER ENTERPRISE — STOCK NORMALIZER V22 ORE
// Chaves determinísticas para evitar stock duplicado por acentos/espaços.
// ====================================================================

function normalizeProductName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  return rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnit(rawUnit, fallback = 'KG') {
  const unit = normalizeProductName(String(rawUnit || fallback));
  return unit || fallback;
}

module.exports = { normalizeProductName, normalizeUnit };
