// ======================================================
// DISTANCE
// ======================================================

function distance(a,b){

  const dx =
    a.lat - b.lat;

  const dy =
    a.lng - b.lng;

  return Math.sqrt(
    dx*dx + dy*dy
  );
}

// ======================================================
// FIND BEST TECHNICIAN
// ======================================================

function findBestTechnician({

  technicians = [],

  visit = null,

  activeVisits = []
}){

  if (
    !visit?.pool?.latitude ||
    !visit?.pool?.longitude
  ){

    return null;
  }

  const candidates = [];

  technicians.forEach(tech => {

    if (
      tech.latitude == null ||
      tech.longitude == null
    ) return;

    const techLoad =
      activeVisits.filter(v =>

        v.technicianId === tech.id
      ).length;

    const dist =
      distance(

        {
          lat:tech.latitude,
          lng:tech.longitude
        },

        {
          lat:visit.pool.latitude,
          lng:visit.pool.longitude
        }
      );

    // ================================================
    // SCORE
    // ================================================

    const score =

      dist +

      (techLoad * 2);

    candidates.push({

      technician:
        tech,

      score,

      distance:
        dist,

      load:
        techLoad
    });
  });

  candidates.sort(
    (a,b)=>a.score - b.score
  );

  return candidates[0] || null;
}

// ======================================================
// REDISTRIBUTION
// ======================================================

function buildRedistributionPlan({

  technicians = [],

  visits = []
}){

  const overloaded =
    [];

  const available =
    [];

  technicians.forEach(tech => {

    const total =
      visits.filter(v =>

        v.technicianId === tech.id
      ).length;

    if (total >= 10){

      overloaded.push({
        technician:tech,
        visits:total
      });
    }

    if (total <= 4){

      available.push({
        technician:tech,
        visits:total
      });
    }
  });

  const suggestions =
    [];

  overloaded.forEach(o => {

    available.forEach(a => {

      suggestions.push({

        from:
          o.technician.name,

        to:
          a.technician.name,

        message:
          `Mover visitas de ${o.technician.name} para ${a.technician.name}`
      });
    });
  });

  return suggestions;
}

module.exports = {

  findBestTechnician,

  buildRedistributionPlan
};