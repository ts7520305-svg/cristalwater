'use strict';
const r=require('./expenseLedgerRules'),projection=require('./monthlyFinancialProjection');
const {period}=require('./operationalValueReportService');
const types={REGULAR:'Visita regular',EXTRA:'Visita extra',MAINTENANCE_EQUIPMENT:'Manutenção de equipamento',MAINTENANCE_REMINDER:'Lembrete de serviço',REPAIR:'Reparação'};
const month=value=>typeof value==='string'&&/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
const sample=rows=>({total:rows.length,limit:10,sampleOnly:rows.length>10,rows:rows.slice(0,10)});
const key=(type,id,clientId)=>type+':'+id+':'+clientId;
function sum(values){const n=projection.sum(values);if(n===null)throw Error('Execution values unavailable');return n;}
function costPeriod(a){
  const s=a.targetSnapshot;if(!s||s.type!==a.targetType||s.id!==a.targetId||s.clientId!==a.clientId||a.reviewReasons.includes('TARGET_CHANGED'))return null;
  const fields=require('./expenseCostTargets').executionFields(a.targetType);
  if(r.hash(Object.fromEntries(fields.map(k=>[k,s[k]])))!==a.targetHash||typeof s.endAt!=='string')return null;
  const date=new Date(s.endAt);return Number.isFinite(+date)&&date.toISOString()===s.endAt&&month(s.endAt.slice(0,7))?s.endAt.slice(0,7):null;
}
function revenue(rows){
  const confirmed=rows.filter(a=>a.confirmed),pending=rows.filter(a=>!a.confirmed);
  const grossAmountCents=sum(rows.map(a=>a.grossAmountCents)),confirmedGrossAmountCents=sum(confirmed.map(a=>a.grossAmountCents)),confirmedReductionAmountCents=sum(confirmed.map(a=>a.reductionAmountCents));
  const pendingGrossAmountCents=sum(pending.map(a=>a.grossAmountCents));
  if(grossAmountCents!==confirmedGrossAmountCents+pendingGrossAmountCents)throw Error('Execution revenue partition unavailable');
  return {sourceCount:rows.length,confirmedCount:confirmed.length,pendingCount:pending.length,grossAmountCents,confirmedGrossAmountCents,confirmedReductionAmountCents,confirmedNetAmountCents:confirmedGrossAmountCents-confirmedReductionAmountCents,pendingGrossAmountCents};
}
function costs(rows){
  const confirmed=rows.filter(a=>a.state==='CONFIRMED'),review=rows.filter(a=>a.state==='REVIEW'),mismatch=rows.filter(a=>a.state==='PERIOD_MISMATCH');
  const result={sourceCount:rows.length,confirmedCount:confirmed.length,reviewCount:review.length,periodMismatchCount:mismatch.length,periodMismatchAmountCents:sum(mismatch.map(a=>a.amountCents))};
  for(const [kind,name] of [['MATERIAL','material'],['LABOR','labor'],['OTHER','other'],['PURCHASE','purchase']])result[name+'AmountCents']=sum(confirmed.filter(a=>a.kind===kind).map(a=>a.amountCents));
  result.knownCostCount=confirmed.filter(a=>a.kind!=='PURCHASE').length;
  result.knownCostAmountCents=sum([result.materialAmountCents,result.laborAmountCents,result.otherAmountCents]);
  result.confirmedAllocatedAmountCents=sum(confirmed.map(a=>a.amountCents));
  if(result.confirmedAllocatedAmountCents!==result.knownCostAmountCents+result.purchaseAmountCents||rows.length!==confirmed.length+review.length+mismatch.length)throw Error('Execution cost partition unavailable');
  return result;
}
function build(monthRef,generatedAt,partition,creditStates,expenses){
  const raw=partition.raw,groups=new Map(),credits=new Map();
  for(const s of creditStates){if(!credits.has(s.invoiceId))credits.set(s.invoiceId,[]);if(!s.excluded)credits.get(s.invoiceId).push(s);}
  function ensure(type,id,clientId,clientName){
    const k=key(type,id,clientId);if(!types[type]||!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(clientId)||clientId<=0)throw Error('Execution identity unavailable');
    if(!groups.has(k))groups.set(k,{key:k,serviceType:type,serviceId:id,clientId,clientName,label:types[type]+' #'+id,serviceMonth:monthRef,revenueSources:[],costSources:[]});return groups.get(k);
  }
  for(const t of raw.targets.filter(t=>t.monthRef===monthRef)){
    const notes=credits.get(t.invoiceId)||[],confirmed=notes.every(s=>s.valid&&s.availableAmountCents===0);
    const allocations=notes.filter(s=>s.valid).flatMap(s=>s.allocations).filter(a=>!a.voidedAt&&!a.needsReview&&a.targetType===t.type&&a.targetId===t.id);
    const reductionAmountCents=sum(allocations.map(a=>a.amountCents));if(reductionAmountCents>t.amountCents)throw Error('Execution reduction exceeds source');
    ensure(t.serviceType,t.serviceId,t.clientId,t.clientName).revenueSources.push({serviceType:t.serviceType,serviceId:t.serviceId,clientId:t.clientId,kind:t.type,targetId:t.id,lineId:t.lineId,invoiceId:t.invoiceId,documentMonth:t.documentMonth,serviceMonth:monthRef,label:t.label,grossAmountCents:t.amountCents,reductionAmountCents,netAmountCents:confirmed?t.amountCents-reductionAmountCents:null,confirmed,state:confirmed?'CONFIRMED':notes.some(s=>!s.valid)?'CREDIT_REVIEW':'CREDIT_PENDING'});
  }
  const active=expenses.flatMap(e=>require('./maintenanceCostShareService').project(e.allocations).filter(a=>!a.voidedAt).map(a=>({...a,expenseTitle:e.title,expenseDocument:e.documentNumber,expenseDate:e.expenseDate,expenseCancelled:!!e.cancelledAt})));
  let costUnplacedCount=0,costPeriodMismatchAllMonths=0;
  for(const a of active.filter(a=>Object.hasOwn(types,a.targetType))){
    const executionMonth=costPeriod(a);if(!executionMonth){costUnplacedCount++;continue;}
    const state=a.needsReview||a.expenseCancelled?'REVIEW':a.monthRef!==executionMonth?'PERIOD_MISMATCH':'CONFIRMED';
    if(state==='PERIOD_MISMATCH')costPeriodMismatchAllMonths++;
    if(executionMonth!==monthRef)continue;
    const kind=a.valuationType==='MATERIAL'?'MATERIAL':a.valuationType==='LABOR'?'LABOR':a.stockPurchase?'PURCHASE':'OTHER';
    ensure(a.targetType,a.targetId,a.clientId,a.clientName||a.targetSnapshot.clientName||'Cliente histórico').costSources.push({serviceType:a.targetType,serviceId:a.targetId,clientId:a.clientId,id:a.id,expenseId:a.expenseId,label:a.expenseTitle,documentNumber:a.expenseDocument,expenseDate:a.expenseDate,allocationMonth:a.monthRef,serviceMonth:executionMonth,amountCents:a.amountCents,kind,state,reason:a.reason,...(a.sourceAllocationId?{sourceAllocationId:a.sourceAllocationId,costAttributionBasis:a.costAttributionBasis,maintenanceShareId:a.maintenanceShareId||null}:{})});
  }
  // Unplaced/changed service costs remain visible globally and also block a
  // matching service's cost total; absence of a usable record is never zero cost.
  const unplaced=active.filter(a=>Object.hasOwn(types,a.targetType)&&!costPeriod(a));
  const rows=[...groups.values()].sort((a,b)=>a.clientId-b.clientId||a.serviceType.localeCompare(b.serviceType)||a.serviceId-b.serviceId).map(g=>{
    const rv=revenue(g.revenueSources),cs=costs(g.costSources),unplacedCount=unplaced.filter(a=>key(a.targetType,a.targetId,a.clientId)===g.key).length;
    return {...g,revenue:{...rv,state:!rv.sourceCount?'MISSING':rv.pendingCount?'PENDING':'CONFIRMED',netAmountCents:rv.sourceCount&&!rv.pendingCount?rv.confirmedNetAmountCents:null},costs:{...cs,unplacedCount,amountCents:cs.knownCostCount&&!cs.reviewCount&&!cs.periodMismatchCount&&!unplacedCount?cs.knownCostAmountCents:null},completeRevenue:false,completeOperatingCosts:false,profit:null};
  });
  const allMonths={documentReviewCount:partition.documents.review,lineReviewCount:partition.lines.review,repairExecutionReviewCount:partition.repairExecution.reviewCount,monthlyAllocationReviewCount:partition.monthlyAllocations.reviewCount,creditAllocationReviewCount:creditStates.reduce((n,s)=>n+s.reviewCount,0),costAllocationReviewCount:active.filter(a=>a.needsReview||a.expenseCancelled).length,costUnplacedCount,costPeriodMismatchCount:costPeriodMismatchAllMonths,nonServiceCostAllocationCount:active.filter(a=>!Object.hasOwn(types,a.targetType)).length};
  const rv=revenue(rows.flatMap(g=>g.revenueSources)),cs=costs(rows.flatMap(g=>g.costSources));
  const summary={version:1,monthRef,currency:'EUR',generatedAt:generatedAt.toISOString(),state:Object.entries(allMonths).some(([k,v])=>k!=='nonServiceCostAllocationCount'&&v>0)?'REVIEW':'PARTIAL',completeRevenue:false,completeOperatingCosts:false,profit:null,limitApplied:null,
    basis:{services:'SERVICES_WITH_ELIGIBLE_REVENUE_OR_EXPENSE_ATTRIBUTION',period:'CONFIRMED_SERVICE_EXECUTION_MONTH_UTC',revenue:'CURRENT_DOCUMENT_VALUES_ALL_DOCUMENT_MONTHS',costs:'EXPLICIT_ATTRIBUTION_MATCHING_EXECUTION_MONTH',stock:'PURCHASE_ATTRIBUTION_SEPARATE_FROM_MEASURED_CONSUMPTION',cashIncluded:false,historicalClosingBalance:false},
    serviceCount:rows.length,clientCount:new Set(rows.map(g=>g.clientId)).size,servicesWithoutRevenueCount:rows.filter(g=>!g.revenue.sourceCount).length,servicesWithoutKnownCostCount:rows.filter(g=>!g.costs.knownCostCount).length,revenue:rv,costs:cs,allMonths};
  return {summary,rows};
}
function present(row){const {revenueSources,costSources,...rest}=row;return {...rest,revenueSources:sample(revenueSources),costSources:sample(costSources)};}
const publicSummary=data=>({...data.summary,services:sample(data.rows.map(present))});
function selection(query){
  r.object(query,['monthRef','q','page','mode','serviceType','serviceId','clientId']);
  const selected={monthRef:period({monthRef:query.monthRef}).monthRef,q:r.text(query.q||'',160),page:r.queryId(query.page===undefined?'1':query.page),mode:query.mode||'SERVICES',serviceType:null,serviceId:null,clientId:null};
  if(!['SERVICES','REVENUE','COSTS'].includes(selected.mode))r.fail('Vista de execução inválida.');
  if(selected.mode==='SERVICES'){if(['serviceType','serviceId','clientId'].some(k=>query[k]!==undefined))r.fail('Seleção de serviço inválida.');}
  else{if(!Object.hasOwn(types,query.serviceType))r.fail('Tipo de serviço inválido.');selected.serviceType=query.serviceType;selected.serviceId=r.queryId(query.serviceId);selected.clientId=r.queryId(query.clientId);}
  return selected;
}
async function report(query){
  const selected=selection(query),{prisma}=require('../prismaClient');
  return prisma.$transaction(async db=>{
    const coverage=require('./financialRevenueCoverageService'),at=new Date();
    const [invoices,expenses]=await Promise.all([db.invoice.findMany({select:coverage.documentSelect}),require('./expenseLedgerService').rows(db)]);
    const partition=await coverage.partition(db,null,at,invoices),states=await require('./creditRevenueData').states(db,{raw:partition.raw,asOf:at});
    const data=build(selected.monthRef,at,partition,states,expenses),service=selected.mode==='SERVICES'?null:data.rows.find(s=>s.key===key(selected.serviceType,selected.serviceId,selected.clientId));
    const source=selected.mode==='SERVICES'?data.rows.map(present):service?.[selected.mode==='REVENUE'?'revenueSources':'costSources']||[];
    const rows=source.filter(s=>!selected.q||r.normalized([s.label,s.clientName,s.clientId,s.serviceId,s.documentNumber,s.invoiceId,s.expenseId].join(' ')).includes(r.normalized(selected.q)));
    return {ok:true,selection:selected,pageSize:10,total:rows.length,summary:publicSummary(data),service:service?present(service):null,rows:rows.slice((selected.page-1)*10,selected.page*10)};
  },{isolationLevel:'RepeatableRead',timeout:30000,maxWait:15000});
}
module.exports={build,publicSummary,report,types};
