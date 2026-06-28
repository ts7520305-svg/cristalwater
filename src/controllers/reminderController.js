const { prisma } = require("../prismaClient");
const fetch = require("node-fetch");

// ==========================================================
// ENVIAR LEMBRETE MANUAL
// ==========================================================

async function sendReminder(req, res) {
  try {

    const invoiceId = Number(req.params.id);

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: "Fatura não encontrada" });
    }

    const message = `Olá ${invoice.client.name}, tem um valor em aberto de €${invoice.amountOpen}.`;

    // EMAIL
    if (invoice.client.email) {
      await fetch(`${process.env.INTERNAL_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`}/api/email/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invoice.client.email,
          invoiceId
        })
      });
    }

    // WHATSAPP
    if (invoice.client.phone) {
      await fetch(`${process.env.INTERNAL_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`}/api/whatsapp/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: invoice.client.phone,
          invoiceId
        })
      });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro reminder" });
  }
}

module.exports = {
  sendReminder
};