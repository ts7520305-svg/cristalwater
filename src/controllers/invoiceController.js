const { logCommunication } = require("../services/communicationService");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { prisma } = require("../prismaClient");
const {
  buildWhatsAppBrowserLink,
  sendWhatsAppViaApi
} = require("../services/whatsappService");

// ==========================================
// GARANTIR PASTA TEMP
// ==========================================

function ensureTempDir() {
  const tempDir = path.join(__dirname, "../../temp");

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  return tempDir;
}

// ==========================================
// GERAR PDF
// ==========================================

function generateInvoicePDF(invoice) {
  const tempDir = ensureTempDir();

  const filePath = path.join(
    tempDir,
    `invoice_${invoice.id}.pdf`
  );

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).text("CRISTAL WATER", { align: "center" });
  doc.moveDown();

  doc.text(`Cliente: ${invoice.client?.name || "-"}`);
  doc.text(`Período: ${invoice.month}/${invoice.year}`);
  doc.text(`Valor total: ${Number(invoice.totalAmount || 0).toFixed(2)} €`);
  doc.text(`Em dívida: ${Number(invoice.amountOpen || 0).toFixed(2)} €`);

  doc.moveDown();
  doc.text("Documento interno (não fiscal)");

  doc.end();

  return filePath;
}

// ==========================================
// ENVIAR FATURA (CHAT + WHATSAPP)
// ==========================================

async function sendInvoiceFull(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    const mode = String(req.query.mode || "chat").toLowerCase(); // chat | browser | api

    if (Number.isNaN(invoiceId)) {
      return res.status(400).json({
        ok: false,
        error: "invoiceId inválido"
      });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true }
    });

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Fatura não encontrada"
      });
    }

    const pdf = generateInvoicePDF(invoice);

    const text = `💧 Cristal Water

Fatura ${invoice.month}/${invoice.year}

Valor: ${Number(invoice.totalAmount || 0).toFixed(2)} €
Em dívida: ${Number(invoice.amountOpen || 0).toFixed(2)} €

Documento em anexo`;

    // ======================
    // CHAT
    // ======================

    if (mode === "chat") {
      await prisma.chatMessage.create({
        data: {
          senderId: 1,
          receiverId: null,
          chatType: "CLIENT",
          clientId: invoice.clientId,
          text,
          messageType: "DOCUMENT",
          fileUrl: pdf,
          fileName: `fatura_${invoice.month}_${invoice.year}.pdf`,
          isRead: false
        }
      });

      await prisma.notification.create({
        data: {
          clientId: invoice.clientId,
          type: "INVOICE",
          title: "Fatura enviada no chat",
          message: `Fatura ${invoice.month}/${invoice.year} enviada pelo chat`,
          isRead: false
        }
      });

      await logCommunication({
        clientId: invoice.clientId,
        channel: "CHAT",
        message: text,
        referenceId: invoice.id
      });

      return res.json({
        ok: true,
        mode: "chat",
        message: "Fatura enviada para o chat"
      });
    }

    // ======================
    // WHATSAPP BROWSER
    // ======================

    if (mode === "browser") {
      const link = buildWhatsAppBrowserLink(invoice.client?.phone, text);

      if (!link) {
        return res.status(400).json({
          ok: false,
          error: "Cliente sem telefone válido"
        });
      }

      await prisma.notification.create({
        data: {
          clientId: invoice.clientId,
          type: "INVOICE",
          title: "WhatsApp Browser preparado",
          message: `Fatura ${invoice.month}/${invoice.year} preparada para envio por WhatsApp Browser`,
          isRead: false
        }
      });

      await logCommunication({
        clientId: invoice.clientId,
        channel: "WHATSAPP_BROWSER",
        message: text,
        referenceId: invoice.id
      });

      return res.json({
        ok: true,
        mode: "browser",
        link
      });
    }

    // ======================
    // WHATSAPP API
    // ======================

    if (mode === "api") {
      await sendWhatsAppViaApi({
        toPhone: invoice.client?.phone,
        text
      });

      await prisma.notification.create({
        data: {
          clientId: invoice.clientId,
          type: "INVOICE",
          title: "WhatsApp API enviado",
          message: `Fatura ${invoice.month}/${invoice.year} enviada por WhatsApp API`,
          isRead: false
        }
      });

      await logCommunication({
        clientId: invoice.clientId,
        channel: "WHATSAPP_API",
        message: text,
        referenceId: invoice.id
      });

      return res.json({
        ok: true,
        mode: "api",
        message: "Fatura enviada por WhatsApp API"
      });
    }

    return res.status(400).json({
      ok: false,
      error: "Modo inválido"
    });

  } catch (err) {
    console.error("ERRO sendInvoiceFull:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}

module.exports = {
  sendInvoiceFull
};