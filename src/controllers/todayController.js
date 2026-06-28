const { prisma } = require("../prismaClient");

// ==========================================================
// DASHBOARD DO DIA
// ==========================================================

async function getTodayDashboard(req,res){

  const today = new Date();
  today.setHours(0,0,0,0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate()+1);

  const visits = await prisma.serviceVisit.findMany({
    where:{
      plannedDate:{
        gte:today,
        lt:tomorrow
      }
    },
    include:{
      client:true,
      pool:true
    }
  });

  const done = visits.filter(v=>v.status==="DONE").length;
  const pending = visits.filter(v=>v.status==="PLANNED").length;
  const notDone = visits.filter(v=>v.status==="NOT_DONE").length;

  res.json({
    total: visits.length,
    done,
    pending,
    notDone,
    visits
  });
}

module.exports = {
  getTodayDashboard
};