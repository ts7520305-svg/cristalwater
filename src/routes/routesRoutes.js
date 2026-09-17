"use strict";
const router = require('express').Router();
const { prisma } = require('../prismaClient');
const { parseLocalDay } = require('../utils/serviceVisitFilters');

// Legacy URL, explicit read-only contract. Scheduling and assignment remain in
// the rounds workflow; this endpoint never manufactures work from the pool list.
async function plannedWork(query = {}) {
  const requested = query.date;
  if (requested !== undefined && (typeof requested !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(requested))) throw Object.assign(Error('Data inválida.'), { status:400 });
  const { start, end, isoDate } = parseLocalDay(requested);
  if (requested !== undefined && isoDate !== requested) throw Object.assign(Error('Data inválida.'), { status:400 });
  const include = {
    technician:{select:{id:true,name:true,active:true}},
    client:{select:{id:true,name:true}},
    pool:{select:{id:true,name:true,active:true,latitude:true,longitude:true}}
  };
  const [regular, extras] = await prisma.$transaction([
    prisma.serviceVisit.findMany({where:{status:'PLANNED',startAt:null,endAt:null,OR:[{plannedDate:{gte:start,lt:end}},{plannedDate:null,date:{gte:start,lt:end}}]},include}),
    prisma.extraVisit.findMany({where:{status:'PLANNED',startAt:null,endAt:null,scheduledAt:{gte:start,lt:end}},include})
  ], { isolationLevel:'RepeatableRead' });
  const tasks = [
    ...regular.map(v=>({...v,kind:'REGULAR',scheduledAt:v.plannedDate || v.date,dateBasis:v.plannedDate?'PLANNED_DATE':'LEGACY_DATE'})),
    ...extras.map(v=>({...v,kind:'EXTRA',dateBasis:'SCHEDULED_AT'}))
  ].sort((a,b)=>a.scheduledAt-b.scheduledAt || a.kind.localeCompare(b.kind) || a.id-b.id);
  const plans = new Map();
  for (const visit of tasks) {
    const id = visit.technician?.id ?? null;
    if (!plans.has(id)) plans.set(id, {technician:visit.technician || {id:null,name:'Sem técnico atribuído',active:null},route:[]});
    plans.get(id).route.push({
      id:visit.kind+':'+visit.id,visitId:visit.id,type:visit.kind,technicianId:id,
      status:visit.status,startAt:null,endAt:null,scheduledAt:visit.scheduledAt,dateBasis:visit.dateBasis,
      pool:visit.pool,client:visit.client,profit:null,estimatedMinutes:null
    });
  }
  const located = pool => typeof pool?.latitude === 'number' && Number.isFinite(pool.latitude) && Math.abs(pool.latitude)<=90 && typeof pool.longitude === 'number' && Number.isFinite(pool.longitude) && Math.abs(pool.longitude)<=180;
  for (const plan of plans.values()) plan.analytics={
    visits:plan.route.length,regular:plan.route.filter(v=>v.type==='REGULAR').length,extras:plan.route.filter(v=>v.type==='EXTRA').length,
    missingCoordinates:plan.route.filter(v=>!located(v.pool)).length,totalMinutes:null,overloaded:null,profit:null
  };
  return {ok:true,reportVersion:1,mode:'assigned-work-preview',date:isoDate,dayBasis:'SERVER_LOCAL_CIVIL_DAY',complete:true,total:tasks.length,returned:tasks.length,readOnly:true,plans:[...plans.values()]};
}

router.get('/auto-plan', async (req,res)=>{
  res.set('Cache-Control','private, no-store');
  try { res.json(await plannedWork(req.query)); }
  catch(error) { res.status(error.status || 500).json({ok:false,error:error.status?error.message:'Não foi possível consultar o trabalho planeado.'}); }
});

// The old userId name referred to two different tables. The value now always
// identifies Technician, matching actual visit assignments and /api/technicians.
router.get('/today/:technicianId', async (req,res)=>{
  res.set('Cache-Control','private, no-store');
  try {
    const id=Number(req.params.technicianId);
    if (!/^[1-9]\d*$/.test(req.params.technicianId) || !Number.isSafeInteger(id)) return res.status(400).json({ok:false,error:'Técnico inválido.'});
    const technician=await prisma.technician.findUnique({where:{id},select:{id:true,name:true,active:true}});
    if (!technician) return res.status(404).json({ok:false,error:'Técnico não encontrado.'});
    const data=await plannedWork(req.query),plan=data.plans.find(p=>p.technician.id===id);
    res.json({...data,plans:undefined,technicianId:id,technician,total:plan?.route.length || 0,returned:plan?.route.length || 0,route:plan?.route || [],analytics:plan?.analytics || {visits:0,regular:0,extras:0,missingCoordinates:0,totalMinutes:null,overloaded:null,profit:null}});
  } catch(error) { res.status(error.status || 500).json({ok:false,error:error.status?error.message:'Não foi possível consultar o trabalho planeado.'}); }
});
module.exports=router;
