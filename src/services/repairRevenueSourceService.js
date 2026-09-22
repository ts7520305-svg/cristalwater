'use strict';
const { hash } = require('./fieldWriteRequestService');
const { cents } = require('./monthlyFinancialProjection');
const { isReceivableInvoice } = require('./clientCreditService');
const executions = require('./repairExecutionService');
const eventType = 'REPAIR_DOCUMENT_ORIGIN_RECORDED';
const normalize = value => String(value || '').trim().toUpperCase();
const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const json = value => JSON.parse(JSON.stringify(value));
const references = line => positive(line.referenceId) && [line.type,line.lineType].map(normalize).includes('REPAIR') ? [line.referenceId] : [];
const pureRepair = line => { const types=[line.type,line.lineType].map(normalize).filter(Boolean); return types.length>0 && types.every(t=>t==='REPAIR'); };
const repairSelect = { id:true,poolId:true,problem:true,quantity:true,unitPrice:true,totalPrice:true,createdAt:true,status:true,doneAt:true };
const repairSnapshot = row => json({id:row.id,poolId:row.poolId,problem:row.problem,quantity:row.quantity,unitPrice:row.unitPrice,totalPrice:row.totalPrice,createdAt:row.createdAt});
const lineSnapshot = line => json({id:line.id,invoiceId:line.invoiceId,referenceId:line.referenceId,description:line.description,quantity:line.quantity,unitPrice:line.unitPrice,total:line.total,lineTotal:line.lineTotal,serviceDate:line.serviceDate,sourceMonth:line.sourceMonth,notes:line.notes});
const states = ['PENDING','DIAGNOSED','QUOTE_REQUESTED','QUOTED','APPROVED','SCHEDULED','INVOICED','DONE','CLOSED'];
const fail = () => { throw Object.assign(Error('A origem da reparação mudou durante a faturação. Consulte os dados antes de repetir.'),{status:409}); };

