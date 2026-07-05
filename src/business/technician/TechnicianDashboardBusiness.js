const { prisma } = require("../../prismaClient");

async function getDashboard(technicianId) {

    const visits = await prisma.serviceVisit.findMany({

        where:{
            technicianId
        },

        include:{
            client:true,
            pool:true
        },

        orderBy:{
            scheduledStart:"asc"
        }

    });

    const completed=visits.filter(v=>v.endAt).length;

    return{

        total:visits.length,

        completed,

        pending:visits.length-completed,

        nextVisit:visits.find(v=>!v.endAt)||null,

        visits

    };

}

module.exports={

    getDashboard

};
