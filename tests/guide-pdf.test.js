import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { renderGuidePdf, writePdfResponse, line, section, tableRows } = require('../src/services/guidePdfService');
const pdfText = require('../scripts/lib/reportPdfText');

describe('operational guide PDFs', () => {
  it('retains Unicode and explicitly marks unsupported glyphs without changing input', async () => {
    const blocks = [];
    line(blocks, 'Técnico', 'Łukasz · Γιάννης · Иван · Jose\u0301 · 漢');
    const before = JSON.stringify(blocks);
    const text = pdfText(await renderGuidePdf('Guia de Obra', blocks));
    expect(text).toContain('Łukasz · Γιάννης · Иван · José · [U+6F22]');
    expect(text).toContain('Caracteres sem suporte');
    expect(text).toContain('Página 1 de 1');
    expect(JSON.stringify(blocks)).toBe(before);
  });
  it('retains long rows and repeats identifying headers and exact page counts', async () => {
    const blocks = [];
    section(blocks, 'Material');
    tableRows(blocks, Array.from({ length: 25 }, (_, index) => ({ title: 'Produto ' + index, meta: '10 kg', notes: index === 2 ? 'Detalhe legível '.repeat(1000) + ' FIM_LONGO' : 'Nota ' + index })), 'Sem material');
    const buffer = await renderGuidePdf('Guia de Transporte AT', blocks), text = pdfText(buffer);
    const count = (buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    expect(count).toBeGreaterThan(3);
    expect(text).toContain('FIM_LONGO');
    expect(text).toContain('Produto 24');
    expect(text.match(/Guia de Transporte AT/g)).toHaveLength(count);
    for (let page = 1; page <= count; page++) expect(text).toContain(`Página ${page} de ${count}`);
  });
  it('only sends a completed private PDF and leaves errors available for JSON handling', async () => {
    const res = { setHeader: vi.fn(), send: vi.fn() };
    await expect(writePdfResponse(res, 'guide.pdf', 'Guia', () => { throw Error('render failure'); })).rejects.toThrow('render failure');
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
    await writePdfResponse(res, 'guide.pdf', 'Guia', blocks => line(blocks, 'Origem', 'Armazém'));
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(res.send.mock.calls[0][0].subarray(-6).toString()).toBe('%%EOF\n');
  });
});
