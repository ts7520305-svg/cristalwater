'use strict';
module.exports=async(prisma,label)=>{
 const f=await require('./transport-guide-document-fixture')(prisma,label),cleanup=f.cleanup,v=f.vehicles[0],own=f.works[0],other=f.works[1];
 await prisma.technician.update({where:{id:f.technicians[1].id},data:{vehicleId:v.id}});await prisma.workGuide.update({where:{id:other.id},data:{vehicleId:v.id,guideId:f.transport.id,notes:'FOREIGN_WORK_PRIVATE'}});
 await prisma.vehicle.update({where:{id:v.id},data:{notes:'ADMIN_VEHICLE_PRIVATE'}});await prisma.technician.update({where:{id:f.technicians[0].id},data:{phone:'PRIVATE_PHONE'}});
 await prisma.vehicleMaintenanceRecord.update({where:{id:f.maintenance.id},data:{type:'INSURANCE',status:'ACTIVE',notes:'{"cost":987,"phone":"PRIVATE_INSURANCE"}',dueDate:new Date(Date.now()+86400000*30)}});
 await prisma.transportGuide.update({where:{id:f.transport.id},data:{validUntil:new Date(Date.now()+86400000*30)}});
 await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:v.id,type:'INSPECTION',title:'Inspection',status:'ACTIVE',cost:91,notes:'{\"cost\":91}',dueDate:new Date(Date.now()+86400000*30)}});
 const value=JSON.parse(f.old.value);value.private={cost:991,email:'PRIVATE_POINTER'};await prisma.systemSetting.update({where:{id:f.old.id},data:{value:JSON.stringify(value)}});
 f.moves=[];for(const [work,tech,visit,name]of [[own,f.technicians[0],f.visits[0],'OWN_MOVE'],[other,f.technicians[1],f.visits[1],'FOREIGN_MOVE']])f.moves.push(await prisma.vehicleStockMovement.create({data:{vehicleId:v.id,technicianId:tech.id,workGuideId:work.id,transportGuideId:f.transport.id,visitId:visit.id,itemName:name,unit:' KG ',quantity:-0.25,movementType:'CONSUMPTION',source:'QA',notes:JSON.stringify({cwGuideMovement:true,userNotes:' Exact movement ',poolName:'Pool',readings:{ph:0,cost:999},private:{email:'PRIVATE_META'},cost:888})}}));
 f.moves.push(await prisma.vehicleStockMovement.create({data:{vehicleId:v.id,technicianId:null,workGuideId:own.id,itemName:'OWN_LEGACY',quantity:0,movementType:'LOAD'}}));
 f.cleanup=async()=>{await prisma.vehicleStockMovement.deleteMany({where:{vehicleId:{in:f.vehicles.map(v=>v.id)}}});await cleanup();};return f;
};
