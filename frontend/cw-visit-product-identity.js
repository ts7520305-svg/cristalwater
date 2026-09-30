(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CWVisitProductIdentity = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  // Presentation is private to errors created here; the original message and payload stay unchanged.
  const messages = {
  "identity": [
    "Confirme a linha e a guia do produto.",
    "Confirm the product line and work guide.",
    "Confirmez la ligne du produit et le bon de travail.",
    "Confirma la línea del producto y la guía de trabajo.",
    "Bestätigen Sie die Produktzeile und den Arbeitsbeleg."
  ],
  "nameUnit": [
    "Confirme o nome e a unidade do produto.",
    "Confirm the product name and unit.",
    "Confirmez le nom et l’unité du produit.",
    "Confirma el nombre y la unidad del producto.",
    "Bestätigen Sie den Produktnamen und die Einheit."
  ],
  "ambiguous": [
    "O produto e a unidade não identificam uma única linha da guia. Atualize ou peça revisão ao escritório.",
    "The product and unit do not identify a single guide line. Refresh or ask the office to review it.",
    "Le produit et l’unité ne désignent pas une ligne unique du bon. Actualisez ou demandez une vérification au bureau.",
    "El producto y la unidad no identifican una única línea de la guía. Actualiza o pide una revisión a la oficina.",
    "Produkt und Einheit bestimmen keine eindeutige Belegzeile. Aktualisieren Sie die Daten oder bitten Sie das Büro um Prüfung."
  ],
  "invalidItem": [
    "Esta linha precisa de nome e unidade confirmados na guia.",
    "This line needs a confirmed name and unit in the guide.",
    "Le nom et l’unité de cette ligne doivent être confirmés dans le bon.",
    "Esta línea necesita el nombre y la unidad confirmados en la guía.",
    "Name und Einheit dieser Zeile müssen im Beleg bestätigt sein."
  ],
  "quantityRequired": [
    "Indique uma quantidade positiva em cada linha, ou remova a linha.",
    "Enter a positive quantity on each line, or remove the line.",
    "Indiquez une quantité positive sur chaque ligne, ou supprimez la ligne.",
    "Indica una cantidad positiva en cada línea o elimina la línea.",
    "Geben Sie in jeder Zeile eine positive Menge ein oder entfernen Sie die Zeile."
  ],
  "quantityRange": [
    "Indique uma quantidade positiva até 100000, ou remova a linha.",
    "Enter a positive quantity up to 100000, or remove the line.",
    "Indiquez une quantité positive jusqu’à 100000, ou supprimez la ligne.",
    "Indica una cantidad positiva de hasta 100000 o elimina la línea.",
    "Geben Sie eine positive Menge bis 100000 ein oder entfernen Sie die Zeile."
  ],
  "selectProduct": [
    "Selecione o produto e confirme a unidade em cada linha, ou remova a linha.",
    "Select the product and confirm the unit on each line, or remove the line.",
    "Sélectionnez le produit et confirmez l’unité sur chaque ligne, ou supprimez la ligne.",
    "Selecciona el producto y confirma la unidad en cada línea o elimina la línea.",
    "Wählen Sie das Produkt und bestätigen Sie die Einheit in jeder Zeile oder entfernen Sie die Zeile."
  ]
};
  const errors = new WeakMap(), descriptions = new WeakSet();
  function problem(key) {
    const error = Error(messages[key][0]), entry = Object.freeze({ key });
    descriptions.add(entry); errors.set(error, entry); return error;
  }
  const presentation = Object.freeze({
    error: error => errors.get(error) || null,
    format(entry, language = 'pt') {
      if (!descriptions.has(entry)) return String(entry ?? '');
      const index = Math.max(0, ['pt', 'en', 'fr', 'es', 'de'].indexOf(String(language).toLowerCase().split('-')[0]));
      return messages[entry.key][index];
    },
  });
  const own = (v, k) => Object.hasOwn(v || {}, k);
  const positive = v => Number.isSafeInteger(v) && v > 0 && v <= 2147483647;
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const normalize = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const hasIdentity = v => own(v, 'workGuideItemId') || own(v, 'workGuideId');
  function identity(v) {
    if (!hasIdentity(v)) return null;
    if (!positive(v.workGuideId) || !positive(v.workGuideItemId)) throw problem('identity');
    return { workGuideId: v.workGuideId, workGuideItemId: v.workGuideItemId };
  }
  const key = v => JSON.stringify([normalize(v.name ?? v.itemName), normalize(v.unit)]);
  function resolve(items, product, guideId) {
    const selected = identity(product);
    if (!text(product.name) || !text(product.unit)) throw problem('nameUnit');
    const matches = selected
      ? (selected.workGuideId === guideId ? items.filter(row => row.id === selected.workGuideItemId && row.name === product.name && row.unit === product.unit) : [])
      : items.filter(row => text(row.unit) && key(row) === key(product));
    if (matches.length !== 1) throw problem('ambiguous');
    return matches[0];
  }
  function fromItem(row, guideId) {
    if (!positive(row?.id) || !positive(guideId) || row.workGuideId !== guideId || !text(row.name) || !text(row.unit)) throw problem('invalidItem');
    return { name: row.name, unit: row.unit, workGuideId: guideId, workGuideItemId: row.id };
  }
  function quantity(value) {
    if (!['string', 'number'].includes(typeof value) || typeof value === 'string' && !value.trim()) throw problem('quantityRequired');
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 100000) throw problem('quantityRange');
    return n;
  }
  function payload(row) {
    const selected = identity(row);
    if (!text(row?.name) || !text(row?.unit)) throw problem('selectProduct');
    return { name: row.name, unit: row.unit, quantity: quantity(row.quantity), notes: typeof row.notes === 'string' ? row.notes : '', ...(selected || {}) };
  }
  return { identity, hasIdentity, positive, normalize, key, resolve, fromItem, payload, quantity, text, presentation };
}));
