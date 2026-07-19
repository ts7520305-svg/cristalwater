const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const { assertExternalOperationAllowed } = require("../config/externalIntegrations");

// ==========================================================
// ENVIO MASSIVO DE DÍVIDAS
// ==========================================================
router.post("/mass-debt", async (req, res) => {
  try {
    assertExternalOperationAllowed("whatsapp");
  } catch (gateErr) {
    return res.status(gateErr.statusCode || 503).json({ ok: false, error: gateErr.code || "disabled_in_qa" });
  }

  const clients = await prisma.client.findMany({
    include: { invoices: true }
  });

  const results = [];

  clients.forEach(c => {

    const open = c.invoices.reduce((s, i) => s + (i.amountOpen || 0), 0);

    if (open > 0 && c.phone) {

      const msg = encodeURIComponent(
`Olá ${c.name},

Tem ${open.toFixed(2)} € em aberto.

Cristal Water`
      );

      const url = `https://wa.me/${c.phone.replace(/\D/g,"")}?text=${msg}`;

      results.push({ name: c.name, url });
    }
  });

  res.json({ ok: true, results });
});

module.exports = router;