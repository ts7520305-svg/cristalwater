const lifecycle=require('./incompleteVisitLifecycle');
// Called inside the assignment transaction, after locking/updating the visit.
async function requestReceipt(tx,visit,requestId,source){
  if(!visit.technicianId)return null;
  const visitType=visit.visitType==='EXTRA'?'EXTRA':'REGULAR';
  const sourceKey=lifecycle.prefix(visitType,visit.id,'visit-receipt')+requestId;
  const existing=await tx.operationalReminder.findUnique({where:{sourceKey}});
  if(existing)return existing;
  await tx.operationalReminder.updateMany({where:{sourceKey:{startsWith:lifecycle.prefix(visitType,visit.id,'visit-receipt')},isCompleted:false},data:{isCompleted:true}});
  return tx.operationalReminder.create({data:{sourceKey,title:`Confirmar receção da visita #${visit.id}`,poolId:visit.poolId,assignedToTechnicianId:visit.technicianId,dueDate:new Date(),metadata:{visitId:visit.id,visitType,requestId,source,assignedAt:new Date().toISOString(),state:'PENDING'}}});
}
async function escalatePending(tx,now=new Date()){
  let rows=await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:'visit-receipt:'},isCompleted:false}});
  const refs=[...new Map(rows.map(row=>[lifecycle.key(lifecycle.type(row.metadata),row.metadata.visitId),row.metadata])).values()].sort((a,b)=>lifecycle.type(a).localeCompare(lifecycle.type(b))||a.visitId-b.visitId);
  for(const ref of refs)await lifecycle.lock(tx,lifecycle.type(ref),ref.visitId);
  rows=await tx.operationalReminder.findMany({where:{id:{in:rows.map(row=>row.id)},isCompleted:false}});
  const visits=await lifecycle.collect(tx,rows);
  const today=new Date(now);today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const pendingIds=[];
  for(const row of rows){
    const visit=visits.get(lifecycle.key(lifecycle.type(row.metadata),row.metadata.visitId));
    if(!visit||visit.endAt||visit.technicianId!==row.assignedToTechnicianId||['DONE','COMPLETED','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(visit.status)){
      await tx.operationalReminder.update({where:{id:row.id},data:{isCompleted:true}});continue;
    }
    if(visit.plannedDate&&visit.plannedDate>=tomorrow)continue;
    const assignedAt=new Date(row.metadata.assignedAt).getTime();
    if(!Number.isFinite(assignedAt)||now.getTime()-assignedAt<30*60*1000)continue;
    pendingIds.push(row.id);
    const where={eventType:'VISIT_RECEIPT_PENDING',role:'ADMIN',metadata:{path:['receiptId'],equals:row.id}};
    const existing=await tx.notification.findFirst({where});
    const data={role:'ADMIN',type:'VISIT_ALERT',eventType:'VISIT_RECEIPT_PENDING',status:'PENDING',severity:'WARNING',title:`Receção da visita #${visit.id} por confirmar`,message:'O técnico ainda não confirmou a receção. Verifique as Rondas e contacte-o antes de assumir que recebeu o trabalho.',metadata:{receiptId:row.id,visitId:visit.id,visitType:lifecycle.type(row.metadata),technicianId:visit.technicianId,href:'/admin-rounds#coveragePanel'}};
    if(existing)await tx.notification.update({where:{id:existing.id},data});else await tx.notification.create({data});
  }
  await tx.notification.updateMany({where:{eventType:'VISIT_RECEIPT_PENDING',role:'ADMIN',status:'PENDING',...(pendingIds.length?{NOT:{OR:pendingIds.map(id=>({metadata:{path:['receiptId'],equals:id}}))}}:{})},data:{status:'RESOLVED'}});
  return pendingIds.length;
}
module.exports={requestReceipt,escalatePending};
