/**
 * Envia faturação de extras com PDF
 */
async function sendExtrasInvoiceEmail(client, pdfBuffer) {
  const to = client.email;

  if (!to) {
    throw new Error(`Cliente ${client.name} sem email.`);
  }

  const subject = "Fatura de Serviços Extra";

  const text = `
Olá ${client.name},

Segue em anexo a faturação dos serviços extra.

Cumprimentos,
Cristal Water
`;

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color:#1e88e5;">Cristal Water</h2>
      <p>Olá <strong>${client.name}</strong>,</p>
      <p>Segue em anexo a faturação dos serviços extra.</p>
      <br>
      <p>Cumprimentos,<br><strong>Cristal Water</strong></p>
    </div>
  `;

  return transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `fatura-extras-${client.name}.pdf`,
        content: pdfBuffer
      }
    ]
  });
}
// ==========================================================
// 📧 RELATÓRIO DE VISITA
// ==========================================================

async function sendVisitReportEmail(visit) {

  const client = visit.pool?.client;

  if (!client || !client.email) {
    console.log("Cliente sem email");
    return;
  }

  const beforePhotos = visit.photos.filter(p => p.type === "BEFORE");
  const afterPhotos = visit.photos.filter(p => p.type === "AFTER");

  const html = `
    <h2>Cristal Water - Relatório de Serviço</h2>

    <p><b>Cliente:</b> ${client.name}</p>
    <p><b>Piscina:</b> ${visit.pool.name}</p>
    <p><b>Data:</b> ${new Date().toLocaleDateString("pt-PT")}</p>

    <h3>Fotos Antes</h3>
    ${beforePhotos.map(p => `<img src="${process.env.APP_URL}${p.url}" width="200"/>`).join("")}

    <h3>Fotos Depois</h3>
    ${afterPhotos.map(p => `<img src="${process.env.APP_URL}${p.url}" width="200"/>`).join("")}

    <br><br>
    <p>Obrigado,<br>Cristal Water</p>
  `;

  await sendEmail({
    to: client.email,
    subject: "Relatório de manutenção da piscina",
    html
  });
}

module.exports.sendVisitReportEmail = sendVisitReportEmail;