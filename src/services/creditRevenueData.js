'use strict';
const r=require('./expenseLedgerRules'),projection=require('./monthlyFinancialProjection');
const json=value=>JSON.parse(JSON.stringify(value));
const key=t=>t.type+':'+t.id;
const sample=rows=>({total:rows.length,limit:10,sampleOnly:rows.length>10,rows:rows.slice(0,10)});
function sum(values){const n=projection.sum(values);if(n===null)throw Error('Credit attribution total unavailable');return n;}
async function states(db,options={}) {
  if(Number.isSafeInteger(options))options={lineId:options};
  const allocations=await db.creditRevenueAllocation.findMany({orderBy:{id:'asc'}});
  const coverage=require('./financialRevenueCoverageService');
  const invoices=await db.invoice.findMany({where:{OR:[{id:{in:allocations.map(a=>a.invoiceId)}},{lines:{some:{OR:[{type:{contains:'CREDIT_NOTE',mode:'insensitive'}},{lineType:{contains:'CREDIT_NOTE',mode:'insensitive'}}]}}}]},select:coverage.documentSelect});
  if(!invoices.length&&!allocations.length)return [];
  const {raw}=await coverage.partition(db,null,options.asOf||new Date(),invoices,options.monthlyStates);
  const sources=new Map(raw.sources.map(s=>[s.lineId,s])),targets=new Map(raw.targets.map(t=>[key(t),t]));
  const active=allocations.filter(a=>!a.voidedAt),reservedTargets=new Map();
  for(const a of active){const k=a.targetType+':'+a.targetId;reservedTargets.set(k,sum([reservedTargets.get(k)||0,a.amountCents]));}
  const rows=[...new Set([...sources.keys(),...allocations.map(a=>a.lineId)])].sort((a,b)=>b-a).map(lineId=>{
    const current=sources.get(lineId),history=allocations.filter(a=>a.lineId===lineId),historical=history[0]?.sourceSnapshot;
    const reserved=sum(history.filter(a=>!a.voidedAt).map(a=>a.amountCents));
    const over=!current||current.amountCents===null||reserved>current.amountCents;
    const decorated=history.map(a=>{
      const t=targets.get(a.targetType+':'+a.targetId);
      const reason=!current?'SOURCE_MISSING':!current.valid||current.hash!==a.sourceHash?'SOURCE_CHANGED':over?'OVER_BUDGET':
        !t||t.hash!==a.targetHash||t.invoiceId!==a.invoiceId||t.clientId!==a.clientId||t.lineId!==a.targetLineId||t.serviceType!==a.serviceType||t.serviceId!==a.serviceId||t.monthRef!==a.serviceMonth?'TARGET_CHANGED':
        reservedTargets.get(key(t))>t.amountCents?'TARGET_OVER_BUDGET':null;
      return {...a,needsReview:!a.voidedAt&&!!reason,reviewReason:a.voidedAt?null:reason};
    });
    const reviewCount=decorated.filter(a=>a.needsReview).length,valid=!!current?.valid&&!over&&!reviewCount;
    return {lineId,invoiceId:current?.invoiceId||historical.invoiceId,clientId:current?.clientId||historical.clientId,
      clientName:current?.clientName||history[0]?.targetSnapshot?.clientName||'Cliente histórico',label:current?.label||'Nota de crédito retirada',
      monthRef:current?.monthRef||historical?.documentMonth||null,documentMonth:current?.documentMonth||historical?.documentMonth||null,
      source:current||null,valid,excluded:!reserved&&(!current||current.excluded),reviewCount,amountCents:current?.valid?current.amountCents:null,
      reservedAmountCents:reserved,allocatedAmountCents:valid?reserved:null,availableAmountCents:valid?current.amountCents-reserved:null,allocations:decorated};
  });
  // Review reservations survive source removal. All sibling notes share the same
  // document budget and confirmation hash, including changes to target facts.
  for(const s of rows){
    const siblings=rows.filter(x=>x.invoiceId===s.invoiceId),reviews=siblings.flatMap(x=>x.allocations).filter(a=>a.needsReview);
    if(reviews.length){s.valid=false;s.allocatedAmountCents=null;s.availableAmountCents=null;}
    s.targets=raw.targets.filter(t=>t.invoiceId===s.invoiceId).map(t=>({...t,reservedAmountCents:reservedTargets.get(key(t))||0,availableAmountCents:Math.max(0,t.amountCents-(reservedTargets.get(key(t))||0))}));
    s.stateHash=r.hash({scope:'CREDIT_NOTE_REVENUE',invoiceId:s.invoiceId,sources:siblings.map(x=>({lineId:x.lineId,hash:x.source?.hash||null,valid:x.source?.valid||false})),
      active:siblings.flatMap(x=>x.allocations).filter(a=>!a.voidedAt).map(a=>({id:a.id,amountCents:a.amountCents,sourceHash:a.sourceHash,targetHash:a.targetHash,reviewReason:a.reviewReason})).sort((a,b)=>a.id-b.id),
      targets:s.targets.map(t=>({type:t.type,id:t.id,hash:t.hash,reserved:t.reservedAmountCents})).sort((a,b)=>key(a).localeCompare(key(b)))});
  }
  return rows.filter(s=>!options.lineId||s.lineId===options.lineId);
}
function financial(all,sources,targets) {
  const byId=new Map(all.map(s=>[s.lineId,s])),selected=sources.filter(s=>s.valid&&!s.excluded).map(s=>{const row=byId.get(s.lineId);if(!row)throw Error('Credit note state missing');return row;});
  const allocatedAmountCents=sum(selected.map(s=>s.valid?s.allocatedAmountCents:0)),unallocatedAmountCents=sum(selected.map(s=>s.valid?s.availableAmountCents:0)),reviewAmountCents=sum(selected.map(s=>s.valid?0:s.source.amountCents));
  const amountCents=sum(selected.map(s=>s.source.amountCents));
  if(allocatedAmountCents+unallocatedAmountCents+reviewAmountCents!==amountCents)throw Error('Credit attribution partition unavailable');
  const globalActive=all.flatMap(s=>s.allocations).filter(a=>!a.voidedAt);
  const selectedInvoices=new Set(selected.map(s=>s.invoiceId));
  const services=targets.filter(t=>selectedInvoices.has(t.invoiceId)).map(t=>{
    const notes=selected.filter(s=>s.invoiceId===t.invoiceId),confirmed=notes.every(s=>s.valid&&s.availableAmountCents===0);
    const reductions=notes.filter(s=>s.valid).flatMap(s=>s.allocations).filter(a=>!a.voidedAt&&!a.needsReview&&a.targetType===t.type&&a.targetId===t.id);
    const reductionAmountCents=sum(reductions.map(a=>a.amountCents));
    if(reductionAmountCents>t.amountCents)throw Error('Credit target budget unavailable');
    return {invoiceId:t.invoiceId,clientId:t.clientId,clientName:t.clientName,targetType:t.type,targetId:t.id,lineId:t.lineId,serviceType:t.serviceType,serviceId:t.serviceId,serviceMonth:t.monthRef,documentMonth:t.documentMonth,label:t.label,grossAmountCents:t.amountCents,reductionAmountCents,netAmountCents:confirmed?t.amountCents-reductionAmountCents:null,confirmed};
  });
  return {basis:'EXPLICIT_SAME_DOCUMENT_SERVICE_REDUCTION_CURRENT_STATE',state:reviewAmountCents?'REVIEW':!selected.length?'NONE':unallocatedAmountCents?'PARTIAL':'COMPLETE',
    allocatedAmountCents,unallocatedAmountCents,reviewAmountCents,activeCount:globalActive.length,reviewCount:globalActive.filter(a=>a.needsReview).length,
    services:sample(services)};
}
module.exports={json,states,financial};
