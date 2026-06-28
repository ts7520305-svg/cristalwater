const { prisma } =
  require("../prismaClient");

// ======================================================
// DISTANCE
// ======================================================

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
){

  if(
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
  ){
    return 999999;
  }

  const R = 6371;

  const dLat =
    deg2rad(lat2 - lat1);

  const dLon =
    deg2rad(lon2 - lon1);

  const a =

    Math.sin(dLat/2) *
    Math.sin(dLat/2)

    +

    Math.cos(deg2rad(lat1)) *
    Math.cos(deg2rad(lat2)) *

    Math.sin(dLon/2) *
    Math.sin(dLon/2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1-a)
    );

  return R * c;
}

function deg2rad(deg){

  return deg *
    (Math.PI/180);
}

// ======================================================
// WORKLOAD SCORE
// ======================================================

function calculateWorkloadScore(
  visits,
  incidents
){

  let score = 100;

  score -= visits * 2;

  score -= incidents * 8;

  if(score < 0)
    score = 0;

  return score;
}

// ======================================================
// DISTANCE SCORE
// ======================================================

function calculateDistanceScore(
  distance
){

  if(distance <= 1)
    return 100;

  if(distance <= 5)
    return 80;

  if(distance <= 10)
    return 60;

  if(distance <= 20)
    return 40;

  return 10;
}

// ======================================================
// TECHNICIAN SCORE
// ======================================================

function calculateTechnicianScore({

  distance,
  visits,
  incidents,
  efficiency = 100

}){

  const distanceScore =
    calculateDistanceScore(
      distance
    );

  const workloadScore =
    calculateWorkloadScore(
      visits,
      incidents
    );

  let score = 0;

  score +=
    distanceScore * 0.4;

  score +=
    workloadScore * 0.35;

  score +=
    efficiency * 0.25;

  return Math.floor(score);
}

// ======================================================
// FIND BEST TECHNICIAN
// ======================================================

async function findBestTechnician({

  poolId = null,

  latitude = null,

  longitude = null
}){

  try {

    // ==================================================
    // LOAD TECHNICIANS
    // ==================================================

    const technicians =
      await prisma.user.findMany({

        where:{
          role:"TECHNICIAN"
        }
      });

    if(!technicians.length)
      return null;

    // ==================================================
    // LOCATIONS
    // ==================================================

    const locations =
      await prisma.technicianLocation.findMany();

    // ==================================================
    // SCORES
    // ==================================================

    const ranked = [];

    for(const tech of technicians){

      const location =
        locations.find(l =>
          l.userId === tech.id
        );

      // ==================================================
      // VISITS
      // ==================================================

      const visits =
        await prisma.serviceVisit.count({

          where:{
            technicianName:
              tech.name || ""
          }
        });

      // ==================================================
      // INCIDENTS
      // ==================================================

      const incidents =
        await prisma.incident.count({

          where:{

            technicianId:
              tech.id,

            status:{
              not:"RESOLVED"
            }
          }
        });

      // ==================================================
      // DISTANCE
      // ==================================================

      const distance =
        calculateDistance(

          latitude,

          longitude,

          location?.latitude,

          location?.longitude
        );

      // ==================================================
      // EFFICIENCY
      // ==================================================

      let efficiency = 100;

      efficiency -= visits;

      efficiency -= incidents * 5;

      if(efficiency < 0)
        efficiency = 0;

      // ==================================================
      // SCORE
      // ==================================================

      const score =
        calculateTechnicianScore({

          distance,

          visits,

          incidents,

          efficiency
        });

      ranked.push({

        technician:tech,

        location,

        distance,

        visits,

        incidents,

        efficiency,

        score
      });
    }

    // ==================================================
    // SORT
    // ==================================================

    ranked.sort(
      (a,b)=>
        b.score - a.score
    );

    return ranked[0] || null;

  } catch(err){

    console.error(
      "ASSIGNMENT ENGINE ERROR:",
      err
    );

    return null;
  }
}

// ======================================================
// AUTO ASSIGN INCIDENT
// ======================================================

async function autoAssignIncident(
  incident
){

  try {

    if(!incident)
      return null;

    // ==================================================
    // POOL
    // ==================================================

    let latitude = null;
    let longitude = null;

    if(incident.poolId){

      const pool =
        await prisma.pool.findUnique({

          where:{
            id:incident.poolId
          }
        });

      latitude =
        pool?.latitude || null;

      longitude =
        pool?.longitude || null;
    }

    // ==================================================
    // BEST TECH
    // ==================================================

    const best =
      await findBestTechnician({

        poolId:
          incident.poolId,

        latitude,

        longitude
      });

    if(!best)
      return null;

    // ==================================================
    // UPDATE INCIDENT
    // ==================================================

    const updated =
      await prisma.incident.update({

        where:{
          id:incident.id
        },

        data:{

          technicianId:
            best.technician.id,

          metadata:{

            ...(incident.metadata || {}),

            autoAssigned:true,

            assignmentScore:
              best.score,

            assignmentDistance:
              best.distance,

            assignmentVisits:
              best.visits
          }
        }
      });

    // ==================================================
    // REALTIME
    // ==================================================

    if(global.io){

      global.io.emit(
        "incident-assigned",
        {

          incidentId:
            updated.id,

          technician:
            best.technician.name,

          score:
            best.score
        }
      );
    }

    return updated;

  } catch(err){

    console.error(
      "AUTO ASSIGN ERROR:",
      err
    );

    return null;
  }
}

module.exports = {

  calculateDistance,

  calculateDistanceScore,

  calculateWorkloadScore,

  calculateTechnicianScore,

  findBestTechnician,

  autoAssignIncident
};