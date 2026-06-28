const {

  generateRedistributionPlan

} = require(
  "./routeOptimizationEngine"
);

// ======================================================
// OPERATIONAL GAIN
// ======================================================

function calculateOperationalGain({

  movedVisits,
  distanceReduction,
  overloadReduction
}){

  let gain = 0;

  gain += movedVisits * 8;

  gain += distanceReduction * 1.5;

  gain += overloadReduction * 15;

  if(gain > 100)
    gain = 100;

  return Math.floor(gain);
}

// ======================================================
// SLA IMPROVEMENT
// ======================================================

function calculateSlaImprovement({

  overloadReduction,
  incidentsReduction
}){

  let score = 0;

  score += overloadReduction * 20;

  score += incidentsReduction * 12;

  if(score > 100)
    score = 100;

  return Math.floor(score);
}

// ======================================================
// REDISTRIBUTION AI
// ======================================================

async function generateDispatchRecommendations(){

  try {

    const redistribution =
      await generateRedistributionPlan();

    const recommendations = [];

    // ==================================================
    // OVERLOADED
    // ==================================================

    for(const tech of redistribution.overloaded){

      const backup =
        redistribution.underloaded[0];

      if(!backup)
        continue;

      // ==================================================
      // ESTIMATES
      // ==================================================

      const movedVisits =
        Math.floor(
          tech.visits * 0.2
        );

      const overloadReduction =
        1;

      const distanceReduction =
        Math.floor(
          tech.distance * 0.15
        );

      // ==================================================
      // GAIN
      // ==================================================

      const operationalGain =
        calculateOperationalGain({

          movedVisits,
          distanceReduction,
          overloadReduction
        });

      // ==================================================
      // SLA
      // ==================================================

      const slaImprovement =
        calculateSlaImprovement({

          overloadReduction,

          incidentsReduction:
            tech.incidents
        });

      // ==================================================
      // CREATE
      // ==================================================

      recommendations.push({

        type:"REDISTRIBUTION",

        priority:
          operationalGain >= 70
            ? "HIGH"
            : "MEDIUM",

        from:
          tech.technician,

        to:
          backup.technician,

        movedVisits,

        operationalGain,

        slaImprovement,

        distanceReduction,

        description:

          `Mover aproximadamente ${movedVisits} visitas de ${tech.technician} para ${backup.technician}.`
      });
    }

    return recommendations;

  } catch(err){

    console.error(
      "DISPATCH AI ERROR:",
      err
    );

    return [];
  }
}

// ======================================================
// INCIDENT BACKUP
// ======================================================

async function generateBackupTechnicians(){

  try {

    const redistribution =
      await generateRedistributionPlan();

    const backups = [];

    for(const tech of redistribution.underloaded){

      backups.push({

        technician:
          tech.technician,

        score:
          tech.loadScore,

        efficiency:
          tech.efficiency,

        visits:
          tech.visits,

        incidents:
          tech.incidents
      });
    }

    backups.sort(
      (a,b)=>
        b.score - a.score
    );

    return backups;

  } catch(err){

    console.error(
      "BACKUP TECH ERROR:",
      err
    );

    return [];
  }
}

// ======================================================
// GLOBAL AI STATE
// ======================================================

async function generateOperationalState(){

  try {

    const redistribution =
      await generateRedistributionPlan();

    const overloaded =
      redistribution.overloaded.length;

    const underloaded =
      redistribution.underloaded.length;

    const suggestions =
      redistribution.suggestions.length;

    let state = "STABLE";

    if(overloaded >= 3)
      state = "CRITICAL";

    else if(overloaded >= 1)
      state = "WARNING";

    return {

      state,

      overloaded,

      underloaded,

      suggestions
    };

  } catch(err){

    console.error(
      "GLOBAL AI STATE ERROR:",
      err
    );

    return {

      state:"UNKNOWN",

      overloaded:0,

      underloaded:0,

      suggestions:0
    };
  }
}

// ======================================================
// FULL AI ANALYSIS
// ======================================================

async function runDispatchAi(){

  try {

    console.log(
      "🧠 DISPATCH AI RUNNING..."
    );

    const recommendations =
      await generateDispatchRecommendations();

    const backups =
      await generateBackupTechnicians();

    const operationalState =
      await generateOperationalState();

    const result = {

      recommendations,

      backups,

      operationalState
    };

    // ==================================================
    // REALTIME
    // ==================================================

    if(global.io){

      global.io.emit(
        "dispatch-ai-update",
        result
      );
    }

    return result;

  } catch(err){

    console.error(
      "RUN DISPATCH AI ERROR:",
      err
    );

    return null;
  }
}

module.exports = {

  calculateOperationalGain,

  calculateSlaImprovement,

  generateDispatchRecommendations,

  generateBackupTechnicians,

  generateOperationalState,

  runDispatchAi
};