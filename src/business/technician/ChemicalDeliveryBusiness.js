const {prisma}=require('../../prismaClient');
const {normalizeRole}=require('../../utils/roles');
const needs=require('./IncompleteVisitBusiness');
const fail=(statusCode,message)=>{throw Object.assign(new Error(message),{statusCode});};
const norm=value=>String(value||'').trim().replace(/\s+/g,' ').toUpperCase();
function technician(user){if(normalizeRole(user?.role)!=='TECHNICIAN')fail(403,'A receção deve ser confirmada pelo técnico responsável');return Number(user.technicianId||user.id);}
async function context(user,id,db=prisma){
  const technicianId=technician(user);
  const row=(await needs.shortages(user,db)).rows.find(row=>row.shortageId===Number(id));
  if(!row)fail(409,'Necessidade alterada ou já não atribuída a si. Atualize a lista.');
  const tech=await db.technician.findUnique({where:{id:technicianId},include:{vehicle:true}});
  if(!tech?.active||!tech.vehicle?.active||tech.vehicle.deletedAt||tech.vehicle.archiveStatus!=='ATIVO')fail(409,'Confirme a viatura atribuída com a gestão');
  return {row,tech};
}
async function linkedNeeds(db,vehicleId){return new Map((await require('../../services/stockPreparationService').forVehicle(db,vehicleId)).map(m=>[m.id,m]));}
async function options(user,id){
  const {row,tech}=await context(user,id);
  const movements=await prisma.stockMovement.findMany({where:{vehicleId:tech.vehicleId,movementType:'TRANSFER_TO_VEHICLE',scopeTo:'VEHICLE',createdAt:{gte:new Date(row.reportedAt)}},orderBy:{id:'desc'},take:100});
  const receipts=movements.length?await prisma.operationalReminder.findMany({where:{sourceKey:{startsWith:'chemical-delivery:'},OR:movements.map(m=>({metadata:{path:['movementId'],equals:m.id}}))},select:{metadata:true}}):[];
  const links=await linkedNeeds(prisma,tech.vehicleId);
  return {ok:true,rows:movements.filter(m=>(!links.has(m.id)||links.get(m.id).shortageId===row.shortageId)&&norm(m.productName)===norm(row.productName)&&norm(m.unit)===norm(row.unit)).map(m=>({id:m.id,createdAt:m.createdAt,quantity:m.quantity,available:Math.max(0,(links.get(m.id)?.quantity??m.quantity)-receipts.filter(r=>r.metadata?.movementId===m.id).reduce((n,r)=>n+Number(r.metadata.quantity||0),0)),unit:m.unit})).filter(m=>m.available>0)};
}
async function confirm(user,id,body={}){
  const technicianId=technician(user),shortageId=Number(id),movementId=Number(body.movementId),quantity=Number(body.quantity);
  if(!Number.isSafeInteger(shortageId)||shortageId<=0||!Number.isSafeInteger(movementId)||movementId<=0||!['number','string'].includes(typeof body.quantity)||!Number.isFinite(quantity)||quantity<=0||quantity>100000||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.requestId||'')))fail(400,'Indique movimento, quantidade positiva e identificador válido');
  const sourceKey=`chemical-delivery:${body.requestId}`,fingerprint=JSON.stringify({technicianId,shortageId,movementId,quantity});
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    const previous=await tx.operationalReminder.findUnique({where:{sourceKey}});
    if(previous){if(previous.metadata.fingerprint!==fingerprint)fail(409,'Identificador já utilizado com outros dados');return {ok:true,idempotent:true,receipt:previous.metadata};}
    await tx.$queryRaw`SELECT id FROM "StockMovement" WHERE id=${movementId} FOR UPDATE`;
    const initial=await context(user,shortageId,tx);
    for(const visitId of [...new Set([initial.row.reportedVisitId,initial.row.visitId])].sort((a,b)=>a-b))await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${visitId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Technician" WHERE id=${technicianId} FOR UPDATE`;
    const {row,tech}=await context(user,shortageId,tx);
    if(row.visitId!==initial.row.visitId)fail(409,'A visita foi reatribuída. Atualize a lista.');
    const movement=await tx.stockMovement.findUnique({where:{id:movementId}});
    if(!movement||movement.movementType!=='TRANSFER_TO_VEHICLE'||movement.scopeTo!=='VEHICLE'||movement.vehicleId!==tech.vehicleId||norm(movement.productName)!==norm(row.productName)||norm(movement.unit)!==norm(row.unit)||movement.createdAt<new Date(row.reportedAt))fail(409,'O movimento não corresponde a esta necessidade e viatura');
    const links=await linkedNeeds(tx,tech.vehicleId);
    if(links.has(movementId)&&links.get(movementId).shortageId!==shortageId)fail(409,'Esta carga está associada a outra necessidade');
    const receipts=await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:'chemical-delivery:'},metadata:{path:['movementId'],equals:movementId}},select:{metadata:true}});
    const allocated=receipts.filter(r=>r.metadata?.movementId===movementId).reduce((n,r)=>n+Number(r.metadata.quantity||0),0);
    if(quantity>(links.get(movementId)?.quantity??movement.quantity)-allocated||row.quantity!==null&&quantity>row.quantity-row.receivedQuantity)fail(409,'Quantidade superior à entrega disponível ou à necessidade por receber');
    const metadata={fingerprint,shortageId,visitId:row.visitId,movementId,vehicleId:tech.vehicleId,productName:row.productName,unit:row.unit,quantity,receivedBy:technicianId,receivedByName:tech.name,receivedAt:new Date().toISOString(),transferredBy:movement.createdBy};
    await tx.operationalReminder.create({data:{sourceKey,title:'Receção de química confirmada',dueDate:new Date(),isCompleted:true,assignedToTechnicianId:technicianId,metadata}});
    return {ok:true,receipt:metadata};
  });
}
module.exports={options,confirm};
