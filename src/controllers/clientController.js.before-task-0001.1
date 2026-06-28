const { prisma } = require("../prismaClient");

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function boolFrom(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function cleanString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const v = String(value).trim();
  return v || null;
}

function definedOnly(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function clientCreateData(body = {}) {
  return definedOnly({
    name: cleanString(body.name),
    internalName: cleanString(body.internalName),
    email: cleanString(body.email),
    phone: cleanString(body.phone),
    address: cleanString(body.address),
    zone: cleanString(body.zone),
    notes: cleanString(body.notes),
    monthlyFee: numberOrUndefined(body.monthlyFee),
    monthlyAmount: numberOrUndefined(body.monthlyFee ?? body.monthlyAmount),
    requiresInvoice: body.requiresInvoice === undefined ? undefined : boolFrom(body.requiresInvoice),
    fiscalName: cleanString(body.fiscalName),
    fiscalNif: cleanString(body.fiscalNif ?? body.nif),
    fiscalAddress: cleanString(body.fiscalAddress),
    fiscalEmail: cleanString(body.fiscalEmail),
    externalBillingNotes: cleanString(body.externalBillingNotes),
    contractActive: false,
    billingActive: false,
    archiveStatus: "ATIVO",
    deletedAt: null,
    status: "SETUP",
    active: true,
    paymentStatus: "BILLING_DISABLED",
  });
}

function clientUpdateData(body = {}, currentClient = null) {
  const finalContractActive = body.contractActive === undefined
    ? Boolean(currentClient?.contractActive)
    : boolFrom(body.contractActive);

  const wantsBillingActive = body.billingActive === undefined
    ? undefined
    : boolFrom(body.billingActive);

  if (wantsBillingActive === true && !finalContractActive) {
    const error = new Error("Não é possível ativar faturação sem ativar primeiro o contrato.");
    error.statusCode = 400;
    throw error;
  }

  return definedOnly({
    name: cleanString(body.name),
    internalName: cleanString(body.internalName),
    email: cleanString(body.email),
    phone: cleanString(body.phone),
    address: cleanString(body.address),
    zone: cleanString(body.zone),
    notes: cleanString(body.notes),
    monthlyFee: numberOrUndefined(body.monthlyFee),
    monthlyAmount: numberOrUndefined(body.monthlyFee ?? body.monthlyAmount),
    requiresInvoice: body.requiresInvoice === undefined ? undefined : boolFrom(body.requiresInvoice),
    fiscalName: cleanString(body.fiscalName),
    fiscalNif: cleanString(body.fiscalNif ?? body.nif),
    fiscalAddress: cleanString(body.fiscalAddress),
    fiscalEmail: cleanString(body.fiscalEmail),
    externalBillingNotes: cleanString(body.externalBillingNotes),
    contractActive: body.contractActive === undefined ? undefined : finalContractActive,
    billingActive: wantsBillingActive,
  });
}

async function listClients(req, res) {
  try {
    const includeInactive = ["true", "1", "yes", "sim"].includes(String(req.query.includeInactive || "").toLowerCase());
    const where = includeInactive ? {} : {
      active: true,
      deletedAt: null,
      archiveStatus: "ATIVO",
      status: { not: "ARCHIVED" },
    };

    const clients = await prisma.client.findMany({
      where,
      include: {
        pools: { where: includeInactive ? {} : { active: true, deletedAt: null, archiveStatus: "ATIVO" } },
      },
      orderBy: { name: "asc" },
    });

    return res.json({ ok: true, clients });
  } catch (err) {
    console.error("listClients error:", err);
    return res.status(500).json({ error: err.message || "Erro ao listar clientes" });
  }
}

async function getClientById(req, res) {
  try {
    const clientId = toInt(req.params.id);
    if (!clientId) return res.status(400).json({ error: "ID inválido" });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { pools: true, invoices: true },
    });

    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    return res.json({ ok: true, client });
  } catch (err) {
    console.error("getClientById error:", err);
    return res.status(500).json({ error: err.message || "Erro ao obter cliente" });
  }
}

async function createClient(req, res) {
  try {
    const data = clientCreateData(req.body);
    if (!data.name) return res.status(400).json({ error: "Nome obrigatório" });

    const created = await prisma.client.create({ data });
    return res.status(201).json({ ok: true, client: created, message: "Cliente criado em configuração. Faturação desligada até ativar contrato." });
  } catch (err) {
    console.error("createClient error:", err);
    return res.status(500).json({ error: err.message || "Erro ao criar cliente" });
  }
}

