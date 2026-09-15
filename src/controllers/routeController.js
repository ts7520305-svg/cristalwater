const { prisma } = require("../prismaClient");
const { emitRoutePlanned } = require("../services/routeOsEventService");
const { normalizeRole } = require('../utils/roles');
const { safeVisit } = require('../services/technicianResponseSanitizer');

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

  const validCoordinate = (value, limit) => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;
  if (!validCoordinate(req.query.lat, 90) || !validCoordinate(req.query.lng, 180)) return res.status(400).json({ok:false,error:"Coordenadas de partida inválidas"});
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const field = normalizeRole(req.user?.role) !== 'ADMIN';
  const technicianId = Number(req.user?.technicianId || (req.user?.principalType !== 'USER' && req.user?.id));
  if (field && (!Number.isSafeInteger(technicianId) || technicianId < 1)) return res.status(403).json({ok:false,error:'Perfil de campo por associar.'});

  const visits = await prisma.serviceVisit.findMany({
    where:{ status:"PLANNED", ...(field ? {technicianId} : {}) },
    include:{ pool:true, client:true },
    orderBy: { id: 'asc' }
  });

  let current = { lat, lng };
  const ordered = [];

  const hasCoordinates = visit => visit.pool?.latitude != null && visit.pool?.longitude != null && Number.isFinite(Number(visit.pool.latitude)) && Number.isFinite(Number(visit.pool.longitude)) && Math.abs(Number(visit.pool.latitude)) <= 90 && Math.abs(Number(visit.pool.longitude)) <= 180;
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
  res.set('Cache-Control', 'private, no-store');
  res.json(ordered.map(visit => {
    if (field) return safeVisit(visit);
    if (visit.client) { delete visit.client.password; delete visit.client.pin; }
    return visit;
  }));

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
