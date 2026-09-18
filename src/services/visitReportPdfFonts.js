"use strict";
const path = require('node:path');
module.exports = function prepareFonts(doc) {
  const regular = 'DejaVuSans', bold = 'DejaVuSans-Bold';
  doc.registerFont(regular, path.join(__dirname, '../assets/fonts/DejaVuSans.ttf'));
  doc.registerFont(bold, path.join(__dirname, '../assets/fonts/DejaVuSans-Bold.ttf'));
  doc.font(bold); const boldFace = doc._font.font;
  doc.font(regular); const regularFace = doc._font.font;
  const unsupported = new Set();
  function format(value) {
    // Preserve source data; normalization and explicit missing-glyph markers are PDF-only.
    return Array.from(String(value).normalize('NFC').replace(/\r\n?/g, '\n')).map(character => {
      const code = character.codePointAt(0);
      if (character === '\n') return character;
      if (character === '\t') return '    ';
      if (/[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]/u.test(character) && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(character) && regularFace.hasGlyphForCodePoint(code) && boldFace.hasGlyphForCodePoint(code)) return character;
      const label = 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
      unsupported.add(label); return '[' + label + ']';
    }).join('');
  }
  return { regular, bold, format, unsupported };
};
