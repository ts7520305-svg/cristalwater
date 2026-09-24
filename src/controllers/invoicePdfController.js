'use strict';
const documents = require('../business/finance/InvoiceDocumentAccessBusiness');
const pdf = require('../services/documentPdfService');
const { invoiceBlocks, extrasBlocks } = require('../services/financialDocumentPdfService');

function options(req) {
  if (Object.keys(req.query || {}).length) throw Object.assign(Error('Opções de documento inválidas.'), { status: 400 });
}
function send(res, bytes, filename, type, clientId, invoiceId) {
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-CW-Document-Type': type,
    'X-CW-Client-Id': String(clientId),
    ...(invoiceId ? { 'X-CW-Invoice-Id': String(invoiceId) } : {}),
    'Content-Language': 'pt',
    'Content-Disposition': `inline; filename="${filename}"`
  }).type('application/pdf').send(bytes);
}
function error(res, err) {
  if (res.headersSent) return res.destroy();
  const status = err.status || err.statusCode;
  res.status(status || 503).json({ ok: false, error: status ? err.message : 'Não foi possível preparar o PDF. Tente novamente.' });
}
async function generateInvoicePdf(req, res) {
  res.set('Cache-Control', 'private, no-store');
  try {
    options(req);
    const invoice = await documents.invoice(req.params.id, req.user);
    const bytes = await pdf.renderDocumentPdf('Conta corrente — Documento interno', invoiceBlocks(invoice), undefined, { reference: `Documento #${invoice.id}` });
    send(res, bytes, `documento-interno-${invoice.id}.pdf`, 'invoice-pdf', invoice.clientId, invoice.id);
  } catch (err) { error(res, err); }
}
async function generateExtrasPdf(req, res) {
  res.set('Cache-Control', 'private, no-store');
  try {
    options(req);
    const extras = await documents.extras(req.params.id, req.user);
    if (!extras.length) throw Object.assign(Error('Sem extras por faturar.'), { status: 404 });
    const clientId = Number(req.params.id);
    const bytes = await pdf.renderDocumentPdf('Extras — Documento interno', extrasBlocks(extras), undefined, { reference: `Cliente #${clientId}` });
    send(res, bytes, `extras-${clientId}.pdf`, 'extra-billing-pdf', clientId);
  } catch (err) { error(res, err); }
}
module.exports = { generateInvoicePdf, generateExtrasPdf };
