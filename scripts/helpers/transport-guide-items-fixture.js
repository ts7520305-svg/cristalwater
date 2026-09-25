'use strict';
module.exports=async(prisma,label)=>{
 const f=await require('./vehicle-consumption-fixture')(prisma,label),work=f.works[0];
 await prisma.transportGuideItem.update({where:{id:f.transport.items[0].id},data:{name:work.items[0].name,type:work.items[0].type,unit:work.items[0].unit,quantity:20}});
 await prisma.transportGuideItem.create({data:{guideId:f.transport.id,name:work.items[1].name,type:work.items[1].type,unit:work.items[1].unit,quantity:10}});
 await prisma.workGuideItem.update({where:{id:work.items[0].id},data:{quantity:17.75,usedQty:2.25}});
 return f;
};
