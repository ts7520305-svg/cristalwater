const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { prisma } = require("../prismaClient");

// ==========================================
// GERAR RECIBO PDF
// ==========================================

function generateReceiptPDF(payment) {
  const filePath = path.join(
    __dirname,
    "../../temp",
    `receipt_${payment.id}.pdf`
  );

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.text("RECIBO INTERNO", { align: "center" });
  doc.moveDown();

  doc.text(`Pagamento: ${payment.amount} €`);
  doc.text(`Método: ${payment.method}`);
  doc.text(`Data: ${payment.paidAt}`);

  doc.moveDown();
  doc.text("Documento interno (não fiscal)");

  doc.end();

  return filePath;
}

// ==========================================
// REGISTAR PAGAMENTO + ENVIAR RECIBO
// ==========================================

async function registerPayment(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    const amount = Number(req.body.amount);

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount,
        method: "MANUAL"
      }
    });

    const pdf = generateReceiptPDF(payment);

    await prisma.chatMessage.create({
      data: {
        senderId: 1,
        receiverId: null,
        chatType: "CLIENT",
        clientId: invoice.clientId,
        text: "Pagamento recebido. Recibo em anexo.",
        messageType: "DOCUMENT",
        fileUrl: pdf,
        fileName: "recibo.pdf",
        isRead: false
      }
    });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  registerPayment
};