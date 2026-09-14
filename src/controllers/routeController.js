const { prisma } = require("../prismaClient");
const { emitRoutePlanned } = require("../services/routeOsEventService");

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

async function optimizeRoute(req,res,next){
 try {

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180 || req.query.lat == null || req.query.lng == null) return res.status(400).json({ok:false,error:"Coordenadas de partida inválidas"});

  const visits = await prisma.serviceVisit.findMany({
    where:{ status:"PLANNED", ...(String(req.user?.role).toUpperCase() === "TECHNICIAN" ? {technicianId:Number(req.user.technicianId || req.user.id)} : {}) },
    include:{ pool:true, client:true }
  });

  let current = { lat, lng };
  const ordered = [];

  const hasCoordinates = visit => visit.pool?.latitude != null && visit.pool?.longitude != null && Number.isFinite(Number(visit.pool.latitude)) && Number.isFinite(Number(visit.pool.longitude));
  let remaining = visits.filter(hasCoordinates);
  const unresolved = visits.filter(visit => !hasCoordinates(visit));

  while(remaining.length > 0){

    let bestIndex = 0;
    let bestDist = Infinity;

    remaining.forEach((v,i)=>{
      if(!hasCoordinates(v)) return;

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

  ordered.push(...unresolved);
  res.json(ordered);

  emitRoutePlanned({
    routeCount: ordered.length,
    route: ordered.map((visit) => ({
      id: visit.id,
      technicianId: visit.technicianId || null,
      poolId: visit.pool?.id || null,
      clientId: visit.client?.id || null,
      plannedDate: visit.plannedDate || null,
      status: visit.status || null,
    })),
    technicianId: ordered[0]?.technicianId || null,
    source: "route.optimize",
  }).catch((error) => console.warn("ROUTE_PLANNED emit failed:", error.message));
 } catch (error) { next(error); }
}

module.exports = {
  optimizeRoute
};