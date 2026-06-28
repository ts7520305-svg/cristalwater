const prisma = require("../../prismaClient");

class ClientBusiness {

    async list(query = {}) {

        const includeInactive =
            ["true", "1", "yes", "sim"].includes(
                String(query.includeInactive || "").toLowerCase()
            );

        const where = includeInactive ? {} : {

            active: true,
            deletedAt: null,
            archiveStatus: "ATIVO",
            status: {
                not: "ARCHIVED"
            }

        };

        return prisma.client.findMany({

            where,

            include: {

                pools: {
                    where: includeInactive
                        ? {}
                        : {
                            active: true,
                            deletedAt: null,
                            archiveStatus: "ATIVO"
                        }
                }

            },

            orderBy: {
                name: "asc"
            }

        });

    }

    async getById(clientId) {

        return prisma.client.findUnique({

            where: {
                id: Number(clientId)
            },

            include: {
                pools: true,
                invoices: true
            }

        });

    }

}

module.exports = new ClientBusiness();