async function updateClient(req, res) {
  try {
    const clientId = toInt(req.params.id);
    if (!clientId) return res.status(400).json({ error: "ID inválido" });

    const currentClient = await prisma.client.findUnique({ where: { id: clientId } });
    if (!currentClient) return res.status(404).json({ error: "Cliente não encontrado" });

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: clientUpdateData(req.body, currentClient),
    });

    return res.json({ ok: true, client: updated });
  } catch (err) {
    console.error("updateClient error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Erro ao atualizar cliente" });
  }
}

async function activateClient(req, res) {
  try {
    const clientId = toInt(req.params.id);
    if (!clientId) return res.status(400).json({ error: "ID inválido" });

    const amount = numberOrUndefined(req.body?.amount) || 0;
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        contractActive: true,
        billingActive: true,
        contractActivatedAt: new Date(),
        lastPaymentAt: new Date(),
        paymentStatus: "PAID",
        status: "ACTIVE",
        active: true,
        archiveStatus: "ATIVO",
        deletedAt: null,
        creditBalance: amount > 0 ? amount : undefined,
      },
    });

    return res.json({ ok: true, client, message: "Contrato ativado. A faturação começa a partir desta data." });
  } catch (err) {
    console.error("activateClient error:", err);
    return res.status(500).json({ error: err.message || "Erro ao ativar contrato" });
  }
}

async function archiveClient(req, res) {
  try {
    const clientId = toInt(req.params.id);
    if (!clientId) return res.status(400).json({ error: "ID inválido" });

    const now = new Date();
    await prisma.$transaction([
      prisma.client.update({
        where: { id: clientId },
        data: { archiveStatus: "ARQUIVADO", deletedAt: now, status: "ARCHIVED", active: false, billingActive: false, paymentStatus: "BILLING_DISABLED" },
      }),
      prisma.pool.updateMany({
        where: { clientId },
        data: { archiveStatus: "ARQUIVADO", deletedAt: now, active: false, scheduleMode: "ARCHIVED" },
      }),
    ]);

    return res.json({ ok: true, archived: true, message: "Cliente e piscinas arquivados com histórico preservado." });
  } catch (err) {
    console.error("archiveClient error:", err);
    return res.status(500).json({ error: err.message || "Erro ao arquivar cliente" });
  }
}

async function restoreClient(req, res) {
  try {
    const clientId = toInt(req.params.id);
    if (!clientId) return res.status(400).json({ error: "ID inválido" });

    await prisma.$transaction([
      prisma.client.update({
        where: { id: clientId },
        data: { archiveStatus: "ATIVO", deletedAt: null, status: "SETUP", active: true, billingActive: false, paymentStatus: "BILLING_DISABLED" },
      }),
      prisma.pool.updateMany({
        where: { clientId },
        data: { archiveStatus: "ATIVO", deletedAt: null, active: true, scheduleMode: "PENDING_ROUND" },
      }),
    ]);

    return res.json({ ok: true, restored: true, message: "Cliente restaurado em configuração. A faturação continua desligada até ativar contrato." });
  } catch (err) {
    console.error("restoreClient error:", err);
    return res.status(500).json({ error: err.message || "Erro ao restaurar cliente" });
  }
}

async function deleteClient(req, res) {
  try {
    const clientId = toInt(req.params.id);
    if (!clientId) return res.status(400).json({ error: "ID inválido" });

    const [invoices, pools, visits] = await Promise.all([
      prisma.invoice.count({ where: { clientId } }).catch(() => 0),
      prisma.pool.count({ where: { clientId } }).catch(() => 0),
      prisma.serviceVisit.count({ where: { clientId } }).catch(() => 0),
    ]);

    if (invoices > 0 || pools > 0 || visits > 0) {
      req.params.id = String(clientId);
      return archiveClient(req, res);
    }

    await prisma.client.delete({ where: { id: clientId } });
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("deleteClient error:", err);
    return res.status(409).json({ error: err.message || "Cliente protegido por histórico. Arquive em vez de eliminar fisicamente." });
  }
}

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  activateClient,
  archiveClient,
  restoreClient,
  deleteClient,
};