// Only called by new-document creation, inside its transaction. Never backfill
// an existing document on issue, read or retry, and never infer origin from text.
async function record(db, invoiceId, actor, usedRepairs) {
  const invoice=await db.invoice.findUniqueOrThrow({where:{id:invoiceId},include:{lines:true}});
  const lines=invoice.lines.filter(l=>pureRepair(l)&&references(l).length);
  if(!lines.length)return;
  const ids=[...new Set(lines.map(l=>l.referenceId))].sort((a,b)=>a-b);
  for(const id of ids)await db.$queryRaw`SELECT id FROM "Repair" WHERE id=${id} FOR SHARE`;
  const repairs=await db.repair.findMany({where:{id:{in:ids}},select:repairSelect});
  const poolIds=[...new Set(repairs.map(r=>r.poolId))].sort((a,b)=>a-b);
  for(const id of poolIds)await db.$queryRaw`SELECT id FROM "Pool" WHERE id=${id} FOR SHARE`;
  const pools=new Map((await db.pool.findMany({where:{id:{in:poolIds}},select:{id:true,clientId:true}})).map(p=>[p.id,p]));
  const current=new Map(repairs.map(r=>[r.id,r])),used=usedRepairs&&new Map(usedRepairs.map(r=>[r.id,r]));
  if(await db.auditTrail.count({where:{eventType,entity:'InvoiceLine',entityId:{in:lines.map(l=>l.id)}}}))fail();
  for(const line of lines){
    const repair=current.get(line.referenceId);
    if(!repair||pools.get(repair.poolId)?.clientId!==invoice.clientId||!states.includes(normalize(repair.status))||used&&(!used.has(repair.id)||hash(repairSnapshot(used.get(repair.id)))!==hash(repairSnapshot(repair))))fail();
    const createdAt=new Date(),snapshot={schema:1,basis:'DOCUMENT_ORIGIN_ONLY',invoiceId,lineId:line.id,repairId:repair.id,clientId:invoice.clientId,poolId:repair.poolId,line:lineSnapshot(line),repair:repairSnapshot(repair),statusAtCapture:normalize(repair.status),doneAtAtCapture:repair.doneAt?.toISOString()||null,actor:String(actor),capturedAt:createdAt.toISOString()};
    await db.auditTrail.create({data:{eventType,action:eventType,entity:'InvoiceLine',entityId:line.id,clientId:invoice.clientId,poolId:repair.poolId,message:'Origem documental da reparação guardada; não comprova execução.',metadata:{...snapshot,fingerprint:hash(snapshot)},createdAt}});
  }
}
async function load(db,invoices,asOf=new Date()) {
  const ids=[...new Set(invoices.flatMap(i=>i.lines).flatMap(references))],lineIds=invoices.flatMap(i=>i.lines).filter(l=>references(l).length).map(l=>l.id);
  const [repairs,receipts,lines]=await Promise.all([
    db.repair.findMany({where:{id:{in:ids}},select:repairSelect}),
    db.auditTrail.findMany({where:{eventType,entity:'InvoiceLine',entityId:{in:lineIds}},select:{id:true,action:true,entityId:true,clientId:true,poolId:true,metadata:true,createdAt:true}}),
    db.invoiceLine.findMany({where:{referenceId:{in:ids}},select:{type:true,lineType:true,referenceId:true,invoice:{select:{status:true,lines:{select:{type:true,lineType:true}}}}}})
  ]);
  const proofs=new Map(),counts=new Map();
  for(const receipt of receipts){const list=proofs.get(receipt.entityId)||[];list.push(receipt);proofs.set(receipt.entityId,list);}
  for(const line of lines)if(isReceivableInvoice(line.invoice)&&!line.invoice.lines.some(l=>[l.type,l.lineType].map(normalize).includes('CREDIT_DEPOSIT')))for(const id of references(line))counts.set(id,(counts.get(id)||0)+1);
  return {current:new Map(repairs.map(r=>[r.id,r])),proofs,counts,execution:await executions.load(db,ids),asOf};
}
function match(context,invoice,line) {
  if(!positive(line.referenceId))return {reason:'MISSING_REFERENCE'};
  if(context.counts.get(line.referenceId)!==1)return {reason:'DUPLICATE_REPAIR_REFERENCE'};
  const receipts=context.proofs.get(line.id)||[],proof=receipts[0],s=proof?.metadata;
  if(receipts.length!==1||!s||s.schema!==1||s.basis!=='DOCUMENT_ORIGIN_ONLY'||proof.action!==eventType||s.invoiceId!==invoice.id||s.lineId!==line.id||s.repairId!==line.referenceId||!positive(s.clientId)||!positive(s.poolId)||proof.clientId!==s.clientId||proof.poolId!==s.poolId||typeof s.actor!=='string'||!states.includes(s.statusAtCapture)||s.capturedAt!==proof.createdAt?.toISOString())return {reason:'REPAIR_ORIGIN_UNCONFIRMED'};
  const {fingerprint,...snapshot}=s;
  if(hash(snapshot)!==fingerprint||!s.repair||s.repair.id!==s.repairId||s.repair.poolId!==s.poolId||typeof s.repair.problem!=='string')return {reason:'REPAIR_ORIGIN_UNCONFIRMED'};
  if(invoice.clientId!==s.clientId)return {reason:'CLIENT_MISMATCH'};
  if(!s.line||hash(s.line)!==hash(lineSnapshot({...line,invoiceId:invoice.id}))||cents(line.total)===null)return {reason:'REPAIR_DOCUMENT_CHANGED'};
  const repair=context.current.get(line.referenceId);
  if(!repair)return {reason:'MISSING_REPAIR_SOURCE'};
  if(!states.includes(normalize(repair.status))||hash(repairSnapshot(repair))!==hash(s.repair))return {reason:'REPAIR_SOURCE_CHANGED'};
  // Documentary origin and an authenticated execution declaration are separate.
  const execution=executions.evaluate(context.execution,repair,s.clientId,context.asOf);
  return {reason:null,id:repair.id,poolId:s.poolId,label:s.repair.problem,status:normalize(repair.status),executionConfirmed:execution.state==='CONFIRMED',execution};
}
module.exports={eventType,references,record,load,match,repairSnapshot,lineSnapshot};
