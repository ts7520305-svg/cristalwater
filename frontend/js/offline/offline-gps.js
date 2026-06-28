const OFFLINE_GPS_KEY =
  "cristalwater_offline_gps";

// ======================================================
// GET
// ======================================================

function getOfflineGps(){

  try {

    return JSON.parse(

      localStorage.getItem(
        OFFLINE_GPS_KEY
      )

    ) || [];

  } catch {

    return [];
  }
}

// ======================================================
// SAVE
// ======================================================

function saveOfflineGps(position){

  const data =
    getOfflineGps();

  data.push({

    ...position,

    createdAt:
      new Date()
        .toISOString()
  });

  localStorage.setItem(

    OFFLINE_GPS_KEY,

    JSON.stringify(data)
  );

  console.log(
    "📍 GPS offline guardado"
  );
}

// ======================================================
// CLEAR
// ======================================================

function clearOfflineGps(){

  localStorage.removeItem(
    OFFLINE_GPS_KEY
  );
}

// ======================================================
// SYNC
// ======================================================

async function syncOfflineGps(){

  if (!navigator.onLine)
    return;

  const data =
    getOfflineGps();

  if (!data.length)
    return;

  console.log(
    "🔄 Sync GPS offline..."
  );

  const remaining = [];

  for (const item of data){

    try {

      const res =
        await fetch(
          `${API}/gps/update`,
          {

            method:"POST",

            headers:{
              "Content-Type":"application/json"
            },

            body: JSON.stringify({

              userId:
                item.userId,

              latitude:
                item.latitude,

              longitude:
                item.longitude
            })
          }
        );

      if (!res.ok){

        remaining.push(item);
      }

    } catch(err){

      console.error(err);

      remaining.push(item);
    }
  }

  localStorage.setItem(

    OFFLINE_GPS_KEY,

    JSON.stringify(remaining)
  );

  console.log(
    "✅ GPS offline sincronizado"
  );
}

// ======================================================
// SEND GPS
// ======================================================

async function sendGpsPosition(
  latitude,
  longitude
){

  // ================================================
  // OFFLINE
  // ================================================

  if (!navigator.onLine){

    saveOfflineGps({

      userId:
        user.id,

      latitude,

      longitude
    });

    return;
  }

  // ================================================
  // ONLINE
  // ================================================

  try {

    await fetch(
      `${API}/gps/update`,
      {

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body: JSON.stringify({

          userId:
            user.id,

          latitude,

          longitude
        })
      }
    );

  } catch(err){

    console.error(err);

    saveOfflineGps({

      userId:
        user.id,

      latitude,

      longitude
    });
  }
}

// ======================================================
// START GPS TRACKING
// ======================================================

function startGpsTracking(){

  if (
    !navigator.geolocation
  ){

    console.log(
      "GPS não suportado"
    );

    return;
  }

  navigator.geolocation.watchPosition(

    (pos)=>{

      sendGpsPosition(

        pos.coords.latitude,

        pos.coords.longitude
      );
    },

    (err)=>{

      console.error(
        "Erro GPS:",
        err
      );
    },

    {

      enableHighAccuracy:true,

      maximumAge:10000,

      timeout:10000
    }
  );
}