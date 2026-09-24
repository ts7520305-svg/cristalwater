'use strict';
const recorded = require('./recordedWorkTimeService');
const { hash } = require('./fieldWriteRequestService');
const journal=require('./equipmentMaterialReviewJournal').create(require('../../frontend/cw-equipment-time-review-rules'),'workTime');
const basis = 'DECLARED_EQUIPMENT_WORK_INTERVAL', multipleBasis = 'DECLARED_EQUIPMENT_WORK_INTERVALS';
const intervals = value => Array.isArray(value?.intervals) ? value.intervals.filter(w=>w&&typeof w==='object') : value?.intervals === undefined && value ? [{startAt:value.startAt,endAt:value.endAt}] : [];
const duration = value => intervals(value).reduce((sum,w)=>sum+Date.parse(w.endAt)-Date.parse(w.startAt),0);
const positive = n => Number.isSafeInteger(n) && n > 0;
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function single(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && instant(value.startAt) && instant(value.endAt) && Date.parse(value.endAt) > Date.parse(value.startAt);
}
function valid(value) {
  return value?.intervals === undefined ? single(value) : Object.keys(value).length === 1 && Array.isArray(value.intervals) && value.intervals.length > 0 && value.intervals.length <= 20 && value.intervals.every((w,i,a)=>single(w)&&(!i||Date.parse(w.startAt)>=Date.parse(a[i-1].endAt)));
}
function parse(value) {
  if (!valid(value)) throw Object.assign(new Error('Indique início e fim válidos para o trabalho, com o fim posterior ao início.'), { status: 400 });
  return value.intervals ? {intervals:value.intervals.map(w=>({startAt:w.startAt,endAt:w.endAt}))} : { startAt: value.startAt, endAt: value.endAt };
}
function origin(visit, visitType) {
  return { visitType, visitId: visit.id, poolId: visit.poolId, clientId: visit.clientId, technicianId: visit.technicianId, visitStartAt: visit.startAt?.toISOString() || null };
}
function create(input, visit, visitType, originReviewHash = null) {
  const record = input.intervals ? {schema:2,basis:multipleBasis,intervals:input.intervals.map(w=>({...w,durationMs:Date.parse(w.endAt)-Date.parse(w.startAt)})),durationMs:duration(input),origin:origin(visit,visitType)} : { schema: 1, basis, ...input, durationMs: Date.parse(input.endAt) - Date.parse(input.startAt), origin: origin(visit, visitType) };
  return originReviewHash ? {...record,schema:3,originReviewHash} : record;
}
function time(row) { return row.result?.completion?.workTime; }
const selection = { id: true, requestId: true, planId: true, fingerprint: true, completedAt: true, result: true };
async function receipts(db, rows) {
  const ids = rows.map(row => row.requestId);
  return new Map((ids.length ? await db.fieldWriteRequest.findMany({ where: { scope: 'EQUIPMENT_MAINTENANCE', requestId: { in: ids } }, select: { owner: true, requestId: true, resourceId: true, payloadHash: true, response: true } }) : []).filter(r => r.response?.applied === true && positive(r.response.completion?.id)).map(r => [r.requestId + ':' + r.response.completion.id, r]));
}
function intact(row, proofs) {
  const saved = proofs.get(row.requestId + ':' + row.id);
  return !!saved && saved.resourceId === row.planId && saved.payloadHash === row.fingerprint && saved.response?.applied === true && saved.response.completion?.id === row.id && hash(saved.response) === hash(row.result);
}
const hadTime = (row, proofs) => time(row) || proofs.get(row.requestId + ':' + row.id)?.response?.completion?.workTime;
function sound(record) {
  if(!record||!positive(record.origin?.technicianId))return false;
  if(record.schema===3){const {originReviewHash,...base}=record;return /^[a-f0-9]{64}$/.test(originReviewHash)&&sound({...base,schema:Array.isArray(base.intervals)?2:1});}
  if(record.schema===1)return record.basis===basis&&single({startAt:record.startAt,endAt:record.endAt})&&record.durationMs===duration(record);
  return record.schema===2&&record.basis===multipleBasis&&Object.keys(record).length===5&&Array.isArray(record.intervals)&&valid({intervals:record.intervals.map(w=>({startAt:w?.startAt,endAt:w?.endAt}))})&&record.intervals.every(w=>Object.keys(w).length===3&&w.durationMs===Date.parse(w.endAt)-Date.parse(w.startAt))&&positive(record.durationMs)&&record.durationMs===duration(record);
}
function overlaps(a, b) { return intervals(a).some(x=>intervals(b).some(y=>Date.parse(x.startAt)<Date.parse(y.endAt)&&Date.parse(y.startAt)<Date.parse(x.endAt))); }
function within(input, visit, completedAt) {
  return positive(visit.technicianId) && visit.startAt instanceof Date && intervals(input).length>0 && intervals(input).every(w=>Date.parse(w.startAt)>=+visit.startAt&&Date.parse(w.endAt)<=+completedAt&&(!visit.endAt||Date.parse(w.endAt)<=+visit.endAt));
}
async function conflict(db, input, visit, visitType) {
  return (await recorded.conflicts(db, intervals(input).map(w=>({type:visitType,id:visit.id,technicianId:visit.technicianId,startAt:new Date(w.startAt),endAt:new Date(w.endAt)})))).size > 0;
}
async function readState(db,rows){
  const proofs=await receipts(db,rows),revisions=await require('./equipmentHistoricalResourceSource').qualify(db,await journal.read(db,rows,[...proofs.values()]));return {proofs,revisions};
}
function effective(row,{proofs,revisions}){
  const state=revisions.get(row.id),changed=!!state?.headHash,record=changed?state.record:time(row),historical=state?.history.at(-1)?.revision.preview.schema===2,valid=!!state?.valid&&(historical ? state.action==='WITHDRAW' ? state.originOriginalValid===true : state.originReviewValid===true&&record?.schema===3&&record.originReviewHash===state.originReview?.hash : intact(row,proofs));
  return {record,valid,had:!state?.valid||changed&&state.action!=='WITHDRAW'||!changed&&!!hadTime(row,proofs),withdrawn:changed&&state.action==='WITHDRAW',revision:changed?{headHash:state.headHash,action:state.action,proof:state.history.at(-1)}:null};
}
async function check(db,input,visit,visitType,completedAt,excludeId=null){
  if(!within(input,visit,completedAt))return 'O tempo da revisão tem de ficar dentro da visita iniciada, com técnico atribuído, e não pode terminar no futuro.';
  // The caller holds the parent visit lock, serializing every plan in this visit.
  const rows=(await db.equipmentMaintenanceCompletion.findMany({where:visitType==='EXTRA'?{extraVisitId:visit.id}:{visitId:visit.id},select:selection})).filter(row=>row.id!==excludeId),state=await readState(db,rows),expected=origin(visit,visitType);
  if(rows.some(row=>{const w=effective(row,state);return w.withdrawn&&(!w.valid||hash(w.revision.proof.revision.preview.origin)!==hash(Object.fromEntries(Object.entries(expected).filter(([k])=>k!=='visitStartAt'))))||w.had&&(!w.valid||!sound(w.record)||!within(w.record,visit,row.completedAt)||Object.entries(expected).some(([k,v])=>w.record.origin?.[k]!==v)||overlaps(input,w.record));}))return 'Já existe tempo registado noutra revisão desta visita. Reveja os intervalos antes de confirmar.';
  const associated=await require('./reminderVisitResourceJournal').reservations(db,visit,visitType);
  if(!associated.valid||associated.records.some(r=>require('./reminderVisitResourceJournal').rules.intervals(r).some(w=>overlaps(input,{startAt:w.startedAt,endAt:w.endedAt}))))return 'O intervalo coincide com uma parcela de lembrete ou existe uma declaração por rever.';
  if(await conflict(db,input,visit,visitType))return 'O técnico tem tempo registado em simultâneo noutro serviço. Reveja os horários antes de confirmar.';
  return null;
}
async function prepareRead(db,groups){
  const state=await readState(db,groups.flatMap(g=>g.rows));
  const conflicts=await recorded.conflicts(db,groups.flatMap(g=>g.rows.flatMap(row=>{const w=effective(row,state).record;return sound(w)?intervals(w).map(i=>({type:g.visitType,id:g.visit.id,technicianId:w.origin.technicianId,startAt:new Date(i.startAt),endAt:new Date(i.endAt)})):[];})));
  const associated=new Map();for(const g of groups)associated.set(g.visitType+':'+g.visit.id,await require('./reminderVisitResourceJournal').reservations(db,g.visit,g.visitType));
  return {...state,conflicts,associated};
}
async function describe(db,rows,visit,visitType,prepared){
  const state=prepared||await prepareRead(db,[{rows,visit,visitType}]),expected=origin(visit,visitType),views=new Map(),own=state.associated.get(visitType+':'+visit.id);
  for(const row of rows){
    const w=effective(row,state),record=w.record,extra=w.revision?{original:time(row)||null,revision:w.revision}:{};
    if(w.withdrawn&&w.valid&&hash(w.revision.proof.revision.preview.origin)===hash(Object.fromEntries(Object.entries(expected).filter(([k])=>k!=='visitStartAt')))){views.set(row.id,{state:'WITHDRAWN',record:null,...extra});continue;}
    if(!record){views.set(row.id,{state:w.had||w.withdrawn?'REVIEW':'MISSING',record:null,...extra});continue;}
    const review=own?.valid===false||own?.records.some(r=>require('./reminderVisitResourceJournal').rules.intervals(r).some(i=>overlaps(record,{startAt:i.startedAt,endAt:i.endedAt})))||!w.valid||!sound(record)||Object.entries(expected).some(([k,v])=>record.origin?.[k]!==v)||!within(record,visit,row.completedAt)||rows.some(other=>{if(other.id===row.id)return false;const t=effective(other,state);return t.had&&(!t.valid||!sound(t.record)||overlaps(record,t.record));})||state.conflicts.has(visitType+':'+visit.id);
    views.set(row.id,{state:review?'REVIEW':'RECORDED',record,...extra});
  }
  return views;
}
module.exports={parse,create,check,describe,selection,prepareRead,intervals,sound,journal,readState,effective,within};
