const { prisma } = require("../prismaClient");

// ==========================================================
// HELPERS
// ==========================================================

function buildWhatsAppUrl(phone, message) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// ==========================================================
// ENVIAR FATURA
// ==========================================================

async function sendInvoiceWhatsApp(req, res) {
  try {
    const { phone, invoiceId } = req.body;

    if (!phone || !invoiceId) {
      return res.status(400).json({ ok: false });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(invoiceId) },
      include: { client: true }
    });

    if (!invoice) {
      return res.status(404).json({ ok: false });
    }

    const publicBaseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const pdfUrl = `${publicBaseUrl}/api/invoice-pdf/${invoiceId}`;

    const message = `
Olá ${invoice.client.name},

Segue a sua fatura mensal.

Valor total: ${invoice.total.toFixed(2)} €
Valor em aberto: ${invoice.amountOpen.toFixed(2)} €

Pode consultar aqui:
${pdfUrl}

Obrigado,
Cristal Water
`;

    const url = buildWhatsAppUrl(phone, message);

    res.json({ ok: true, url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}

// ==========================================================
// LEMBRETE DE PAGAMENTO
// ==========================================================

async function sendReminderWhatsApp(req, res) {
  try {
    const { phone, clientName, amountOpen } = req.body;

    if (!phone) return res.status(400).json({ ok: false });

    const message = `
Olá ${clientName},

Verificámos que tem um valor em aberto de ${amountOpen.toFixed(2)} €.

Agradecemos a regularização.

Obrigado,
Cristal Water
`;

    const url = buildWhatsAppUrl(phone, message);

    res.json({ ok: true, url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}

// ==========================================================
// REPARAÇÃO
// ==========================================================

async function sendRepairWhatsApp(req, res) {
  try {
    const { phone, clientName, price, description } = req.body;

    if (!phone) return res.status(400).json({ ok: false });

    const message = `
Olá ${clientName},

Foi efetuada uma intervenção na sua piscina:

${description}

Valor: ${price.toFixed(2)} €

Será incluído na próxima faturação.

Obrigado,
Cristal Water
`;

    const url = buildWhatsAppUrl(phone, message);

    res.json({ ok: true, url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}

module.exports = {
  sendInvoiceWhatsApp,
  sendReminderWhatsApp,
  sendRepairWhatsApp
};