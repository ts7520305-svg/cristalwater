const prisma = require("../../prismaClient");

class BusinessDatabase {

    get client() {
        return prisma;
    }

    async health() {

        try {

            await prisma.$queryRaw`SELECT 1`;

            return {
                ok: true,
                database: "PostgreSQL",
                connected: true
            };

        } catch (error) {

            return {
                ok: false,
                connected: false,
                error: error.message
            };

        }

    }

}

module.exports = new BusinessDatabase();
