const prisma = require("../../prismaClient");

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

  async update(clientId, body, user) {
    return require('./ClientEditBusiness').update(clientId, body, user);
  }

  async getEditState(clientId, user) {
    return require('./ClientEditBusiness').getState(clientId, user);
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
