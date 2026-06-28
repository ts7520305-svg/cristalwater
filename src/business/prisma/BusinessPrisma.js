const prisma = require("../../prismaClient");

class BusinessPrisma {

    get db() {
        return prisma;
    }

    async health() {

        try {

            await prisma.$queryRaw`SELECT NOW()`;

            return {

                ok:true,

                database:"PostgreSQL",

                provider:"Prisma",

                connected:true

            };

        } catch(error){

            return{

                ok:false,

                connected:false,

                error:error.message

            };

        }

    }

}

module.exports=new BusinessPrisma();
