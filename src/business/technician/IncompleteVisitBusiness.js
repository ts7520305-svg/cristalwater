const {prisma}=require('../../prismaClient');
const {normalizeRole}=require('../../utils/roles');
const reasons={ACCESS_BLOCKED:'Acesso impedido',NO_KEY:'Chave indisponível ou incorreta',CLIENT_REFUSED:'Cliente impediu o serviço',CHEMICAL_MISSING:'Falta de produtos químicos',MATERIAL_MISSING:'Falta de material',EQUIPMENT_FAILURE:'Equipamento avariado',WEATHER:'Condições meteorológicas',OTHER:'Outro motivo'};
function fail(statusCode,message){throw Object.assign(new Error(message),{statusCode});}
async function report(user,value,body={}){
  const id=Number(value),technicianId=Number(user?.technicianId||user?.id||0),role=normalizeRole(user?.role);
  if(!Number.isSafeInteger(id)||id<=0)fail(400,'Visita inválida');
  if(!Object.hasOwn(reasons,body.reason)||typeof body.nextStep!=='string'||body.nextStep.trim().length<5||body.nextStep.length>1000)fail(400,'Escolha um motivo e indique o próximo passo (5–1000 caracteres)');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.requestId||'')))fail(400,'Identificador do registo inválido');
  let chemicalShortage=null;
  if(body.reason==='CHEMICAL_MISSING'){
    const rawProduct=body.chemicalShortage?.productName,raw=body.chemicalShortage?.quantity;
    if(typeof rawProduct!=='string'||typeof body.chemicalShortage?.unit!=='string'||raw!==null&&raw!==undefined&&!['number','string'].includes(typeof raw))fail(400,'Produto, unidade e quantidade inválidos');
    const productName=rawProduct.trim();
    const quantity=raw===null||raw===undefined||raw===''?null:Number(String(raw).replace(',','.'));
    const unit=String(body.chemicalShortage?.unit||'').toUpperCase();
    if(productName.length<2||productName.length>120||!['L','KG','UN'].includes(unit)||(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>100000)))fail(400,'Indique o produto em falta e uma quantidade positiva, ou deixe a quantidade por confirmar');
    chemicalShortage={productName,quantity,unit};
  }
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${id} FOR UPDATE`;
    const current=await tx.serviceVisit.findUnique({where:{id},include:{pool:{select:{name:true}}}});
    if(!current)fail(404,'Visita não encontrada');
    if(role!=='ADMIN'&&(role!=='TECHNICIAN'||current.technicianId!==technicianId))fail(403,'A visita não está atribuída a este técnico');
    const sourceKey=`incomplete:${id}:${body.requestId}`;
    const existing=await tx.operationalReminder.findUnique({where:{sourceKey}});
    if(existing){
      const saved=existing.metadata||{};
      const same=saved.reportedBy===technicianId&&saved.reportedByRole===role&&saved.reason===body.reason&&saved.nextStep===body.nextStep.trim()&&(chemicalShortage ? saved.chemicalShortage?.productName===chemicalShortage.productName&&saved.chemicalShortage?.quantity===chemicalShortage.quantity&&saved.chemicalShortage?.unit===chemicalShortage.unit : !saved.chemicalShortage);
      if(!same)fail(409,'Este identificador já foi utilizado com outros dados. Atualize o registo antes de enviar uma alteração.');
      return {ok:true,visit:current,reminder:existing,idempotent:true};
    }
    if(current.endAt||['DONE','COMPLETED','CONCLUIDA','CANCELLED','CANCELED','ARCHIVED'].includes(String(current.status).toUpperCase()))fail(409,'A visita já foi concluída ou retirada. Confirme com o escritório');
    const previous=await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:`incomplete:${id}:`}}});
    const returns=previous.map(row=>row.metadata?.returnPlan?.visitId).filter(Number.isSafeInteger);
    if(returns.length&&await tx.serviceVisit.findFirst({where:{id:{in:returns},status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}}}))fail(409,'Já existe um regresso. Registe o novo impedimento na visita de regresso');
    const nextStep=body.nextStep.trim(),now=new Date(),label=reasons[body.reason];
    const shortageText=chemicalShortage?` Produto: ${chemicalShortage.productName}. Quantidade: ${chemicalShortage.quantity===null?'por confirmar':chemicalShortage.quantity+' '+chemicalShortage.unit}.`:'';
    const message=`${label}.${shortageText} Próximo passo: ${nextStep}`;
    const visit=await tx.serviceVisit.update({where:{id},data:{status:'INCOMPLETE',internalNotes:[current.internalNotes,`[Visita por concluir ${now.toISOString()}] ${message}`].filter(Boolean).join('\n')}});
    const reminder=await tx.operationalReminder.create({data:{sourceKey,title:`Visita por concluir — ${current.pool?.name||id}`,description:message,dueDate:now,clientId:current.clientId,poolId:current.poolId,assignedToTechnicianId:current.technicianId,metadata:{visitId:id,reason:body.reason,nextStep,...(chemicalShortage?{chemicalShortage}:{}),reportedAt:now.toISOString(),reportedBy:technicianId,reportedByRole:role}}});
    if(current.poolId)await tx.technicalHistory.create({data:{poolId:current.poolId,type:'VISIT_INCOMPLETE',component:'Service Visit',message:label,description:JSON.stringify({visitId:id,requestId:body.requestId,nextStep,technicianId,...(chemicalShortage?{chemicalShortage}:{})}),status:'INCOMPLETE',performedAt:now}});
    await tx.notification.create({data:{role:'ADMIN',type:'VISIT_INCOMPLETE',eventType:'VISIT_INCOMPLETE',title:reminder.title,message,severity:'WARNING',status:'PENDING',clientId:current.clientId,metadata:{visitId:id,poolId:current.poolId,technicianId:current.technicianId,reminderId:reminder.id}}});
    return {ok:true,visit,reminder};
  });
}
function admin(user){if(normalizeRole(user?.role)!=='ADMIN')fail(403,'Apenas o escritório pode agendar regressos');}
async function shortages(user,db=prisma){
  const role=normalizeRole(user?.role),technicianId=Number(user?.technicianId||user?.id);
  if(!['ADMIN','TECHNICIAN'].includes(role))fail(403,'Sessão sem acesso');
  const reminders=await db.operationalReminder.findMany({where:{sourceKey:{startsWith:'incomplete:'},isCompleted:false},orderBy:{id:'desc'}});
  if(!reminders.length)return {ok:true,checkedAt:new Date().toISOString(),rows:[]};
  const needFilter=reminders.map(row=>({metadata:{path:['shortageId'],equals:row.id}}));
  const ids=[...new Set(reminders.flatMap(row=>[row.metadata?.visitId,row.metadata?.returnPlan?.visitId]).filter(Number.isSafeInteger))];
  const visits=await db.serviceVisit.findMany({where:{id:{in:ids}},include:{pool:{select:{name:true}},technician:{select:{name:true,vehicleId:true,vehicle:{select:{plate:true}}}}}});
  const byId=new Map(visits.map(visit=>[visit.id,visit])),links=new Map();
  for(const row of reminders)if(!links.has(row.metadata?.visitId))links.set(row.metadata?.visitId,row.metadata?.returnPlan?.visitId);
  const terminal=new Set(['CANCELLED','CANCELED','SKIPPED','ARCHIVED','DONE','COMPLETED']);
  const deliveries=await db.operationalReminder.findMany({where:{sourceKey:{startsWith:'chemical-delivery:'},OR:needFilter},select:{metadata:true}});
  const preparations=await db.operationalReminder.findMany({where:{sourceKey:{startsWith:'stock-transfer:'},OR:needFilter},select:{metadata:true}});
  const rows=[],seen=new Set();
  for(const row of reminders){
    const shortage=row.metadata?.chemicalShortage;if(!shortage)continue;
    let visit=byId.get(row.metadata.visitId);const traversed=new Set();
    while(visit&&!traversed.has(visit.id)){
      traversed.add(visit.id);const next=byId.get(links.get(visit.id));
      if(!next||terminal.has(next.status))break;visit=next;
    }
    if(!visit||visit.endAt||terminal.has(visit.status)||(role!=='ADMIN'&&visit.technicianId!==technicianId))continue;
    const key=JSON.stringify([visit.id,String(shortage.productName).trim().toLowerCase(),shortage.unit]);if(seen.has(key))continue;seen.add(key);
    const receipts=deliveries.filter(delivery=>delivery.metadata?.shortageId===row.id).map(delivery=>({movementId:delivery.metadata.movementId,currentAssignment:delivery.metadata.receivedBy===visit.technicianId&&delivery.metadata.vehicleId===visit.technician?.vehicleId,quantity:delivery.metadata.quantity,receivedByName:delivery.metadata.receivedByName,receivedAt:delivery.metadata.receivedAt}));
    const loads=require('../../services/stockPreparationService').reconcile(preparations.filter(p=>p.metadata?.shortageId===row.id));
    const preparedMovements=loads.filter(m=>m.technicianId===visit.technicianId&&m.vehicleId===visit.technician?.vehicleId),preparedQuantity=preparedMovements.reduce((n,m)=>n+m.quantity,0);
    const byMovement=new Map();for(const receipt of receipts.filter(r=>r.currentAssignment))byMovement.set(receipt.movementId,(byMovement.get(receipt.movementId)||0)+Number(receipt.quantity||0));
    const receivedQuantity=[...byMovement].reduce((n,[id,quantity])=>n+Math.min(quantity,preparedMovements.find(m=>m.id===id)?.quantity??quantity),0);
    const committedQuantity=preparedQuantity+receipts.filter(r=>r.currentAssignment&&!preparedMovements.some(m=>m.id===r.movementId)).reduce((n,r)=>n+Number(r.quantity||0),0);
    rows.push({technicianId:visit.technicianId,vehicleId:visit.technician?.vehicleId||null,vehiclePlate:visit.technician?.vehicle?.plate||null,preparedQuantity,returnedQuantity:preparedMovements.reduce((n,m)=>n+m.returnedQuantity,0),committedQuantity,shortageId:row.id,reportedAt:row.metadata.reportedAt||row.createdAt,receivedQuantity,loads:loads.map(m=>({id:m.id,vehicleId:m.vehicleId,productName:m.productName,unit:m.unit,originalQuantity:m.originalQuantity,returnedQuantity:m.returnedQuantity,quantity:m.quantity})),receipts,visitId:visit.id,reportedVisitId:row.metadata.visitId,poolName:visit.pool?.name||'Piscina',technicianName:visit.technician?.name||'Por atribuir',plannedDate:visit.plannedDate,...shortage});
  }
  return {ok:true,checkedAt:new Date().toISOString(),rows};
}
async function followups(user){
  admin(user);
  const reminders=await prisma.operationalReminder.findMany({where:{sourceKey:{startsWith:'incomplete:'},isCompleted:false},include:{pool:{select:{name:true}},client:{select:{name:true}},assignedTechnician:{select:{name:true}}},orderBy:{dueDate:'asc'}});
  const ids=[...new Set(reminders.flatMap(row=>[row.metadata?.visitId,row.metadata?.returnPlan?.visitId]).filter(Number.isSafeInteger))];
  const visits=await prisma.serviceVisit.findMany({where:{id:{in:ids}},select:{id:true,status:true,plannedDate:true,technicianId:true,technicianName:true,endAt:true,startAt:true}});
  return {ok:true,shortages:await shortages(user),reminders:reminders.map(row=>({...row,visit:visits.find(v=>v.id===row.metadata?.visitId)||null,returnVisit:visits.find(v=>v.id===row.metadata?.returnPlan?.visitId)||null})),technicians:await prisma.technician.findMany({where:{active:true},select:{id:true,name:true},orderBy:{name:'asc'}})};
}
async function scheduleReturn(user,value,body={}){
  admin(user);
  const id=Number(value),technicianId=Number(body.technicianId),instructions=String(body.instructions||'').trim();
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(technicianId)||technicianId<=0)fail(400,'Visita e técnico obrigatórios');
  if(instructions.length<5||instructions.length>1000)fail(400,'Indique instruções para o regresso (5–1000 caracteres)');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.requestId||'')))fail(400,'Identificador do pedido inválido');
  const dateText=String(body.date||''),date=new Date(`${dateText}T00:00:00`),today=new Date();today.setHours(0,0,0,0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateText)||!Number.isFinite(date.getTime())||date.getFullYear()!==Number(dateText.slice(0,4))||date.getMonth()+1!==Number(dateText.slice(5,7))||date.getDate()!==Number(dateText.slice(8,10))||date<today)fail(400,'Escolha uma data válida a partir de hoje');
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${id} FOR UPDATE`;
    const current=await tx.serviceVisit.findUnique({where:{id}});
    if(!current)fail(404,'Visita não encontrada');
    const all=await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:`incomplete:${id}:`}},orderBy:{id:'asc'}});
    const plans=all.flatMap(row=>row.metadata?.returnPlans||[]);
    const replay=plans.find(plan=>plan.requestId===body.requestId);
    if(replay)return {ok:true,idempotent:true,visit:await tx.serviceVisit.findUnique({where:{id:replay.visitId}})};
    if(current.status!=='INCOMPLETE'||current.endAt||!current.poolId||!all.some(row=>!row.isCompleted))fail(409,'A visita já não tem um impedimento aberto. Atualize a lista');
    const linkedIds=[...new Set(all.map(row=>row.metadata?.returnPlan?.visitId).filter(Number.isSafeInteger))];
    if(linkedIds.length&&await tx.serviceVisit.findFirst({where:{id:{in:linkedIds},status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}}}))fail(409,'Já existe um regresso para esta visita. Atualize a lista');
    const technician=await tx.technician.findUnique({where:{id:technicianId}});
    if(!technician?.active||technician.archiveStatus!=='ATIVO')fail(400,'O técnico está indisponível ou inativo');
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${Number(current.poolId)}::bigint)::text`;
    const tomorrow=new Date(date);tomorrow.setDate(tomorrow.getDate()+1);
    if(await tx.serviceVisit.findFirst({where:{poolId:current.poolId,id:{not:id},plannedDate:{gte:date,lt:tomorrow},status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}}}))fail(409,'Já existe uma visita para esta piscina nesse dia. Reveja o planeamento antes de agendar');
    const now=new Date(),visit=await tx.serviceVisit.create({data:{poolId:current.poolId,clientId:current.clientId,technicianId,technicianName:technician.name,plannedDate:date,status:'PLANNED',reason:'INCOMPLETE_RETURN',notes:`Regresso da visita #${id}.`,internalNotes:`Regresso da visita #${id}.\nInstruções do escritório: ${instructions}\nAgendado pelo escritório: ${user.id}.`}});
    await require('../../services/visitReceiptService').requestReceipt(tx,visit,`return-${body.requestId}`,'RETURN_VISIT');
    const plan={visitId:visit.id,requestId:body.requestId,date:dateText,technicianId,instructions,scheduledAt:now.toISOString(),scheduledBy:user.id};
    for(const row of all.filter(row=>!row.isCompleted))await tx.operationalReminder.update({where:{id:row.id},data:{dueDate:date,metadata:{...row.metadata,returnPlan:plan,returnPlans:[...(row.metadata?.returnPlans||[]),plan]}}});
    await tx.technicalHistory.create({data:{poolId:current.poolId,type:'VISIT_RETURN_SCHEDULED',component:'Service Visit',message:`Regresso #${visit.id} agendado para ${dateText}`,description:JSON.stringify({originalVisitId:id,returnVisitId:visit.id,date:dateText,technicianId,scheduledBy:user.id}),status:'PLANNED',performedAt:now}});
    return {ok:true,visit};
  });
}
module.exports={report,reasons,followups,scheduleReturn,shortages};
