// ======================================================
// AI OPERATIONAL ENGINE
// ======================================================

function analyzeOperationalData(
  technicians = [],
  alerts = [],
  visits = []
){

  const analysis = {

    overloadedTechs: [],

    criticalZones: [],

    recommendations: [],

    alerts: []
  };

  // ====================================================
  // TECH LOAD
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

    if (total >= 12){

      analysis.overloadedTechs.push({

        technician:
          tech.name,

        visits:
          total
      });

      analysis.recommendations.push({

        type:
          "REDISTRIBUTE",

        message:
          `${tech.name} sobrecarregado`
      });
    }

    // ================================================
    // LOW LOAD
    // ================================================

    if (total <= 4){

      analysis.recommendations.push({

        type:
          "AVAILABLE",

        message:
          `${tech.name} disponível para ajudar`
      });
    }
  });

  // ====================================================
  // CRITICAL ALERTS
  // ====================================================

  if (alerts.length >= 5){

    analysis.alerts.push({

      type:
        "HIGH_ALERT_VOLUME",

      message:
        "Volume elevado de alertas críticos"
    });
  }

  // ====================================================
  // ZONES
  // ====================================================

  const zoneMap = {};

  visits.forEach(v => {

    const zone =
      v.pool?.zone || "Sem zona";

    if (!zoneMap[zone]){

      zoneMap[zone] = 0;
    }

    zoneMap[zone]++;
  });

  Object.entries(zoneMap)
    .forEach(([zone,total]) => {

      if (total >= 10){

        analysis.criticalZones.push({

          zone,

          visits:
            total
        });

        analysis.recommendations.push({

          type:
            "ZONE_OVERLOAD",

          message:
            `Zona ${zone} sobrecarregada`
        });
      }
    });

  return analysis;
}

module.exports = {

  analyzeOperationalData
};