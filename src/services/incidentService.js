const { prisma } =
  require("../prismaClient");

// ======================================================
// ASSIGNMENT ENGINE
// ======================================================

const {

  autoAssignIncident

} = require(
  "./assignmentEngine"
);

// ======================================================
// SLA BY SEVERITY
// ======================================================

function getSlaMinutes(severity){

  const s =
    String(severity || "")
      .toUpperCase();

  if(s === "CRITICAL")
    return 15;

  if(s === "HIGH")
    return 60;

  if(s === "MEDIUM")
    return 240;

  return 1440;
}

// ======================================================
// IMPACT SCORE
// ======================================================

function calculateImpactScore({

  severity,
  escalated = false

}){

  let score = 0;

  const s =
    String(severity || "")
      .toUpperCase();

  if(s === "CRITICAL")
    score += 90;

  else if(s === "HIGH")
    score += 70;

  else if(s === "MEDIUM")
    score += 40;

  else
    score += 15;

  if(escalated)
    score += 15;

  if(score > 100)
    score = 100;

  return score;
}

// ======================================================
// PRIORITY SCORE
// ======================================================

function calculatePriorityScore({

  severity,
  source
}){

  let score = 0;

  const s =
    String(severity || "")
      .toUpperCase();

  if(s === "CRITICAL")
    score += 100;

  else if(s === "HIGH")
    score += 80;

  else if(s === "MEDIUM")
    score += 50;

  else
    score += 20;

  if(source === "AI_ENGINE")
    score += 5;

  if(score > 100)
    score = 100;

  return score;
}

// ======================================================
// CREATE INCIDENT
// ======================================================

async function createIncident({

  type,
  severity = "MEDIUM",
  title,
  description,
  poolId = null,
  clientId = null,
  technicianId = null,
  source = "SYSTEM",
  metadata = {}

}){

  try {

    // ==================================================
    // PREVENT DUPLICATES
    // ==================================================

    const existing =
      await prisma.incident.findFirst({

        where:{

          title,

          status:{
            not:"RESOLVED"
          }
        }
      });

    if(existing){

      return existing;
    }

    // ==================================================
    // SLA
    // ==================================================

    const slaMinutes =
      getSlaMinutes(severity);

    const slaDeadline =
      new Date(
        Date.now() +
        slaMinutes * 60 * 1000
      );

    // ==================================================
    // SCORES
    // ==================================================

    const impactScore =
      calculateImpactScore({

        severity
      });

    const priorityScore =
      calculatePriorityScore({

        severity,
        source
      });

    // ==================================================
    // CREATE
    // ==================================================

    let incident =
      await prisma.incident.create({

        data:{

          type,

          severity,

          title,

          description,

          poolId,

          clientId,

          technicianId,

          source,

          status:"OPEN",

          impactScore,

          priorityScore,

          slaDeadline,

          metadata
        }
      });

    // ==================================================
    // AUTO ASSIGN
    // ==================================================

    incident =
      await autoAssignIncident(
        incident
      ) || incident;

    // ==================================================
    // REALTIME
    // ==================================================

    if(global.io){

      global.io.emit(
        "new-incident",
        incident
      );
    }

    return incident;

  } catch(err){

    console.error(
      "CREATE INCIDENT ERROR:",
      err
    );

    return null;
  }
}

// ======================================================
// UPDATE STATUS
// ======================================================

async function updateIncidentStatus(
  incidentId,
  status
){

  try {

    const resolved =
      String(status)
        .toUpperCase() ===
      "RESOLVED";

    const incident =
      await prisma.incident.update({

        where:{
          id:Number(incidentId)
        },

        data:{

          status,

          resolvedAt:
            resolved
              ? new Date()
              : null
        }
      });

    if(global.io){

      global.io.emit(
        "incident-updated",
        incident
      );
    }

    return incident;

  } catch(err){

    console.error(
      "UPDATE INCIDENT ERROR:",
      err
    );

    return null;
  }
}

// ======================================================
// ESCALATE
// ======================================================

async function escalateIncident(
  incidentId,
  automatic = false
){

  try {

    const current =
      await prisma.incident.findUnique({

        where:{
          id:Number(incidentId)
        }
      });

    if(!current)
      return null;

    const incident =
      await prisma.incident.update({

        where:{
          id:Number(incidentId)
        },

        data:{

          escalated:true,

          autoEscalated:
            automatic,

          impactScore:
            Math.min(
              100,
              current.impactScore + 15
            ),

          priorityScore:
            Math.min(
              100,
              current.priorityScore + 10
            )
        }
      });

    if(global.io){

      global.io.emit(
        "incident-escalated",
        incident
      );
    }

    return incident;

  } catch(err){

    console.error(
      "ESCALATE INCIDENT ERROR:",
      err
    );

    return null;
  }
}

// ======================================================
// LIST INCIDENTS
// ======================================================

async function listIncidents(){

  try {

    return await prisma.incident.findMany({

      orderBy:[
        {
          priorityScore:"desc"
        },
        {
          createdAt:"desc"
        }
      ]
    });

  } catch(err){

    console.error(
      "LIST INCIDENTS ERROR:",
      err
    );

    return [];
  }
}

// ======================================================
// CRITICAL INCIDENTS
// ======================================================

async function getCriticalIncidents(){

  try {

    return await prisma.incident.findMany({

      where:{

        severity:{
          in:[
            "CRITICAL",
            "HIGH"
          ]
        },

        status:{
          not:"RESOLVED"
        }
      },

      orderBy:[
        {
          priorityScore:"desc"
        },
        {
          createdAt:"desc"
        }
      ]
    });

  } catch(err){

    console.error(
      "CRITICAL INCIDENTS ERROR:",
      err
    );

    return [];
  }
}

// ======================================================
// SLA ENGINE
// ======================================================

async function processSlaEscalations(){

  try {

    const incidents =
      await prisma.incident.findMany({

        where:{

          status:{
            not:"RESOLVED"
          },

          slaDeadline:{
            not:null
          }
        }
      });

    const now =
      Date.now();

    for(const incident of incidents){

      if(
        incident.escalated
      ) continue;

      const deadline =
        new Date(
          incident.slaDeadline
        ).getTime();

      if(now < deadline)
        continue;

      await escalateIncident(
        incident.id,
        true
      );
    }

  } catch(err){

    console.error(
      "SLA ENGINE ERROR:",
      err
    );
  }
}

// ======================================================
// AUTO DETECT ENGINE
// ======================================================

async function detectOperationalIncidents(){

  try {

    const alerts =
      await prisma.notification.findMany({

        where:{
          type:{
            contains:"ALERT"
          }
        }
      });

    for(const alert of alerts){

      await createIncident({

        type:"ALERT_INCIDENT",

        severity:"HIGH",

        title:
          "Operational Alert",

        description:
          alert.message ||

          "Operational issue detected",

        source:"ALERT",

        metadata:{
          notificationId:
            alert.id
        }
      });
    }

  } catch(err){

    console.error(
      "DETECT INCIDENTS ERROR:",
      err
    );
  }
}

module.exports = {

  createIncident,

  updateIncidentStatus,

  escalateIncident,

  listIncidents,

  getCriticalIncidents,

  processSlaEscalations,

  detectOperationalIncidents
};