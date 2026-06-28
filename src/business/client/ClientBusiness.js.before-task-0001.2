const prisma = require("../../prismaClient");

class ClientBusiness {

    async list(query = {}) {

        const includeInactive = query.includeInactive === "true";

        return prisma.client.findMany({

            where: includeInactive
                ? {}
                : {
                    archiveStatus: "ATIVO",
                    deletedAt: null
                },

            orderBy: {
                name: "asc"
            }

        });

    }

}

module.exports = new ClientBusiness();
