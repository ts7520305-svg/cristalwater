const {normalizeRole}=require('../../utils/roles');
const { prisma } = require("../../prismaClient");

const GEOFENCE_RADIUS_METERS = Number(process.env.GEOFENCE_RADIUS_METERS || 100);
const ARRIVAL_RADIUS_METERS = Number(process.env.ARRIVAL_RADIUS_METERS || 150);




const logger = {
  info: (msg, ctx = null) => console.log(`[${new Date().toISOString()}] [INFO] [GPS] ${msg}`, ctx || ""),
  warn: (msg, ctx = null) => console.warn(`[${new Date().toISOString()}] [WARN] [GPS] ${msg}`, ctx || ""),
  error: (msg, err = null) => console.error(`[${new Date().toISOString()}] [ERROR] [GPS] ${msg}`, err?.stack || err || ""),
};

function toNumber(value) {
  if(value==null||typeof value==='boolean'||String(value).trim()==='')return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampLimit(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180 &&
    !(Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001)
  );
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isGpsFresh(updatedAt) {
  const time = updatedAt ? new Date(updatedAt).getTime() : 0;
  return Number.isFinite(time) && Date.now() - time <= 15 * 60 * 1000;
}

function activeVisitStatus(status) {
  return ["IN_PROGRESS", "A_CAMINHO", "ON_ROUTE", "STARTED", "EM_EXECUCAO", "EM EXECUCAO"].includes(
    String(status || "").toUpperCase()
  );
}

function openVisitStatus(status) {
  return !["DONE", "CLOSED", "CONCLUIDA", "CONCLUÍDA", "CANCELLED", "CANCELED", "NOT_DONE"].includes(
    String(status || "").toUpperCase()
  );
}

function visitSummary(visit) {
  if (!visit) return null;
  return {
    id: visit.id,
    status: visit.status,
    plannedDate: visit.plannedDate || visit.date || visit.createdAt,
    client: visit.client ? { id: visit.client.id, name: visit.client.name } : null,
    pool: visit.pool ? {
      id: visit.pool.id,
      name: visit.pool.name,
      zone: visit.pool.zone,
      address: visit.pool.address || visit.pool.location,
      latitude: visit.pool.latitude,
      longitude: visit.pool.longitude,
    } : null,
  };
}

function actionTextForTechnician({ currentVisit, nextVisit, gpsActive }) {
  if (currentVisit) {
    return `Em servico: ${currentVisit.pool?.name || "piscina"} - ${currentVisit.client?.name || "cliente"}`;
  }
  if (nextVisit) {
    return `Proxima visita: ${nextVisit.pool?.name || "piscina"} - ${nextVisit.client?.name || "cliente"}`;
  }
  return gpsActive ? "GPS ativo sem visita em execucao" : "Sem GPS ativo neste momento";
}

function distanceMeters(a, b) {
  const R = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const aCalc =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
  return R * c;
}

function canSendArrivalAlert(client) {
  return client?.arrivalAllowed === true && client?.arrivalNotify === true;
}

function getTargetCoordinatesFromPool(pool) {
  for(const candidate of [pool,pool?.client]){
    const lat=toNumber(candidate?.latitude),lng=toNumber(candidate?.longitude);
    if(isValidCoordinate(lat,lng))return {lat,lng};
  }
  return null;
}

async function safeAuditTrail(data, db = prisma) {
  try {
    await db.auditTrail.create({
      data: {
        eventType: data.eventType || "GPS",
        entity: data.entity || null,
        entityId: data.entityId || null,
        userId: data.userId || null,
        technicianId: data.technicianId || null,
        clientId: data.clientId || null,
        poolId: data.poolId || null,
        visitId: data.visitId || null,
        vehicleId: data.vehicleId || null,
        action: data.action,
        message: data.message || null,
        metadata: data.metadata || undefined,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    });
  } catch (err) {
    logger.warn("Falha ao gravar AuditTrail GPS", err.message);
  }
}

async function registerTelemetry({ userId, technicianId, vehicleId, latitude, longitude, trackingMode, batteryLevel, accuracyM }) {
  const mode = trackingMode || "PASSIVE";

  await safeAuditTrail({
    eventType: "GPS_TELEMETRY",
    entity: "TechnicianLocation",
    userId,
    technicianId,
    vehicleId,
    action: `GPS_TELEMETRY_${mode}`,
    message: `Telemetria GPS recebida em modo ${mode}`,
    metadata: {
      trackingMode: mode,
      batteryLevel: batteryLevel ?? null,
      accuracyM: accuracyM ?? null,
      timestamp: new Date().toISOString(),
    },
    latitude,
    longitude,
  });
}

async function processGpsUpdate(payload={}, actor={}) {
  const role=normalizeRole(actor.role);
  if(!['ADMIN','TECHNICIAN','TEAM_LEADER'].includes(role))return {statusCode:403,body:{ok:false,success:false,message:'Sessão sem acesso ao GPS.'}};
  let technicianId=role==='ADMIN'?toNumber(payload.technicianDbId??payload.technicianId):toNumber(actor.technicianId||actor.id);
  let userId=role!=='ADMIN'&&actor.principalType==='USER'?toNumber(actor.userId||actor.id):null;
  if(role==='ADMIN'&&!technicianId&&Number.isSafeInteger(toNumber(payload.userId))&&Number(payload.userId)>0){
    const requested=Number(payload.userId),account=await prisma.user.findUnique({where:{id:requested}});
    if(account){
      const matches=account.active&&['TECHNICIAN','TEAM_LEADER'].includes(normalizeRole(account.role))&&account.email
        ? await prisma.technician.findMany({where:{email:account.email,active:true},take:2}):[];
      if(matches.length!==1)return {statusCode:409,body:{ok:false,success:false,message:'Conta sem ligação inequívoca. Indique technicianId.'}};
      technicianId=matches[0].id;userId=account.id;
    }else technicianId=requested;
  }
  if(!Number.isSafeInteger(technicianId)||technicianId<=0)return {statusCode:400,body:{ok:false,success:false,message:'Indique o técnico associado à localização.'}};
  if(role!=='ADMIN'){
    for(const key of ['technicianId','technicianDbId'])if(payload[key]!=null&&toNumber(payload[key])!==technicianId)return {statusCode:403,body:{ok:false,success:false,message:'Acesso apenas ao próprio GPS.'}};
    if(payload.userId!=null&&![technicianId,userId].filter(Boolean).includes(toNumber(payload.userId)))return {statusCode:403,body:{ok:false,success:false,message:'Conta GPS diferente da sessão.'}};
  }
  const technician=await prisma.technician.findUnique({where:{id:technicianId}});
  if(!technician?.active)return {statusCode:403,body:{ok:false,success:false,message:'Técnico indisponível.'}};
  const latitude=toNumber(payload.latitude),longitude=toNumber(payload.longitude);
  const accuracyM=toNumber(payload.accuracyM??payload.accuracy),batteryLevel=toNumber(payload.batteryLevel);
  if(!isValidCoordinate(latitude,longitude)||(accuracyM!==null&&(accuracyM<0||accuracyM>10000)))return {statusCode:400,body:{ok:false,success:false,message:'Leitura GPS inválida.'}};
  const now=new Date(),recordedAt=payload.recordedAt?new Date(payload.recordedAt):now;
  if(!Number.isFinite(recordedAt.getTime())||recordedAt.getTime()>now.getTime()+120000)return {statusCode:400,body:{ok:false,success:false,message:'Data da leitura GPS inválida.'}};
  if(now-recordedAt>5*60*1000)return {statusCode:200,body:{ok:true,success:true,ignored:true,code:'STALE_LOCATION',message:'Leitura antiga ignorada; envie uma localização atual.'}};
  const trackingMode=String(payload.trackingMode||payload.mode||'PASSIVE').slice(0,40);
  const saved=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`gps-technician:${technicianId}`}))::text`;
    const previous=await tx.technicianLocation.findFirst({where:{OR:[{technicianId},...(userId?[{userId}]:[])]},orderBy:{updatedAt:'desc'}});
    if(previous&&previous.updatedAt>=recordedAt)return false;
    const data={technicianId,userId,latitude,longitude,updatedAt:recordedAt};
    if(previous)await tx.technicianLocation.update({where:{id:previous.id},data});
    else await tx.technicianLocation.create({data});
    await tx.technicianTrack.create({data:{technicianId,userId,latitude,longitude,createdAt:recordedAt}});
    return true;
  });
  if(!saved)return {statusCode:200,body:{ok:true,success:true,ignored:true,code:'OLDER_LOCATION',message:'Já existe uma localização mais recente.'}};
  await registerTelemetry({userId,technicianId,vehicleId:technician.vehicleId||null,latitude,longitude,trackingMode,batteryLevel,accuracyM});
  if(global.io)global.io.emit('gps-update',{id:technicianId,technicianId,userId,name:technician.name,latitude,longitude,trackingMode,batteryLevel});
  let proximityDeferred=false;
  if(accuracyM!==null&&accuracyM<=100){try{await recordAssignedProximity({technicianId,latitude,longitude,now});}catch(_){proximityDeferred=true;logger.warn('Aviso de proximidade pendente; nova leitura voltará a tentar.');}}
  return {statusCode:200,body:{ok:true,success:true,proximityDeferred,message:'Telemetria GPS registada com sucesso.'}};
}

async function recordAssignedProximity({technicianId,latitude,longitude,now}){
  const due={OR:[{plannedDate:{gte:startOfDay(now),lte:endOfDay(now)}},{plannedDate:null,date:{gte:startOfDay(now),lte:endOfDay(now)}}]};
  const visits=await prisma.serviceVisit.findMany({where:{technicianId,endAt:null,status:{in:['PLANNED','SCHEDULED','ASSIGNED','PENDING','IN_PROGRESS','STARTED']},...due},select:{id:true},orderBy:{id:'asc'}});
  for(const candidate of visits)await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${candidate.id} FOR UPDATE`;
    const visit=await tx.serviceVisit.findFirst({where:{id:candidate.id,technicianId,endAt:null,status:{in:['PLANNED','SCHEDULED','ASSIGNED','PENDING','IN_PROGRESS','STARTED']},...due},include:{pool:{include:{client:true}}}});
    const pool=visit?.pool,client=pool?.client;
    if(!pool?.active||!client?.active||['PAUSED','PAUSA','INACTIVE','ARCHIVED'].includes(String(client.status).toUpperCase())||!canSendArrivalAlert(client))return;
    const target=getTargetCoordinatesFromPool(pool);if(!target||distanceMeters({lat:latitude,lng:longitude},target)>=ARRIVAL_RADIUS_METERS)return;
    const sourceKey=`gps-proximity:${candidate.id}:${technicianId}`;
    if(await tx.operationalReminder.findUnique({where:{sourceKey}}))return;
    await tx.notification.create({data:{clientId:client.id,role:'ADMIN',type:'ARRIVAL',eventType:'ARRIVAL_ALERT',title:'Proximidade da visita',message:`Localização recebida perto de ${pool.name||'piscina'}. A chegada ainda precisa de confirmação.`,status:'PENDING',metadata:{visitId:visit.id,poolId:pool.id,technicianId,confirmation:'GPS_PROXIMITY',arrivalConfirmed:false}}});
    await tx.operationalReminder.create({data:{sourceKey,title:'Proximidade GPS registada',dueDate:now,isCompleted:true,metadata:{visitId:visit.id,technicianId}}});
  });
}

