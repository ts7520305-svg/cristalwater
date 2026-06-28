const { prisma } = require("../prismaClient");

// ==========================================================
// AUTO COBRANÇA SIMPLIFICADA (COMPATÍVEL COM O SCHEMA ATUAL)
// ==========================================================

async function runAutoBilling() {
  try {

    console.log("🔄 Auto cobrança iniciada...");

    const clients = await prisma.client.findMany();

    for (const client of clients) {

      // 🔥 Como não temos invoices no schema atual,
      // só fazemos LOG simples

      console.log(`📊 Cliente: ${client.name}`);

      // ======================================================
      // WHATSAPP (SIMPLES)
      // ======================================================

      if (client.phone) {

        const phone = client.phone.replace(/\D/g, "");

        const message = encodeURIComponent(
`Olá ${client.name},

Mensagem automática Cristal Water.

Obrigado.`
        );

        const url = `https://wa.me/${phone}?text=${message}`;

        console.log(`📲 WhatsApp: ${url}`);
      }

    }

    console.log("✅ Auto cobrança concluída");

  } catch (err) {
    console.error("Erro auto cobrança:", err);
  }
}

module.exports = {
  runAutoBilling
};