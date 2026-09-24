import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { renderDocumentPdf } = require('../src/services/documentPdfService');
const { invoiceBlocks, extrasBlocks, repairBlocks } = require('../src/services/financialDocumentPdfService');
const { generateMonthlyReportPDF } = require('../src/services/pdfReportService');
const pdfText = require('../scripts/lib/reportPdfText');

describe('financial and saved monthly PDFs', () => {
  it('preserves stored totals and negative lines without reconstructing a balance', async () => {
    const invoice = { id: 7, client: { name: 'Łukasz · Γιάννης · Иван' }, monthRef: '2030-01', status: 'PARTIAL', total: 123.45, amountPaid: 23.45, amountOpen: 100, lines: [{ description: 'Ajuste José', total: -4.55 }] };
    const before = JSON.stringify(invoice);
    const text = pdfText(await renderDocumentPdf('Conta corrente', invoiceBlocks(invoice)));
    for (const fragment of ['Łukasz · Γιάννης · Иван', '€ 123.45', '€ 23.45', '€ 100.00', '€ -4.55', 'não fiscal']) expect(text).toContain(fragment);
    expect(JSON.stringify(invoice)).toBe(before);
  });
  it('sums pending extras in cents and rejects unknown amounts', async () => {
    const rows = [0.1, 0.2].map((price, id) => ({ id, price, scheduledAt: null, pool: { name: 'Piscina', client: { name: 'José' } } }));
    const text = pdfText(await renderDocumentPdf('Extras', extrasBlocks(rows)));
    expect(text).toContain('€ 0.30');
    for (const amount of [null, undefined, NaN, Infinity, '10', 1e20]) expect(() => extrasBlocks([{ ...rows[0], price: amount }])).toThrow('revisão');
  });
  it('uses the saved commercial version without internal costs, margins or notes', async () => {
    const repair = { id: 8, unitPrice: 999, totalPrice: 999, notes: 'PRIVATE_NOTES' };
    const quote = { version: 2, snapshot: { lines: [{ description: 'Bomba Łukasz', quantity: 2, unitPrice: 125, total: 250, unitCost: 83.17, marginPercent: 33 }], discount: 10, net: 240, taxPercent: 23, tax: 55.2, total: 295.2, totalCost: 166.34, terms: 'Condições Γιάννης · 漢' } };
    const before = JSON.stringify({ repair, quote });
    const text = pdfText(await renderDocumentPdf('Orçamento', repairBlocks(repair, quote)));
    for (const fragment of ['€ 250.00', '€ 295.20', 'Condições Γιάννης · [U+6F22]']) expect(text).toContain(fragment);
    for (const fragment of ['PRIVATE_NOTES', '999', '83.17', '166.34', 'marginPercent']) expect(text).not.toContain(fragment);
    expect(JSON.stringify({ repair, quote })).toBe(before);
    expect(() => repairBlocks(repair, { version: 2, snapshot: null })).toThrow('revisão');
  });
  it('does not replace missing historical estimate values with zero', async () => {
    const text = pdfText(await renderDocumentPdf('Estimativa', repairBlocks({ id: 9, unitPrice: null, totalPrice: null })));
    expect(text).toContain('Por rever');
    expect(text).not.toContain('€ 0.00');
  });
  it('rejects malformed saved reports before PDF headers or bytes', async () => {
    const res = { setHeader: vi.fn(), send: vi.fn() }, good = { id: 4, month: '2030-01', data: { client: 'José', pools: [{ name: 'Piscina', totalVisits: 4, notDone: 1 }] } };
    for (const report of [{ ...good, month: 'invalid' }, { ...good, data: null }, { ...good, data: { ...good.data, pools: [{ name: 'Piscina', totalVisits: null, notDone: 1 }] } }]) await expect(generateMonthlyReportPDF(res, report)).rejects.toThrow('revisão');
    expect(res.setHeader).not.toHaveBeenCalled(); expect(res.send).not.toHaveBeenCalled();
    await generateMonthlyReportPDF(res, good);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="relatorio-2030-01.pdf"');
    const text = pdfText(res.send.mock.calls[0][0]);
    expect(text).toContain('Visitas realizadas: 4'); expect(text).toContain('Relatório #4');
  });
});
