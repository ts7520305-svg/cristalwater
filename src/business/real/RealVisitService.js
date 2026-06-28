const prisma = require("../../prismaClient");

class RealVisitService {

    async count() {
        return prisma.visit.count();
    }

    async all() {
        return prisma.visit.findMany({
            orderBy:{
                id:"desc"
            }
        });
    }

    async today() {

        const start = new Date();
        start.setHours(0,0,0,0);

        const end = new Date();
        end.setHours(23,59,59,999);

        return prisma.visit.findMany({

            where:{

                createdAt:{
                    gte:start,
                    lte:end
                }

            }

        });

    }

}

module.exports = new RealVisitService();
