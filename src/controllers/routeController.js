const { prisma } = require("../prismaClient");

// distância haversine
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ==========================================================
// OTIMIZAR ROTA
// ==========================================================

async function optimizeRoute(req,res){

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  const visits = await prisma.serviceVisit.findMany({
    where:{ status:"PLANNED" },
    include:{ pool:true, client:true }
  });

  let current = { lat, lng };
  const ordered = [];

  let remaining = [...visits];

  while(remaining.length > 0){

    let bestIndex = 0;
    let bestDist = Infinity;

    remaining.forEach((v,i)=>{
      if(!v.pool.latitude) return;

      const d = distance(
        current.lat,
        current.lng,
        v.pool.latitude,
        v.pool.longitude
      );

      if(d < bestDist){
        bestDist = d;
        bestIndex = i;
      }
    });

    const next = remaining.splice(bestIndex,1)[0];
    ordered.push(next);

    current = {
      lat: next.pool.latitude,
      lng: next.pool.longitude
    };
  }

  res.json(ordered);
}

module.exports = {
  optimizeRoute
};