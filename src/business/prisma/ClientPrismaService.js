const prisma = require("../../prismaClient");

class ClientPrismaService {

    async count(){

        return prisma.client.count();

    }

    async first(){

        return prisma.client.findFirst();

    }

}

module.exports = new ClientPrismaService();
