const fetch = require("node-fetch");

async function getRouteOSRM(points) {
  try {
    if (!Array.isArray(points) || points.length < 2) {
      return null;
    }

    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");

    const url =
      `http://router.project-osrm.org/trip/v1/driving/${coords}` +
      `?overview=full&geometries=geojson&source=first&roundtrip=false`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.trips || !data.trips.length) {
      return null;
    }

    return data.trips[0].geometry.coordinates.map((c) => ({
      lat: c[1],
      lng: c[0],
    }));
  } catch (err) {
    console.error("OSRM error:", err);
    return null;
  }
}

async function getBestRoute(points) {
  return await getRouteOSRM(points);
}

module.exports = {
  getBestRoute,
};