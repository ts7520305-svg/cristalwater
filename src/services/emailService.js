"use strict";

const nodemailer = require("nodemailer");
const { assertExternalOperationAllowed } = require("../config/externalIntegrations");

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getFromAddress() {
  return process.env.SMTP_FROM || '"Cristal Water" <noreply@example.com>';
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

async function sendEmail(payload) {
  assertExternalOperationAllowed("email");

  const transporter = createTransporter();
  if (!transporter) {
    const err = new Error("smtp_not_configured");
    err.code = "smtp_not_configured";
    err.statusCode = 503;
    throw err;
  }

  const message = {
    from: payload.from || getFromAddress(),
    to: payload.to,
    subject: payload.subject || "Cristal Water",
    text: payload.text || undefined,
    html: payload.html || undefined,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : undefined,
  };

  return transporter.sendMail(message);
}

async function sendExtrasInvoiceEmail(client, pdfBuffer) {
  const to = client?.email;
  if (!to) {
    throw new Error(`Cliente ${client?.name || "(sem nome)"} sem email.`);
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

  return sendEmail({
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `fatura-extras-${client.name}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

async function sendVisitReportEmail(visit) {
  const client = visit?.pool?.client;
  if (!client || !client.email) {
    return { ok: false, skipped: true, reason: "client_without_email" };
  }

  const beforePhotos = (visit.photos || []).filter((p) => p.type === "BEFORE");
  const afterPhotos = (visit.photos || []).filter((p) => p.type === "AFTER");

  const html = `
    <h2>Cristal Water - Relatório de Serviço</h2>

    <p><b>Cliente:</b> ${client.name}</p>
    <p><b>Piscina:</b> ${visit.pool?.name || "-"}</p>
    <p><b>Data:</b> ${new Date().toLocaleDateString("pt-PT")}</p>

    <h3>Fotos Antes</h3>
    ${beforePhotos.map((p) => `<img src="${process.env.APP_URL || ""}${p.url}" width="200"/>`).join("")}

    <h3>Fotos Depois</h3>
    ${afterPhotos.map((p) => `<img src="${process.env.APP_URL || ""}${p.url}" width="200"/>`).join("")}

    <br><br>
    <p>Obrigado,<br>Cristal Water</p>
  `;

  await sendEmail({
    to: client.email,
    subject: "Relatório de manutenção da piscina",
    html,
  });

  return { ok: true };
}

module.exports = {
  smtpConfigured,
  createTransporter,
  getFromAddress,
  sendEmail,
  sendExtrasInvoiceEmail,
  sendVisitReportEmail,
};
