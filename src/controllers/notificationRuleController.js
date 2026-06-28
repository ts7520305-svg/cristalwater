const { prisma } = require("../prismaClient");

// ===============================
// LISTAR REGRAS EXISTENTES
// ===============================
async function getRules(req, res, next) {
  try {
    const rules = await prisma.notificationRule.findMany({
      orderBy: { eventType: "asc" },
    });

    res.json(rules);
  } catch (err) {
    next(err);
  }
}

// ===============================
// ATUALIZAR REGRA EXISTENTE
// ===============================
async function updateRule(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { roles, channels, active } = req.body;

    const rule = await prisma.notificationRule.update({
      where: { id },
      data: { roles, channels, active },
    });

    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function getSettingValue(key, fallbackValue) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  });

  if (!setting || setting.value === undefined || setting.value === null || setting.value === "") {
    return fallbackValue;
  }

  return String(setting.value);
}

async function setSettingValue(key, value, notes = null) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: String(value),
      notes,
    },
    create: {
      key,
      value: String(value),
      notes,
    },
  });
}

// ===============================
// GET CONFIG GLOBAL DE PAGAMENTOS
// ===============================
async function getPaymentPolicy(req, res) {
  try {
    const policy = await getSettingValue("payment_reminder_policy", "OVERDUE_ONLY");
    const whatsappEnabled = await getSettingValue("payment_reminder_default_whatsapp", "true");
    const emailEnabled = await getSettingValue("payment_reminder_default_email", "true");
    const internalEnabled = await getSettingValue("payment_reminder_default_internal", "true");

    res.json({
      ok: true,
      config: {
        policy,
        defaultWhatsapp: whatsappEnabled === "true",
        defaultEmail: emailEnabled === "true",
        defaultInternal: internalEnabled === "true",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      message: "Erro ao obter configuração de pagamentos",
    });
  }
}

// ===============================
// UPDATE CONFIG GLOBAL DE PAGAMENTOS
// ===============================
async function updatePaymentPolicy(req, res) {
  try {
    const {
      policy,
      defaultWhatsapp,
      defaultEmail,
      defaultInternal,
    } = req.body;

    if (!["OVERDUE_ONLY", "ALL_CLIENTS", "DISABLED"].includes(policy)) {
      return res.status(400).json({
        ok: false,
        message: "Política inválida",
      });
    }

    await setSettingValue(
      "payment_reminder_policy",
      policy,
      "Política global de lembretes de pagamento"
    );

    await setSettingValue(
      "payment_reminder_default_whatsapp",
      Boolean(defaultWhatsapp),
      "Canal global por defeito - WhatsApp"
    );

    await setSettingValue(
      "payment_reminder_default_email",
      Boolean(defaultEmail),
      "Canal global por defeito - Email"
    );

    await setSettingValue(
      "payment_reminder_default_internal",
      Boolean(defaultInternal),
      "Canal global por defeito - Notificação interna"
    );

    res.json({
      ok: true,
      message: "Configuração global de pagamentos atualizada com sucesso",
      config: {
        policy,
        defaultWhatsapp: Boolean(defaultWhatsapp),
        defaultEmail: Boolean(defaultEmail),
        defaultInternal: Boolean(defaultInternal),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      message: "Erro ao atualizar configuração global",
    });
  }
}

module.exports = {
  getRules,
  updateRule,
  getPaymentPolicy,
  updatePaymentPolicy,
};