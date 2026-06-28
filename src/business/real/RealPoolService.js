const prisma = require("../../prismaClient");

class RealPoolService {

    async count() {
        return prisma.pool.count();
    }

    async all() {
        return prisma.pool.findMany({
            orderBy:{
                id:"asc"
            }
        });
    }

    async active() {
        return prisma.pool.findMany({
            where:{
                active:true
            }
        });
    }

    async byId(id){
        return prisma.pool.findUnique({
            where:{
                id:Number(id)
            }
        });
    }

}

module.exports = new RealPoolService();
