'use strict';
const { hash } = require('./fieldWriteRequestService');
const { cents } = require('./monthlyFinancialProjection');
const { isReceivableInvoice } = require('./clientCreditService');
const { isCompletedVisitStatus } = require('./operationalValueReportService');
const { SERVICE_CATEGORIES } = require('./reminderScopeService');
const normalize = value => String(value || '').trim().toUpperCase();
const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const types = { MAINTENANCE_EQUIPMENT:'EQUIPMENT', MAINTENANCE_REMINDER:'REMINDER' };
const aliases = line => [...new Set([line.type,line.lineType].map(normalize).map(t=>types[t]).filter(Boolean))];
const references = line => positive(line.referenceId) ? aliases(line).map(kind=>kind+':'+line.referenceId) : [];
const key = (kind,id) => 'maintenance-billing:'+kind+':'+id;
const sameDate = (left,right) => typeof left === 'string' && Number.isFinite(Date.parse(left)) && right instanceof Date && +right === Date.parse(left);
const visitSelect = {id:true,poolId:true,clientId:true,status:true};
async function load(db, invoices) {
  const candidates=invoices.flatMap(i=>i.lines).flatMap(references),ids=kind=>[...new Set(candidates.filter(k=>k.startsWith(kind+':')).map(k=>Number(k.split(':')[1])))];
  const equipmentIds=ids('EQUIPMENT'),reminderIds=ids('REMINDER');
  const [equipment,reminders,decisions,lines]=await Promise.all([
    db.equipmentMaintenanceCompletion.findMany({where:{id:{in:equipmentIds}},select:{id:true,planId:true,version:true,visitId:true,extraVisitId:true,notes:true,completedAt:true,result:true,plan:{select:{id:true,poolId:true}},visit:{select:visitSelect},extraVisit:{select:visitSelect}}}),
    db.generalReminder.findMany({where:{id:{in:reminderIds}},select:{id:true,title:true,description:true,category:true,status:true,completedAt:true,clientId:true,poolId:true}}),
    db.operationalReminder.findMany({where:{sourceKey:{in:[...equipmentIds.map(id=>key('EQUIPMENT',id)),...reminderIds.map(id=>key('REMINDER',id))]}},select:{sourceKey:true,metadata:true}}),
    db.invoiceLine.findMany({where:{referenceId:{in:[...new Set([...equipmentIds,...reminderIds])]}},select:{type:true,lineType:true,referenceId:true,invoice:{select:{status:true,lines:{select:{type:true,lineType:true}}}}}})
  ]);
  const current=new Map([...equipment.map(r=>['EQUIPMENT:'+r.id,r]),...reminders.map(r=>['REMINDER:'+r.id,r])]);
  const receipts=new Map(decisions.map(d=>[d.sourceKey,d.metadata])),counts=new Map();
  // A conflicting alias still reserves every explicit identity, including in other months.
  for(const line of lines)if(isReceivableInvoice(line.invoice)&&!line.invoice.lines.some(l=>[l.type,l.lineType].map(normalize).includes('CREDIT_DEPOSIT')))for(const ref of references(line))counts.set(ref,(counts.get(ref)||0)+1);
  return {current,receipts,counts};
}
function match(context, invoice, line) {
  const kinds=aliases(line);
  if(kinds.length!==1)return {reason:'OTHER_SOURCE_UNALLOCATED'};
  const kind=kinds[0],id=line.referenceId,ref=kind+':'+id;
  if(!positive(id))return {reason:'MISSING_REFERENCE'};
  if(context.counts.get(ref)!==1)return {reason:'DUPLICATE_MAINTENANCE_REFERENCE'};
  const proof=context.receipts.get(key(kind,id)),s=proof?.source,r=proof?.result;
  if(!s||!r||r.ok!==true||r.schema!==1||s.kind!==kind||r.kind!==kind||s.sourceId!==id||r.sourceId!==id||s.reviewable!==true||s.reviewIssue!==null||!positive(s.clientId)||!positive(s.poolId)||r.clientId!==s.clientId||r.poolId!==s.poolId||!/^v1:[a-f0-9]{64}$/.test(r.expectedVersion)||s.expectedVersion!==r.expectedVersion||!Number.isFinite(Date.parse(r.reviewedAt))||typeof r.note!=='string'||typeof s.title!=='string'||typeof s.details!=='string')return {reason:'MAINTENANCE_DECISION_UNCONFIRMED'};
  if(proof.fingerprint!==hash({expectedVersion:r.expectedVersion,expectedClientId:r.clientId,expectedPoolId:r.poolId,mode:r.mode,amountCents:r.amountCents,note:r.note}))return {reason:'MAINTENANCE_DECISION_UNCONFIRMED'};
  if(r.mode!=='EXTRA'||r.status!=='DRAFT'||!positive(r.amountCents)||cents(r.amount)!==r.amountCents||r.invoiceId!==invoice.id||r.invoiceLineId!==line.id||r.amountCents!==cents(line.total)||line.quantity!==1||cents(line.unitPrice)!==r.amountCents)return {reason:'MAINTENANCE_DOCUMENT_CHANGED'};
  if(s.clientId!==invoice.clientId)return {reason:'CLIENT_MISMATCH'};
  const row=context.current.get(ref);if(!row)return {reason:'MISSING_MAINTENANCE_SOURCE'};
  if(!sameDate(s.completedAt,row.completedAt))return {reason:'MAINTENANCE_SOURCE_CHANGED'};
  if(kind==='EQUIPMENT'){
    const type=row.extraVisitId?'EXTRA':'REGULAR',visit=row.extraVisitId?row.extraVisit:row.visit;
    if(row.result?.ok!==true||row.result?.applied===false||!positive(row.version)||row.result?.plan?.version!==row.version+1||row.result?.plan?.poolId!==s.poolId||!sameDate(row.result?.completedAt,row.completedAt))return {reason:'MAINTENANCE_SOURCE_CHANGED'};
    if(!!row.visitId===!!row.extraVisitId||!visit||s.visitType!==type||s.visitId!==visit.id||s.poolId!==row.plan?.poolId||visit.poolId!==s.poolId||row.result?.plan?.id!==row.planId||row.result?.plan?.title!==s.title||row.notes!==s.details)return {reason:'MAINTENANCE_SOURCE_CHANGED'};
    if(visit.clientId!==s.clientId)return {reason:'CLIENT_MISMATCH'};
    // An intervention may finish while its parent visit is still in progress.
    if(!isCompletedVisitStatus(visit.status)&&normalize(visit.status)!=='IN_PROGRESS')return {reason:'MAINTENANCE_SOURCE_CHANGED'};
  }else{
    if(s.visitId!==null||s.visitType!==null||row.poolId!==s.poolId||row.title!==s.title||(row.description||'')!==s.details||!SERVICE_CATEGORIES.includes(row.category)||!isCompletedVisitStatus(row.status))return {reason:'MAINTENANCE_SOURCE_CHANGED'};
    if(row.clientId!==s.clientId)return {reason:'CLIENT_MISMATCH'};
  }
  return {reason:null,kind,id,poolId:s.poolId,label:s.title,completedMonth:row.completedAt.toISOString().slice(0,7),visitType:s.visitType,visitId:s.visitId};
}
module.exports={aliases,references,load,match};
