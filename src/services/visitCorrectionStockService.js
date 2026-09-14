const {VisitCompletionError}=require('./serviceVisitCompletionService');
const normalize=value=>String(value||'').trim().toLowerCase();
function totals(products){
 const result=new Map();
 for(const product of products||[]){const key=normalize(product.name);const row=result.get(key)||{...product,quantity:0};row.quantity+=Number(product.quantity);result.set(key,row)}
 return result;
}
async function reconcile(tx,visit,products){
 const previous=totals(await tx.chemicalUsage.findMany({where:{visitId:visit.id}}));
 const desired=totals(products);
 const movements=await tx.vehicleStockMovement.findMany({where:{visitId:visit.id,workGuideId:{not:null},movementType:'CONSUMPTION'},orderBy:{id:'asc'}});
 for(const key of new Set([...previous.keys(),...desired.keys()])){
  const before=previous.get(key),after=desired.get(key);
  const delta=Number(((after?.quantity||0)-(before?.quantity||0)).toFixed(6));
  if(!delta)continue;
  let evidence=movements.find(row=>normalize(row.itemName)===key)||movements[0];
  if(!evidence && previous.size===0){
   const technician=await tx.technician.findUnique({where:{id:visit.technicianId},select:{vehicleId:true}});
   const initialGuide=technician?.vehicleId ? await tx.workGuide.findFirst({where:{vehicleId:technician.vehicleId,technicianId:visit.technicianId,status:'OPEN'},orderBy:{createdAt:'desc'}}) : null;
   if(initialGuide)evidence={workGuideId:initialGuide.id};
  }
  if(!evidence)throw new VisitCompletionError(409,'STOCK_CORRECTION_REVIEW','Esta visita não tem guia de consumo identificada. A gestão deve reconciliar os produtos antes da correção.');
  const guide=await tx.workGuide.findUnique({where:{id:evidence.workGuideId}});
  if(!guide||guide.status!=='OPEN')throw new VisitCompletionError(409,'STOCK_GUIDE_CLOSED','A guia original está encerrada. A gestão deve reconciliar o stock antes da correção.');
  const items=await tx.workGuideItem.findMany({where:{workGuideId:guide.id}});
  const item=items.find(row=>normalize(row.name)===key);
  if(!item)throw new VisitCompletionError(409,'STOCK_ITEM_MISSING','Produto inexistente na guia original.');
  if(after?.unit&&normalize(after.unit)!==normalize(item.unit))throw new VisitCompletionError(409,'STOCK_UNIT_MISMATCH','Use a unidade da guia original para corrigir a quantidade.');
  const changed=await tx.workGuideItem.updateMany({where:{id:item.id,...(delta>0?{quantity:{gte:delta}}:{usedQty:{gte:-delta}})},data:{quantity:{decrement:delta},usedQty:{increment:delta}}});
  if(changed.count!==1)throw new VisitCompletionError(409,'STOCK_CORRECTION_INSUFFICIENT','Saldo insuficiente para corrigir os produtos.');
  const movementType=delta>0?'CONSUMPTION':'RETURN',quantity=Math.abs(delta),notes=`Correção de produtos na visita ${visit.id}`;
  await tx.vehicleStockMovement.create({data:{vehicleId:guide.vehicleId,transportGuideId:guide.guideId,workGuideId:guide.id,visitId:visit.id,technicianId:visit.technicianId,itemName:item.name,itemType:item.type,unit:item.unit,quantity,movementType,source:'VISIT_CORRECTION',notes}});
  await tx.stockMovement.create({data:{vehicleId:guide.vehicleId,transportGuideId:guide.guideId,workGuideId:guide.id,visitId:visit.id,technicianId:visit.technicianId,productName:item.name,category:item.type,unit:item.unit||'KG',quantity,movementType,...(delta>0?{scopeFrom:'VEHICLE'}:{scopeTo:'VEHICLE'}),createdBy:'TECHNICIAN_FIELD_CORRECTION',notes}});
 }
}
module.exports={reconcile};
