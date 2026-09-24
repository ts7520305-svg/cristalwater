'use strict';
const { randomUUID, randomInt } = require('node:crypto'), { prisma } = require('../../src/prismaClient');
const ledger = require('../../src/services/expenseLedgerService'), equipment = require('../../src/business/equipment/EquipmentMaintenanceBusiness'), billing = require('../../src/business/equipment/MaintenanceBillingBusiness');
const links = require('../../src/services/reminderVisitService'), resources = require('../../src/services/reminderVisitResourceService');
module.exports = async function (admin) {
  if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
  const tag='Month share '+randomUUID().slice(0,8), parentMonth=new Date().toISOString().slice(0,7), at=new Date(Date.parse(parentMonth+'-01T00:00:00Z')-10000);
  const currentMonth=at.toISOString().slice(0,7), endAt=new Date(+at+12000), sameId=randomInt(610000000,690000000);
  const client=await prisma.client.create({data:{name:tag+' <img src=x>'}}),pool=await prisma.pool.create({data:{clientId:client.id,name:tag}}),tech=await prisma.technician.create({data:{name:tag,active:true}}),extraTech=await prisma.technician.create({data:{name:tag+' extra',active:true}}),product=await prisma.inventoryProduct.create({data:{name:'SAL '+randomUUID(),unit:'KG',defaultCost:999}});
  const expenses=[],purchases=[],plans=[],completions=[],requests=[],reminders=[],reviews={REGULAR:[],EXTRA:[]};
  const stamp=s=>new Date(+at+s*1000).toISOString(),own=(start,end)=>({startAt:stamp(start),endAt:stamp(end)});
  // Build authentic historical receipts while a QA-only clock is before the
  // month boundary. Do not rewrite their original payloads after completion.
  const RealDate=Date,fixed=+at+9500;function FixtureDate(...args){return new RealDate(...(args.length?args:[fixed]));}FixtureDate.prototype=RealDate.prototype;Object.setPrototypeOf(FixtureDate,RealDate);FixtureDate.now=()=>fixed;
  global.Date=FixtureDate;try {
  for(const type of ['REGULAR','EXTRA']) {
    const technicianId=type==='REGULAR'?tech.id:extraTech.id;
    await prisma[type==='REGULAR'?'serviceVisit':'extraVisit'].create({data:{id:sameId,clientId:client.id,poolId:pool.id,technicianId,status:'IN_PROGRESS',startAt:at}});
    for(let i=0;i<3;i++) {
      const plan=(await equipment.create(admin,pool.id,{component:'FILTER',title:tag+' '+type+' '+i,instructions:'Conferir intervalo e material próprio',intervalUnit:'MONTHS',intervalCount:1,nextDue:currentMonth+'-01'})).plan;plans.push(plan.id);
      const requestId=randomUUID();requests.push(requestId);
      const body={requestId,visitType:type,visitId:sameId,poolId:pool.id,expectedVersion:plan.version,notes:'Execução anterior com comprovativo atual',confirmed:true,materials:{mode:'DECLARED',items:[{productName:product.name,unit:'KG',quantity:'0.1'}]},workTime:i===0?{intervals:[own(0,2),own(3,4)]}:i===1?own(4,6):own(6,7)};
      const result=await equipment.complete(admin,plan.id,body);if(!result.applied)throw Error(JSON.stringify(result));completions.push(result.completion.id);
      const source=(await billing.list(admin,pool.id,{kind:'EQUIPMENT'})).rows.find(s=>s.sourceId===result.completion.id);
      await billing.review(admin,'EQUIPMENT',source.sourceId,{expectedVersion:source.expectedVersion,expectedClientId:client.id,expectedPoolId:pool.id,mode:'INCLUDED',amount:'0.00',note:'Cliente e mês históricos conferidos',confirmed:true});
      reviews[type].push({id:result.completion.id,planId:plan.id,body,result});
    }
    await prisma[type==='REGULAR'?'serviceVisit':'extraVisit'].update({where:{id:sameId},data:{status:'DONE',endAt}});
    await prisma.stockMovement.create({data:{visitId:type==='REGULAR'?sameId:null,extraVisitId:type==='EXTRA'?sameId:null,productId:product.id,productName:product.name,unit:'KG',quantity:0.6,movementType:'CONSUMPTION',clientId:client.id,poolId:pool.id,technicianId,createdAt:new Date(+endAt-1)}});
  }
  } finally { global.Date=RealDate; }
  const body=p=>{if(!p.available)throw Error(JSON.stringify(p));return {requestId:randomUUID(),...p.selection,previewHash:p.hash,reason:'Origem e recursos próprios confirmados',confirmed:true};};
  for(const type of ['REGULAR','EXTRA']) {
    const technicianId=type==='REGULAR'?tech.id:extraTech.id;
    const row=await prisma.generalReminder.create({data:{title:tag+' '+type,dueAt:new Date(),category:'POOL_SERVICE_REMINDER',status:'DONE',clientId:client.id,poolId:pool.id,technicianId,completedAt:new Date(+at+9500)}});reminders.push(row);
    const source=(await billing.list(admin,pool.id,{kind:'REMINDER'})).rows.find(s=>s.sourceId===row.id);
    await billing.review(admin,'REMINDER',row.id,{expectedVersion:source.expectedVersion,expectedClientId:client.id,expectedPoolId:pool.id,mode:'INCLUDED',amount:'0.00',note:'Cliente histórico do lembrete conferido',confirmed:true});
    const link=await links.command(admin,row.id,body((await links.preview(admin,row.id,{action:'LINK',associationId:null,visitType:type,visitId:sameId})).preview));if(!link.applied)throw Error(JSON.stringify(link));
    const data={technicianId,materials:{mode:'DECLARED',items:[{productName:product.name.toUpperCase(),unit:'KG',quantity:'0.2'}]},workIntervals:[{startedAt:stamp(7),endedAt:stamp(8)},{startedAt:stamp(8),endedAt:stamp(9)}]};
    const result=await resources.command(admin,row.id,body((await resources.preview(admin,row.id,{action:'DECLARE',recordId:null,data})).preview));if(!result.applied)throw Error(JSON.stringify(result));
  }
  async function send(command,expenseId,data){const e=await prisma.companyExpense.findUniqueOrThrow({where:{id:expenseId}});return ledger.command(admin,{requestId:randomUUID(),command,expenseId,expectedVersion:e.version,data});}
  async function salary(type='REGULAR'){
    const result=await ledger.command(admin,{requestId:randomUUID(),command:'CREATE',expenseId:null,expectedVersion:null,data:{title:tag+' '+type,supplierId:null,supplierName:'QA salary',documentNumber:'',expenseDate:parentMonth+'-01',dueDate:null,amountCents:500,category:'LABOR',notes:'',sourceType:'MANUAL',sourceId:null,sourceHash:null,reason:'',confirmed:true}});if(!result.applied)throw Error(JSON.stringify(result));expenses.push(result.expenseId);
    for(const [command,data] of [['SET_LABOR_BASIS',{technicianId:type==='REGULAR'?tech.id:extraTech.id,periodStart:at.toISOString().slice(0,10),periodEnd:parentMonth+'-01',paidMinutes:1,reason:'Tempo pago confirmado no mês de origem',confirmed:true}],['RECORD_PAYMENT',{amountCents:500,paidOn:parentMonth+'-01',method:'TRANSFER',reference:'QA original'}]]){const v=await send(command,result.expenseId,data);if(!v.applied)throw Error(JSON.stringify(v));}
    return {expenseId:result.expenseId};
  }
  async function purchase(){
    const p=await prisma.stockPurchase.create({data:{supplierName:tag,invoiceDate:new Date(parentMonth+'-01T00:00:00Z'),totalAmount:1,items:{create:{productName:product.name,productId:product.id,unit:'KG',quantity:0.3,unitCost:1/0.3,totalCost:1}}},include:{items:true}});purchases.push(p.id);
    const source=await require('../../src/services/expenseSourceService').source(prisma,'STOCK_PURCHASE',p.id),v=await ledger.command(admin,{requestId:randomUUID(),command:'CREATE',expenseId:null,expectedVersion:null,data:{...source.suggested,title:tag,dueDate:null,notes:'',sourceType:source.type,sourceId:source.id,sourceHash:source.hash,reason:'Compra histórica confirmada',confirmed:true}});if(!v.applied)throw Error(JSON.stringify(v));expenses.push(v.expenseId);return {expenseId:v.expenseId,item:p.items[0]};
  }
  async function value(kind,source,type='REGULAR'){
    const p=(await ledger.valuationPreview(source.expenseId,{kind,targetType:type,targetId:String(sameId),...(kind==='MATERIAL'?{purchaseItemId:String(source.item.id),quantity:'0.3'}:{})})).preview;
    const result=await send('VALUE_'+kind,source.expenseId,{...Object.fromEntries(['kind','targetType','targetId','targetHash','monthRef','purchaseItemId','quantity','amountCents','valuationHash'].map(k=>[k,p[k]])),previewHash:p.hash,reason:'Custo original da visita confirmado',confirmed:true});if(!result.applied)throw Error(JSON.stringify(result));return result.allocation;
  }
  async function immutable(){return require('../../src/services/expenseLedgerRules').hash({allocations:await prisma.expenseAllocation.findMany({where:{expenseId:{in:expenses}},orderBy:{id:'asc'}}),payments:await prisma.expensePayment.findMany({where:{expenseId:{in:expenses}},orderBy:{id:'asc'}}),stock:await prisma.stockMovement.findMany({where:{poolId:pool.id},orderBy:{id:'asc'}}),completed:await prisma.equipmentMaintenanceCompletion.findMany({where:{id:{in:completions}},orderBy:{id:'asc'}}),receipts:await prisma.fieldWriteRequest.findMany({where:{scope:'EQUIPMENT_MAINTENANCE',requestId:{in:requests}},orderBy:{id:'asc'}})});}
  async function cleanup(){
    for(const model of ['expenseEvent','expensePayment','expenseAllocation','expenseLaborBasis'])await prisma[model].deleteMany({where:{expenseId:{in:expenses}}});await prisma.companyExpense.deleteMany({where:{id:{in:expenses}}});await prisma.stockPurchase.deleteMany({where:{id:{in:purchases}}});
    await prisma.fieldWriteRequest.deleteMany({where:{OR:[{scope:'EQUIPMENT_MAINTENANCE',requestId:{in:requests}},{scope:'EQUIPMENT_TIME_REVIEW',resourceId:{in:completions}},{scope:{in:[links.rules.scope,resources.rules.scope]},resourceId:{in:reminders.map(r=>r.id)}}]}});
    await prisma.technicalHistory.deleteMany({where:{poolId:pool.id}});await prisma.userAuditLog.deleteMany({where:{OR:[{action:'EQUIPMENT_TIME_REVIEW',entityId:{in:completions.map(String)}},{action:{in:[links.rules.scope,resources.rules.scope]},entityId:{in:reminders.map(r=>String(r.id))}}]}});
    await prisma.operationalReminder.deleteMany({where:{sourceKey:{in:[...completions.map(id=>'maintenance-billing:EQUIPMENT:'+id),...reminders.map(r=>'maintenance-billing:REMINDER:'+r.id)]}}});
    await prisma.generalReminder.deleteMany({where:{id:{in:reminders.map(r=>r.id)}}});await prisma.equipmentMaintenanceCompletion.deleteMany({where:{id:{in:completions}}});await prisma.equipmentMaintenancePlan.deleteMany({where:{id:{in:plans}}});
    await prisma.stockMovement.deleteMany({where:{poolId:pool.id}});await prisma.serviceVisit.delete({where:{id:sameId}});await prisma.extraVisit.delete({where:{id:sameId}});
  }
  return {tag,currentMonth,parentMonth,at,endAt,stamp,sameId,client,pool,tech,extraTech,product,reviews,reminders,expenses,salary,purchase,value,send,immutable,cleanup};
};
