'use strict';
const PDFDocument = require('pdfkit');
const prepareFonts = require('./visitReportPdfFonts');

const COMPANY = 'Cristal Water LDA';
const value = input => String(input ?? '').trim() || '-';
const line = (blocks, label, input) => blocks.push({ kind: 'line', label, text: value(input) });
const section = (blocks, title) => blocks.push({ kind: 'section', text: title });
const paragraph = (blocks, text) => blocks.push({ kind: 'paragraph', text });
function tableRows(blocks, rows, emptyText) {
  if (!rows.length) return paragraph(blocks, emptyText);
  rows.forEach((row, index) => blocks.push({ kind: 'row', title: `${index + 1}. ${value(row.title)}`, text: row.meta || '-', notes: row.notes }));
}

async function renderDocumentPdf(title, blocks, generatedAt = new Date(), options = {}) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 112, bottom: 55, left: 42, right: 42 }, bufferPages: true, info: { Title: title, Author: COMPANY } });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.once('end', () => resolve(Buffer.concat(chunks)));
    doc.once('error', reject);
  });
  // Attach before drawing: a synchronous rendering failure must not leak an
  // unhandled stream rejection or send a partial successful HTTP response.
  completed.catch(() => {});
  try {
    const fonts = prepareFonts(doc), width = doc.page.width - 84;
    const safe = input => fonts.format(value(input));
    const content = blocks.map(block => Object.fromEntries(Object.entries(block).map(([key, input]) => [key, key === 'kind' || input == null ? input : safe(input)])));
    const safeTitle = safe(title), reference = options.reference ? safe(options.reference) + " · " : "";
    const room = height => { if (doc.y + height > doc.page.height - 55) doc.addPage(); };
    function write(text, bold = false, size = 10, color = '#253648') {
      doc.font(bold ? fonts.bold : fonts.regular).fontSize(size).fillColor(color).text(text, { width, lineGap: 2 });
    }
    if (fonts.unsupported.size) {
      write('Caracteres sem suporte são identificados por [U+…]. O texto original permanece no registo.', false, 8, '#8a4b08');
      doc.moveDown(0.6);
    }
    for (const block of content) {
      if (block.kind === 'section') {
        // Reserve a title and the start of its content, avoiding orphan headings.
        room(72);
        doc.moveDown(0.6);
        write(block.text, true, 11, '#0f766e');
        doc.moveTo(42, doc.y + 2).lineTo(42 + width, doc.y + 2).strokeColor('#d1d5db').stroke();
        doc.moveDown(0.5);
      } else if (block.kind === 'line') {
        room(40);
        write(block.label, true, 8, '#596777');
        write(block.text);
        doc.moveDown(0.25);
      } else if (block.kind === 'row') {
        doc.font(fonts.bold).fontSize(10);
        const titleHeight = doc.heightOfString(block.title, { width, lineGap: 2 });
        doc.font(fonts.regular).fontSize(9);
        const rowHeight = titleHeight + doc.heightOfString(block.text, { width, lineGap: 2 }) + (block.notes ? doc.heightOfString(block.notes, { width, lineGap: 2 }) : 0) + 5;
        // Ordinary rows remain together. Oversized text flows over pages without truncation.
        room(Math.min(rowHeight, doc.page.height - 55 - 112));
        write(block.title, true);
        write(block.text, false, 9);
        if (block.notes) write(block.notes, false, 9, '#596777');
        doc.moveDown(0.45);
      } else {
        room(32);
        write(block.text);
        doc.moveDown(0.35);
      }
    }
    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page++) {
      doc.switchToPage(page);
      doc.font(fonts.bold).fontSize(16).fillColor('#0f2f46').text(COMPANY, 42, 32, { lineBreak: false });
      doc.fontSize(13).fillColor('#111827').text(safeTitle, 42, 57, { lineBreak: false });
      doc.font(fonts.regular).fontSize(8).fillColor('#596777').text(`${reference}Gerado em ${generatedAt.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })} (Europe/Lisbon)`, 42, 79, { lineBreak: false });
      doc.moveTo(42, 98).lineTo(42 + width, 98).strokeColor('#d1d5db').stroke();
      const footer = `${COMPANY} · Página ${page + 1} de ${pages.count}`;
      doc.fontSize(8).fillColor('#596777').text(footer, 42 + width - doc.widthOfString(footer), doc.page.height - 34, { lineBreak: false });
    }
    doc.end();
    return await completed;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}

async function writePdfResponse(res, filename, title, draw, options = {}) {
  const blocks = [];
  draw(blocks);
  const buffer = await renderDocumentPdf(title, blocks, undefined, options);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${options.disposition === "attachment" ? "attachment" : "inline"}; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}

module.exports = { renderDocumentPdf, renderGuidePdf: renderDocumentPdf, writePdfResponse, line, section, paragraph, tableRows };
