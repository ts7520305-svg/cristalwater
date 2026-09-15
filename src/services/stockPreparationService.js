// Historical loads remain immutable; linked returns reduce their outstanding quantity.
function reconcile(rows){
  const returned=new Map();
  for(const row of rows){const m=row.metadata;if(m?.returnOfMovementId)returned.set(m.returnOfMovementId,(returned.get(m.returnOfMovementId)||0)+Number(m.returnQuantity||0));}
  return rows.filter(row=>row.metadata?.shortageId&&!row.metadata.returnOfMovementId).flatMap(row=>(row.metadata.movements||[]).filter(m=>m.movementType==='TRANSFER_TO_VEHICLE').map(m=>({...m,shortageId:row.metadata.shortageId,technicianId:row.metadata.technicianId,vehicleId:row.metadata.vehicleId,originalQuantity:Number(m.quantity),returnedQuantity:returned.get(m.id)||0,quantity:Math.max(0,Number(m.quantity)-(returned.get(m.id)||0))})));
}
async function forVehicle(db,vehicleId){return reconcile(await db.operationalReminder.findMany({where:{sourceKey:{startsWith:'stock-transfer:'},metadata:{path:['vehicleId'],equals:vehicleId}},select:{metadata:true}}));}
module.exports={reconcile,forVehicle};
