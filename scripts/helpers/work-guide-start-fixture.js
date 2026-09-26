'use strict';
module.exports=async(prisma,label)=>{
 const f=await require('./transport-guide-document-fixture')(prisma,label),cleanup=f.cleanup;
 // Preserve the two existing works; use separate fresh vehicles for opening.
 f.fresh=[];
 for(let i=0;i<2;i++){const vehicle=await prisma.vehicle.create({data:{plate:'START-'+require('node:crypto').randomUUID(),name:f.marker}});f.vehicles.push(vehicle);await prisma.technician.update({where:{id:f.technicians[i].id},data:{vehicleId:vehicle.id}});f.fresh.push(vehicle);}
 f.cleanup=async()=>{const ids=f.vehicles.map(v=>v.id),requests=await prisma.fieldWriteRequest.findMany({where:{scope:'WORK_GUIDE_START',resourceId:{in:ids}},select:{requestId:true}}),works=await prisma.workGuide.findMany({where:{vehicleId:{in:ids}},select:{id:true}});await prisma.fieldWriteRequest.deleteMany({where:{scope:'WORK_GUIDE_START',resourceId:{in:ids}}});await prisma.userAuditLog.deleteMany({where:{OR:[{action:'WORK_GUIDE_START',entityId:{in:works.map(w=>String(w.id))}},{action:'WORK_GUIDE_START_CANCELLED',entityId:{in:requests.map(r=>r.requestId)}}]}});await prisma.operationalLock.deleteMany({where:{lockType:'MISSING_TRANSPORT_GUIDE',vehicleId:{in:ids}}});const notifications=await prisma.notification.findMany({where:{eventType:'TRANSPORT_GUIDE_MISSING'},select:{id:true,metadata:true}});await prisma.notification.deleteMany({where:{id:{in:notifications.filter(n=>ids.includes(n.metadata?.vehicleId)).map(n=>n.id)}}});await prisma.systemSetting.deleteMany({where:{key:{in:ids.map(id=>'vehicle_preset_'+id)}}});await cleanup();};
 return f;
};
