const { prisma } = require("../prismaClient");
const PDFDocument = require("pdfkit");

// ==========================================================
// HELPERS
// ==========================================================

function formatMoney(v) {
  return `€ ${Number(v || 0).toFixed(2)}`;
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-PT");
}

// ==========================================================
// 🔵 PDF NORMAL (JÁ TINHAS)
// ==========================================================

async function generateInvoicePdf(req, res) {
  try {
    const invoiceId = Number(req.params.id);

    if (!invoiceId) {
      return res.status(400).send("ID inválido");
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        lines: true,
        payments: true,
      },
    });

    if (!invoice) {
      return res.status(404).send("Fatura não encontrada");
    }

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="fatura-${invoiceId}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(22).text("Cristal Water", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(14).text("Fatura / Conta Corrente", { align: "center" });

    doc.moveDown(1);

    doc.fontSize(12);
    doc.text(`Cliente: ${invoice.client?.name || "-"}`);
    doc.text(`Mês: ${invoice.monthRef}`);
    doc.moveDown(1);

    doc.fontSize(14).text("Serviços");
    doc.moveDown(0.5);

    invoice.lines.forEach((l, i) => {
      doc.text(`${i + 1}. ${l.description} — ${formatMoney(l.total)}`);
    });

    doc.moveDown(1);

    doc.fontSize(14).text("Resumo");
    doc.moveDown(0.5);

    doc.text(`Total: ${formatMoney(invoice.total)}`);
    doc.text(`Pago: ${formatMoney(invoice.amountPaid)}`);
    doc.text(`Em aberto: ${formatMoney(invoice.amountOpen)}`);

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao gerar PDF");
  }
}

// ==========================================================
// 🔥 NOVO — PDF EXTRAS POR CLIENTE
// ==========================================================

async function generateExtrasPdf(req, res) {
  try {

    const clientId = Number(req.params.id);

    const extras = await prisma.extraVisit.findMany({
      where: {
        billed: false,
        pool: {
          clientId: clientId
        }
      },
      include: {
        pool: {
          include: {
            client: true
          }
        }
      }
    });

    if (!extras.length) {
      return res.status(404).send("Sem extras");
    }

    const clientName = extras[0].pool.client.name;

    let total = 0;

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="extras-${clientName}.pdf"`
    );

    doc.pipe(res);

    // HEADER
    doc.fontSize(22).text("Cristal Water", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text("Faturação de Extras", { align: "center" });

    doc.moveDown(1);

    doc.fontSize(12);
    doc.text(`Cliente: ${clientName}`);
    doc.moveDown();

    doc.text("Serviços Extra:");
    doc.moveDown();

    extras.forEach(e => {

      doc.text(
        `${formatDate(e.scheduledAt)} — ${e.pool.name} — ${formatMoney(e.price)}`
      );

      total += e.price;
    });

    doc.moveDown();

    doc.fontSize(14).text(`Total: ${formatMoney(total)}`);

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro PDF extras");
  }
}

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  generateInvoicePdf,
  generateExtrasPdf // 🔥 NOVO
};