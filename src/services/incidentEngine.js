const { prisma } =
  require("../prismaClient");

const {

  createIncident

} = require(
  "./incidentService"
);

// ======================================================
// ENGINE
// ======================================================

async function runIncidentEngine(){

  try {

    console.log(
      "🤖 INCIDENT ENGINE RUNNING..."
    );

    // ==================================================
    // OVERLOADED TECHNICIANS
    // ==================================================

    await detectOverloadedTechnicians();

    // ==================================================
    // FINANCIAL RISK
    // ==================================================

    await detectFinancialRisk();

    // ==================================================
    // CRITICAL ALERT ZONES
    // ==================================================

    await detectCriticalZones();

    // ==================================================
    // GPS OFFLINE
    // ==================================================

    await detectGpsIssues();

    // ==================================================
    // VISITS DELAY
    // ==================================================

    await detectVisitDelays();

  } catch(err){

    console.error(
      "INCIDENT ENGINE ERROR:",
      err
    );
  }
}

// ======================================================
// OVERLOADED TECHS
// ======================================================

async function detectOverloadedTechnicians(){

  try {

    const workdays =
      await prisma.technicianWorkDay.findMany({

        include:{
          user:true
        }
      });

    for(const wd of workdays){

      const visits =
        await prisma.serviceVisit.count({

          where:{
            technicianName:
              wd.user?.name || ""
          }
        });

      if(visits < 25)
        continue;

      await createIncident({

        type:"OVERLOADED_TECHNICIAN",

        severity:
          visits >= 35
            ? "CRITICAL"
            : "HIGH",

        title:
          "Técnico sobrecarregado",

        description:
          `${wd.user?.name} possui ${visits} visitas.`,

        technicianId:
          wd.userId,

        source:"AI_ENGINE",

        metadata:{
          visits
        }
      });
    }

  } catch(err){

    console.error(
      "OVERLOAD ERROR:",
      err
    );
  }
}

// ======================================================
// FINANCIAL RISK
// ======================================================

async function detectFinancialRisk(){

  try {

    const notifications =
      await prisma.notification.findMany({

        where:{
          type:{
            contains:"PAYMENT"
          }
        }
      });

    if(notifications.length < 5)
      return;

    await createIncident({

      type:"FINANCIAL_RISK",

      severity:
        notifications.length >= 15
          ? "CRITICAL"
          : "HIGH",

      title:
        "Risco financeiro operacional",

      description:
        `Existem ${notifications.length} alertas financeiros.`,

      source:"AI_ENGINE",

      metadata:{
        financialAlerts:
          notifications.length
      }
    });

  } catch(err){

    console.error(
      "FINANCIAL RISK ERROR:",
      err
    );
  }
}

// ======================================================
// CRITICAL ZONES
// ======================================================

async function detectCriticalZones(){

  try {

    const alerts =
      await prisma.notification.findMany({

        where:{
          type:{
            contains:"ALERT"
          }
        }
      });

    if(alerts.length < 10)
      return;

    await createIncident({

      type:"CRITICAL_ZONE",

      severity:"HIGH",

      title:
        "Zona operacional crítica",

      description:
        `Muitos alertas operacionais detectados.`,

      source:"AI_ENGINE",

      metadata:{
        alerts:
          alerts.length
      }
    });

  } catch(err){

    console.error(
      "CRITICAL ZONE ERROR:",
      err
    );
  }
}

// ======================================================
// GPS ISSUES
// ======================================================

async function detectGpsIssues(){

  try {

    const locations =
      await prisma.technicianLocation.findMany();

    const now =
      Date.now();

    for(const loc of locations){

      const diff =
        now -
        new Date(loc.updatedAt).getTime();

      const minutes =
        diff / 1000 / 60;

      if(minutes < 120)
        continue;

      await createIncident({

        type:"GPS_OFFLINE",

        severity:"MEDIUM",

        title:
          "GPS técnico offline",

        description:
          `Técnico sem GPS há ${Math.floor(minutes)} minutos.`,

        technicianId:
          loc.userId,

        source:"AI_ENGINE",

        metadata:{
          minutesOffline:
            Math.floor(minutes)
        }
      });
    }

  } catch(err){

    console.error(
      "GPS ISSUE ERROR:",
      err
    );
  }
}

// ======================================================
// VISIT DELAYS
// ======================================================

async function detectVisitDelays(){

  try {

    const visits =
      await prisma.serviceVisit.findMany();

    for(const visit of visits){

      if(
        !visit.startAt ||
        !visit.endAt
      ) continue;

      const diff =
        (
          new Date(visit.endAt) -
          new Date(visit.startAt)
        ) / 1000 / 60;

      if(diff < 120)
        continue;

      await createIncident({

        type:"VISIT_DELAY",

        severity:"MEDIUM",

        title:
          "Visita excessivamente longa",

        description:
          `Visita demorou ${Math.floor(diff)} minutos.`,

        poolId:
          visit.poolId,

        source:"AI_ENGINE",

        metadata:{
          duration:
            Math.floor(diff)
        }
      });
    }

  } catch(err){

    console.error(
      "VISIT DELAY ERROR:",
      err
    );
  }
}

module.exports = {

  runIncidentEngine
};