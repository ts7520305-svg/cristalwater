const fetch = require("node-fetch");

// ===============================
// OSRM (GRÁTIS)
// ===============================
async function getRouteOSRM(points) {
  try {
    const coords = points.map(p => `${p.lng},${p.lat}`).join(";");

    const url = `http://router.project-osrm.org/trip/v1/driving/${coords}?overview=full`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.trips || !data.trips.length) return null;

    return data.trips[0].geometry.coordinates.map(c => ({
      lat: c[1],
      lng: c[0]
    }));

  } catch (err) {
    console.error("OSRM error:", err);
    return null;
  }
}

// ===============================
// GOOGLE (PREPARADO)
// ===============================
async function getRouteGoogle(points) {
  try {
    // futuramente com API key
    return null;
  } catch (err) {
    return null;
  }
}

// ===============================
// FUNÇÃO PRINCIPAL
// ===============================
async function getBestRoute(points) {

  // tentar Google primeiro (quando ativarmos)
  let route = await getRouteGoogle(points);

  if (!route) {
    route = await getRouteOSRM(points);
  }

  return route;
}

module.exports = {
  getBestRoute
};