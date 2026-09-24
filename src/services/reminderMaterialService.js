'use strict';
const { prisma } = require('../prismaClient');
const writes = require('./fieldWriteRequestService'), resources = require('./reminderResourceService');
const rules = require('../../frontend/cw-reminder-material-rules'), stock = require('../dal/EquipmentStockRepository');
const { normalizeRole } = require('../utils/roles');
const json = value => JSON.parse(JSON.stringify(value));
const refuse = (code,message) => ({available:false,code,message});
const id = v => { const n=Number(v); if(!rules.positive(n)||typeof v!=='number'&&String(n)!==v)writes.fail('Identificador de lembrete inválido.'); return n; };
function admin(actor) { if(normalizeRole(actor?.role)!=='ADMIN')writes.fail('Só a administração pode confirmar estes consumos.',403); return writes.owner(actor); }
function parse(body,command=false) {
  if (!rules.fields(body,command?['requestId','action','recordId','declarationId','items','previewHash','reason','confirmed']:['action','recordId','declarationId','items'])) writes.fail('Conserve a seleção dos materiais e da origem.');
  try { rules.input({action:body.action,recordId:body.recordId,declarationId:body.declarationId,items:body.items}); } catch (_) { writes.fail('Escolha a declaração e o stock de origem de cada material.'); }
  if(command&&(!rules.uuid(body.requestId)||!rules.sha(body.previewHash)||!rules.reason(body.reason)||body.confirmed!==true))writes.fail('Indique o motivo e confirme expressamente o consumo ou a reposição.');
}
function decimal(value) {
  const n=require('./expenseValuationSources').quantity(value);
  return n===null?null:rules.decimal(n);
}
const balanceFacts = b => b?{id:b.id,scope:b.scope,vehicleId:b.vehicleId,productId:b.productId,productName:b.productName,category:b.category,unit:b.unit,quantity:decimal(b.quantity)}:null;
const movementFacts = m => ({...json(Object.fromEntries(rules.movementFields.map(k=>[k,m[k]]))),quantity:decimal(m.quantity)});
const physicalKey=b=>JSON.stringify([b.scope,b.vehicleId,String(b.productName).trim().replace(/\s+/g,' ').toUpperCase(),String(b.unit).trim().replace(/\s+/g,' ').toUpperCase()]);
async function reserved(db) {
  const rows=await db.operationalLock.findMany({where:{lockType:'REPAIR_STOCK_RESERVATION',status:'APPROVED'},orderBy:{id:'asc'},select:{id:true,payload:true}}),totals=new Map();
  for(const row of rows) {
    if(!Array.isArray(row.payload?.items)||!row.payload.items.length)return null;
    for(const item of row.payload.items) {
      const b={scope:item.scope||row.payload.scope||'CENTRAL',vehicleId:item.vehicleId??row.payload.vehicleId??null,productName:item.productName,unit:item.unit},q=decimal(item.quantity);
      if(!['CENTRAL','VEHICLE'].includes(b.scope)||(b.scope==='VEHICLE'?!rules.positive(b.vehicleId):b.vehicleId!==null)||typeof b.productName!=='string'||!b.productName.trim()||typeof b.unit!=='string'||!b.unit.trim()||q===null||rules.quantity(q)<=0n)return null;
      const key=physicalKey(b);totals.set(key,(totals.get(key)||0n)+rules.quantity(q));
    }
  }
  return {totals,hash:writes.hash(rows)};
}
async function journal(db,reminderId) {
  const receipts=await db.fieldWriteRequest.findMany({where:{scope:rules.scope,resourceId:reminderId},orderBy:{id:'asc'}});
  const movementIds=[...new Set(receipts.flatMap(r=>Array.isArray(r.response?.event?.movements)?r.response.event.movements.map(m=>m?.id).filter(rules.positive):[]))];
  const movements=movementIds.length?await db.stockMovement.findMany({where:{id:{in:movementIds}}}):[],byId=new Map(movements.map(m=>[m.id,movementFacts(m)]));
  let valid=true,headHash=null,active=null; const records=[],seen=new Set();
  for(const r of receipts) {
    try {
      const v=await rules.response(r.response,r.response?.envelope,r.owner,reminderId,writes.hash);
      if(v.receipt.payloadHash!==r.payloadHash||v.receipt.requestId!==r.requestId)throw Error('Receipt changed');
      if(!v.applied)continue;
      const e=v.event,p=e.preview;
      if(p.previousHash!==headHash)throw Error('Chain changed');
      for(const m of e.movements) { if(seen.has(m.id)||!byId.has(m.id)||writes.hash(m)!==writes.hash(byId.get(m.id)))throw Error('Movement changed'); seen.add(m.id); }
      if(p.selection.action==='CONSUME') { if(active)throw Error('Duplicate consumption'); active={id:e.id,result:v,hash:v.eventHash,voidResult:null,state:'CONFIRMED'}; records.push(active); }
      else { if(!active||p.selection.recordId!==active.id||writes.hash(p.original)!==writes.hash(active.result))throw Error('Reversal changed'); active.voidResult=v; active.state='VOIDED'; active=null; }
      headHash=v.eventHash;
    } catch (_) { valid=false; }
  }
  return {valid,headHash,records,active,movementIds};
}
async function read(db,reminderId) {
  const [state,c]=await Promise.all([journal(db,reminderId),resources.context(db,reminderId)]);
  for(const row of state.records) {
    if(row.voidResult)continue;
    const declared=c.records?.find(d=>d.id===row.result.event.preview.selection.declarationId), reasons=[];
    if(!state.valid)reasons.push('CONSUMPTION_EVIDENCE_CHANGED');
    if(!declared?.intact||declared.voidedAt||!c.journalValid||writes.hash(declared.result)!==writes.hash(row.result.event.preview.declaration))reasons.push('DECLARATION_EVIDENCE_CHANGED');
    if(!declared||declared.reasons.some(r=>r!=='RECORDED_TIME_OVERLAP'))reasons.push('EXECUTION_EVIDENCE_CHANGED');
    row.reasons=reasons; row.state=reasons.length?'REVIEW':'CONFIRMED';
  }
  return {...state,resources:c};
}
async function lock(db,reminderId) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-valuation:MAINTENANCE_REMINDER:'+reminderId }))::text`;
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'reminder-resources:'+reminderId }))::text`;
  await require('./expenseMaintenanceTargets').get(db,'MAINTENANCE_REMINDER',reminderId,true);
  await db.$queryRaw`SELECT id FROM "ReminderResourceDeclaration" WHERE "reminderId"=${reminderId} FOR SHARE`;
  await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE scope IN ('REMINDER_RESOURCES','REMINDER_MATERIAL_CONSUMPTION') AND "resourceId"=${reminderId} FOR SHARE`;
  const state=await journal(db,reminderId);
  for(const movementId of [...state.movementIds].sort((a,b)=>a-b))await db.$queryRaw`SELECT id FROM "StockMovement" WHERE id=${movementId} FOR SHARE`;
}
async function detail(actor,value) {
  admin(actor); const reminderId=id(value);
  return prisma.$transaction(async db=>{
    const c=await read(db,reminderId),r=c.resources;
    if(!r.available)return {ok:true,detail:r};
    const declaration=r.active.find(row=>row.intact&&!row.voidedAt&&row.snapshot.preview.proposed.materials?.mode==='DECLARED')||null;
    const items=declaration?.snapshot.preview.proposed.materials.items||[];
    // Show exact balance identities. Accented stock names are compared through
    // the declaration normalizer, but their original physical keys are retained.
    const balances=items.length?await db.stockBalance.findMany({where:{scope:{in:['CENTRAL','VEHICLE']}},orderBy:{id:'asc'}}):[];
    const candidates=balances.filter(b=>items.some(i=>rules.normalize(b.productName)===i.productName&&rules.normalize(b.unit)===i.unit)).map(balanceFacts).filter(rules.balance);
    const vehicles=candidates.some(b=>b.vehicleId)?await db.vehicle.findMany({where:{id:{in:[...new Set(candidates.map(b=>b.vehicleId).filter(Boolean))]}},select:{id:true,plate:true}}):[];
    return {ok:true,detail:{available:true,reminderId,title:r.title,clientName:r.clientName,poolName:r.poolName,origin:declaration?.snapshot.preview.origin||c.records[0]?.result.event.preview.origin||null,declaration:declaration?.result||null,records:c.records,journalValid:c.valid,candidates,vehicles,canConsume:!!declaration&&r.journalValid&&declaration.reasons.every(x=>x==='RECORDED_TIME_OVERLAP')&&c.valid&&!c.active,canReverse:c.valid&&!!c.active}};
  },{isolationLevel:'RepeatableRead',timeout:25000,maxWait:15000});
}
async function calculate(db,reminderId,body,locked=false) {
  parse(body); if(locked)await lock(db,reminderId);
  const c=await read(db,reminderId),r=c.resources;
  if(!c.valid)return refuse('MATERIAL_HISTORY_REVIEW','O histórico ou os movimentos de stock precisam de revisão.');
  let declaration=null,original=null,origin,items=null,affectedCosts=null;
  if(body.action==='REVERSE') {
    if(!c.active||c.active.id!==body.recordId)return refuse('CONSUMPTION_CHANGED','O consumo já foi anulado ou mudou.');
    original=c.active.result; origin=original.event.preview.origin;
    const oldItems=original.event.preview.items;
    if(locked)for(const old of [...oldItems].sort((a,b)=>JSON.stringify([a.balance.scope,a.balance.vehicleId,a.balance.productName,a.balance.unit]).localeCompare(JSON.stringify([b.balance.scope,b.balance.vehicleId,b.balance.productName,b.balance.unit]))))await stock.lockBalance(db,old.balance);
    if(locked)for(const old of [...oldItems].sort((a,b)=>a.balance.id-b.balance.id))await db.$queryRaw`SELECT id FROM "StockBalance" WHERE id=${old.balance.id} FOR UPDATE`;
    const current=await db.stockBalance.findMany({where:{id:{in:oldItems.map(i=>i.balance.id)}}});items=[];
    for(const old of oldItems) {
      const b=balanceFacts(current.find(b=>b.id===old.balance.id));
      if(!rules.balance(b)||Object.keys(b).filter(k=>k!=='quantity').some(k=>b[k]!==old.balance[k]))return refuse('STOCK_ORIGIN_REVIEW','A identificação do stock original mudou. Reveja a reposição antes de anular.');
      items.push({itemIndex:old.itemIndex,balance:b,quantity:old.quantity,afterQuantity:rules.decimal(rules.quantity(b.quantity)+rules.quantity(old.quantity))});
    }
    const costs=await db.expenseAllocation.findMany({where:{targetType:'MAINTENANCE_REMINDER',serviceReminderId:reminderId,valuationType:'MATERIAL',voidedAt:null,valuationSnapshot:{path:['source','consumption','event','id'],equals:body.recordId}},orderBy:{id:'asc'}});
    affectedCosts=costs.map(a=>({allocationId:a.id,expenseId:a.expenseId,amountCents:a.amountCents,allocationHash:writes.hash(json(a))}));
  } else {
    const d=r.active?.find(row=>row.id===body.declarationId);
    if(c.active)return refuse('ACTIVE_CONSUMPTION','Já existe consumo ativo neste lembrete. Anule-o expressamente antes de corrigir.');
    if(!d?.intact||d.voidedAt||!r.journalValid||d.reasons.some(x=>x!=='RECORDED_TIME_OVERLAP')||d.snapshot.preview.proposed.materials?.mode!=='DECLARED')return refuse('DECLARATION_REVIEW','Confirme a origem e os materiais próprios do lembrete.');
    declaration=d.result; origin=d.snapshot.preview.origin;
    const declared=declaration.event.preview.proposed.materials.items;
    if(body.items.length!==declared.length)return refuse('MATERIAL_SELECTION_REVIEW','Escolha uma origem para cada material declarado.');
    let balances=await db.stockBalance.findMany({where:{id:{in:body.items.map(i=>i.balanceId)}}});
    if(locked) {
      // The same inventory advisory keys are used by visits, transfers and repairs.
      const sorted=[...balances].sort((a,b)=>JSON.stringify([a.scope,a.vehicleId,a.productName,a.unit]).localeCompare(JSON.stringify([b.scope,b.vehicleId,b.productName,b.unit])));
      try { for(const b of sorted) { const current=await stock.lockBalance(db,b); if(current?.id!==b.id)return refuse('STOCK_ORIGIN_REVIEW','O saldo de origem mudou ou está duplicado.'); } }
      catch(e) { if(e.message.startsWith('STOCK_BALANCE_AMBIGUOUS'))return refuse('STOCK_ORIGIN_REVIEW','Existem saldos duplicados na origem. Reveja o stock.'); throw e; }
      for(const b of [...balances].sort((a,b)=>a.id-b.id))await db.$queryRaw`SELECT id FROM "StockBalance" WHERE id=${b.id} FOR UPDATE`;
      const current=await db.stockBalance.findMany({where:{id:{in:body.items.map(i=>i.balanceId)}}});
      if(current.some(b=>{const old=balances.find(x=>x.id===b.id);return !old||['scope','vehicleId','productName','unit'].some(k=>old[k]!==b[k]);}))return refuse('STOCK_ORIGIN_REVIEW','A identificação do stock mudou.');
      balances=current;
    }
    const reservations=await reserved(db);if(!reservations)return refuse('STOCK_RESERVATION_REVIEW','As reservas de stock precisam de revisão antes de confirmar novo consumo.');
    items=[];
    for(const [n,i] of body.items.entries()) {
      const b=balanceFacts(balances.find(b=>b.id===i.balanceId)),d=declared[n];
      if(!rules.balance(b)||rules.normalize(b.productName)!==d.productName||rules.normalize(b.unit)!==d.unit)return refuse('STOCK_ORIGIN_REVIEW','O produto ou a unidade do stock não corresponde à declaração.');
      if(b.scope==='VEHICLE'&&!await db.vehicle.findUnique({where:{id:b.vehicleId},select:{id:true}}))return refuse('STOCK_ORIGIN_REVIEW','A viatura do stock já não está disponível.');
      const available=rules.quantity(b.quantity),q=rules.quantity(d.quantity);
      const reservedQuantity=reservations.totals.get(physicalKey(b))||0n;
      if(available-reservedQuantity<q)return refuse('STOCK_INSUFFICIENT','Stock livre insuficiente para '+d.productName+'. Reveja também as quantidades reservadas para reparações.');
      items.push({itemIndex:n+1,balance:b,quantity:d.quantity,afterQuantity:rules.decimal(available-q),reservedQuantity:rules.decimal(reservedQuantity),reservationHash:reservations.hash});
    }
  }
  const value={schema:1,basis:rules.basis,reminderId,selection:body,origin,previousHash:c.headHash,contextHash:writes.hash({headHash:c.headHash,valid:c.valid,declaration:declaration?writes.hash(declaration):null,resourceState:body.action==='CONSUME'?r.contextHash:null}),declaration,original,items,affectedCosts};
  return rules.preview({available:true,...value,hash:writes.hash(value)},writes.hash);
}
async function preview(actor,value,body) { admin(actor);const rid=id(value);parse(body);return prisma.$transaction(async db=>({ok:true,preview:await calculate(db,rid,body)}),{isolationLevel:'RepeatableRead',timeout:25000,maxWait:15000}); }
async function command(actor,value,body) {
  const owner=admin(actor),reminderId=id(value);parse(body,true);const {requestId,...payload}=body,request=writes.context(actor,rules.scope,reminderId,requestId,payload);
  return prisma.$transaction(async db=>{
    const saved=await writes.recover(db,request);if(saved)return saved;
    const p=await calculate(db,reminderId,{action:body.action,recordId:body.recordId,declarationId:body.declarationId,items:body.items},true);
    if(!p.available||p.hash!==body.previewHash)return writes.confirm(db,request,{ok:true,applied:false,envelope:body,code:p.code||'PREVIEW_CHANGED',message:p.message||'A origem, o saldo ou os custos mudaram. Reveja e confirme novamente.'});
    const reverse=body.action==='REVERSE',items=p.items,createdAt=new Date(),movements=[];
    // Acquire every physical balance in stable order before changing any item.
    for(const item of [...items].sort((a,b)=>JSON.stringify([a.balance.scope,a.balance.vehicleId,a.balance.productName,a.balance.unit]).localeCompare(JSON.stringify([b.balance.scope,b.balance.vehicleId,b.balance.productName,b.balance.unit]))))await stock.lockBalance(db,item.balance);
    for(const item of items) {
      const b=item.balance,q=Number(item.quantity);
      // Both the physical inventory key and this existing row were locked by
      // calculate. Store the exact reviewed quantity without changing product
      // identity or filling in an unknown category from a generic default.
      await db.stockBalance.update({where:{id:b.id},data:{quantity:Number(item.afterQuantity)}});
      const m=await db.stockMovement.create({data:{movementType:reverse?'RETURN':'CONSUMPTION',scopeFrom:reverse?'REMINDER':b.scope,scopeTo:reverse?b.scope:'REMINDER',vehicleId:b.vehicleId,productId:b.productId,productName:b.productName,category:b.category,unit:b.unit,quantity:q,clientId:p.origin.clientId,poolId:p.origin.poolId,technicianId:p.origin.technicianId,createdBy:owner,createdAt,notes:(reverse?'Anulação do consumo '+body.recordId:'Consumo próprio')+' · Lembrete #'+reminderId+' · '+requestId}});
      movements.push(movementFacts(m));
    }
    const event={schema:1,basis:rules.basis,id:requestId,owner,reminderId,reason:body.reason,createdAt:createdAt.toISOString(),preview:p,movements};
    const result=await writes.confirm(db,request,{ok:true,applied:true,envelope:body,event,eventHash:writes.hash(event)});
    await rules.response(result,body,owner,reminderId,writes.hash);
    await db.technicalHistory.create({data:{poolId:p.origin.poolId,type:rules.scope,status:reverse?'REVERSED':'CONSUMED',message:'Materiais do lembrete #'+reminderId+': '+body.reason,description:JSON.stringify({requestId,eventHash:result.eventHash,movementIds:movements.map(m=>m.id)}),performedAt:createdAt}});
    await db.userAuditLog.create({data:{actor:owner,action:rules.scope,entity:'GeneralReminder',entityId:String(reminderId),metadata:{requestId,eventHash:result.eventHash,action:body.action}}});
    return result;
  },{isolationLevel:'ReadCommitted',timeout:30000,maxWait:15000});
}
async function recover(actor,requestId) { const owner=admin(actor);if(!rules.uuid(requestId))writes.fail('Identificador de pedido inválido.');const row=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner,requestId}}});if(!row||row.scope!==rules.scope)writes.fail('Não existe confirmação deste pedido para esta conta.',404);return row.response; }
module.exports={detail,preview,command,recover,read,journal,calculate,lock,balanceFacts,movementFacts,rules};
