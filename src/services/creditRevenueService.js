'use strict';
const { prisma } = require('../prismaClient'), { roleMatches } = require('../utils/roles');
const { period } = require('./operationalValueReportService'), { sum } = require('./monthlyFinancialProjection');
const r = require('./expenseLedgerRules'), data = require('./creditRevenueData');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
function envelope(body) {
  r.object(body,['requestId','command','lineId','expectedStateHash','data']);
  if (!uuid(body.requestId) || !['ALLOCATE','VOID'].includes(body.command) || !sha(body.expectedStateHash)) r.fail('Pedido de repartição inválido.');
  r.id(body.lineId);
  const d = body.data;
  r.object(d,body.command==='ALLOCATE' ? ['targetType','targetId','targetHash','amountCents','reason','confirmed'] : ['allocationId','reason','confirmed']);
  if (d.confirmed !== true) r.fail('Confirme a repartição e o motivo.'); r.text(d.reason,500,true);
  if (body.command==='ALLOCATE') { if (!['LINE','MONTHLY_ALLOCATION'].includes(d.targetType) || !sha(d.targetHash)) r.fail('Serviço inválido.'); r.id(d.targetId); r.money(d.amountCents); }
  else r.id(d.allocationId);
  return {requestId:body.requestId,command:body.command,lineId:body.lineId,expectedStateHash:body.expectedStateHash,data:d};
}
const transaction = work => prisma.$transaction(work,{isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
function summarize(rows) {
  const counted = rows.filter(s=>!s.excluded), invalid = counted.filter(s=>!s.valid), active = rows.flatMap(s=>s.allocations).filter(a=>!a.voidedAt);
  return {currency:'EUR',sourceCount:counted.length,excludedSourceCount:rows.length-counted.length,reviewSourceCount:invalid.length,activeCount:active.length,reviewCount:active.filter(a=>a.needsReview).length,
    amountCents:invalid.length ? null : sum(counted.map(s=>s.amountCents)), allocatedAmountCents:invalid.length ? null : sum(counted.map(s=>s.allocatedAmountCents)), availableAmountCents:invalid.length ? null : sum(counted.map(s=>s.availableAmountCents)),
    basis:'DOCUMENT_MONTH_CURRENT_VALUES',completeRevenueAllocation:false,profit:null,limitApplied:null};
}
async function list(query) {
  r.object(query,['monthRef','scope','q','page']); const monthRef=period({monthRef:query.monthRef}).monthRef, scope=query.scope||'month', q=r.text(query.q||'',160), page=r.queryId(query.page===undefined?'1':query.page);
  if (!['month','all'].includes(scope)) r.fail('Filtro inválido.');
  return transaction(async db=>{
    const all=(await data.states(db)).filter(s=>scope==='all'||s.documentMonth===monthRef);
    const rows=all.filter(s=>!q||r.normalized([s.label,s.clientName,s.clientId,s.invoiceId,s.lineId].join(' ')).includes(r.normalized(q)));
    return {ok:true,monthRef,scope,q,page,pageSize:10,total:rows.length,generatedAt:new Date().toISOString(),summary:summarize(all),rows:rows.slice((page-1)*10,page*10).map(({allocations,source,targets,...row})=>row)};
  });
}
async function detail(lineId) {
  return transaction(async db=>{
    const source=(await data.states(db,r.id(lineId)))[0]; if(!source)r.fail('Nota de crédito não encontrada.',404);
    const events=await db.creditRevenueEvent.findMany({where:{lineId},orderBy:{id:'desc'},select:{id:true,actorName:true,command:true,createdAt:true,result:true}});
    return {ok:true,source:data.json(source),events};
  });
}
async function candidates(lineId,query) {
  r.object(query,['q','page']); const q=r.text(query.q||'',160),page=r.queryId(query.page===undefined?'1':query.page);
  return transaction(async db=>{
    const s=(await data.states(db,r.id(lineId)))[0];if(!s)r.fail('Nota de crédito não encontrada.',404);
    const rows=s.targets.filter(t=>s.valid && t.valid && t.availableAmountCents>0 && (!q||r.normalized(t.label).includes(r.normalized(q)))).sort((a,b)=>a.type.localeCompare(b.type)||a.id-b.id);
    return {ok:true,lineId,stateHash:s.stateHash,q,page,pageSize:10,total:rows.length,rows:rows.slice((page-1)*10,page*10)};
  });
}
const refused=(code,message)=>({applied:false,code,message});
function actor(user) { if(!roleMatches(user?.role,'ADMIN'))r.fail('Acesso reservado à administração.',403);return r.id(user.userId||user.id); }
async function command(user,body,cancel=false) {
  const actorId=actor(user),env=envelope(body),payloadHash=r.hash({v:1,scope:'CREDIT_NOTE_REVENUE',...env}),d=env.data;
  return prisma.$transaction(async db=>{
    const account=await db.user.findUnique({where:{id:actorId},select:{name:true,email:true,active:true,role:true}});
    if(!account?.active||!roleMatches(account.role,'ADMIN'))r.fail('Sessão inválida.',401);
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'credit-revenue-request:'+env.requestId }))::text`;
    const previous=await db.creditRevenueEvent.findUnique({where:{requestId:env.requestId}});
    if(previous){if(previous.actorId!==actorId||previous.payloadHash!==payloadHash)r.fail('Identificador já usado com outro pedido ou conta.',409);return {...previous.result,replayed:true};}
    // Monthly commands acquire this line lock before the document. Use the same
    // order so void/reallocation cannot race with a reduction of that parcel.
    const allocation=env.command==='ALLOCATE'&&d.targetType==='MONTHLY_ALLOCATION'?await db.revenueAllocation.findUnique({where:{id:d.targetId}}):null;
    if(allocation)await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'revenue-line:'+allocation.lineId }))::text`;
    const line=await db.invoiceLine.findUnique({where:{id:env.lineId},select:{invoiceId:true,invoice:{select:{clientId:true}}}});
    const historical=!line?await db.creditRevenueAllocation.findFirst({where:{lineId:env.lineId},select:{invoiceId:true,clientId:true}}):null;
    const invoiceId=line?.invoiceId||historical?.invoiceId;
    const clientId=line?.invoice.clientId||historical?.clientId;
    if(clientId)await db.$queryRaw`SELECT id FROM "Client" WHERE id=${clientId} FOR UPDATE`;
    if(invoiceId){await db.$queryRaw`SELECT id FROM "Invoice" WHERE id=${invoiceId} FOR UPDATE`;await db.$queryRaw`SELECT id FROM "InvoiceLine" WHERE "invoiceId"=${invoiceId} ORDER BY id FOR SHARE`;}
    if(env.command==='ALLOCATE'){
      const targetLine=d.targetType==='LINE'?await db.invoiceLine.findUnique({where:{id:d.targetId}}):null;
      const type=allocation?.targetType||({SERVICE:'REGULAR',EXTRA_VISIT:'EXTRA',REPAIR:'REPAIR',MAINTENANCE_EQUIPMENT:'EQUIPMENT',MAINTENANCE_REMINDER:'REMINDER'})[targetLine?.type];
      const id=allocation?.targetId||targetLine?.referenceId;
      if(Number.isSafeInteger(id)&&id>0){
        if(type==='REGULAR')await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR SHARE`;
        if(type==='EXTRA')await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${id} FOR SHARE`;
        if(type==='REPAIR')await db.$queryRaw`SELECT id FROM "Repair" WHERE id=${id} FOR SHARE`;
        if(type==='EQUIPMENT')await db.$queryRaw`SELECT id FROM "EquipmentMaintenanceCompletion" WHERE id=${id} FOR SHARE`;
        if(type==='REMINDER')await db.$queryRaw`SELECT id FROM "GeneralReminder" WHERE id=${id} FOR SHARE`;
      }
    }
    const s=(await data.states(db,env.lineId))[0]; let outcome;
    if(cancel)outcome=refused('CANCELLED_REQUEST','O pedido foi cancelado antes de ser registado.');
    else if(!s)outcome=refused('NOT_FOUND','Nota de crédito não encontrada.');
    else if(s.stateHash!==env.expectedStateHash)outcome=refused('STATE_CHANGED','A nota de crédito ou as atribuições mudaram. Consulte e reveja novamente.');
    else if(env.command==='VOID'){
      const a=s.allocations.find(a=>a.id===d.allocationId);
      if(!a||a.voidedAt)outcome=refused('ALLOCATION_CHANGED','Esta parcela já não está ativa nesta nota de crédito.');
      else{const saved=await db.creditRevenueAllocation.update({where:{id:a.id},data:{voidedAt:new Date(),voidReason:r.text(d.reason,500,true)}});outcome={applied:true,allocation:data.json(saved)};}
    }else if(!s.valid)outcome=refused('SOURCE_REVIEW','Reveja o documento e anule as parcelas afetadas antes de repartir.');
    else if(d.amountCents>s.availableAmountCents)outcome=refused('OVER_BUDGET','O montante excede a nota de crédito ainda disponível.');
    else{
      const t=s.targets.find(t=>t.type===d.targetType&&t.id===d.targetId);
      if(!t||!t.valid||t.hash!==d.targetHash||t.clientId!==s.clientId||t.invoiceId!==s.invoiceId)outcome=refused('TARGET_CHANGED','Reveja a linha, o serviço original e o documento desta redução.');
      else if(d.amountCents>t.availableAmountCents)outcome=refused('TARGET_OVER_BUDGET','A redução excede o valor do serviço ainda disponível neste documento.');
      else{const a=await db.creditRevenueAllocation.create({data:{invoiceId:s.invoiceId,lineId:s.lineId,clientId:s.clientId,monthRef:s.documentMonth,amountCents:d.amountCents,targetType:t.type,targetId:t.id,targetLineId:t.lineId,serviceType:t.serviceType,serviceId:t.serviceId,serviceMonth:t.monthRef,sourceHash:s.source.hash,sourceSnapshot:s.source.snapshot,targetHash:t.hash,targetSnapshot:{...t.snapshot,label:t.label,clientName:t.clientName},reason:r.text(d.reason,500,true),createdById:actorId}});outcome={applied:true,allocation:data.json(a)};}
    }
    const confirmedAt=new Date(),result={ok:true,receipt:{scope:'CREDIT_NOTE_REVENUE',owner:'ADMIN:'+actorId,requestId:env.requestId,command:env.command,lineId:env.lineId,expectedStateHash:env.expectedStateHash,payloadHash,confirmedAt:confirmedAt.toISOString()},...outcome};
    await db.creditRevenueEvent.create({data:{requestId:env.requestId,actorId,actorName:String(account.name||account.email||'ADMIN').slice(0,180),lineId:env.lineId,command:env.command,payloadHash,request:env,result,createdAt:confirmedAt}});
    return result;
  },{maxWait:15000,timeout:30000});
}
async function receipt(user,requestId) {const id=actor(user);if(!uuid(requestId))r.fail('Pedido inválido.');const event=await prisma.creditRevenueEvent.findUnique({where:{requestId}});if(!event||event.actorId!==id)r.fail('Pedido ainda não confirmado nesta conta.',404);return event.result;}
module.exports={list,detail,candidates,command,receipt};
