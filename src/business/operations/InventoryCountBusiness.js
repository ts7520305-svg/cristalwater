const repository=require('../../dal/EquipmentStockRepository');
async function count(user,body={}){
  if(!require('../../utils/roles').roleMatches(user?.role,'ADMIN'))return {ok:false,status:403,error:'Apenas a gestão pode reconciliar contagens'};
  const vehicleId=Number(body.vehicleId),physicalQuantity=Number(body.physicalQuantity),expectedQuantity=Number(body.expectedQuantity),productName=String(body.productName||'').trim(),unit=String(body.unit||'KG').trim();
  if(!Number.isSafeInteger(vehicleId)||vehicleId<=0||!productName||productName.length>160||!['number','string'].includes(typeof body.physicalQuantity)||!['number','string'].includes(typeof body.expectedQuantity)||String(body.physicalQuantity).trim()===''||String(body.expectedQuantity).trim()===''||!Number.isFinite(physicalQuantity)||physicalQuantity<0||!Number.isFinite(expectedQuantity)||expectedQuantity<0)return {ok:false,status:400,error:'Indique viatura, produto, contagem não negativa e expectedQuantity com o saldo consultado antes da contagem'};
  const requestId=body.requestId;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(requestId||'')))return {ok:false,status:400,error:'Identificador da contagem obrigatório'};
  const actor=`${user?.role}:${user?.id}`,fingerprint=JSON.stringify({vehicleId,productName,unit,physicalQuantity,expectedQuantity,actor});
  return repository.prisma.$transaction(async tx=>{
    const sourceKey=`stock-count:${requestId}`;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    const previous=await tx.operationalReminder.findUnique({where:{sourceKey}});
    if(previous){if(previous.metadata.fingerprint!==fingerprint)return {ok:false,status:409,error:'Identificador já utilizado com outra contagem'};return {...previous.metadata.result,idempotent:true};}
    if(!await tx.vehicle.findUnique({where:{id:vehicleId}}))return {ok:false,status:404,error:'Viatura não encontrada'};
    const key={scope:'VEHICLE',vehicleId,productName,unit},balance=await repository.lockBalance(tx,key),digitalQuantity=Number(balance?.quantity||0);
    if(digitalQuantity!==expectedQuantity)return {ok:false,status:409,error:'O stock mudou desde a consulta. Atualize e volte a confirmar a contagem'};
    const desvio=physicalQuantity-digitalQuantity;
    const updatedBalance=await repository.adjustBalance(tx,{...key,delta:desvio,category:balance?.category||'CHEMICAL'});
    const movement=await tx.stockMovement.create({data:{movementType:desvio===0?'AUDIT_COUNT_CONFIRMED':'AUDIT_COUNT_ADJUSTMENT',scopeFrom:'VEHICLE',scopeTo:'VEHICLE',vehicleId,productName,unit,quantity:desvio,category:balance?.category||'CHEMICAL',notes:`Contagem física: ${digitalQuantity} → ${physicalQuantity} ${unit}.`,createdBy:actor}});
    const result={ok:true,balance:updatedBalance,movement,digitalQuantity,physicalQuantity,desvio};
    await tx.operationalReminder.create({data:{sourceKey,title:'Contagem física registada',dueDate:new Date(),isCompleted:true,metadata:{fingerprint,result:JSON.parse(JSON.stringify(result))}}});return result;
  });
}
module.exports={count};
