const { prisma } = require("../prismaClient");
const { assertExternalOperationAllowed } = require("../config/externalIntegrations");

// ==========================================
// HELPERS
// ==========================================

function normalizePhone(phone) {
  if (!phone) return null;

  let cleaned = String(phone).replace(/\D/g, "");

  // Se vier sem indicativo e assumires Portugal
  if (cleaned.startsWith("351")) return cleaned;
  if (cleaned.length === 9) return `351${cleaned}`;

  return cleaned || null;
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function buildPaymentMessage(clientName, amount, invoiceLabel = null) {
  return `💧 Cristal Water

Olá${clientName ? ` ${clientName}` : ""},

Tem um valor em dívida de ${formatMoney(amount)} €${invoiceLabel ? ` referente a ${invoiceLabel}` : ""}.

Pedimos, por favor, que regularize o pagamento assim que possível.

Se já efetuou o pagamento, ignore esta mensagem.

Obrigado.`;
}

function buildWhatsAppBrowserLink(phone, text) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

// ==========================================
// CONFIG API
// ==========================================

function getWhatsAppConfig() {
  return {
    mode: process.env.WHATSAPP_MODE || "BROWSER",
    provider: process.env.WHATSAPP_PROVIDER || "TWILIO",
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_WHATSAPP_FROM || "", // ex: whatsapp:+14155238886
  };
}

// ==========================================
// ENVIAR VIA API (TWILIO)
// ==========================================

async function sendWhatsAppViaApi({ toPhone, text }) {
  assertExternalOperationAllowed("whatsapp");

  const cfg = getWhatsAppConfig();

  if (cfg.provider !== "TWILIO") {
    throw new Error("Provider WhatsApp API não suportado");
  }

  if (!cfg.accountSid || !cfg.authToken || !cfg.from) {
    throw new Error("Configuração WhatsApp API incompleta no .env");
  }

  const normalized = normalizePhone(toPhone);
  if (!normalized) {
    throw new Error("Cliente sem telefone válido");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;

  const body = new URLSearchParams();
  body.append("From", cfg.from); // ex: whatsapp:+14155238886
  body.append("To", `whatsapp:+${normalized}`);
  body.append("Body", text);

  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const raw = await response.text();

  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    throw new Error(data.message || "Erro ao enviar WhatsApp API");
  }

  return data;
}

// ==========================================
// REGISTO INTERNO DE ENVIO
// ==========================================

async function logWhatsAppAction({
  clientId,
  title,
  message,
  via,
}) {
  await prisma.notification.create({
    data: {
      clientId: clientId || null,
      type: "WHATSAPP",
      title,
      message: `${message} (${via})`,
      isRead: false,
    },
  });
}

module.exports = {
  normalizePhone,
  formatMoney,
  buildPaymentMessage,
  buildWhatsAppBrowserLink,
  getWhatsAppConfig,
  sendWhatsAppViaApi,
  logWhatsAppAction,
};