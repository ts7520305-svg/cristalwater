"use strict";
// Test reader for PDFKit output: decode page text using each embedded font's ToUnicode map.
// This deliberately ignores image and font-file streams, which are not displayed text.
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
module.exports = function pdfText(bytes) {
  const raw = bytes.toString('latin1'), starts = [...raw.matchAll(/(\d+) 0 obj\s*\n/g)], objects = new Map();
  for (let index = 0; index < starts.length; index++) {
    const start = starts[index].index + starts[index][0].length, end = starts[index + 1]?.index ?? bytes.length;
    const body = raw.slice(start, end), stream = /stream\r?\n/.exec(body);
    const dictionary = body.slice(0, stream?.index ?? body.indexOf('endobj'));
    objects.set(Number(starts[index][1]), { dictionary, stream: () => {
      if (!stream) return '';
      const size = Number([...dictionary.matchAll(/\/Length (\d+)/g)].at(-1)?.[1]);
      assert(Number.isInteger(size) && size > 0, 'Expected a direct stream byte length');
      const offset = start + stream.index + stream[0].length, data = bytes.subarray(offset, offset + size);
      return (/\/FlateDecode/.test(dictionary) ? inflateSync(data) : data).toString('latin1');
    } });
  }
  const maps = new Map(), aliases = new Map(), pages = [];
  for (const [id, object] of objects) {
    const unicode = /\/ToUnicode (\d+) 0 R/.exec(object.dictionary);
    if (unicode) {
      const cmap = objects.get(Number(unicode[1])).stream(), map = new Map();
      for (const range of cmap.matchAll(/<([a-f0-9]+)>\s*<([a-f0-9]+)>\s*\[([^\]]+)\]/gi)) {
        let code = parseInt(range[1], 16);
        for (const value of range[3].matchAll(/<([a-f0-9\s]*)>/gi)) {
          const text = Buffer.from(value[1].replace(/\s/g, ''), 'hex'); assert.equal(text.length % 2, 0);
          map.set(code++, text.swap16().toString('utf16le'));
        }
        assert.equal(code - 1, parseInt(range[2], 16));
      }
      assert(map.size, 'Embedded font must have a readable character map'); maps.set(id, map);
    }
    for (const alias of object.dictionary.matchAll(/\/(F\d+) (\d+) 0 R/g)) aliases.set(alias[1], Number(alias[2]));
    const page = /\/Contents (\d+) 0 R/.exec(object.dictionary); if (page) pages.push(Number(page[1]));
  }
  const content = pages.length ? pages.map(id => objects.get(id).stream()) : [...objects.values()].filter(o => /\/Length/.test(o.dictionary) && !/\/Subtype \/Image|\/Length1/.test(o.dictionary)).map(o => o.stream());
  return content.map(stream => {
    let font; const output = [];
    for (const token of stream.matchAll(/\/(F\d+) [\d.]+ Tf|\[([^\]]+)\]\s*TJ/g)) {
      if (token[1]) { font = maps.get(aliases.get(token[1])); continue; }
      output.push([...token[2].matchAll(/<([a-f0-9]+)>/gi)].map(hex => {
        if (!font) return Buffer.from(hex[1], 'hex').toString('latin1');
        assert.equal(hex[1].length % 4, 0); return hex[1].match(/.{4}/g).map(code => { const value = font.get(parseInt(code, 16)); assert.notEqual(value, undefined, 'Unknown CID'); return value; }).join('');
      }).join(''));
    }
    return output.join('\n');
  }).join('\n');
};
