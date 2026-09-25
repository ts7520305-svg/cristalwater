const {prisma}=require('../prismaClient');
const {normalizeRole}=require('../utils/roles');
module.exports=async(req,res,next)=>{
 if(!['TECHNICIAN','TEAM_LEADER'].includes(normalizeRole(req.user?.role)))return next();
 try{
  const technicianId=Number(req.user.technicianId||req.user.id);
  const technician=await prisma.technician.findUnique({where:{id:technicianId},select:{vehicleId:true}});
  const vehicleId=technician?.vehicleId;
  req.fieldVehicleId=vehicleId||-1;
  const body=req.body||{}, pathname=req.path;
  const ids=[];
  const vehicleMatch=pathname.match(/^\/(?:stock|transport\/latest|vehicles)\/(\d+)/);
  if(vehicleMatch)ids.push(Number(vehicleMatch[1]));
  for(const value of [req.query.vehicleId,body.vehicleId])if(value)ids.push(Number(value));
  const workMatch=pathname.match(/^\/work\/(\d+)/);
  const workId=Number(workMatch?.[1]||body.workGuideId||0);
  if(workId){const guide=await prisma.workGuide.findUnique({where:{id:workId},select:{vehicleId:true}});ids.push(guide?.vehicleId||-1);}
  const transportMatch=pathname.match(/^\/transport\/(\d+)/);
  const transportId=Number(transportMatch?.[1]||body.guideId||body.transportGuideId||0);
  if(transportId){const guide=await prisma.transportGuide.findUnique({where:{id:transportId},select:{vehicleId:true}});ids.push(guide?.vehicleId||-1);}
  const maintenanceMatch=pathname.match(/^\/maintenance\/(\d+)/);
  if(maintenanceMatch){const row=await prisma.vehicleMaintenanceRecord.findUnique({where:{id:Number(maintenanceMatch[1])},select:{vehicleId:true}});ids.push(row?.vehicleId||-1);}
  if(ids.some(id=>!vehicleId||id!==vehicleId))return res.status(403).json({ok:false,error:'Acesso apenas à viatura atribuída ao técnico.'});
  if(body.visitId){const visit=await prisma.serviceVisit.findUnique({where:{id:Number(body.visitId)},select:{technicianId:true}});if(!visit||visit.technicianId!==technicianId)return res.status(403).json({ok:false,error:'Visita de outro técnico.'});}
  req.query.vehicleId=String(vehicleId||-1);req.query.technicianId=String(technicianId);
  if(req.method!=='GET'){req.body={...body,technicianId,vehicleId:vehicleId||undefined};}
  next();
 }catch(error){next(error)}
};
