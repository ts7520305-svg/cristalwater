const express = require("express");

const router = express.Router();

const { prisma } =
  require("../prismaClient");

// ==========================================================
// DISTÂNCIA
// ==========================================================

function dist(a, b) {

  const dx =
    a.lat - b.lat;

  const dy =
    a.lng - b.lng;

  return Math.sqrt(
    dx * dx + dy * dy
  );
}

// ==========================================================
// FUNÇÃO BASE DE PLANEAMENTO
// ==========================================================

async function buildPlans() {

  const now =
    new Date();

  const startDay =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,0,0
    );

  const endDay =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,59,59
    );

  // ======================================================
  // TÉCNICOS
  // ======================================================

  const techs =
    await prisma.user.findMany({

      where: {

        role: "tecnico"
      }
    });

  // ======================================================
  // PISCINAS
  // ======================================================

  const pools =
    await prisma.pool.findMany({

      include: {

        client: true,

        visits: true,

        extras: true
      }
    });

  // ======================================================
  // EXTRAS
  // ======================================================

  const extraVisits =
    await prisma.extraVisit.findMany({

      where: {

        scheduledAt: {

          gte: startDay,

          lte: endDay
        }
      },

      include: {

        pool: {

          include: {

            client: true
          }
        }
      }
    });

  let allTasks = [];

  // ======================================================
  // NORMAL TASKS
  // ======================================================

  pools.forEach(p => {

    if (
      !p.latitude ||
      !p.longitude
    ) return;

    const visitsCount =
      p.visits.length;

    const extrasValue =
      p.extras

        .filter(e => e.billed)

        .reduce(
          (s,e)=>s+e.price,
          0
        );

    const cost =
      visitsCount * 8;

    const profit =
      extrasValue - cost;

    // ==================================================
    // SMART TASK
    // ==================================================

    allTasks.push({

      id: p.id,

      name: p.name,

      client: p.client?.name,

      latitude: p.latitude,

      longitude: p.longitude,

      profit,

      type: "NORMAL",

      estimatedMinutes:

        25 +

        (p.priority || 0) * 10 +

        (p.extras?.length || 0) * 5,

      priorityScore:

        (p.priority || 0) * 100 +

        profit,

      zone:
        p.zone || "Sem zona"
    });
  });

  // ======================================================
  // EXTRAS HOJE
  // ======================================================

  extraVisits.forEach(v => {

    const p =
      v.pool;

    if (
      !p?.latitude ||
      !p?.longitude
    ) return;

    allTasks.push({

      id:
        "extra-" + v.id,

      name:
        p.name + " (EXTRA)",

      client:
        p.client?.name,

      latitude:
        p.latitude,

      longitude:
        p.longitude,

      profit:
        99999,

      type:
        "EXTRA",

      estimatedMinutes:
        45,

      priorityScore:
        999999,

      zone:
        p.zone || "Sem zona"
    });
  });

  // ======================================================
  // ORDENAR
  // ======================================================

  allTasks.sort((a,b)=>

    b.priorityScore -
    a.priorityScore
  );

  // ======================================================
  // PLANOS
  // ======================================================

  const plans =
    techs.map(t => ({

      technician: {

        id: t.id,

        name: t.name
      },

      route: []
    }));

  // ======================================================
  // DISTRIBUIÇÃO INTELIGENTE
  // ======================================================

  allTasks.forEach(task => {

    plans.sort((a,b)=>{

      const aWeight =
        a.route.reduce(
          (s,r)=>s+(r.estimatedMinutes||0),
          0
        );

      const bWeight =
        b.route.reduce(
          (s,r)=>s+(r.estimatedMinutes||0),
          0
        );

      return aWeight - bWeight;
    });

    plans[0].route.push(task);
  });

  // ======================================================
  // OTIMIZAÇÃO ROTA
  // ======================================================

  plans.forEach(plan => {

    if (!plan.route.length)
      return;

    let current = {

      lat:
        plan.route[0].latitude,

      lng:
        plan.route[0].longitude
    };

    let remaining =
      [...plan.route];

    let ordered = [];

    while (remaining.length){

      remaining.sort((a,b)=>{

        return dist(

          {
            lat:a.latitude,
            lng:a.longitude
          },

          current

        ) - dist(

          {
            lat:b.latitude,
            lng:b.longitude
          },

          current
        );
      });

      const next =
        remaining.shift();

      ordered.push(next);

      current = {

        lat: next.latitude,

        lng: next.longitude
      };
    }

    plan.route =
      ordered;
  });

  // ======================================================
  // IA OPERACIONAL
  // ======================================================

  plans.forEach(plan => {

    const totalMinutes =
      plan.route.reduce(
        (s,r)=>s+(r.estimatedMinutes||0),
        0
      );

    plan.analytics = {

      totalMinutes,

      overloaded:
        totalMinutes >= 420,

      priorityPools:
        plan.route.filter(
          r => r.priorityScore >= 500
        ).length,

      extras:
        plan.route.filter(
          r => r.type === "EXTRA"
        ).length
    };
  });

  return plans;
}

// ==========================================================
// AUTO PLAN
// ==========================================================

router.get(
  "/auto-plan",
  async (req, res) => {

    try {

      const plans =
        await buildPlans();

      res.json({

        ok:true,

        plans
      });

    } catch (err) {

      console.error(err);

      res.json({

        ok:false
      });
    }
  }
);

// ==========================================================
// ROTA TÉCNICO
// ==========================================================

router.get(
  "/today/:userId",
  async (req, res) => {

    try {

      const userId =
        Number(req.params.userId);

      const plans =
        await buildPlans();

      const plan =
        plans.find(

          p =>
            p.technician.id === userId
        );

      if (!plan) {

        return res.json({

          ok:false,

          message:"Sem rota"
        });
      }

      res.json({

        ok:true,

        route: plan.route,

        analytics:
          plan.analytics
      });

    } catch (err) {

      console.error(err);

      res.json({

        ok:false
      });
    }
  }
);

// ==========================================================

module.exports = router;