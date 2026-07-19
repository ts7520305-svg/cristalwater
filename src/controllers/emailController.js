const nodemailer = require("nodemailer");
const { assertExternalOperationAllowed } = require("../config/externalIntegrations");

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true",
    },
  });
}

async function sendInvoiceEmail(req, res) {
  try {
    try {
      assertExternalOperationAllowed("email");
    } catch (gateErr) {
      return res.status(gateErr.statusCode || 503).json({ ok: false, error: gateErr.code || "disabled_in_qa" });
    }

    const { email, invoiceId } = req.body;

    if (!email || !invoiceId) {
      return res.status(400).json({ ok: false, message: "Dados inválidos" });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({
        ok: false,
        message: "SMTP não configurado. Define SMTP_HOST, SMTP_USER e SMTP_PASS no .env."
      });
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const pdfUrl = `${baseUrl}/api/invoice-pdf/${invoiceId}`;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Cristal Water" <noreply@example.com>',
      to: email,
      subject: "Fatura Cristal Water",
      html: `
        <h3>Fatura Cristal Water</h3>
        <p>Olá,</p>
        <p>Segue a sua fatura:</p>
        <p><a href="${pdfUrl}">Ver fatura</a></p>
        <p>Obrigado.</p>
      `,
    });

    return res.json({ ok: true, message: "Email enviado com sucesso", response: info.response });
  } catch (err) {
    console.error("❌ ERRO ENVIO EMAIL:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

module.exports = { sendInvoiceEmail };
