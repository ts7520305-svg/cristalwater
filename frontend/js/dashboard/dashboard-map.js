let liveMap;

let liveMarkers = [];

// ======================================================
// INIT MAP
// ======================================================

async function initLiveMap(){

  liveMap =
    L.map("liveMap")
      .setView([37.136, -8.67], 10);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "OpenStreetMap"
    }
  ).addTo(liveMap);

  loadLiveMap();

  setInterval(() => {

    loadLiveMap();

  }, 10000);
}

// ======================================================
// LOAD LIVE MAP
// ======================================================

async function loadLiveMap(){

  try {

    clearLiveMarkers();

    const res =
      await fetch(
        `${API}/gps/live`
      );

    const technicians =
      await res.json();

    const techBox =
      document.getElementById(
        "liveTechnicians"
      );

    if (techBox){

      techBox.innerText =
        technicians.length;
    }

    const gpsBox =
      document.getElementById(
        "gpsActive"
      );

    if (gpsBox){

      gpsBox.innerText =
        technicians.length;
    }

    const bounds = [];

    technicians.forEach(tech => {

      if (
        tech.latitude == null ||
        tech.longitude == null
      ) return;

      const marker =
        L.marker([
          tech.latitude,
          tech.longitude
        ])

        .addTo(liveMap)

        .bindPopup(`

          <b>
            🛠️ ${tech.name}
          </b>

          <br>

          Técnico ID:
          ${tech.id}

        `);

      liveMarkers.push(marker);

      bounds.push([
        tech.latitude,
        tech.longitude
      ]);
    });

    if (bounds.length){

      liveMap.fitBounds(
        bounds,
        {
          padding:[40,40]
        }
      );
    }

  } catch(err){

    console.error(err);
  }
}

// ======================================================
// CLEAR MARKERS
// ======================================================

function clearLiveMarkers(){

  liveMarkers.forEach(m => {

    liveMap.removeLayer(m);
  });

  liveMarkers = [];
}