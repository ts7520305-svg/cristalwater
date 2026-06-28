const prisma = require("../../prismaClient");

class RealClientService {

    async count() {

        return prisma.client.count();

    }

    async all() {

        return prisma.client.findMany({

            orderBy:{
                name:"asc"
            }

        });

    }

    async active() {

        return prisma.client.findMany({

            where:{
                active:true
            },

            orderBy:{
                name:"asc"
            }

        });

    }

    async byId(id){

        return prisma.client.findUnique({

            where:{
                id:Number(id)
            }

        });

    }

}

module.exports=new RealClientService();
