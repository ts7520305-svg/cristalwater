const prisma = require("../../prismaClient");

class ClientBusinessEngine {

    async list(){

        return prisma.client.findMany({

            where:{
                archiveStatus:"ATIVO",
                deletedAt:null
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

    async count(){

        return prisma.client.count({

            where:{
                archiveStatus:"ATIVO",
                deletedAt:null
            }

        });

    }

}

module.exports=new ClientBusinessEngine();
