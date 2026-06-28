const { prisma } =
  require("../prismaClient");

// ======================================================
// DISTANCE
// ======================================================

function deg2rad(deg){

  return deg *
    (Math.PI / 180);
}

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

    Math.cos(
      deg2rad(lat1)
    ) *

    Math.cos(
      deg2rad(lat2)
    ) *

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

// ======================================================
// TECHNICIAN LOAD SCORE
// ======================================================

function calculateLoadScore({

  visits,
  incidents,
  distance,
  efficiency
}){

  let score = 100;

  // ==================================================
  // VISITS
  // ==================================================

  score -= visits * 1.5;

  // ==================================================
  // INCIDENTS
  // ==================================================

  score -= incidents * 7;

  // ==================================================
  // DISTANCE
  // ==================================================

  score -= distance * 0.4;

  // ==================================================
  // EFFICIENCY BONUS
  // ==================================================

  score += efficiency * 0.2;

  // ==================================================
  // LIMITS
  // ==================================================

  if(score > 100)
    score = 100;

  if(score < 0)
    score = 0;

  return Math.floor(score);
}

// ======================================================
// TECHNICIAN EFFICIENCY
// ======================================================

function calculateEfficiency({

  visits,
  incidents
}){

  let efficiency = 100;

  efficiency -= visits;

  efficiency -= incidents * 5;

  if(efficiency < 0)
    efficiency = 0;

  return efficiency;
}

// ======================================================
// ANALYZE TECHNICIANS
// ======================================================

async function analyzeTechnicians(){

  try {

    const technicians =
      await prisma.user.findMany({

        where:{
          role:"TECHNICIAN"
        }
      });

    const locations =
      await prisma.technicianLocation.findMany();

    const analysis = [];

    for(const tech of technicians){

      // ==================================================
      // LOCATION
      // ==================================================

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
      // DISTANCE SCORE
      // ==================================================

      const distance =
        location
          ? calculateDistance(

              location.latitude,
              location.longitude,

              37.136,
              -8.67
            )
          : 999;

      // ==================================================
      // EFFICIENCY
      // ==================================================

      const efficiency =
        calculateEfficiency({

          visits,
          incidents
        });

      // ==================================================
      // LOAD SCORE
      // ==================================================

      const loadScore =
        calculateLoadScore({

          visits,
          incidents,
          distance,
          efficiency
        });

      analysis.push({

        technicianId:
          tech.id,

        technician:
          tech.name,

        visits,

        incidents,

        distance:
          Math.floor(distance),

        efficiency,

        loadScore,

        overloaded:
          loadScore < 40,

        underloaded:
          loadScore > 80
      });
    }

    // ==================================================
    // SORT
    // ==================================================

    analysis.sort(
      (a,b)=>
        b.loadScore - a.loadScore
    );

    return analysis;

  } catch(err){

    console.error(
      "ANALYZE TECHNICIANS ERROR:",
      err
    );

    return [];
  }
}

// ======================================================
// GENERATE REDISTRIBUTION
// ======================================================

async function generateRedistributionPlan(){

  try {

    const analysis =
      await analyzeTechnicians();

    const overloaded =
      analysis.filter(t =>
        t.overloaded
      );

    const underloaded =
      analysis.filter(t =>
        t.underloaded
      );

    const suggestions = [];

    for(const over of overloaded){

      const available =
        underloaded[0];

      if(!available)
        continue;

      suggestions.push({

        from:
          over.technician,

        to:
          available.technician,

        reason:
          "Balanceamento operacional",

        estimatedGain:
          Math.floor(
            over.visits * 0.15
          )
      });
    }

    return {

      analysis,

      overloaded,

      underloaded,

      suggestions
    };

  } catch(err){

    console.error(
      "REDISTRIBUTION ERROR:",
      err
    );

    return {

      analysis:[],

      overloaded:[],

      underloaded:[],

      suggestions:[]
    };
  }
}

// ======================================================
// AI ROUTE OPTIMIZATION
// ======================================================

async function runRouteOptimization(){

  try {

    console.log(
      "🧠 ROUTE OPTIMIZATION ENGINE RUNNING..."
    );

    const result =
      await generateRedistributionPlan();

    // ==================================================
    // REALTIME
    // ==================================================

    if(global.io){

      global.io.emit(
        "route-optimization",
        result
      );
    }

    return result;

  } catch(err){

    console.error(
      "ROUTE OPTIMIZATION ERROR:",
      err
    );

    return null;
  }
}

module.exports = {

  calculateDistance,

  calculateLoadScore,

  calculateEfficiency,

  analyzeTechnicians,

  generateRedistributionPlan,

  runRouteOptimization
};