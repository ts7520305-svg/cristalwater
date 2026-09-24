const CommercialQuote = require('../business/repair/CommercialQuoteBusiness');
const { writePdfResponse } = require("../services/documentPdfService");
const { repairBlocks } = require("../services/financialDocumentPdfService");
const RepairBusiness = require("../business/repair/RepairBusiness");

function actor(req) {
  return req.user?.email || req.user?.name || req.user?.role || req.headers["x-actor"] || "repair-os";
}

async function createRepair(req, res) {
  const result = await RepairBusiness.createRepairTicket(req.body || {}, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Dados inválidos" });
  return res.json({ ok: true, repair: result.repair });
}

async function listRepairsByPool(req, res) {
  const result = await RepairBusiness.listRepairsByPool(req.params.poolId);
  return res.json(result.repairs || []);
}

async function recordRepairPhoto(req, res) {
  const result = await RepairBusiness.recordRepairPhoto(req.params.id, req.file, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, photo: result.photo });
}

async function repairPdf(req, res) {
  try {
    const result = await RepairBusiness.getRepairDetail(req.params.id);
    if (!result.ok) return res.status(result.status || 404).json({ ok: false, message: result.error || "Reparação não encontrada" });
    const repair = result.repair;
    const latest = (await CommercialQuote.list(repair.id))[0];
    const blocks = repairBlocks(repair, latest);
    await writePdfResponse(res, `reparacao_${repair.id}.pdf`, 'Orçamento / Reparação de Piscina', output => output.push(...blocks), { reference: `Reparação #${repair.id}` });
  } catch (error) {
    if (res.headersSent) return res.destroy();
    const status = error.status || error.statusCode;
    return res.status(status || 503).json({ ok: false, message: status ? error.message : 'Não foi possível gerar o orçamento. Tente novamente.' });
  }
}

async function quoteRepair(req, res) {
  const result = await RepairBusiness.quoteRepair(req.params.id, null, actor(req), req.body || {});
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair || result });
}

async function diagnoseRepair(req, res) {
  const result = await RepairBusiness.diagnoseRepair(req.params.id, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair, diagnostic: result.diagnostic });
}

async function scheduleRepair(req, res) {
  const result = await RepairBusiness.scheduleRepair(req.params.id, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair });
}

async function cancelRepair(req, res) {
  const result = await RepairBusiness.cancelRepair(req.params.id, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair });
}

async function approveRepair(req, res) {
  const result = await RepairBusiness.approveRepair(req.params.id, null, actor(req), req.body || {});
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair || result });
}

async function invoiceRepair(req, res) {
  try {
    const result = await RepairBusiness.generateRepairInvoice(req.params.id, req.body || {}, null, actor(req));
    if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
    return res.json({ ok: true, repair: result.repair, invoice: result.invoice });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, message: error.status ? error.message : "Não foi possível concluir a fatura da reparação." });
  }
}

async function registerPayment(req, res) {
  try {
    const result = await RepairBusiness.registerRepairPayment(req.params.id, req.body || {}, null, actor(req), req.user);
    if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, message: error.status ? error.message : 'Erro ao registar pagamento da reparação' });
  }
}

async function closeRepair(req, res) {
  const result = await RepairBusiness.closeRepair(req.params.id, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair });
}

async function markSent(req, res) {
  const result = await RepairBusiness.markRepairSent(req.params.id, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json(result);
}

async function completeRepair(req, res) {
  try {
    const result = await RepairBusiness.completeRepair(req.params.id, null, actor(req), req.user);
    if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
    return res.json({ ok: true, repair: result.repair, execution: result.execution, idempotent: Boolean(result.idempotent) });
  } catch (error) {
    const status=[400,403,404,409].includes(error.status||error.statusCode)?(error.status||error.statusCode):500;
    return res.status(status).json({ok:false,message:status===500?'Não foi possível confirmar a conclusão. Consulte os registos antes de repetir.':error.message});
  }
}

async function deleteRepair(req, res) {
  const result = await RepairBusiness.deleteRepair(req.params.id, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true });
}

async function listQuotes(req, res, next) {
  try { return res.json({ ok: true, quotes: await CommercialQuote.list(req.params.id) }); }
  catch (error) { if (error.status) return res.status(error.status).json({ ok: false, message: error.message }); return next(error); }
}
async function previewQuote(req, res, next) {
  try { return res.json({ ok: true, quote: CommercialQuote.calculate(req.body || {}) }); }
  catch (error) { if (error.status) return res.status(error.status).json({ ok: false, message: error.message }); return next(error); }
}
module.exports = {
  listQuotes, previewQuote,
  createRepair,
  listRepairsByPool,
  recordRepairPhoto,
  repairPdf,
  quoteRepair,
  diagnoseRepair,
  scheduleRepair,
  cancelRepair,
  approveRepair,
  invoiceRepair,
  registerPayment,
  closeRepair,
  markSent,
  completeRepair,
  deleteRepair,
};
