const { prisma } = require("../../prismaClient");

async function getTodayRoute(technicianId) {

    let visits = await prisma.serviceVisit.findMany({

        where: {
            technicianId
        },

        include: {
            client: true,
            pool: true
        },

        orderBy: {
            plannedDate: "asc"
        }

    });

    return {

        ok: true,

        total: visits.length,

        visits

    };

}

module.exports = {

    getTodayRoute

};
