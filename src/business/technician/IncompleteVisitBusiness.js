const {prisma}=require('../../prismaClient');
const {normalizeRole,roleMatches}=require('../../utils/roles');
const lifecycle=require('../../services/incompleteVisitLifecycle');
const requests=require('../../services/fieldWriteRequestService');
const calendar=require('../../services/equipmentMaintenanceCalendar');
const reasons={ACCESS_BLOCKED:'Acesso impedido',NO_KEY:'Chave indisponível ou incorreta',CLIENT_REFUSED:'Cliente impediu o serviço',CHEMICAL_MISSING:'Falta de produtos químicos',MATERIAL_MISSING:'Falta de material',EQUIPMENT_FAILURE:'Equipamento avariado',WEATHER:'Condições meteorológicas',OTHER:'Outro motivo'};
function fail(statusCode,message){throw Object.assign(new Error(message),{statusCode});}
function contract(user,id,body,scope){
  if(body.visitType===undefined){if(body.poolId!==undefined||body.baseVersion!==undefined)fail(400,'Indique o tipo da visita');return null;}
  const allowed=['requestId','visitType','poolId','baseVersion',...(scope==='VISIT_RETURN'?['date','technicianId','instructions']:['reason','nextStep','chemicalShortage'])];
  if(Object.keys(body).some(k=>!allowed.includes(k))||!['REGULAR','EXTRA'].includes(body.visitType)||!Number.isSafeInteger(body.poolId)||body.poolId<=0||!(/^[a-f0-9]{64}$/).test(body.baseVersion))fail(400,'Conserve o pedido original e atualize o contexto da visita');
  if(body.chemicalShortage!==undefined&&(body.reason!=='CHEMICAL_MISSING'||!body.chemicalShortage||typeof body.chemicalShortage!=='object'||Array.isArray(body.chemicalShortage)||Object.keys(body.chemicalShortage).some(k=>!['productName','quantity','unit'].includes(k))))fail(400,'Dados de falta de produto inválidos');
  const {requestId,...payload}=body;return requests.context(user,scope,id,requestId,payload);
}
const contextOf=(id,body)=>({visitId:id,visitType:body.visitType,poolId:body.poolId,baseVersion:body.baseVersion});
const refused=(tx,request,id,body,code,message)=>requests.confirm(tx,request,{ok:true,applied:false,context:contextOf(id,body),code,message});
async function view(user,value,query={}){
  const id=Number(value),visitType=query.visitType;
  if(!Number.isSafeInteger(id)||id<=0||!['REGULAR','EXTRA'].includes(visitType))fail(400,'Visita inválida');
  requests.owner(user);
  return prisma.$transaction(async tx=>{
    const visit=await lifecycle.locked(tx,user,visitType,id),state=await lifecycle.state(tx,visitType,visit);
    return {ok:true,visit:lifecycle.project(visitType,visit),baseVersion:state.baseVersion,hasReturn:state.returns.some(v=>!lifecycle.withdrawn.includes(v.status)),hasImpediment:state.reminders.some(r=>!r.isCompleted)};
  });
}
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
  const request=contract(user,id,body,'VISIT_INCOMPLETE'),visitType=body.visitType||'REGULAR';
  return prisma.$transaction(async tx=>{
    if(request){const saved=await requests.recover(tx,request);if(saved)return saved;}
    const current=await lifecycle.locked(tx,user,visitType,id);
    if(!current)fail(404,'Visita não encontrada');
    if(role!=='ADMIN'&&(!roleMatches(role,'TECHNICIAN')||current.technicianId!==technicianId))fail(403,'A visita não está atribuída a este técnico');
    const sourceKey=lifecycle.prefix(visitType,id)+body.requestId;
    if(request){
      const state=await lifecycle.state(tx,visitType,current);
      if(current.poolId!==body.poolId)return refused(tx,request,id,body,'INCOMPLETE_CONTEXT','A piscina mudou. Atualize a visita antes de preparar outro registo.');
      if(state.baseVersion!==body.baseVersion)return refused(tx,request,id,body,'INCOMPLETE_STALE','A visita ou o regresso mudou. Reveja o estado atual antes de preparar outro registo.');
      if(current.endAt||lifecycle.closed.includes(current.status))return refused(tx,request,id,body,'INCOMPLETE_STATE','A visita já foi concluída ou retirada.');
      if(state.returns.some(v=>!lifecycle.withdrawn.includes(v.status)))return refused(tx,request,id,body,'INCOMPLETE_RETURN_EXISTS','Já existe um regresso. Registe o impedimento na visita de regresso.');
    }
    const existing=await tx.operationalReminder.findUnique({where:{sourceKey}});
    if(existing){
      if(request)fail(409,'Este identificador já pertence a um registo anterior. Conserve o pedido e peça revisão ao escritório.');
      const saved=existing.metadata||{};
      const same=saved.reportedBy===technicianId&&saved.reportedByRole===role&&saved.reason===body.reason&&saved.nextStep===body.nextStep.trim()&&(chemicalShortage ? saved.chemicalShortage?.productName===chemicalShortage.productName&&saved.chemicalShortage?.quantity===chemicalShortage.quantity&&saved.chemicalShortage?.unit===chemicalShortage.unit : !saved.chemicalShortage);
      if(!same)fail(409,'Este identificador já foi utilizado com outros dados. Atualize o registo antes de enviar uma alteração.');
      return {ok:true,visit:current,reminder:existing,idempotent:true};
    }
    if(current.endAt||['DONE','COMPLETED','CONCLUIDA','CANCELLED','CANCELED','ARCHIVED'].includes(String(current.status).toUpperCase()))fail(409,'A visita já foi concluída ou retirada. Confirme com o escritório');
    const previous=await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:lifecycle.prefix(visitType,id)}}});
    const returns=previous.map(row=>row.metadata?.returnPlan?.visitId).filter(Number.isSafeInteger);
    if(returns.length&&await lifecycle.model(tx,visitType).findFirst({where:{id:{in:returns},status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}}}))fail(409,'Já existe um regresso. Registe o novo impedimento na visita de regresso');
    const nextStep=body.nextStep.trim(),now=new Date(),label=reasons[body.reason];
    const shortageText=chemicalShortage?` Produto: ${chemicalShortage.productName}. Quantidade: ${chemicalShortage.quantity===null?'por confirmar':chemicalShortage.quantity+' '+chemicalShortage.unit}.`:'';
    const message=`${label}.${shortageText} Próximo passo: ${nextStep}`;
    const noteField=visitType==='EXTRA'?'internalNote':'internalNotes';
    const visit=await lifecycle.model(tx,visitType).update({where:{id},data:{status:'INCOMPLETE',[noteField]:[current[noteField],`[Visita por concluir ${now.toISOString()}] ${message}`].filter(Boolean).join('\n')}});
    const reminder=await tx.operationalReminder.create({data:{sourceKey,title:`Visita por concluir — ${current.pool?.name||id}`,description:message,dueDate:now,clientId:current.clientId,poolId:current.poolId,assignedToTechnicianId:current.technicianId,metadata:{visitId:id,visitType,reason:body.reason,nextStep,...(chemicalShortage?{chemicalShortage}:{}),reportedAt:now.toISOString(),reportedBy:technicianId,reportedByRole:role}}});
    if(current.poolId)await tx.technicalHistory.create({data:{poolId:current.poolId,type:'VISIT_INCOMPLETE',component:visitType==='EXTRA'?'Extra Visit':'Service Visit',message:label,description:JSON.stringify({visitId:id,visitType,requestId:body.requestId,nextStep,technicianId,...(chemicalShortage?{chemicalShortage}:{})}),status:'INCOMPLETE',performedAt:now}});
    await tx.notification.create({data:{role:'ADMIN',type:'VISIT_INCOMPLETE',eventType:'VISIT_INCOMPLETE',title:reminder.title,message,severity:'WARNING',status:'PENDING',clientId:current.clientId,metadata:{visitId:id,visitType,poolId:current.poolId,technicianId:current.technicianId,reminderId:reminder.id}}});
    return request?requests.confirm(tx,request,{ok:true,applied:true,context:contextOf(id,body),visit:lifecycle.project(visitType,visit),reminder}):{ok:true,visit,reminder};
  });
}
function admin(user){if(normalizeRole(user?.role)!=='ADMIN')fail(403,'Apenas o escritório pode agendar regressos');}
async function shortages(user,db=prisma){
  const role=normalizeRole(user?.role),technicianId=Number(user?.technicianId||user?.id);
  if(role!=='ADMIN'&&!roleMatches(role,'TECHNICIAN'))fail(403,'Sessão sem acesso');
  const reminders=await db.operationalReminder.findMany({where:{sourceKey:{startsWith:'incomplete:'},isCompleted:false},orderBy:{id:'desc'}});
  if(!reminders.length)return {ok:true,checkedAt:new Date().toISOString(),rows:[]};
  const needFilter=reminders.map(row=>({metadata:{path:['shortageId'],equals:row.id}}));
  const byId=await lifecycle.collect(db,reminders),links=new Map();
  for(const row of reminders){const k=lifecycle.key(lifecycle.type(row.metadata),row.metadata?.visitId);if(!links.has(k))links.set(k,lifecycle.key(lifecycle.type(row.metadata),row.metadata?.returnPlan?.visitId));}
  const terminal=new Set(['CANCELLED','CANCELED','SKIPPED','ARCHIVED','DONE','COMPLETED']);
  const deliveries=await db.operationalReminder.findMany({where:{sourceKey:{startsWith:'chemical-delivery:'},OR:needFilter},select:{metadata:true}});
  const preparations=await db.operationalReminder.findMany({where:{sourceKey:{startsWith:'stock-transfer:'},OR:needFilter},select:{metadata:true}});
  const rows=[],seen=new Set();
  for(const row of reminders){
    const shortage=row.metadata?.chemicalShortage;if(!shortage)continue;
    const visitType=lifecycle.type(row.metadata);
    let visit=byId.get(lifecycle.key(visitType,row.metadata.visitId));const traversed=new Set();
    while(visit&&!traversed.has(visit.id)){
      traversed.add(visit.id);const next=byId.get(links.get(lifecycle.key(visitType,visit.id)));
      if(!next||terminal.has(next.status))break;visit=next;
    }
    if(!visit||visit.endAt||terminal.has(visit.status)||(role!=='ADMIN'&&visit.technicianId!==technicianId))continue;
    const key=JSON.stringify([visitType,visit.id,String(shortage.productName).trim().toLowerCase(),shortage.unit]);if(seen.has(key))continue;seen.add(key);
    const receipts=deliveries.filter(delivery=>delivery.metadata?.shortageId===row.id).map(delivery=>({movementId:delivery.metadata.movementId,currentAssignment:delivery.metadata.receivedBy===visit.technicianId&&delivery.metadata.vehicleId===visit.technician?.vehicleId,quantity:delivery.metadata.quantity,receivedByName:delivery.metadata.receivedByName,receivedAt:delivery.metadata.receivedAt}));
    const loads=require('../../services/stockPreparationService').reconcile(preparations.filter(p=>p.metadata?.shortageId===row.id));
    const preparedMovements=loads.filter(m=>m.technicianId===visit.technicianId&&m.vehicleId===visit.technician?.vehicleId),preparedQuantity=preparedMovements.reduce((n,m)=>n+m.quantity,0);
    const byMovement=new Map();for(const receipt of receipts.filter(r=>r.currentAssignment))byMovement.set(receipt.movementId,(byMovement.get(receipt.movementId)||0)+Number(receipt.quantity||0));
    const receivedQuantity=[...byMovement].reduce((n,[id,quantity])=>n+Math.min(quantity,preparedMovements.find(m=>m.id===id)?.quantity??quantity),0);
    const committedQuantity=preparedQuantity+receipts.filter(r=>r.currentAssignment&&!preparedMovements.some(m=>m.id===r.movementId)).reduce((n,r)=>n+Number(r.quantity||0),0);
    rows.push({technicianId:visit.technicianId,vehicleId:visit.technician?.vehicleId||null,vehiclePlate:visit.technician?.vehicle?.plate||null,preparedQuantity,returnedQuantity:preparedMovements.reduce((n,m)=>n+m.returnedQuantity,0),committedQuantity,shortageId:row.id,reportedAt:row.metadata.reportedAt||row.createdAt,receivedQuantity,loads:loads.map(m=>({id:m.id,vehicleId:m.vehicleId,productName:m.productName,unit:m.unit,originalQuantity:m.originalQuantity,returnedQuantity:m.returnedQuantity,quantity:m.quantity})),receipts,visitType,visitId:visit.id,reportedVisitType:visitType,reportedVisitId:row.metadata.visitId,poolName:visit.pool?.name||'Piscina',technicianName:visit.technician?.name||'Por atribuir',plannedDate:visit.plannedDate,...shortage});
  }
  return {ok:true,checkedAt:new Date().toISOString(),rows};
}
async function followups(user){
  admin(user);
  const reminders=await prisma.operationalReminder.findMany({where:{sourceKey:{startsWith:'incomplete:'},isCompleted:false},include:{pool:{select:{name:true}},client:{select:{name:true}},assignedTechnician:{select:{name:true}}},orderBy:{dueDate:'asc'}});
  const visits=await lifecycle.collect(prisma,reminders);
  return {ok:true,shortages:await shortages(user),reminders:reminders.map(row=>({...row,visit:lifecycle.project(lifecycle.type(row.metadata),visits.get(lifecycle.key(lifecycle.type(row.metadata),row.metadata?.visitId))),returnVisit:lifecycle.project(lifecycle.type(row.metadata),visits.get(lifecycle.key(lifecycle.type(row.metadata),row.metadata?.returnPlan?.visitId)))})),technicians:await prisma.technician.findMany({where:{active:true},select:{id:true,name:true},orderBy:{name:'asc'}})};
}
async function scheduleReturn(user,value,body={}){
  admin(user);
  const id=Number(value),technicianId=Number(body.technicianId),instructions=String(body.instructions||'').trim();
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(technicianId)||technicianId<=0)fail(400,'Visita e técnico obrigatórios');
  if(typeof body.instructions!=='string'||instructions.length<5||instructions.length>1000)fail(400,'Indique instruções para o regresso (5–1000 caracteres)');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.requestId||'')))fail(400,'Identificador do pedido inválido');
  const request=contract(user,id,body,'VISIT_RETURN'),visitType=body.visitType||'REGULAR';
  const dateText=String(body.date||''),date=new Date(`${dateText}T00:00:00`),today=new Date();today.setHours(0,0,0,0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateText)||!Number.isFinite(date.getTime())||date.getFullYear()!==Number(dateText.slice(0,4))||date.getMonth()+1!==Number(dateText.slice(5,7))||date.getDate()!==Number(dateText.slice(8,10)))fail(400,'Escolha uma data válida a partir de hoje');
  if(request){try{calendar.civilDate(dateText);}catch(error){fail(400,error.message);}}
  return prisma.$transaction(async tx=>{
    if(request){const saved=await requests.recover(tx,request);if(saved)return saved;}
    const current=await lifecycle.locked(tx,user,visitType,id);
    if(!current)fail(404,'Visita não encontrada');
    const all=await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:lifecycle.prefix(visitType,id)}},orderBy:{id:'asc'}});
    if(request){
      const state=await lifecycle.state(tx,visitType,current);
      if(current.poolId!==body.poolId)return refused(tx,request,id,body,'INCOMPLETE_CONTEXT','A piscina mudou. Atualize o acompanhamento.');
      if(state.baseVersion!==body.baseVersion)return refused(tx,request,id,body,'INCOMPLETE_STALE','O impedimento ou o regresso mudou. Reveja o estado atual.');
      if(current.status!=='INCOMPLETE'||current.endAt||!all.some(r=>!r.isCompleted))return refused(tx,request,id,body,'INCOMPLETE_STATE','A visita já não tem um impedimento aberto.');
      if(state.returns.some(v=>!lifecycle.withdrawn.includes(v.status)))return refused(tx,request,id,body,'INCOMPLETE_RETURN_EXISTS','Já existe um regresso para esta visita.');
      if(dateText<calendar.dayLisbon())return refused(tx,request,id,body,'INCOMPLETE_DATE','Escolha uma data a partir de hoje.');
      date.setTime(calendar.civilDate(dateText).getTime());
    }
    const plans=all.flatMap(row=>row.metadata?.returnPlans||[]);
    const replay=plans.find(plan=>plan.requestId===body.requestId);
    if(replay){
      if(replay.date!==dateText||replay.technicianId!==technicianId||replay.instructions!==instructions||replay.scheduledBy!==user.id)fail(409,'Este identificador já foi utilizado com outro agendamento. Atualize o planeamento antes de enviar alterações.');
      const savedVisit=await lifecycle.model(tx,visitType).findUnique({where:{id:replay.visitId}});
      if(!savedVisit)fail(409,'O regresso registado já não está disponível. Confirme o planeamento com a gestão.');
      return {ok:true,idempotent:true,visit:savedVisit};
    }
    if(!request&&date<today)fail(400,'Escolha uma data válida a partir de hoje');
    if(current.status!=='INCOMPLETE'||current.endAt||!current.poolId||!all.some(row=>!row.isCompleted))fail(409,'A visita já não tem um impedimento aberto. Atualize a lista');
    const linkedIds=[...new Set(all.map(row=>row.metadata?.returnPlan?.visitId).filter(Number.isSafeInteger))];
    if(linkedIds.length&&await lifecycle.model(tx,visitType).findFirst({where:{id:{in:linkedIds},status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}}}))fail(409,'Já existe um regresso para esta visita. Atualize a lista');
    const technician=await tx.technician.findUnique({where:{id:technicianId}});
    if(!technician?.active||technician.archiveStatus!=='ATIVO'){if(request)return refused(tx,request,id,body,'INCOMPLETE_TECHNICIAN','O técnico está indisponível. Reveja a atribuição.');fail(400,'O técnico está indisponível ou inativo');}
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${Number(current.poolId)}::bigint)::text`;
    const tomorrow=new Date(date);if(request)tomorrow.setUTCDate(tomorrow.getUTCDate()+1);else tomorrow.setDate(tomorrow.getDate()+1);
    if(await lifecycle.model(tx,visitType).findFirst({where:{poolId:current.poolId,id:{not:id},[visitType==='EXTRA'?'scheduledAt':'plannedDate']:{gte:date,lt:tomorrow},status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}}})){if(request)return refused(tx,request,id,body,'INCOMPLETE_SCHEDULE_CONFLICT','Já existe uma visita para esta piscina nesse dia. Reveja o planeamento.');fail(409,'Já existe uma visita para esta piscina nesse dia. Reveja o planeamento antes de agendar');}
    const now=new Date(),common={poolId:current.poolId,clientId:current.clientId,technicianId,status:'PLANNED',notes:`Regresso da visita ${visitType==='EXTRA'?'extra ':''}#${id}.`};
    const note=`${common.notes}\nInstruções do escritório: ${instructions}\nAgendado pelo escritório: ${user.id}.`;
    if(visitType==='EXTRA'&&(current.billed||await tx.invoiceLine.findFirst({where:{type:'EXTRA_VISIT',referenceId:id}}))){if(request)return refused(tx,request,id,body,'INCOMPLETE_BILLING','A visita está reservada para faturação. Confirme as condições comerciais.');fail(409,'A visita está reservada para faturação. Confirme as condições comerciais.');}
    const visit=await lifecycle.model(tx,visitType).create({data:visitType==='REGULAR'?{...common,technicianName:technician.name,plannedDate:date,reason:'INCOMPLETE_RETURN',internalNotes:note}:{...common,scheduledAt:date,date,source:'INCOMPLETE_RETURN',origin:'ADMIN',internalNote:note,billingMode:current.billingMode,commercialRule:current.commercialRule,isBillable:current.isBillable,unitPrice:current.unitPrice,totalPrice:current.totalPrice,price:current.price,includedInPackage:current.includedInPackage,billingStatus:current.billingMode==='EXTRA'&&!current.includedInPackage?'PENDING':'NOT_BILLABLE'}});
    await require('../../services/visitReceiptService').requestReceipt(tx,{...visit,visitType},`return-${body.requestId}`,'RETURN_VISIT');
    const plan={visitId:visit.id,visitType,requestId:body.requestId,date:dateText,technicianId,instructions,scheduledAt:now.toISOString(),scheduledBy:user.id};
    for(const row of all.filter(row=>!row.isCompleted))await tx.operationalReminder.update({where:{id:row.id},data:{dueDate:date,metadata:{...row.metadata,returnPlan:plan,returnPlans:[...(row.metadata?.returnPlans||[]),plan]}}});
    await tx.technicalHistory.create({data:{poolId:current.poolId,type:'VISIT_RETURN_SCHEDULED',component:visitType==='EXTRA'?'Extra Visit':'Service Visit',message:`Regresso #${visit.id} agendado para ${dateText}`,description:JSON.stringify({visitType,originalVisitId:id,returnVisitId:visit.id,date:dateText,technicianId,scheduledBy:user.id}),status:'PLANNED',performedAt:now}});
    return request?requests.confirm(tx,request,{ok:true,applied:true,context:contextOf(id,body),visit:lifecycle.project(visitType,visit),plan}):{ok:true,visit};
  });
}
module.exports={view,report,reasons,followups,scheduleReturn,shortages};
