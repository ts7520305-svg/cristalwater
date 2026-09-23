'use strict';
const r=require('./expenseLedgerRules');
const basis='CONFIRMED_EXPENSE_LABOR_DISTRIBUTION',json=v=>JSON.parse(JSON.stringify(v));
const include={laborDistributions:{orderBy:{id:'asc'}}};
const active=expense=>(expense.laborDistributions||[]).filter(row=>!row.voidedAt);
const record=row=>json(Object.fromEntries(['id','expenseId','amountCents','snapshot','fingerprint','activeKey','reason','createdById','createdAt','voidedAt','voidReason'].map(k=>[k,row[k]])));
const expenseFacts=e=>require('./expenseCostAllocationService').expenseSnapshot(e);
function parts(value){
  if(!Array.isArray(value)||value.length<2||value.length>20)r.fail('Indique entre duas e vinte parcelas explícitas.');
  const rows=value.map(p=>{r.object(p,['technicianId','periodStart','periodEnd','paidMinutes','amountCents']);r.id(p.technicianId);r.id(p.paidMinutes);r.money(p.amountCents);const from=r.date(p.periodStart),until=r.date(p.periodEnd);if(from>until||p.paidMinutes>(until-from)/60000+1440)r.fail('Confirme o período e o tempo pago de cada parcela.');return {...p};});
  for(let i=0;i<rows.length;i++)for(let j=0;j<i;j++)if(rows[i].technicianId===rows[j].technicianId&&rows[i].periodStart<=rows[j].periodEnd&&rows[j].periodStart<=rows[i].periodEnd)r.fail('As parcelas do mesmo técnico não podem sobrepor os dias pagos. Use a composição própria para juntar encargos do mesmo período.');
  return rows;
}
function validRecord(row){
  try{const s=row.snapshot;if(s?.version!==1||s.basis!==basis||s.expense?.id!==row.expenseId||s.expense.category!=='LABOR'||s.expense.sourceType!=='MANUAL'||s.amountCents!==row.amountCents||s.expense.amountCents!==row.amountCents||r.hash(s)!==row.fingerprint)return false;
    const selected=parts(s.parts.map(p=>Object.fromEntries(['technicianId','periodStart','periodEnd','paidMinutes','amountCents'].map(k=>[k,p[k]]))));
    return selected.reduce((n,p)=>n+p.amountCents,0)===row.amountCents&&s.parts.every((p,i)=>p.index===i+1&&typeof p.technicianName==='string'&&p.technicianName.trim())&&(!row.voidedAt?row.activeKey===String(row.expenseId)&&row.voidReason===null:row.activeKey===null&&typeof row.voidReason==='string'&&!!row.voidReason.trim());
  }catch(error){if(error.status!==400&&!(error instanceof TypeError))throw error;return false;}
}
function inspect(expense,row){
  if(!validRecord(row))return {state:'REVIEW',reviewReasons:['DISTRIBUTION_RECORD_CHANGED']};
  if(row.voidedAt)return {state:'VOIDED',reviewReasons:[]};
  const good=!expense.cancelledAt&&active(expense).length===1&&r.hash(expenseFacts(expense))===r.hash(row.snapshot.expense);
  return {state:good?'CONFIRMED':'REVIEW',reviewReasons:good?[]:['DISTRIBUTION_EXPENSE_CHANGED']};
}
function decorate(expense){return {...expense,laborDistributions:(expense.laborDistributions||[]).map(row=>({...record(row),recordHash:r.hash(record(row)),...inspect(expense,row)}))};}
function selection(expense,index){
  const rows=active(expense);
  if(!rows.length){if(index!==undefined&&index!==null)return {error:'A repartição selecionada já não está ativa.'};return null;}
  if(rows.length!==1||inspect(expense,rows[0]).state!=='CONFIRMED')return {error:'Reveja o documento e a repartição do trabalho antes de valorizar.'};
  const row=rows[0],part=row.snapshot.parts.find(p=>p.index===index);
  if(!part)return {error:'Escolha uma parcela confirmada de técnico/período desta despesa.'};
  return {row,part,basis:{id:row.id,expenseId:expense.id,...Object.fromEntries(['technicianId','periodStart','periodEnd','paidMinutes'].map(k=>[k,part[k]]))},proof:{id:row.id,partIndex:index,fingerprint:row.fingerprint,snapshot:row.snapshot}};
}
async function preview(db,expense,value,lock=false){
  const selected=parts(value);
  if(expense.cancelledAt||expense.sourceType!=='MANUAL'||expense.category!=='LABOR')r.fail('Use uma despesa manual de trabalho ainda válida.',409);
  if(active(expense).length)r.fail('Anule a repartição atual antes de confirmar outra.',409);
  if(expense.expenseAllocations.some(a=>!a.voidedAt&&a.valuationType!=='MANUAL'))r.fail('Anule primeiro as valorizações ativas desta despesa.',409);
  if(selected.reduce((n,p)=>n+p.amountCents,0)!==expense.amountCents)r.fail('A soma das parcelas tem de corresponder exatamente ao total do documento.',409);
  const ids=[...new Set(selected.map(p=>p.technicianId))].sort((a,b)=>a-b);
  if(lock)for(const id of ids)await db.$queryRaw`SELECT id FROM "Technician" WHERE id=${id} FOR SHARE`;
  const technicians=await db.technician.findMany({where:{id:{in:ids}},select:{id:true,name:true}});if(technicians.length!==ids.length)r.fail('Um técnico já não está disponível. Consulte e reveja as parcelas.',409);
  const snapshot={version:1,basis,expense:expenseFacts(expense),amountCents:expense.amountCents,parts:selected.map((p,i)=>({index:i+1,...p,technicianName:technicians.find(t=>t.id===p.technicianId).name}))};
  const valueSnapshot={version:1,expenseId:expense.id,expenseVersion:expense.version,snapshot,fingerprint:r.hash(snapshot)};return {...valueSnapshot,hash:r.hash(valueSnapshot)};
}
async function apply(db,who,env,expense){
  const d=env.data,reason=r.text(d.reason,500,true);
  if(d.confirmed!==true)r.fail('Reveja e confirme a repartição.');
  let current,created,before=null,checked=null;
  if(env.command==='SET_LABOR_DISTRIBUTION'){
    r.object(d,['parts','previewHash','reason','confirmed']);if(typeof d.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(d.previewHash))r.fail('Reveja a repartição antes de guardar.');
    try{checked=await preview(db,expense,d.parts,true);}catch(error){if(error.status!==409)throw error;return {applied:false,code:'DISTRIBUTION_REVIEW',message:error.message};}
    if(checked.hash!==d.previewHash)return {applied:false,code:'DISTRIBUTION_CHANGED',message:'O documento, técnico ou repartição mudou. Consulte e reveja novamente.'};
    created=await db.expenseLaborDistribution.create({data:{expenseId:expense.id,amountCents:expense.amountCents,snapshot:checked.snapshot,fingerprint:checked.fingerprint,activeKey:String(expense.id),reason,createdById:who.id}});
  }else{
    r.object(d,['distributionId','recordHash','reason','confirmed']);r.id(d.distributionId);if(typeof d.recordHash!=='string'||!/^[a-f0-9]{64}$/.test(d.recordHash))r.fail('Consulte a repartição antes de a anular.');
    current=(expense.laborDistributions||[]).find(row=>row.id===d.distributionId&&!row.voidedAt);
    if(!current||r.hash(record(current))!==d.recordHash)return {applied:false,code:'DISTRIBUTION_CHANGED',message:'A repartição mudou ou já foi anulada. Consulte o histórico.'};
    if(expense.expenseAllocations.some(a=>!a.voidedAt&&a.valuationType==='LABOR'))return {applied:false,code:'ACTIVE_VALUATIONS',message:'Anule primeiro os custos valorizados desta despesa; o histórico será conservado.'};
    before=record(current);created=await db.expenseLaborDistribution.update({where:{id:current.id},data:{voidedAt:new Date(),voidReason:reason,activeKey:null}});
  }
  const updated=await db.companyExpense.update({where:{id:expense.id},data:{version:{increment:1}}});
  return {applied:true,expenseId:expense.id,version:updated.version,distribution:record(created),distributionBefore:before,recordHash:r.hash(record(created)),preview:checked,reason};
}
module.exports={basis,include,parts,active,record,validRecord,inspect,decorate,selection,preview,apply};
