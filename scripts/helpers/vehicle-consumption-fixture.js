'use strict';
const {randomUUID}=require('node:crypto');
module.exports=async function fixture(prisma,label){
 const marker='QA consume '+label+' '+randomUUID(),vehicles=[],technicians=[],users=[],works=[],visits=[];
 for(const role of ['TECHNICIAN','TEAM_LEADER']){
  const vehicle=await prisma.vehicle.create({data:{plate:'QC-'+randomUUID(),name:marker,status:'ACTIVE'}});vehicles.push(vehicle);
  const email=randomUUID()+'@qa.test',tech=await prisma.technician.create({data:{name:marker+' '+role,email,role,vehicleId:vehicle.id,pin:'secret-pin',hourlyCost:33.75}});technicians.push(tech);
  users.push(await prisma.user.create({data:{email,name:marker,role,password:'unused',active:true}}));
 }
 const client=await prisma.client.create({data:{name:marker,email:'private-contact@qa.test',phone:'PRIVATE_PHONE',monthlyFee:997}}),pool=await prisma.pool.create({data:{name:marker,clientId:client.id,monthlyAmount:331}});
 const transport=await prisma.transportGuide.create({data:{vehicleId:vehicles[0].id,codeAT:'QA-'+randomUUID(),status:'ACTIVE',notes:'Official original',items:{create:{name:'Salt',unit:'KG',quantity:20}}},include:{items:true}});
 for(let i=0;i<2;i++){
  works.push(await prisma.workGuide.create({data:{vehicleId:vehicles[i].id,technicianId:technicians[i].id,guideId:i===0?transport.id:null,status:'OPEN',isDraft:i!==0,notes:'Preserve work note',items:{create:[{name:marker+' <img src=x onerror=alert(1)>',unit:'KG',quantity:20,usedQty:0,initialQty:20},{name:marker+' <img src=x onerror=alert(1)>',unit:'L',quantity:10,usedQty:0,initialQty:10}]}},include:{items:{orderBy:{id:'asc'}}}}));
  visits.push(await prisma.serviceVisit.create({data:{technicianId:technicians[i].id,clientId:client.id,poolId:pool.id,status:'PLANNED',notes:'Preserve visit data'}}));
 }
 const maintenance=await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:vehicles[0].id,title:marker,cost:75.12}});
 async function cleanup(requests=[]){
  const workIds=works.map(w=>w.id),itemIds=works.flatMap(w=>w.items.map(i=>String(i.id))),ids=vehicles.map(v=>v.id);
  await prisma.fieldWriteRequest.deleteMany({where:{scope:'VEHICLE_MANUAL_CONSUMPTION',OR:[{resourceId:{in:workIds}},{requestId:{in:requests}}]}});
  await prisma.userAuditLog.deleteMany({where:{OR:[{action:'VEHICLE_MANUAL_CONSUMPTION',entityId:{in:itemIds}},{action:'VEHICLE_CONSUMPTION_CANCELLED',entityId:{in:requests}}]}});
  await prisma.stockMovement.deleteMany({where:{vehicleId:{in:ids}}});await prisma.vehicleStockMovement.deleteMany({where:{vehicleId:{in:ids}}});
  await prisma.vehicleMaintenanceRecord.deleteMany({where:{vehicleId:{in:ids}}});await prisma.workGuide.deleteMany({where:{vehicleId:{in:ids}}});await prisma.transportGuide.deleteMany({where:{vehicleId:{in:ids}}});
  await prisma.serviceVisit.deleteMany({where:{id:{in:visits.map(v=>v.id)}}});await prisma.pool.delete({where:{id:pool.id}});await prisma.client.delete({where:{id:client.id}});
  await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});await prisma.technician.deleteMany({where:{id:{in:technicians.map(t=>t.id)}}});await prisma.vehicle.deleteMany({where:{id:{in:ids}}});
 }
 return {marker,vehicles,technicians,users,works,visits,client,pool,transport,maintenance,cleanup};
};
