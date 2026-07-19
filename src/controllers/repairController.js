const PDFDocument = require("pdfkit");
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
  const result = await RepairBusiness.getRepairDetail(req.params.id);
  if (!result.ok) {
    return res.status(result.status || 404).json({ ok: false, message: result.error || "Reparação não encontrada" });
  }

  const repair = result.repair;
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const fileName = `reparacao_${repair.id}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  doc.pipe(res);

  doc.fontSize(22).fillColor("#1e88e5").text("Cristal Water", { align: "left" });
  doc.moveDown(0.2).fontSize(12).fillColor("#444444").text("Orçamento / Reparação de Piscina", { align: "left" });
  doc.moveDown(1);
  doc.strokeColor("#1e88e5").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fontSize(14).fillColor("#111111").text("Dados do cliente", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#222222");
  doc.text(`Cliente: ${repair.pool?.client?.name || "-"}`);
  doc.text(`Telefone: ${repair.pool?.client?.phone || "-"}`);
  doc.text(`Morada: ${repair.pool?.client?.address || "-"}`);
  doc.text(`Piscina: ${repair.pool?.name || "-"}`);
  doc.text(`Local: ${repair.pool?.location || "-"}`);
  doc.moveDown(1);

  doc.fontSize(14).fillColor("#111111").text("Detalhes da reparação", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#222222");
  doc.text(`ID da reparação: ${repair.id}`);
  doc.text(`Problema: ${repair.problem || "-"}`);
  doc.text(`Quantidade: ${repair.quantity || 0}`);
  doc.text(`Prioridade: ${repair.priority || "-"}`);
  doc.text(`Estado: ${repair.status || "-"}`);
  doc.text(`Data: ${new Date(repair.createdAt).toLocaleDateString("pt-PT")}`);
  doc.text(`Notas: ${repair.notes || "-"}`);
  doc.moveDown(1);

  doc.fontSize(14).fillColor("#111111").text("Valores", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#222222");
  doc.text(`Preço unitário: ${(Number(repair.unitPrice || 0)).toFixed(2)} €`);
  doc.text(`Total: ${(Number(repair.totalPrice || 0)).toFixed(2)} €`);
  doc.moveDown(0.8);

  doc.fontSize(10).fillColor("#444444").text("Nota: Os valores apresentados neste documento não incluem IVA.", { align: "left" });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#555555").text("Validade do orçamento: 15 dias.", { align: "left" });
  doc.moveDown(1.2);
  doc.fontSize(10).fillColor("#555555").text("Documento gerado automaticamente pelo sistema Cristal Water.", { align: "left" });

  doc.end();
}

async function quoteRepair(req, res) {
  const result = await RepairBusiness.quoteRepair(req.params.id, null, actor(req));
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
  const result = await RepairBusiness.approveRepair(req.params.id, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair || result });
}

async function invoiceRepair(req, res) {
  const result = await RepairBusiness.generateRepairInvoice(req.params.id, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair, invoice: result.invoice });
}

async function registerPayment(req, res) {
  const result = await RepairBusiness.registerRepairPayment(req.params.id, req.body || {}, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair, invoice: result.invoice, payment: result.payment });
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
  const result = await RepairBusiness.completeRepair(req.params.id, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true, repair: result.repair || result });
}

async function deleteRepair(req, res) {
  const result = await RepairBusiness.deleteRepair(req.params.id, null, actor(req));
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Erro" });
  return res.json({ ok: true });
}

module.exports = {
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