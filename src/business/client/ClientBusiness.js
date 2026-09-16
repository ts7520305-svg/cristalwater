const prisma = require("../../prismaClient");
const bcrypt = require("bcryptjs");
const { createHash } = require("node:crypto");
const { normalizeRole } = require("../../utils/roles");

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
    fiscalNif: cleanString(body.fiscalNif !== undefined ? body.fiscalNif : body.nif),
    fiscalAddress: cleanString(body.fiscalAddress),
    fiscalEmail: cleanString(body.fiscalEmail),
    externalBillingNotes: cleanString(body.externalBillingNotes),
    contractActive: body.contractActive === undefined ? undefined : finalContractActive,
    billingActive: wantsBillingActive,
  });
}

class ClientBusiness {
  async list(query = {}) {
    const includeInactive = ["true", "1", "yes", "sim"].includes(String(query.includeInactive || "").toLowerCase());

    return prisma.client.findMany({
      where: includeInactive ? {} : {
        active: true,
        deletedAt: null,
        archiveStatus: "ATIVO",
        status: { not: "ARCHIVED" },
      },
      include: {
        pools: {
          where: includeInactive ? {} : {
            active: true,
            deletedAt: null,
            archiveStatus: "ATIVO",
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async getById(clientId) {
    return prisma.client.findUnique({
      where: { id: Number(clientId) },
      include: { pools: true, invoices: true },
    });
  }

  async create(data) {
    return prisma.client.create({ data });
  }

  async update(clientId, body = {}, user = null) {
    const id = Number(clientId), role = normalizeRole(user?.role);
    const principalType = user?.principalType || (role === 'ADMIN' ? 'USER' : 'TECHNICIAN');
    const principalId = Number(principalType === 'USER' ? (user?.userId || user?.id) : (user?.technicianId || user?.id));
    if (!['ADMIN', 'TEAM_LEADER'].includes(role) || !Number.isSafeInteger(principalId) || principalId <= 0) {
      throw Object.assign(new Error('Sem permissão para editar clientes.'), { statusCode: 403 });
    }
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw Object.assign(new Error('Cliente inválido.'), { statusCode: 400 });
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Dados de edição inválidos.'), { statusCode: 400 });
    const stringFields = ['name', 'internalName', 'email', 'phone', 'address', 'zone', 'notes', 'fiscalName', 'fiscalNif', 'nif', 'fiscalAddress', 'fiscalEmail', 'externalBillingNotes'];
    for (const field of stringFields) {
      if (body[field] !== undefined && body[field] !== null && (typeof body[field] !== 'string' || body[field].length > 10000)) {
        throw Object.assign(new Error('Campo de texto inválido: ' + field), { statusCode: 400 });
      }
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) throw Object.assign(new Error('Nome obrigatório.'), { statusCode: 400 });
    const credentials = {};
    for (const field of ['password', 'pin']) {
      if (body[field] === undefined || body[field] === null || body[field] === '') continue;
      if (typeof body[field] !== 'string' || Buffer.byteLength(body[field], 'utf8') > 72) throw Object.assign(new Error('Credencial inválida.'), { statusCode: 400 });
      // A blank credential retains the previous one, as in the existing editor.
      if (body[field].trim()) credentials[field] = await bcrypt.hash(body[field].trim(), 12);
    }
    const actor = principalType === 'ENV_ADMIN'
      ? 'ENV_ADMIN:' + createHash('sha256').update(String(user.email || '').trim().toLowerCase()).digest('hex')
      : principalType + ':' + principalId;
    const safe = row => {
      const { password, pin, ...result } = row;
      return JSON.parse(JSON.stringify(result));
    };
    return prisma.$transaction(async tx => {
      // General edits and activation read/write the same locked client row.
      await tx.$queryRawUnsafe('SELECT id FROM "Client" WHERE id = $1 FOR NO KEY UPDATE', id);
      const currentClient = await tx.client.findUnique({ where: { id } });
      if (!currentClient) throw Object.assign(new Error('Cliente não encontrado.'), { statusCode: 404 });
      const updated = await tx.client.update({
        where: { id },
        data: { ...clientUpdateData(body, currentClient), ...credentials },
      });
      const result = safe(updated);
      await tx.userAuditLog.create({ data: {
        action: 'CLIENT_UPDATED', actor, entity: 'Client', entityId: String(id),
        metadata: {
          before: safe(currentClient), after: result,
          credentialsChanged: { password: !!credentials.password, pin: !!credentials.pin },
        },
      } });
      return result;
    }, { maxWait: 15000, timeout: 15000 });
  }

  async activate(clientId, body = {}, user = null) {
    return require('./ContractActivationBusiness').activate(clientId, body, user);
  }

  async archive(clientId) {
    const id = Number(clientId);
    const now = new Date();

    await prisma.$transaction([
      prisma.client.update({
        where: { id },
        data: {
          archiveStatus: "ARQUIVADO",
          deletedAt: now,
          status: "ARCHIVED",
          active: false,
          billingActive: false,
          paymentStatus: "BILLING_DISABLED",
        },
      }),
      prisma.pool.updateMany({
        where: { clientId: id },
        data: {
          archiveStatus: "ARQUIVADO",
          deletedAt: now,
          active: false,
          scheduleMode: "ARCHIVED",
        },
      }),
    ]);

    return { ok: true, archived: true, message: "Cliente e piscinas arquivados com histórico preservado." };
  }

  async restore(clientId) {
    const id = Number(clientId);

    await prisma.$transaction([
      prisma.client.update({
        where: { id },
        data: {
          archiveStatus: "ATIVO",
          deletedAt: null,
          status: "SETUP",
          active: true,
          billingActive: false,
          paymentStatus: "BILLING_DISABLED",
        },
      }),
      prisma.pool.updateMany({
        where: { clientId: id },
        data: {
          archiveStatus: "ATIVO",
          deletedAt: null,
          active: true,
          scheduleMode: "PENDING_ROUND",
        },
      }),
    ]);

    return { ok: true, restored: true, message: "Cliente restaurado em configuração. A faturação continua desligada até ativar contrato." };
  }

  async delete(clientId) {
    const id = Number(clientId);

    const [invoices, pools, visits] = await Promise.all([
      prisma.invoice.count({ where: { clientId: id } }).catch(() => 0),
      prisma.pool.count({ where: { clientId: id } }).catch(() => 0),
      prisma.serviceVisit.count({ where: { clientId: id } }).catch(() => 0),
    ]);

    if (invoices > 0 || pools > 0 || visits > 0) {
      return this.archive(id);
    }

    await prisma.client.delete({ where: { id } });
    return { ok: true, deleted: true };
  }
}

module.exports = new ClientBusiness();
