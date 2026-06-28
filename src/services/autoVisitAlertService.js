const { prisma } =
  require("../prismaClient");

// ======================================================
// AUTO VISIT ALERT
// ======================================================

async function runAutoVisitAlerts(){

  try {

    const pools =
      await prisma.pool.findMany({

        include: {

          serviceVisits: {

            orderBy: {

              startAt: "desc"
            },

            take: 1
          }
        }
      });

    for (const pool of pools){

      const latest =
        pool.serviceVisits?.[0];

      // SEM VISITA

      if (!latest){

        await createAlert(
          pool.id,
          `Piscina ${pool.name} sem visitas registadas`
        );

        continue;
      }

      // DIAS SEM VISITA

      const diff =
        Date.now() -

        new Date(
          latest.startAt
        ).getTime();

      const days =
        diff / 1000 / 60 / 60 / 24;

      if (days >= 8){

        await createAlert(
          pool.id,
          `Piscina ${pool.name} sem visita há ${Math.floor(days)} dias`
        );
      }
    }

  } catch(err){

    console.error(
      "AUTO VISIT ALERT:",
      err
    );
  }
}

// ======================================================
// CREATE ALERT
// ======================================================

async function createAlert(
  poolId,
  message
){

  const exists =
    await prisma.notification.findFirst({

      where: {

        message
      }
    });

  if (exists) return;

  const notification =
    await prisma.notification.create({

      data: {

        message,

        type:
          "VISIT_ALERT"
      }
    });

  // SOCKET

  if (global.io){

    global.io.emit(
      "new-notification",
      {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt
      }
    );
  }
}

// ======================================================

module.exports = {
  runAutoVisitAlerts
};