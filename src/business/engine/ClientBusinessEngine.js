const prisma = require("../../prismaClient");

class ClientBusinessEngine {

    async list(filters = {}) {

        return prisma.client.findMany({

            where:{

                deletedAt:null,

                ...(filters.active!==undefined && {

                    active:filters.active

                }),

                ...(filters.archiveStatus && {

                    archiveStatus:filters.archiveStatus

                })

            },

            include:{

                pools:true

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
            },

            include:{

                pools:true,

                invoices:true,

                payments:true

            }

        });

    }

    async count(){

        return prisma.client.count({

            where:{
                deletedAt:null
            }

        });

    }

}

module.exports = new ClientBusinessEngine();
