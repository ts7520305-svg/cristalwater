// ======================================================
// AI PREDICTIVE ENGINE
// ======================================================

function buildPredictiveAnalysis({

  technicians = [],

  visits = [],

  alerts = []

}){

  const analysis = {

    tomorrowRiskZones: [],

    overloadedTomorrow: [],

    availableTomorrow: [],

    recommendations: []
  };

  // ====================================================
  // TECHNICIANS
  // ====================================================

  technicians.forEach(tech => {

    const techVisits =
      visits.filter(v =>

        v.technicianId === tech.id
      );

    const total =
      techVisits.length;

    // ================================================
    // OVERLOAD
    // ================================================

    if (total >= 10){

      analysis.overloadedTomorrow.push({

        technician:
          tech.name,

        visits:
          total
      });

      analysis.recommendations.push({

        type:
          "OVERLOAD",

        message:
          `${tech.name} poderá ficar sobrecarregado amanhã`
      });
    }

    // ================================================
    // AVAILABLE
    // ================================================

    if (total <= 4){

      analysis.availableTomorrow.push({

        technician:
          tech.name,

        visits:
          total
      });

      analysis.recommendations.push({

        type:
          "AVAILABLE",

        message:
          `${tech.name} disponível para reforço`
      });
    }
  });

  // ====================================================
  // ZONES
  // ====================================================

  const zoneMap = {};

  visits.forEach(v => {

    const zone =
      v.pool?.zone || "Sem zona";

    if (!zoneMap[zone]){

      zoneMap[zone] = {

        visits:0,

        alerts:0
      };
    }

    zoneMap[zone].visits++;
  });

  alerts.forEach(a => {

    const zone =
      a.pool?.zone || "Sem zona";

    if (!zoneMap[zone]){

      zoneMap[zone] = {

        visits:0,

        alerts:0
      };
    }

    zoneMap[zone].alerts++;
  });

  Object.entries(zoneMap)
    .forEach(([zone,data]) => {

      // ==============================================
      // RISK
      // ==============================================

      if (
        data.visits >= 8 ||
        data.alerts >= 3
      ){

        analysis.tomorrowRiskZones.push({

          zone,

          visits:
            data.visits,

          alerts:
            data.alerts
        });

        analysis.recommendations.push({

          type:
            "ZONE_RISK",

          message:
            `Zona ${zone} poderá ficar crítica amanhã`
        });
      }
    });

  return analysis;
}

module.exports = {

  buildPredictiveAnalysis
};