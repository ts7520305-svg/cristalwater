'use strict';
const { prisma } = require('../prismaClient'), { roleMatches } = require('../utils/roles');
const { period } = require('./operationalValueReportService'), { sum } = require('./monthlyFinancialProjection');
const r = require('./expenseLedgerRules'), data = require('./monthlyRevenueData');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
function envelope(body) {
  r.object(body,['requestId','command','lineId','expectedStateHash','data']);
  if (!uuid(body.requestId) || !['ALLOCATE','VOID'].includes(body.command) || !sha(body.expectedStateHash)) r.fail('Pedido de repartição inválido.');
  r.id(body.lineId);
  const d = body.data;
  r.object(d,body.command==='ALLOCATE' ? ['targetType','targetId','targetHash','amountCents','reason','confirmed'] : ['allocationId','reason','confirmed']);
  if (d.confirmed !== true) r.fail('Confirme a repartição e o motivo.'); r.text(d.reason,500,true);
  if (body.command==='ALLOCATE') { if (!['REGULAR','EXTRA'].includes(d.targetType) || !sha(d.targetHash)) r.fail('Serviço inválido.'); r.id(d.targetId); r.money(d.amountCents); }
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
    return {ok:true,monthRef,scope,q,page,pageSize:10,total:rows.length,generatedAt:new Date().toISOString(),summary:summarize(all),rows:rows.slice((page-1)*10,page*10).map(({allocations,source,...row})=>row)};
  });
}
async function detail(lineId) {
  return transaction(async db=>{
    const source=(await data.states(db,r.id(lineId)))[0]; if(!source)r.fail('Mensalidade não encontrada.',404);
    const events=await db.revenueEvent.findMany({where:{lineId},orderBy:{id:'desc'},select:{id:true,actorName:true,command:true,createdAt:true,result:true}});
    return {ok:true,source:data.json(source),events};
  });
}
async function candidates(lineId,query) {
  r.object(query,['q','page']); const q=r.text(query.q||'',160),page=r.queryId(query.page===undefined?'1':query.page);
  return transaction(async db=>{
    const s=(await data.states(db,r.id(lineId)))[0];if(!s)r.fail('Mensalidade não encontrada.',404);
    const targetMap=await data.targets(db,[],s.clientId), used=await db.revenueAllocation.findMany({where:{voidedAt:null},select:{activeKey:true}}), keys=new Set(used.map(a=>a.activeKey));
    const rows=[...targetMap.values()].filter(t=>s.valid && t.valid && t.monthRef===s.monthRef && !keys.has(t.type+':'+t.id) && (!q||r.normalized(t.label).includes(r.normalized(q)))).sort((a,b)=>a.type.localeCompare(b.type)||a.id-b.id);
    return {ok:true,lineId,stateHash:s.stateHash,q,page,pageSize:10,total:rows.length,rows:rows.slice((page-1)*10,page*10)};
  });
}
const refused=(code,message)=>({applied:false,code,message});
function actor(user) { if(!roleMatches(user?.role,'ADMIN'))r.fail('Acesso reservado à administração.',403);return r.id(user.userId||user.id); }
async function command(user,body,cancel=false) {
  const actorId=actor(user),env=envelope(body),payloadHash=r.hash({v:1,...env}),d=env.data;
  return prisma.$transaction(async db=>{
    const account=await db.user.findUnique({where:{id:actorId},select:{name:true,email:true,active:true,role:true}});
    if(!account?.active||!roleMatches(account.role,'ADMIN'))r.fail('Sessão inválida.',401);
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'revenue-request:'+env.requestId }))::text`;
    const previous=await db.revenueEvent.findUnique({where:{requestId:env.requestId}});
    if(previous){if(previous.actorId!==actorId||previous.payloadHash!==payloadHash)r.fail('Identificador já usado com outro pedido ou conta.',409);return {...previous.result,replayed:true};}
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'revenue-line:'+env.lineId }))::text`;
    // Lock the document before its lines; historical IDs remain usable for an explicit void after deletion.
    const line=await db.invoiceLine.findUnique({where:{id:env.lineId},select:{invoiceId:true}});
    if(line){await db.$queryRaw`SELECT id FROM "Invoice" WHERE id=${line.invoiceId} FOR UPDATE`;await db.$queryRaw`SELECT id FROM "InvoiceLine" WHERE "invoiceId"=${line.invoiceId} ORDER BY id FOR SHARE`;}
    if(env.command==='ALLOCATE'){
      await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'revenue-target:'+d.targetType+':'+d.targetId }))::text`;
      if(d.targetType==='REGULAR')await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${d.targetId} FOR SHARE`;
      else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${d.targetId} FOR SHARE`;
    }
    const s=(await data.states(db,env.lineId))[0]; let outcome;
    if(cancel)outcome=refused('CANCELLED_REQUEST','O pedido foi cancelado antes de ser registado.');
    else if(!s)outcome=refused('NOT_FOUND','Mensalidade não encontrada.');
    else if(s.stateHash!==env.expectedStateHash)outcome=refused('STATE_CHANGED','A mensalidade ou as atribuições mudaram. Consulte e reveja novamente.');
    else if(env.command==='VOID'){
      const a=s.allocations.find(a=>a.id===d.allocationId);
      if(!a||a.voidedAt)outcome=refused('ALLOCATION_CHANGED','Esta parcela já não está ativa nesta mensalidade.');
      else{const saved=await db.revenueAllocation.update({where:{id:a.id},data:{voidedAt:new Date(),voidReason:r.text(d.reason,500,true),activeKey:null}});outcome={applied:true,allocation:data.json(saved)};}
    }else if(!s.valid)outcome=refused('SOURCE_REVIEW','Reveja o documento e anule as parcelas afetadas antes de repartir.');
    else if(d.amountCents>s.availableAmountCents)outcome=refused('OVER_BUDGET','O montante excede a mensalidade ainda disponível.');
    else{
      const t=(await data.targets(db,[{type:d.targetType,id:d.targetId}])).get(d.targetType+':'+d.targetId);
      if(!t||!t.valid||t.hash!==d.targetHash||t.clientId!==s.clientId||t.monthRef!==s.monthRef)outcome=refused('TARGET_CHANGED','Reveja o serviço, o cliente original, o mês e a inclusão no contrato.');
      else if(await db.revenueAllocation.findUnique({where:{activeKey:d.targetType+':'+d.targetId}}))outcome=refused('TARGET_ALLOCATED','Este serviço já tem uma parcela de mensalidade ativa.');
      else{const a=await db.revenueAllocation.create({data:{invoiceId:s.invoiceId,lineId:s.lineId,clientId:s.clientId,monthRef:s.monthRef,amountCents:d.amountCents,targetType:t.type,targetId:t.id,sourceHash:s.source.hash,sourceSnapshot:s.source.snapshot,targetHash:t.hash,targetSnapshot:t.snapshot,activeKey:t.type+':'+t.id,reason:r.text(d.reason,500,true),createdById:actorId}});outcome={applied:true,allocation:data.json(a)};}
    }
    const confirmedAt=new Date(),result={ok:true,receipt:{owner:'ADMIN:'+actorId,requestId:env.requestId,command:env.command,lineId:env.lineId,expectedStateHash:env.expectedStateHash,payloadHash,confirmedAt:confirmedAt.toISOString()},...outcome};
    await db.revenueEvent.create({data:{requestId:env.requestId,actorId,actorName:String(account.name||account.email||'ADMIN').slice(0,180),lineId:env.lineId,command:env.command,payloadHash,request:env,result,createdAt:confirmedAt}});
    return result;
  },{maxWait:15000,timeout:30000});
}
async function receipt(user,requestId) {const id=actor(user);if(!uuid(requestId))r.fail('Pedido inválido.');const event=await prisma.revenueEvent.findUnique({where:{requestId}});if(!event||event.actorId!==id)r.fail('Pedido ainda não confirmado nesta conta.',404);return event.result;}
module.exports={list,detail,candidates,command,receipt};
