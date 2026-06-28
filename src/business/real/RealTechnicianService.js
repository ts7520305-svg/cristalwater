const prisma = require("../../prismaClient");

class RealTechnicianService {

    async count() {
        return prisma.technician.count();
    }

    async all() {
        return prisma.technician.findMany({
            orderBy: {
                name: "asc"
            }
        });
    }

    async active() {
        return prisma.technician.findMany({
            where: {
                active: true
            },
            orderBy: {
                name: "asc"
            }
        });
    }

    async byId(id) {
        return prisma.technician.findUnique({
            where: {
                id: Number(id)
            }
        });
    }

}

module.exports = new RealTechnicianService();
