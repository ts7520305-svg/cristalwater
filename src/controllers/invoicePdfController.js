"use strict";
const documents = require('../business/finance/InvoiceDocumentAccessBusiness');
const { writePdfResponse } = require('../services/documentPdfService');
const { invoiceBlocks, extrasBlocks } = require('../services/financialDocumentPdfService');

async function generateInvoicePdf(req, res) {
  try {
    const invoice = await documents.invoice(req.params.id, req.user);
    const blocks = invoiceBlocks(invoice);
    await writePdfResponse(res, `documento-interno-${invoice.id}.pdf`, 'Conta corrente — Documento interno', output => output.push(...blocks), { reference: `Documento #${invoice.id}` });
  } catch (error) {
    if (res.headersSent) return res.destroy();
    res.status(error.status || 500).send(error.status ? error.message : 'Erro ao gerar PDF');
  }
}

async function generateExtrasPdf(req, res) {
  try {
    const extras = await documents.extras(req.params.id, req.user);
    if (!extras.length) return res.status(404).send('Sem extras');
    const blocks = extrasBlocks(extras);
    await writePdfResponse(res, `extras-${Number(req.params.id)}.pdf`, 'Extras — Documento interno', output => output.push(...blocks), { reference: `Cliente #${Number(req.params.id)}` });
  } catch (error) {
    if (res.headersSent) return res.destroy();
    const status = error.status || error.statusCode;
    res.status(status || 500).send(status ? error.message : 'Erro ao gerar PDF de extras');
  }
}
module.exports = { generateInvoicePdf, generateExtrasPdf };