async function validateGeofence({ visitId, currentLatitude, currentLongitude, actor }) {
  if (!Number.isSafeInteger(visitId) || visitId<=0 || !isValidCoordinate(currentLatitude, currentLongitude)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: "Parâmetros para validação de Geofencing insuficientes ou inválidos.",
      },
    };
  }

  const role=normalizeRole(actor?.role),technicianId=Number(actor?.technicianId||actor?.id);
  if(!['ADMIN','TECHNICIAN','TEAM_LEADER'].includes(role))return {statusCode:403,body:{success:false,error:'Sessão sem acesso à validação GPS.'}};
  return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${visitId} FOR UPDATE`;
  const visit = await tx.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      pool: { include: { client: true } },
    },
  });

  if (!visit) {
    return {
      statusCode: 404,
      body: { success: false, error: "Visita não encontrada." },
    };
  }

  if(role!=='ADMIN'&&visit.technicianId!==technicianId)return {statusCode:403,body:{success:false,error:'Visita atribuída a outro técnico.'}};
  if(visit.endAt||['DONE','COMPLETED','CLOSED','CONCLUIDA','CONCLUÍDA','CANCELLED','CANCELED','SKIPPED','ARCHIVED','NOT_DONE'].includes(String(visit.status).toUpperCase()))return {statusCode:409,body:{success:false,error:'A visita já foi concluída ou retirada.'}};
  const target = getTargetCoordinatesFromPool(visit.pool);

  if (!target) {
    await safeAuditTrail({
      eventType: "GPS_GEOFENCE",
      entity: "ServiceVisit",
      entityId: visitId,
      technicianId: visit.technicianId || null,
      clientId: visit.clientId || visit.pool?.clientId || null,
      poolId: visit.poolId || null,
      visitId,
      action: "GEOFENCE_TARGET_MISSING",
      message: `Visita ${visitId} sem coordenadas alvo configuradas na piscina ou cliente.`,
      latitude: currentLatitude,
      longitude: currentLongitude,
    }, tx);

    return {
      statusCode: 200,
      body: {
        success: true,
        inside: null,
        degradedMode: true,
        requiresManualConfirmation: true,
        message: "Sem coordenadas da piscina. Confirme o local no modo de campo; a presença GPS não foi validada.",
      },
    };
  }

  const distance = distanceMeters({ lat: currentLatitude, lng: currentLongitude }, target);
  const inside = distance <= GEOFENCE_RADIUS_METERS;

  await safeAuditTrail({
    eventType: "GPS_GEOFENCE",
    entity: "ServiceVisit",
    entityId: visitId,
    technicianId: visit.technicianId || null,
    clientId: visit.clientId || visit.pool?.clientId || null,
    poolId: visit.poolId || null,
    visitId,
    action: inside ? "GEOFENCE_SUCCESS" : "GEOFENCE_MISMATCH",
    message: inside
      ? `Presença validada dentro do raio operacional. Distância: ${distance.toFixed(2)}m.`
      : `Tentativa fora do raio operacional. Distância: ${distance.toFixed(2)}m.`,
    metadata: {
      distanceMeters: distance,
      radiusMeters: GEOFENCE_RADIUS_METERS,
      targetLatitude: target.lat,
      targetLongitude: target.lng,
    },
    latitude: currentLatitude,
    longitude: currentLongitude,
  }, tx);

  if (inside) {
    await tx.serviceVisit.update({
      where: { id: visitId },
      data: {
        status: visit.status === "PLANNED" ? "IN_PROGRESS" : visit.status,
        startAt: visit.startAt || new Date(),
      },
    });
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      inside,
      distance,
      radius: GEOFENCE_RADIUS_METERS,
      message: inside
        ? "Presença física confirmada dentro do raio operacional do cliente."
        : "Aviso: localização atual diverge do raio geométrico cadastrado na piscina/cliente.",
    },
  };
  });
}

async function getLiveLocations() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const locationLimit = 1000;
  const visitLimit = 2500;

  const [locations, technicians, visits] = await Promise.all([
    prisma.technicianLocation.findMany({
      include: { user: true, technician: true },
      orderBy: { updatedAt: "desc" },
      take: locationLimit,
    }),
    prisma.technician.findMany({
      where: { active: true, deletedAt: null },
      include: { vehicle: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
    prisma.serviceVisit.findMany({
      where: {
        OR: [
          { plannedDate: { gte: todayStart, lte: todayEnd } },
          { date: { gte: todayStart, lte: todayEnd } },
          { status: { in: ["IN_PROGRESS", "A_CAMINHO", "ON_ROUTE", "STARTED", "EM_EXECUCAO"] } },
        ],
      },
      include: { client: true, pool: true, technician: true },
      orderBy: [{ plannedDate: "asc" }, { date: "asc" }, { createdAt: "asc" }],
      take: visitLimit,
    }).catch(() => []),
  ]);

  const locationByTechId = new Map();
  const locationByUserEmail = new Map();
  const consumedLocationIds = new Set();

  for (const location of locations) {
    if (location.technicianId && !locationByTechId.has(location.technicianId)) {
      locationByTechId.set(location.technicianId, location);
    }
    if (location.user?.email && !locationByUserEmail.has(String(location.user.email).toLowerCase())) {
      locationByUserEmail.set(String(location.user.email).toLowerCase(), location);
    }
  }

  const visitsByTechnician = new Map();
  for (const visit of visits.filter((item) => openVisitStatus(item.status))) {
    if (!visit.technicianId) continue;
    const list = visitsByTechnician.get(visit.technicianId) || [];
    list.push(visit);
    visitsByTechnician.set(visit.technicianId, list);
  }

  const rows = technicians.map((technician) => {
    const location =
      locationByTechId.get(technician.id) ||
      (technician.email ? locationByUserEmail.get(String(technician.email).toLowerCase()) : null) ||
      null;

    if (location?.id) consumedLocationIds.add(location.id);

    const techVisits = visitsByTechnician.get(technician.id) || [];
    const currentVisit = techVisits.find((visit) => activeVisitStatus(visit.status)) || null;
    const nextVisit = techVisits.find((visit) => !activeVisitStatus(visit.status)) || null;
    const latitude = location?.latitude ?? null;
    const longitude = location?.longitude ?? null;
    const gpsActive = isValidCoordinate(Number(latitude), Number(longitude)) && isGpsFresh(location?.updatedAt);

    return {
      id: technician.id,
      userId: location?.userId || null,
      technicianId: technician.id,
      name: technician.name || location?.user?.name || "Tecnico",
      email: technician.email || location?.user?.email || null,
      phone: technician.phone || null,
      vehicle: technician.vehicle ? {
        id: technician.vehicle.id,
        plate: technician.vehicle.plate,
        name: technician.vehicle.name,
        status: technician.vehicle.status,
      } : null,
      latitude,
      longitude,
      updatedAt: location?.updatedAt || null,
      gpsActive,
      status: currentVisit ? "BUSY" : gpsActive ? "AVAILABLE" : "OFFLINE",
      currentVisit: visitSummary(currentVisit),
      nextVisit: visitSummary(nextVisit),
      actionText: actionTextForTechnician({
        currentVisit: visitSummary(currentVisit),
        nextVisit: visitSummary(nextVisit),
        gpsActive,
      }),
    };
  });

  for (const location of locations) {
    if (location.id && consumedLocationIds.has(location.id)) continue;
    const latitude = location.latitude ?? null;
    const longitude = location.longitude ?? null;
    const gpsActive = isValidCoordinate(Number(latitude), Number(longitude)) && isGpsFresh(location.updatedAt);
    rows.push({
      id: location.userId || location.technicianId,
      userId: location.userId || null,
      technicianId: location.technicianId || null,
      name: location.user?.name || location.technician?.name || "Tecnico",
      email: location.user?.email || null,
      phone: null,
      vehicle: null,
      latitude,
      longitude,
      updatedAt: location.updatedAt,
      gpsActive,
      status: gpsActive ? "AVAILABLE" : "OFFLINE",
      currentVisit: null,
      nextVisit: null,
      actionText: gpsActive ? "GPS ativo sem ficha de tecnico associada" : "Sem GPS ativo neste momento",
    });
  }

  return rows;
}

async function getLiveLegacyLocations() {
  const data = await prisma.technicianLocation.findMany({
    include: { user: true, technician: true },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  return data.map((t) => ({
    id: t.userId || t.technicianId,
    name: t.user?.name || t.technician?.name || "Técnico",
    latitude: t.latitude,
    longitude: t.longitude,
    updatedAt: t.updatedAt,
  }));
}

async function getHistoryById(id, options = {}) {
  const limit = clampLimit(options.limit, 1000, 50, 5000);
  const data = await prisma.technicianTrack.findMany({
    where: ['TECHNICIAN','TEAM_LEADER'].includes(normalizeRole(options.actor?.role))
      ? {OR:[{technicianId:Number(options.actor.technicianId||options.actor.id)},...(options.actor.principalType==='USER'?[{technicianId:null,userId:Number(options.actor.userId||options.actor.id)}]:[])]}
      : options.scope==='TECHNICIAN'?{technicianId:id}:{userId:id},
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return data;
}

module.exports = {
  processGpsUpdate,
  validateGeofence,
  getLiveLocations,
  getLiveLegacyLocations,
  getHistoryById,
};
